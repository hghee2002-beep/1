import { z } from "zod";

import { RiotApiError } from "@/features/riot/errors";
import {
  RANKED_SOLO_QUEUE,
  type NormalizedMatch,
  type NormalizedObjective,
  type NormalizedParticipant,
  type NormalizedTimeline,
  type RankedSoloSnapshot,
  type RiotPosition,
  type RiotSummoner,
} from "@/features/riot/types";

const nonNegativeInt = z.number().int().nonnegative();
const nullableString = z.string().min(1).optional();

const accountSchema = z
  .object({
    puuid: z.string().min(1),
    gameName: nullableString,
    tagLine: nullableString,
  })
  .passthrough();

const summonerSchema = z
  .object({
    id: z.string().min(1),
    puuid: z.string().min(1),
    profileIconId: nonNegativeInt.optional(),
    summonerLevel: nonNegativeInt.optional(),
  })
  .passthrough();

const leagueEntrySchema = z
  .object({
    queueType: z.string().min(1),
    tier: z.string().min(1),
    rank: z.string().min(1),
    leaguePoints: nonNegativeInt,
    wins: nonNegativeInt.default(0),
    losses: nonNegativeInt.default(0),
    hotStreak: z.boolean().default(false),
    veteran: z.boolean().default(false),
    freshBlood: z.boolean().default(false),
    inactive: z.boolean().default(false),
  })
  .passthrough();

const objectiveSchema = z
  .object({ first: z.boolean(), kills: nonNegativeInt })
  .passthrough();

const teamSchema = z
  .object({
    teamId: z.number().int(),
    win: z.boolean(),
    objectives: z
      .object({
        baron: objectiveSchema,
        champion: objectiveSchema,
        dragon: objectiveSchema,
        inhibitor: objectiveSchema,
        riftHerald: objectiveSchema,
        tower: objectiveSchema,
      })
      .passthrough(),
  })
  .passthrough();

const perkStyleSchema = z
  .object({
    style: z.number().int(),
    selections: z
      .array(z.object({ perk: z.number().int() }).passthrough())
      .default([]),
  })
  .passthrough();

const participantSchema = z
  .object({
    participantId: z.number().int().positive(),
    puuid: z.string().min(1),
    teamId: z.number().int(),
    teamPosition: z.string().optional().default(""),
    championId: nonNegativeInt,
    championName: z.string().min(1),
    champLevel: nonNegativeInt,
    win: z.boolean(),
    kills: nonNegativeInt,
    deaths: nonNegativeInt,
    assists: nonNegativeInt,
    totalMinionsKilled: nonNegativeInt,
    neutralMinionsKilled: nonNegativeInt,
    goldEarned: nonNegativeInt,
    totalDamageDealtToChampions: nonNegativeInt,
    totalDamageTaken: nonNegativeInt,
    damageSelfMitigated: nonNegativeInt,
    damageDealtToObjectives: nonNegativeInt,
    damageDealtToTurrets: nonNegativeInt,
    visionScore: nonNegativeInt,
    wardsPlaced: nonNegativeInt,
    wardsKilled: nonNegativeInt,
    visionWardsBoughtInGame: nonNegativeInt,
    timeCCingOthers: nonNegativeInt,
    totalHealsOnTeammates: nonNegativeInt.default(0),
    totalDamageShieldedOnTeammates: nonNegativeInt.default(0),
    doubleKills: nonNegativeInt.optional(),
    tripleKills: nonNegativeInt.optional(),
    quadraKills: nonNegativeInt.optional(),
    pentaKills: nonNegativeInt.optional(),
    largestKillingSpree: nonNegativeInt.optional(),
    firstBloodKill: z.boolean().optional(),
    firstBloodAssist: z.boolean().optional(),
    firstTowerKill: z.boolean().optional(),
    firstTowerAssist: z.boolean().optional(),
    turretKills: nonNegativeInt.optional(),
    turretAssists: nonNegativeInt.optional(),
    inhibitorKills: nonNegativeInt.optional(),
    inhibitorAssists: nonNegativeInt.optional(),
    inhibitorTakedowns: nonNegativeInt.optional(),
    objectivesStolen: nonNegativeInt.optional(),
    detectorWardsPlaced: nonNegativeInt.optional(),
    longestTimeSpentLiving: nonNegativeInt.optional(),
    item0: nonNegativeInt.default(0),
    item1: nonNegativeInt.default(0),
    item2: nonNegativeInt.default(0),
    item3: nonNegativeInt.default(0),
    item4: nonNegativeInt.default(0),
    item5: nonNegativeInt.default(0),
    item6: nonNegativeInt.default(0),
    perks: z
      .object({ styles: z.array(perkStyleSchema).default([]) })
      .passthrough(),
    summoner1Id: nonNegativeInt,
    summoner2Id: nonNegativeInt,
    gameEndedInEarlySurrender: z.boolean().default(false),
    gameEndedInSurrender: z.boolean().default(false),
    timePlayed: nonNegativeInt.optional(),
    challenges: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const matchSchema = z
  .object({
    metadata: z
      .object({
        dataVersion: z.string().min(1),
        matchId: z.string().min(1),
        participants: z.array(z.string().min(1)),
      })
      .passthrough(),
    info: z
      .object({
        gameDuration: nonNegativeInt,
        gameEndTimestamp: nonNegativeInt.optional(),
        gameMode: z.string().min(1),
        gameStartTimestamp: nonNegativeInt,
        gameType: z.string().min(1),
        gameVersion: z.string().min(1),
        mapId: z.number().int(),
        platformId: z.string().min(1),
        queueId: z.number().int(),
        participants: z.array(participantSchema).min(1),
        teams: z.array(teamSchema).min(1),
      })
      .passthrough(),
  })
  .passthrough();

const timelineParticipantSchema = z
  .object({
    participantId: z.number().int().positive(),
    puuid: z.string().min(1),
  })
  .passthrough();

const participantFrameSchema = z
  .object({
    participantId: z.number().int().positive(),
    level: nonNegativeInt,
    currentGold: nonNegativeInt,
    totalGold: nonNegativeInt,
    minionsKilled: nonNegativeInt,
    jungleMinionsKilled: nonNegativeInt,
    xp: nonNegativeInt,
  })
  .passthrough();

const timelineEventSchema = z
  .object({
    type: z.string().min(1),
    timestamp: nonNegativeInt,
    participantId: z.number().int().positive().optional(),
    creatorId: z.number().int().positive().optional(),
    killerId: z.number().int().nonnegative().optional(),
    victimId: z.number().int().positive().optional(),
    assistingParticipantIds: z.array(z.number().int().positive()).optional(),
    itemId: nonNegativeInt.optional(),
    beforeId: nonNegativeInt.optional(),
    afterId: nonNegativeInt.optional(),
    monsterType: z.string().optional(),
    monsterSubType: z.string().optional(),
  })
  .passthrough();

const timelineFrameSchema = z
  .object({
    timestamp: nonNegativeInt,
    participantFrames: z.record(z.string(), participantFrameSchema),
    events: z.array(timelineEventSchema).default([]),
  })
  .passthrough();

const timelineSchema = z
  .object({
    metadata: z
      .object({
        dataVersion: z.string().min(1),
        matchId: z.string().min(1),
      })
      .passthrough(),
    info: z
      .object({
        frameInterval: nonNegativeInt,
        participants: z.array(timelineParticipantSchema).min(1),
        frames: z.array(timelineFrameSchema).min(1),
      })
      .passthrough(),
  })
  .passthrough();

function malformed(operation: string, cause: unknown): RiotApiError {
  return new RiotApiError(
    "RIOT_MALFORMED_RESPONSE",
    "Riot API 응답 형식이 예상과 다릅니다.",
    true,
    undefined,
    { operation, cause },
  );
}

function parseResponse<T>(
  schema: z.ZodType<T>,
  input: unknown,
  operation: string,
): T {
  const result = schema.safeParse(input);
  if (!result.success) throw malformed(operation, result.error);
  return result.data;
}

export function normalizeAccount(
  input: unknown,
  fallback?: { gameName: string; tagLine: string },
): { puuid: string; gameName: string; tagLine: string } {
  const account = parseResponse(accountSchema, input, "account.resolve");
  const gameName = account.gameName ?? fallback?.gameName;
  const tagLine = account.tagLine ?? fallback?.tagLine;
  if (!gameName || !tagLine) throw malformed("account.resolve", input);
  return { puuid: account.puuid, gameName, tagLine };
}

export function normalizeSummoner(input: unknown): RiotSummoner {
  const summoner = parseResponse(summonerSchema, input, "summoner.by-puuid");
  return {
    id: summoner.id,
    puuid: summoner.puuid,
    profileIconId: summoner.profileIconId ?? null,
    summonerLevel: summoner.summonerLevel ?? null,
  };
}

export function normalizeSoloQueueEntries(
  input: unknown,
): RankedSoloSnapshot | null {
  const entries = parseResponse(
    z.array(leagueEntrySchema),
    input,
    "league.entries-by-puuid",
  );
  const solo = entries.find((entry) => entry.queueType === RANKED_SOLO_QUEUE);
  if (!solo) return null;
  return {
    queueType: RANKED_SOLO_QUEUE,
    tier: solo.tier,
    rank: solo.rank,
    leaguePoints: solo.leaguePoints,
    wins: solo.wins,
    losses: solo.losses,
    hotStreak: solo.hotStreak,
    veteran: solo.veteran,
    freshBlood: solo.freshBlood,
    inactive: solo.inactive,
  };
}

export function normalizeMatchIds(input: unknown): string[] {
  return parseResponse(
    z.array(z.string().min(1)).max(100),
    input,
    "match.ids-by-puuid",
  );
}

function position(value: string): RiotPosition {
  if (
    value === "TOP" ||
    value === "JUNGLE" ||
    value === "MIDDLE" ||
    value === "BOTTOM" ||
    value === "UTILITY"
  ) {
    return value;
  }
  return null;
}

function challengeNumber(
  challenges: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const value = challenges?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function participant(
  raw: z.infer<typeof participantSchema>,
): NormalizedParticipant {
  const itemIds = [
    raw.item0,
    raw.item1,
    raw.item2,
    raw.item3,
    raw.item4,
    raw.item5,
    raw.item6,
  ].filter((itemId) => itemId > 0);
  return {
    participantId: raw.participantId,
    puuid: raw.puuid,
    teamId: raw.teamId,
    position: position(raw.teamPosition),
    championId: raw.championId,
    championName: raw.championName,
    championLevel: raw.champLevel,
    win: raw.win,
    kills: raw.kills,
    deaths: raw.deaths,
    assists: raw.assists,
    totalMinionsKilled: raw.totalMinionsKilled,
    neutralMinionsKilled: raw.neutralMinionsKilled,
    cs: raw.totalMinionsKilled + raw.neutralMinionsKilled,
    goldEarned: raw.goldEarned,
    damageToChampions: raw.totalDamageDealtToChampions,
    damageTaken: raw.totalDamageTaken,
    damageMitigated: raw.damageSelfMitigated,
    damageToObjectives: raw.damageDealtToObjectives,
    damageToTurrets: raw.damageDealtToTurrets,
    visionScore: raw.visionScore,
    wardsPlaced: raw.wardsPlaced,
    wardsKilled: raw.wardsKilled,
    controlWardsBought: raw.visionWardsBoughtInGame,
    timeCCingOthers: raw.timeCCingOthers,
    healOnTeammates: raw.totalHealsOnTeammates,
    shieldOnTeammates: raw.totalDamageShieldedOnTeammates,
    doubleKills: raw.doubleKills ?? null,
    tripleKills: raw.tripleKills ?? null,
    quadraKills: raw.quadraKills ?? null,
    pentaKills: raw.pentaKills ?? null,
    largestKillingSpree: raw.largestKillingSpree ?? null,
    firstBloodKill: raw.firstBloodKill ?? null,
    firstBloodAssist: raw.firstBloodAssist ?? null,
    firstTowerKill: raw.firstTowerKill ?? null,
    firstTowerAssist: raw.firstTowerAssist ?? null,
    turretKills: raw.turretKills ?? null,
    turretAssists: raw.turretAssists ?? null,
    inhibitorKills: raw.inhibitorKills ?? null,
    inhibitorAssists: raw.inhibitorAssists ?? null,
    inhibitorTakedowns: raw.inhibitorTakedowns ?? null,
    items: itemIds,
    perkStyles: raw.perks.styles.map((style) => ({
      styleId: style.style,
      selections: style.selections.map((selection) => selection.perk),
    })),
    summonerSpellIds: [raw.summoner1Id, raw.summoner2Id],
    earlySurrender: raw.gameEndedInEarlySurrender,
    surrender: raw.gameEndedInSurrender,
    challenges: {
      soloKills: challengeNumber(raw.challenges, "soloKills"),
      turretTakedowns: challengeNumber(raw.challenges, "turretTakedowns"),
      inhibitorTakedowns: challengeNumber(raw.challenges, "inhibitorTakedowns"),
      objectivesStolen:
        raw.objectivesStolen ??
        challengeNumber(raw.challenges, "objectivesStolen"),
      controlWardsPlaced:
        raw.detectorWardsPlaced ??
        challengeNumber(raw.challenges, "controlWardsPlaced"),
      longestTimeSpentLiving:
        raw.longestTimeSpentLiving ??
        challengeNumber(raw.challenges, "longestTimeSpentLiving"),
    },
  };
}

function objective(raw: z.infer<typeof objectiveSchema>): NormalizedObjective {
  return { first: raw.first, kills: raw.kills };
}

export function normalizeMatch(input: unknown): NormalizedMatch {
  const match = parseResponse(matchSchema, input, "match.by-id");
  const participants = match.info.participants.map(participant);
  const durationFromParticipants = Math.max(
    0,
    ...match.info.participants.map((entry) => entry.timePlayed ?? 0),
  );
  const legacyDuration = match.info.gameEndTimestamp
    ? match.info.gameDuration
    : Math.floor(match.info.gameDuration / 1_000);
  const durationSeconds = durationFromParticipants || legacyDuration;
  const gameStartAt = new Date(match.info.gameStartTimestamp);
  if (Number.isNaN(gameStartAt.getTime())) {
    throw malformed("match.by-id", input);
  }
  const gameEndAt = new Date(gameStartAt.getTime() + durationSeconds * 1_000);
  const earlySurrender = participants.some((entry) => entry.earlySurrender);

  return {
    matchId: match.metadata.matchId,
    dataVersion: match.metadata.dataVersion,
    platformId: match.info.platformId,
    queueId: match.info.queueId,
    mapId: match.info.mapId,
    gameMode: match.info.gameMode,
    gameType: match.info.gameType,
    gameVersion: match.info.gameVersion,
    gameStartAt,
    gameEndAt,
    durationSeconds,
    earlySurrender,
    remake: durationSeconds < 600,
    participants,
    teams: match.info.teams.map((raw) => ({
      teamId: raw.teamId,
      win: raw.win,
      championKills: raw.objectives.champion.kills,
      objectives: {
        baron: objective(raw.objectives.baron),
        champion: objective(raw.objectives.champion),
        dragon: objective(raw.objectives.dragon),
        inhibitor: objective(raw.objectives.inhibitor),
        riftHerald: objective(raw.objectives.riftHerald),
        tower: objective(raw.objectives.tower),
      },
    })),
  };
}

export function normalizeTimeline(input: unknown): NormalizedTimeline {
  const timeline = parseResponse(timelineSchema, input, "match.timeline");
  const participantPuuids = Object.fromEntries(
    timeline.info.participants.map((entry) => [
      String(entry.participantId),
      entry.puuid,
    ]),
  );
  return {
    matchId: timeline.metadata.matchId,
    dataVersion: timeline.metadata.dataVersion,
    frameIntervalMs: timeline.info.frameInterval,
    participantPuuids,
    frames: timeline.info.frames
      .map((frame) => ({
        timestampMs: frame.timestamp,
        participantFrames: Object.fromEntries(
          Object.entries(frame.participantFrames).map(([key, value]) => [
            key,
            {
              participantId: value.participantId,
              timestampMs: frame.timestamp,
              level: value.level,
              currentGold: value.currentGold,
              totalGold: value.totalGold,
              minionsKilled: value.minionsKilled,
              jungleMinionsKilled: value.jungleMinionsKilled,
              xp: value.xp,
            },
          ]),
        ),
        events: frame.events
          .map((event) => ({
            type: event.type,
            timestampMs: event.timestamp,
            participantId: event.participantId ?? null,
            creatorId: event.creatorId ?? null,
            killerId: event.killerId ?? null,
            victimId: event.victimId ?? null,
            assistingParticipantIds: event.assistingParticipantIds ?? [],
            itemId: event.itemId ?? null,
            beforeId: event.beforeId ?? null,
            afterId: event.afterId ?? null,
            monsterType: event.monsterType ?? null,
            monsterSubType: event.monsterSubType ?? null,
          }))
          .sort((left, right) => left.timestampMs - right.timestampMs),
      }))
      .sort((left, right) => left.timestampMs - right.timestampMs),
  };
}
