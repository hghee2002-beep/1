import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import type { RiotIdentity } from "@/features/riot/types";

import type * as PasswordModule from "@/features/auth/password";
import type * as AccountServiceModule from "@/server/account/service";
import type * as AccountsModule from "@/server/auth/accounts";
import type * as SessionStoreModule from "@/server/auth/session-store";
import type * as DatabaseModule from "@/server/db/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseDescribe = testDatabaseUrl ? describe : describe.skip;

databaseDescribe("account security and Riot identity refresh", () => {
  let accountService: typeof AccountServiceModule;
  let accounts: typeof AccountsModule;
  let database: typeof DatabaseModule;
  let passwordModule: typeof PasswordModule;
  let sessionStore: typeof SessionStoreModule;
  let client: PrismaClient;
  let riotRefreshUserId = "";

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    Object.assign(process.env, {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      AUTH_SECRET: "account-integration-auth-secret-32-characters",
      CRON_SECRET: "account-integration-cron-secret-32-characters",
      MOCK_RIOT_API: "true",
      APP_URL: "http://localhost:3000",
      APP_TIME_ZONE: "Asia/Seoul",
    });
    [accountService, accounts, database, passwordModule, sessionStore] =
      await Promise.all([
        import("@/server/account/service"),
        import("@/server/auth/accounts"),
        import("@/server/db/client"),
        import("@/features/auth/password"),
        import("@/server/auth/session-store"),
      ]);
    client = database.db;
  });

  afterAll(async () => {
    await database?.db.$disconnect();
  });

  async function createUser(label: string, password: string) {
    const suffix = randomUUID().slice(0, 8);
    return client.user.create({
      data: {
        loginId: `${label}-${suffix}`,
        loginIdNormalized: `${label}-${suffix}`,
        realName: `계정 통합 ${label}`,
        passwordHash: await passwordModule.hashPassword(password),
      },
      select: {
        id: true,
        loginId: true,
        role: true,
        sessionVersion: true,
      },
    });
  }

  it("changes an Argon2id password, revokes every session, and audits no secret", async () => {
    const currentPassword = "current integration password 2026";
    const newPassword = "replacement integration password 2026";
    const user = await createUser("password", currentPassword);
    await Promise.all([
      sessionStore.createAuthSession(user, 3_600),
      sessionStore.createAuthSession(user, 3_600),
    ]);

    await expect(
      accountService.changeOwnPassword({
        userId: user.id,
        currentPassword: "incorrect current password",
        newPassword,
        newPasswordConfirm: newPassword,
      }),
    ).rejects.toMatchObject({ code: "CURRENT_PASSWORD_INVALID" });
    await expect(
      accountService.changeOwnPassword({
        userId: user.id,
        currentPassword,
        newPassword: currentPassword,
        newPasswordConfirm: currentPassword,
      }),
    ).rejects.toMatchObject({ code: "PASSWORD_REUSE_NOT_ALLOWED" });

    const changed = await accountService.changeOwnPassword({
      userId: user.id,
      currentPassword,
      newPassword,
      newPasswordConfirm: newPassword,
      requestId: "password-integration-request",
    });
    expect(changed).toMatchObject({
      sessionVersion: user.sessionVersion + 1,
      revokedSessionCount: 2,
    });

    const stored = await client.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true, sessionVersion: true },
    });
    expect(stored.passwordHash).not.toContain(newPassword);
    expect(
      await passwordModule.verifyPassword(stored.passwordHash, newPassword),
    ).toBe(true);
    expect(stored.sessionVersion).toBe(user.sessionVersion + 1);
    await expect(
      client.authSession.count({ where: { userId: user.id, revokedAt: null } }),
    ).resolves.toBe(0);
    const audit = await client.auditLog.findFirstOrThrow({
      where: { action: "USER_PASSWORD_CHANGED", targetId: user.id },
    });
    const serializedAudit = JSON.stringify(audit);
    expect(serializedAudit).not.toContain(currentPassword);
    expect(serializedAudit).not.toContain(newPassword);
    expect(serializedAudit).not.toContain("$argon2");

    await expect(
      accounts.authenticateUser({
        loginId: user.loginId,
        loginIdNormalized: user.loginId,
        password: currentPassword,
        rememberMe: false,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    await expect(
      accounts.authenticateUser({
        loginId: user.loginId,
        loginIdNormalized: user.loginId,
        password: newPassword,
        rememberMe: false,
      }),
    ).resolves.toMatchObject({ id: user.id });
  });

  it("refreshes the same PUUID atomically with history, rank, and a safe audit", async () => {
    const admin = await client.user.findUniqueOrThrow({
      where: { loginIdNormalized: "admin" },
      select: { id: true },
    });
    const user = await createUser("riot-refresh", "riot refresh password 2026");
    riotRefreshUserId = user.id;
    const puuid = `ACCOUNT_REFRESH_${randomUUID()}`;
    const approvedAt = new Date("2026-08-04T00:00:00.000Z");
    const participant = await client.participant.create({
      data: {
        userId: user.id,
        puuid,
        summonerId: "OLD_SUMMONER_ID",
        gameName: "OldDisplayName",
        tagLine: "KR1",
        profileIconId: 1,
        approvedAt,
        approvedById: admin.id,
        identityHistory: {
          create: {
            gameName: "OldDisplayName",
            tagLine: "KR1",
            validFrom: approvedAt,
            source: "TEST_APPROVAL",
          },
        },
      },
      select: { id: true },
    });
    const refreshedAt = new Date("2026-08-05T01:00:00.000Z");
    const identity: RiotIdentity = {
      puuid,
      summonerId: "NEW_SUMMONER_ID",
      gameName: "Renamed Account",
      tagLine: "SHIFT",
      profileIconId: 29,
      summonerLevel: 411,
      source: "MOCK",
      soloQueue: {
        queueType: "RANKED_SOLO_5x5",
        tier: "MASTER",
        rank: "I",
        leaguePoints: 187,
        wins: 51,
        losses: 38,
        hotStreak: true,
        veteran: false,
        freshBlood: false,
        inactive: false,
      },
    };
    const lookup = {
      getIdentityByPuuid: async (requestedPuuid: string) => {
        expect(requestedPuuid).toBe(puuid);
        return identity;
      },
    };

    const result = await accountService.refreshOwnRiotIdentity(
      { userId: user.id, requestId: "riot-refresh-integration" },
      lookup,
      refreshedAt,
    );
    expect(result).toMatchObject({
      participantId: participant.id,
      displayChanged: true,
      identity: { gameName: "Renamed Account", tagLine: "SHIFT" },
    });
    const stored = await client.participant.findUniqueOrThrow({
      where: { id: participant.id },
      include: {
        identityHistory: { orderBy: { validFrom: "asc" } },
        rankSnapshots: { orderBy: { capturedAt: "desc" }, take: 1 },
      },
    });
    expect(stored).toMatchObject({
      puuid,
      summonerId: "NEW_SUMMONER_ID",
      gameName: "Renamed Account",
      tagLine: "SHIFT",
      profileIconId: 29,
      lastIdentitySyncAt: refreshedAt,
    });
    expect(stored.identityHistory).toHaveLength(2);
    expect(stored.identityHistory[0]?.validTo).toEqual(refreshedAt);
    expect(stored.identityHistory[1]).toMatchObject({
      gameName: "Renamed Account",
      tagLine: "SHIFT",
      validTo: null,
      source: "ACCOUNT_REFRESH_MOCK",
    });
    expect(stored.rankSnapshots[0]).toMatchObject({
      tier: "MASTER",
      rank: "I",
      leaguePoints: 187,
      wins: 51,
      losses: 38,
      source: "MOCK",
    });
    const audit = await client.auditLog.findFirstOrThrow({
      where: {
        action: "PARTICIPANT_RIOT_IDENTITY_REFRESHED",
        targetId: participant.id,
      },
    });
    expect(audit.actorUserId).toBe(user.id);
    expect(JSON.stringify(audit)).not.toContain(puuid);
    expect(JSON.stringify(audit)).not.toContain("NEW_SUMMONER_ID");

    const baseline = {
      participant: await client.participant.findUniqueOrThrow({
        where: { id: participant.id },
        select: {
          gameName: true,
          tagLine: true,
          profileIconId: true,
          lastIdentitySyncAt: true,
        },
      }),
      history: await client.participantIdentityHistory.count({
        where: { participantId: participant.id },
      }),
      snapshots: await client.rankSnapshot.count({
        where: { participantId: participant.id },
      }),
    };

    await expect(
      accountService.refreshOwnRiotIdentity(
        { userId: user.id },
        {
          getIdentityByPuuid: async () => ({
            ...identity,
            gameName: "Must Not Persist",
            profileIconId: 999_999_999_999,
          }),
        },
        new Date("2026-08-05T02:00:00.000Z"),
      ),
    ).rejects.toBeTruthy();
    await expect(
      client.participant.findUniqueOrThrow({
        where: { id: participant.id },
        select: {
          gameName: true,
          tagLine: true,
          profileIconId: true,
          lastIdentitySyncAt: true,
        },
      }),
    ).resolves.toEqual(baseline.participant);
    await expect(
      client.participantIdentityHistory.count({
        where: { participantId: participant.id },
      }),
    ).resolves.toBe(baseline.history);
    await expect(
      client.rankSnapshot.count({ where: { participantId: participant.id } }),
    ).resolves.toBe(baseline.snapshots);
  });

  it("rejects a different or unavailable PUUID without changing identity", async () => {
    const participant = await client.participant.findFirstOrThrow({
      where: { userId: riotRefreshUserId },
      select: {
        userId: true,
        puuid: true,
        gameName: true,
        lastIdentitySyncAt: true,
      },
    });
    const stable = await client.participant.findUniqueOrThrow({
      where: { userId: participant.userId },
      select: { gameName: true, lastIdentitySyncAt: true },
    });
    const baseIdentity: RiotIdentity = {
      puuid: `DIFFERENT_${randomUUID()}`,
      summonerId: "DIFFERENT_SUMMONER",
      gameName: "Different Account",
      tagLine: "NOPE",
      profileIconId: 2,
      summonerLevel: 20,
      source: "MOCK",
      soloQueue: null,
    };
    await expect(
      accountService.refreshOwnRiotIdentity(
        { userId: participant.userId },
        { getIdentityByPuuid: async () => baseIdentity },
      ),
    ).rejects.toMatchObject({ code: "RIOT_IDENTITY_MISMATCH" });
    await expect(
      accountService.refreshOwnRiotIdentity(
        { userId: participant.userId },
        {
          getIdentityByPuuid: async () => {
            throw new Error("raw upstream failure must not escape");
          },
        },
      ),
    ).rejects.toMatchObject({ code: "RIOT_TEMPORARY_FAILURE" });
    await expect(
      client.participant.findUniqueOrThrow({
        where: { userId: participant.userId },
        select: { gameName: true, lastIdentitySyncAt: true },
      }),
    ).resolves.toEqual(stable);
  });

  it("allows a paused participant to refresh but rejects a removed participant before Riot I/O", async () => {
    const participant = await client.participant.findFirstOrThrow({
      where: { userId: riotRefreshUserId },
      select: {
        id: true,
        userId: true,
        puuid: true,
        gameName: true,
        tagLine: true,
        summonerId: true,
        profileIconId: true,
      },
    });
    await client.participant.update({
      where: { id: participant.id },
      data: { status: "PAUSED" },
    });
    const pausedResult = await accountService.refreshOwnRiotIdentity(
      { userId: participant.userId },
      {
        getIdentityByPuuid: async () => ({
          puuid: participant.puuid,
          summonerId: participant.summonerId,
          gameName: participant.gameName,
          tagLine: participant.tagLine,
          profileIconId: participant.profileIconId,
          summonerLevel: 411,
          source: "MOCK",
          soloQueue: null,
        }),
      },
      new Date("2026-08-05T03:00:00.000Z"),
    );
    expect(pausedResult.participantId).toBe(participant.id);

    await client.participant.update({
      where: { id: participant.id },
      data: { status: "REMOVED" },
    });
    let riotLookupCalled = false;
    await expect(
      accountService.refreshOwnRiotIdentity(
        { userId: participant.userId },
        {
          getIdentityByPuuid: async () => {
            riotLookupCalled = true;
            throw new Error("must not call Riot for a removed participant");
          },
        },
      ),
    ).rejects.toMatchObject({ code: "PARTICIPANT_REMOVED" });
    expect(riotLookupCalled).toBe(false);
  });
});
