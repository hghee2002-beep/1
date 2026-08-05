import "server-only";

import {
  Prisma,
  RankSnapshotStatus,
  SeasonStatus,
  SnapshotSource,
  UserStatus,
} from "@/generated/prisma/client";

import { rankDisplayOrdinal } from "@/domain/sync/rank-snapshot";
import { AccountSettingsError } from "@/features/account/errors";
import { hashPassword, verifyPassword } from "@/features/auth/password";
import type { ChangePasswordInput } from "@/features/auth/validation";
import { isRiotApiError } from "@/features/riot/errors";
import {
  RANKED_SOLO_QUEUE,
  type RiotClient,
  type RiotIdentity,
} from "@/features/riot/types";
import { db } from "@/server/db/client";
import { getRiotClient } from "@/server/riot/client";

type RiotIdentityLookup = Pick<RiotClient, "getIdentityByPuuid">;

function normalizedRiotFailure(error: unknown) {
  if (!isRiotApiError(error)) {
    return new AccountSettingsError(
      "RIOT_TEMPORARY_FAILURE",
      "Riot 계정 정보를 갱신하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      true,
    );
  }

  switch (error.code) {
    case "RIOT_ACCOUNT_NOT_FOUND":
    case "RIOT_RESOURCE_NOT_FOUND":
      return new AccountSettingsError(
        "RIOT_ACCOUNT_NOT_FOUND",
        "기존 Riot 계정을 찾을 수 없습니다. 운영자에게 문의해 주세요.",
      );
    case "RIOT_RATE_LIMITED":
      return new AccountSettingsError(
        error.code,
        "Riot API 요청 제한이 해제된 뒤 다시 시도해 주세요.",
        true,
        error.retryAfterSeconds,
      );
    case "RIOT_KEY_INVALID":
    case "RIOT_CONFIGURATION_ERROR":
      return new AccountSettingsError(
        "RIOT_SERVICE_UNAVAILABLE",
        "운영자가 Riot API 연결을 확인하고 있습니다.",
        true,
      );
    default:
      return new AccountSettingsError(
        "RIOT_TEMPORARY_FAILURE",
        "Riot 계정 정보를 갱신하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        true,
        error.retryAfterSeconds,
      );
  }
}

export async function changeOwnPassword(
  input: ChangePasswordInput & {
    userId: string;
    requestId?: string;
  },
  now = new Date(),
) {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      status: true,
      passwordHash: true,
      sessionVersion: true,
    },
  });
  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new AccountSettingsError("AUTH_REQUIRED", "로그인이 필요합니다.");
  }

  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AccountSettingsError(
      "CURRENT_PASSWORD_INVALID",
      "현재 비밀번호가 올바르지 않습니다.",
    );
  }
  if (await verifyPassword(user.passwordHash, input.newPassword)) {
    throw new AccountSettingsError(
      "PASSWORD_REUSE_NOT_ALLOWED",
      "현재 비밀번호와 다른 비밀번호를 사용해 주세요.",
    );
  }

  const passwordHash = await hashPassword(input.newPassword);
  return db.$transaction(async (transaction) => {
    const changed = await transaction.user.updateMany({
      where: {
        id: user.id,
        status: UserStatus.ACTIVE,
        passwordHash: user.passwordHash,
        sessionVersion: user.sessionVersion,
      },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
      },
    });
    if (changed.count !== 1) {
      throw new AccountSettingsError(
        "PASSWORD_CHANGE_CONFLICT",
        "계정 상태가 변경되었습니다. 다시 로그인한 뒤 재시도해 주세요.",
        true,
      );
    }

    const revoked = await transaction.authSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now, revokeReason: "PASSWORD_CHANGED" },
    });
    const nextSessionVersion = user.sessionVersion + 1;
    await transaction.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "USER_PASSWORD_CHANGED",
        targetType: "User",
        targetId: user.id,
        before: { sessionVersion: user.sessionVersion },
        after: {
          sessionVersion: nextSessionVersion,
          revokedSessionCount: revoked.count,
        },
        requestId: input.requestId ?? null,
        createdAt: now,
      },
    });

    return {
      sessionVersion: nextSessionVersion,
      revokedSessionCount: revoked.count,
    };
  });
}

function safeIdentity(identity: {
  gameName: string;
  tagLine: string;
  profileIconId: number | null;
}) {
  return {
    gameName: identity.gameName,
    tagLine: identity.tagLine,
    profileIconId: identity.profileIconId,
  };
}

async function resolveIdentityByPuuid(
  puuid: string,
  riotClient: RiotIdentityLookup,
): Promise<RiotIdentity> {
  try {
    return await riotClient.getIdentityByPuuid(puuid);
  } catch (error) {
    throw normalizedRiotFailure(error);
  }
}

export async function refreshOwnRiotIdentity(
  input: {
    userId: string;
    requestId?: string;
  },
  riotClient: RiotIdentityLookup = getRiotClient(),
  now = new Date(),
) {
  const participant = await db.participant.findUnique({
    where: { userId: input.userId },
    select: {
      id: true,
      userId: true,
      puuid: true,
      status: true,
    },
  });
  if (!participant) {
    throw new AccountSettingsError(
      "PARTICIPANT_REQUIRED",
      "참가 승인 계정에서만 Riot ID를 갱신할 수 있습니다.",
    );
  }
  if (participant.status === "REMOVED") {
    throw new AccountSettingsError(
      "PARTICIPANT_REMOVED",
      "대회 참가에서 제외된 계정은 Riot ID를 갱신할 수 없습니다.",
    );
  }

  // Riot calls must stay outside the database transaction.
  const identity = await resolveIdentityByPuuid(participant.puuid, riotClient);
  if (identity.puuid !== participant.puuid) {
    throw new AccountSettingsError(
      "RIOT_IDENTITY_MISMATCH",
      "기존 Riot 계정과 일치하지 않아 갱신하지 않았습니다.",
    );
  }

  return db.$transaction(
    async (transaction) => {
      await transaction.$queryRaw`
        SELECT id
        FROM "Participant"
        WHERE id = ${participant.id}::uuid
        FOR UPDATE
      `;
      const current = await transaction.participant.findUnique({
        where: { id: participant.id },
        select: {
          id: true,
          userId: true,
          puuid: true,
          status: true,
          gameName: true,
          tagLine: true,
          summonerId: true,
          profileIconId: true,
        },
      });
      if (
        !current ||
        current.userId !== input.userId ||
        current.puuid !== identity.puuid
      ) {
        throw new AccountSettingsError(
          "RIOT_IDENTITY_CONFLICT",
          "참가자 계정 상태가 변경되어 갱신하지 않았습니다.",
          true,
        );
      }
      if (current.status === "REMOVED") {
        throw new AccountSettingsError(
          "PARTICIPANT_REMOVED",
          "대회 참가에서 제외된 계정은 Riot ID를 갱신할 수 없습니다.",
        );
      }

      const displayChanged =
        current.gameName !== identity.gameName ||
        current.tagLine !== identity.tagLine;
      if (displayChanged) {
        await transaction.participantIdentityHistory.updateMany({
          where: { participantId: current.id, validTo: null },
          data: { validTo: now },
        });
        await transaction.participantIdentityHistory.create({
          data: {
            participantId: current.id,
            gameName: identity.gameName,
            tagLine: identity.tagLine,
            validFrom: now,
            source:
              identity.source === "MOCK"
                ? "ACCOUNT_REFRESH_MOCK"
                : "ACCOUNT_REFRESH_RIOT_API",
          },
        });
      }

      await transaction.participant.update({
        where: { id: current.id },
        data: {
          gameName: identity.gameName,
          tagLine: identity.tagLine,
          summonerId: identity.summonerId,
          profileIconId: identity.profileIconId,
          lastIdentitySyncAt: now,
        },
      });

      const seasonEntry = await transaction.seasonParticipant.findFirst({
        where: {
          participantId: current.id,
          status: "ACTIVE",
          season: {
            status: { in: [SeasonStatus.SCHEDULED, SeasonStatus.ACTIVE] },
            endAt: { gt: now },
          },
        },
        orderBy: { season: { startAt: "asc" } },
        select: {
          id: true,
          seasonId: true,
          season: {
            select: {
              status: true,
              weeks: {
                where: { startAt: { lte: now }, endAt: { gt: now } },
                take: 1,
                select: { id: true },
              },
            },
          },
        },
      });
      const rank = identity.soloQueue;
      const rankSnapshot = await transaction.rankSnapshot.create({
        data: {
          participantId: current.id,
          seasonId: seasonEntry?.seasonId ?? null,
          weekId: seasonEntry?.season.weeks[0]?.id ?? null,
          capturedAt: now,
          queueType: RANKED_SOLO_QUEUE,
          tier: rank?.tier ?? null,
          rank: rank?.rank ?? null,
          leaguePoints: rank?.leaguePoints ?? null,
          wins: rank?.wins ?? null,
          losses: rank?.losses ?? null,
          isUnranked: rank === null,
          displayOrdinal: rankDisplayOrdinal(rank),
          source:
            identity.source === "MOCK"
              ? SnapshotSource.MOCK
              : SnapshotSource.RIOT_API,
          status:
            rank === null
              ? RankSnapshotStatus.UNRANKED
              : RankSnapshotStatus.CAPTURED,
          raw: {
            source: "ACCOUNT_REFRESH",
            hotStreak: rank?.hotStreak ?? false,
            veteran: rank?.veteran ?? false,
            freshBlood: rank?.freshBlood ?? false,
            inactive: rank?.inactive ?? false,
          },
        },
        select: { id: true },
      });
      if (seasonEntry?.season.status === SeasonStatus.SCHEDULED) {
        await transaction.seasonParticipant.updateMany({
          where: { id: seasonEntry.id, startingRankSnapshotId: null },
          data: { startingRankSnapshotId: rankSnapshot.id },
        });
      }

      await transaction.auditLog.create({
        data: {
          actorUserId: input.userId,
          action: "PARTICIPANT_RIOT_IDENTITY_REFRESHED",
          targetType: "Participant",
          targetId: current.id,
          before: safeIdentity(current),
          after: {
            ...safeIdentity(identity),
            rankSnapshotId: rankSnapshot.id,
            soloQueue: rank
              ? {
                  tier: rank.tier,
                  rank: rank.rank,
                  leaguePoints: rank.leaguePoints,
                }
              : null,
          },
          requestId: input.requestId ?? null,
          createdAt: now,
        },
      });

      return {
        participantId: current.id,
        identity: {
          gameName: identity.gameName,
          tagLine: identity.tagLine,
          profileIconId: identity.profileIconId,
          soloQueue: rank
            ? {
                tier: rank.tier,
                rank: rank.rank,
                leaguePoints: rank.leaguePoints,
              }
            : null,
        },
        displayChanged,
        refreshedAt: now,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}
