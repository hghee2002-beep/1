import "server-only";

import { randomBytes, randomUUID } from "node:crypto";

import {
  DrawState,
  MatchStatus,
  MvpAward,
  MvpEvaluationStatus,
  OutboxStatus,
  Prisma,
  ScoreLedgerType,
  SeasonStatus,
  WeekStatus,
} from "@/generated/prisma/client";
import {
  createDrawCommitment,
  DRAW_COMMITMENT_VERSION,
  drawCommitmentExplanation,
  drawPointMagnitude,
  effectivePointMode,
  generateDrawNonce,
  pointModeFromLedgerEntries,
  rerollAdjustment,
  rngVersionForPointMode,
  signedPointDelta,
  type PointMode,
  type RandomBytesSource,
} from "@/domain/scoring/point-draw";
import { protectDrawNonce } from "@/domain/scoring/nonce-protection";
import { ScoringServiceError } from "@/features/scoring/errors";
import type {
  RerollEntitlement,
  RevealedDrawResult,
} from "@/features/scoring/types";
import { serverEnv } from "@/lib/env/server";
import { db } from "@/server/db/client";
import { isPrismaError, refreshWeekRanks } from "@/server/scoring/internal";
import {
  normalizedSign,
  pointDrawProtectionSecret,
  resolveVerifiedRevealedDraw,
  type RevealProofSelection,
} from "@/server/scoring/reveal-proof";

type ScoringDependencies = {
  now?: () => Date;
  randomSource?: RandomBytesSource;
  afterLedgerWrite?: () => Promise<void>;
};

const FIXED_20_FALLBACK_FLAG = "scoring.fixed20Fallback";

async function resolveEffectivePointMode(
  transaction: Prisma.TransactionClient,
  seasonMode: Parameters<typeof effectivePointMode>[0],
) {
  const fixed20Fallback = await transaction.featureFlag.findUnique({
    where: { key: FIXED_20_FALLBACK_FLAG },
    select: { enabled: true },
  });
  return effectivePointMode(
    seasonMode,
    fixed20Fallback?.enabled ? "FIXED_20" : serverEnv.POINT_MODE,
  );
}

function isSeasonFinalized(status: SeasonStatus) {
  return (
    status === SeasonStatus.FINALIZING ||
    status === SeasonStatus.COMPLETED ||
    status === SeasonStatus.ARCHIVED
  );
}

async function markRawMatchProcessed(
  transaction: Prisma.TransactionClient,
  matchId: string,
  now: Date,
) {
  const unfinished = await transaction.seasonMatch.count({
    where: {
      matchId,
      status: {
        in: [MatchStatus.INGESTED, MatchStatus.PROCESSING, MatchStatus.ERROR],
      },
    },
  });
  if (unfinished === 0) {
    await transaction.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.PROCESSED, processedAt: now },
    });
  }
}

async function scoreSeasonMatchTransaction(
  seasonMatchId: string,
  dependencies: ScoringDependencies,
) {
  const now = dependencies.now?.() ?? new Date();
  const randomSource = dependencies.randomSource ?? randomBytes;
  return db.$transaction(
    async (transaction) => {
      const seasonMatch = await transaction.seasonMatch.findUnique({
        where: { id: seasonMatchId },
        select: {
          id: true,
          matchId: true,
          weekId: true,
          status: true,
          season: { select: { status: true, scoringMode: true } },
          participantMatches: {
            orderBy: { id: "asc" },
            select: {
              id: true,
              participantWeekId: true,
              eligible: true,
              win: true,
              pointDraw: { select: { id: true } },
            },
          },
        },
      });
      if (!seasonMatch) {
        throw new ScoringServiceError(
          "MATCH_NOT_SCORABLE",
          "정산할 시즌 경기를 찾을 수 없습니다.",
        );
      }
      if (seasonMatch.status === MatchStatus.INVALID) {
        throw new ScoringServiceError(
          "MATCH_NOT_SCORABLE",
          "무효 경기는 정산할 수 없습니다.",
        );
      }
      if (isSeasonFinalized(seasonMatch.season.status)) {
        throw new ScoringServiceError(
          "SEASON_FINALIZED",
          "확정 중이거나 종료된 시즌은 정산할 수 없습니다.",
        );
      }

      const mode = await resolveEffectivePointMode(
        transaction,
        seasonMatch.season.scoringMode,
      );
      const rngVersion = rngVersionForPointMode(mode);
      let createdDraws = 0;
      for (const participantMatch of seasonMatch.participantMatches) {
        if (!participantMatch.eligible || participantMatch.pointDraw) continue;
        const drawId = randomUUID();
        const magnitude = drawPointMagnitude(mode, randomSource);
        const nonce = generateDrawNonce(randomSource);
        const resultSign = participantMatch.win ? 1 : -1;
        const signedDelta = signedPointDelta(participantMatch.win, magnitude);
        const commitment = createDrawCommitment({
          commitmentVersion: DRAW_COMMITMENT_VERSION,
          drawId,
          magnitude,
          nonce,
        });
        const protectedNonce = protectDrawNonce({
          nonce,
          drawId,
          phase: "FIRST",
          secret: pointDrawProtectionSecret(),
          randomSource,
        });

        await transaction.pointDraw.create({
          data: {
            id: drawId,
            participantMatchId: participantMatch.id,
            state: DrawState.SEALED,
            resultSign,
            firstValue: magnitude,
            firstNonceEncryptedOrProtected: protectedNonce,
            firstCommitment: commitment,
            firstCommitmentVersion: DRAW_COMMITMENT_VERSION,
            firstRngVersion: rngVersion,
            firstGeneratedAt: now,
            finalValue: magnitude,
            finalSignedValue: signedDelta,
          },
        });
        const ledger = await transaction.scoreLedger.create({
          data: {
            participantWeekId: participantMatch.participantWeekId,
            participantMatchId: participantMatch.id,
            type: ScoreLedgerType.MATCH_INITIAL,
            amount: signedDelta,
            idempotencyKey: `score:match-initial:${participantMatch.id}`,
            metadata: {
              drawId,
              commitmentVersion: DRAW_COMMITMENT_VERSION,
              rngVersion,
              pointMode: mode,
            },
          },
          select: { id: true },
        });
        await transaction.processingOutbox.create({
          data: {
            type: "POINT_DRAW_SETTLED",
            aggregateId: drawId,
            payload: {
              drawId,
              participantMatchId: participantMatch.id,
              ledgerId: ledger.id,
              commitment,
              commitmentVersion: DRAW_COMMITMENT_VERSION,
              rngVersion,
              pointMode: mode,
            },
            availableAt: now,
            dedupeKey: `point-draw:${drawId}:settled:v1`,
          },
        });
        await transaction.participantWeek.update({
          where: { id: participantMatch.participantWeekId },
          data: {
            mainScoreCached: { increment: signedDelta },
            ...(participantMatch.win
              ? { wins: { increment: 1 } }
              : { losses: { increment: 1 } }),
            lastProcessedMatchAt: now,
          },
        });
        await transaction.participantMatch.update({
          where: { id: participantMatch.id },
          data: { pointSignedCached: signedDelta, processedAt: now },
        });
        createdDraws += 1;
      }

      await dependencies.afterLedgerWrite?.();
      await refreshWeekRanks(transaction, seasonMatch.weekId);
      await transaction.seasonMatch.update({
        where: { id: seasonMatch.id },
        data: { status: MatchStatus.PROCESSED, processedAt: now },
      });
      await transaction.processingOutbox.updateMany({
        where: {
          dedupeKey: `season-match:${seasonMatch.id}:process:v1`,
          status: { in: [OutboxStatus.PENDING, OutboxStatus.PROCESSING] },
        },
        data: {
          status: OutboxStatus.PROCESSED,
          processedAt: now,
          lockedAt: null,
          lastError: null,
        },
      });
      await markRawMatchProcessed(transaction, seasonMatch.matchId, now);
      return { seasonMatchId: seasonMatch.id, createdDraws, mode };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function scoreSeasonMatch(
  seasonMatchId: string,
  dependencies: ScoringDependencies = {},
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await scoreSeasonMatchTransaction(seasonMatchId, dependencies);
    } catch (error) {
      if (isPrismaError(error, "P2002")) {
        const existing = await db.seasonMatch.findUnique({
          where: { id: seasonMatchId },
          select: {
            status: true,
            season: { select: { scoringMode: true } },
            participantMatches: {
              where: { eligible: true },
              select: {
                pointDraw: { select: { id: true } },
                scoreLedger: {
                  where: { type: ScoreLedgerType.MATCH_INITIAL },
                  take: 1,
                  select: { type: true, metadata: true },
                },
              },
            },
          },
        });
        if (
          existing?.status === MatchStatus.PROCESSED &&
          existing.participantMatches.every((match) => match.pointDraw !== null)
        ) {
          const storedMode = existing.participantMatches
            .map((match) => pointModeFromLedgerEntries(match.scoreLedger))
            .find((mode): mode is PointMode => mode !== null);
          const fixed20Fallback = storedMode
            ? null
            : await db.featureFlag.findUnique({
                where: { key: FIXED_20_FALLBACK_FLAG },
                select: { enabled: true },
              });
          const mode =
            storedMode ??
            effectivePointMode(
              existing.season.scoringMode,
              fixed20Fallback?.enabled ? "FIXED_20" : serverEnv.POINT_MODE,
            );
          return {
            seasonMatchId,
            createdDraws: 0,
            mode,
          };
        }
      }
      if (isPrismaError(error, "P2034") && attempt < 2) continue;
      if (isPrismaError(error, "P2002") || isPrismaError(error, "P2034")) {
        throw new ScoringServiceError(
          "SCORING_CONFLICT",
          "동시 정산 충돌이 발생했습니다. 안전하게 다시 시도할 수 있습니다.",
        );
      }
      throw error;
    }
  }
  throw new ScoringServiceError(
    "SCORING_CONFLICT",
    "동시 정산 충돌을 해결하지 못했습니다.",
  );
}

export async function backfillUnscoredMatches(input: {
  seasonId?: string;
  limit?: number;
}) {
  const rows = await db.seasonMatch.findMany({
    where: {
      ...(input.seasonId ? { seasonId: input.seasonId } : {}),
      status: MatchStatus.PROCESSING,
      participantMatches: {
        some: { eligible: true, pointDraw: null },
      },
    },
    orderBy: { createdAt: "asc" },
    take: input.limit ?? 20,
    select: { id: true },
  });
  const result = { examined: rows.length, processed: 0, failed: 0 };
  for (const row of rows) {
    try {
      await scoreSeasonMatch(row.id);
      result.processed += 1;
    } catch {
      result.failed += 1;
      await db.processingOutbox.updateMany({
        where: {
          dedupeKey: `season-match:${row.id}:process:v1`,
          status: { not: OutboxStatus.PROCESSED },
        },
        data: {
          status: OutboxStatus.FAILED,
          attempts: { increment: 1 },
          lastError: "SCORING_BACKFILL_FAILED",
        },
      });
    }
  }
  return result;
}

export async function revealPointDraw(input: {
  drawId: string;
  userId: string;
  requestId?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const draw = await db.$transaction(
    async (transaction) => {
      const existing = await transaction.pointDraw.findUnique({
        where: { id: input.drawId },
        select: {
          id: true,
          participantMatchId: true,
          state: true,
          resultSign: true,
          firstValue: true,
          firstNonceEncryptedOrProtected: true,
          firstCommitment: true,
          firstCommitmentVersion: true,
          firstRngVersion: true,
          revealedAt: true,
          secondValue: true,
          secondNonceEncryptedOrProtected: true,
          secondCommitment: true,
          secondCommitmentVersion: true,
          secondRngVersion: true,
          rerollUsedAt: true,
          participantMatch: {
            select: {
              eligible: true,
              participant: { select: { userId: true } },
              scoreLedger: {
                where: {
                  type: {
                    in: [
                      ScoreLedgerType.MATCH_INITIAL,
                      ScoreLedgerType.MATCH_REROLL_ADJUSTMENT,
                    ],
                  },
                },
                orderBy: { createdAt: "asc" },
                select: { type: true, metadata: true },
              },
              seasonMatch: {
                select: {
                  status: true,
                  week: { select: { status: true } },
                  season: { select: { status: true } },
                },
              },
            },
          },
        },
      });
      if (!existing) {
        throw new ScoringServiceError(
          "DRAW_NOT_FOUND",
          "포인트 결과를 찾을 수 없습니다.",
        );
      }
      if (existing.participantMatch.participant.userId !== input.userId) {
        throw new ScoringServiceError(
          "DRAW_FORBIDDEN",
          "이 포인트 결과를 공개할 권한이 없습니다.",
        );
      }
      if (existing.state === DrawState.VOID) {
        throw new ScoringServiceError(
          "MATCH_NOT_SCORABLE",
          "무효 처리된 경기의 결과는 공개할 수 없습니다.",
        );
      }
      if (existing.state === DrawState.SEALED) {
        const seasonMatch = existing.participantMatch.seasonMatch;
        if (
          !existing.participantMatch.eligible ||
          seasonMatch.status !== MatchStatus.PROCESSED ||
          seasonMatch.week.status !== WeekStatus.ACTIVE ||
          seasonMatch.season.status !== SeasonStatus.ACTIVE
        ) {
          throw new ScoringServiceError(
            "MATCH_NOT_SCORABLE",
            "활성 시즌·주차의 정상 정산 경기만 봉인 결과를 공개할 수 있습니다.",
          );
        }
        const updated = await transaction.pointDraw.updateMany({
          where: {
            id: existing.id,
            state: DrawState.SEALED,
            participantMatch: {
              eligible: true,
              seasonMatch: {
                status: MatchStatus.PROCESSED,
                week: { status: WeekStatus.ACTIVE },
                season: { status: SeasonStatus.ACTIVE },
              },
            },
          },
          data: { state: DrawState.REVEALED, revealedAt: now },
        });
        if (updated.count === 1) {
          existing.state = DrawState.REVEALED;
          existing.revealedAt = now;
          await transaction.auditLog.create({
            data: {
              actorUserId: input.userId,
              action: "POINT_DRAW_REVEALED",
              targetType: "PointDraw",
              targetId: existing.id,
              before: { state: DrawState.SEALED },
              after: {
                state: DrawState.REVEALED,
                revealedAt: now.toISOString(),
              },
              requestId: input.requestId ?? null,
            },
          });
          await transaction.processingOutbox.create({
            data: {
              type: "POINT_DRAW_REVEALED",
              aggregateId: existing.id,
              payload: {
                drawId: existing.id,
                participantMatchId: existing.participantMatchId,
              },
              availableAt: now,
              dedupeKey: `point-draw:${existing.id}:revealed:v1`,
            },
          });
        } else {
          throw new ScoringServiceError(
            "SCORING_CONFLICT",
            "공개 직전 경기 상태가 변경되었습니다. 최신 상태를 확인해 주세요.",
          );
        }
      }
      return existing;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  const revealAt =
    draw.state === DrawState.REROLLED
      ? (draw.rerollUsedAt ?? now)
      : (draw.revealedAt ?? now);
  return resolveVerifiedRevealedDraw(
    {
      ...(draw as RevealProofSelection),
      pointModeLedgerEntries: draw.participantMatch.scoreLedger,
    },
    revealAt,
  );
}

export async function rerollPointDraw(input: {
  drawId: string;
  userId: string;
  confirmed: boolean;
  requestId?: string;
  now?: Date;
  randomSource?: RandomBytesSource;
}) {
  if (!input.confirmed) {
    throw new ScoringServiceError(
      "REROLL_CONFIRMATION_REQUIRED",
      "두 번째 결과가 최종이라는 확인이 필요합니다.",
    );
  }
  const now = input.now ?? new Date();
  const randomSource = input.randomSource ?? randomBytes;
  try {
    return await db.$transaction(
      async (transaction) => {
        const draw = await transaction.pointDraw.findUnique({
          where: { id: input.drawId },
          select: {
            id: true,
            participantMatchId: true,
            state: true,
            resultSign: true,
            firstValue: true,
            rerollEligible: true,
            rerollReason: true,
            rerollExpiresAt: true,
            rerollDemoOnly: true,
            rerollUsedAt: true,
            secondValue: true,
            participantMatch: {
              select: {
                participantWeekId: true,
                win: true,
                participant: { select: { userId: true } },
                participantWeek: {
                  select: {
                    weekId: true,
                    week: {
                      select: {
                        status: true,
                        endAt: true,
                        season: { select: { status: true, scoringMode: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        });
        if (!draw) {
          throw new ScoringServiceError(
            "DRAW_NOT_FOUND",
            "포인트 결과를 찾을 수 없습니다.",
          );
        }
        if (draw.participantMatch.participant.userId !== input.userId) {
          throw new ScoringServiceError(
            "DRAW_FORBIDDEN",
            "이 포인트 결과를 재추첨할 권한이 없습니다.",
          );
        }
        if (draw.rerollUsedAt || draw.secondValue !== null) {
          throw new ScoringServiceError(
            "REROLL_ALREADY_USED",
            "이미 재추첨을 사용했습니다.",
          );
        }
        if (!draw.rerollEligible) {
          throw new ScoringServiceError(
            "REROLL_NOT_ELIGIBLE",
            "이 경기에는 재추첨권이 없습니다.",
          );
        }
        if (draw.rerollDemoOnly && !serverEnv.ALLOW_DEMO_MVP_REWARDS) {
          throw new ScoringServiceError(
            "REROLL_DEMO_BLOCKED",
            "DEMO_ONLY 재추첨권은 현재 환경에서 사용할 수 없습니다.",
          );
        }
        if (
          draw.state !== DrawState.REVEALED &&
          draw.state !== DrawState.AUTO_REVEALED
        ) {
          throw new ScoringServiceError(
            "REROLL_NOT_ELIGIBLE",
            "첫 결과를 공개한 뒤 재추첨할 수 있습니다.",
          );
        }
        const week = draw.participantMatch.participantWeek.week;
        if (isSeasonFinalized(week.season.status)) {
          throw new ScoringServiceError(
            "SEASON_FINALIZED",
            "확정 중이거나 종료된 시즌에서는 재추첨할 수 없습니다.",
          );
        }
        if (week.status !== WeekStatus.ACTIVE) {
          throw new ScoringServiceError(
            "WEEK_CLOSED",
            "활성 주차에서만 재추첨할 수 있습니다.",
          );
        }
        const expiresAt = draw.rerollExpiresAt ?? week.endAt;
        if (
          now.getTime() >= expiresAt.getTime() ||
          now.getTime() >= week.endAt.getTime()
        ) {
          throw new ScoringServiceError(
            "REROLL_EXPIRED",
            "재추첨 사용 기한이 지났습니다.",
          );
        }

        const mode = await resolveEffectivePointMode(
          transaction,
          week.season.scoringMode,
        );
        const rngVersion = rngVersionForPointMode(mode);
        const explanation = drawCommitmentExplanation(mode);
        const secondValue = drawPointMagnitude(mode, randomSource);
        const secondNonce = generateDrawNonce(randomSource);
        const secondCommitment = createDrawCommitment({
          commitmentVersion: DRAW_COMMITMENT_VERSION,
          drawId: draw.id,
          magnitude: secondValue,
          nonce: secondNonce,
        });
        const protectedSecondNonce = protectDrawNonce({
          nonce: secondNonce,
          drawId: draw.id,
          phase: "SECOND",
          secret: pointDrawProtectionSecret(),
          randomSource,
        });
        const resultSign = normalizedSign(draw.resultSign);
        const adjustment = rerollAdjustment(
          draw.participantMatch.win,
          draw.firstValue,
          secondValue,
        );
        const finalSignedValue = resultSign * secondValue;
        const claimed = await transaction.pointDraw.updateMany({
          where: {
            id: draw.id,
            rerollEligible: true,
            rerollUsedAt: null,
            secondValue: null,
            state: { in: [DrawState.REVEALED, DrawState.AUTO_REVEALED] },
          },
          data: {
            state: DrawState.REROLLED,
            secondValue,
            secondNonceEncryptedOrProtected: protectedSecondNonce,
            secondCommitment,
            secondCommitmentVersion: DRAW_COMMITMENT_VERSION,
            secondRngVersion: rngVersion,
            rerollUsedAt: now,
            finalValue: secondValue,
            finalSignedValue,
          },
        });
        if (claimed.count !== 1) {
          throw new ScoringServiceError(
            "REROLL_ALREADY_USED",
            "다른 요청에서 재추첨권을 먼저 사용했습니다.",
          );
        }
        await transaction.scoreLedger.create({
          data: {
            participantWeekId: draw.participantMatch.participantWeekId,
            participantMatchId: draw.participantMatchId,
            type: ScoreLedgerType.MATCH_REROLL_ADJUSTMENT,
            amount: adjustment,
            idempotencyKey: `score:match-reroll:${draw.participantMatchId}`,
            metadata: {
              drawId: draw.id,
              firstSignedValue: resultSign * draw.firstValue,
              finalSignedValue,
              commitmentVersion: DRAW_COMMITMENT_VERSION,
              rngVersion,
              pointMode: mode,
            },
          },
        });
        await transaction.participantWeek.update({
          where: { id: draw.participantMatch.participantWeekId },
          data: { mainScoreCached: { increment: adjustment } },
        });
        await transaction.participantMatch.update({
          where: { id: draw.participantMatchId },
          data: { pointSignedCached: finalSignedValue },
        });
        await refreshWeekRanks(
          transaction,
          draw.participantMatch.participantWeek.weekId,
        );
        await transaction.auditLog.create({
          data: {
            actorUserId: input.userId,
            action: "POINT_DRAW_REROLLED",
            targetType: "PointDraw",
            targetId: draw.id,
            reason: draw.rerollReason,
            before: {
              state: draw.state,
              finalSignedValue: resultSign * draw.firstValue,
            },
            after: {
              state: DrawState.REROLLED,
              finalSignedValue,
              adjustment,
              rerollUsedAt: now.toISOString(),
            },
            requestId: input.requestId ?? null,
          },
        });
        await transaction.processingOutbox.create({
          data: {
            type: "POINT_DRAW_REROLLED",
            aggregateId: draw.id,
            payload: {
              drawId: draw.id,
              participantMatchId: draw.participantMatchId,
              adjustment,
              finalSignedValue,
            },
            availableAt: now,
            dedupeKey: `point-draw:${draw.id}:rerolled:v1`,
          },
        });
        return {
          id: draw.id,
          participantMatchId: draw.participantMatchId,
          phase: "SECOND" as const,
          state: DrawState.REROLLED,
          resultSign,
          displayMagnitude: secondValue,
          signedDelta: finalSignedValue,
          nonce: secondNonce,
          commitment: secondCommitment,
          commitmentVersion: DRAW_COMMITMENT_VERSION,
          rngVersion,
          pointMode: mode,
          revealedAt: now.toISOString(),
          verifier: {
            algorithm: explanation.algorithm,
            encoding: explanation.encoding,
            fields: explanation.fields,
            probability: explanation.probability,
          },
        } satisfies RevealedDrawResult;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (isPrismaError(error, "P2002") || isPrismaError(error, "P2034")) {
      const latest = await db.pointDraw.findUnique({
        where: { id: input.drawId },
        select: { rerollUsedAt: true },
      });
      if (latest?.rerollUsedAt) {
        throw new ScoringServiceError(
          "REROLL_ALREADY_USED",
          "다른 요청에서 재추첨권을 먼저 사용했습니다.",
        );
      }
      throw new ScoringServiceError(
        "SCORING_CONFLICT",
        "재추첨 동시 요청 충돌이 발생했습니다. 최신 상태를 확인해 주세요.",
      );
    }
    throw error;
  }
}

export async function grantRerollEntitlement(entitlement: RerollEntitlement) {
  const entitlementKey = entitlement.entitlementKey.trim();
  const reason = entitlement.reason.trim();
  if (entitlementKey.length < 8 || entitlementKey.length > 160) {
    throw new ScoringServiceError(
      "REROLL_NOT_ELIGIBLE",
      "재추첨권 식별자는 8~160자여야 합니다.",
    );
  }
  if (reason.length < 3 || reason.length > 500) {
    throw new ScoringServiceError(
      "REROLL_NOT_ELIGIBLE",
      "재추첨권 발급 사유는 3~500자여야 합니다.",
    );
  }
  if (entitlement.demoOnly !== (entitlement.source === "DEMO_ONLY")) {
    throw new ScoringServiceError(
      "REROLL_DEMO_BLOCKED",
      "DEMO_ONLY 출처와 demoOnly 표시는 서로 일치해야 합니다.",
    );
  }
  if (entitlement.expiresAt.getTime() <= entitlement.grantedAt.getTime()) {
    throw new ScoringServiceError(
      "REROLL_EXPIRED",
      "재추첨권 만료 시각은 발급 시각보다 뒤여야 합니다.",
    );
  }
  if (
    entitlement.demoOnly &&
    (serverEnv.NODE_ENV === "production" || !serverEnv.ALLOW_DEMO_MVP_REWARDS)
  ) {
    throw new ScoringServiceError(
      "REROLL_DEMO_BLOCKED",
      "DEMO_ONLY 재추첨권은 명시적으로 허용된 개발·테스트 환경에서만 발급할 수 있습니다.",
    );
  }
  try {
    return await db.$transaction(
      async (transaction) => {
        const participantMatch = await transaction.participantMatch.findUnique({
          where: { id: entitlement.participantMatchId },
          select: {
            id: true,
            eligible: true,
            seasonMatch: { select: { status: true } },
            pointDraw: {
              select: {
                id: true,
                state: true,
                rerollEligible: true,
                rerollEntitlementKey: true,
                rerollUsedAt: true,
              },
            },
            participantWeek: {
              select: {
                week: {
                  select: {
                    endAt: true,
                    status: true,
                    season: { select: { status: true } },
                  },
                },
              },
            },
          },
        });
        if (!participantMatch?.pointDraw) {
          throw new ScoringServiceError(
            "DRAW_NOT_FOUND",
            "재추첨권을 연결할 포인트 결과를 찾을 수 없습니다.",
          );
        }
        if (
          !participantMatch.eligible ||
          participantMatch.seasonMatch.status !== MatchStatus.PROCESSED ||
          participantMatch.pointDraw.state === DrawState.VOID
        ) {
          throw new ScoringServiceError(
            "REROLL_NOT_ELIGIBLE",
            "유효하게 정산된 경기 결과에만 재추첨권을 연결할 수 있습니다.",
          );
        }
        const week = participantMatch.participantWeek.week;
        if (
          week.status !== WeekStatus.ACTIVE ||
          isSeasonFinalized(week.season.status)
        ) {
          throw new ScoringServiceError(
            "WEEK_CLOSED",
            "활성 주차의 결과에만 재추첨권을 발급할 수 있습니다.",
          );
        }
        if (entitlement.expiresAt.getTime() > week.endAt.getTime()) {
          throw new ScoringServiceError(
            "REROLL_EXPIRED",
            "재추첨권 기한은 주차 종료 시각을 넘을 수 없습니다.",
          );
        }
        if (participantMatch.pointDraw.rerollUsedAt) {
          throw new ScoringServiceError(
            "REROLL_ALREADY_USED",
            "이미 재추첨을 사용한 결과입니다.",
          );
        }
        if (
          participantMatch.pointDraw.rerollEntitlementKey === entitlementKey
        ) {
          return {
            drawId: participantMatch.pointDraw.id,
            granted: false,
          };
        }
        if (participantMatch.pointDraw.rerollEligible) {
          throw new ScoringServiceError(
            "REROLL_NOT_ELIGIBLE",
            "이미 다른 재추첨권이 연결된 결과입니다.",
          );
        }
        await transaction.pointDraw.update({
          where: { id: participantMatch.pointDraw.id },
          data: {
            rerollEligible: true,
            rerollReason: reason,
            rerollEntitlementKey: entitlementKey,
            rerollEntitlementSource: entitlement.source,
            rerollGrantedAt: entitlement.grantedAt,
            rerollExpiresAt: entitlement.expiresAt,
            rerollDemoOnly: entitlement.demoOnly,
          },
        });
        await transaction.auditLog.create({
          data: {
            action: "POINT_DRAW_REROLL_ENTITLEMENT_GRANTED",
            targetType: "PointDraw",
            targetId: participantMatch.pointDraw.id,
            reason,
            before: { rerollEligible: false },
            after: {
              rerollEligible: true,
              entitlementKey,
              source: entitlement.source,
              grantedAt: entitlement.grantedAt.toISOString(),
              expiresAt: entitlement.expiresAt.toISOString(),
              demoOnly: entitlement.demoOnly,
            },
          },
        });
        await transaction.processingOutbox.create({
          data: {
            type: "POINT_DRAW_REROLL_ENTITLEMENT_GRANTED",
            aggregateId: participantMatch.pointDraw.id,
            payload: {
              drawId: participantMatch.pointDraw.id,
              participantMatchId: participantMatch.id,
              entitlementKey,
              source: entitlement.source,
              demoOnly: entitlement.demoOnly,
            },
            availableAt: entitlement.grantedAt,
            dedupeKey: `reroll-entitlement:${entitlementKey}`,
          },
        });
        return { drawId: participantMatch.pointDraw.id, granted: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      const existing = await db.pointDraw.findUnique({
        where: { rerollEntitlementKey: entitlementKey },
        select: { id: true, participantMatchId: true },
      });
      if (existing?.participantMatchId === entitlement.participantMatchId) {
        return { drawId: existing.id, granted: false };
      }
      if (existing) {
        throw new ScoringServiceError(
          "SCORING_CONFLICT",
          "이미 다른 경기 결과에 사용된 재추첨권 식별자입니다.",
        );
      }
    }
    throw error;
  }
}

export async function autoRevealPointDraws(input: {
  now?: Date;
  limit?: number;
  seasonId?: string;
}) {
  const now = input.now ?? new Date();
  const candidates = await db.pointDraw.findMany({
    where: {
      state: DrawState.SEALED,
      participantMatch: {
        eligible: true,
        seasonMatch: { status: MatchStatus.PROCESSED },
        participantWeek: {
          week: {
            status: WeekStatus.ACTIVE,
            season: {
              status: SeasonStatus.ACTIVE,
              ...(input.seasonId ? { id: input.seasonId } : {}),
            },
          },
        },
      },
    },
    orderBy: { firstGeneratedAt: "asc" },
    take: input.limit ?? 100,
    select: {
      id: true,
      participantMatchId: true,
      firstGeneratedAt: true,
      participantMatch: {
        select: {
          participantWeek: {
            select: {
              week: {
                select: { season: { select: { autoRevealHours: true } } },
              },
            },
          },
        },
      },
    },
  });
  let revealed = 0;
  await db.$transaction(async (transaction) => {
    for (const candidate of candidates) {
      const revealAfter = new Date(
        candidate.firstGeneratedAt.getTime() +
          candidate.participantMatch.participantWeek.week.season
            .autoRevealHours *
            60 *
            60 *
            1_000,
      );
      if (revealAfter.getTime() > now.getTime()) continue;
      const updated = await transaction.pointDraw.updateMany({
        where: {
          id: candidate.id,
          state: DrawState.SEALED,
          participantMatch: {
            eligible: true,
            seasonMatch: { status: MatchStatus.PROCESSED },
            participantWeek: {
              week: {
                status: WeekStatus.ACTIVE,
                season: { status: SeasonStatus.ACTIVE },
              },
            },
          },
        },
        data: {
          state: DrawState.AUTO_REVEALED,
          autoRevealed: true,
          revealedAt: now,
        },
      });
      if (updated.count !== 1) continue;
      revealed += 1;
      await transaction.auditLog.create({
        data: {
          action: "POINT_DRAW_AUTO_REVEALED",
          targetType: "PointDraw",
          targetId: candidate.id,
          before: { state: DrawState.SEALED },
          after: {
            state: DrawState.AUTO_REVEALED,
            revealedAt: now.toISOString(),
          },
        },
      });
      await transaction.processingOutbox.create({
        data: {
          type: "POINT_DRAW_AUTO_REVEALED",
          aggregateId: candidate.id,
          payload: {
            drawId: candidate.id,
            participantMatchId: candidate.participantMatchId,
          },
          availableAt: now,
          dedupeKey: `point-draw:${candidate.id}:auto-revealed:v1`,
        },
      });
    }
  });
  return { examined: candidates.length, revealed };
}

export async function addAdminScoreAdjustment(input: {
  participantWeekId: string;
  amount: number;
  reason: string;
  actorUserId: string;
  idempotencyKey: string;
  requestId?: string;
  now?: Date;
}) {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new ScoringServiceError(
      "ADJUSTMENT_REASON_REQUIRED",
      "관리자 점수 조정 사유가 필요합니다.",
    );
  }
  const now = input.now ?? new Date();
  const idempotencyKey = input.idempotencyKey;
  try {
    return await db.$transaction(
      async (transaction) => {
        const participantWeek = await transaction.participantWeek.findUnique({
          where: { id: input.participantWeekId },
          select: {
            id: true,
            weekId: true,
            mainScoreCached: true,
            week: {
              select: { status: true, season: { select: { status: true } } },
            },
          },
        });
        if (!participantWeek) {
          throw new ScoringServiceError(
            "MATCH_NOT_SCORABLE",
            "점수를 조정할 참가자 주차를 찾을 수 없습니다.",
          );
        }
        if (
          participantWeek.week.status === WeekStatus.COMPLETED ||
          isSeasonFinalized(participantWeek.week.season.status)
        ) {
          throw new ScoringServiceError(
            "SEASON_FINALIZED",
            "종료되었거나 확정 중인 결과는 조정할 수 없습니다.",
          );
        }
        const ledger = await transaction.scoreLedger.create({
          data: {
            participantWeekId: participantWeek.id,
            type: ScoreLedgerType.ADMIN_ADJUSTMENT,
            amount: input.amount,
            idempotencyKey,
            reason,
            actorUserId: input.actorUserId,
            metadata: { source: "ADMIN_API" },
            createdAt: now,
          },
          select: { id: true, amount: true, createdAt: true },
        });
        await transaction.participantWeek.update({
          where: { id: participantWeek.id },
          data: { mainScoreCached: { increment: input.amount } },
        });
        await refreshWeekRanks(transaction, participantWeek.weekId);
        await transaction.auditLog.create({
          data: {
            actorUserId: input.actorUserId,
            action: "SCORE_ADMIN_ADJUSTED",
            targetType: "ParticipantWeek",
            targetId: participantWeek.id,
            reason,
            before: { mainScoreCached: participantWeek.mainScoreCached },
            after: {
              mainScoreCached: participantWeek.mainScoreCached + input.amount,
              ledgerId: ledger.id,
              amount: input.amount,
            },
            requestId: input.requestId ?? null,
          },
        });
        await transaction.processingOutbox.create({
          data: {
            type: "SCORE_ADMIN_ADJUSTED",
            aggregateId: participantWeek.id,
            payload: {
              participantWeekId: participantWeek.id,
              ledgerId: ledger.id,
            },
            availableAt: now,
            dedupeKey: `score-ledger:${ledger.id}:created:v1`,
          },
        });
        return { ...ledger, idempotencyKey };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      const existing = await db.scoreLedger.findUnique({
        where: { idempotencyKey },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          participantWeekId: true,
          type: true,
          reason: true,
          actorUserId: true,
        },
      });
      if (
        existing?.participantWeekId === input.participantWeekId &&
        existing.type === ScoreLedgerType.ADMIN_ADJUSTMENT &&
        existing.amount === input.amount &&
        existing.reason === reason &&
        existing.actorUserId === input.actorUserId
      ) {
        return {
          id: existing.id,
          amount: existing.amount,
          createdAt: existing.createdAt,
          idempotencyKey,
        };
      }
      if (existing) {
        throw new ScoringServiceError(
          "SCORING_CONFLICT",
          "이미 다른 참가자에게 사용된 관리자 조정 멱등 키입니다.",
        );
      }
    }
    throw error;
  }
}

export async function invalidateSeasonMatch(input: {
  seasonMatchId: string;
  actorUserId: string;
  reason: string;
  requestId?: string;
  now?: Date;
  confirmation?: string;
}) {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new ScoringServiceError(
      "ADJUSTMENT_REASON_REQUIRED",
      "경기 무효화 사유가 필요합니다.",
    );
  }
  const now = input.now ?? new Date();
  const operationId = input.requestId ?? randomUUID();
  return db.$transaction(
    async (transaction) => {
      const seasonMatch = await transaction.seasonMatch.findUnique({
        where: { id: input.seasonMatchId },
        select: {
          id: true,
          status: true,
          eligibilityReason: true,
          weekId: true,
          week: { select: { status: true } },
          season: { select: { status: true } },
          match: { select: { riotMatchId: true } },
          participantMatches: {
            select: {
              id: true,
              participantWeekId: true,
              eligible: true,
              win: true,
              pointDraw: { select: { id: true } },
              scoreLedger: {
                where: { type: ScoreLedgerType.MATCH_INITIAL },
                take: 1,
                select: { id: true },
              },
              participantWeek: {
                select: { mvpCount: true, aceCount: true },
              },
              mvpEvaluations: {
                where: {
                  status: MvpEvaluationStatus.COMPLETED,
                  award: { in: [MvpAward.MVP, MvpAward.ACE] },
                },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { award: true },
              },
            },
          },
        },
      });
      if (!seasonMatch) {
        throw new ScoringServiceError(
          "MATCH_NOT_SCORABLE",
          "무효화할 시즌 경기를 찾을 수 없습니다.",
        );
      }
      if (
        input.confirmation !== undefined &&
        input.confirmation !== seasonMatch.match.riotMatchId
      ) {
        throw new ScoringServiceError(
          "SCORING_CONFLICT",
          "경기 ID 확인 문구가 일치하지 않습니다.",
        );
      }
      if (seasonMatch.status === MatchStatus.INVALID) {
        return {
          seasonMatchId: seasonMatch.id,
          reversed: 0,
          alreadyInvalid: true,
        };
      }
      if (seasonMatch.status !== MatchStatus.PROCESSED) {
        throw new ScoringServiceError(
          "MATCH_NOT_SCORABLE",
          "정산이 완료된 경기만 반전 원장으로 무효화할 수 있습니다.",
        );
      }
      if (isSeasonFinalized(seasonMatch.season.status)) {
        throw new ScoringServiceError(
          "SEASON_FINALIZED",
          "확정 중이거나 종료된 시즌 경기는 무효화할 수 없습니다.",
        );
      }
      if (seasonMatch.week.status !== WeekStatus.ACTIVE) {
        throw new ScoringServiceError(
          "WEEK_CLOSED",
          "활성 주차의 정산 완료 경기만 무효화할 수 있습니다.",
        );
      }
      const eligibleMatches = seasonMatch.participantMatches.filter(
        (participantMatch) => participantMatch.eligible,
      );
      if (
        eligibleMatches.length === 0 ||
        eligibleMatches.some(
          (participantMatch) =>
            !participantMatch.pointDraw ||
            participantMatch.scoreLedger.length !== 1,
        )
      ) {
        throw new ScoringServiceError(
          "SCORING_CONFLICT",
          "경기 정산 원장 또는 포인트 결과가 완전하지 않아 무효화를 중단했습니다.",
        );
      }
      for (const participantMatch of eligibleMatches) {
        const award = participantMatch.mvpEvaluations[0]?.award;
        if (
          (award === MvpAward.MVP &&
            participantMatch.participantWeek.mvpCount < 1) ||
          (award === MvpAward.ACE &&
            participantMatch.participantWeek.aceCount < 1)
        ) {
          throw new ScoringServiceError(
            "SCORING_CONFLICT",
            "MVP/ACE 집계가 평가 이력과 일치하지 않아 무효화를 중단했습니다.",
          );
        }
      }
      const missionEffectCount = await transaction.missionProgressEvent.count({
        where: {
          participantMatchId: {
            in: seasonMatch.participantMatches.map((match) => match.id),
          },
        },
      });
      if (missionEffectCount > 0) {
        throw new ScoringServiceError(
          "SCORING_CONFLICT",
          "미션 진행에 반영된 경기는 미션 재계산 또는 관리자 보정 전에 무효화할 수 없습니다.",
        );
      }
      let reversed = 0;
      for (const participantMatch of eligibleMatches) {
        const previousReinstatement = await transaction.scoreLedger.findFirst({
          where: {
            participantMatchId: participantMatch.id,
            type: ScoreLedgerType.MATCH_REINSTATEMENT,
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        const aggregate = await transaction.scoreLedger.aggregate({
          where: { participantMatchId: participantMatch.id },
          _sum: { amount: true },
        });
        const currentMatchAmount = aggregate._sum.amount ?? 0;
        const reversalAmount = -currentMatchAmount;
        await transaction.scoreLedger.create({
          data: {
            participantWeekId: participantMatch.participantWeekId,
            participantMatchId: participantMatch.id,
            type: ScoreLedgerType.MATCH_INVALIDATION,
            amount: reversalAmount,
            idempotencyKey: `score:match-invalidation:${participantMatch.id}:${previousReinstatement?.id ?? "initial"}`,
            reason,
            actorUserId: input.actorUserId,
            metadata: {
              seasonMatchId: seasonMatch.id,
              reversedAmount: currentMatchAmount,
            },
          },
        });
        await transaction.participantWeek.update({
          where: { id: participantMatch.participantWeekId },
          data: {
            mainScoreCached: { increment: reversalAmount },
            ...(participantMatch.win
              ? { wins: { decrement: 1 } }
              : { losses: { decrement: 1 } }),
            ...(participantMatch.mvpEvaluations[0]?.award === MvpAward.MVP
              ? { mvpCount: { decrement: 1 } }
              : participantMatch.mvpEvaluations[0]?.award === MvpAward.ACE
                ? { aceCount: { decrement: 1 } }
                : {}),
          },
        });
        await transaction.participantMatch.update({
          where: { id: participantMatch.id },
          data: {
            eligible: false,
            eligibilityReason: "ADMIN_INVALIDATED",
            pointSignedCached: 0,
          },
        });
        await transaction.pointDraw.updateMany({
          where: { participantMatchId: participantMatch.id },
          data: { state: DrawState.VOID, rerollEligible: false },
        });
        reversed += 1;
      }
      await transaction.seasonMatch.update({
        where: { id: seasonMatch.id },
        data: {
          status: MatchStatus.INVALID,
          eligibilityReason: "ADMIN_INVALIDATED",
          processedAt: now,
        },
      });
      await refreshWeekRanks(transaction, seasonMatch.weekId);
      await transaction.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "SEASON_MATCH_INVALIDATED",
          targetType: "SeasonMatch",
          targetId: seasonMatch.id,
          reason,
          before: { status: seasonMatch.status },
          after: {
            status: MatchStatus.INVALID,
            reversedParticipants: reversed,
          },
          requestId: input.requestId ?? null,
        },
      });
      await transaction.processingOutbox.create({
        data: {
          type: "SEASON_MATCH_INVALIDATED",
          aggregateId: seasonMatch.id,
          payload: {
            seasonMatchId: seasonMatch.id,
            reversedParticipants: reversed,
          },
          availableAt: now,
          dedupeKey: `season-match:${seasonMatch.id}:invalidated:${operationId}`,
        },
      });
      return { seasonMatchId: seasonMatch.id, reversed, alreadyInvalid: false };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function reinstateSeasonMatch(input: {
  seasonMatchId: string;
  actorUserId: string;
  reason: string;
  confirmation: string;
  requestId?: string;
  now?: Date;
}) {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new ScoringServiceError(
      "ADJUSTMENT_REASON_REQUIRED",
      "경기 복구 사유가 필요합니다.",
    );
  }
  const now = input.now ?? new Date();
  return db.$transaction(
    async (transaction) => {
      const seasonMatch = await transaction.seasonMatch.findUnique({
        where: { id: input.seasonMatchId },
        select: {
          id: true,
          status: true,
          eligibilityReason: true,
          weekId: true,
          week: { select: { status: true } },
          season: { select: { status: true } },
          match: { select: { riotMatchId: true } },
          participantMatches: {
            select: {
              id: true,
              participantWeekId: true,
              eligible: true,
              eligibilityReason: true,
              win: true,
              scoreLedger: {
                where: { type: ScoreLedgerType.MATCH_INVALIDATION },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { id: true, amount: true },
              },
              mvpEvaluations: {
                where: {
                  status: MvpEvaluationStatus.COMPLETED,
                  award: { in: [MvpAward.MVP, MvpAward.ACE] },
                },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { award: true },
              },
              pointDraw: {
                select: {
                  finalSignedValue: true,
                  revealedAt: true,
                  autoRevealed: true,
                  rerollUsedAt: true,
                  rerollEntitlementKey: true,
                  rerollExpiresAt: true,
                },
              },
            },
          },
        },
      });
      if (!seasonMatch) {
        throw new ScoringServiceError(
          "MATCH_NOT_SCORABLE",
          "복구할 시즌 경기를 찾을 수 없습니다.",
        );
      }
      if (input.confirmation !== seasonMatch.match.riotMatchId) {
        throw new ScoringServiceError(
          "SCORING_CONFLICT",
          "경기 ID 확인 문구가 일치하지 않습니다.",
        );
      }
      if (seasonMatch.status !== MatchStatus.INVALID) {
        throw new ScoringServiceError(
          "SCORING_CONFLICT",
          "무효 상태인 경기만 복구할 수 있습니다.",
        );
      }
      if (seasonMatch.eligibilityReason !== "ADMIN_INVALIDATED") {
        throw new ScoringServiceError(
          "SCORING_CONFLICT",
          "관리자 반전 원장으로 무효화된 경기만 복구할 수 있습니다.",
        );
      }
      if (isSeasonFinalized(seasonMatch.season.status)) {
        throw new ScoringServiceError(
          "SEASON_FINALIZED",
          "확정 중이거나 종료된 시즌 경기는 복구할 수 없습니다.",
        );
      }
      if (seasonMatch.week.status !== WeekStatus.ACTIVE) {
        throw new ScoringServiceError(
          "WEEK_CLOSED",
          "활성 주차의 관리자 무효 경기만 복구할 수 있습니다.",
        );
      }
      const restorableMatches = seasonMatch.participantMatches.filter(
        (participantMatch) =>
          !participantMatch.eligible &&
          participantMatch.eligibilityReason === "ADMIN_INVALIDATED",
      );
      if (
        restorableMatches.length === 0 ||
        restorableMatches.some(
          (participantMatch) =>
            !participantMatch.pointDraw ||
            participantMatch.scoreLedger.length !== 1,
        )
      ) {
        throw new ScoringServiceError(
          "SCORING_CONFLICT",
          "복구할 반전 원장 또는 포인트 결과가 완전하지 않습니다.",
        );
      }
      let reinstated = 0;
      for (const participantMatch of restorableMatches) {
        const pointDraw = participantMatch.pointDraw;
        const invalidation = participantMatch.scoreLedger[0];
        if (!pointDraw || !invalidation) {
          throw new ScoringServiceError(
            "SCORING_CONFLICT",
            "복구할 경기 데이터가 완전하지 않습니다.",
          );
        }
        const reinstatementAmount = -invalidation.amount;
        await transaction.scoreLedger.create({
          data: {
            participantWeekId: participantMatch.participantWeekId,
            participantMatchId: participantMatch.id,
            type: ScoreLedgerType.MATCH_REINSTATEMENT,
            amount: reinstatementAmount,
            idempotencyKey: `score:match-reinstatement:${participantMatch.id}:${invalidation.id}`,
            reason,
            actorUserId: input.actorUserId,
            metadata: {
              seasonMatchId: seasonMatch.id,
              invalidationLedgerId: invalidation.id,
            },
          },
        });
        await transaction.participantWeek.update({
          where: { id: participantMatch.participantWeekId },
          data: {
            mainScoreCached: { increment: reinstatementAmount },
            ...(participantMatch.win
              ? { wins: { increment: 1 } }
              : { losses: { increment: 1 } }),
            ...(participantMatch.mvpEvaluations[0]?.award === MvpAward.MVP
              ? { mvpCount: { increment: 1 } }
              : participantMatch.mvpEvaluations[0]?.award === MvpAward.ACE
                ? { aceCount: { increment: 1 } }
                : {}),
          },
        });
        await transaction.participantMatch.update({
          where: { id: participantMatch.id },
          data: {
            eligible: true,
            eligibilityReason: "ADMIN_REINSTATED",
            pointSignedCached: pointDraw.finalSignedValue,
          },
        });
        const drawState = pointDraw.rerollUsedAt
          ? DrawState.REROLLED
          : pointDraw.revealedAt
            ? pointDraw.autoRevealed
              ? DrawState.AUTO_REVEALED
              : DrawState.REVEALED
            : DrawState.SEALED;
        const restoreRerollEligibility = Boolean(
          pointDraw.rerollEntitlementKey &&
          !pointDraw.rerollUsedAt &&
          pointDraw.rerollExpiresAt &&
          now.getTime() < pointDraw.rerollExpiresAt.getTime(),
        );
        await transaction.pointDraw.updateMany({
          where: { participantMatchId: participantMatch.id },
          data: {
            state: drawState,
            rerollEligible: restoreRerollEligibility,
          },
        });
        reinstated += 1;
      }
      await transaction.seasonMatch.update({
        where: { id: seasonMatch.id },
        data: {
          status: MatchStatus.PROCESSED,
          eligibilityReason: "ADMIN_REINSTATED",
          processedAt: now,
        },
      });
      await refreshWeekRanks(transaction, seasonMatch.weekId);
      await transaction.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "SEASON_MATCH_REINSTATED",
          targetType: "SeasonMatch",
          targetId: seasonMatch.id,
          reason,
          before: { status: MatchStatus.INVALID },
          after: {
            status: MatchStatus.PROCESSED,
            reinstatedParticipants: reinstated,
          },
          requestId: input.requestId ?? null,
        },
      });
      return { seasonMatchId: seasonMatch.id, reinstated };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
