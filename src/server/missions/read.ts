import "server-only";

import { MissionAssignmentState, WeekStatus } from "@/generated/prisma/client";
import { calculateMissionRefillAccrual } from "@/domain/missions/lifecycle";
import { rankMissionStandings } from "@/domain/missions/ranking";
import { MAX_ACTIVE_MISSIONS } from "@/domain/missions/selection";
import { db } from "@/server/db/client";
import { compareRiotIds } from "@/lib/riot-id-order";

function evaluationDto(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.status !== "string" ||
    typeof record.currentValue !== "number" ||
    typeof record.targetValue !== "number" ||
    typeof record.unit !== "string" ||
    typeof record.reason !== "string"
  ) {
    return null;
  }
  const evidence =
    typeof record.evidence === "object" &&
    record.evidence !== null &&
    !Array.isArray(record.evidence)
      ? Object.fromEntries(
          Object.entries(record.evidence).filter((entry) =>
            ["string", "number", "boolean"].includes(typeof entry[1]),
          ),
        )
      : {};
  return {
    status: record.status,
    currentValue: record.currentValue,
    targetValue: record.targetValue,
    unit: record.unit,
    reason: record.reason,
    evidence,
  };
}

function assignmentDto(assignment: {
  id: string;
  state: MissionAssignmentState;
  activeFrom: Date;
  activeTo: Date | null;
  progress: { toString(): string };
  target: { toString(): string };
  unit: string | null;
  progressPayload: unknown;
  completedAt: Date | null;
  missionDefinition: {
    code: string;
    version: number;
    title: string;
    description: string;
    difficulty: string;
    points: number;
    sourceType: string;
  };
}) {
  return {
    id: assignment.id,
    code: assignment.missionDefinition.code,
    definitionVersion: assignment.missionDefinition.version,
    title: assignment.missionDefinition.title,
    description: assignment.missionDefinition.description,
    difficulty: assignment.missionDefinition.difficulty,
    points: assignment.missionDefinition.points,
    sourceType: assignment.missionDefinition.sourceType,
    state: assignment.state,
    progress: assignment.progress.toString(),
    target: assignment.target.toString(),
    unit: assignment.unit ?? "count",
    activeFrom: assignment.activeFrom.toISOString(),
    activeTo: assignment.activeTo?.toISOString() ?? null,
    completedAt: assignment.completedAt?.toISOString() ?? null,
    evaluation: evaluationDto(assignment.progressPayload),
  };
}

export async function getMyMissionDashboard(userId: string, now = new Date()) {
  const participant = await db.participant.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!participant) return null;
  const participantWeek = await db.participantWeek.findFirst({
    where: {
      participantId: participant.id,
      week: {
        status: WeekStatus.ACTIVE,
        startAt: { lte: now },
        endAt: { gt: now },
      },
    },
    orderBy: { week: { startAt: "desc" } },
    include: {
      week: { select: { id: true, name: true, startAt: true, endAt: true } },
      missionRefillState: true,
      missionRerollState: true,
      missionAssignments: {
        where: {
          state: {
            in: [
              MissionAssignmentState.ACTIVE,
              MissionAssignmentState.COMPLETED,
              MissionAssignmentState.REROLLED,
              MissionAssignmentState.EXPIRED,
            ],
          },
        },
        include: { missionDefinition: true },
        orderBy: [{ assignedAt: "desc" }, { seenOrder: "desc" }],
      },
    },
  });
  if (!participantWeek) return null;

  const active = participantWeek.missionAssignments.filter(
    (assignment) => assignment.state === MissionAssignmentState.ACTIVE,
  );
  const history = participantWeek.missionAssignments.filter(
    (assignment) => assignment.state !== MissionAssignmentState.ACTIVE,
  );
  const refill = participantWeek.missionRefillState;
  const effectiveRefill = refill
    ? calculateMissionRefillAccrual({
        anchorAt: refill.anchorAt,
        accountedThroughAt: refill.accountedThroughAt,
        now,
        credits: refill.credits,
        maxCredits: refill.maxCredits,
        intervalMinutes: refill.intervalMinutes,
      })
    : null;
  const rerollAvailableAt =
    participantWeek.missionRerollState?.nextAvailableAt ?? null;

  return {
    participantWeekId: participantWeek.id,
    week: {
      id: participantWeek.week.id,
      name: participantWeek.week.name,
      startAt: participantWeek.week.startAt.toISOString(),
      endAt: participantWeek.week.endAt.toISOString(),
      timeZone: "Asia/Seoul",
    },
    missionScore: participantWeek.missionScoreCached,
    missionRank: participantWeek.missionRankCached,
    active: active.map(assignmentDto),
    vacancy: MAX_ACTIVE_MISSIONS - active.length,
    refill: {
      credits: effectiveRefill?.credits ?? 0,
      maxCredits: refill?.maxCredits ?? 3,
      nextAccrualAt: effectiveRefill?.nextAccrualAt.toISOString() ?? null,
      remainingSeconds: effectiveRefill
        ? Math.max(
            0,
            Math.ceil(
              (effectiveRefill.nextAccrualAt.getTime() - now.getTime()) / 1_000,
            ),
          )
        : 0,
    },
    reroll: {
      nextAvailableAt: rerollAvailableAt?.toISOString() ?? null,
      remainingSeconds: rerollAvailableAt
        ? Math.max(
            0,
            Math.ceil((rerollAvailableAt.getTime() - now.getTime()) / 1_000),
          )
        : 0,
    },
    history: history.map(assignmentDto),
  };
}

type MissionSnapshotStanding = {
  rank: number | null;
  gameName: string;
  tagLine: string;
  realName: string | null;
  score: number;
  completed: number;
};

function snapshotStanding(value: unknown): MissionSnapshotStanding | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.gameName !== "string" ||
    typeof row.tagLine !== "string" ||
    typeof row.score !== "number"
  ) {
    return null;
  }
  return {
    rank: typeof row.rank === "number" ? row.rank : null,
    gameName: row.gameName,
    tagLine: row.tagLine,
    realName: typeof row.realName === "string" ? row.realName : null,
    score: row.score,
    completed: typeof row.completed === "number" ? row.completed : 0,
  };
}

function snapshotStandings(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((row) => {
        const parsed = snapshotStanding(row);
        return parsed ? [parsed] : [];
      })
    : [];
}

async function missionScoresForWeek(weekId: string) {
  const ledger = await db.missionCompletionLedger.findMany({
    where: { participantWeek: { weekId } },
    select: { participantWeekId: true, points: true },
  });
  const scores = new Map<string, number>();
  for (const entry of ledger) {
    scores.set(
      entry.participantWeekId,
      (scores.get(entry.participantWeekId) ?? 0) + entry.points,
    );
  }
  return scores;
}

export async function getMissionLeaderboard(input?: {
  weekId?: string;
  now?: Date;
}) {
  const now = input?.now ?? new Date();
  const week = input?.weekId
    ? await db.week.findUnique({
        where: { id: input.weekId },
        select: { id: true, number: true, name: true, seasonId: true },
      })
    : await db.week.findFirst({
        where: {
          status: WeekStatus.ACTIVE,
          startAt: { lte: now },
          endAt: { gt: now },
        },
        orderBy: { startAt: "desc" },
        select: { id: true, number: true, name: true, seasonId: true },
      });
  if (!week) return null;

  const previousWeek = await db.week.findFirst({
    where: { seasonId: week.seasonId, number: { lt: week.number } },
    orderBy: { number: "desc" },
    select: { id: true },
  });
  const [participantWeeks, scores, previousParticipantWeeks, previousScores] =
    await Promise.all([
      db.participantWeek.findMany({
        where: { weekId: week.id },
        include: {
          participant: {
            select: {
              id: true,
              gameName: true,
              tagLine: true,
              user: {
                select: { realName: true },
              },
            },
          },
          missionAssignments: {
            select: {
              state: true,
              completedAt: true,
              missionDefinition: { select: { title: true } },
            },
          },
        },
      }),
      missionScoresForWeek(week.id),
      previousWeek
        ? db.participantWeek.findMany({
            where: { weekId: previousWeek.id },
            select: { id: true, participantId: true },
          })
        : Promise.resolve([]),
      previousWeek
        ? missionScoresForWeek(previousWeek.id)
        : Promise.resolve(new Map<string, number>()),
    ]);

  const previousRanks = new Map(
    rankMissionStandings(
      previousParticipantWeeks.map((row) => ({
        participantWeekId: row.id,
        participantId: row.participantId,
        score: previousScores.get(row.id) ?? 0,
      })),
    ).map((row) => [row.participantId, row.rank]),
  );

  const standings = rankMissionStandings(
    participantWeeks.map((row) => ({
      participantWeekId: row.id,
      participantId: row.participant.id,
      gameName: row.participant.gameName,
      tagLine: row.participant.tagLine,
      realName: row.participant.user.realName,
      score: scores.get(row.id) ?? 0,
      completed: row.missionAssignments.filter(
        (assignment) => assignment.state === MissionAssignmentState.COMPLETED,
      ).length,
      active: row.missionAssignments.filter(
        (assignment) => assignment.state === MissionAssignmentState.ACTIVE,
      ).length,
      latestCompletion: row.missionAssignments
        .filter(
          (assignment) =>
            assignment.state === MissionAssignmentState.COMPLETED &&
            assignment.completedAt,
        )
        .sort(
          (left, right) =>
            (right.completedAt?.getTime() ?? 0) -
            (left.completedAt?.getTime() ?? 0),
        )[0],
    })),
  )
    .map((row) => {
      const previousRank = previousRanks.get(row.participantId) ?? null;
      return {
        ...row,
        latestCompletion: row.latestCompletion
          ? {
              title: row.latestCompletion.missionDefinition.title,
              completedAt:
                row.latestCompletion.completedAt?.toISOString() ?? null,
            }
          : null,
        previousRank,
        rankDelta: previousRank === null ? null : previousRank - row.rank,
      };
    })
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        compareRiotIds(left, right) ||
        left.participantWeekId.localeCompare(right.participantWeekId),
    );

  return { week, standings };
}

export async function getMissionHistory() {
  const weeks = await db.week.findMany({
    where: { status: WeekStatus.COMPLETED, weekSnapshot: { isNot: null } },
    orderBy: { endAt: "desc" },
    include: {
      season: { select: { name: true } },
      weekSnapshot: {
        select: {
          generatedAt: true,
          checksum: true,
          missionStandings: true,
          rulesSnapshot: true,
        },
      },
    },
  });
  return weeks.flatMap((week) => {
    if (!week.weekSnapshot) return [];
    const standings = snapshotStandings(week.weekSnapshot.missionStandings);
    return [
      {
        id: week.id,
        seasonName: week.season.name,
        weekName: week.name,
        startAt: week.startAt.toISOString(),
        endAt: week.endAt.toISOString(),
        generatedAt: week.weekSnapshot.generatedAt.toISOString(),
        checksum: week.weekSnapshot.checksum,
        standings,
        winner: standings.find((row) => row.rank === 1) ?? standings[0] ?? null,
      },
    ];
  });
}
