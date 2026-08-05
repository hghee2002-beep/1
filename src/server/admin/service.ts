import "server-only";

import { createHash } from "node:crypto";

import {
  AnnouncementStatus,
  BaselineStatus,
  ExportJobStatus,
  LegalDocumentStatus,
  MatchStatus,
  MissionAssignmentState,
  MissionLedgerType,
  MissionProgressEventType,
  OutboxStatus,
  Prisma,
  SeasonParticipantStatus,
  SeasonStatus,
  SyncRunStatus,
  UserRole,
  UserStatus,
  WeekStatus,
} from "@/generated/prisma/client";
import type {
  ExportJobType,
  LegalDocumentType,
  ParticipantStatus,
  ScoringMode,
} from "@/generated/prisma/client";
import type { AdminOperationInput } from "@/features/admin/validation";
import {
  MVP_METRIC_KEYS,
  MVP_MIN_SAMPLE_SIZE,
  MVP_POSITIONS,
  MVP_TIER_BUCKETS,
  isMvpSnapshotBaselineStatus,
} from "@/domain/mvp/contract";
import {
  buildSeasonReadinessChecklist,
  type SeasonChecklistItem,
  type SeasonReadinessFacts,
} from "@/features/admin/season-readiness";
import { MISSION_EVALUATOR_KEYS_M001_M100 } from "@/domain/missions/evaluator";
import { rankMissionStandings } from "@/domain/missions/ranking";
import { rankMainStandings } from "@/domain/sync/standings";
import { serverEnv } from "@/lib/env/server";
import { AdminOperationError } from "@/server/admin/errors";
import { buildAdminExport } from "@/server/admin/export";
import {
  isCompetitionWriteClosed,
  lockParticipantWeekCompetitionScope,
} from "@/server/competition/write-fence";
import { db } from "@/server/db/client";
import { inspectScoreReconciliationWithClient } from "@/server/scoring/reconciliation";

type Transaction = Prisma.TransactionClient;

function hasBlocker(checklist: readonly SeasonChecklistItem[]) {
  return checklist.some((item) => item.status === "BLOCKER");
}

function requireConfirmation(actual: string, expected: string) {
  if (actual !== expected) {
    throw new AdminOperationError(
      "CONFIRMATION_MISMATCH",
      `확인 문구가 일치하지 않습니다. “${expected}”를 입력해 주세요.`,
    );
  }
}

async function lockKey(transaction: Transaction, key: string) {
  await transaction.$queryRaw`
    SELECT 1::integer AS locked
    FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))
  `;
}

async function idempotentAudit(
  transaction: Transaction,
  action: string,
  requestId: string,
) {
  await lockKey(transaction, `admin-operation:${requestId}`);
  return transaction.auditLog.findFirst({
    where: { action, requestId },
    select: { id: true, targetId: true, after: true },
  });
}

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function baselineHasContractCoverage(baseline: {
  metrics: Array<{
    tierBucket: string;
    position: string;
    metricKey: string;
    stdDev: { toString(): string };
    sampleSize: number;
  }>;
}) {
  const expected = new Set(
    MVP_TIER_BUCKETS.flatMap((tierBucket) =>
      MVP_POSITIONS.flatMap((position) =>
        MVP_METRIC_KEYS.map(
          (metricKey) => `${tierBucket}:${position}:${metricKey}`,
        ),
      ),
    ),
  );
  const actual = new Set<string>();
  for (const metric of baseline.metrics) {
    const key = `${metric.tierBucket}:${metric.position}:${metric.metricKey}`;
    if (
      !expected.has(key) ||
      actual.has(key) ||
      Number(metric.stdDev) <= 0 ||
      metric.sampleSize < MVP_MIN_SAMPLE_SIZE
    ) {
      return false;
    }
    actual.add(key);
  }
  return actual.size === expected.size;
}

function auditData(input: {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string;
  reason: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  requestId: string;
  ipHash?: string;
}) {
  return {
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    reason: input.reason,
    ...(input.before === undefined ? {} : { before: input.before }),
    ...(input.after === undefined ? {} : { after: input.after }),
    requestId: input.requestId,
    ipHash: input.ipHash ?? null,
  } satisfies Prisma.AuditLogUncheckedCreateInput;
}

async function seasonReadinessFacts(
  transaction: Transaction,
  seasonId: string,
): Promise<{
  season: NonNullable<Awaited<ReturnType<typeof loadSeasonForReadiness>>>;
  facts: SeasonReadinessFacts;
}> {
  const season = await loadSeasonForReadiness(transaction, seasonId);
  if (!season) {
    throw new AdminOperationError("NOT_FOUND", "시즌을 찾을 수 없습니다.");
  }
  const activeParticipants = season.participants.filter(
    (participant) => participant.status === SeasonParticipantStatus.ACTIVE,
  );
  const expectedParticipantWeeks =
    activeParticipants.length * season.weeks.length;
  const actualParticipantWeeks = season.weeks.reduce(
    (sum, week) => sum + week._count.participantWeeks,
    0,
  );
  const definitions = await transaction.missionDefinition.findMany({
    where: { active: true },
    orderBy: [{ code: "asc" }, { version: "desc" }],
    select: { code: true, version: true, evaluatorKey: true },
  });
  const latestByCode = new Map<string, (typeof definitions)[number]>();
  for (const definition of definitions) {
    if (!latestByCode.has(definition.code))
      latestByCode.set(definition.code, definition);
  }
  const expectedRegistry = new Map<string, string>(
    Object.entries(MISSION_EVALUATOR_KEYS_M001_M100),
  );
  const invalidMissionRegistryMappings = [...latestByCode.values()].filter(
    (definition) =>
      expectedRegistry.get(definition.code) !== definition.evaluatorKey,
  ).length;
  const publishedLegalTypes = await transaction.legalDocument.findMany({
    where: { status: LegalDocumentStatus.PUBLISHED },
    distinct: ["type"],
    select: { type: true },
  });
  const otherActiveSeasons = await transaction.season.count({
    where: { id: { not: season.id }, status: SeasonStatus.ACTIVE },
  });
  const sortedWeeks = [...season.weeks].sort(
    (left, right) => left.number - right.number,
  );
  const contiguousWeeks = sortedWeeks.every((week, index) => {
    const previous = sortedWeeks[index - 1];
    return (
      week.number === index + 1 &&
      week.startAt >= season.startAt &&
      week.endAt <= season.endAt &&
      week.startAt < week.endAt &&
      (!previous || previous.endAt.getTime() === week.startAt.getTime())
    );
  });
  return {
    season,
    facts: {
      validPeriod: season.startAt < season.endAt,
      weekCount: season.weeks.length,
      contiguousWeeks,
      activeParticipants: activeParticipants.length,
      missingStartingSnapshots: activeParticipants.filter(
        (participant) => !participant.startingRankSnapshotId,
      ).length,
      missingParticipantWeeks: Math.max(
        0,
        expectedParticipantWeeks - actualParticipantWeeks,
      ),
      activeMissionDefinitions: latestByCode.size,
      invalidMissionRegistryMappings,
      missingBaselines: season.weeks.filter((week) => !week.baselineVersion)
        .length,
      invalidBaselines: season.weeks.filter(
        (week) =>
          week.baselineVersion &&
          !isMvpSnapshotBaselineStatus(week.baselineVersion.status),
      ).length,
      incompleteBaselineCoverage: season.weeks.filter(
        (week) =>
          week.baselineVersion &&
          isMvpSnapshotBaselineStatus(week.baselineVersion.status) &&
          !baselineHasContractCoverage(week.baselineVersion),
      ).length,
      demoBaselines: season.weeks.filter(
        (week) => week.baselineVersion?.demoOnly,
      ).length,
      publishedLegalTypes: publishedLegalTypes.length,
      otherActiveSeasons,
    },
  };
}

function loadSeasonForReadiness(transaction: Transaction, seasonId: string) {
  return transaction.season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      startAt: true,
      endAt: true,
      participants: {
        select: {
          participantId: true,
          status: true,
          startingRankSnapshotId: true,
        },
      },
      weeks: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          startAt: true,
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
                  stdDev: true,
                  sampleSize: true,
                },
              },
            },
          },
          _count: { select: { participantWeeks: true } },
        },
      },
    },
  });
}

export async function getSeasonReadinessChecklist(seasonId: string) {
  return db.$transaction(async (transaction) => {
    const { season, facts } = await seasonReadinessFacts(transaction, seasonId);
    return { season, checklist: buildSeasonReadinessChecklist(facts) };
  });
}

async function createSeasonDraft(
  transaction: Transaction,
  input: Extract<AdminOperationInput, { action: "SEASON_CREATE_DRAFT" }>,
  actorUserId: string,
  ipHash?: string,
) {
  const existing = await idempotentAudit(
    transaction,
    "SEASON_DRAFT_CREATED",
    input.idempotencyKey,
  );
  if (existing?.targetId) return { duplicate: true, id: existing.targetId };
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  const duration = endAt.getTime() - startAt.getTime();
  const baseline = await transaction.mvpBaselineVersion.findFirst({
    where: { status: BaselineStatus.PUBLISHED, demoOnly: false },
    orderBy: { publishedAt: "desc" },
    select: { id: true, name: true },
  });
  const season = await transaction.season.create({
    data: {
      name: input.name,
      slug: input.slug,
      status: SeasonStatus.DRAFT,
      timezone: "Asia/Seoul",
      startAt,
      endAt,
      scoringMode: input.scoringMode as ScoringMode,
      minGameDurationSeconds: input.minGameDurationSeconds,
      autoRevealHours: input.autoRevealHours,
      rulesVersion: input.rulesVersion,
      config: {
        pointMode: input.scoringMode,
        missionPool: "M001-M100",
        createdByAdminConsole: true,
      },
      createdById: actorUserId,
      weeks: {
        create: Array.from({ length: input.weekCount }, (_, index) => {
          const weekStart = new Date(
            startAt.getTime() +
              Math.floor((duration * index) / input.weekCount),
          );
          const weekEnd = new Date(
            startAt.getTime() +
              Math.floor((duration * (index + 1)) / input.weekCount),
          );
          return {
            number: index + 1,
            name: `WEEK ${index + 1}`,
            status: WeekStatus.SCHEDULED,
            startAt: weekStart,
            endAt: weekEnd,
            baselineVersionId: baseline?.id ?? null,
            missionCatalogVersion: "v1",
            rulesSnapshot: {
              rulesVersion: input.rulesVersion,
              scoringMode: input.scoringMode,
              minGameDurationSeconds: input.minGameDurationSeconds,
              autoRevealHours: input.autoRevealHours,
              baselineVersion: baseline?.name ?? null,
            },
          };
        }),
      },
    },
    select: { id: true, slug: true, status: true },
  });
  await transaction.auditLog.create({
    data: auditData({
      actorUserId,
      action: "SEASON_DRAFT_CREATED",
      targetType: "Season",
      targetId: season.id,
      reason: input.reason,
      after: {
        slug: season.slug,
        status: season.status,
        weekCount: input.weekCount,
        scoringMode: input.scoringMode,
      },
      requestId: input.idempotencyKey,
      ...(ipHash ? { ipHash } : {}),
    }),
  });
  return { duplicate: false, id: season.id, status: season.status };
}

async function validateOrTransitionSeason(
  transaction: Transaction,
  input: Extract<
    AdminOperationInput,
    { action: "SEASON_VALIDATE" | "SEASON_START" | "SEASON_FINALIZE" }
  >,
  actorUserId: string,
  ipHash?: string,
) {
  const auditAction =
    input.action === "SEASON_VALIDATE"
      ? "SEASON_VALIDATED"
      : input.action === "SEASON_START"
        ? "SEASON_STARTED"
        : "SEASON_FINALIZED";
  const existing = await idempotentAudit(
    transaction,
    auditAction,
    input.idempotencyKey,
  );
  if (existing?.targetId) return { duplicate: true, id: existing.targetId };
  await lockKey(transaction, `season-lifecycle:${input.targetId}`);
  const { season, facts } = await seasonReadinessFacts(
    transaction,
    input.targetId,
  );
  requireConfirmation(input.confirmation, season.slug);
  const checklist = buildSeasonReadinessChecklist(facts);
  if (input.action === "SEASON_VALIDATE" || input.dryRun) {
    await transaction.auditLog.create({
      data: auditData({
        actorUserId,
        action: "SEASON_VALIDATED",
        targetType: "Season",
        targetId: season.id,
        reason: input.reason,
        after: { dryRun: true, checklist },
        requestId: input.idempotencyKey,
        ...(ipHash ? { ipHash } : {}),
      }),
    });
    return { duplicate: false, dryRun: true, id: season.id, checklist };
  }
  if (hasBlocker(checklist)) {
    throw new AdminOperationError(
      "READINESS_BLOCKED",
      "시즌 필수 체크를 모두 통과해야 실행할 수 있습니다.",
    );
  }
  if (input.action === "SEASON_START") {
    if (
      season.status !== SeasonStatus.DRAFT &&
      season.status !== SeasonStatus.SCHEDULED
    ) {
      throw new AdminOperationError(
        "CONFLICT",
        "시작할 수 있는 시즌 상태가 아닙니다.",
      );
    }
    const now = new Date();
    if (now >= season.endAt) {
      throw new AdminOperationError(
        "CONFLICT",
        "이미 종료 시각이 지난 시즌입니다.",
      );
    }
    const participantWeekRows = season.participants
      .filter(
        (participant) => participant.status === SeasonParticipantStatus.ACTIVE,
      )
      .flatMap((participant) =>
        season.weeks.map((week) => ({
          participantId: participant.participantId,
          weekId: week.id,
        })),
      );
    if (participantWeekRows.length) {
      await transaction.participantWeek.createMany({
        data: participantWeekRows,
        skipDuplicates: true,
      });
    }
    const nextStatus =
      now >= season.startAt ? SeasonStatus.ACTIVE : SeasonStatus.SCHEDULED;
    await transaction.season.update({
      where: { id: season.id },
      data: { status: nextStatus },
    });
    for (const week of season.weeks) {
      const status =
        now >= week.startAt && now < week.endAt
          ? WeekStatus.ACTIVE
          : WeekStatus.SCHEDULED;
      await transaction.week.update({
        where: { id: week.id },
        data: { status },
      });
    }
    await transaction.auditLog.create({
      data: auditData({
        actorUserId,
        action: auditAction,
        targetType: "Season",
        targetId: season.id,
        reason: input.reason,
        before: { status: season.status },
        after: { status: nextStatus, checklist },
        requestId: input.idempotencyKey,
        ...(ipHash ? { ipHash } : {}),
      }),
    });
    return { duplicate: false, id: season.id, status: nextStatus, checklist };
  }
  return finalizeSeason(transaction, {
    season,
    checklist,
    actorUserId,
    reason: input.reason,
    requestId: input.idempotencyKey,
    ...(ipHash ? { ipHash } : {}),
  });
}

async function finalizeSeason(
  transaction: Transaction,
  input: {
    season: NonNullable<Awaited<ReturnType<typeof loadSeasonForReadiness>>>;
    checklist: SeasonChecklistItem[];
    actorUserId: string;
    reason: string;
    requestId: string;
    ipHash?: string;
  },
) {
  const [lockedSeason] = await transaction.$queryRaw<
    readonly { status: SeasonStatus; endAt: Date }[]
  >`
    SELECT "status", "endAt"
    FROM "Season"
    WHERE "id" = ${input.season.id}::uuid
    FOR UPDATE
  `;
  if (!lockedSeason) {
    throw new AdminOperationError("NOT_FOUND", "시즌을 찾을 수 없습니다.");
  }
  if (
    lockedSeason.status !== SeasonStatus.ACTIVE &&
    lockedSeason.status !== SeasonStatus.FINALIZING
  ) {
    throw new AdminOperationError(
      "CONFLICT",
      "ACTIVE 또는 FINALIZING 시즌만 확정할 수 있습니다.",
    );
  }
  const now = new Date();
  if (now < lockedSeason.endAt) {
    throw new AdminOperationError(
      "CONFLICT",
      "시즌 종료 시각 전에는 확정할 수 없습니다.",
    );
  }
  const syncRunActiveSince = new Date(
    now.getTime() -
      (serverEnv.SYNC_LEASE_SECONDS +
        serverEnv.SYNC_LEASE_RECOVERY_GRACE_SECONDS) *
        1_000,
  );
  const [
    pendingMatches,
    pendingOutbox,
    sealedDraws,
    activeSyncLeases,
    runningSyncRuns,
    participantWeeks,
    scoreReconciliationRows,
    missionLedgerSums,
  ] = await Promise.all([
    transaction.seasonMatch.count({
      where: {
        seasonId: input.season.id,
        status: {
          in: [MatchStatus.INGESTED, MatchStatus.PROCESSING, MatchStatus.ERROR],
        },
      },
    }),
    transaction.processingOutbox.count({
      where: {
        status: {
          in: [
            OutboxStatus.PENDING,
            OutboxStatus.PROCESSING,
            OutboxStatus.FAILED,
          ],
        },
        payload: { path: ["seasonId"], equals: input.season.id },
      },
    }),
    transaction.pointDraw.count({
      where: {
        state: "SEALED",
        participantMatch: { seasonMatch: { seasonId: input.season.id } },
      },
    }),
    transaction.jobLease.count({
      where: {
        key: `match-sync:${input.season.id}`,
        expiresAt: { gt: now },
      },
    }),
    transaction.syncRun.count({
      where: {
        status: SyncRunStatus.RUNNING,
        startedAt: { gte: syncRunActiveSince },
        metadata: { path: ["seasonId"], equals: input.season.id },
      },
    }),
    transaction.participantWeek.findMany({
      where: { week: { seasonId: input.season.id } },
      orderBy: [{ week: { number: "asc" } }, { participantId: "asc" }],
      select: {
        id: true,
        weekId: true,
        participantId: true,
        mainScoreCached: true,
        missionScoreCached: true,
        wins: true,
        losses: true,
        participant: { select: { gameName: true, tagLine: true } },
        week: { select: { number: true, rulesSnapshot: true } },
      },
    }),
    inspectScoreReconciliationWithClient(transaction, {
      seasonId: input.season.id,
    }),
    transaction.missionCompletionLedger.groupBy({
      by: ["participantWeekId"],
      where: { participantWeek: { week: { seasonId: input.season.id } } },
      _sum: { points: true },
    }),
  ]);
  const reconciliationMismatches = scoreReconciliationRows.filter(
    (row) => !row.consistent,
  ).length;
  const missionLedgerByWeek = new Map(
    missionLedgerSums.map((row) => [
      row.participantWeekId,
      row._sum.points ?? 0,
    ]),
  );
  const missionReconciliationMismatches = participantWeeks.filter(
    (row) => (missionLedgerByWeek.get(row.id) ?? 0) !== row.missionScoreCached,
  ).length;
  if (
    pendingMatches ||
    pendingOutbox ||
    sealedDraws ||
    activeSyncLeases ||
    runningSyncRuns ||
    reconciliationMismatches ||
    missionReconciliationMismatches
  ) {
    throw new AdminOperationError(
      "READINESS_BLOCKED",
      `확정 차단: 처리 경기 ${pendingMatches}, 후속 작업 ${pendingOutbox}, 봉인 추첨 ${sealedDraws}, 활성 동기화 lease ${activeSyncLeases}, 실행 중 동기화 ${runningSyncRuns}, 메인 점수 불일치 ${reconciliationMismatches}, 미션 점수 불일치 ${missionReconciliationMismatches}.`,
    );
  }
  const weekSnapshotIds: Array<{ weekId: string; snapshotId: string }> = [];
  for (const week of input.season.weeks) {
    const existing = await transaction.weekSnapshot.findUnique({
      where: { weekId: week.id },
      select: { id: true },
    });
    if (existing) {
      weekSnapshotIds.push({ weekId: week.id, snapshotId: existing.id });
      continue;
    }
    const rows = participantWeeks.filter((row) => row.weekId === week.id);
    const standings = rankMainStandings(
      rows.map((row) => ({
        participantWeekId: row.id,
        participantId: row.participantId,
        riotId: `${row.participant.gameName}#${row.participant.tagLine}`,
        mainScore: row.mainScoreCached,
        wins: row.wins,
        losses: row.losses,
      })),
    );
    const missionStandings = rankMissionStandings(
      rows.map((row) => ({
        participantWeekId: row.id,
        participantId: row.participantId,
        riotId: `${row.participant.gameName}#${row.participant.tagLine}`,
        score: row.missionScoreCached,
      })),
    );
    const snapshotPayload = {
      weekId: week.id,
      generatedAt: now.toISOString(),
      standings,
      missionStandings,
    };
    const snapshot = await transaction.weekSnapshot.create({
      data: {
        weekId: week.id,
        generatedAt: now,
        rulesSnapshot: rows[0]?.week.rulesSnapshot ?? {},
        standings,
        missionStandings,
        highlights: {},
        checksum: checksum(snapshotPayload),
        generatedById: input.actorUserId,
      },
      select: { id: true },
    });
    weekSnapshotIds.push({ weekId: week.id, snapshotId: snapshot.id });
  }
  const aggregate = new Map<
    string,
    {
      participantId: string;
      riotId: string;
      mainScore: number;
      missionScore: number;
      wins: number;
      losses: number;
    }
  >();
  for (const row of participantWeeks) {
    const current = aggregate.get(row.participantId) ?? {
      participantId: row.participantId,
      riotId: `${row.participant.gameName}#${row.participant.tagLine}`,
      mainScore: 0,
      missionScore: 0,
      wins: 0,
      losses: 0,
    };
    current.mainScore += row.mainScoreCached;
    current.missionScore += row.missionScoreCached;
    current.wins += row.wins;
    current.losses += row.losses;
    aggregate.set(row.participantId, current);
  }
  const finalStandings = rankMainStandings(
    [...aggregate.values()].map((row) => ({
      ...row,
      participantWeekId: row.participantId,
    })),
  );
  const finalPayload = {
    seasonId: input.season.id,
    generatedAt: now.toISOString(),
    weekSnapshotRefs: weekSnapshotIds,
    standings: finalStandings,
  };
  await transaction.finalStandingSnapshot.upsert({
    where: { seasonId: input.season.id },
    create: {
      seasonId: input.season.id,
      generatedAt: now,
      rulesSnapshot: { checklist: input.checklist },
      weekSnapshotRefs: weekSnapshotIds,
      standings: finalStandings,
      highlights: {},
      checksum: checksum(finalPayload),
      generatedById: input.actorUserId,
    },
    update: {},
  });
  await transaction.week.updateMany({
    where: { seasonId: input.season.id },
    data: { status: WeekStatus.COMPLETED, finalizedAt: now },
  });
  await transaction.season.update({
    where: { id: input.season.id },
    data: { status: SeasonStatus.COMPLETED },
  });
  await transaction.auditLog.create({
    data: auditData({
      actorUserId: input.actorUserId,
      action: "SEASON_FINALIZED",
      targetType: "Season",
      targetId: input.season.id,
      reason: input.reason,
      before: { status: lockedSeason.status },
      after: {
        status: SeasonStatus.COMPLETED,
        weekSnapshots: weekSnapshotIds,
        finalChecksum: checksum(finalPayload),
      },
      requestId: input.requestId,
      ...(input.ipHash ? { ipHash: input.ipHash } : {}),
    }),
  });
  return {
    duplicate: false,
    id: input.season.id,
    status: SeasonStatus.COMPLETED,
    weekSnapshots: weekSnapshotIds.length,
  };
}

async function updateUser(
  transaction: Transaction,
  input: Extract<
    AdminOperationInput,
    { action: "USER_ROLE_UPDATE" | "USER_STATUS_UPDATE" }
  >,
  actorUserId: string,
  ipHash?: string,
) {
  const action =
    input.action === "USER_ROLE_UPDATE"
      ? "USER_ROLE_CHANGED"
      : "USER_STATUS_CHANGED";
  const existing = await idempotentAudit(
    transaction,
    action,
    input.idempotencyKey,
  );
  if (existing?.targetId) return { duplicate: true, id: existing.targetId };
  const target = await transaction.user.findUnique({
    where: { id: input.targetId },
    select: {
      id: true,
      loginId: true,
      role: true,
      status: true,
      sessionVersion: true,
    },
  });
  if (!target)
    throw new AdminOperationError("NOT_FOUND", "사용자를 찾을 수 없습니다.");
  requireConfirmation(input.confirmation, target.loginId);
  const nextRole =
    input.action === "USER_ROLE_UPDATE"
      ? (input.role as UserRole)
      : target.role;
  const nextStatus =
    input.action === "USER_STATUS_UPDATE"
      ? (input.status as UserStatus)
      : target.status;
  if (
    target.role === UserRole.ADMIN &&
    target.status === UserStatus.ACTIVE &&
    (nextRole !== UserRole.ADMIN || nextStatus !== UserStatus.ACTIVE)
  ) {
    const activeAdmins = await transaction.user.count({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });
    if (activeAdmins <= 1) {
      throw new AdminOperationError(
        "CONFLICT",
        "마지막 활성 관리자를 변경할 수 없습니다.",
      );
    }
  }
  if (target.id === actorUserId && nextStatus !== UserStatus.ACTIVE) {
    throw new AdminOperationError(
      "CONFLICT",
      "현재 관리자 자신의 계정을 잠글 수 없습니다.",
    );
  }
  const updated = await transaction.user.update({
    where: { id: target.id },
    data: {
      role: nextRole,
      status: nextStatus,
      sessionVersion: { increment: 1 },
    },
    select: { id: true, role: true, status: true, sessionVersion: true },
  });
  await transaction.authSession.updateMany({
    where: { userId: target.id, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: action },
  });
  await transaction.auditLog.create({
    data: auditData({
      actorUserId,
      action,
      targetType: "User",
      targetId: target.id,
      reason: input.reason,
      before: {
        role: target.role,
        status: target.status,
        sessionVersion: target.sessionVersion,
      },
      after: updated,
      requestId: input.idempotencyKey,
      ...(ipHash ? { ipHash } : {}),
    }),
  });
  return { duplicate: false, ...updated };
}

async function updateParticipantStatus(
  transaction: Transaction,
  input: Extract<AdminOperationInput, { action: "PARTICIPANT_STATUS_UPDATE" }>,
  actorUserId: string,
  ipHash?: string,
) {
  const existing = await idempotentAudit(
    transaction,
    "PARTICIPANT_STATUS_CHANGED",
    input.idempotencyKey,
  );
  if (existing?.targetId) return { duplicate: true, id: existing.targetId };
  const participant = await transaction.participant.findUnique({
    where: { id: input.targetId },
    select: { id: true, gameName: true, tagLine: true, status: true },
  });
  if (!participant) {
    throw new AdminOperationError("NOT_FOUND", "참가자를 찾을 수 없습니다.");
  }
  requireConfirmation(
    input.confirmation,
    `${participant.gameName}#${participant.tagLine}`,
  );
  const nextStatus = input.status as ParticipantStatus;
  const updated = await transaction.participant.update({
    where: { id: participant.id },
    data: { status: nextStatus },
    select: { id: true, status: true },
  });
  await transaction.seasonParticipant.updateMany({
    where: {
      participantId: participant.id,
      season: { status: { in: [SeasonStatus.SCHEDULED, SeasonStatus.ACTIVE] } },
    },
    data: {
      status: input.status as SeasonParticipantStatus,
      exceptionReason: input.reason,
      leftAt: input.status === "REMOVED" ? new Date() : null,
    },
  });
  await transaction.auditLog.create({
    data: auditData({
      actorUserId,
      action: "PARTICIPANT_STATUS_CHANGED",
      targetType: "Participant",
      targetId: participant.id,
      reason: input.reason,
      before: { status: participant.status },
      after: { status: updated.status },
      requestId: input.idempotencyKey,
      ...(ipHash ? { ipHash } : {}),
    }),
  });
  return { duplicate: false, ...updated };
}

async function cloneMissionDefinition(
  transaction: Transaction,
  input: Extract<AdminOperationInput, { action: "MISSION_CLONE" }>,
  actorUserId: string,
  ipHash?: string,
) {
  const existing = await idempotentAudit(
    transaction,
    "MISSION_DEFINITION_CLONED",
    input.idempotencyKey,
  );
  if (existing?.targetId) return { duplicate: true, id: existing.targetId };
  const source = await transaction.missionDefinition.findUnique({
    where: { id: input.targetId },
  });
  if (!source)
    throw new AdminOperationError("NOT_FOUND", "미션 정의를 찾을 수 없습니다.");
  const latest = await transaction.missionDefinition.findFirst({
    where: { code: source.code },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const clone = await transaction.missionDefinition.create({
    data: {
      code: source.code,
      version: (latest?.version ?? source.version) + 1,
      title: source.title,
      description: source.description,
      category: source.category,
      kind: source.kind,
      difficulty: source.difficulty,
      points: source.points,
      evaluatorKey: source.evaluatorKey,
      evaluatorConfig: source.evaluatorConfig as Prisma.InputJsonValue,
      sourceType: source.sourceType,
      target: source.target,
      targetText: source.targetText,
      active: false,
      minPatch: source.minPatch,
      maxPatch: source.maxPatch,
    },
    select: { id: true, code: true, version: true },
  });
  await transaction.auditLog.create({
    data: auditData({
      actorUserId,
      action: "MISSION_DEFINITION_CLONED",
      targetType: "MissionDefinition",
      targetId: clone.id,
      reason: input.reason,
      before: { sourceId: source.id, version: source.version },
      after: { code: clone.code, version: clone.version, active: false },
      requestId: input.idempotencyKey,
      ...(ipHash ? { ipHash } : {}),
    }),
  });
  return { duplicate: false, ...clone };
}

async function updateMissionActive(
  transaction: Transaction,
  input: Extract<AdminOperationInput, { action: "MISSION_ACTIVE_UPDATE" }>,
  actorUserId: string,
  ipHash?: string,
) {
  const existing = await idempotentAudit(
    transaction,
    "MISSION_DEFINITION_STATUS_CHANGED",
    input.idempotencyKey,
  );
  if (existing?.targetId) return { duplicate: true, id: existing.targetId };
  const definition = await transaction.missionDefinition.findUnique({
    where: { id: input.targetId },
    select: {
      id: true,
      code: true,
      version: true,
      evaluatorKey: true,
      active: true,
    },
  });
  if (!definition)
    throw new AdminOperationError("NOT_FOUND", "미션 정의를 찾을 수 없습니다.");
  requireConfirmation(
    input.confirmation,
    `${definition.code} v${definition.version}`,
  );
  const expectedKey =
    MISSION_EVALUATOR_KEYS_M001_M100[
      definition.code as keyof typeof MISSION_EVALUATOR_KEYS_M001_M100
    ];
  if (input.active && expectedKey !== definition.evaluatorKey) {
    throw new AdminOperationError(
      "READINESS_BLOCKED",
      "registry evaluator가 일치하지 않습니다.",
    );
  }
  await transaction.missionDefinition.update({
    where: { id: definition.id },
    data: { active: input.active },
  });
  await transaction.auditLog.create({
    data: auditData({
      actorUserId,
      action: "MISSION_DEFINITION_STATUS_CHANGED",
      targetType: "MissionDefinition",
      targetId: definition.id,
      reason: input.reason,
      before: { active: definition.active },
      after: { active: input.active },
      requestId: input.idempotencyKey,
      ...(ipHash ? { ipHash } : {}),
    }),
  });
  return { duplicate: false, id: definition.id, active: input.active };
}

async function correctMissionProgress(
  transaction: Transaction,
  input: Extract<AdminOperationInput, { action: "MISSION_PROGRESS_CORRECT" }>,
  actorUserId: string,
  ipHash?: string,
) {
  const existing = await idempotentAudit(
    transaction,
    "MISSION_PROGRESS_CORRECTED",
    input.idempotencyKey,
  );
  if (existing?.targetId) return { duplicate: true, id: existing.targetId };
  const source = await transaction.missionProgressEvent.findUnique({
    where: { id: input.targetId },
    include: {
      assignment: {
        include: {
          missionDefinition: { select: { points: true, code: true } },
          completionLedger: { select: { id: true, points: true } },
          participantWeek: { select: { id: true, missionScoreCached: true } },
        },
      },
    },
  });
  if (!source)
    throw new AdminOperationError(
      "NOT_FOUND",
      "미션 판정 이벤트를 찾을 수 없습니다.",
    );
  requireConfirmation(
    input.confirmation,
    source.assignment.missionDefinition.code,
  );
  const target = Number(source.assignment.target);
  if (input.correctedProgress > target) {
    throw new AdminOperationError(
      "CONFLICT",
      `진행도는 목표 ${target}을 넘을 수 없습니다.`,
    );
  }
  await lockKey(transaction, `mission-assignment:${source.assignmentId}`);
  const competitionScope = await lockParticipantWeekCompetitionScope(
    transaction,
    source.assignment.participantWeek.id,
  );
  if (!competitionScope || isCompetitionWriteClosed(competitionScope)) {
    throw new AdminOperationError(
      "IMMUTABLE",
      "확정된 주차 또는 시즌의 미션 진행은 교정할 수 없습니다.",
    );
  }
  const before = Number(source.assignment.progress);
  const delta = input.correctedProgress - before;
  const completedBefore =
    source.assignment.state === MissionAssignmentState.COMPLETED;
  const completedAfter = input.correctedProgress >= target;
  let missionScoreDelta = 0;
  if (!completedBefore && completedAfter) {
    missionScoreDelta = source.assignment.missionDefinition.points;
    await transaction.missionCompletionLedger.create({
      data: {
        participantWeekId: source.assignment.participantWeekId,
        assignmentId: source.assignment.completionLedger
          ? null
          : source.assignment.id,
        type: source.assignment.completionLedger
          ? MissionLedgerType.CORRECTION
          : MissionLedgerType.COMPLETION,
        points: missionScoreDelta,
        idempotencyKey: `mission-admin-complete:${input.idempotencyKey}`,
        actorUserId,
        reason: input.reason,
        metadata: {
          sourceEventId: source.id,
          assignmentId: source.assignment.id,
          ...(source.assignment.completionLedger
            ? {
                originalCompletionLedgerId:
                  source.assignment.completionLedger.id,
              }
            : {}),
        },
      },
    });
  } else if (completedBefore && !completedAfter) {
    missionScoreDelta = -source.assignment.missionDefinition.points;
    await transaction.missionCompletionLedger.create({
      data: {
        participantWeekId: source.assignment.participantWeekId,
        assignmentId: null,
        type: MissionLedgerType.CORRECTION,
        points: missionScoreDelta,
        idempotencyKey: `mission-admin-reverse:${input.idempotencyKey}`,
        actorUserId,
        reason: input.reason,
        metadata: {
          assignmentId: source.assignment.id,
          supersedesLedgerId: source.assignment.completionLedger?.id,
        },
      },
    });
  }
  const evaluatorVersion = `admin-${input.idempotencyKey.slice(0, 8)}`;
  const event = await transaction.missionProgressEvent.create({
    data: {
      assignmentId: source.assignmentId,
      participantMatchId: source.participantMatchId,
      type: MissionProgressEventType.CORRECTION,
      beforeValue: new Prisma.Decimal(before),
      deltaValue: new Prisma.Decimal(delta),
      afterValue: new Prisma.Decimal(input.correctedProgress),
      completed: completedAfter,
      evaluatorVersion,
      facts: {
        sourceEventId: source.id,
        sourceEvaluatorVersion: source.evaluatorVersion,
        correctedBy: "ADMIN_CONSOLE",
      },
      supersedesEventId: source.id,
      correctionReason: input.reason,
      correctedByUserId: actorUserId,
      idempotencyKey: `mission-admin:${input.idempotencyKey}`,
    },
    select: { id: true },
  });
  await transaction.weeklyMissionAssignment.update({
    where: { id: source.assignmentId },
    data: {
      progress: new Prisma.Decimal(input.correctedProgress),
      state: completedAfter
        ? MissionAssignmentState.COMPLETED
        : MissionAssignmentState.ACTIVE,
      completedAt: completedAfter ? new Date() : null,
    },
  });
  if (missionScoreDelta !== 0) {
    await transaction.participantWeek.update({
      where: { id: source.assignment.participantWeek.id },
      data: { missionScoreCached: { increment: missionScoreDelta } },
    });
  }
  await transaction.auditLog.create({
    data: auditData({
      actorUserId,
      action: "MISSION_PROGRESS_CORRECTED",
      targetType: "WeeklyMissionAssignment",
      targetId: source.assignmentId,
      reason: input.reason,
      before: { progress: before, completed: completedBefore },
      after: {
        progress: input.correctedProgress,
        completed: completedAfter,
        missionScoreDelta,
        correctionEventId: event.id,
      },
      requestId: input.idempotencyKey,
      ...(ipHash ? { ipHash } : {}),
    }),
  });
  return { duplicate: false, id: event.id, progress: input.correctedProgress };
}

async function archiveBaseline(
  transaction: Transaction,
  input: Extract<AdminOperationInput, { action: "BASELINE_ARCHIVE" }>,
  actorUserId: string,
  ipHash?: string,
) {
  const existing = await idempotentAudit(
    transaction,
    "MVP_BASELINE_ARCHIVED",
    input.idempotencyKey,
  );
  if (existing?.targetId) return { duplicate: true, id: existing.targetId };
  const baseline = await transaction.mvpBaselineVersion.findUnique({
    where: { id: input.targetId },
    select: {
      id: true,
      name: true,
      status: true,
      _count: {
        select: {
          weeks: {
            where: {
              status: { in: [WeekStatus.SCHEDULED, WeekStatus.ACTIVE] },
            },
          },
        },
      },
    },
  });
  if (!baseline)
    throw new AdminOperationError("NOT_FOUND", "baseline을 찾을 수 없습니다.");
  requireConfirmation(input.confirmation, baseline.name);
  if (baseline._count.weeks > 0) {
    throw new AdminOperationError(
      "READINESS_BLOCKED",
      "예정·진행 주차가 사용하는 baseline은 보관할 수 없습니다.",
    );
  }
  await transaction.mvpBaselineVersion.update({
    where: { id: baseline.id },
    data: { status: BaselineStatus.RETIRED, retiredAt: new Date() },
  });
  await transaction.auditLog.create({
    data: auditData({
      actorUserId,
      action: "MVP_BASELINE_ARCHIVED",
      targetType: "MvpBaselineVersion",
      targetId: baseline.id,
      reason: input.reason,
      before: { status: baseline.status },
      after: { status: BaselineStatus.RETIRED },
      requestId: input.idempotencyKey,
      ...(ipHash ? { ipHash } : {}),
    }),
  });
  return { duplicate: false, id: baseline.id, status: BaselineStatus.RETIRED };
}

async function createAnnouncement(
  transaction: Transaction,
  input: Extract<AdminOperationInput, { action: "ANNOUNCEMENT_CREATE" }>,
  actorUserId: string,
  ipHash?: string,
) {
  const existing = await idempotentAudit(
    transaction,
    "ANNOUNCEMENT_CREATED",
    input.idempotencyKey,
  );
  if (existing?.targetId) return { duplicate: true, id: existing.targetId };
  const now = new Date();
  const announcement = await transaction.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      pinned: input.pinned,
      status: input.publish
        ? AnnouncementStatus.PUBLISHED
        : AnnouncementStatus.DRAFT,
      publishedAt: input.publish ? now : null,
      createdById: actorUserId,
      updatedById: actorUserId,
    },
    select: { id: true, status: true, title: true },
  });
  await transaction.auditLog.create({
    data: auditData({
      actorUserId,
      action: "ANNOUNCEMENT_CREATED",
      targetType: "Announcement",
      targetId: announcement.id,
      reason: input.reason,
      after: {
        title: announcement.title,
        status: announcement.status,
        pinned: input.pinned,
      },
      requestId: input.idempotencyKey,
      ...(ipHash ? { ipHash } : {}),
    }),
  });
  return { duplicate: false, ...announcement };
}

async function publishLegal(
  transaction: Transaction,
  input: Extract<AdminOperationInput, { action: "LEGAL_PUBLISH" }>,
  actorUserId: string,
  ipHash?: string,
) {
  const existing = await idempotentAudit(
    transaction,
    "LEGAL_DOCUMENT_PUBLISHED",
    input.idempotencyKey,
  );
  if (existing?.targetId) return { duplicate: true, id: existing.targetId };
  requireConfirmation(input.confirmation, input.type);
  const type = input.type as LegalDocumentType;
  const latest = await transaction.legalDocument.findFirst({
    where: { type },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  await transaction.legalDocument.updateMany({
    where: { type, status: LegalDocumentStatus.PUBLISHED },
    data: { status: LegalDocumentStatus.RETIRED },
  });
  const document = await transaction.legalDocument.create({
    data: {
      type,
      version: (latest?.version ?? 0) + 1,
      title: input.title,
      body: input.body,
      effectiveAt: new Date(input.effectiveAt),
      publishedAt: new Date(),
      status: LegalDocumentStatus.PUBLISHED,
      createdById: actorUserId,
      checksum: createHash("sha256").update(input.body).digest("hex"),
    },
    select: { id: true, type: true, version: true, status: true },
  });
  await transaction.auditLog.create({
    data: auditData({
      actorUserId,
      action: "LEGAL_DOCUMENT_PUBLISHED",
      targetType: "LegalDocument",
      targetId: document.id,
      reason: input.reason,
      after: {
        type: document.type,
        version: document.version,
        status: document.status,
      },
      requestId: input.idempotencyKey,
      ...(ipHash ? { ipHash } : {}),
    }),
  });
  return { duplicate: false, ...document };
}

async function updateFeatureFlag(
  transaction: Transaction,
  input: Extract<AdminOperationInput, { action: "FEATURE_FLAG_UPDATE" }>,
  actorUserId: string,
  ipHash?: string,
) {
  const existing = await idempotentAudit(
    transaction,
    "FEATURE_FLAG_CHANGED",
    input.idempotencyKey,
  );
  if (existing?.targetId) return { duplicate: true, id: existing.targetId };
  requireConfirmation(input.confirmation, input.key);
  if (
    serverEnv.NODE_ENV === "production" &&
    input.enabled &&
    /debug|danger|raw|bypass/iu.test(input.key)
  ) {
    throw new AdminOperationError(
      "PRODUCTION_BLOCKED",
      "production에서는 위험한 debug flag를 활성화할 수 없습니다.",
    );
  }
  const before = await transaction.featureFlag.findUnique({
    where: { key: input.key },
    select: { enabled: true },
  });
  const flag = await transaction.featureFlag.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      enabled: input.enabled,
      config: {},
      description: "관리자 콘솔에서 생성",
      updatedById: actorUserId,
    },
    update: { enabled: input.enabled, updatedById: actorUserId },
    select: { key: true, enabled: true },
  });
  await transaction.auditLog.create({
    data: auditData({
      actorUserId,
      action: "FEATURE_FLAG_CHANGED",
      targetType: "FeatureFlag",
      targetId: flag.key,
      reason: input.reason,
      before: { enabled: before?.enabled ?? null },
      after: { enabled: flag.enabled },
      requestId: input.idempotencyKey,
      ...(ipHash ? { ipHash } : {}),
    }),
  });
  return { duplicate: false, id: flag.key, enabled: flag.enabled };
}

async function retryOutbox(
  transaction: Transaction,
  input: Extract<AdminOperationInput, { action: "OUTBOX_RETRY" }>,
  actorUserId: string,
  ipHash?: string,
) {
  const existing = await idempotentAudit(
    transaction,
    "OUTBOX_RETRY_REQUESTED",
    input.idempotencyKey,
  );
  if (existing?.targetId) return { duplicate: true, id: existing.targetId };
  const job = await transaction.processingOutbox.findUnique({
    where: { id: input.targetId },
    select: { id: true, type: true, status: true, attempts: true },
  });
  if (!job)
    throw new AdminOperationError("NOT_FOUND", "실패 작업을 찾을 수 없습니다.");
  if (job.status !== OutboxStatus.FAILED) {
    throw new AdminOperationError(
      "CONFLICT",
      "FAILED 작업만 재시도할 수 있습니다.",
    );
  }
  await transaction.processingOutbox.update({
    where: { id: job.id },
    data: {
      status: OutboxStatus.PENDING,
      availableAt: new Date(),
      lockedAt: null,
      lastError: null,
    },
  });
  await transaction.auditLog.create({
    data: auditData({
      actorUserId,
      action: "OUTBOX_RETRY_REQUESTED",
      targetType: "ProcessingOutbox",
      targetId: job.id,
      reason: input.reason,
      before: { status: job.status, attempts: job.attempts },
      after: { status: OutboxStatus.PENDING },
      requestId: input.idempotencyKey,
      ...(ipHash ? { ipHash } : {}),
    }),
  });
  return { duplicate: false, id: job.id, status: OutboxStatus.PENDING };
}

async function createExportJob(input: {
  operation: Extract<AdminOperationInput, { action: "EXPORT_CREATE" }>;
  actorUserId: string;
  ipHash?: string;
}) {
  const created = await db.$transaction(
    async (transaction) => {
      const existing = await idempotentAudit(
        transaction,
        "EXPORT_REQUESTED",
        input.operation.idempotencyKey,
      );
      if (existing?.targetId) {
        return { duplicate: true as const, id: existing.targetId };
      }
      if (input.operation.weekId) {
        const week = await transaction.week.findUnique({
          where: { id: input.operation.weekId },
          select: { id: true },
        });
        if (!week)
          throw new AdminOperationError(
            "NOT_FOUND",
            "주차를 찾을 수 없습니다.",
          );
      }
      const job = await transaction.exportJob.create({
        data: {
          type: input.operation.type as ExportJobType,
          status: ExportJobStatus.RUNNING,
          weekId: input.operation.weekId ?? null,
          requestedById: input.actorUserId,
          objectPath: `generated:${input.operation.format}`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
        },
        select: { id: true },
      });
      await transaction.auditLog.create({
        data: auditData({
          actorUserId: input.actorUserId,
          action: "EXPORT_REQUESTED",
          targetType: "ExportJob",
          targetId: job.id,
          reason: input.operation.reason,
          after: {
            type: input.operation.type,
            format: input.operation.format,
            weekId: input.operation.weekId ?? null,
          },
          requestId: input.operation.idempotencyKey,
          ...(input.ipHash ? { ipHash: input.ipHash } : {}),
        }),
      });
      return { duplicate: false as const, id: job.id };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  if (created.duplicate) {
    return { duplicate: true, id: created.id };
  }
  try {
    const artifact = await buildAdminExport({
      type: input.operation.type as ExportJobType,
      format: input.operation.format,
      ...(input.operation.weekId ? { weekId: input.operation.weekId } : {}),
    });
    const job = await db.exportJob.update({
      where: { id: created.id },
      data: {
        status: ExportJobStatus.COMPLETED,
        checksum: artifact.checksum,
        finishedAt: new Date(),
      },
      select: {
        id: true,
        type: true,
        status: true,
        checksum: true,
        expiresAt: true,
      },
    });
    return { duplicate: false, ...job };
  } catch (error) {
    await db.exportJob.update({
      where: { id: created.id },
      data: {
        status: ExportJobStatus.FAILED,
        errorCode: "EXPORT_BUILD_FAILED",
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function executeAdminOperation(input: {
  operation: AdminOperationInput;
  actorUserId: string;
  ipHash?: string;
}) {
  if (input.operation.action === "EXPORT_CREATE") {
    return createExportJob({
      operation: input.operation,
      actorUserId: input.actorUserId,
      ...(input.ipHash ? { ipHash: input.ipHash } : {}),
    });
  }
  return db.$transaction(
    async (transaction) => {
      switch (input.operation.action) {
        case "USER_ROLE_UPDATE":
        case "USER_STATUS_UPDATE":
          return updateUser(
            transaction,
            input.operation,
            input.actorUserId,
            input.ipHash,
          );
        case "PARTICIPANT_STATUS_UPDATE":
          return updateParticipantStatus(
            transaction,
            input.operation,
            input.actorUserId,
            input.ipHash,
          );
        case "SEASON_CREATE_DRAFT":
          return createSeasonDraft(
            transaction,
            input.operation,
            input.actorUserId,
            input.ipHash,
          );
        case "SEASON_VALIDATE":
        case "SEASON_START":
        case "SEASON_FINALIZE":
          return validateOrTransitionSeason(
            transaction,
            input.operation,
            input.actorUserId,
            input.ipHash,
          );
        case "MISSION_CLONE":
          return cloneMissionDefinition(
            transaction,
            input.operation,
            input.actorUserId,
            input.ipHash,
          );
        case "MISSION_ACTIVE_UPDATE":
          return updateMissionActive(
            transaction,
            input.operation,
            input.actorUserId,
            input.ipHash,
          );
        case "MISSION_PROGRESS_CORRECT":
          return correctMissionProgress(
            transaction,
            input.operation,
            input.actorUserId,
            input.ipHash,
          );
        case "BASELINE_ARCHIVE":
          return archiveBaseline(
            transaction,
            input.operation,
            input.actorUserId,
            input.ipHash,
          );
        case "ANNOUNCEMENT_CREATE":
          return createAnnouncement(
            transaction,
            input.operation,
            input.actorUserId,
            input.ipHash,
          );
        case "LEGAL_PUBLISH":
          return publishLegal(
            transaction,
            input.operation,
            input.actorUserId,
            input.ipHash,
          );
        case "FEATURE_FLAG_UPDATE":
          return updateFeatureFlag(
            transaction,
            input.operation,
            input.actorUserId,
            input.ipHash,
          );
        case "OUTBOX_RETRY":
          return retryOutbox(
            transaction,
            input.operation,
            input.actorUserId,
            input.ipHash,
          );
        default:
          throw new AdminOperationError(
            "CONFLICT",
            "지원하지 않는 관리자 작업입니다.",
          );
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
