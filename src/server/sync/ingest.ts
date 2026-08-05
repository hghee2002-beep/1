import "server-only";

import {
  MatchStatus,
  MissionSourceType,
  SeasonParticipantStatus,
  SeasonStatus,
  WeekStatus,
  type Prisma,
} from "@/generated/prisma/client";
import {
  evaluateMatchEligibility,
  type MatchEligibilityReason,
} from "@/domain/sync/match-eligibility";
import type {
  NormalizedMatch,
  NormalizedParticipant,
} from "@/features/riot/types";
import type { MvpTierBucket } from "@/domain/mvp/contract";
import { SyncServiceError } from "@/features/sync/errors";
import { db } from "@/server/db/client";
import { captureMissionMatchSnapshot } from "@/server/missions/snapshot";

export type SyncSeasonWindow = {
  id: string;
  startAt: Date;
  endAt: Date;
  minGameDurationSeconds: number;
  weeks: readonly { id: string; startAt: Date; endAt: Date }[];
};

export type IngestMatchResult = {
  outcome: "PROCESSED" | "INVALID" | "DUPLICATE" | "OUTSIDE_EVENT";
  reason: MatchEligibilityReason | "NO_TRACKED_PARTICIPANT" | null;
  seasonMatchId: string | null;
  participantMatchCount: number;
  timelineNeeded: boolean;
  matchStartAt: Date;
};

function summaryJson(match: NormalizedMatch): Prisma.InputJsonObject {
  return {
    normalized: true,
    dataVersion: match.dataVersion,
    platformId: match.platformId,
    matchId: match.matchId,
    queueId: match.queueId,
    mapId: match.mapId,
    gameMode: match.gameMode,
    gameType: match.gameType,
    gameVersion: match.gameVersion,
    gameStartAt: match.gameStartAt.toISOString(),
    gameEndAt: match.gameEndAt.toISOString(),
    durationSeconds: match.durationSeconds,
    earlySurrender: match.earlySurrender,
    remake: match.remake,
  };
}

function participantMetrics(
  participant: NormalizedParticipant,
): Prisma.InputJsonObject {
  return {
    championLevel: participant.championLevel,
    cs: participant.cs,
    controlWardsBought: participant.controlWardsBought,
    doubleKills: participant.doubleKills,
    tripleKills: participant.tripleKills,
    quadraKills: participant.quadraKills,
    pentaKills: participant.pentaKills,
    largestKillingSpree: participant.largestKillingSpree,
    firstBloodKill: participant.firstBloodKill,
    firstBloodAssist: participant.firstBloodAssist,
    firstTowerKill: participant.firstTowerKill,
    firstTowerAssist: participant.firstTowerAssist,
    turretKills: participant.turretKills,
    turretAssists: participant.turretAssists,
    inhibitorKills: participant.inhibitorKills,
    inhibitorAssists: participant.inhibitorAssists,
    inhibitorTakedowns: participant.inhibitorTakedowns,
    earlySurrender: participant.earlySurrender,
    surrender: participant.surrender,
  };
}

function participantRawData(
  matchId: string,
  participant: NormalizedParticipant,
  tierSnapshot: {
    startingTier: string | null;
    tierBucket: MvpTierBucket | null;
  } | null,
) {
  return {
    matchId,
    puuid: participant.puuid,
    teamId: participant.teamId,
    participantIndex: participant.participantId,
    position: participant.position,
    startingTier: tierSnapshot?.startingTier ?? null,
    tierBucket: tierSnapshot?.tierBucket ?? null,
    championId: participant.championId,
    championName: participant.championName,
    win: participant.win,
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    totalMinionsKilled: participant.totalMinionsKilled,
    neutralMinionsKilled: participant.neutralMinionsKilled,
    goldEarned: participant.goldEarned,
    damageToChampions: participant.damageToChampions,
    damageTaken: participant.damageTaken,
    damageMitigated: participant.damageMitigated,
    damageToObjectives: participant.damageToObjectives,
    damageToTurrets: participant.damageToTurrets,
    visionScore: participant.visionScore,
    wardsPlaced: participant.wardsPlaced,
    wardsKilled: participant.wardsKilled,
    controlWardsPlaced:
      participant.challenges.controlWardsPlaced ??
      participant.controlWardsBought,
    timeCCingOthers: participant.timeCCingOthers,
    healOnTeammates: participant.healOnTeammates,
    shieldOnTeammates: participant.shieldOnTeammates,
    items: participant.items,
    perks: participant.perkStyles,
    summonerSpells: participant.summonerSpellIds,
    challenges: participant.challenges,
    normalizedMetrics: participantMetrics(participant),
  };
}

function participantEligibleAtMatch(input: {
  joinedAt: Date;
  leftAt: Date | null;
  match: NormalizedMatch;
}) {
  return (
    input.joinedAt.getTime() <= input.match.gameEndAt.getTime() &&
    (input.leftAt === null ||
      input.match.gameStartAt.getTime() < input.leftAt.getTime())
  );
}

export async function ingestNormalizedMatch(input: {
  season: SyncSeasonWindow;
  match: NormalizedMatch;
  now: Date;
  dryRun: boolean;
  tierSnapshots?: ReadonlyMap<
    string,
    { startingTier: string | null; tierBucket: MvpTierBucket | null }
  >;
}): Promise<IngestMatchResult> {
  const eligibility = evaluateMatchEligibility({
    match: input.match,
    season: input.season,
    weeks: input.season.weeks,
  });
  const weekId = eligibility.weekId;
  if (!weekId) {
    return {
      outcome: "OUTSIDE_EVENT",
      reason: eligibility.reason,
      seasonMatchId: null,
      participantMatchCount: 0,
      timelineNeeded: false,
      matchStartAt: input.match.gameStartAt,
    };
  }
  if (input.dryRun) {
    return {
      outcome: eligibility.eligible ? "PROCESSED" : "INVALID",
      reason: eligibility.eligible ? null : eligibility.reason,
      seasonMatchId: null,
      participantMatchCount: input.match.participants.length,
      timelineNeeded: false,
      matchStartAt: input.match.gameStartAt,
    };
  }

  return db.$transaction(async (transaction) => {
    const [competitionScope] = await transaction.$queryRaw<
      readonly {
        seasonStatus: SeasonStatus;
        weekStatus: WeekStatus;
      }[]
    >`
      SELECT
        season_row."status" AS "seasonStatus",
        week_row."status" AS "weekStatus"
      FROM "Season" season_row
      JOIN "Week" week_row ON week_row."seasonId" = season_row."id"
      WHERE season_row."id" = ${input.season.id}::uuid
        AND week_row."id" = ${weekId}::uuid
      FOR SHARE OF season_row
    `;
    if (
      !competitionScope ||
      competitionScope.seasonStatus !== SeasonStatus.ACTIVE ||
      competitionScope.weekStatus !== WeekStatus.ACTIVE
    ) {
      throw new SyncServiceError(
        "SYNC_SEASON_CLOSED",
        "시즌 또는 주차가 종료되어 새 경기 데이터를 반영할 수 없습니다.",
      );
    }

    const duplicate = await transaction.seasonMatch.findFirst({
      where: {
        seasonId: input.season.id,
        match: { riotMatchId: input.match.matchId },
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        outcome: "DUPLICATE" as const,
        reason: null,
        seasonMatchId: duplicate.id,
        participantMatchCount: 0,
        timelineNeeded: false,
        matchStartAt: input.match.gameStartAt,
      };
    }

    const desiredMatchStatus = eligibility.eligible
      ? MatchStatus.PROCESSING
      : MatchStatus.INVALID;
    const match = await transaction.match.upsert({
      where: { riotMatchId: input.match.matchId },
      update: {
        regionalRoute: "ASIA",
        queueId: input.match.queueId,
        mapId: input.match.mapId,
        gameMode: input.match.gameMode,
        gameType: input.match.gameType,
        gameVersion: input.match.gameVersion,
        gameStartAt: input.match.gameStartAt,
        gameEndAt: input.match.gameEndAt,
        durationSeconds: input.match.durationSeconds,
        earlySurrender: input.match.earlySurrender,
        invalidReason: eligibility.eligible ? null : eligibility.reason,
        rawSummary: summaryJson(input.match),
      },
      create: {
        riotMatchId: input.match.matchId,
        regionalRoute: "ASIA",
        queueId: input.match.queueId,
        mapId: input.match.mapId,
        gameMode: input.match.gameMode,
        gameType: input.match.gameType,
        gameVersion: input.match.gameVersion,
        gameStartAt: input.match.gameStartAt,
        gameEndAt: input.match.gameEndAt,
        durationSeconds: input.match.durationSeconds,
        earlySurrender: input.match.earlySurrender,
        status: desiredMatchStatus,
        invalidReason: eligibility.eligible ? null : eligibility.reason,
        rawSummary: summaryJson(input.match),
        ingestedAt: input.now,
      },
      select: { id: true },
    });
    await transaction.match.updateMany({
      where: {
        id: match.id,
        status: {
          in: [MatchStatus.INGESTED, MatchStatus.ERROR, MatchStatus.INVALID],
        },
      },
      data: { status: desiredMatchStatus },
    });

    for (const team of input.match.teams) {
      const data = {
        win: team.win,
        championKills: team.championKills,
        towerKills: team.objectives.tower.kills,
        inhibitorKills: team.objectives.inhibitor.kills,
        dragonKills: team.objectives.dragon.kills,
        baronKills: team.objectives.baron.kills,
        heraldKills: team.objectives.riftHerald.kills,
        objectives: team.objectives,
      };
      await transaction.matchTeam.upsert({
        where: { matchId_teamId: { matchId: match.id, teamId: team.teamId } },
        update: data,
        create: { matchId: match.id, teamId: team.teamId, ...data },
      });
    }

    const rawParticipantByPuuid = new Map<
      string,
      { id: string; participant: NormalizedParticipant }
    >();
    for (const participant of input.match.participants) {
      const data = participantRawData(
        match.id,
        participant,
        input.tierSnapshots?.get(participant.puuid) ?? null,
      );
      const raw = await transaction.matchParticipantRaw.upsert({
        where: {
          matchId_participantIndex: {
            matchId: match.id,
            participantIndex: participant.participantId,
          },
        },
        update: data,
        create: data,
        select: { id: true },
      });
      rawParticipantByPuuid.set(participant.puuid, {
        id: raw.id,
        participant,
      });
    }

    const entries = await transaction.seasonParticipant.findMany({
      where: {
        seasonId: input.season.id,
        status: SeasonParticipantStatus.ACTIVE,
        participant: {
          puuid: { in: [...rawParticipantByPuuid.keys()] },
        },
      },
      select: {
        participantId: true,
        joinedAt: true,
        leftAt: true,
        participant: {
          select: {
            puuid: true,
            participantWeeks: {
              where: { weekId },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });

    const hasTrackedParticipant = entries.some(
      (entry) =>
        entry.participant.participantWeeks.length > 0 &&
        participantEligibleAtMatch({
          joinedAt: entry.joinedAt,
          leftAt: entry.leftAt,
          match: input.match,
        }),
    );
    const seasonEligible = eligibility.eligible && hasTrackedParticipant;
    const seasonReason = seasonEligible
      ? null
      : eligibility.eligible
        ? "NO_TRACKED_PARTICIPANT"
        : eligibility.reason;
    const seasonMatch = await transaction.seasonMatch.create({
      data: {
        seasonId: input.season.id,
        matchId: match.id,
        weekId,
        status: seasonEligible ? MatchStatus.PROCESSING : MatchStatus.INVALID,
        eligibilityReason: seasonReason,
      },
      select: { id: true },
    });

    const participantWeekIds: string[] = [];
    const participantMatchIds: string[] = [];
    let participantMatchCount = 0;
    for (const entry of entries) {
      const raw = rawParticipantByPuuid.get(entry.participant.puuid);
      const participantWeek = entry.participant.participantWeeks[0];
      if (!raw || !participantWeek) continue;
      const membershipEligible = participantEligibleAtMatch({
        joinedAt: entry.joinedAt,
        leftAt: entry.leftAt,
        match: input.match,
      });
      const eligible = eligibility.eligible && membershipEligible;
      const teamKills =
        input.match.teams.find((team) => team.teamId === raw.participant.teamId)
          ?.championKills ?? 0;
      const participantMatch = await transaction.participantMatch.create({
        data: {
          participantId: entry.participantId,
          participantWeekId: participantWeek.id,
          seasonMatchId: seasonMatch.id,
          matchParticipantRawId: raw.id,
          eligible,
          eligibilityReason: eligible
            ? null
            : membershipEligible
              ? eligibility.reason
              : "PARTICIPANT_NOT_ACTIVE_AT_MATCH_END",
          win: raw.participant.win,
          position: raw.participant.position,
          championId: raw.participant.championId,
          championName: raw.participant.championName,
          kills: raw.participant.kills,
          deaths: raw.participant.deaths,
          assists: raw.participant.assists,
          cs: raw.participant.cs,
          kda:
            (raw.participant.kills + raw.participant.assists) /
            Math.max(1, raw.participant.deaths),
          killParticipation:
            teamKills > 0
              ? (raw.participant.kills + raw.participant.assists) / teamKills
              : 0,
        },
        select: { id: true },
      });
      await captureMissionMatchSnapshot({
        transaction,
        participantMatchId: participantMatch.id,
        participantWeekId: participantWeek.id,
        matchStartAt: input.match.gameStartAt,
      });
      participantWeekIds.push(participantWeek.id);
      participantMatchIds.push(participantMatch.id);
      participantMatchCount += 1;
    }

    const timelineNeeded =
      seasonEligible &&
      participantWeekIds.length > 0 &&
      (await transaction.missionMatchSnapshotAssignment.count({
        where: {
          snapshot: { participantMatchId: { in: participantMatchIds } },
          assignment: {
            missionDefinition: {
              sourceType: MissionSourceType.MATCH_TIMELINE,
            },
          },
        },
      })) > 0;

    if (seasonEligible) {
      await transaction.processingOutbox.upsert({
        where: { dedupeKey: `season-match:${seasonMatch.id}:process:v1` },
        update: {},
        create: {
          type: "PROCESS_SEASON_MATCH",
          aggregateId: seasonMatch.id,
          payload: {
            seasonId: input.season.id,
            seasonMatchId: seasonMatch.id,
          },
          availableAt: input.now,
          dedupeKey: `season-match:${seasonMatch.id}:process:v1`,
        },
      });
      await transaction.processingOutbox.upsert({
        where: {
          dedupeKey: `season-match:${seasonMatch.id}:missions-evaluate:v1`,
        },
        update: {},
        create: {
          type: "EVALUATE_MISSIONS",
          aggregateId: seasonMatch.id,
          payload: {
            seasonId: input.season.id,
            seasonMatchId: seasonMatch.id,
          },
          availableAt: input.now,
          dedupeKey: `season-match:${seasonMatch.id}:missions-evaluate:v1`,
        },
      });
      await transaction.processingOutbox.upsert({
        where: { dedupeKey: `season-match:${seasonMatch.id}:mvp-evaluate:v1` },
        update: {},
        create: {
          type: "EVALUATE_MVP_ACE",
          aggregateId: seasonMatch.id,
          payload: {
            seasonId: input.season.id,
            seasonMatchId: seasonMatch.id,
          },
          availableAt: input.now,
          dedupeKey: `season-match:${seasonMatch.id}:mvp-evaluate:v1`,
        },
      });
      if (timelineNeeded) {
        await transaction.processingOutbox.upsert({
          where: { dedupeKey: `season-match:${seasonMatch.id}:timeline:v1` },
          update: {},
          create: {
            type: "FETCH_MATCH_TIMELINE",
            aggregateId: seasonMatch.id,
            payload: {
              seasonId: input.season.id,
              seasonMatchId: seasonMatch.id,
              riotMatchId: input.match.matchId,
            },
            availableAt: input.now,
            dedupeKey: `season-match:${seasonMatch.id}:timeline:v1`,
          },
        });
      }
    }

    return {
      outcome: seasonEligible ? ("PROCESSED" as const) : ("INVALID" as const),
      reason: seasonReason,
      seasonMatchId: seasonMatch.id,
      participantMatchCount,
      timelineNeeded,
      matchStartAt: input.match.gameStartAt,
    };
  });
}
