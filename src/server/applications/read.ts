import "server-only";

import { ApplicationStatus, SeasonStatus } from "@/generated/prisma/client";
import type { AdminListQuery } from "@/features/admin/validation";

import { db } from "@/server/db/client";

const applicationSelect = {
  id: true,
  gameName: true,
  tagLine: true,
  puuid: true,
  profileIconId: true,
  soloTier: true,
  soloRank: true,
  soloLeaguePoints: true,
  primaryPosition: true,
  secondaryPosition: true,
  status: true,
  verificationStatus: true,
  verificationErrorCode: true,
  submittedAt: true,
  reviewedAt: true,
  reviewReason: true,
  createdAt: true,
} as const;

export async function getApplicationPageData(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      participant: { select: { id: true } },
      applications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: applicationSelect,
      },
    },
  });
  return user
    ? {
        participantId: user.participant?.id ?? null,
        latestApplication: user.applications[0] ?? null,
      }
    : null;
}

export async function getLatestApplicationForUser(userId: string) {
  return db.participationApplication.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: applicationSelect,
  });
}

export async function getAdminApplicationList(
  query: AdminListQuery,
  now = new Date(),
) {
  const statuses = Object.values(ApplicationStatus);
  const status = statuses.includes(query.status as ApplicationStatus)
    ? (query.status as ApplicationStatus)
    : undefined;
  const where = {
    ...(query.q
      ? {
          OR: [
            { gameName: { contains: query.q, mode: "insensitive" as const } },
            { tagLine: { contains: query.q, mode: "insensitive" as const } },
            {
              user: {
                realName: { contains: query.q, mode: "insensitive" as const },
              },
            },
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
  const [applications, total, pendingCount, seasons] = await Promise.all([
    db.participationApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        ...applicationSelect,
        userId: true,
        summonerId: true,
        user: {
          select: {
            loginId: true,
            realName: true,
            realNamePublic: true,
            participant: { select: { id: true } },
          },
        },
        reviewedBy: { select: { realName: true } },
      },
    }),
    db.participationApplication.count({ where }),
    db.participationApplication.count({
      where: { status: ApplicationStatus.PENDING },
    }),
    db.season.findMany({
      where: {
        status: { in: [SeasonStatus.ACTIVE, SeasonStatus.SCHEDULED] },
        endAt: { gt: now },
      },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        startAt: true,
        endAt: true,
      },
    }),
  ]);

  const puuids = [
    ...new Set(
      applications
        .map((application) => application.puuid)
        .filter((puuid): puuid is string => Boolean(puuid)),
    ),
  ];
  const [participants, pendingWithPuuid] = await Promise.all([
    puuids.length
      ? db.participant.findMany({
          where: { puuid: { in: puuids } },
          select: { puuid: true, userId: true, id: true },
        })
      : [],
    puuids.length
      ? db.participationApplication.findMany({
          where: {
            status: ApplicationStatus.PENDING,
            puuid: { in: puuids },
          },
          select: { id: true, puuid: true },
        })
      : [],
  ]);
  const participantByPuuid = new Map(
    participants.map((participant) => [participant.puuid, participant]),
  );
  const pendingCountByPuuid = new Map<string, number>();
  for (const application of pendingWithPuuid) {
    if (!application.puuid) continue;
    pendingCountByPuuid.set(
      application.puuid,
      (pendingCountByPuuid.get(application.puuid) ?? 0) + 1,
    );
  }

  const activeSeasons = seasons.filter(
    (season) => season.status === SeasonStatus.ACTIVE,
  );
  const reviewSeason = activeSeasons[0] ?? seasons[0] ?? null;
  const seasonAmbiguous = activeSeasons.length > 1;

  return {
    applications: applications
      .map((application) => {
        const approvedParticipant = application.puuid
          ? participantByPuuid.get(application.puuid)
          : undefined;
        return {
          ...application,
          duplicate: {
            approvedByOtherUser: Boolean(
              approvedParticipant &&
              approvedParticipant.userId !== application.userId,
            ),
            pendingApplicationCount: application.puuid
              ? (pendingCountByPuuid.get(application.puuid) ?? 0)
              : 0,
          },
        };
      })
      .sort((left, right) => {
        if (left.status === right.status) {
          return right.createdAt.getTime() - left.createdAt.getTime();
        }
        if (left.status === ApplicationStatus.PENDING) return -1;
        if (right.status === ApplicationStatus.PENDING) return 1;
        return right.createdAt.getTime() - left.createdAt.getTime();
      }),
    reviewSeason,
    seasonAmbiguous,
    lateJoin: Boolean(reviewSeason && now >= reviewSeason.startAt),
    total,
    pendingCount,
  };
}
