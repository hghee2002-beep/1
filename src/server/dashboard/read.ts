import "server-only";

import { unstable_cache } from "next/cache";

import {
  DrawState,
  MatchStatus,
  MissionAssignmentState,
  MvpAward,
  MvpEvaluationStatus,
  ScoreLedgerType,
  SeasonStatus,
  SyncRunStatus,
  WeekStatus,
} from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import {
  MVP_EVALUATOR_VERSION,
  MVP_GROUPS,
  MVP_GROUP_WEIGHTS,
  isMvpPosition,
} from "@/domain/mvp/contract";
import {
  effectivePointMode,
  publicDrawRngVersion,
  resolveDrawPointMode,
} from "@/domain/scoring/point-draw";
import type { RevealedDrawResult } from "@/features/scoring/types";
import { serverEnv } from "@/lib/env/server";
import { compareRiotIds } from "@/lib/riot-id-order";
import { db } from "@/server/db/client";
import { resolveVerifiedRevealedDraw } from "@/server/scoring/reveal-proof";
import {
  calculateRankLpDelta,
  rankMainStandings,
} from "@/server/dashboard/ranking";
import {
  contextualRecordLabel,
  selectGameLeader,
} from "@/server/dashboard/highlights";
import {
  parseHistoryStandings,
  snapshotRulesVersion,
} from "@/server/dashboard/history";
import {
  formatDuration,
  formatKstDateTime,
  formatRelativeKorean,
  kstDateKey,
  kstDateStart,
  shiftDateKey,
} from "@/server/dashboard/time";
import {
  PUBLIC_RULES_SEASON_STATUSES,
  selectPublicRulesSeason,
} from "@/server/dashboard/rules";
import type {
  HistoryEntry,
  HomeDashboardData,
  LeaderboardData,
  MatchesData,
  MatchMvpDetail,
  MatchPointDetail,
  MatchPosition,
  MatchSummary,
  ParticipantProfileData,
  PublicReadResult,
  SeasonContext,
  StandingRow,
  WeekContext,
} from "@/server/dashboard/types";

const PUBLIC_CACHE_SECONDS = 20;
const DASHBOARD_TAG = "public-dashboard";

function seasonStatusLabel(status: SeasonStatus) {
  if (status === SeasonStatus.ACTIVE) return "진행 중";
  if (status === SeasonStatus.COMPLETED) return "종료";
  if (status === SeasonStatus.FINALIZING) return "확정 중";
  if (status === SeasonStatus.SCHEDULED) return "시작 예정";
  return "준비 중";
}

function seasonDto(season: {
  id: string;
  name: string;
  description: string | null;
  status: SeasonStatus;
  startAt: Date;
  endAt: Date;
  rulesVersion: string;
  scoringMode: "RANDOM_17_23" | "FIXED_20";
  minGameDurationSeconds: number;
  autoRevealHours: number;
}): SeasonContext {
  return {
    id: season.id,
    name: season.name,
    eventName: season.description ?? season.name,
    status: seasonStatusLabel(season.status),
    startAt: season.startAt.toISOString(),
    endAt: season.endAt.toISOString(),
    rulesVersion: season.rulesVersion,
    scoringMode: season.scoringMode,
    minGameDurationSeconds: season.minGameDurationSeconds,
    autoRevealHours: season.autoRevealHours,
  };
}

function weekDto(week: {
  id: string;
  number: number;
  name: string;
  status: WeekStatus;
  startAt: Date;
  endAt: Date;
  finalizedAt: Date | null;
}): WeekContext {
  return {
    id: week.id,
    number: week.number,
    name: week.name,
    status: week.status,
    startAt: week.startAt.toISOString(),
    endAt: week.endAt.toISOString(),
    finalized:
      week.status === WeekStatus.COMPLETED || week.finalizedAt !== null,
  };
}

async function resolveWeek(weekId: string | undefined, now: Date) {
  const include = { season: true } as const;
  if (weekId) {
    return db.week.findFirst({
      where: {
        id: weekId,
        season: {
          status: {
            in: [
              SeasonStatus.ACTIVE,
              SeasonStatus.FINALIZING,
              SeasonStatus.COMPLETED,
            ],
          },
        },
      },
      include,
    });
  }

  return (
    (await db.week.findFirst({
      where: {
        status: WeekStatus.ACTIVE,
        startAt: { lte: now },
        endAt: { gt: now },
        season: { status: SeasonStatus.ACTIVE },
      },
      orderBy: { startAt: "desc" },
      include,
    })) ??
    (await db.week.findFirst({
      where: {
        season: {
          status: {
            in: [SeasonStatus.ACTIVE, SeasonStatus.FINALIZING],
          },
        },
      },
      orderBy: { startAt: "desc" },
      include,
    })) ??
    (await db.week.findFirst({
      where: { status: WeekStatus.COMPLETED },
      orderBy: { endAt: "desc" },
      include,
    }))
  );
}

export async function queryLeaderboard(
  weekId?: string,
): Promise<PublicReadResult<LeaderboardData>> {
  try {
    const now = new Date();
    const week = await resolveWeek(weekId, now);
    if (!week) return { state: "empty" };

    const participantWeeks = await db.participantWeek.findMany({
      where: { weekId: week.id },
      select: {
        id: true,
        participantId: true,
        wins: true,
        losses: true,
        currentStreakType: true,
        currentStreakCount: true,
        updatedAt: true,
        participant: {
          select: {
            id: true,
            gameName: true,
            tagLine: true,
            user: {
              select: { realName: true, realNamePublic: true },
            },
          },
        },
      },
    });
    const participantIds = participantWeeks.map((row) => row.participantId);
    const participantWeekIds = participantWeeks.map((row) => row.id);
    const today = kstDateStart(now);
    const previousDateKey = shiftDateKey(kstDateKey(now), -1);

    const [
      ledgerSums,
      rankSnapshots,
      dailySnapshots,
      participantMatches,
      seasonEntries,
      freshness,
      weeks,
    ] = await Promise.all([
      db.scoreLedger.groupBy({
        by: ["participantWeekId"],
        where: { participantWeekId: { in: participantWeekIds } },
        _sum: { amount: true },
      }),
      db.rankSnapshot.findMany({
        where: {
          participantId: { in: participantIds },
          seasonId: week.seasonId,
        },
        orderBy: { capturedAt: "desc" },
        select: {
          participantId: true,
          capturedAt: true,
          tier: true,
          rank: true,
          leaguePoints: true,
          displayOrdinal: true,
          isUnranked: true,
        },
      }),
      db.dailyStandingSnapshot.findMany({
        where: {
          weekId: week.id,
          participantId: { in: participantIds },
          localDate: { lte: today },
        },
        orderBy: { localDate: "desc" },
      }),
      db.participantMatch.findMany({
        where: {
          participantWeekId: { in: participantWeekIds },
          eligible: true,
          seasonMatch: { status: MatchStatus.PROCESSED },
        },
        orderBy: { seasonMatch: { match: { gameStartAt: "desc" } } },
        select: {
          participantWeekId: true,
          win: true,
          pointDraw: { select: { state: true } },
        },
      }),
      db.seasonParticipant.findMany({
        where: {
          seasonId: week.seasonId,
          participantId: { in: participantIds },
        },
        select: {
          participantId: true,
          startingRankSnapshot: {
            select: {
              leaguePoints: true,
              displayOrdinal: true,
              tier: true,
              rank: true,
            },
          },
        },
      }),
      db.syncRun.findFirst({
        where: { status: SyncRunStatus.SUCCEEDED },
        orderBy: { finishedAt: "desc" },
        select: { finishedAt: true },
      }),
      db.week.findMany({
        where: { seasonId: week.seasonId },
        orderBy: { number: "desc" },
      }),
    ]);

    const scores = new Map(
      ledgerSums.map((row) => [row.participantWeekId, row._sum.amount ?? 0]),
    );
    const currentRanks = new Map<string, (typeof rankSnapshots)[number]>();
    const earliestRanks = new Map<string, (typeof rankSnapshots)[number]>();
    for (const snapshot of rankSnapshots) {
      if (!currentRanks.has(snapshot.participantId)) {
        currentRanks.set(snapshot.participantId, snapshot);
      }
      earliestRanks.set(snapshot.participantId, snapshot);
    }
    const startingRanks = new Map(
      seasonEntries.map((entry) => [
        entry.participantId,
        entry.startingRankSnapshot ?? earliestRanks.get(entry.participantId),
      ]),
    );
    const previousDaily = new Map<string, (typeof dailySnapshots)[number]>();
    for (const snapshot of dailySnapshots) {
      if (
        kstDateKey(snapshot.localDate) <= previousDateKey &&
        !previousDaily.has(snapshot.participantId)
      ) {
        previousDaily.set(snapshot.participantId, snapshot);
      }
    }
    const matchesByWeek = new Map<
      string,
      Array<(typeof participantMatches)[number]>
    >();
    for (const match of participantMatches) {
      const values = matchesByWeek.get(match.participantWeekId) ?? [];
      values.push(match);
      matchesByWeek.set(match.participantWeekId, values);
    }

    const ranked = rankMainStandings(
      participantWeeks.map((row) => ({
        participantId: row.participantId,
        row,
        score: scores.get(row.id) ?? 0,
        wins: row.wins,
        losses: row.losses,
      })),
    );
    const standings: StandingRow[] = ranked
      .map((rankedRow) => {
        const row = rankedRow.row;
        const currentRank = currentRanks.get(row.participantId);
        const startRank = startingRanks.get(row.participantId);
        const comparison = previousDaily.get(row.participantId);
        const recentMatches = matchesByWeek.get(row.id) ?? [];
        const previousRank = comparison?.rank ?? rankedRow.rank;
        return {
          id: row.participant.id,
          participantWeekId: row.id,
          rank: rankedRow.rank,
          previousRank,
          gameName: row.participant.gameName,
          tagLine: row.participant.tagLine,
          realName: row.participant.user.realNamePublic
            ? row.participant.user.realName
            : null,
          score: rankedRow.score,
          wins: row.wins,
          losses: row.losses,
          tier: currentRank?.isUnranked
            ? "UNRANKED"
            : (currentRank?.tier ?? "UNRANKED"),
          division: currentRank?.rank ?? "",
          lp: currentRank?.leaguePoints ?? 0,
          startLpDelta: calculateRankLpDelta(currentRank, startRank),
          comparisonLpDelta: currentRank
            ? (currentRank.leaguePoints ?? 0) -
              (comparison?.leaguePoints ?? currentRank.leaguePoints ?? 0)
            : 0,
          comparisonDate: comparison ? kstDateKey(comparison.localDate) : null,
          currentRankDate: currentRank
            ? kstDateKey(currentRank.capturedAt)
            : null,
          streak:
            row.currentStreakType === "LOSS"
              ? -row.currentStreakCount
              : row.currentStreakCount,
          sealed: recentMatches.filter(
            (match) => match.pointDraw?.state === DrawState.SEALED,
          ).length,
          recent: recentMatches
            .slice(0, 5)
            .map((match) => (match.win ? "W" : "L")),
        };
      })
      .sort(
        (left, right) =>
          left.rank - right.rank ||
          compareRiotIds(left, right) ||
          left.id.localeCompare(right.id),
      );
    const totalWins = standings.reduce((sum, row) => sum + row.wins, 0);
    const totalGames = standings.reduce(
      (sum, row) => sum + row.wins + row.losses,
      0,
    );
    const lastSuccessAt = freshness?.finishedAt ?? null;

    return {
      state: "ready",
      data: {
        season: seasonDto(week.season),
        week: weekDto(week),
        weeks: weeks.map(weekDto),
        standings,
        summary: {
          participants: standings.length,
          matches: participantMatches.length,
          sealed: standings.reduce((sum, row) => sum + row.sealed, 0),
          averageWinRate:
            totalGames === 0
              ? 0
              : Math.round((totalWins / totalGames) * 1_000) / 10,
        },
        freshness: {
          lastSuccessAt: lastSuccessAt?.toISOString() ?? null,
          stale:
            !lastSuccessAt ||
            now.getTime() - lastSuccessAt.getTime() > 10 * 60_000,
        },
      },
    };
  } catch {
    console.error("public-dashboard.leaderboard.read-failed");
    return { state: "unavailable" };
  }
}

export const getLeaderboard = unstable_cache(
  queryLeaderboard,
  ["public-dashboard", "leaderboard", "v1"],
  { revalidate: PUBLIC_CACHE_SECONDS, tags: [DASHBOARD_TAG] },
);

async function queryHomeDashboard(): Promise<
  PublicReadResult<HomeDashboardData>
> {
  try {
    const leaderboard = await queryLeaderboard();
    if (leaderboard.state !== "ready") return leaderboard;
    const [matches, announcements, missionModule] = await Promise.all([
      queryRecentMatches({
        weekId: leaderboard.data.week.id,
        pageSize: 50,
      }),
      db.announcement.findMany({
        where: {
          status: "PUBLISHED",
          publishedAt: { lte: new Date() },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
        take: 5,
        select: {
          id: true,
          title: true,
          publishedAt: true,
          pinned: true,
        },
      }),
      import("@/server/missions/read"),
    ]);
    const missionLeaderboard = await missionModule
      .getMissionLeaderboard({ weekId: leaderboard.data.week.id })
      .catch(() => null);
    const matchRows = matches.state === "ready" ? matches.data.rows : [];
    const todayKey = kstDateKey(new Date());
    const latestMatchDate = matchRows.reduce<string | null>((latest, row) => {
      const key = kstDateKey(new Date(row.endedAtIso));
      return latest === null || key > latest ? key : latest;
    }, null);
    const gamesByParticipant = new Map<string, number>();
    for (const match of matchRows) {
      if (
        latestMatchDate &&
        kstDateKey(new Date(match.endedAtIso)) === latestMatchDate
      ) {
        gamesByParticipant.set(
          match.participantId,
          (gamesByParticipant.get(match.participantId) ?? 0) + 1,
        );
      }
    }
    const gameLeader = selectGameLeader(
      leaderboard.data.standings,
      gamesByParticipant,
    );
    const latestRankDate = leaderboard.data.standings.reduce<string | null>(
      (latest, row) =>
        row.currentRankDate && (latest === null || row.currentRankDate > latest)
          ? row.currentRankDate
          : latest,
      null,
    );
    const lpLeader = leaderboard.data.standings
      .filter((row) => row.currentRankDate === latestRankDate)
      .sort(
        (left, right) =>
          right.comparisonLpDelta - left.comparisonLpDelta ||
          left.rank - right.rank,
      )[0];
    const streakLeader = [...leaderboard.data.standings].sort(
      (left, right) => right.streak - left.streak || left.rank - right.rank,
    )[0];

    return {
      state: "ready",
      data: {
        leaderboard: leaderboard.data,
        topFive: leaderboard.data.standings.slice(0, 5),
        recentMatches: matchRows.slice(0, 6),
        highlights: {
          lp: {
            participant: lpLeader ?? null,
            value: lpLeader?.comparisonLpDelta ?? 0,
            label: contextualRecordLabel({
              todayKey,
              recordDate: latestRankDate,
              todayLabel: "오늘 LP 상승",
              recentLabel: "최근 LP 상승",
              emptyLabel: "LP 기록 없음",
            }),
          },
          streak: {
            participant: streakLeader ?? null,
            value: Math.max(0, streakLeader?.streak ?? 0),
          },
          games: {
            participant: gameLeader?.participant ?? null,
            value: gameLeader?.value ?? 0,
            label: contextualRecordLabel({
              todayKey,
              recordDate: latestMatchDate,
              todayLabel: "오늘 최다 경기",
              recentLabel: "최근 최다 경기",
              emptyLabel: "경기 기록 없음",
            }),
          },
        },
        missionLeaders:
          missionLeaderboard?.standings.slice(0, 4).map((row) => ({
            participantWeekId: row.participantWeekId,
            rank: row.rank,
            gameName: row.gameName,
            tagLine: row.tagLine,
            score: row.score,
          })) ?? [],
        announcements: announcements.map((announcement) => ({
          id: announcement.id,
          title: announcement.title,
          publishedAt:
            announcement.publishedAt?.toISOString() ??
            new Date(0).toISOString(),
          pinned: announcement.pinned,
        })),
      },
    };
  } catch {
    console.error("public-dashboard.home.read-failed");
    return { state: "unavailable" };
  }
}

export const getHomeDashboard = unstable_cache(
  queryHomeDashboard,
  ["public-dashboard", "home", "v1"],
  { revalidate: PUBLIC_CACHE_SECONDS, tags: [DASHBOARD_TAG] },
);

export type MatchFilters = {
  weekId?: string;
  participantId?: string;
  query?: string;
  result?: "win" | "loss";
  champion?: string;
  position?: MatchPosition;
  pointMin?: number;
  pointMax?: number;
  dateFrom?: string;
  dateTo?: string;
  includeInvalid?: boolean;
  page?: number;
  pageSize?: number;
};

const PUBLIC_DRAW_STATES: DrawState[] = [
  DrawState.REVEALED,
  DrawState.REROLLED,
  DrawState.AUTO_REVEALED,
];

function matchWhere(weekId: string, filters: MatchFilters) {
  const startAt = filters.dateFrom ? kstDateStart(filters.dateFrom) : undefined;
  const endAt = filters.dateTo
    ? kstDateStart(shiftDateKey(filters.dateTo, 1))
    : undefined;
  const query = filters.query?.trim().slice(0, 128);
  const champion = filters.champion?.trim().slice(0, 64);
  const pointMin = publicPointBound(filters.pointMin);
  const pointMax = publicPointBound(filters.pointMax);
  const hasPointRange = pointMin !== undefined || pointMax !== undefined;
  return {
    participantWeek: { weekId },
    seasonMatch: {
      ...(!filters.includeInvalid ? { status: MatchStatus.PROCESSED } : {}),
      match: {
        ...(startAt || endAt
          ? {
              gameEndAt: {
                ...(startAt ? { gte: startAt } : {}),
                ...(endAt ? { lt: endAt } : {}),
              },
            }
          : {}),
      },
    },
    ...(filters.includeInvalid
      ? {
          OR: [
            {
              eligible: true,
              seasonMatch: { status: MatchStatus.PROCESSED },
            },
            {
              eligible: false,
              eligibilityReason: "ADMIN_INVALIDATED",
              seasonMatch: { status: MatchStatus.INVALID },
            },
          ],
        }
      : {
          eligible: true,
        }),
    ...(filters.participantId ? { participantId: filters.participantId } : {}),
    ...(filters.result ? { win: filters.result === "win" } : {}),
    ...(filters.position ? { position: filters.position } : {}),
    ...(hasPointRange
      ? {
          pointDraw: {
            is: {
              state: {
                in: PUBLIC_DRAW_STATES,
              },
              finalSignedValue: {
                ...(pointMin !== undefined ? { gte: pointMin } : {}),
                ...(pointMax !== undefined ? { lte: pointMax } : {}),
              },
            },
          },
        }
      : {}),
    ...(champion
      ? { championName: { contains: champion, mode: "insensitive" as const } }
      : {}),
    ...(query
      ? {
          participant: {
            OR: [
              { gameName: { contains: query, mode: "insensitive" as const } },
              { tagLine: { contains: query, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  } satisfies Prisma.ParticipantMatchWhereInput;
}

function publicPointBound(value: number | undefined) {
  return Number.isInteger(value) &&
    value !== undefined &&
    value >= -23 &&
    value <= 23
    ? value
    : undefined;
}

const positionLabels: Record<string, string> = {
  TOP: "탑",
  JUNGLE: "정글",
  MIDDLE: "미드",
  BOTTOM: "원거리",
  UTILITY: "서포터",
};

const mvpGroupLabels = {
  VISION_OBJECTIVE: "시야·오브젝트",
  GROWTH: "성장",
  DAMAGE: "전투",
  KDA_PARTICIPATION: "KDA·관여",
} as const;

const mvpGroupScoreFields = {
  VISION_OBJECTIVE: "visionObjectiveScore",
  GROWTH: "growthScore",
  DAMAGE: "damageScore",
  KDA_PARTICIPATION: "kdaParticipationScore",
} as const;

function roundedPublicNumber(value: number | { toString(): string } | null) {
  return value === null ? null : Math.round(Number(value) * 1_000) / 1_000;
}

export async function queryRecentMatches(
  filters: MatchFilters = {},
): Promise<PublicReadResult<MatchesData>> {
  try {
    const now = new Date();
    const week = await resolveWeek(filters.weekId, now);
    if (!week) return { state: "empty" };
    const page = Math.max(1, Math.trunc(filters.page ?? 1));
    const pageSize = Math.min(
      50,
      Math.max(1, Math.trunc(filters.pageSize ?? 20)),
    );
    const where = matchWhere(week.id, filters);
    const [total, rows] = await Promise.all([
      db.participantMatch.count({ where }),
      db.participantMatch.findMany({
        where,
        orderBy: { seasonMatch: { match: { gameEndAt: "desc" } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          participantId: true,
          eligibilityReason: true,
          win: true,
          position: true,
          championName: true,
          kills: true,
          deaths: true,
          assists: true,
          cs: true,
          participant: {
            select: { gameName: true, tagLine: true },
          },
          seasonMatch: {
            select: {
              status: true,
              match: {
                select: {
                  riotMatchId: true,
                  durationSeconds: true,
                  gameEndAt: true,
                },
              },
            },
          },
          pointDraw: {
            select: {
              id: true,
              state: true,
              firstCommitment: true,
              firstCommitmentVersion: true,
              firstRngVersion: true,
              firstGeneratedAt: true,
              secondCommitment: true,
              secondCommitmentVersion: true,
              secondRngVersion: true,
              revealedAt: true,
              autoRevealed: true,
              rerollUsedAt: true,
            },
          },
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
          mvpEvaluations: {
            where: {
              status: MvpEvaluationStatus.COMPLETED,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              award: true,
              totalScore: true,
              teamRank: true,
              position: true,
              visionObjectiveScore: true,
              growthScore: true,
              damageScore: true,
              kdaParticipationScore: true,
              evaluatorVersion: true,
              baselineVersion: {
                select: {
                  name: true,
                  patchFrom: true,
                  patchTo: true,
                  demoOnly: true,
                },
              },
            },
          },
          missionProgressEvents: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              assignmentId: true,
              type: true,
              beforeValue: true,
              deltaValue: true,
              afterValue: true,
              completed: true,
              evaluatorVersion: true,
              assignment: {
                select: {
                  target: true,
                  unit: true,
                  missionDefinition: {
                    select: { code: true, title: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    const proofDrawIds = rows.flatMap((row) =>
      row.pointDraw && PUBLIC_DRAW_STATES.includes(row.pointDraw.state)
        ? [row.pointDraw.id]
        : [],
    );
    const proofRows = proofDrawIds.length
      ? await db.pointDraw.findMany({
          where: {
            id: { in: proofDrawIds },
            state: { in: PUBLIC_DRAW_STATES },
          },
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
              },
            },
          },
        })
      : [];
    const verifiedProofByDrawId = new Map<string, RevealedDrawResult>();
    const failedProofDrawIds = new Set<string>();
    for (const draw of proofRows) {
      const revealedAt =
        draw.state === DrawState.REROLLED ? draw.rerollUsedAt : draw.revealedAt;
      if (!revealedAt) {
        failedProofDrawIds.add(draw.id);
        continue;
      }
      try {
        verifiedProofByDrawId.set(
          draw.id,
          resolveVerifiedRevealedDraw(
            {
              ...draw,
              pointModeLedgerEntries: draw.participantMatch.scoreLedger,
            },
            revealedAt,
          ),
        );
      } catch {
        failedProofDrawIds.add(draw.id);
      }
    }
    const rowParticipantIds = [
      ...new Set(rows.map((row) => row.participantId)),
    ];
    const streakMatches = rowParticipantIds.length
      ? await db.participantMatch.findMany({
          where: {
            participantId: { in: rowParticipantIds },
            eligible: true,
            participantWeek: { weekId: week.id },
            seasonMatch: { status: MatchStatus.PROCESSED },
          },
          orderBy: { seasonMatch: { match: { gameStartAt: "asc" } } },
          select: { id: true, participantId: true, win: true },
        })
      : [];
    const streakByMatch = new Map<string, number>();
    const streakState = new Map<string, { win: boolean; count: number }>();
    for (const match of streakMatches) {
      const previous = streakState.get(match.participantId);
      const count = previous?.win === match.win ? previous.count + 1 : 1;
      streakState.set(match.participantId, { win: match.win, count });
      streakByMatch.set(match.id, match.win ? count : -count);
    }

    const matchRows: MatchSummary[] = rows.map((row) => {
      const match = row.seasonMatch.match;
      const evaluation = row.mvpEvaluations[0];
      const invalid = row.seasonMatch.status === MatchStatus.INVALID;
      const rerolled = Boolean(row.pointDraw?.rerollUsedAt);
      const useSecondCommitment =
        rerolled && Boolean(row.pointDraw?.secondCommitment);
      const commitment = row.pointDraw
        ? useSecondCommitment
          ? row.pointDraw.secondCommitment
          : row.pointDraw.firstCommitment
        : null;
      const storedRngVersion = row.pointDraw
        ? useSecondCommitment && row.pointDraw.secondRngVersion
          ? row.pointDraw.secondRngVersion
          : row.pointDraw.firstRngVersion
        : null;
      const storedPointMode =
        row.pointDraw && storedRngVersion
          ? resolveDrawPointMode({
              rngVersion: storedRngVersion,
              ledgerEntries: row.scoreLedger,
              useSecond: rerolled,
            })
          : null;
      const proof = row.pointDraw
        ? verifiedProofByDrawId.get(row.pointDraw.id)
        : undefined;
      const proofMatchesRow = Boolean(
        proof &&
        row.pointDraw &&
        proof.participantMatchId === row.id &&
        proof.state === row.pointDraw.state &&
        proof.commitment === commitment &&
        proof.signedDelta ===
          (row.win ? proof.displayMagnitude : -proof.displayMagnitude),
      );
      const proofFailed = Boolean(
        row.pointDraw &&
        PUBLIC_DRAW_STATES.includes(row.pointDraw.state) &&
        (!proofMatchesRow || failedProofDrawIds.has(row.pointDraw.id)),
      );
      const pointDetails: MatchPointDetail = {
        state: row.pointDraw?.state ?? "MISSING",
        signedPoint: proofMatchesRow && proof ? proof.signedDelta : null,
        drawId: proofMatchesRow && proof ? proof.id : null,
        phase: proofMatchesRow && proof ? proof.phase : null,
        magnitude: proofMatchesRow && proof ? proof.displayMagnitude : null,
        nonce: proofMatchesRow && proof ? proof.nonce : null,
        commitment,
        commitmentVersion: row.pointDraw
          ? useSecondCommitment
            ? row.pointDraw.secondCommitmentVersion
            : row.pointDraw.firstCommitmentVersion
          : null,
        rngVersion:
          proofMatchesRow && proof
            ? proof.rngVersion
            : storedRngVersion && storedPointMode
              ? publicDrawRngVersion(storedRngVersion, storedPointMode)
              : null,
        pointMode: proofMatchesRow && proof ? proof.pointMode : storedPointMode,
        generatedAt: row.pointDraw
          ? ((useSecondCommitment
              ? row.pointDraw.rerollUsedAt
              : row.pointDraw.firstGeneratedAt
            )?.toISOString() ?? null)
          : null,
        revealedAt:
          proofMatchesRow && proof
            ? proof.revealedAt
            : ((useSecondCommitment
                ? row.pointDraw?.rerollUsedAt
                : row.pointDraw?.revealedAt
              )?.toISOString() ?? null),
        autoRevealed: row.pointDraw?.autoRevealed ?? false,
        rerolled,
        verification: !row.pointDraw
          ? "UNAVAILABLE"
          : row.pointDraw.state === DrawState.SEALED
            ? "PENDING"
            : row.pointDraw.state === DrawState.VOID
              ? "VOID"
              : proofFailed
                ? "FAILED"
                : "VERIFIED",
        verifier:
          proofMatchesRow && proof
            ? {
                ...proof.verifier,
                fields: [...proof.verifier.fields],
              }
            : null,
      };
      const mvpPosition =
        evaluation?.position && isMvpPosition(evaluation.position)
          ? evaluation.position
          : null;
      const mvpDetails: MatchMvpDetail | null = evaluation
        ? {
            award: invalid
              ? null
              : evaluation.award === MvpAward.MVP
                ? "MVP"
                : evaluation.award === MvpAward.ACE
                  ? "ACE"
                  : null,
            totalScore: roundedPublicNumber(evaluation.totalScore),
            teamRank: evaluation.teamRank,
            position: mvpPosition,
            evaluatorVersion: evaluation.evaluatorVersion,
            baseline: evaluation.baselineVersion,
            groups: MVP_GROUPS.map((group) => ({
              key: group,
              label: mvpGroupLabels[group],
              score: roundedPublicNumber(
                evaluation[mvpGroupScoreFields[group]],
              ),
              weight:
                evaluation.evaluatorVersion === MVP_EVALUATOR_VERSION &&
                mvpPosition
                  ? MVP_GROUP_WEIGHTS[mvpPosition][group]
                  : null,
            })),
          }
        : null;
      const award = invalid
        ? undefined
        : evaluation?.award === MvpAward.MVP
          ? "MVP"
          : evaluation?.award === MvpAward.ACE
            ? "ACE"
            : undefined;
      return {
        id: row.id,
        riotMatchId: match.riotMatchId,
        participantId: row.participantId,
        gameName: row.participant.gameName,
        tagLine: row.participant.tagLine,
        champion: row.championName,
        position: row.position,
        role: row.position
          ? (positionLabels[row.position] ?? row.position)
          : "미정",
        result: row.win ? "승" : "패",
        kda: `${row.kills} / ${row.deaths} / ${row.assists}`,
        cs: row.cs,
        duration: formatDuration(match.durationSeconds),
        endedAt: `${formatKstDateTime(match.gameEndAt)} · ${formatRelativeKorean(match.gameEndAt, now)}`,
        endedAtIso: match.gameEndAt.toISOString(),
        point: pointDetails.signedPoint,
        streak: streakByMatch.get(row.id) ?? 0,
        invalid,
        invalidReason:
          row.eligibilityReason === "ADMIN_INVALIDATED"
            ? "ADMIN_INVALIDATED"
            : null,
        ...(award ? { award } : {}),
        details: {
          point: pointDetails,
          mvp: mvpDetails,
          missions: row.missionProgressEvents.map((event) => ({
            assignmentId: event.assignmentId,
            code: event.assignment.missionDefinition.code,
            title: event.assignment.missionDefinition.title,
            before: roundedPublicNumber(event.beforeValue) ?? 0,
            delta: roundedPublicNumber(event.deltaValue) ?? 0,
            after: roundedPublicNumber(event.afterValue) ?? 0,
            target: roundedPublicNumber(event.assignment.target) ?? 0,
            unit: event.assignment.unit,
            completed: event.completed,
            correction: event.type === "CORRECTION",
            evaluatorVersion: event.evaluatorVersion,
          })),
        },
      };
    });

    return {
      state: "ready",
      data: {
        season: seasonDto(week.season),
        week: weekDto(week),
        rows: matchRows,
        total,
        page,
        pageSize,
      },
    };
  } catch {
    console.error("public-dashboard.matches.read-failed");
    return { state: "unavailable" };
  }
}

export const getRecentMatches = unstable_cache(
  queryRecentMatches,
  ["public-dashboard", "matches", "v2"],
  { revalidate: PUBLIC_CACHE_SECONDS, tags: [DASHBOARD_TAG] },
);

function seriesLabel(dateKey: string) {
  const [, month = "", day = ""] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export async function queryParticipantProfile(
  participantId: string,
  weekId?: string,
): Promise<PublicReadResult<ParticipantProfileData>> {
  try {
    const leaderboard = await queryLeaderboard(weekId);
    if (leaderboard.state !== "ready") return leaderboard;
    const standing = leaderboard.data.standings.find(
      (row) => row.id === participantId,
    );
    if (!standing) return { state: "empty" };
    const week = leaderboard.data.week;
    const [participantWeek, dailySnapshots, matchesResult] = await Promise.all([
      db.participantWeek.findUnique({
        where: { id: standing.participantWeekId },
        select: {
          mvpCount: true,
          aceCount: true,
          participant: { select: { lastIdentitySyncAt: true } },
          scoreLedger: {
            orderBy: { createdAt: "desc" },
            select: { id: true, type: true, amount: true, createdAt: true },
          },
          missionAssignments: {
            where: { state: MissionAssignmentState.COMPLETED },
            orderBy: { completedAt: "desc" },
            select: {
              id: true,
              completedAt: true,
              missionDefinition: {
                select: { code: true, title: true, points: true },
              },
            },
          },
          participantMatches: {
            where: {
              eligible: true,
              seasonMatch: { status: MatchStatus.PROCESSED },
            },
            select: {
              championName: true,
              win: true,
              kda: true,
              position: true,
            },
          },
        },
      }),
      db.dailyStandingSnapshot.findMany({
        where: { weekId: week.id, participantId },
        orderBy: { localDate: "asc" },
        select: { localDate: true, mainScore: true, leaguePoints: true },
      }),
      queryRecentMatches({ weekId: week.id, participantId, pageSize: 10 }),
    ]);
    if (!participantWeek) return { state: "empty" };

    const championMap = new Map<
      string,
      { champion: string; games: number; wins: number; kda: number }
    >();
    const positionMap = new Map<string, number>();
    for (const match of participantWeek.participantMatches) {
      const champion = championMap.get(match.championName) ?? {
        champion: match.championName,
        games: 0,
        wins: 0,
        kda: 0,
      };
      champion.games += 1;
      champion.wins += match.win ? 1 : 0;
      champion.kda += Number(match.kda);
      championMap.set(match.championName, champion);
      const position = match.position ?? "UNKNOWN";
      positionMap.set(position, (positionMap.get(position) ?? 0) + 1);
    }
    const totalPositionGames = participantWeek.participantMatches.length;
    const startSnapshot = await db.seasonParticipant.findUnique({
      where: {
        seasonId_participantId: {
          seasonId: leaderboard.data.season.id,
          participantId,
        },
      },
      select: {
        startingRankSnapshot: {
          select: { tier: true, rank: true, leaguePoints: true },
        },
      },
    });

    return {
      state: "ready",
      data: {
        standing,
        season: leaderboard.data.season,
        week: leaderboard.data.week,
        lastSyncedAt:
          participantWeek.participant.lastIdentitySyncAt?.toISOString() ?? null,
        startRank: startSnapshot?.startingRankSnapshot
          ? {
              tier: startSnapshot.startingRankSnapshot.tier ?? "UNRANKED",
              division: startSnapshot.startingRankSnapshot.rank ?? "",
              lp: startSnapshot.startingRankSnapshot.leaguePoints ?? 0,
            }
          : null,
        scoreSeries: dailySnapshots.map((snapshot) => {
          const date = kstDateKey(snapshot.localDate);
          return {
            date,
            label: seriesLabel(date),
            score: snapshot.mainScore,
            lp: snapshot.leaguePoints,
          };
        }),
        matches: matchesResult.state === "ready" ? matchesResult.data.rows : [],
        champions: [...championMap.values()]
          .sort((left, right) => right.games - left.games)
          .slice(0, 5)
          .map((row) => ({
            champion: row.champion,
            games: row.games,
            wins: row.wins,
            averageKda: Math.round((row.kda / row.games) * 10) / 10,
          })),
        positions: [...positionMap.entries()]
          .sort((left, right) => right[1] - left[1])
          .map(([position, games]) => ({
            position: positionLabels[position] ?? "기타",
            games,
            percentage:
              totalPositionGames === 0
                ? 0
                : Math.round((games / totalPositionGames) * 100),
          })),
        awards: {
          mvp: participantWeek.mvpCount,
          ace: participantWeek.aceCount,
        },
        completedMissions: participantWeek.missionAssignments.map(
          (assignment) => ({
            id: assignment.id,
            code: assignment.missionDefinition.code,
            title: assignment.missionDefinition.title,
            points: assignment.missionDefinition.points,
            completedAt: assignment.completedAt?.toISOString() ?? null,
          }),
        ),
        ledger: participantWeek.scoreLedger.map((entry) => ({
          id: entry.id,
          type: entry.type,
          amount: entry.amount,
          createdAt: entry.createdAt.toISOString(),
        })),
      },
    };
  } catch {
    console.error("public-dashboard.participant.read-failed");
    return { state: "unavailable" };
  }
}

export const getParticipantProfile = unstable_cache(
  queryParticipantProfile,
  ["public-dashboard", "participant", "v1"],
  { revalidate: PUBLIC_CACHE_SECONDS, tags: [DASHBOARD_TAG] },
);

export async function queryHistory(): Promise<
  PublicReadResult<HistoryEntry[]>
> {
  try {
    const [weekSnapshots, finalSnapshots] = await Promise.all([
      db.weekSnapshot.findMany({
        orderBy: { generatedAt: "desc" },
        include: { week: { include: { season: true } } },
      }),
      db.finalStandingSnapshot.findMany({
        orderBy: { generatedAt: "desc" },
        include: { season: true },
      }),
    ]);
    const entries: HistoryEntry[] = [
      ...weekSnapshots.map((snapshot) => ({
        id: snapshot.id,
        kind: "WEEK" as const,
        seasonName: snapshot.week.season.name,
        label: snapshot.week.name,
        startAt: snapshot.week.startAt.toISOString(),
        endAt: snapshot.week.endAt.toISOString(),
        generatedAt: snapshot.generatedAt.toISOString(),
        rulesVersion: snapshotRulesVersion(
          snapshot.rulesSnapshot,
          snapshot.week.season.rulesVersion,
        ),
        checksum: snapshot.checksum,
        standings: parseHistoryStandings(snapshot.standings),
        missionStandings: parseHistoryStandings(snapshot.missionStandings),
      })),
      ...finalSnapshots.map((snapshot) => ({
        id: snapshot.id,
        kind: "FINAL" as const,
        seasonName: snapshot.season.name,
        label: "시즌 최종",
        startAt: snapshot.season.startAt.toISOString(),
        endAt: snapshot.season.endAt.toISOString(),
        generatedAt: snapshot.generatedAt.toISOString(),
        rulesVersion: snapshotRulesVersion(
          snapshot.rulesSnapshot,
          snapshot.season.rulesVersion,
        ),
        checksum: snapshot.checksum,
        standings: parseHistoryStandings(snapshot.standings),
        missionStandings: [],
      })),
    ].sort((left, right) => right.endAt.localeCompare(left.endAt));
    return entries.length
      ? { state: "ready", data: entries }
      : { state: "empty" };
  } catch {
    console.error("public-dashboard.history.read-failed");
    return { state: "unavailable" };
  }
}

export const getHistory = unstable_cache(
  queryHistory,
  ["public-dashboard", "history", "v1"],
  { revalidate: 300, tags: [DASHBOARD_TAG] },
);

async function queryRules() {
  try {
    const seasons = await db.season.findMany({
      where: {
        status: {
          in: [...PUBLIC_RULES_SEASON_STATUSES],
        },
      },
      orderBy: { startAt: "desc" },
    });
    const season = selectPublicRulesSeason(seasons);
    if (!season) return { state: "empty" } as const;
    const [documents, fixed20Fallback] = await Promise.all([
      db.legalDocument.findMany({
        where: { status: "PUBLISHED", effectiveAt: { lte: new Date() } },
        orderBy: [{ type: "asc" }, { version: "desc" }],
        select: {
          type: true,
          version: true,
          title: true,
          body: true,
          effectiveAt: true,
        },
      }),
      db.featureFlag.findUnique({
        where: { key: "scoring.fixed20Fallback" },
        select: { enabled: true },
      }),
    ]);
    const latestDocuments = new Map<string, (typeof documents)[number]>();
    for (const document of documents) {
      if (!latestDocuments.has(document.type)) {
        latestDocuments.set(document.type, document);
      }
    }
    return {
      state: "ready" as const,
      data: {
        season: seasonDto(season),
        effectiveScoringMode: effectivePointMode(
          season.scoringMode,
          fixed20Fallback?.enabled ? "FIXED_20" : serverEnv.POINT_MODE,
        ),
        documents: [...latestDocuments.values()].map((document) => ({
          ...document,
          effectiveAt: document.effectiveAt.toISOString(),
        })),
      },
    };
  } catch {
    console.error("public-dashboard.rules.read-failed");
    return { state: "unavailable" } as const;
  }
}

export const getPublishedRules = unstable_cache(
  queryRules,
  ["public-dashboard", "rules", "v2"],
  { revalidate: 300, tags: [DASHBOARD_TAG] },
);

export async function getSiteContext() {
  const leaderboard = await getLeaderboard();
  if (leaderboard.state !== "ready") return null;
  return {
    season: leaderboard.data.season,
    week: leaderboard.data.week,
    freshness: leaderboard.data.freshness,
  };
}
