// @vitest-environment node

import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/features/auth/password";
import { isSameOrigin, safeRedirectPath } from "@/features/auth/redirect";
import {
  AUTH_SESSION_COOKIE,
  sessionCookieOptions,
} from "@/features/auth/session-cookie";
import {
  signSessionToken,
  verifySessionToken,
} from "@/features/auth/session-token";
import {
  changePasswordInputSchema,
  loginInputSchema,
  normalizeLoginId,
  signupInputSchema,
} from "@/features/auth/validation";

const TOKEN_SECRET = "unit-test-auth-secret-with-at-least-32-characters";

describe("authentication domain rules", () => {
  it("normalizes NFKC, surrounding whitespace, and case for login IDs", () => {
    expect(normalizeLoginId("  Ｄeluxe.Player_01  ")).toBe("deluxe.player_01");
    expect(
      loginInputSchema.parse({
        loginId: "PLAYER-01",
        password: "irrelevant",
      }).loginIdNormalized,
    ).toBe("player-01");
  });

  it("rejects unsupported login IDs and mismatched password confirmation", () => {
    const result = signupInputSchema.safeParse({
      loginId: "한글아이디",
      displayName: "테스트 사용자",
      password: "correct horse battery staple",
      passwordConfirm: "different password value",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["loginId"] }),
        expect.objectContaining({ path: ["passwordConfirm"] }),
      ]),
    );
  });

  it("accepts 4-character signup passwords and rejects shorter values", () => {
    expect(
      signupInputSchema.safeParse({
        loginId: "user-04",
        displayName: "네 글자 사용자",
        password: "1234",
        passwordConfirm: "1234",
      }).success,
    ).toBe(true);

    const result = signupInputSchema.safeParse({
      loginId: "user-03",
      displayName: "세 글자 사용자",
      password: "123",
      passwordConfirm: "123",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["password"],
          message: "비밀번호는 4자 이상이어야 합니다.",
        }),
      ]),
    );

    expect(
      changePasswordInputSchema.safeParse({
        currentPassword: "current password 2026",
        newPassword: "1234",
        newPasswordConfirm: "1234",
      }).success,
    ).toBe(false);
  });

  it("hashes and verifies passwords with Argon2id without storing plaintext", async () => {
    const password = "long development passphrase 2026";
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/u);
    expect(hash).not.toContain(password);
    await expect(verifyPassword(hash, password)).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
    await expect(verifyPassword("not-an-argon-hash", password)).resolves.toBe(
      false,
    );
  });

  it("allows only same-origin redirect paths", () => {
    expect(safeRedirectPath("/admin/users?state=open#row", "/me")).toBe(
      "/admin/users?state=open#row",
    );
    expect(safeRedirectPath("https://evil.example/steal", "/me")).toBe("/me");
    expect(safeRedirectPath("//evil.example/steal", "/me")).toBe("/me");
    expect(safeRedirectPath("/\\evil.example", "/me")).toBe("/me");
    expect(
      isSameOrigin("https://app.example", "https://app.example/path"),
    ).toBe(true);
    expect(isSameOrigin("https://evil.example", "https://app.example")).toBe(
      false,
    );
    expect(isSameOrigin(null, "https://app.example")).toBe(false);
  });

  it("signs minimal expiring session claims and rejects tampering or expiry", async () => {
    const issuedAt = new Date("2026-08-04T00:00:00.000Z");
    const expiresAt = new Date("2026-08-04T01:00:00.000Z");
    const token = await signSessionToken(
      {
        userId: "b5ade34f-4066-4d1f-8e91-57d20a90fdc4",
        role: "USER",
        jti: "opaque-session-identifier",
        issuedAt,
        expiresAt,
      },
      TOKEN_SECRET,
    );

    await expect(
      verifySessionToken(
        token,
        TOKEN_SECRET,
        new Date("2026-08-04T00:30:00.000Z"),
      ),
    ).resolves.toMatchObject({
      role: "USER",
      jti: "opaque-session-identifier",
      issuedAt,
      expiresAt,
    });
    await expect(
      verifySessionToken(
        `${token.slice(0, -1)}x`,
        TOKEN_SECRET,
        new Date("2026-08-04T00:30:00.000Z"),
      ),
    ).resolves.toBeNull();
    await expect(
      verifySessionToken(
        token,
        TOKEN_SECRET,
        new Date("2026-08-04T01:00:01.000Z"),
      ),
    ).resolves.toBeNull();
  });

  it("defines explicit HttpOnly, SameSite=Lax cookie attributes", () => {
    expect(AUTH_SESSION_COOKIE).toBe("deluxe_session");
    expect(sessionCookieOptions({ production: false, maxAge: 43_200 })).toEqual(
      {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 43_200,
      },
    );
    expect(
      sessionCookieOptions({ production: true, maxAge: 43_200 }).secure,
    ).toBe(true);
  });
});
