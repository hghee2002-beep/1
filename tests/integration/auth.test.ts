import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { UserRole } from "@/generated/prisma/client";
import type * as AccountsModule from "@/server/auth/accounts";
import type * as AdminServiceModule from "@/server/auth/admin-service";
import type * as SessionStoreModule from "@/server/auth/session-store";
import type * as RateLimitModule from "@/server/rate-limit/database";
import type * as ValidationModule from "@/features/auth/validation";
import type * as DatabaseModule from "@/server/db/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseDescribe = testDatabaseUrl ? describe : describe.skip;

databaseDescribe("credentials authentication and database sessions", () => {
  const loginId = `auth-${randomUUID().slice(0, 8)}`;
  const password = "integration password 2026";
  let userId = "";
  let accounts: typeof AccountsModule;
  let adminService: typeof AdminServiceModule;
  let sessionStore: typeof SessionStoreModule;
  let rateLimit: typeof RateLimitModule;
  let validation: typeof ValidationModule;
  let database: typeof DatabaseModule;

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    Object.assign(process.env, {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      AUTH_SECRET: "integration-auth-secret-with-at-least-32-characters",
      CRON_SECRET: "integration-cron-secret-with-at-least-32-characters",
      MOCK_RIOT_API: "true",
      APP_URL: "http://localhost:3000",
      APP_TIME_ZONE: "Asia/Seoul",
    });

    [accounts, adminService, sessionStore, rateLimit, validation, database] =
      await Promise.all([
        import("@/server/auth/accounts"),
        import("@/server/auth/admin-service"),
        import("@/server/auth/session-store"),
        import("@/server/rate-limit/database"),
        import("@/features/auth/validation"),
        import("@/server/db/client"),
      ]);
  });

  afterAll(async () => {
    await database?.db.$disconnect();
  });

  it("registers normalized login IDs with versioned legal consent", async () => {
    const input = validation.signupInputSchema.parse({
      loginId: loginId.toUpperCase(),
      displayName: "통합 인증 사용자",
      password,
      passwordConfirm: password,
      termsAccepted: true,
      privacyAccepted: true,
    });
    const created = await accounts.registerUser(input);
    userId = created.id;

    const stored = await database.db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { legalConsents: { include: { legalDocument: true } } },
    });
    expect(stored.loginIdNormalized).toBe(loginId);
    expect(stored.passwordHash).not.toContain(password);
    expect(
      stored.legalConsents.map((item) => item.legalDocument.type).sort(),
    ).toEqual(["PRIVACY", "TERMS"]);

    await expect(accounts.registerUser(input)).rejects.toMatchObject({
      code: "LOGIN_ID_UNAVAILABLE",
    });
  });

  it("returns one generic credential error and verifies the valid password", async () => {
    const wrong = validation.loginInputSchema.parse({
      loginId,
      password: "wrong password value",
    });
    const missing = validation.loginInputSchema.parse({
      loginId: `none-${randomUUID().slice(0, 8)}`,
      password: "wrong password value",
    });
    await expect(accounts.authenticateUser(wrong)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "로그인 ID 또는 비밀번호가 올바르지 않습니다.",
    });
    await expect(accounts.authenticateUser(missing)).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "로그인 ID 또는 비밀번호가 올바르지 않습니다.",
    });

    await expect(
      accounts.authenticateUser(
        validation.loginInputSchema.parse({ loginId, password }),
      ),
    ).resolves.toMatchObject({ id: userId, role: UserRole.USER });
  });

  it("rejects tampered, expired, and revoked sessions and rotates jti once", async () => {
    const user = await database.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, role: true, sessionVersion: true },
    });
    const active = await sessionStore.createAuthSession(user, 3_600);
    await expect(
      sessionStore.resolveAuthSessionToken(active.token),
    ).resolves.toMatchObject({ user: { id: userId } });
    await expect(
      sessionStore.resolveAuthSessionToken(`${active.token.slice(0, -1)}x`),
    ).resolves.toBeNull();

    await sessionStore.revokeAuthSessionToken(active.token, "TEST_REVOKE");
    await expect(
      sessionStore.resolveAuthSessionToken(active.token),
    ).resolves.toBeNull();

    const expired = await sessionStore.createAuthSession(user, -1);
    await expect(
      sessionStore.resolveAuthSessionToken(expired.token),
    ).resolves.toBeNull();

    const beforeRotation = await sessionStore.createAuthSession(user, 3_600);
    const current = await sessionStore.resolveAuthSessionToken(
      beforeRotation.token,
    );
    expect(current).not.toBeNull();
    if (!current) return;
    const replacement = await sessionStore.rotateAuthSession(current, 3_600);
    await expect(
      sessionStore.resolveAuthSessionToken(beforeRotation.token),
    ).resolves.toBeNull();
    await expect(
      sessionStore.resolveAuthSessionToken(replacement.token),
    ).resolves.toMatchObject({ user: { id: userId } });
    await expect(
      sessionStore.rotateAuthSession(current, 3_600),
    ).rejects.toMatchObject({ code: "SESSION_ROTATION_CONFLICT" });
  });

  it("atomically enforces database login limits under parallel requests", async () => {
    const parallelLoginId = `parallel-${randomUUID()}`;
    const request = new Request("http://localhost:3000/api/auth/login", {
      headers: {
        "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 100)}`,
      },
    });
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        rateLimit.consumeLoginRateLimit(parallelLoginId, request),
      ),
    );
    expect(results.filter((retryAfter) => retryAfter === 0)).toHaveLength(5);
    expect(results.filter((retryAfter) => retryAfter > 0)).toHaveLength(7);
    await rateLimit.clearLoginFailures(parallelLoginId, request);
  });

  it("revalidates ADMIN, revokes sessions, and writes an audit row", async () => {
    const seedAdmin = await database.db.user.findUniqueOrThrow({
      where: { loginIdNormalized: "admin" },
      select: { id: true },
    });
    const before = await database.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { sessionVersion: true },
    });

    const changed = await adminService.changeUserRole({
      actorUserId: seedAdmin.id,
      targetUserId: userId,
      role: UserRole.ADMIN,
      reason: "integration authorization boundary",
      requestId: randomUUID(),
    });
    expect(changed.sessionVersion).toBe(before.sessionVersion + 1);
    await expect(
      database.db.auditLog.findFirst({
        where: { action: "USER_ROLE_CHANGED", targetId: userId },
      }),
    ).resolves.toMatchObject({ actorUserId: seedAdmin.id });
    await expect(
      database.db.authSession.count({ where: { userId, revokedAt: null } }),
    ).resolves.toBe(0);
  });
});
