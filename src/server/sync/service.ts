import "server-only";

import { randomUUID } from "node:crypto";

import {
  ParticipantStatus,
  Prisma,
  SeasonParticipantStatus,
  SeasonStatus,
  SnapshotSource,
  SyncRunItemStatus,
  SyncRunStatus,
  type SyncTrigger,
} from "@/generated/prisma/client";
import { RANKED_SOLO_QUEUE_ID } from "@/domain/sync/match-eligibility";
import { resolveMvpTierBucket } from "@/domain/mvp/tier";
import { isRiotApiError, RiotApiError } from "@/features/riot/errors";
import { SyncServiceError } from "@/features/sync/errors";
import type { SyncRunSummary } from "@/features/sync/types";
import type { SyncRequestInput } from "@/features/sync/validation";
import type { RiotClient } from "@/features/riot/types";
import { serverEnv } from "@/lib/env/server";
import { db } from "@/server/db/client";
import { logError, logInfo } from "@/server/observability/logger";
import {
  createSyncHttpMetrics,
  type SyncHttpMetrics,
  withSyncHttpMetrics,
} from "@/server/observability/sync-metrics";
import {
  evaluateSeasonMatchMissions,
  fetchMissionTimeline,
} from "@/server/missions/evaluation-service";
import { evaluateSeasonMatchMvpAce } from "@/server/mvp/evaluation-service";
import { getRiotClient } from "@/server/riot/client";
import {
  backfillUnscoredMatches,
  scoreSeasonMatch,
} from "@/server/scoring/service";
import { ingestNormalizedMatch } from "@/server/sync/ingest";
import {
  acquireJobLease,
  heartbeatJobLease,
  releaseJobLease,
} from "@/server/sync/lease";
import {
  captureRankSnapshot,
  refreshDailyStandingSnapshots,
} from "@/server/sync/rank-snapshots";

type SyncParticipantTarget = {
  id: string;
  puuid: string;
  syncCursor: {
    seasonId: string | null;
    lastSuccessfulMatchStartAt: Date | null;
    newestKnownMatchId: string | null;
    paginationStart: number;
    paginationWindowStartAt: Date | null;
    paginationWindowEndAt: Date | null;
    lastSuccessAt: Date | null;
    consecutiveFailures: number;
    nextEligibleAt: Date | null;
  } | null;
};

type SyncSeason = {
  id: string;
  status: SeasonStatus;
  startAt: Date;
  endAt: Date;
  minGameDurationSeconds: number;
  weeks: { id: string; startAt: Date; endAt: Date }[];
  participants: {
    status: SeasonParticipantStatus;
    participant: SyncParticipantTarget & { status: ParticipantStatus };
  }[];
};

type MutableRunStats = {
  participantCount: number;
  matchIdsFound: number;
  matchesFetched: number;
  matchesProcessed: number;
  matchesSkipped: number;
  errorCount: number;
};

type SyncDependencies = {
  riotClient?: RiotClient;
  now?: () => Date;
  elapsedMs?: () => number;
};

type RunMatchSyncInput = SyncRequestInput & {
  trigger: SyncTrigger;
  requestedById?: string;
  requestId?: string;
};

async function resolveMatchTierSnapshots(
  riotClient: RiotClient,
  puuids: readonly string[],
) {
  const snapshots = new Map<
    string,
    {
      startingTier: string | null;
      tierBucket: ReturnType<typeof resolveMvpTierBucket>;
    }
  >();
  for (const puuid of [...new Set(puuids)]) {
    const ranked = await riotClient.getSoloQueueSnapshot(puuid);
    snapshots.set(puuid, {
      startingTier: ranked?.tier ?? null,
      tierBucket: resolveMvpTierBucket(ranked?.tier),
    });
  }
  return snapshots;
}

function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function dateMax(left: Date | null, right: Date | null) {
  if (!left) return right;
  if (!right) return left;
  return left.getTime() >= right.getTime() ? left : right;
}

function dateMin(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? left : right;
}

function safeError(error: unknown) {
  if (isRiotApiError(error)) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      retryAfterSeconds: error.retryAfterSeconds,
    };
  }
  if (error instanceof SyncServiceError) {
    return {
      code: error.code,
      message: error.message,
      retryable:
        error.code !== "SYNC_SEASON_CLOSED" &&
        error.code !== "SYNC_SEASON_NOT_FOUND" &&
        error.code !== "SYNC_PARTICIPANT_NOT_FOUND",
    };
  }
  return {
    code: "SYNC_INTERNAL_ERROR",
    message: "내부 동기화 단계에서 오류가 발생했습니다.",
    retryable: true,
    retryAfterSeconds: undefined,
  };
}

function metadataHasMore(metadata: unknown) {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "hasMore" in metadata &&
    metadata.hasMore === true
  );
}

function summaryFromRun(run: {
  id: string;
  status: SyncRunStatus;
  participantCount: number;
  matchIdsFound: number;
  matchesFetched: number;
  matchesProcessed: number;
  matchesSkipped: number;
  errorCount: number;
  metadata: unknown;
}): SyncRunSummary {
  const dryRun =
    typeof run.metadata === "object" &&
    run.metadata !== null &&
    "dryRun" in run.metadata &&
    run.metadata.dryRun === true;
  return {
    runId: run.id,
    status: run.status,
    participantCount: run.participantCount,
    matchIdsFound: run.matchIdsFound,
    matchesFetched: run.matchesFetched,
    matchesProcessed: run.matchesProcessed,
    matchesSkipped: run.matchesSkipped,
    errorCount: run.errorCount,
    hasMore: metadataHasMore(run.metadata),
    dryRun,
  };
}

async function findExistingRun(invocationKey: string) {
  return db.syncRun.findUnique({
    where: { invocationKey },
    select: {
      id: true,
      status: true,
      participantCount: true,
      matchIdsFound: true,
      matchesFetched: true,
      matchesProcessed: true,
      matchesSkipped: true,
      errorCount: true,
      metadata: true,
    },
  });
}

async function resolveSyncSeason(seasonId?: string): Promise<SyncSeason> {
  const include = {
    weeks: {
      orderBy: { startAt: "asc" as const },
      select: { id: true, startAt: true, endAt: true },
    },
    participants: {
      where: { status: SeasonParticipantStatus.ACTIVE },
      select: {
        status: true,
        participant: {
          select: {
            id: true,
            puuid: true,
            status: true,
            syncCursor: {
              select: {
                seasonId: true,
                lastSuccessfulMatchStartAt: true,
                newestKnownMatchId: true,
                paginationStart: true,
                paginationWindowStartAt: true,
                paginationWindowEndAt: true,
                lastSuccessAt: true,
                consecutiveFailures: true,
                nextEligibleAt: true,
              },
            },
          },
        },
      },
    },
  };
  if (seasonId) {
    const season = await db.season.findFirst({
      where: {
        id: seasonId,
        status: { in: [SeasonStatus.ACTIVE, SeasonStatus.SCHEDULED] },
      },
      include,
    });
    if (!season) {
      throw new SyncServiceError(
        "SYNC_SEASON_NOT_FOUND",
        "동기화할 진행 중 또는 예정 시즌을 찾을 수 없습니다.",
      );
    }
    return season;
  }

  const active = await db.season.findMany({
    where: { status: SeasonStatus.ACTIVE },
    take: 2,
    orderBy: { startAt: "asc" },
    include,
  });
  if (active.length > 1) {
    throw new SyncServiceError(
      "SYNC_SEASON_AMBIGUOUS",
      "활성 시즌이 여러 개라 동기화 대상을 자동 선택할 수 없습니다.",
    );
  }
  if (active[0]) return active[0];

  const scheduled = await db.season.findMany({
    where: { status: SeasonStatus.SCHEDULED },
    take: 2,
    orderBy: { startAt: "asc" },
    include,
  });
  if (scheduled.length > 1) {
    throw new SyncServiceError(
      "SYNC_SEASON_AMBIGUOUS",
      "예정 시즌이 여러 개라 동기화 대상을 자동 선택할 수 없습니다.",
    );
  }
  if (scheduled[0]) return scheduled[0];
  throw new SyncServiceError(
    "SYNC_SEASON_NOT_FOUND",
    "동기화할 진행 중 또는 예정 시즌이 없습니다.",
  );
}

function selectTargets(input: {
  season: SyncSeason;
  participantId?: string | undefined;
  force: boolean;
  now: Date;
  limit: number;
}) {
  const all = input.season.participants
    .map((entry) => entry.participant)
    .filter((participant) => participant.status === ParticipantStatus.ACTIVE);
  if (
    input.participantId &&
    !all.some((participant) => participant.id === input.participantId)
  ) {
    throw new SyncServiceError(
      "SYNC_PARTICIPANT_NOT_FOUND",
      "이 시즌의 활성 참가자를 찾을 수 없습니다.",
    );
  }
  const candidates = all
    .filter(
      (participant) =>
        !input.participantId || participant.id === input.participantId,
    )
    .filter((participant) => {
      if (input.force) return true;
      if ((participant.syncCursor?.paginationStart ?? 0) > 0) return true;
      const nextEligibleAt = participant.syncCursor?.nextEligibleAt;
      return !nextEligibleAt || nextEligibleAt.getTime() <= input.now.getTime();
    })
    .sort((left, right) => {
      const leftContinuation = (left.syncCursor?.paginationStart ?? 0) > 0;
      const rightContinuation = (right.syncCursor?.paginationStart ?? 0) > 0;
      if (leftContinuation !== rightContinuation) {
        return leftContinuation ? -1 : 1;
      }
      const leftSuccess = left.syncCursor?.lastSuccessAt?.getTime() ?? 0;
      const rightSuccess = right.syncCursor?.lastSuccessAt?.getTime() ?? 0;
      return leftSuccess - rightSuccess || left.id.localeCompare(right.id);
    });
  return {
    targets: candidates.slice(0, input.limit),
    hasMore: candidates.length > input.limit,
  };
}

async function createRunItem(input: {
  runId: string;
  participantId?: string | undefined;
  riotMatchId?: string | undefined;
  stage: string;
  status: SyncRunItemStatus;
  errorCode?: string | undefined;
  message?: string | undefined;
  retryable?: boolean | undefined;
  durationMs?: number | undefined;
}) {
  await db.syncRunItem.create({
    data: {
      syncRunId: input.runId,
      stage: input.stage,
      status: input.status,
      retryable: input.retryable ?? false,
      ...(input.participantId === undefined
        ? {}
        : { participantId: input.participantId }),
      ...(input.riotMatchId === undefined
        ? {}
        : { riotMatchId: input.riotMatchId }),
      ...(input.errorCode === undefined ? {} : { errorCode: input.errorCode }),
      ...(input.message === undefined
        ? {}
        : { messageSanitized: input.message }),
      ...(input.durationMs === undefined
        ? {}
        : { durationMs: input.durationMs }),
    },
  });
}

function retryDelayMs(error: unknown, failures: number) {
  if (isRiotApiError(error) && error.retryAfterSeconds !== undefined) {
    return error.retryAfterSeconds * 1_000;
  }
  return Math.min(3_600_000, 30_000 * 2 ** Math.min(6, failures - 1));
}

async function markCursorFailure(input: {
  participant: SyncParticipantTarget;
  seasonId: string;
  seasonEndAt: Date;
  now: Date;
  error: unknown;
}) {
  const safe = safeError(input.error);
  const failures = (input.participant.syncCursor?.consecutiveFailures ?? 0) + 1;
  const nextEligibleAt =
    isRiotApiError(input.error) && !input.error.retryable
      ? input.seasonEndAt
      : new Date(input.now.getTime() + retryDelayMs(input.error, failures));
  await db.syncCursor.upsert({
    where: { participantId: input.participant.id },
    update: {
      seasonId: input.seasonId,
      lastErrorAt: input.now,
      lastErrorCode: safe.code,
      consecutiveFailures: failures,
      nextEligibleAt,
    },
    create: {
      participantId: input.participant.id,
      seasonId: input.seasonId,
      lastErrorAt: input.now,
      lastErrorCode: safe.code,
      consecutiveFailures: failures,
      nextEligibleAt,
    },
  });
}

async function runMatchSyncObserved(
  input: RunMatchSyncInput,
  dependencies: SyncDependencies = {},
  httpMetrics: SyncHttpMetrics,
): Promise<SyncRunSummary> {
  const invocationKey =
    input.invocationKey ?? `${input.trigger}:${randomUUID()}`;
  const existing = await findExistingRun(invocationKey);
  if (existing) return summaryFromRun(existing);

  const season = await resolveSyncSeason(input.seasonId);
  const now = dependencies.now ?? (() => new Date());
  const elapsedMs = dependencies.elapsedMs ?? (() => Date.now());
  const startedAt = now();
  const startedTick = elapsedMs();
  const timeBudgetMs = input.timeBudgetMs ?? serverEnv.SYNC_TIME_BUDGET_MS;
  const limit = input.limit ?? serverEnv.SYNC_BATCH_SIZE;
  const source = serverEnv.MOCK_RIOT_API
    ? SnapshotSource.MOCK
    : SnapshotSource.RIOT_API;
  const riotClient = dependencies.riotClient ?? getRiotClient();
  const leaseKey = `match-sync:${season.id}`;
  const leaseDurationMs = serverEnv.SYNC_LEASE_SECONDS * 1_000;
  const ownerToken = await acquireJobLease({
    key: leaseKey,
    now: startedAt,
    durationMs: leaseDurationMs,
    recoveryGraceMs: serverEnv.SYNC_LEASE_RECOVERY_GRACE_SECONDS * 1_000,
  });
  if (!ownerToken) {
    throw new SyncServiceError(
      "JOB_ALREADY_RUNNING",
      "같은 시즌의 경기 동기화가 이미 실행 중입니다.",
    );
  }

  let runId: string | null = null;
  const stats: MutableRunStats = {
    participantCount: 0,
    matchIdsFound: 0,
    matchesFetched: 0,
    matchesProcessed: 0,
    matchesSkipped: 0,
    errorCount: 0,
  };
  let hasMore = false;
  let successfulParticipants = 0;
  const isOutOfTime = () => elapsedMs() - startedTick >= timeBudgetMs;

  try {
    try {
      const run = await db.syncRun.create({
        data: {
          invocationKey,
          trigger: input.trigger,
          startedAt,
          ...(input.requestedById === undefined
            ? {}
            : { requestedById: input.requestedById }),
          metadata: {
            seasonId: season.id,
            participantId: input.participantId ?? null,
            dryRun: input.dryRun,
            force: input.force,
            limit,
            timeBudgetMs,
            hasMore: false,
          },
        },
        select: { id: true },
      });
      runId = run.id;
      logInfo("sync.run.started", {
        requestId: input.requestId,
        syncRunId: runId,
        operation: "MATCH_SYNC",
        trigger: input.trigger,
        result: SyncRunStatus.RUNNING,
      });
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const duplicate = await findExistingRun(invocationKey);
      if (!duplicate) {
        throw new SyncServiceError(
          "SYNC_INVOCATION_CONFLICT",
          "동일 실행 키의 결과를 조회하지 못했습니다.",
        );
      }
      return summaryFromRun(duplicate);
    }

    if (!input.dryRun && !isOutOfTime()) {
      await backfillUnscoredMatches({ seasonId: season.id, limit });
    }

    const selected = selectTargets({
      season,
      participantId: input.participantId,
      force: input.force,
      now: startedAt,
      limit,
    });
    hasMore = selected.hasMore;
    stats.participantCount = selected.targets.length;

    for (const participant of selected.targets) {
      if (isOutOfTime()) {
        hasMore = true;
        break;
      }
      const heartbeatAt = now();
      const ownsLease = await heartbeatJobLease({
        key: leaseKey,
        ownerToken,
        now: heartbeatAt,
        durationMs: leaseDurationMs,
      });
      if (!ownsLease) {
        throw new SyncServiceError(
          "JOB_ALREADY_RUNNING",
          "동기화 lease 소유권을 잃었습니다.",
        );
      }

      const cursor = participant.syncCursor;
      const sameSeason = cursor?.seasonId === season.id;
      const continuing =
        sameSeason &&
        (cursor?.paginationStart ?? 0) > 0 &&
        cursor?.paginationWindowStartAt !== null &&
        cursor?.paginationWindowStartAt !== undefined &&
        cursor.paginationWindowEndAt !== null;
      const overlapStart = new Date(
        (sameSeason && cursor?.lastSuccessfulMatchStartAt
          ? cursor.lastSuccessfulMatchStartAt
          : season.startAt
        ).getTime() -
          (sameSeason ? serverEnv.SYNC_OVERLAP_MINUTES * 60_000 : 0),
      );
      const windowStart = continuing
        ? cursor.paginationWindowStartAt!
        : new Date(Math.max(season.startAt.getTime(), overlapStart.getTime()));
      const windowEnd = continuing
        ? cursor.paginationWindowEndAt!
        : dateMin(now(), season.endAt);
      let pageStart = continuing ? cursor.paginationStart : 0;
      let newestKnownMatchId = sameSeason
        ? (cursor?.newestKnownMatchId ?? null)
        : null;
      let latestMatchStart = sameSeason
        ? (cursor?.lastSuccessfulMatchStartAt ?? null)
        : null;
      let participantFailed = false;
      let participantComplete = windowEnd.getTime() <= windowStart.getTime();

      if (!input.dryRun) {
        await db.syncCursor.upsert({
          where: { participantId: participant.id },
          update: {
            seasonId: season.id,
            lastRequestedStartAt: windowStart,
            paginationStart: pageStart,
            paginationWindowStartAt: windowStart,
            paginationWindowEndAt: windowEnd,
          },
          create: {
            participantId: participant.id,
            seasonId: season.id,
            lastRequestedStartAt: windowStart,
            paginationStart: pageStart,
            paginationWindowStartAt: windowStart,
            paginationWindowEndAt: windowEnd,
          },
        });
        if (participantComplete) {
          await db.syncCursor.update({
            where: { participantId: participant.id },
            data: {
              seasonId: season.id,
              paginationStart: 0,
              paginationWindowStartAt: null,
              paginationWindowEndAt: null,
              lastSuccessAt: now(),
              lastErrorAt: null,
              lastErrorCode: null,
              consecutiveFailures: 0,
              nextEligibleAt: new Date(
                now().getTime() +
                  serverEnv.SYNC_PARTICIPANT_COOLDOWN_SECONDS * 1_000,
              ),
            },
          });
        }
      }

      while (!participantComplete && !participantFailed) {
        if (isOutOfTime()) {
          hasMore = true;
          break;
        }
        const pageStartedAt = elapsedMs();
        let matchIds: string[];
        try {
          matchIds = await riotClient.listMatchIds({
            puuid: participant.puuid,
            startTime: windowStart,
            endTime: windowEnd,
            queueId: RANKED_SOLO_QUEUE_ID,
            type: "ranked",
            start: pageStart,
            count: serverEnv.SYNC_MATCH_PAGE_SIZE,
          });
          stats.matchIdsFound += matchIds.length;
          await createRunItem({
            runId,
            participantId: participant.id,
            stage: "MATCH_LIST",
            status: SyncRunItemStatus.SUCCEEDED,
            durationMs: Math.max(0, elapsedMs() - pageStartedAt),
          });
        } catch (error) {
          const safe = safeError(error);
          stats.errorCount += 1;
          participantFailed = true;
          await createRunItem({
            runId,
            participantId: participant.id,
            stage: "MATCH_LIST",
            status: SyncRunItemStatus.FAILED,
            errorCode: safe.code,
            message: safe.message,
            retryable: safe.retryable,
            durationMs: Math.max(0, elapsedMs() - pageStartedAt),
          });
          if (!input.dryRun) {
            await markCursorFailure({
              participant,
              seasonId: season.id,
              seasonEndAt: season.endAt,
              now: now(),
              error,
            });
          }
          break;
        }

        const uniqueIds = [...new Set(matchIds)];
        if (pageStart === 0 && uniqueIds[0]) {
          newestKnownMatchId = uniqueIds[0];
        }
        const knownRows = uniqueIds.length
          ? await db.seasonMatch.findMany({
              where: {
                seasonId: season.id,
                match: { riotMatchId: { in: uniqueIds } },
              },
              select: {
                match: { select: { riotMatchId: true, gameStartAt: true } },
              },
            })
          : [];
        const knownIds = new Set(knownRows.map((row) => row.match.riotMatchId));
        for (const row of knownRows) {
          latestMatchStart = dateMax(latestMatchStart, row.match.gameStartAt);
        }
        stats.matchesSkipped += knownIds.size;

        let pageFailed = false;
        let pageInterrupted = false;
        let pageError: unknown;
        for (const matchId of uniqueIds) {
          if (knownIds.has(matchId)) continue;
          if (isOutOfTime()) {
            pageInterrupted = true;
            hasMore = true;
            break;
          }
          const matchStartedAt = elapsedMs();
          try {
            const match = await riotClient.getMatch(matchId);
            stats.matchesFetched += 1;
            const tierSnapshots = input.dryRun
              ? undefined
              : await resolveMatchTierSnapshots(
                  riotClient,
                  match.participants.map((participant) => participant.puuid),
                );
            const result = await ingestNormalizedMatch({
              season,
              match,
              now: now(),
              dryRun: input.dryRun,
              ...(tierSnapshots ? { tierSnapshots } : {}),
            });
            latestMatchStart = dateMax(latestMatchStart, result.matchStartAt);
            if (result.outcome === "PROCESSED") {
              if (!input.dryRun && result.seasonMatchId) {
                await scoreSeasonMatch(result.seasonMatchId);
                if (result.timelineNeeded) {
                  await fetchMissionTimeline({
                    seasonMatchId: result.seasonMatchId,
                    riotClient,
                    now: now(),
                  });
                }
                await evaluateSeasonMatchMvpAce(result.seasonMatchId, now());
                await evaluateSeasonMatchMissions(
                  result.seasonMatchId,
                  now(),
                  riotClient,
                );
              }
              stats.matchesProcessed += 1;
            } else {
              stats.matchesSkipped += 1;
            }
            await createRunItem({
              runId,
              participantId: participant.id,
              riotMatchId: matchId,
              stage: "MATCH_INGEST",
              status:
                result.outcome === "PROCESSED"
                  ? SyncRunItemStatus.SUCCEEDED
                  : SyncRunItemStatus.SKIPPED,
              errorCode: result.reason ?? undefined,
              durationMs: Math.max(0, elapsedMs() - matchStartedAt),
            });
          } catch (error) {
            const safe = safeError(error);
            stats.errorCount += 1;
            pageFailed = true;
            pageError ??= error;
            await createRunItem({
              runId,
              participantId: participant.id,
              riotMatchId: matchId,
              stage: "MATCH_INGEST",
              status: SyncRunItemStatus.FAILED,
              errorCode: safe.code,
              message: safe.message,
              retryable: safe.retryable,
              durationMs: Math.max(0, elapsedMs() - matchStartedAt),
            });
          }
        }

        if (pageFailed) {
          participantFailed = true;
          if (!input.dryRun) {
            await markCursorFailure({
              participant,
              seasonId: season.id,
              seasonEndAt: season.endAt,
              now: now(),
              error:
                pageError ?? new Error("match page contained a failed item"),
            });
          }
          break;
        }
        if (pageInterrupted) break;

        if (matchIds.length < serverEnv.SYNC_MATCH_PAGE_SIZE) {
          participantComplete = true;
          if (!input.dryRun) {
            await db.syncCursor.update({
              where: { participantId: participant.id },
              data: {
                seasonId: season.id,
                lastRequestedStartAt: windowStart,
                lastSuccessfulMatchStartAt: latestMatchStart,
                newestKnownMatchId,
                paginationStart: 0,
                paginationWindowStartAt: null,
                paginationWindowEndAt: null,
                lastSuccessAt: now(),
                lastErrorAt: null,
                lastErrorCode: null,
                consecutiveFailures: 0,
                nextEligibleAt: new Date(
                  now().getTime() +
                    serverEnv.SYNC_PARTICIPANT_COOLDOWN_SECONDS * 1_000,
                ),
              },
            });
          }
        } else {
          pageStart += serverEnv.SYNC_MATCH_PAGE_SIZE;
          if (!input.dryRun) {
            await db.syncCursor.update({
              where: { participantId: participant.id },
              data: {
                paginationStart: pageStart,
                paginationWindowStartAt: windowStart,
                paginationWindowEndAt: windowEnd,
                newestKnownMatchId,
              },
            });
          }
        }
      }

      if (!input.dryRun && !isOutOfTime()) {
        const week = season.weeks.find(
          (candidate) =>
            startedAt.getTime() >= candidate.startAt.getTime() &&
            startedAt.getTime() < candidate.endAt.getTime(),
        );
        const rankStartedAt = elapsedMs();
        const rank = await captureRankSnapshot({
          participantId: participant.id,
          puuid: participant.puuid,
          seasonId: season.id,
          seasonStatus: season.status,
          weekId: week?.id ?? null,
          now: now(),
          source,
          riotClient,
        });
        if (!rank.ok) stats.errorCount += 1;
        if (!rank.ok) {
          await markCursorFailure({
            participant,
            seasonId: season.id,
            seasonEndAt: season.endAt,
            now: now(),
            error: new RiotApiError(
              rank.errorCode,
              "공식 랭크 스냅샷 조회에 실패했습니다.",
              rank.retryable,
              rank.retryAfterSeconds,
            ),
          });
        }
        await createRunItem({
          runId,
          participantId: participant.id,
          stage: "RANK_SNAPSHOT",
          status: rank.ok
            ? SyncRunItemStatus.SUCCEEDED
            : SyncRunItemStatus.FAILED,
          errorCode: rank.ok ? undefined : rank.errorCode,
          message: rank.ok
            ? undefined
            : "공식 랭크 스냅샷 조회에 실패했습니다.",
          retryable: rank.ok ? false : rank.retryable,
          durationMs: Math.max(0, elapsedMs() - rankStartedAt),
        });
        participantFailed ||= !rank.ok;
      }
      if (participantComplete && !participantFailed) {
        successfulParticipants += 1;
      } else if (!participantComplete) {
        hasMore = true;
      }
    }

    if (!input.dryRun) {
      await refreshDailyStandingSnapshots({ seasonId: season.id, now: now() });
    }
    const status =
      stats.errorCount === 0
        ? SyncRunStatus.SUCCEEDED
        : successfulParticipants > 0 || stats.matchesProcessed > 0
          ? SyncRunStatus.PARTIAL
          : SyncRunStatus.FAILED;
    const finished = await db.syncRun.update({
      where: { id: runId },
      data: {
        status,
        finishedAt: now(),
        ...stats,
        rateLimitSnapshot: httpMetrics,
        metadata: {
          seasonId: season.id,
          participantId: input.participantId ?? null,
          dryRun: input.dryRun,
          force: input.force,
          limit,
          timeBudgetMs,
          hasMore,
          metrics: {
            durationMs: Math.max(0, elapsedMs() - startedTick),
            apiCalls: httpMetrics.apiCalls,
            status2xx: httpMetrics.status2xx,
            status404: httpMetrics.status404,
            status429: httpMetrics.status429,
            status5xx: httpMetrics.status5xx,
            newMatches: stats.matchesProcessed,
            processed: stats.participantCount,
            pending: hasMore ? 1 : 0,
            failed: stats.errorCount,
          },
        },
      },
      select: {
        id: true,
        status: true,
        participantCount: true,
        matchIdsFound: true,
        matchesFetched: true,
        matchesProcessed: true,
        matchesSkipped: true,
        errorCount: true,
        metadata: true,
      },
    });
    logInfo("sync.run.completed", {
      requestId: input.requestId,
      syncRunId: runId,
      operation: "MATCH_SYNC",
      durationMs: Math.max(0, elapsedMs() - startedTick),
      result: status,
      apiCalls: httpMetrics.apiCalls,
      status2xx: httpMetrics.status2xx,
      status404: httpMetrics.status404,
      status429: httpMetrics.status429,
      status5xx: httpMetrics.status5xx,
      newMatches: stats.matchesProcessed,
      processed: stats.participantCount,
      pending: hasMore,
      failed: stats.errorCount,
    });
    return summaryFromRun(finished);
  } catch (error) {
    if (runId) {
      await db.syncRun.update({
        where: { id: runId },
        data: {
          status: SyncRunStatus.FAILED,
          finishedAt: now(),
          ...stats,
          errorCount: stats.errorCount + 1,
          rateLimitSnapshot: httpMetrics,
          metadata: {
            seasonId: season.id,
            dryRun: input.dryRun,
            hasMore: true,
            terminalError: safeError(error).code,
            metrics: {
              durationMs: Math.max(0, elapsedMs() - startedTick),
              apiCalls: httpMetrics.apiCalls,
              status2xx: httpMetrics.status2xx,
              status404: httpMetrics.status404,
              status429: httpMetrics.status429,
              status5xx: httpMetrics.status5xx,
              newMatches: stats.matchesProcessed,
              processed: stats.participantCount,
              pending: 1,
              failed: stats.errorCount + 1,
            },
          },
        },
      });
    }
    const safe = safeError(error);
    logError("sync.run.failed", {
      requestId: input.requestId,
      syncRunId: runId,
      operation: "MATCH_SYNC",
      durationMs: Math.max(0, elapsedMs() - startedTick),
      result: SyncRunStatus.FAILED,
      errorCode: safe.code,
      retryAfterSeconds: safe.retryAfterSeconds,
      apiCalls: httpMetrics.apiCalls,
      failed: stats.errorCount + 1,
    });
    throw error;
  } finally {
    await releaseJobLease(leaseKey, ownerToken);
  }
}

export async function runMatchSync(
  input: RunMatchSyncInput,
  dependencies: SyncDependencies = {},
): Promise<SyncRunSummary> {
  const httpMetrics = createSyncHttpMetrics();
  return withSyncHttpMetrics(httpMetrics, () =>
    runMatchSyncObserved(input, dependencies, httpMetrics),
  );
}
