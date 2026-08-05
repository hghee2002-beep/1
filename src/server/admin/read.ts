import "server-only";

import {
  AnnouncementStatus,
  ApplicationStatus,
  BaselineStatus,
  DrawState,
  ExportJobStatus,
  LegalDocumentStatus,
  MatchStatus,
  MvpEvaluationStatus,
  OutboxStatus,
  ParticipantStatus,
  SeasonStatus,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client";
import type { AdminListQuery } from "@/features/admin/validation";
import { MISSION_EVALUATOR_KEYS_M001_M100 } from "@/domain/missions/evaluator";
import { serverEnv } from "@/lib/env/server";
import { db } from "@/server/db/client";

export type AdminTableRow = {
  id: string;
  cells: string[];
  status: string;
  confirmation: string;
};

export type AdminTableData = {
  columns: string[];
  rows: AdminTableRow[];
  total: number;
  page: number;
  pageSize: number;
  statusOptions: string[];
  note?: string;
};

function pageResult(
  query: AdminListQuery,
  columns: string[],
  rows: AdminTableRow[],
  total: number,
  statusOptions: string[],
  note?: string,
): AdminTableData {
  return {
    columns,
    rows,
    total,
    page: query.page,
    pageSize: query.pageSize,
    statusOptions,
    ...(note ? { note } : {}),
  };
}

function includesEnum<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return values.some((candidate) => candidate === value);
}

const kstDateTime = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

function period(startAt: Date, endAt: Date) {
  return `${kstDateTime.format(startAt)} – ${kstDateTime.format(endAt)}`;
}

export async function getAdminDashboardReadModel(now = new Date()) {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
  const [
    season,
    approvedParticipants,
    activeParticipants,
    matchesLastDay,
    pendingMatches,
    sealedDraws,
    failedOutbox,
    failedSyncItems,
    latestSync,
    baseline,
    recentAudit,
  ] = await Promise.all([
    db.season.findFirst({
      where: { status: { in: [SeasonStatus.ACTIVE, SeasonStatus.SCHEDULED] } },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        startAt: true,
        endAt: true,
        _count: { select: { participants: true, weeks: true } },
        weeks: {
          orderBy: { number: "asc" },
          select: { number: true, name: true, status: true },
        },
      },
    }),
    db.participant.count(),
    db.participant.count({ where: { status: ParticipantStatus.ACTIVE } }),
    db.match.count({ where: { gameEndAt: { gte: dayAgo } } }),
    db.seasonMatch.count({
      where: { status: { in: [MatchStatus.INGESTED, MatchStatus.PROCESSING] } },
    }),
    db.pointDraw.count({ where: { state: DrawState.SEALED } }),
    db.processingOutbox.count({ where: { status: OutboxStatus.FAILED } }),
    db.syncRunItem.count({
      where: { status: "FAILED", createdAt: { gte: dayAgo } },
    }),
    db.syncRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        matchesProcessed: true,
        errorCount: true,
      },
    }),
    db.mvpBaselineVersion.findFirst({
      where: { status: BaselineStatus.PUBLISHED },
      orderBy: { publishedAt: "desc" },
      select: { id: true, name: true, demoOnly: true, publishedAt: true },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        reason: true,
        createdAt: true,
        actor: { select: { realName: true, loginId: true } },
      },
    }),
  ]);

  return {
    observedAt: now,
    season,
    counts: {
      approvedParticipants,
      activeParticipants,
      matchesLastDay,
      pendingMatches,
      sealedDraws,
      failedOutbox,
      failedSyncItems,
    },
    latestSync,
    baseline,
    recentAudit,
    schedulerMode: serverEnv.SYNC_MODE,
    mockRiot: serverEnv.MOCK_RIOT_API,
  };
}

async function usersTable(query: AdminListQuery) {
  const roles = Object.values(UserRole);
  const statuses = Object.values(UserStatus);
  const role = includesEnum(roles, query.status) ? query.status : undefined;
  const status = includesEnum(statuses, query.status)
    ? query.status
    : undefined;
  const where = {
    ...(query.q
      ? {
          OR: [
            { loginId: { contains: query.q, mode: "insensitive" as const } },
            { realName: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        loginId: true,
        realName: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { authSessions: true, applications: true } },
      },
    }),
    db.user.count({ where }),
  ]);
  return pageResult(
    query,
    ["로그인 ID", "실명", "권한 · 상태", "가입", "세션 · 신청"],
    rows.map((row) => ({
      id: row.id,
      cells: [
        row.loginId,
        row.realName,
        `${row.role} · ${row.status}`,
        kstDateTime.format(row.createdAt),
        `${row._count.authSessions} · ${row._count.applications}`,
      ],
      status: row.status,
      confirmation: row.loginId,
    })),
    total,
    [...roles, ...statuses],
    "passwordHash와 session token은 조회하지 않습니다.",
  );
}

async function participantsTable(query: AdminListQuery) {
  const statuses = Object.values(ParticipantStatus);
  const status = includesEnum(statuses, query.status)
    ? query.status
    : undefined;
  const where = {
    ...(query.q
      ? {
          OR: [
            { gameName: { contains: query.q, mode: "insensitive" as const } },
            { tagLine: { contains: query.q, mode: "insensitive" as const } },
            {
              user: {
                loginId: { contains: query.q, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
  };
  const [rows, total] = await Promise.all([
    db.participant.findMany({
      where,
      orderBy: [{ status: "asc" }, { gameName: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        gameName: true,
        tagLine: true,
        status: true,
        primaryPosition: true,
        secondaryPosition: true,
        lastIdentitySyncAt: true,
        user: { select: { loginId: true, realName: true } },
        syncCursor: {
          select: {
            lastSuccessAt: true,
            lastErrorCode: true,
            consecutiveFailures: true,
          },
        },
        identityHistory: {
          orderBy: { validFrom: "desc" },
          take: 2,
          select: { gameName: true, tagLine: true, validFrom: true },
        },
        _count: { select: { seasonEntries: true, participantMatches: true } },
      },
    }),
    db.participant.count({ where }),
  ]);
  return pageResult(
    query,
    ["Riot ID", "회원", "상태 · 포지션", "동기화", "시즌 · 경기"],
    rows.map((row) => ({
      id: row.id,
      cells: [
        `${row.gameName}#${row.tagLine}`,
        `${row.user.realName} · @${row.user.loginId}`,
        `${row.status} · ${row.primaryPosition ?? "-"}/${row.secondaryPosition ?? "-"}`,
        row.syncCursor?.lastErrorCode
          ? `${row.syncCursor.lastErrorCode} (${row.syncCursor.consecutiveFailures})`
          : row.syncCursor?.lastSuccessAt
            ? kstDateTime.format(row.syncCursor.lastSuccessAt)
            : "실행 전",
        `${row._count.seasonEntries} · ${row._count.participantMatches}`,
      ],
      status: row.status,
      confirmation: `${row.gameName}#${row.tagLine}`,
    })),
    total,
    [...statuses],
    "PUUID는 서버 중복 비교에만 사용하며 표에 표시하지 않습니다.",
  );
}

async function seasonsTable(query: AdminListQuery) {
  const statuses = Object.values(SeasonStatus);
  const status = includesEnum(statuses, query.status)
    ? query.status
    : undefined;
  const where = {
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { slug: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
  };
  const [rows, total] = await Promise.all([
    db.season.findMany({
      where,
      orderBy: { startAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        startAt: true,
        endAt: true,
        scoringMode: true,
        minGameDurationSeconds: true,
        autoRevealHours: true,
        finalStandingSnapshot: { select: { id: true, generatedAt: true } },
        weeks: {
          orderBy: { number: "asc" },
          select: {
            id: true,
            number: true,
            status: true,
            baselineVersionId: true,
          },
        },
        _count: { select: { participants: true, seasonMatches: true } },
      },
    }),
    db.season.count({ where }),
  ]);
  return pageResult(
    query,
    ["시즌", "상태 · 주차", "기간 (KST)", "규칙", "참가 · 경기"],
    rows.map((row) => ({
      id: row.id,
      cells: [
        `${row.name} · ${row.slug}`,
        `${row.status} · ${row.weeks.map((week) => `W${week.number}:${week.status}`).join(" ") || "주차 없음"}`,
        period(row.startAt, row.endAt),
        `${row.scoringMode} · ${row.minGameDurationSeconds}s · ${row.autoRevealHours}h`,
        `${row._count.participants}명 · ${row._count.seasonMatches}경기${row.finalStandingSnapshot ? " · SNAPSHOT" : ""}`,
      ],
      status: row.status,
      confirmation: row.slug,
    })),
    total,
    [...statuses],
  );
}

async function scoringTable(query: AdminListQuery) {
  const where = query.q
    ? {
        OR: [
          {
            participant: {
              gameName: { contains: query.q, mode: "insensitive" as const },
            },
          },
          {
            participant: {
              tagLine: { contains: query.q, mode: "insensitive" as const },
            },
          },
          {
            week: { name: { contains: query.q, mode: "insensitive" as const } },
          },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    db.participantWeek.findMany({
      where,
      orderBy: [{ week: { startAt: "desc" } }, { mainScoreCached: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        mainScoreCached: true,
        wins: true,
        losses: true,
        participant: { select: { gameName: true, tagLine: true } },
        week: { select: { name: true, status: true } },
        reconciliations: {
          orderBy: { checkedAt: "desc" },
          take: 1,
          select: { difference: true, checkedAt: true },
        },
        _count: { select: { scoreLedger: true, participantMatches: true } },
      },
    }),
    db.participantWeek.count({ where }),
  ]);
  return pageResult(
    query,
    ["참가자", "주차", "점수 · 전적", "원장 · 경기", "최근 대사"],
    rows.map((row) => ({
      id: row.id,
      cells: [
        `${row.participant.gameName}#${row.participant.tagLine}`,
        `${row.week.name} · ${row.week.status}`,
        `${row.mainScoreCached >= 0 ? "+" : ""}${row.mainScoreCached} · ${row.wins}승 ${row.losses}패`,
        `${row._count.scoreLedger}행 · ${row._count.participantMatches}경기`,
        row.reconciliations[0]
          ? `차이 ${row.reconciliations[0].difference} · ${kstDateTime.format(row.reconciliations[0].checkedAt)}`
          : "미실행",
      ],
      status: row.reconciliations[0]?.difference ? "MISMATCH" : "OK",
      confirmation: `${row.participant.gameName}#${row.participant.tagLine}`,
    })),
    total,
    ["OK", "MISMATCH"],
    "직접 점수 덮어쓰기는 제공하지 않으며 조정 원장만 추가합니다.",
  );
}

async function drawsTable(query: AdminListQuery) {
  const statuses = Object.values(DrawState);
  const status = includesEnum(statuses, query.status)
    ? query.status
    : undefined;
  const where = {
    ...(status ? { state: status } : {}),
    ...(query.q
      ? {
          participantMatch: {
            OR: [
              {
                participant: {
                  gameName: { contains: query.q, mode: "insensitive" as const },
                },
              },
              {
                seasonMatch: {
                  match: {
                    riotMatchId: {
                      contains: query.q,
                      mode: "insensitive" as const,
                    },
                  },
                },
              },
            ],
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.pointDraw.findMany({
      where,
      orderBy: { firstGeneratedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        state: true,
        firstCommitment: true,
        firstCommitmentVersion: true,
        revealedAt: true,
        rerollEligible: true,
        rerollReason: true,
        rerollDemoOnly: true,
        rerollUsedAt: true,
        participantMatch: {
          select: {
            win: true,
            participant: { select: { gameName: true, tagLine: true } },
            seasonMatch: {
              select: { match: { select: { riotMatchId: true } } },
            },
            _count: { select: { scoreLedger: true } },
          },
        },
      },
    }),
    db.pointDraw.count({ where }),
  ]);
  return pageResult(
    query,
    ["경기 · 참가자", "상태", "Commitment", "재추첨", "원장"],
    rows.map((row) => ({
      id: row.id,
      cells: [
        `${row.participantMatch.seasonMatch.match.riotMatchId} · ${row.participantMatch.participant.gameName}#${row.participantMatch.participant.tagLine}`,
        `${row.state} · ${row.participantMatch.win ? "승" : "패"}`,
        `${row.firstCommitmentVersion} · ${row.firstCommitment.slice(0, 12)}…`,
        row.rerollUsedAt
          ? "사용 완료"
          : row.rerollEligible
            ? `가능${row.rerollDemoOnly ? " · DEMO_ONLY" : ""}`
            : (row.rerollReason ?? "없음"),
        `${row.participantMatch._count.scoreLedger}행`,
      ],
      status: row.state,
      confirmation: row.participantMatch.seasonMatch.match.riotMatchId,
    })),
    total,
    [...statuses],
    "미공개 value와 nonce는 select하지 않습니다.",
  );
}

async function missionsTable(query: AdminListQuery) {
  const where = {
    ...(query.q
      ? {
          OR: [
            { code: { contains: query.q, mode: "insensitive" as const } },
            { title: { contains: query.q, mode: "insensitive" as const } },
            {
              evaluatorKey: { contains: query.q, mode: "insensitive" as const },
            },
          ],
        }
      : {}),
    ...(query.status === "ACTIVE"
      ? { active: true }
      : query.status === "INACTIVE"
        ? { active: false }
        : {}),
  };
  const [rows, total] = await Promise.all([
    db.missionDefinition.findMany({
      where,
      orderBy: [{ code: "asc" }, { version: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        version: true,
        title: true,
        active: true,
        points: true,
        difficulty: true,
        kind: true,
        evaluatorKey: true,
        sourceType: true,
        _count: { select: { assignments: true } },
      },
    }),
    db.missionDefinition.count({ where }),
  ]);
  const registryKeys = new Set<string>(
    Object.values(MISSION_EVALUATOR_KEYS_M001_M100),
  );
  return pageResult(
    query,
    ["정의", "상태", "유형 · 점수", "Evaluator", "배정"],
    rows.map((row) => ({
      id: row.id,
      cells: [
        `${row.code} v${row.version} · ${row.title}`,
        row.active ? "ACTIVE" : "INACTIVE",
        `${row.kind} · ${row.difficulty} · ${row.points}점`,
        `${row.sourceType} · ${registryKeys.has(row.evaluatorKey) ? "REGISTRY OK" : "MISSING"}`,
        `${row._count.assignments}건`,
      ],
      status: row.active ? "ACTIVE" : "INACTIVE",
      confirmation: `${row.code} v${row.version}`,
    })),
    total,
    ["ACTIVE", "INACTIVE"],
    `코드 registry ${registryKeys.size}/100 구현. 배정 이력이 있는 version은 수정하지 않고 복제합니다.`,
  );
}

async function contentTable(query: AdminListQuery) {
  const [announcements, documents] = await Promise.all([
    db.announcement.findMany({
      where: {
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: "insensitive" as const } },
                { body: { contains: query.q, mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(query.status &&
        Object.values(AnnouncementStatus).includes(
          query.status as AnnouncementStatus,
        )
          ? { status: query.status as AnnouncementStatus }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        status: true,
        pinned: true,
        publishedAt: true,
        updatedAt: true,
      },
    }),
    db.legalDocument.findMany({
      where: {
        ...(query.q
          ? {
              OR: [
                { title: { contains: query.q, mode: "insensitive" as const } },
                { body: { contains: query.q, mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(query.status &&
        Object.values(LegalDocumentStatus).includes(
          query.status as LegalDocumentStatus,
        )
          ? { status: query.status as LegalDocumentStatus }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        version: true,
        title: true,
        status: true,
        effectiveAt: true,
        publishedAt: true,
        _count: { select: { consents: true } },
      },
    }),
  ]);
  const merged: AdminTableRow[] = [
    ...announcements.map((row) => ({
      id: row.id,
      cells: [
        `공지 · ${row.title}`,
        row.status,
        row.pinned ? "고정" : "일반",
        row.publishedAt ? kstDateTime.format(row.publishedAt) : "미게시",
        kstDateTime.format(row.updatedAt),
      ],
      status: row.status,
      confirmation: row.title,
    })),
    ...documents.map((row) => ({
      id: row.id,
      cells: [
        `${row.type} v${row.version} · ${row.title}`,
        row.status,
        `동의 ${row._count.consents}건`,
        kstDateTime.format(row.effectiveAt),
        row.publishedAt ? kstDateTime.format(row.publishedAt) : "미게시",
      ],
      status: row.status,
      confirmation: `${row.type} v${row.version}`,
    })),
  ];
  const start = (query.page - 1) * query.pageSize;
  return pageResult(
    query,
    ["콘텐츠", "상태", "구분", "시행 · 게시", "갱신"],
    merged.slice(start, start + query.pageSize),
    merged.length,
    [
      ...Object.values(AnnouncementStatus),
      ...Object.values(LegalDocumentStatus),
    ],
  );
}

async function auditTable(query: AdminListQuery) {
  const where = {
    ...(query.q
      ? {
          OR: [
            { action: { contains: query.q, mode: "insensitive" as const } },
            { targetType: { contains: query.q, mode: "insensitive" as const } },
            { targetId: { contains: query.q, mode: "insensitive" as const } },
            { reason: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(query.status
      ? { action: { contains: query.status, mode: "insensitive" as const } }
      : {}),
  };
  const [rows, total, exports] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        reason: true,
        requestId: true,
        createdAt: true,
        actor: { select: { loginId: true, realName: true } },
      },
    }),
    db.auditLog.count({ where }),
    db.exportJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        expiresAt: true,
      },
    }),
  ]);
  const exportSummary = exports.length
    ? `최근 export: ${exports.map((job) => `${job.type}/${job.status}`).join(", ")}`
    : "생성된 export가 없습니다.";
  return pageResult(
    query,
    ["작업", "대상", "관리자", "사유", "시각"],
    rows.map((row) => ({
      id: row.id,
      cells: [
        row.action,
        `${row.targetType}${row.targetId ? ` · ${row.targetId.slice(0, 8)}` : ""}`,
        row.actor ? `${row.actor.realName} · @${row.actor.loginId}` : "SYSTEM",
        row.reason ?? "-",
        kstDateTime.format(row.createdAt),
      ],
      status: row.action,
      confirmation: row.id,
    })),
    total,
    [],
    exportSummary,
  );
}

async function systemTable(query: AdminListQuery) {
  const [flags, settings, failedJobs] = await Promise.all([
    db.featureFlag.findMany({
      orderBy: { key: "asc" },
      select: { key: true, enabled: true, description: true, updatedAt: true },
    }),
    db.systemSetting.findMany({
      orderBy: { key: "asc" },
      select: { key: true, version: true, updatedAt: true },
    }),
    db.processingOutbox.findMany({
      where: { status: OutboxStatus.FAILED },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        attempts: true,
        availableAt: true,
        updatedAt: true,
      },
    }),
  ]);
  const readiness = [
    ["env.DATABASE_URL", "CONFIGURED", "값 비공개"],
    ["env.AUTH_SECRET", "CONFIGURED", "값 비공개"],
    ["env.CRON_SECRET", "CONFIGURED", "값 비공개"],
    [
      "env.POINT_DRAW_SECRET",
      serverEnv.POINT_DRAW_SECRET ? "CONFIGURED" : "DEV_FALLBACK",
      "값 비공개",
    ],
    [
      "env.RIOT_API_KEY",
      serverEnv.RIOT_API_KEY ? "CONFIGURED" : "NOT_CONFIGURED",
      serverEnv.MOCK_RIOT_API ? "Mock 모드" : "실 API 필수",
    ],
    ["scheduler", serverEnv.SYNC_MODE, "환경 설정"],
  ] as const;
  const allRows: AdminTableRow[] = [
    ...readiness.map(([key, status, detail]) => ({
      id: key,
      cells: [key, status, detail, "환경 변수", "재시작 시 반영"],
      status,
      confirmation: key,
    })),
    ...flags.map((flag) => ({
      id: flag.key,
      cells: [
        flag.key,
        flag.enabled ? "ENABLED" : "DISABLED",
        flag.description,
        "FeatureFlag",
        kstDateTime.format(flag.updatedAt),
      ],
      status: flag.enabled ? "ENABLED" : "DISABLED",
      confirmation: flag.key,
    })),
    ...settings.map((setting) => ({
      id: setting.key,
      cells: [
        setting.key,
        "CONFIGURED",
        `version ${setting.version} · 값 비공개`,
        "SystemSetting",
        kstDateTime.format(setting.updatedAt),
      ],
      status: "CONFIGURED",
      confirmation: setting.key,
    })),
    ...failedJobs.map((job) => ({
      id: job.id,
      cells: [
        job.type,
        "FAILED",
        `재시도 ${job.attempts}회`,
        "ProcessingOutbox",
        kstDateTime.format(job.updatedAt),
      ],
      status: "FAILED",
      confirmation: job.type,
    })),
  ]
    .filter((row) =>
      query.q
        ? row.cells.join(" ").toLowerCase().includes(query.q.toLowerCase())
        : true,
    )
    .filter((row) => !query.status || row.status === query.status);
  const start = (query.page - 1) * query.pageSize;
  return pageResult(
    query,
    ["구성 요소", "상태", "세부", "원천", "갱신"],
    allRows.slice(start, start + query.pageSize),
    allRows.length,
    ["CONFIGURED", "NOT_CONFIGURED", "ENABLED", "DISABLED", "FAILED"],
    "secret 원문, password hash, Riot key, nonce는 조회하거나 표시하지 않습니다.",
  );
}

export async function getAdminTableData(
  section: string,
  query: AdminListQuery,
): Promise<AdminTableData> {
  switch (section) {
    case "users":
      return usersTable(query);
    case "participants":
      return participantsTable(query);
    case "seasons":
      return seasonsTable(query);
    case "scoring":
      return scoringTable(query);
    case "draws":
      return drawsTable(query);
    case "missions":
      return missionsTable(query);
    case "content":
      return contentTable(query);
    case "audit-exports":
      return auditTable(query);
    case "system":
      return systemTable(query);
    default:
      return pageResult(query, [], [], 0, []);
  }
}

export async function getAdminMvpStatusSummary() {
  const [published, demo, pendingBaseline, pendingData] = await Promise.all([
    db.mvpBaselineVersion.count({
      where: { status: BaselineStatus.PUBLISHED },
    }),
    db.mvpBaselineVersion.count({ where: { demoOnly: true } }),
    db.mvpEvaluation.count({
      where: { status: MvpEvaluationStatus.PENDING_BASELINE },
    }),
    db.mvpEvaluation.count({
      where: { status: MvpEvaluationStatus.PENDING_DATA },
    }),
  ]);
  return { published, demo, pendingBaseline, pendingData };
}

export function adminExportReadiness() {
  return {
    formats: ["CSV", "JSON"] as const,
    types: [
      "PARTICIPANTS",
      "MATCHES",
      "SCORE_LEDGER",
      "MISSION_LEDGER",
      "STANDINGS",
      "FULL_ARCHIVE",
    ] as const,
    completedStatus: ExportJobStatus.COMPLETED,
    applicationStatuses: Object.values(ApplicationStatus),
  };
}
