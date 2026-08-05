import "server-only";

import { createHash } from "node:crypto";

import {
  MatchStatus,
  MvpAward,
  MvpEvaluationStatus,
  OutboxStatus,
  Prisma,
} from "@/generated/prisma/client";
import {
  MVP_EVALUATOR_VERSION,
  MVP_GROUPS,
  MVP_METRIC_CONTRACT,
  isMvpMetricKey,
  isMvpPosition,
  isMvpSnapshotBaselineStatus,
  isMvpTierBucket,
} from "@/domain/mvp/contract";
import {
  deriveMvpMetrics,
  evaluateMvpParticipant,
  rankMvpTeams,
  type MvpParticipantEvaluation,
} from "@/domain/mvp/evaluator";
import { serverEnv } from "@/lib/env/server";
import {
  isCompetitionWriteClosed,
  lockSeasonMatchCompetitionScope,
} from "@/server/competition/write-fence";
import { db } from "@/server/db/client";
import { grantRerollEntitlement } from "@/server/scoring/service";

const PENDING_RETRY_DELAY_MS = 5 * 60_000;

function jsonNumber(value: Prisma.JsonValue, key: string) {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    typeof value[key] !== "number"
  ) {
    return 0;
  }
  return value[key];
}

function jsonInput(value: unknown): Prisma.InputJsonValue {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("MVP_JSON_ENCODING_FAILED");
  return JSON.parse(encoded) as Prisma.InputJsonValue;
}

function evaluationKey(parts: readonly string[]) {
  return `mvp:${createHash("sha256").update(parts.join("\u001f")).digest("hex")}`;
}

function evaluationOutcomeFingerprint(evaluation: MvpParticipantEvaluation) {
  return JSON.stringify([
    evaluation.status,
    evaluation.errorCode,
    evaluation.teamId,
    evaluation.win,
    evaluation.position,
    evaluation.tierBucket,
    evaluation.deaths,
    evaluation.objectiveInvolvement,
    MVP_GROUPS.map((group) => {
      const breakdown = evaluation.groups[group];
      return [
        group,
        breakdown
          ? [
              breakdown.score,
              breakdown.configuredWeight,
              breakdown.weightedScore,
              breakdown.coverage,
              breakdown.missingMetrics,
              MVP_METRIC_CONTRACT[group].map((metricKey) => {
                const metric = breakdown.metrics[metricKey];
                return [
                  metricKey,
                  metric?.raw ?? null,
                  metric?.mean ?? null,
                  metric?.stdDev ?? null,
                  metric?.sampleSize ?? null,
                  metric?.zScore ?? null,
                  metric?.winsorizedZScore ?? null,
                  metric?.effectiveGroupWeight ?? null,
                ];
              }),
            ]
          : null,
      ];
    }),
    evaluation.totalScore,
    evaluation.teamRank,
    evaluation.award,
    evaluation.tieBreakPath,
  ]);
}

function invalidEvaluation(input: {
  participantKey: string;
  teamId: number;
  win: boolean;
  deaths: number;
  position: string | null;
  tierBucket: string | null;
}): MvpParticipantEvaluation {
  return {
    participantKey: input.participantKey,
    teamId: input.teamId,
    win: input.win,
    position:
      input.position && isMvpPosition(input.position) ? input.position : null,
    tierBucket:
      input.tierBucket && isMvpTierBucket(input.tierBucket)
        ? input.tierBucket
        : null,
    deaths: input.deaths,
    objectiveInvolvement: 0,
    status: "PENDING_DATA",
    errorCode: "INVALID_MATCH",
    groups: {},
    totalScore: null,
    teamRank: null,
    award: "NONE",
    tieBreakPath: [],
  };
}

type AwardedMvp = Extract<MvpAward, "MVP" | "ACE">;

function awarded(value: MvpAward): value is AwardedMvp {
  return value === MvpAward.MVP || value === MvpAward.ACE;
}

function awardCounterUpdate(previous: MvpAward, next: MvpAward) {
  return {
    ...(previous === MvpAward.MVP && next !== MvpAward.MVP
      ? { mvpCount: { decrement: 1 } }
      : previous !== MvpAward.MVP && next === MvpAward.MVP
        ? { mvpCount: { increment: 1 } }
        : {}),
    ...(previous === MvpAward.ACE && next !== MvpAward.ACE
      ? { aceCount: { decrement: 1 } }
      : previous !== MvpAward.ACE && next === MvpAward.ACE
        ? { aceCount: { increment: 1 } }
        : {}),
  } satisfies Prisma.ParticipantWeekUpdateInput;
}

export type MvpEvaluationSummary = {
  seasonMatchId: string;
  baselineVersionId: string | null;
  evaluatorVersion: string;
  completed: number;
  pending: number;
  awards: number;
  entitlementsGranted: number;
};

export async function evaluateSeasonMatchMvpAce(
  seasonMatchId: string,
  now = new Date(),
  options: { evaluatorVersion?: string } = {},
): Promise<MvpEvaluationSummary> {
  const evaluatorVersion =
    options.evaluatorVersion?.trim() || MVP_EVALUATOR_VERSION;
  if (evaluatorVersion.length > 64) {
    throw new Error("MVP_EVALUATOR_VERSION_INVALID");
  }
  const seasonMatch = await db.seasonMatch.findUnique({
    where: { id: seasonMatchId },
    select: {
      id: true,
      status: true,
      matchId: true,
      week: {
        select: {
          endAt: true,
          baselineVersion: {
            select: {
              id: true,
              status: true,
              demoOnly: true,
              metrics: {
                select: {
                  tierBucket: true,
                  position: true,
                  metricKey: true,
                  mean: true,
                  stdDev: true,
                  sampleSize: true,
                },
              },
            },
          },
        },
      },
      match: {
        select: {
          durationSeconds: true,
          teams: { select: { teamId: true, championKills: true } },
          rawParticipants: {
            orderBy: { participantIndex: "asc" },
            select: {
              id: true,
              puuid: true,
              teamId: true,
              win: true,
              position: true,
              startingTier: true,
              tierBucket: true,
              kills: true,
              deaths: true,
              assists: true,
              totalMinionsKilled: true,
              neutralMinionsKilled: true,
              goldEarned: true,
              damageToChampions: true,
              damageTaken: true,
              damageMitigated: true,
              damageToObjectives: true,
              damageToTurrets: true,
              visionScore: true,
              wardsPlaced: true,
              wardsKilled: true,
              healOnTeammates: true,
              shieldOnTeammates: true,
              normalizedMetrics: true,
              participantMatches: {
                where: { seasonMatchId },
                take: 1,
                select: {
                  id: true,
                  participantWeekId: true,
                  eligible: true,
                  pointDraw: {
                    select: {
                      id: true,
                      rerollEligible: true,
                      rerollEntitlementKey: true,
                      rerollEntitlementSource: true,
                      rerollUsedAt: true,
                    },
                  },
                },
              },
              mvpEvaluations: {
                where: {
                  seasonMatchId,
                  corrections: { none: {} },
                },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: {
                  id: true,
                  evaluationKey: true,
                  evaluatorVersion: true,
                  status: true,
                  award: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!seasonMatch) throw new Error("MVP_SEASON_MATCH_NOT_FOUND");

  const baseline = seasonMatch.week.baselineVersion;
  const baselineUsable = isMvpSnapshotBaselineStatus(baseline?.status);
  const publishedMetrics = baselineUsable
    ? baseline.metrics.flatMap((metric) =>
        isMvpMetricKey(metric.metricKey)
          ? [
              {
                tierBucket: metric.tierBucket,
                position: metric.position,
                metricKey: metric.metricKey,
                mean: Number(metric.mean),
                stdDev: Number(metric.stdDev),
                sampleSize: metric.sampleSize,
              },
            ]
          : [],
      )
    : [];
  const teamKills = new Map(
    seasonMatch.match.teams.map((team) => [team.teamId, team.championKills]),
  );
  const rawById = new Map(
    seasonMatch.match.rawParticipants.map((participant) => [
      participant.id,
      participant,
    ]),
  );
  const initial = seasonMatch.match.rawParticipants.map((participant) => {
    if (seasonMatch.status === MatchStatus.INVALID) {
      return invalidEvaluation({
        participantKey: participant.id,
        teamId: participant.teamId,
        win: participant.win,
        deaths: participant.deaths,
        position: participant.position,
        tierBucket: participant.tierBucket,
      });
    }
    const metrics = deriveMvpMetrics({
      durationSeconds: seasonMatch.match.durationSeconds,
      teamKills: teamKills.get(participant.teamId) ?? 0,
      championLevel: jsonNumber(participant.normalizedMetrics, "championLevel"),
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
      goldEarned: participant.goldEarned,
      damageToChampions: participant.damageToChampions,
      damageTaken: participant.damageTaken,
      damageMitigated: participant.damageMitigated,
      damageToObjectives: participant.damageToObjectives,
      damageToTurrets: participant.damageToTurrets,
      visionScore: participant.visionScore,
      wardsPlaced: participant.wardsPlaced,
      wardsKilled: participant.wardsKilled,
      healOnTeammates: participant.healOnTeammates,
      shieldOnTeammates: participant.shieldOnTeammates,
    });
    return evaluateMvpParticipant(
      {
        participantKey: participant.id,
        teamId: participant.teamId,
        win: participant.win,
        position: participant.position,
        tierBucket: participant.tierBucket,
        deaths: participant.deaths,
        objectiveInvolvement:
          (metrics.damageToObjectivesPerMinute ?? 0) +
          (metrics.damageToTurretsPerMinute ?? 0),
        metrics,
      },
      publishedMetrics,
    );
  });
  const evaluations = rankMvpTeams(initial);
  const rewardsAllowed = Boolean(
    baseline &&
    baselineUsable &&
    (!baseline.demoOnly ||
      (serverEnv.NODE_ENV !== "production" &&
        serverEnv.ALLOW_DEMO_MVP_REWARDS)),
  );
  const entitlementWindowOpen =
    rewardsAllowed && now.getTime() < seasonMatch.week.endAt.getTime();

  const eligibleAwards: Array<{
    evaluationKey: string;
    participantMatchId: string;
    award: "MVP" | "ACE";
  }> = [];
  await db.$transaction(
    async (transaction) => {
      const competitionScope = await lockSeasonMatchCompetitionScope(
        transaction,
        seasonMatch.id,
      );
      if (!competitionScope || isCompetitionWriteClosed(competitionScope)) {
        throw new Error("MVP_EVALUATION_COMPETITION_CLOSED");
      }
      for (const evaluation of evaluations) {
        const raw = rawById.get(evaluation.participantKey);
        if (!raw) continue;
        const participantMatch = raw.participantMatches[0];
        const previousEvaluation = raw.mvpEvaluations[0];
        const status =
          evaluation.errorCode === "INVALID_MATCH"
            ? MvpEvaluationStatus.INVALID_MATCH
            : MvpEvaluationStatus[evaluation.status];
        const key = evaluationKey([
          seasonMatch.id,
          raw.id,
          evaluatorVersion,
          baseline?.id ?? "NO_BASELINE",
          status,
          evaluation.errorCode ?? "OK",
          evaluationOutcomeFingerprint(evaluation),
        ]);
        const inserted = await transaction.mvpEvaluation.createMany({
          data: [
            {
              evaluationKey: key,
              seasonMatchId: seasonMatch.id,
              matchParticipantRawId: raw.id,
              participantMatchId: participantMatch?.id ?? null,
              baselineVersionId: baseline?.id ?? null,
              status,
              errorCode: evaluation.errorCode,
              tierBucket: evaluation.tierBucket,
              position: evaluation.position,
              visionObjectiveScore:
                evaluation.groups.VISION_OBJECTIVE?.score ?? null,
              growthScore: evaluation.groups.GROWTH?.score ?? null,
              damageScore: evaluation.groups.DAMAGE?.score ?? null,
              kdaParticipationScore:
                evaluation.groups.KDA_PARTICIPATION?.score ?? null,
              totalScore: evaluation.totalScore,
              teamRank: evaluation.teamRank,
              award: MvpAward[evaluation.award],
              evaluatorVersion,
              metrics: jsonInput({
                startingTier: raw.startingTier,
                groups: evaluation.groups,
              }),
              tieBreak: jsonInput({
                participantKey: evaluation.participantKey,
                deaths: evaluation.deaths,
                objectiveInvolvement: evaluation.objectiveInvolvement,
                path: evaluation.tieBreakPath,
              }),
              supersedesEvaluationId: previousEvaluation?.id ?? null,
              createdAt: now,
            },
          ],
          skipDuplicates: true,
        });
        const nextAward = MvpAward[evaluation.award];
        const previousAward =
          previousEvaluation?.status === MvpEvaluationStatus.COMPLETED &&
          awarded(previousEvaluation.award)
            ? previousEvaluation.award
            : MvpAward.NONE;
        if (inserted.count === 1 && participantMatch?.eligible) {
          const counterUpdate = awardCounterUpdate(previousAward, nextAward);
          if (Object.keys(counterUpdate).length > 0) {
            await transaction.participantWeek.update({
              where: { id: participantMatch.participantWeekId },
              data: counterUpdate,
            });
          }

          const pointDraw = participantMatch.pointDraw;
          const existingEntitlementKey = pointDraw?.rerollEntitlementKey;
          if (
            pointDraw?.rerollUsedAt &&
            existingEntitlementKey &&
            existingEntitlementKey !== key
          ) {
            await transaction.auditLog.create({
              data: {
                action: "MVP_USED_ENTITLEMENT_PRESERVED",
                targetType: "PointDraw",
                targetId: pointDraw.id,
                reason: `MVP_EVALUATOR_CORRECTION_${evaluatorVersion}`,
                before: {
                  evaluationKey:
                    previousEvaluation?.evaluationKey ?? existingEntitlementKey,
                  award: previousAward,
                  entitlementKey: existingEntitlementKey,
                  rerollUsedAt: pointDraw.rerollUsedAt.toISOString(),
                },
                after: {
                  evaluationKey: key,
                  award: nextAward,
                  preservedEntitlementKey: existingEntitlementKey,
                  rerollUsedAt: pointDraw.rerollUsedAt.toISOString(),
                },
                requestId: key,
              },
            });
          }
          if (
            pointDraw &&
            existingEntitlementKey &&
            existingEntitlementKey !== key &&
            !pointDraw.rerollUsedAt
          ) {
            const shouldReplace = awarded(nextAward) && entitlementWindowOpen;
            const shouldRevoke = !awarded(nextAward);
            if (shouldReplace || shouldRevoke) {
              await transaction.pointDraw.update({
                where: { id: pointDraw.id },
                data: shouldReplace
                  ? {
                      rerollEligible: true,
                      rerollReason: `MVP_ACE_${nextAward}_${evaluatorVersion}`,
                      rerollEntitlementKey: key,
                      rerollEntitlementSource: baseline?.demoOnly
                        ? "DEMO_ONLY"
                        : nextAward,
                      rerollGrantedAt: now,
                      rerollExpiresAt: seasonMatch.week.endAt,
                      rerollDemoOnly: baseline?.demoOnly ?? false,
                    }
                  : {
                      rerollEligible: false,
                      rerollReason: null,
                      rerollEntitlementKey: null,
                      rerollEntitlementSource: null,
                      rerollGrantedAt: null,
                      rerollExpiresAt: null,
                      rerollDemoOnly: false,
                    },
              });
              await transaction.auditLog.create({
                data: {
                  action: shouldReplace
                    ? "MVP_ENTITLEMENT_REPLACED"
                    : "MVP_ENTITLEMENT_REVOKED",
                  targetType: "PointDraw",
                  targetId: pointDraw.id,
                  reason: `MVP_EVALUATOR_CORRECTION_${evaluatorVersion}`,
                  before: {
                    entitlementKey: existingEntitlementKey,
                    source: pointDraw.rerollEntitlementSource,
                  },
                  after: shouldReplace
                    ? {
                        entitlementKey: key,
                        source: baseline?.demoOnly ? "DEMO_ONLY" : nextAward,
                      }
                    : { entitlementKey: null, source: null },
                  requestId: key,
                },
              });
            }
          }
          if (awarded(nextAward) && entitlementWindowOpen && !pointDraw) {
            throw new Error("MVP_AWARD_POINT_DRAW_MISSING");
          }
        }
        if (
          participantMatch?.eligible &&
          awarded(nextAward) &&
          !participantMatch.pointDraw?.rerollUsedAt
        ) {
          eligibleAwards.push({
            evaluationKey: key,
            participantMatchId: participantMatch.id,
            award: nextAward,
          });
        }
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  let entitlementsGranted = 0;
  if (entitlementWindowOpen) {
    for (const award of eligibleAwards) {
      const entitlement = await grantRerollEntitlement({
        entitlementKey: award.evaluationKey,
        participantMatchId: award.participantMatchId,
        source: baseline?.demoOnly ? "DEMO_ONLY" : award.award,
        grantedAt: now,
        expiresAt: seasonMatch.week.endAt,
        reason: `MVP_ACE_${award.award}_${evaluatorVersion}`,
        demoOnly: baseline?.demoOnly ?? false,
      });
      if (entitlement.granted) entitlementsGranted += 1;
    }
  }

  const completed = evaluations.filter(
    (evaluation) => evaluation.status === "COMPLETED",
  ).length;
  const pending = evaluations.length - completed;
  if (pending === 0) {
    await db.processingOutbox.updateMany({
      where: {
        dedupeKey: `season-match:${seasonMatch.id}:mvp-evaluate:v1`,
        status: { not: OutboxStatus.PROCESSED },
      },
      data: {
        status: OutboxStatus.PROCESSED,
        processedAt: now,
        lockedAt: null,
        lastError: null,
      },
    });
  } else {
    await db.processingOutbox.updateMany({
      where: {
        dedupeKey: `season-match:${seasonMatch.id}:mvp-evaluate:v1`,
        status: { not: OutboxStatus.PROCESSED },
      },
      data: {
        status: OutboxStatus.PENDING,
        availableAt: new Date(now.getTime() + PENDING_RETRY_DELAY_MS),
        processedAt: null,
        lockedAt: null,
        lastError: "MVP_DATA_PENDING",
      },
    });
  }
  return {
    seasonMatchId: seasonMatch.id,
    baselineVersionId: baseline?.id ?? null,
    evaluatorVersion,
    completed,
    pending,
    awards: evaluations.filter((evaluation) => evaluation.award !== "NONE")
      .length,
    entitlementsGranted,
  };
}

export async function backfillMvpEvaluations(input: {
  seasonId?: string;
  limit?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const aggregateIds = input.seasonId
    ? await seasonMatchIds(input.seasonId)
    : undefined;
  const outbox = await db.processingOutbox.findMany({
    where: {
      type: "EVALUATE_MVP_ACE",
      status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
      availableAt: { lte: now },
      ...(aggregateIds ? { aggregateId: { in: aggregateIds } } : {}),
    },
    orderBy: { availableAt: "asc" },
    take: input.limit ?? 20,
    select: { id: true, aggregateId: true },
  });
  const result = {
    examined: outbox.length,
    processed: 0,
    pending: 0,
    failed: 0,
  };
  for (const item of outbox) {
    try {
      const evaluation = await evaluateSeasonMatchMvpAce(item.aggregateId, now);
      if (evaluation.pending > 0) result.pending += 1;
      else result.processed += 1;
    } catch (error) {
      result.failed += 1;
      await db.processingOutbox.update({
        where: { id: item.id },
        data: {
          status: OutboxStatus.FAILED,
          attempts: { increment: 1 },
          availableAt: new Date(now.getTime() + PENDING_RETRY_DELAY_MS),
          lastError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "MVP_EVALUATION_FAILED",
          lockedAt: null,
        },
      });
    }
  }
  return result;
}

async function seasonMatchIds(seasonId: string) {
  const matches = await db.seasonMatch.findMany({
    where: { seasonId },
    select: { id: true },
  });
  return matches.map((match) => match.id);
}
