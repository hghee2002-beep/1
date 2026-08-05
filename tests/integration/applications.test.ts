import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ApplicationStatus,
  UserRole,
  VerificationStatus,
  type PrismaClient,
} from "@/generated/prisma/client";
import type {
  ParsedRiotId,
  ResolvedRiotIdentity,
  RiotIdentityResolver,
} from "@/features/riot/identity";

import type * as ApplicationServiceModule from "@/server/applications/service";
import type * as DatabaseModule from "@/server/db/client";
import type * as SessionStoreModule from "@/server/auth/session-store";
import type * as ApproveRouteModule from "@/app/api/admin/applications/[id]/approve/route";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseDescribe = testDatabaseUrl ? describe : describe.skip;

class FixedIdentityResolver implements RiotIdentityResolver {
  constructor(private readonly puuid: string) {}

  async resolve(identity: ParsedRiotId): Promise<ResolvedRiotIdentity> {
    return {
      puuid: this.puuid,
      summonerId: `SUMMONER_${this.puuid}`,
      gameName: identity.gameName,
      tagLine: identity.tagLine,
      profileIconId: 29,
      summonerLevel: 100,
      soloQueue: {
        queueType: "RANKED_SOLO_5x5",
        tier: "EMERALD",
        rank: "II",
        leaguePoints: 42,
        wins: 20,
        losses: 15,
        hotStreak: false,
        veteran: false,
        freshBlood: false,
        inactive: false,
      },
      source: "MOCK",
    };
  }
}

databaseDescribe("Riot participation application and approval", () => {
  let applications: typeof ApplicationServiceModule;
  let database: typeof DatabaseModule;
  let sessionStore: typeof SessionStoreModule;
  let approveRoute: typeof ApproveRouteModule;
  let client: PrismaClient;
  let adminId: string;

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    Object.assign(process.env, {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      AUTH_SECRET: "application-integration-auth-secret-32-characters",
      CRON_SECRET: "application-integration-cron-secret-32-characters",
      MOCK_RIOT_API: "true",
      APP_URL: "http://localhost:3000",
      APP_TIME_ZONE: "Asia/Seoul",
    });
    [applications, database, sessionStore, approveRoute] = await Promise.all([
      import("@/server/applications/service"),
      import("@/server/db/client"),
      import("@/server/auth/session-store"),
      import("@/app/api/admin/applications/[id]/approve/route"),
    ]);
    client = database.db;
    await client.season.updateMany({
      where: {
        status: "ACTIVE",
        slug: { not: "development-active-season" },
      },
      data: { status: "COMPLETED" },
    });
    adminId = (
      await client.user.findUniqueOrThrow({
        where: { loginIdNormalized: "admin" },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await database?.db.$disconnect();
  });

  async function createUser(label: string) {
    const suffix = randomUUID().slice(0, 8);
    const user = await client.user.create({
      data: {
        loginId: `${label}-${suffix}`,
        loginIdNormalized: `${label}-${suffix}`,
        realName: `통합 ${label}`,
        passwordHash: "integration-test-password-hash",
      },
      select: { id: true, loginId: true, role: true, sessionVersion: true },
    });
    return user;
  }

  function submitInput(userId: string) {
    return {
      userId,
      gameName: "Integration Applicant",
      tagLine: "TEST",
      primaryPosition: "MIDDLE" as const,
      secondaryPosition: "JUNGLE" as const,
      realNamePublic: true,
      requestId: randomUUID(),
    };
  }

  it("stores one verified pending application without making the user a participant", async () => {
    const user = await createUser("apply");
    const resolver = new FixedIdentityResolver(`PUUID_${randomUUID()}`);
    const created = await applications.submitParticipationApplication(
      submitInput(user.id),
      resolver,
    );
    expect(created.status).toBe(ApplicationStatus.PENDING);

    const stored = await client.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { participant: true, applications: true },
    });
    expect(stored.participant).toBeNull();
    expect(stored.realNamePublic).toBe(true);
    expect(stored.applications).toHaveLength(1);
    expect(stored.applications[0]).toMatchObject({
      verificationStatus: VerificationStatus.VERIFIED,
      primaryPosition: "MIDDLE",
      secondaryPosition: "JUNGLE",
    });
    await expect(
      applications.submitParticipationApplication(
        submitInput(user.id),
        new FixedIdentityResolver(`PUUID_${randomUUID()}`),
      ),
    ).rejects.toMatchObject({ code: "APPLICATION_PENDING_EXISTS" });
  });

  it("keeps a rejected application and allows a new application record", async () => {
    const user = await createUser("reapply");
    const resolver = new FixedIdentityResolver(`PUUID_${randomUUID()}`);
    const first = await applications.submitParticipationApplication(
      submitInput(user.id),
      resolver,
    );
    await applications.rejectParticipationApplication({
      applicationId: first.id,
      actorUserId: adminId,
      reason: "통합 테스트 거절 사유",
      requestId: randomUUID(),
    });
    const second = await applications.submitParticipationApplication(
      submitInput(user.id),
      resolver,
    );
    expect(second.id).not.toBe(first.id);
    await expect(
      client.participationApplication.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { status: true, reviewReason: true },
      }),
    ).resolves.toEqual([
      {
        status: ApplicationStatus.REJECTED,
        reviewReason: "통합 테스트 거절 사유",
      },
      { status: ApplicationStatus.PENDING, reviewReason: null },
    ]);
  });

  it("approves all participant initialization records and audit data in one transaction", async () => {
    const user = await createUser("approve");
    const created = await applications.submitParticipationApplication(
      submitInput(user.id),
      new FixedIdentityResolver(`PUUID_${randomUUID()}`),
    );
    const approved = await applications.approveParticipationApplication({
      applicationId: created.id,
      actorUserId: adminId,
      reason: "통합 테스트 승인 사유",
      acknowledgeLateJoin: true,
      requestId: randomUUID(),
    });

    const participant = await client.participant.findUniqueOrThrow({
      where: { id: approved.participantId },
      include: {
        identityHistory: true,
        seasonEntries: true,
        participantWeeks: true,
        rankSnapshots: true,
      },
    });
    expect(participant.userId).toBe(user.id);
    expect(participant.identityHistory).toHaveLength(1);
    expect(participant.seasonEntries).toHaveLength(1);
    expect(participant.seasonEntries[0]?.startingRankSnapshotId).toBeTruthy();
    expect(participant.participantWeeks.length).toBeGreaterThan(0);
    expect(participant.rankSnapshots).toHaveLength(1);
    await expect(
      client.participationApplication.findUniqueOrThrow({
        where: { id: created.id },
        select: { status: true, reviewedById: true, reviewReason: true },
      }),
    ).resolves.toMatchObject({
      status: ApplicationStatus.APPROVED,
      reviewedById: adminId,
      reviewReason: "통합 테스트 승인 사유",
    });
    await expect(
      client.auditLog.findFirst({
        where: {
          action: "PARTICIPATION_APPLICATION_APPROVED",
          targetId: created.id,
        },
      }),
    ).resolves.toMatchObject({ actorUserId: adminId });
  });

  it("rolls back approval when a required foreign key fails", async () => {
    const user = await createUser("rollback");
    const created = await applications.submitParticipationApplication(
      submitInput(user.id),
      new FixedIdentityResolver(`PUUID_${randomUUID()}`),
    );
    await expect(
      applications.approveParticipationApplication({
        applicationId: created.id,
        actorUserId: randomUUID(),
        reason: "존재하지 않는 관리자 rollback",
        acknowledgeLateJoin: true,
      }),
    ).rejects.toBeTruthy();

    await expect(
      client.participationApplication.findUniqueOrThrow({
        where: { id: created.id },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: ApplicationStatus.PENDING });
    await expect(
      client.participant.findUnique({ where: { userId: user.id } }),
    ).resolves.toBeNull();
  });

  it("allows only one concurrent approval for the same PUUID", async () => {
    const [firstUser, secondUser] = await Promise.all([
      createUser("race-a"),
      createUser("race-b"),
    ]);
    const sharedPuuid = `PUUID_${randomUUID()}`;
    const sharedResolver = new FixedIdentityResolver(sharedPuuid);
    const [first, second] = await Promise.all([
      applications.submitParticipationApplication(
        submitInput(firstUser.id),
        sharedResolver,
      ),
      applications.submitParticipationApplication(
        submitInput(secondUser.id),
        sharedResolver,
      ),
    ]);
    const results = await Promise.allSettled([
      applications.approveParticipationApplication({
        applicationId: first.id,
        actorUserId: adminId,
        reason: "동시 승인 첫 번째 요청",
        acknowledgeLateJoin: true,
      }),
      applications.approveParticipationApplication({
        applicationId: second.id,
        actorUserId: adminId,
        reason: "동시 승인 두 번째 요청",
        acknowledgeLateJoin: true,
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      await client.participant.count({
        where: { puuid: sharedPuuid },
      }),
    ).toBe(1);
  });

  it("blocks a USER session at the approval endpoint", async () => {
    const user = await createUser("forbidden");
    expect(user.role).toBe(UserRole.USER);
    const session = await sessionStore.createAuthSession(user, 3_600);
    const request = new NextRequest(
      "http://localhost:3000/api/admin/applications/00000000-0000-0000-0000-000000000000/approve",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: `deluxe_session=${session.token}`,
        },
        body: JSON.stringify({
          reason: "권한 없는 승인 요청",
          acknowledgeLateJoin: true,
        }),
      },
    );
    const response = await approveRoute.POST(request, {
      params: Promise.resolve({
        id: "00000000-0000-0000-0000-000000000000",
      }),
    });
    expect(response.status).toBe(403);
  });
});
