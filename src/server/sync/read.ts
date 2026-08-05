import "server-only";

import {
  DrawState,
  MatchStatus,
  OutboxStatus,
  SeasonParticipantStatus,
  SeasonStatus,
  SyncRunItemStatus,
  SyncRunStatus,
} from "@/generated/prisma/client";
import { serverEnv } from "@/lib/env/server";
import { db } from "@/server/db/client";

function numericMetric(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) return 0;
  const metric = Reflect.get(value, key);
  return typeof metric === "number" && Number.isFinite(metric) ? metric : 0;
}

function lagSeconds(oldestAt: Date | null, now: Date) {
  return oldestAt
    ? Math.max(0, Math.floor((now.getTime() - oldestAt.getTime()) / 1_000))
    : 0;
}

export async function getAdminSyncOverview(now = new Date()) {
  const seasonSelect = {
    select: {
      id: true,
      name: true,
      status: true,
      autoRevealHours: true,
      participants: {
        where: { status: SeasonParticipantStatus.ACTIVE },
        orderBy: { participant: { gameName: "asc" } },
        select: {
          participant: {
            select: {
              id: true,
              gameName: true,
              tagLine: true,
              syncCursor: {
                select: {
                  lastSuccessAt: true,
                  lastErrorAt: true,
                  lastErrorCode: true,
                  consecutiveFailures: true,
                  nextEligibleAt: true,
                  paginationStart: true,
                },
              },
            },
          },
        },
      },
    },
  } as const;
  const season =
    (await db.season.findFirst({
      where: { status: SeasonStatus.ACTIVE },
      orderBy: { startAt: "asc" },
      ...seasonSelect,
    })) ??
    (await db.season.findFirst({
      where: { status: SeasonStatus.SCHEDULED },
      orderBy: { startAt: "asc" },
      ...seasonSelect,
    }));
  const seasonId = season?.id;
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const staleLeaseBefore = new Date(
    now.getTime() - serverEnv.SYNC_LEASE_RECOVERY_GRACE_SECONDS * 1_000,
  );
  const [
    runs,
    pendingMatches,
    pendingMatchCount,
    pendingOutbox,
    recentFailures,
    recentSeasonMatches,
    failureItems,
    drawBacklog,
    mvpBacklog,
    missionBacklog,
    staleLeases,
  ] = await Promise.all([
    db.syncRun.findMany({
      ...(seasonId
        ? { where: { metadata: { path: ["seasonId"], equals: seasonId } } }
        : {}),
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        id: true,
        trigger: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        participantCount: true,
        matchIdsFound: true,
        matchesFetched: true,
        matchesProcessed: true,
        matchesSkipped: true,
        errorCount: true,
        rateLimitSnapshot: true,
        metadata: true,
      },
    }),
    seasonId
      ? db.seasonMatch.findMany({
          where: { seasonId, status: MatchStatus.PROCESSING },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            createdAt: true,
            match: {
              select: {
                riotMatchId: true,
                gameStartAt: true,
                gameEndAt: true,
              },
            },
            _count: { select: { participantMatches: true } },
          },
        })
      : Promise.resolve([]),
    seasonId
      ? db.seasonMatch.count({
          where: { seasonId, status: MatchStatus.PROCESSING },
        })
      : Promise.resolve(0),
    db.processingOutbox.count({
      where: {
        status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
        ...(seasonId
          ? { payload: { path: ["seasonId"], equals: seasonId } }
          : {}),
      },
    }),
    db.syncRunItem.count({
      where: {
        status: SyncRunItemStatus.FAILED,
        createdAt: { gte: since },
        ...(seasonId
          ? {
              syncRun: {
                metadata: { path: ["seasonId"], equals: seasonId },
              },
            }
          : {}),
      },
    }),
    seasonId
      ? db.seasonMatch.findMany({
          where: {
            seasonId,
            status: { in: [MatchStatus.PROCESSED, MatchStatus.INVALID] },
          },
          orderBy: { match: { gameStartAt: "desc" } },
          take: 30,
          select: {
            id: true,
            status: true,
            eligibilityReason: true,
            match: { select: { riotMatchId: true, gameStartAt: true } },
            _count: { select: { participantMatches: true } },
          },
        })
      : Promise.resolve([]),
    db.syncRunItem.findMany({
      where: {
        status: SyncRunItemStatus.FAILED,
        ...(seasonId
          ? {
              syncRun: {
                metadata: { path: ["seasonId"], equals: seasonId },
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        stage: true,
        errorCode: true,
        messageSanitized: true,
        retryable: true,
        createdAt: true,
        participantId: true,
        syncRunId: true,
      },
    }),
    db.pointDraw.aggregate({
      where: {
        state: DrawState.SEALED,
        ...(seasonId
          ? { participantMatch: { seasonMatch: { seasonId } } }
          : {}),
        ...(season?.autoRevealHours
          ? {
              firstGeneratedAt: {
                lte: new Date(
                  now.getTime() - season.autoRevealHours * 60 * 60 * 1_000,
                ),
              },
            }
          : {}),
      },
      _count: { _all: true },
      _min: { firstGeneratedAt: true },
    }),
    db.processingOutbox.aggregate({
      where: {
        type: "EVALUATE_MVP_ACE",
        status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
        ...(seasonId
          ? { payload: { path: ["seasonId"], equals: seasonId } }
          : {}),
      },
      _count: { _all: true },
      _min: { createdAt: true },
    }),
    db.processingOutbox.aggregate({
      where: {
        type: "EVALUATE_MISSIONS",
        status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
        ...(seasonId
          ? { payload: { path: ["seasonId"], equals: seasonId } }
          : {}),
      },
      _count: { _all: true },
      _min: { createdAt: true },
    }),
    db.jobLease.count({ where: { expiresAt: { lte: staleLeaseBefore } } }),
  ]);

  const lastSuccess =
    runs.find((run) => run.status === SyncRunStatus.SUCCEEDED) ?? null;
  const lastFailure =
    runs.find(
      (run) =>
        run.status === SyncRunStatus.FAILED ||
        run.status === SyncRunStatus.PARTIAL,
    ) ?? null;
  const observedRun = runs[0] ?? null;
  const observedRunMetrics =
    typeof observedRun?.metadata === "object" &&
    observedRun.metadata !== null &&
    "metrics" in observedRun.metadata
      ? Reflect.get(observedRun.metadata, "metrics")
      : null;

  return {
    schedulerMode: serverEnv.SYNC_MODE,
    schedulerNotice:
      serverEnv.SYNC_MODE === "GITHUB_SCHEDULE"
        ? "GitHub 예약 실행은 혼잡 시 지연·누락될 수 있어 수동 복구가 필요합니다."
        : serverEnv.SYNC_MODE === "MANUAL"
          ? "자동 scheduler가 비활성화되어 있습니다."
          : serverEnv.SYNC_MODE === "VERCEL_CRON"
            ? "Vercel 호출 주기와 정확도는 선택한 plan 제한을 따릅니다."
            : "지속 worker 상태와 재시작 정책을 별도로 감시해야 합니다.",
    season: season
      ? { id: season.id, name: season.name, status: season.status }
      : null,
    participants:
      season?.participants.map(({ participant }) => ({
        id: participant.id,
        riotId: `${participant.gameName}#${participant.tagLine}`,
        cursor: participant.syncCursor,
      })) ?? [],
    runs,
    lastSuccess,
    lastFailure,
    failureItems,
    apiMetrics: {
      durationMs: numericMetric(observedRunMetrics, "durationMs"),
      apiCalls: numericMetric(observedRun?.rateLimitSnapshot, "apiCalls"),
      status2xx: numericMetric(observedRun?.rateLimitSnapshot, "status2xx"),
      status404: numericMetric(observedRun?.rateLimitSnapshot, "status404"),
      status429: numericMetric(observedRun?.rateLimitSnapshot, "status429"),
      status5xx: numericMetric(observedRun?.rateLimitSnapshot, "status5xx"),
      retries: numericMetric(observedRun?.rateLimitSnapshot, "retries"),
      maxRetryAfterSeconds: numericMetric(
        observedRun?.rateLimitSnapshot,
        "maxRetryAfterSeconds",
      ),
    },
    processingLag: {
      draw: {
        pending: drawBacklog._count._all,
        oldestAt: drawBacklog._min.firstGeneratedAt,
        seconds: lagSeconds(drawBacklog._min.firstGeneratedAt, now),
      },
      mvp: {
        pending: mvpBacklog._count._all,
        oldestAt: mvpBacklog._min.createdAt,
        seconds: lagSeconds(mvpBacklog._min.createdAt, now),
      },
      missions: {
        pending: missionBacklog._count._all,
        oldestAt: missionBacklog._min.createdAt,
        seconds: lagSeconds(missionBacklog._min.createdAt, now),
      },
    },
    staleLeases,
    pendingMatches,
    pendingMatchCount,
    pendingOutbox,
    recentFailures,
    recentSeasonMatches,
  };
}
