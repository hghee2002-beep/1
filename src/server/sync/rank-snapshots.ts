import "server-only";

import {
  RankSnapshotStatus,
  SeasonStatus,
  type SnapshotSource,
} from "@/generated/prisma/client";
import {
  RANK_DISPLAY_ORDINAL_VERSION,
  rankDisplayOrdinal,
  rankObservationStatus,
  type ComparableRankSnapshot,
} from "@/domain/sync/rank-snapshot";
import { rankMainStandings, toSeoulDateOnly } from "@/domain/sync/standings";
import { isRiotApiError } from "@/features/riot/errors";
import {
  RANKED_SOLO_QUEUE,
  type RankedSoloSnapshot,
  type RiotClient,
} from "@/features/riot/types";
import { db } from "@/server/db/client";

function comparable(
  snapshot: {
    tier: string | null;
    rank: string | null;
    leaguePoints: number | null;
    wins: number | null;
    losses: number | null;
    isUnranked: boolean;
  } | null,
): ComparableRankSnapshot {
  if (!snapshot || snapshot.isUnranked) return null;
  if (
    snapshot.tier === null ||
    snapshot.rank === null ||
    snapshot.leaguePoints === null ||
    snapshot.wins === null ||
    snapshot.losses === null
  ) {
    return null;
  }
  return {
    tier: snapshot.tier,
    rank: snapshot.rank,
    leaguePoints: snapshot.leaguePoints,
    wins: snapshot.wins,
    losses: snapshot.losses,
  };
}

export async function captureRankSnapshot(input: {
  participantId: string;
  puuid: string;
  seasonId: string;
  seasonStatus: SeasonStatus;
  weekId: string | null;
  now: Date;
  source: SnapshotSource;
  riotClient: RiotClient;
}) {
  const previous = await db.rankSnapshot.findFirst({
    where: {
      participantId: input.participantId,
      seasonId: input.seasonId,
      status: { not: RankSnapshotStatus.API_ERROR },
    },
    orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
    select: {
      tier: true,
      rank: true,
      leaguePoints: true,
      wins: true,
      losses: true,
      isUnranked: true,
    },
  });

  let current: RankedSoloSnapshot | null;
  try {
    current = await input.riotClient.getSoloQueueSnapshot(input.puuid);
  } catch (error) {
    const errorCode = isRiotApiError(error)
      ? error.code
      : "RIOT_TEMPORARY_FAILURE";
    const retryable = isRiotApiError(error) ? error.retryable : true;
    const retryAfterSeconds = isRiotApiError(error)
      ? error.retryAfterSeconds
      : undefined;
    const snapshot = await db.rankSnapshot.create({
      data: {
        participantId: input.participantId,
        seasonId: input.seasonId,
        weekId: input.weekId,
        capturedAt: input.now,
        queueType: RANKED_SOLO_QUEUE,
        isUnranked: false,
        source: input.source,
        status: RankSnapshotStatus.API_ERROR,
        errorCode,
        raw: { retryable },
      },
      select: { id: true },
    });
    return {
      ok: false as const,
      snapshotId: snapshot.id,
      status: RankSnapshotStatus.API_ERROR,
      errorCode,
      retryable,
      retryAfterSeconds,
    };
  }

  const currentComparable = current
    ? {
        tier: current.tier,
        rank: current.rank,
        leaguePoints: current.leaguePoints,
        wins: current.wins,
        losses: current.losses,
      }
    : null;
  const status =
    RankSnapshotStatus[
      rankObservationStatus({
        current: currentComparable,
        previous: comparable(previous),
        hasPrevious: previous !== null,
      })
    ];
  const snapshot = await db.$transaction(async (transaction) => {
    const created = await transaction.rankSnapshot.create({
      data: {
        participantId: input.participantId,
        seasonId: input.seasonId,
        weekId: input.weekId,
        capturedAt: input.now,
        queueType: RANKED_SOLO_QUEUE,
        tier: current?.tier ?? null,
        rank: current?.rank ?? null,
        leaguePoints: current?.leaguePoints ?? null,
        wins: current?.wins ?? null,
        losses: current?.losses ?? null,
        isUnranked: current === null,
        displayOrdinal: rankDisplayOrdinal(currentComparable),
        source: input.source,
        status,
        raw: {
          ordinalVersion: RANK_DISPLAY_ORDINAL_VERSION,
          hotStreak: current?.hotStreak ?? false,
          veteran: current?.veteran ?? false,
          freshBlood: current?.freshBlood ?? false,
          inactive: current?.inactive ?? false,
        },
      },
      select: { id: true, status: true },
    });
    if (input.seasonStatus === SeasonStatus.SCHEDULED) {
      await transaction.seasonParticipant.updateMany({
        where: {
          seasonId: input.seasonId,
          participantId: input.participantId,
          startingRankSnapshotId: null,
        },
        data: { startingRankSnapshotId: created.id },
      });
    }
    return created;
  });
  return { ok: true as const, snapshotId: snapshot.id, status };
}

export async function refreshDailyStandingSnapshots(input: {
  seasonId: string;
  now: Date;
}) {
  const week = await db.week.findFirst({
    where: {
      seasonId: input.seasonId,
      startAt: { lte: input.now },
      endAt: { gt: input.now },
    },
    select: { id: true },
  });
  if (!week) return 0;

  const participantWeeks = await db.participantWeek.findMany({
    where: { weekId: week.id },
    select: {
      id: true,
      participantId: true,
      mainScoreCached: true,
      wins: true,
      losses: true,
      participant: {
        select: {
          rankSnapshots: {
            where: {
              seasonId: input.seasonId,
              status: { not: RankSnapshotStatus.API_ERROR },
            },
            orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              tier: true,
              rank: true,
              leaguePoints: true,
            },
          },
        },
      },
    },
  });
  const standings = rankMainStandings(
    participantWeeks.map((participantWeek) => ({
      participantWeekId: participantWeek.id,
      mainScore: participantWeek.mainScoreCached,
      wins: participantWeek.wins,
      losses: participantWeek.losses,
    })),
  );
  const rankByParticipantWeek = new Map(
    standings.map((standing) => [standing.participantWeekId, standing.rank]),
  );
  const localDate = toSeoulDateOnly(input.now);

  await db.$transaction(
    participantWeeks.flatMap((participantWeek) => {
      const rank = rankByParticipantWeek.get(participantWeek.id);
      if (rank === undefined) return [];
      const officialRank = participantWeek.participant.rankSnapshots[0];
      return [
        db.participantWeek.update({
          where: { id: participantWeek.id },
          data: { rankCached: rank },
        }),
        db.dailyStandingSnapshot.upsert({
          where: {
            weekId_participantId_localDate: {
              weekId: week.id,
              participantId: participantWeek.participantId,
              localDate,
            },
          },
          update: {
            mainScore: participantWeek.mainScoreCached,
            rank,
            wins: participantWeek.wins,
            losses: participantWeek.losses,
            tier: officialRank?.tier ?? null,
            rankLabel: officialRank?.rank ?? null,
            leaguePoints: officialRank?.leaguePoints ?? null,
          },
          create: {
            weekId: week.id,
            participantId: participantWeek.participantId,
            localDate,
            mainScore: participantWeek.mainScoreCached,
            rank,
            wins: participantWeek.wins,
            losses: participantWeek.losses,
            tier: officialRank?.tier ?? null,
            rankLabel: officialRank?.rank ?? null,
            leaguePoints: officialRank?.leaguePoints ?? null,
          },
        }),
      ];
    }),
  );
  return participantWeeks.length;
}
