import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({
  trustedOrigin: true,
  requireApiUser: vi.fn(async () => ({
    user: { id: "user-id", participant: { id: "participant-id" } },
  })),
  consumeAccountMutationRateLimit: vi.fn(async () => 0),
  changeOwnPassword: vi.fn(async () => ({
    sessionVersion: 2,
    revokedSessionCount: 3,
  })),
  refreshOwnRiotIdentity: vi.fn(async () => ({
    participantId: "participant-id",
    identity: {
      gameName: "Changed Name",
      tagLine: "KR1",
      profileIconId: 29,
      soloQueue: { tier: "MASTER", rank: "I", leaguePoints: 101 },
    },
    displayChanged: true,
    refreshedAt: new Date("2026-08-05T00:00:00.000Z"),
  })),
  clearAuthCookie: vi.fn(),
  revalidatePublicDashboard: vi.fn(),
}));

vi.mock("@/server/auth/origin", () => ({
  hasTrustedOrigin: () => account.trustedOrigin,
}));
vi.mock("@/server/auth/guards", () => ({
  requireApiUser: account.requireApiUser,
}));
vi.mock("@/server/rate-limit/database", () => ({
  consumeAccountMutationRateLimit: account.consumeAccountMutationRateLimit,
}));
vi.mock("@/server/account/service", () => ({
  changeOwnPassword: account.changeOwnPassword,
  refreshOwnRiotIdentity: account.refreshOwnRiotIdentity,
}));
vi.mock("@/server/auth/cookies", () => ({
  clearAuthCookie: account.clearAuthCookie,
}));
vi.mock("@/server/dashboard/revalidation", () => ({
  revalidatePublicDashboard: account.revalidatePublicDashboard,
}));

import { AccountSettingsError } from "@/features/account/errors";
import { POST as changePassword } from "@/app/api/account/password/route";
import { POST as refreshRiotIdentity } from "@/app/api/account/riot-identity/route";

function request(path: string, body: object = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
      "x-request-id": "account-route-request",
    },
    body: JSON.stringify(body),
  });
}

describe("account mutation routes", () => {
  beforeEach(() => {
    account.trustedOrigin = true;
    account.consumeAccountMutationRateLimit.mockResolvedValue(0);
    account.changeOwnPassword.mockResolvedValue({
      sessionVersion: 2,
      revokedSessionCount: 3,
    });
    account.refreshOwnRiotIdentity.mockResolvedValue({
      participantId: "participant-id",
      identity: {
        gameName: "Changed Name",
        tagLine: "KR1",
        profileIconId: 29,
        soloQueue: { tier: "MASTER", rank: "I", leaguePoints: 101 },
      },
      displayChanged: true,
      refreshedAt: new Date("2026-08-05T00:00:00.000Z"),
    });
  });

  it("validates and completes a password change before clearing the cookie", async () => {
    const response = await changePassword(
      request("/api/account/password", {
        currentPassword: "current password 2026",
        newPassword: "new password value 2026",
        newPasswordConfirm: "new password value 2026",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      reauthenticate: true,
      next: "/login?passwordChanged=1",
    });
    expect(account.changeOwnPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-id",
        requestId: "account-route-request",
      }),
    );
    expect(account.clearAuthCookie).toHaveBeenCalledOnce();
  });

  it("rejects CSRF, malformed confirmation, and over-limit requests", async () => {
    account.trustedOrigin = false;
    expect(
      (
        await changePassword(
          request("/api/account/password", {
            currentPassword: "current password 2026",
            newPassword: "new password value 2026",
            newPasswordConfirm: "new password value 2026",
          }),
        )
      ).status,
    ).toBe(403);

    account.trustedOrigin = true;
    expect(
      (
        await changePassword(
          request("/api/account/password", {
            currentPassword: "current password 2026",
            newPassword: "new password value 2026",
            newPasswordConfirm: "different password value",
          }),
        )
      ).status,
    ).toBe(400);
    expect(account.changeOwnPassword).not.toHaveBeenCalled();

    account.consumeAccountMutationRateLimit.mockResolvedValue(60);
    const limited = await refreshRiotIdentity(
      request("/api/account/riot-identity"),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
  });

  it("refreshes only the authenticated participant and maps Riot throttling", async () => {
    const response = await refreshRiotIdentity(
      request("/api/account/riot-identity"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      participantId: "participant-id",
      identity: { gameName: "Changed Name", tagLine: "KR1" },
    });
    expect(account.refreshOwnRiotIdentity).toHaveBeenCalledWith({
      userId: "user-id",
      requestId: "account-route-request",
    });
    expect(account.revalidatePublicDashboard).toHaveBeenCalledWith(
      "participant-id",
    );

    const unexpectedInput = await refreshRiotIdentity(
      request("/api/account/riot-identity", { puuid: "client-controlled" }),
    );
    expect(unexpectedInput.status).toBe(400);
    expect(account.refreshOwnRiotIdentity).toHaveBeenCalledTimes(1);

    account.refreshOwnRiotIdentity.mockRejectedValueOnce(
      new AccountSettingsError(
        "RIOT_RATE_LIMITED",
        "잠시 후 다시 시도해 주세요.",
        true,
        45,
      ),
    );
    const throttled = await refreshRiotIdentity(
      request("/api/account/riot-identity"),
    );
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("Retry-After")).toBe("45");
  });
});
