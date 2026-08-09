import "server-only";

import {
  ApplicationStatus,
  Prisma,
  SeasonStatus,
  SnapshotSource,
  VerificationStatus,
  type Position,
  type PrismaClient,
} from "@/generated/prisma/client";

import { ApplicationServiceError } from "@/features/applications/errors";
import type {
  ReviewApplicationInput,
  SubmitApplicationInput,
} from "@/features/applications/validation";
import {
  normalizedRiotId,
  parseRiotIdParts,
  RiotIdentityError,
  type ResolvedRiotIdentity,
  type RiotIdentityResolver,
} from "@/features/riot/identity";
import { serverEnv } from "@/lib/env/server";
import { db } from "@/server/db/client";
import { getRiotIdentityResolver } from "@/server/riot/identity-resolver";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

function toApplicationError(error: RiotIdentityError) {
  const code = (() => {
    switch (error.code) {
      case "RIOT_ID_INVALID":
      case "RIOT_ACCOUNT_NOT_FOUND":
      case "RIOT_KEY_INVALID":
      case "RIOT_RATE_LIMITED":
      case "RIOT_TEMPORARY_FAILURE":
        return error.code;
      case "RIOT_RESOURCE_NOT_FOUND":
        return "RIOT_ACCOUNT_NOT_FOUND";
      case "RIOT_CONFIGURATION_ERROR":
        return "RIOT_KEY_INVALID";
      case "RIOT_NETWORK_FAILURE":
      case "RIOT_TIMEOUT":
      case "RIOT_MALFORMED_RESPONSE":
      case "RIOT_TIMELINE_UNAVAILABLE":
      case "RIOT_STATIC_DATA_UNAVAILABLE":
        return "RIOT_TEMPORARY_FAILURE";
    }
  })();
  return new ApplicationServiceError(
    code,
    error.message,
    error.retryable,
    error.retryAfterSeconds,
  );
}

function isPrismaError(error: unknown, code: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

async function assertUserCanApply(client: DatabaseClient, userId: string) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      participant: { select: { id: true } },
      applications: {
        where: { status: ApplicationStatus.PENDING },
        take: 1,
        select: { id: true },
      },
    },
  });

  if (!user) {
    throw new ApplicationServiceError(
      "APPLICATION_NOT_FOUND",
      "사용자 계정을 찾을 수 없습니다.",
    );
  }
  if (user.participant) {
    throw new ApplicationServiceError(
      "APPLICATION_ALREADY_APPROVED",
      "이미 참가 승인이 완료된 계정입니다. Riot ID 변경은 갱신 절차를 이용해 주세요.",
    );
  }
  if (user.applications.length > 0) {
    throw new ApplicationServiceError(
      "APPLICATION_PENDING_EXISTS",
      "이미 검토 중인 참가 신청이 있습니다.",
    );
  }
}

async function resolveIdentity(
  input: { gameName: string; tagLine: string },
  resolver: RiotIdentityResolver,
) {
  try {
    const parsed = parseRiotIdParts(input);
    return await resolver.resolve(parsed);
  } catch (error) {
    if (error instanceof RiotIdentityError) throw toApplicationError(error);
    throw error;
  }
}

async function assertPuuidAvailable(
  client: DatabaseClient,
  puuid: string,
  userId: string,
) {
  const participant = await client.participant.findUnique({
    where: { puuid },
    select: { userId: true },
  });
  if (participant && participant.userId !== userId) {
    throw new ApplicationServiceError(
      "DUPLICATE_RIOT_ACCOUNT",
      "이미 다른 사이트 계정에 승인된 Riot 계정입니다.",
    );
  }
  if (participant) {
    throw new ApplicationServiceError(
      "APPLICATION_ALREADY_APPROVED",
      "이미 참가 승인이 완료된 Riot 계정입니다.",
    );
  }
}

export async function verifyRiotIdentityForApplication(
  input: { userId: string; gameName: string; tagLine: string },
  resolver = getRiotIdentityResolver(),
) {
  await assertUserCanApply(db, input.userId);
  const account = await resolveIdentity(input, resolver);
  await assertPuuidAvailable(db, account.puuid, input.userId);

  return {
    gameName: account.gameName,
    tagLine: account.tagLine,
    profileIconId: account.profileIconId,
    summonerLevel: account.summonerLevel,
    soloQueue: account.soloQueue,
    source: account.source,
  };
}

export async function submitParticipationApplication(
  input: SubmitApplicationInput & { userId: string; requestId?: string },
  resolver = getRiotIdentityResolver(),
  now = new Date(),
) {
  await assertUserCanApply(db, input.userId);
  const account = await resolveIdentity(input, resolver);
  await assertPuuidAvailable(db, account.puuid, input.userId);

  try {
    return await db.$transaction(async (transaction) => {
      await assertUserCanApply(transaction, input.userId);
      await assertPuuidAvailable(transaction, account.puuid, input.userId);

      const application = await transaction.participationApplication.create({
        data: {
          userId: input.userId,
          gameName: account.gameName,
          tagLine: account.tagLine,
          riotIdNormalized: normalizedRiotId(account.gameName, account.tagLine),
          puuid: account.puuid,
          summonerId: account.summonerId,
          profileIconId: account.profileIconId,
          soloTier: account.soloQueue?.tier ?? null,
          soloRank: account.soloQueue?.rank ?? null,
          soloLeaguePoints: account.soloQueue?.leaguePoints ?? null,
          primaryPosition:
            (input.primaryPosition as Position | undefined) ?? null,
          secondaryPosition:
            (input.secondaryPosition as Position | undefined) ?? null,
          status: ApplicationStatus.PENDING,
          verificationStatus: VerificationStatus.VERIFIED,
          submittedAt: now,
        },
        select: {
          id: true,
          status: true,
          gameName: true,
          tagLine: true,
          submittedAt: true,
        },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId: input.userId,
          action: "PARTICIPATION_APPLICATION_SUBMITTED",
          targetType: "ParticipationApplication",
          targetId: application.id,
          after: {
            status: application.status,
            gameName: application.gameName,
            tagLine: application.tagLine,
            primaryPosition: input.primaryPosition ?? null,
            secondaryPosition: input.secondaryPosition ?? null,
          },
          requestId: input.requestId ?? null,
        },
      });

      return application;
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      throw new ApplicationServiceError(
        "APPLICATION_PENDING_EXISTS",
        "이미 검토 중인 신청이 있거나 Riot 계정이 중복되었습니다.",
      );
    }
    throw error;
  }
}

async function findJoinableSeason(client: DatabaseClient, now: Date) {
  const seasons = await client.season.findMany({
    where: {
      status: { in: [SeasonStatus.ACTIVE, SeasonStatus.SCHEDULED] },
      endAt: { gt: now },
    },
    include: {
      weeks: {
        where: { endAt: { gt: now } },
        orderBy: { number: "asc" },
        select: { id: true, startAt: true, endAt: true },
      },
    },
    orderBy: { startAt: "asc" },
  });
  const active = seasons.filter(
    (season) => season.status === SeasonStatus.ACTIVE,
  );
  if (active.length > 1) {
    throw new ApplicationServiceError(
      "AMBIGUOUS_ACTIVE_SEASON",
      "활성 시즌이 여러 개라 승인 대상을 결정할 수 없습니다.",
    );
  }
  const season = active[0] ?? seasons[0];
  if (!season || season.weeks.length === 0) {
    throw new ApplicationServiceError(
      "NO_JOINABLE_SEASON",
      "참가자를 연결할 진행 중 또는 예정 시즌이 없습니다.",
    );
  }
  return season;
}

function safeApplicationSnapshot(application: {
  status: ApplicationStatus;
  verificationStatus: VerificationStatus;
  gameName: string;
  tagLine: string;
}) {
  return {
    status: application.status,
    verificationStatus: application.verificationStatus,
    gameName: application.gameName,
    tagLine: application.tagLine,
  };
}

export async function approveParticipationApplication(
  input: ReviewApplicationInput & {
    applicationId: string;
    actorUserId: string;
    requestId?: string;
  },
  now = new Date(),
) {
  try {
    return await db.$transaction(
      async (transaction) => {
        const application =
          await transaction.participationApplication.findUnique({
            where: { id: input.applicationId },
            include: {
              user: { select: { participant: { select: { id: true } } } },
            },
          });
        if (!application) {
          throw new ApplicationServiceError(
            "APPLICATION_NOT_FOUND",
            "참가 신청을 찾을 수 없습니다.",
          );
        }
        if (application.status !== ApplicationStatus.PENDING) {
          throw new ApplicationServiceError(
            "APPLICATION_NOT_PENDING",
            "이미 처리된 참가 신청입니다.",
          );
        }
        if (
          application.verificationStatus !== VerificationStatus.VERIFIED ||
          !application.puuid
        ) {
          throw new ApplicationServiceError(
            "APPLICATION_VERIFICATION_REQUIRED",
            "Riot 계정 재검증을 완료한 뒤 승인해 주세요.",
          );
        }
        if (application.user.participant) {
          throw new ApplicationServiceError(
            "APPLICATION_ALREADY_APPROVED",
            "이 사용자는 이미 참가자로 승인되었습니다.",
          );
        }

        await assertPuuidAvailable(
          transaction,
          application.puuid,
          application.userId,
        );
        const season = await findJoinableSeason(transaction, now);
        const lateJoin = now >= season.startAt;
        if (lateJoin && !input.acknowledgeLateJoin) {
          throw new ApplicationServiceError(
            "LATE_JOIN_ACKNOWLEDGEMENT_REQUIRED",
            "진행 중 시즌의 중도 참가 경고를 확인해 주세요.",
          );
        }

        const participant = await transaction.participant.create({
          data: {
            userId: application.userId,
            puuid: application.puuid,
            summonerId: application.summonerId,
            gameName: application.gameName,
            tagLine: application.tagLine,
            profileIconId: application.profileIconId,
            primaryPosition: application.primaryPosition,
            secondaryPosition: application.secondaryPosition,
            approvedAt: now,
            approvedById: input.actorUserId,
            lastIdentitySyncAt: application.updatedAt,
          },
          select: { id: true, userId: true, puuid: true },
        });

        await transaction.participantIdentityHistory.create({
          data: {
            participantId: participant.id,
            gameName: application.gameName,
            tagLine: application.tagLine,
            validFrom: now,
            source: serverEnv.MOCK_RIOT_API
              ? "APPLICATION_APPROVAL_MOCK"
              : "APPLICATION_APPROVAL_RIOT_API",
          },
        });

        const snapshotWeek =
          season.weeks.find(
            (week) => week.startAt <= now && now < week.endAt,
          ) ?? season.weeks[0];
        const rankSnapshot = await transaction.rankSnapshot.create({
          data: {
            participantId: participant.id,
            seasonId: season.id,
            weekId: snapshotWeek?.id ?? null,
            capturedAt: application.submittedAt ?? application.updatedAt,
            queueType: "RANKED_SOLO_5x5",
            tier: application.soloTier,
            rank: application.soloRank,
            leaguePoints: application.soloLeaguePoints,
            isUnranked: !application.soloTier,
            source: serverEnv.MOCK_RIOT_API
              ? SnapshotSource.MOCK
              : SnapshotSource.RIOT_API,
          },
          select: { id: true },
        });

        await transaction.seasonParticipant.create({
          data: {
            seasonId: season.id,
            participantId: participant.id,
            joinedAt: now,
            exceptionReason: lateJoin ? input.reason : null,
            startingRankSnapshotId: rankSnapshot.id,
          },
        });

        await transaction.participantWeek.createMany({
          data: season.weeks.map((week) => ({
            weekId: week.id,
            participantId: participant.id,
          })),
        });

        const updated = await transaction.participationApplication.updateMany({
          where: {
            id: application.id,
            status: ApplicationStatus.PENDING,
          },
          data: {
            status: ApplicationStatus.APPROVED,
            reviewedAt: now,
            reviewedById: input.actorUserId,
            reviewReason: input.reason,
          },
        });
        if (updated.count !== 1) {
          throw new ApplicationServiceError(
            "APPLICATION_REVIEW_CONFLICT",
            "다른 관리자가 먼저 신청을 처리했습니다.",
            true,
          );
        }

        await transaction.auditLog.create({
          data: {
            actorUserId: input.actorUserId,
            action: "PARTICIPATION_APPLICATION_APPROVED",
            targetType: "ParticipationApplication",
            targetId: application.id,
            reason: input.reason,
            before: safeApplicationSnapshot(application),
            after: {
              status: ApplicationStatus.APPROVED,
              participantId: participant.id,
              seasonId: season.id,
              startingRankSnapshotId: rankSnapshot.id,
              participantWeekCount: season.weeks.length,
              lateJoin,
            },
            requestId: input.requestId ?? null,
          },
        });

        return {
          applicationId: application.id,
          participantId: participant.id,
          seasonId: season.id,
          lateJoin,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (isPrismaError(error, "P2002")) {
      throw new ApplicationServiceError(
        "DUPLICATE_RIOT_ACCOUNT",
        "다른 신청이 같은 Riot 계정 또는 사용자로 먼저 승인되었습니다.",
      );
    }
    if (isPrismaError(error, "P2034")) {
      const conflicted = await db.participationApplication.findUnique({
        where: { id: input.applicationId },
        select: { puuid: true },
      });
      if (conflicted?.puuid) {
        const duplicate = await db.participant.findUnique({
          where: { puuid: conflicted.puuid },
          select: { id: true },
        });
        if (duplicate) {
          throw new ApplicationServiceError(
            "DUPLICATE_RIOT_ACCOUNT",
            "다른 신청이 같은 Riot 계정으로 먼저 승인되었습니다.",
          );
        }
      }
      throw new ApplicationServiceError(
        "APPLICATION_REVIEW_CONFLICT",
        "동시 승인 충돌이 발생했습니다. 최신 상태를 확인해 주세요.",
        true,
      );
    }
    throw error;
  }
}

export async function rejectParticipationApplication(
  input: Pick<ReviewApplicationInput, "reason"> & {
    applicationId: string;
    actorUserId: string;
    requestId?: string;
  },
  now = new Date(),
) {
  return db.$transaction(async (transaction) => {
    const application = await transaction.participationApplication.findUnique({
      where: { id: input.applicationId },
      select: {
        id: true,
        status: true,
        verificationStatus: true,
        gameName: true,
        tagLine: true,
      },
    });
    if (!application) {
      throw new ApplicationServiceError(
        "APPLICATION_NOT_FOUND",
        "참가 신청을 찾을 수 없습니다.",
      );
    }
    if (application.status !== ApplicationStatus.PENDING) {
      throw new ApplicationServiceError(
        "APPLICATION_NOT_PENDING",
        "이미 처리된 참가 신청입니다.",
      );
    }

    const updated = await transaction.participationApplication.updateMany({
      where: { id: application.id, status: ApplicationStatus.PENDING },
      data: {
        status: ApplicationStatus.REJECTED,
        reviewedAt: now,
        reviewedById: input.actorUserId,
        reviewReason: input.reason,
      },
    });
    if (updated.count !== 1) {
      throw new ApplicationServiceError(
        "APPLICATION_REVIEW_CONFLICT",
        "다른 관리자가 먼저 신청을 처리했습니다.",
        true,
      );
    }

    await transaction.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "PARTICIPATION_APPLICATION_REJECTED",
        targetType: "ParticipationApplication",
        targetId: application.id,
        reason: input.reason,
        before: safeApplicationSnapshot(application),
        after: { status: ApplicationStatus.REJECTED },
        requestId: input.requestId ?? null,
      },
    });
    return { applicationId: application.id };
  });
}

async function persistReverificationFailure(input: {
  applicationId: string;
  actorUserId: string;
  reason: string;
  error: ApplicationServiceError;
  requestId?: string;
  now: Date;
}) {
  await db.$transaction(async (transaction) => {
    const updated = await transaction.participationApplication.updateMany({
      where: {
        id: input.applicationId,
        status: ApplicationStatus.PENDING,
      },
      data: {
        verificationStatus: VerificationStatus.FAILED,
        verificationErrorCode: input.error.code,
      },
    });
    if (updated.count !== 1) return;
    await transaction.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "PARTICIPATION_APPLICATION_REVERIFICATION_FAILED",
        targetType: "ParticipationApplication",
        targetId: input.applicationId,
        reason: input.reason,
        after: {
          verificationStatus: VerificationStatus.FAILED,
          verificationErrorCode: input.error.code,
          retryable: input.error.retryable,
        },
        requestId: input.requestId ?? null,
        createdAt: input.now,
      },
    });
  });
}

export async function reverifyParticipationApplication(
  input: {
    applicationId: string;
    actorUserId: string;
    reason: string;
    requestId?: string;
  },
  resolver = getRiotIdentityResolver(),
  now = new Date(),
) {
  const application = await db.participationApplication.findUnique({
    where: { id: input.applicationId },
    select: { id: true, status: true, gameName: true, tagLine: true },
  });
  if (!application) {
    throw new ApplicationServiceError(
      "APPLICATION_NOT_FOUND",
      "참가 신청을 찾을 수 없습니다.",
    );
  }
  if (application.status !== ApplicationStatus.PENDING) {
    throw new ApplicationServiceError(
      "APPLICATION_NOT_PENDING",
      "이미 처리된 참가 신청입니다.",
    );
  }

  let account: ResolvedRiotIdentity;
  try {
    account = await resolveIdentity(application, resolver);
  } catch (error) {
    if (error instanceof ApplicationServiceError) {
      await persistReverificationFailure({ ...input, error, now });
    }
    throw error;
  }

  return db.$transaction(async (transaction) => {
    const updated = await transaction.participationApplication.updateMany({
      where: { id: application.id, status: ApplicationStatus.PENDING },
      data: {
        gameName: account.gameName,
        tagLine: account.tagLine,
        riotIdNormalized: normalizedRiotId(account.gameName, account.tagLine),
        puuid: account.puuid,
        summonerId: account.summonerId,
        profileIconId: account.profileIconId,
        soloTier: account.soloQueue?.tier ?? null,
        soloRank: account.soloQueue?.rank ?? null,
        soloLeaguePoints: account.soloQueue?.leaguePoints ?? null,
        verificationStatus: VerificationStatus.VERIFIED,
        verificationErrorCode: null,
      },
    });
    if (updated.count !== 1) {
      throw new ApplicationServiceError(
        "APPLICATION_REVIEW_CONFLICT",
        "신청 상태가 변경되어 재검증 결과를 저장하지 못했습니다.",
        true,
      );
    }
    await transaction.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "PARTICIPATION_APPLICATION_REVERIFIED",
        targetType: "ParticipationApplication",
        targetId: application.id,
        reason: input.reason,
        after: {
          verificationStatus: VerificationStatus.VERIFIED,
          gameName: account.gameName,
          tagLine: account.tagLine,
        },
        requestId: input.requestId ?? null,
        createdAt: now,
      },
    });
    return { applicationId: application.id };
  });
}
