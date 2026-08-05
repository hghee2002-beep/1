import "server-only";

import {
  MvpAward,
  MvpEvaluationStatus,
  OutboxStatus,
  type Prisma,
} from "@/generated/prisma/client";
import { isMvpSnapshotBaselineStatus } from "@/domain/mvp/contract";
import {
  missionEvaluatorRegistry,
  type MissionEvaluation,
  type MissionEvaluationContext,
  type MissionTimelineFrame,
  type MissionTimelineEvent,
} from "@/domain/missions/evaluator";
import {
  buildMissionStaticData,
  missingMissionStaticData,
  type MissionStaticData,
} from "@/domain/missions/static-data";
import { RANKED_SOLO_QUEUE_ID } from "@/domain/sync/match-eligibility";
import type {
  NormalizedTimeline,
  NormalizedTimelineEvent,
  RiotClient,
} from "@/features/riot/types";
import { db } from "@/server/db/client";
import { recordMissionEvaluation } from "@/server/missions/service";
import { getRiotClient } from "@/server/riot/client";

const PENDING_RETRY_DELAY_MS = 5 * 60_000;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function jsonNumber(value: unknown, key: string) {
  const candidate = asRecord(value)?.[key];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

function jsonBoolean(value: unknown, key: string) {
  const candidate = asRecord(value)?.[key];
  return typeof candidate === "boolean" ? candidate : null;
}

function jsonNumberArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (candidate): candidate is number =>
      typeof candidate === "number" && Number.isFinite(candidate),
  );
}

function primaryRuneStyleId(value: unknown) {
  if (Array.isArray(value)) {
    const first = asRecord(value[0]);
    const styleId = first?.styleId;
    return typeof styleId === "number" && Number.isFinite(styleId)
      ? styleId
      : null;
  }
  return jsonNumber(value, "primaryStyle");
}

function summonerSpellIds(value: unknown) {
  const array = jsonNumberArray(value);
  if (array.length > 0) return array;
  const first = jsonNumber(value, "spell1");
  const second = jsonNumber(value, "spell2");
  return [first, second].filter(
    (candidate): candidate is number => candidate !== null,
  );
}

function timelineEventJson(
  event: NormalizedTimelineEvent,
): Prisma.InputJsonObject {
  return {
    type: event.type,
    timestampMs: event.timestampMs,
    participantId: event.participantId,
    creatorId: event.creatorId,
    killerId: event.killerId,
    victimId: event.victimId,
    assistingParticipantIds: [...event.assistingParticipantIds],
    itemId: event.itemId,
    beforeId: event.beforeId,
    afterId: event.afterId,
    monsterType: event.monsterType,
    monsterSubType: event.monsterSubType,
  };
}

function timelineJson(timeline: NormalizedTimeline): Prisma.InputJsonObject {
  return {
    normalized: true,
    matchId: timeline.matchId,
    dataVersion: timeline.dataVersion,
    frameIntervalMs: timeline.frameIntervalMs,
    participantPuuids: { ...timeline.participantPuuids },
    frames: timeline.frames.map((frame) => ({
      timestampMs: frame.timestampMs,
      participantFrames: Object.fromEntries(
        Object.entries(frame.participantFrames).map(([key, value]) => [
          key,
          {
            participantId: value.participantId,
            timestampMs: value.timestampMs,
            level: value.level,
            currentGold: value.currentGold,
            totalGold: value.totalGold,
            minionsKilled: value.minionsKilled,
            jungleMinionsKilled: value.jungleMinionsKilled,
            xp: value.xp,
          },
        ]),
      ),
      events: frame.events.map(timelineEventJson),
    })),
  };
}

function timelineEvents(rawTimeline: unknown): MissionTimelineEvent[] {
  const frames = asRecord(rawTimeline)?.frames;
  if (!Array.isArray(frames)) return [];
  const events: MissionTimelineEvent[] = [];
  for (const frame of frames) {
    const candidates = asRecord(frame)?.events;
    if (!Array.isArray(candidates)) continue;
    for (const candidate of candidates) {
      const event = asRecord(candidate);
      if (!event || typeof event.type !== "string") continue;
      const timestampMs =
        typeof event.timestampMs === "number" &&
        Number.isFinite(event.timestampMs)
          ? event.timestampMs
          : null;
      if (timestampMs === null) continue;
      events.push({
        type: event.type,
        timestampMs,
        participantId:
          typeof event.participantId === "number" ? event.participantId : null,
        creatorId: typeof event.creatorId === "number" ? event.creatorId : null,
        killerId: typeof event.killerId === "number" ? event.killerId : null,
        victimId: typeof event.victimId === "number" ? event.victimId : null,
        assistingParticipantIds: Array.isArray(event.assistingParticipantIds)
          ? event.assistingParticipantIds.filter(
              (value): value is number => typeof value === "number",
            )
          : [],
        monsterType:
          typeof event.monsterType === "string" ? event.monsterType : null,
        monsterSubType:
          typeof event.monsterSubType === "string"
            ? event.monsterSubType
            : null,
        itemId: typeof event.itemId === "number" ? event.itemId : null,
        beforeId: typeof event.beforeId === "number" ? event.beforeId : null,
        afterId: typeof event.afterId === "number" ? event.afterId : null,
      });
    }
  }
  return events.sort((left, right) => left.timestampMs - right.timestampMs);
}

function timelineFrames(rawTimeline: unknown): MissionTimelineFrame[] {
  const frames = asRecord(rawTimeline)?.frames;
  if (!Array.isArray(frames)) return [];
  const normalized: MissionTimelineFrame[] = [];
  for (const candidate of frames) {
    const frame = asRecord(candidate);
    const timestampMs = frame?.timestampMs;
    const participantFrames = asRecord(frame?.participantFrames);
    if (
      typeof timestampMs !== "number" ||
      !Number.isFinite(timestampMs) ||
      !participantFrames
    ) {
      continue;
    }
    const entries = Object.entries(participantFrames).flatMap(
      ([key, value]) => {
        const participantFrame = asRecord(value);
        const participantId = participantFrame?.participantId;
        const minionsKilled = participantFrame?.minionsKilled;
        const jungleMinionsKilled = participantFrame?.jungleMinionsKilled;
        if (
          typeof participantId !== "number" ||
          typeof minionsKilled !== "number" ||
          typeof jungleMinionsKilled !== "number"
        ) {
          return [];
        }
        return [
          [
            key,
            {
              participantId,
              timestampMs,
              minionsKilled,
              jungleMinionsKilled,
            },
          ] as const,
        ];
      },
    );
    normalized.push({
      timestampMs,
      participantFrames: Object.fromEntries(entries),
    });
  }
  return normalized.sort((left, right) => left.timestampMs - right.timestampMs);
}

function unavailableEvaluation(input: {
  evaluatorVersion: string;
  target: number;
  unit: string;
  evaluatorKey: string;
}): MissionEvaluation {
  return {
    status: "PENDING_DATA",
    currentValue: 0,
    targetValue: input.target,
    progressValue: 0,
    progressMode: "MAX",
    unit: input.unit,
    reason: "EVALUATOR_NOT_IMPLEMENTED",
    evidence: { evaluatorKey: input.evaluatorKey },
    evaluatorVersion: input.evaluatorVersion,
  };
}

type LoadedSeasonMatch = NonNullable<
  Awaited<ReturnType<typeof loadSeasonMatch>>
>;
type LoadedParticipantMatch = LoadedSeasonMatch["participantMatches"][number];
type LoadedSnapshotAssignment = NonNullable<
  LoadedParticipantMatch["missionMatchSnapshot"]
>["assignments"][number];

function buildContext(input: {
  seasonMatch: LoadedSeasonMatch;
  participantMatch: LoadedParticipantMatch;
  assignment: LoadedSnapshotAssignment;
  staticData: MissionStaticData;
  winStreak?: MissionEvaluationContext["aggregate"]["winStreak"];
}): MissionEvaluationContext {
  const seasonMatch = input.seasonMatch;
  if (!seasonMatch) throw new Error("MISSION_SEASON_MATCH_NOT_FOUND");
  const raw = input.participantMatch.matchParticipantRaw;
  const metrics = raw.normalizedMetrics;
  const challenges = raw.challenges;
  const team = seasonMatch.match.teams.find(
    (candidate) => candidate.teamId === raw.teamId,
  );
  const storedTimeline = seasonMatch.match.rawTimeline;
  const latestMvpEvaluation = input.participantMatch.mvpEvaluations[0];
  const mvpAceAward: MissionEvaluationContext["internal"]["mvpAceAward"] =
    !latestMvpEvaluation
      ? "PENDING"
      : latestMvpEvaluation.status !== MvpEvaluationStatus.COMPLETED
        ? "PENDING"
        : !isMvpSnapshotBaselineStatus(
              latestMvpEvaluation.baselineVersion?.status,
            ) || latestMvpEvaluation.baselineVersion.demoOnly
          ? "DEMO_EXCLUDED"
          : latestMvpEvaluation.award === MvpAward.MVP
            ? "MVP"
            : latestMvpEvaluation.award === MvpAward.ACE
              ? "ACE"
              : "NONE";
  return {
    match: {
      eligible: input.participantMatch.eligible,
      queueId: seasonMatch.match.queueId,
      requiredQueueId: RANKED_SOLO_QUEUE_ID,
      durationSeconds: seasonMatch.match.durationSeconds,
      minimumDurationSeconds: seasonMatch.season.minGameDurationSeconds,
      startedAt: seasonMatch.match.gameStartAt,
    },
    participant: {
      participantId: raw.participantIndex,
      teamId: raw.teamId,
      position: raw.position,
      primaryPosition: input.participantMatch.participant.primaryPosition,
      championId: raw.championId,
      itemIds: jsonNumberArray(raw.items),
      primaryRuneStyleId: primaryRuneStyleId(raw.perks),
      summonerSpellIds: summonerSpellIds(raw.summonerSpells),
      win: input.participantMatch.win,
      kills: raw.kills,
      deaths: raw.deaths,
      assists: raw.assists,
      totalMinionsKilled: raw.totalMinionsKilled,
      neutralMinionsKilled: raw.neutralMinionsKilled,
      goldEarned: raw.goldEarned,
      damageToChampions: raw.damageToChampions,
      damageTaken: raw.damageTaken,
      damageMitigated: raw.damageMitigated,
      damageToObjectives: raw.damageToObjectives,
      damageToTurrets: raw.damageToTurrets,
      visionScore: raw.visionScore,
      wardsKilled: raw.wardsKilled,
      controlWardsBought: jsonNumber(metrics, "controlWardsBought"),
      timeCCingOthers: raw.timeCCingOthers,
      healOnTeammates: raw.healOnTeammates,
      shieldOnTeammates: raw.shieldOnTeammates,
      championLevel: jsonNumber(metrics, "championLevel"),
      doubleKills: jsonNumber(metrics, "doubleKills"),
      tripleKills: jsonNumber(metrics, "tripleKills"),
      quadraKills: jsonNumber(metrics, "quadraKills"),
      pentaKills: jsonNumber(metrics, "pentaKills"),
      largestKillingSpree: jsonNumber(metrics, "largestKillingSpree"),
      firstBloodKill: jsonBoolean(metrics, "firstBloodKill"),
      firstBloodAssist: jsonBoolean(metrics, "firstBloodAssist"),
      firstTowerKill: jsonBoolean(metrics, "firstTowerKill"),
      firstTowerAssist: jsonBoolean(metrics, "firstTowerAssist"),
      turretKills: jsonNumber(metrics, "turretKills"),
      turretAssists: jsonNumber(metrics, "turretAssists"),
      inhibitorKills: jsonNumber(metrics, "inhibitorKills"),
      inhibitorAssists: jsonNumber(metrics, "inhibitorAssists"),
      inhibitorTakedowns: jsonNumber(metrics, "inhibitorTakedowns"),
      challenges: {
        soloKills: jsonNumber(challenges, "soloKills"),
        turretTakedowns: jsonNumber(challenges, "turretTakedowns"),
        inhibitorTakedowns: jsonNumber(challenges, "inhibitorTakedowns"),
        objectivesStolen: jsonNumber(challenges, "objectivesStolen"),
        longestTimeSpentLiving: jsonNumber(
          challenges,
          "longestTimeSpentLiving",
        ),
      },
    },
    team: team
      ? {
          teamId: team.teamId,
          championKills: team.championKills,
          dragonKills: team.dragonKills,
          baronKills: team.baronKills,
        }
      : null,
    timeline: {
      status: storedTimeline ? "AVAILABLE" : "MISSING",
      events: timelineEvents(storedTimeline),
      frames: timelineFrames(storedTimeline),
    },
    staticData: input.staticData,
    internal: { mvpAceAward },
    assignment: {
      activeFrom: input.assignment.assignment.activeFrom,
    },
    aggregate: {
      currentProgress: Number(input.assignment.assignment.progress),
      ...(input.winStreak ? { winStreak: input.winStreak } : {}),
    },
    evaluatorVersion: input.assignment.evaluatorVersion,
  };
}

async function loadCanonicalWinStreak(input: {
  participantWeekId: string;
  activeFrom: Date;
  target: number;
}): Promise<NonNullable<MissionEvaluationContext["aggregate"]["winStreak"]>> {
  const participantMatches = await db.participantMatch.findMany({
    where: {
      participantWeekId: input.participantWeekId,
      eligible: true,
      seasonMatch: { match: { gameStartAt: { gte: input.activeFrom } } },
    },
    select: {
      id: true,
      win: true,
      seasonMatch: { select: { match: { select: { gameStartAt: true } } } },
    },
  });
  participantMatches.sort(
    (left, right) =>
      left.seasonMatch.match.gameStartAt.getTime() -
        right.seasonMatch.match.gameStartAt.getTime() ||
      left.id.localeCompare(right.id),
  );
  let current = 0;
  let maximum = 0;
  let completionParticipantMatchId: string | null = null;
  for (const participantMatch of participantMatches) {
    current = participantMatch.win ? current + 1 : 0;
    maximum = Math.max(maximum, current);
    if (completionParticipantMatchId === null && current >= input.target) {
      completionParticipantMatchId = participantMatch.id;
    }
  }
  return { current, maximum, completionParticipantMatchId };
}

function loadSeasonMatch(seasonMatchId: string) {
  return db.seasonMatch.findUnique({
    where: { id: seasonMatchId },
    include: {
      season: { select: { minGameDurationSeconds: true } },
      match: { include: { teams: true } },
      participantMatches: {
        include: {
          participant: { select: { primaryPosition: true } },
          matchParticipantRaw: true,
          mvpEvaluations: {
            include: {
              baselineVersion: { select: { status: true, demoOnly: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          missionMatchSnapshot: {
            include: {
              assignments: {
                include: {
                  assignment: { include: { missionDefinition: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function fetchMissionTimeline(input: {
  seasonMatchId: string;
  riotClient?: RiotClient;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const target = await db.seasonMatch.findUnique({
    where: { id: input.seasonMatchId },
    select: {
      id: true,
      matchId: true,
      match: {
        select: { riotMatchId: true, rawTimeline: true },
      },
    },
  });
  if (!target) throw new Error("MISSION_SEASON_MATCH_NOT_FOUND");
  if (target.match.rawTimeline) {
    await db.processingOutbox.updateMany({
      where: {
        dedupeKey: `season-match:${target.id}:timeline:v1`,
        status: { not: OutboxStatus.PROCESSED },
      },
      data: {
        status: OutboxStatus.PROCESSED,
        processedAt: now,
        lockedAt: null,
        lastError: null,
      },
    });
    return { fetched: false };
  }

  const timeline = await (input.riotClient ?? getRiotClient()).getTimeline(
    target.match.riotMatchId,
  );
  await db.$transaction(async (transaction) => {
    await transaction.match.update({
      where: { id: target.matchId },
      data: {
        rawTimeline: timelineJson(timeline),
        timelineFetchedAt: now,
      },
    });
    await transaction.processingOutbox.updateMany({
      where: {
        dedupeKey: `season-match:${target.id}:timeline:v1`,
        status: { not: OutboxStatus.PROCESSED },
      },
      data: {
        status: OutboxStatus.PROCESSED,
        processedAt: now,
        lockedAt: null,
        lastError: null,
      },
    });
  });
  return { fetched: true };
}

export async function evaluateSeasonMatchMissions(
  seasonMatchId: string,
  now = new Date(),
  riotClient?: RiotClient,
) {
  const seasonMatch = await loadSeasonMatch(seasonMatchId);
  if (!seasonMatch) throw new Error("MISSION_SEASON_MATCH_NOT_FOUND");
  const evaluatorKeys = seasonMatch.participantMatches.flatMap(
    (participantMatch) =>
      participantMatch.missionMatchSnapshot?.assignments.map(
        (entry) => entry.assignment.missionDefinition.evaluatorKey,
      ) ?? [],
  );
  const needsStaticData = evaluatorKeys.some(
    (key) =>
      key === "timeline.controlWardPurchaseBefore" ||
      key === "build.doranStart" ||
      key === "build.supportStart" ||
      key === "build.noPotionPurchase" ||
      key === "build.winWithoutBoots" ||
      key === "build.completedItemsAtLeast" ||
      key === "build.startPurchaseCostAtMost" ||
      key === "champion.winWithTag",
  );
  let staticData = missingMissionStaticData;
  if (needsStaticData) {
    try {
      const snapshot = await (riotClient ?? getRiotClient()).getStaticData(
        seasonMatch.match.gameVersion,
      );
      staticData = buildMissionStaticData({
        version: snapshot.version,
        items: snapshot.items.values(),
        champions: snapshot.champions.values(),
      });
    } catch {
      staticData = missingMissionStaticData;
    }
  }
  const totals = {
    participantMatches: seasonMatch.participantMatches.length,
    evaluated: 0,
    completed: 0,
    pending: 0,
    duplicates: 0,
  };
  const winStreaks = new Map<
    string,
    Promise<NonNullable<MissionEvaluationContext["aggregate"]["winStreak"]>>
  >();

  for (const participantMatch of seasonMatch.participantMatches) {
    const snapshot = participantMatch.missionMatchSnapshot;
    if (!snapshot) continue;
    for (const snapshotAssignment of snapshot.assignments) {
      const definition = snapshotAssignment.assignment.missionDefinition;
      const evaluator = missionEvaluatorRegistry.get(definition.evaluatorKey);
      let winStreak:
        MissionEvaluationContext["aggregate"]["winStreak"] | undefined;
      if (definition.evaluatorKey === "cumulative.winStreak") {
        const key = `${snapshotAssignment.assignment.participantWeekId}:${snapshotAssignment.assignment.activeFrom.toISOString()}:${snapshotAssignment.assignment.target.toString()}`;
        let pending = winStreaks.get(key);
        if (!pending) {
          pending = loadCanonicalWinStreak({
            participantWeekId: snapshotAssignment.assignment.participantWeekId,
            activeFrom: snapshotAssignment.assignment.activeFrom,
            target: Number(snapshotAssignment.assignment.target),
          });
          winStreaks.set(key, pending);
        }
        winStreak = await pending;
      }
      const evaluation = evaluator
        ? evaluator.evaluate(
            buildContext({
              seasonMatch,
              participantMatch,
              assignment: snapshotAssignment,
              staticData,
              winStreak,
            }),
            definition.evaluatorConfig,
          )
        : unavailableEvaluation({
            evaluatorVersion: snapshotAssignment.evaluatorVersion,
            target: Number(snapshotAssignment.assignment.target),
            unit: snapshotAssignment.assignment.unit ?? "count",
            evaluatorKey: definition.evaluatorKey,
          });
      const recorded = await recordMissionEvaluation({
        assignmentId: snapshotAssignment.assignmentId,
        participantMatchId: participantMatch.id,
        evaluation,
        now,
      });
      totals.evaluated += 1;
      if (recorded.completed) totals.completed += 1;
      if (recorded.pending) totals.pending += 1;
      if (!recorded.recorded && !recorded.pending) totals.duplicates += 1;
    }
  }

  if (totals.pending === 0) {
    await db.processingOutbox.updateMany({
      where: {
        dedupeKey: `season-match:${seasonMatch.id}:missions-evaluate:v1`,
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
        dedupeKey: `season-match:${seasonMatch.id}:missions-evaluate:v1`,
        status: { not: OutboxStatus.PROCESSED },
      },
      data: {
        status: OutboxStatus.PENDING,
        availableAt: new Date(now.getTime() + PENDING_RETRY_DELAY_MS),
        lockedAt: null,
        lastError: "MISSION_DATA_PENDING",
      },
    });
  }
  return totals;
}

export async function backfillMissionEvaluations(input: {
  seasonId?: string;
  limit?: number;
  riotClient?: RiotClient;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const outbox = await db.processingOutbox.findMany({
    where: {
      type: "EVALUATE_MISSIONS",
      status: { in: [OutboxStatus.PENDING, OutboxStatus.FAILED] },
      availableAt: { lte: now },
      ...(input.seasonId
        ? { aggregateId: { in: await seasonMatchIds(input.seasonId) } }
        : {}),
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
      const timelineOutbox = await db.processingOutbox.findUnique({
        where: {
          dedupeKey: `season-match:${item.aggregateId}:timeline:v1`,
        },
        select: { status: true },
      });
      if (timelineOutbox && timelineOutbox.status !== OutboxStatus.PROCESSED) {
        await fetchMissionTimeline({
          seasonMatchId: item.aggregateId,
          now,
          ...(input.riotClient ? { riotClient: input.riotClient } : {}),
        });
      }
      const evaluation = await evaluateSeasonMatchMissions(
        item.aggregateId,
        now,
        input.riotClient,
      );
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
          lockedAt: null,
          lastError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "MISSION_EVALUATION_FAILED",
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
