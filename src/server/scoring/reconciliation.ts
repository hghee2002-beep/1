import "server-only";

import { randomUUID } from "node:crypto";

import {
  inspectMatchScoreIntegrity,
  projectWinLossByParticipantWeek,
  type MatchScoreIntegrityIssue,
  type MatchScoreReconciliationInput,
} from "@/domain/scoring/reconciliation";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import { refreshWeekRanks } from "@/server/scoring/internal";

export type ScoreReconciliationScope = {
  weekId?: string;
  seasonId?: string;
};

export type ScoreReconciliationRow = {
  participantWeekId: string;
  weekId: string;
  cachedValue: number;
  ledgerSum: number;
  difference: number;
  cachedWins: number;
  expectedWins: number;
  winDifference: number;
  cachedLosses: number;
  expectedLosses: number;
  lossDifference: number;
  matchIssues: MatchScoreIntegrityIssue[];
  repairableMatchCaches: Array<{
    participantMatchId: string;
    expectedPointSignedCached: number;
  }>;
  consistent: boolean;
};

function normalizeScope(scope?: string | ScoreReconciliationScope) {
  return typeof scope === "string" ? { weekId: scope } : (scope ?? {});
}

export async function inspectScoreReconciliationWithClient(
  transaction: Prisma.TransactionClient,
  scope: ScoreReconciliationScope = {},
) {
  const participantWeeks = await transaction.participantWeek.findMany({
    where: {
      ...(scope.weekId ? { weekId: scope.weekId } : {}),
      ...(scope.seasonId ? { week: { seasonId: scope.seasonId } } : {}),
    },
    orderBy: [{ weekId: "asc" }, { id: "asc" }],
    select: {
      id: true,
      weekId: true,
      mainScoreCached: true,
      wins: true,
      losses: true,
      participantMatches: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          participantWeekId: true,
          eligible: true,
          eligibilityReason: true,
          win: true,
          pointSignedCached: true,
          seasonMatch: { select: { status: true } },
          pointDraw: {
            select: {
              state: true,
              resultSign: true,
              firstValue: true,
              secondValue: true,
              rerollUsedAt: true,
              finalValue: true,
              finalSignedValue: true,
            },
          },
          scoreLedger: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              type: true,
              amount: true,
              metadata: true,
            },
          },
        },
      },
    },
  });
  const sums = participantWeeks.length
    ? await transaction.scoreLedger.groupBy({
        by: ["participantWeekId"],
        where: {
          participantWeekId: { in: participantWeeks.map((row) => row.id) },
        },
        _sum: { amount: true },
      })
    : [];
  const sumByParticipantWeek = new Map(
    sums.map((row) => [row.participantWeekId, row._sum.amount ?? 0]),
  );
  const matches: MatchScoreReconciliationInput[] = participantWeeks.flatMap(
    (participantWeek) =>
      participantWeek.participantMatches.map((participantMatch) => ({
        participantMatchId: participantMatch.id,
        participantWeekId: participantMatch.participantWeekId,
        seasonMatchStatus: participantMatch.seasonMatch.status,
        eligible: participantMatch.eligible,
        eligibilityReason: participantMatch.eligibilityReason,
        win: participantMatch.win,
        pointSignedCached: participantMatch.pointSignedCached,
        pointDraw: participantMatch.pointDraw
          ? {
              state: participantMatch.pointDraw.state,
              resultSign: participantMatch.pointDraw.resultSign,
              firstValue: participantMatch.pointDraw.firstValue,
              secondValue: participantMatch.pointDraw.secondValue,
              rerollUsed: participantMatch.pointDraw.rerollUsedAt !== null,
              finalValue: participantMatch.pointDraw.finalValue,
              finalSignedValue: participantMatch.pointDraw.finalSignedValue,
            }
          : null,
        ledgers: participantMatch.scoreLedger,
      })),
  );
  const integrityByParticipantWeek = new Map<
    string,
    ReturnType<typeof inspectMatchScoreIntegrity>[]
  >();
  for (const match of matches) {
    const result = inspectMatchScoreIntegrity(match);
    const existing = integrityByParticipantWeek.get(match.participantWeekId);
    if (existing) existing.push(result);
    else integrityByParticipantWeek.set(match.participantWeekId, [result]);
  }
  const projectedRecords = projectWinLossByParticipantWeek(matches);

  return participantWeeks.map((row): ScoreReconciliationRow => {
    const ledgerSum = sumByParticipantWeek.get(row.id) ?? 0;
    const projection = projectedRecords.get(row.id) ?? {
      participantWeekId: row.id,
      wins: 0,
      losses: 0,
    };
    const matchResults = integrityByParticipantWeek.get(row.id) ?? [];
    const matchIssues = matchResults.flatMap((result) => result.issues);
    const repairableMatchCaches = matchResults.flatMap((result) => {
      const hasCacheMismatch = result.issues.some(
        (issue) => issue.code === "PARTICIPANT_MATCH_CACHE_MISMATCH",
      );
      return result.pointCacheRepairable &&
        hasCacheMismatch &&
        result.expectedPointSignedCached !== null
        ? [
            {
              participantMatchId: result.participantMatchId,
              expectedPointSignedCached: result.expectedPointSignedCached,
            },
          ]
        : [];
    });
    const difference = ledgerSum - row.mainScoreCached;
    const winDifference = projection.wins - row.wins;
    const lossDifference = projection.losses - row.losses;
    return {
      participantWeekId: row.id,
      weekId: row.weekId,
      cachedValue: row.mainScoreCached,
      ledgerSum,
      difference,
      cachedWins: row.wins,
      expectedWins: projection.wins,
      winDifference,
      cachedLosses: row.losses,
      expectedLosses: projection.losses,
      lossDifference,
      matchIssues,
      repairableMatchCaches,
      consistent:
        difference === 0 &&
        winDifference === 0 &&
        lossDifference === 0 &&
        matchIssues.length === 0,
    };
  });
}

export async function inspectScoreReconciliation(
  scope?: string | ScoreReconciliationScope,
) {
  const normalizedScope = normalizeScope(scope);
  return db.$transaction(
    (transaction) =>
      inspectScoreReconciliationWithClient(transaction, normalizedScope),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function reconcileScoreCaches(input: {
  weekId?: string;
  repair: boolean;
  actorUserId?: string;
  requestId?: string;
  now?: Date;
  reason?: string;
}) {
  const scope = input.weekId ? { weekId: input.weekId } : {};
  const inspected = await inspectScoreReconciliation(scope);
  const mismatches = inspected.filter((row) => !row.consistent);
  if (!input.repair || mismatches.length === 0) {
    return {
      checked: inspected.length,
      mismatches,
      unresolved: mismatches,
      repaired: 0,
      dryRun: !input.repair,
    };
  }

  const now = input.now ?? new Date();
  const repairId = randomUUID();
  const repaired = await db.$transaction(
    async (transaction) => {
      const freshRows = await inspectScoreReconciliationWithClient(
        transaction,
        scope,
      );
      const affectedWeeks = new Set<string>();
      let repairedRows = 0;

      for (const row of freshRows) {
        const participantWeekNeedsRepair =
          row.difference !== 0 ||
          row.winDifference !== 0 ||
          row.lossDifference !== 0;
        const matchCachesNeedRepair = row.repairableMatchCaches.length > 0;
        if (!participantWeekNeedsRepair && !matchCachesNeedRepair) continue;

        const reconciliation = await transaction.scoreReconciliation.create({
          data: {
            participantWeekId: row.participantWeekId,
            ledgerSum: row.ledgerSum,
            cachedValue: row.cachedValue,
            difference: row.difference,
            checkedAt: now,
            repairedAt: now,
            actorUserId: input.actorUserId ?? null,
            details: {
              repairId,
              source: "LEDGER_AND_MATCH_PROJECTION",
              previous: {
                mainScoreCached: row.cachedValue,
                wins: row.cachedWins,
                losses: row.cachedLosses,
              },
              projected: {
                mainScoreCached: row.ledgerSum,
                wins: row.expectedWins,
                losses: row.expectedLosses,
              },
              participantMatchCacheRepairs: row.repairableMatchCaches.map(
                (repair) => repair.participantMatchId,
              ),
            },
          },
          select: { id: true },
        });
        if (participantWeekNeedsRepair) {
          await transaction.participantWeek.update({
            where: { id: row.participantWeekId },
            data: {
              mainScoreCached: row.ledgerSum,
              wins: row.expectedWins,
              losses: row.expectedLosses,
            },
          });
        }
        for (const repair of row.repairableMatchCaches) {
          await transaction.participantMatch.update({
            where: { id: repair.participantMatchId },
            data: { pointSignedCached: repair.expectedPointSignedCached },
          });
        }
        await transaction.auditLog.create({
          data: {
            actorUserId: input.actorUserId ?? null,
            action: "SCORE_CACHE_RECONCILED",
            targetType: "ParticipantWeek",
            targetId: row.participantWeekId,
            reason:
              input.reason ??
              "Restore score caches from authoritative ledgers and match projections",
            before: {
              mainScoreCached: row.cachedValue,
              wins: row.cachedWins,
              losses: row.cachedLosses,
            },
            after: {
              mainScoreCached: row.ledgerSum,
              wins: row.expectedWins,
              losses: row.expectedLosses,
              participantMatchCacheRepairs: row.repairableMatchCaches.length,
              reconciliationId: reconciliation.id,
              repairId,
            },
            requestId: input.requestId ?? null,
          },
        });
        affectedWeeks.add(row.weekId);
        repairedRows += 1;
      }
      for (const affectedWeekId of affectedWeeks) {
        await refreshWeekRanks(transaction, affectedWeekId);
      }
      return repairedRows;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  const afterRepair = await inspectScoreReconciliation(scope);
  return {
    checked: inspected.length,
    mismatches,
    unresolved: afterRepair.filter((row) => !row.consistent),
    repaired,
    dryRun: false,
    repairId,
  };
}
