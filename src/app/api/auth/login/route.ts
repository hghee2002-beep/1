import type { NextRequest } from "next/server";

import {
  AUTH_SESSION_COOKIE,
  REMEMBERED_SESSION_TTL_SECONDS,
  SESSION_TTL_SECONDS,
} from "@/features/auth/session-cookie";
import { safeRedirectPath } from "@/features/auth/redirect";
import { loginInputSchema, zodFieldErrors } from "@/features/auth/validation";
import { authenticateUser } from "@/server/auth/accounts";
import { setAuthCookie } from "@/server/auth/cookies";
import { AuthServiceError } from "@/server/auth/errors";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import { hasTrustedOrigin } from "@/server/auth/origin";
import {
  createAuthSession,
  revokeAuthSessionToken,
} from "@/server/auth/session-store";
import {
  clearLoginFailures,
  consumeLoginRateLimit,
} from "@/server/rate-limit/database";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return authErrorResponse({
      code: "CSRF_REJECTED",
      message: "요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.",
      status: 403,
    });
  }

  const parsed = loginInputSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return validationErrorResponse(zodFieldErrors(parsed.error));
  }

  const retryAfter = await consumeLoginRateLimit(
    parsed.data.loginIdNormalized,
    request,
  );
  if (retryAfter > 0) {
    return authErrorResponse({
      code: "RATE_LIMITED",
      message: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      status: 429,
      retryAfterSeconds: retryAfter,
    });
  }

  try {
    const user = await authenticateUser(parsed.data);
    await clearLoginFailures(parsed.data.loginIdNormalized, request);

    const previousToken = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
    await revokeAuthSessionToken(previousToken, "REAUTHENTICATED");

    const session = await createAuthSession(
      user,
      parsed.data.rememberMe
        ? REMEMBERED_SESSION_TTL_SECONDS
        : SESSION_TTL_SECONDS,
    );
    const redirectTo = safeRedirectPath(parsed.data.redirectTo, "/me");
    const response = noStoreJson({
      ok: true,
      redirectTo,
      user: {
        loginId: user.loginId,
        displayName: user.realName,
        role: user.role,
      },
    });
    setAuthCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    if (
      error instanceof AuthServiceError &&
      error.code === "INVALID_CREDENTIALS"
    ) {
      return authErrorResponse({
        code: "INVALID_CREDENTIALS",
        message: "로그인 ID 또는 비밀번호가 올바르지 않습니다.",
        status: 401,
      });
    }

    console.error("auth.login.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      status: 500,
    });
  }
}
