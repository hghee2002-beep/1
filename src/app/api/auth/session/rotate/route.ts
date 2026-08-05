import type { NextRequest } from "next/server";

import {
  REMEMBERED_SESSION_TTL_SECONDS,
  SESSION_TTL_SECONDS,
} from "@/features/auth/session-cookie";
import { setAuthCookie } from "@/server/auth/cookies";
import { AuthServiceError } from "@/server/auth/errors";
import { requireApiUser } from "@/server/auth/guards";
import { authErrorResponse, noStoreJson } from "@/server/auth/http";
import { hasTrustedOrigin } from "@/server/auth/origin";
import { rotateAuthSession } from "@/server/auth/session-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return authErrorResponse({
      code: "CSRF_REJECTED",
      message: "요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.",
      status: 403,
    });
  }

  try {
    const current = await requireApiUser(request);
    const remainingMs = current.expiresAt.getTime() - Date.now();
    const ttlSeconds =
      remainingMs > SESSION_TTL_SECONDS * 1_000
        ? REMEMBERED_SESSION_TTL_SECONDS
        : SESSION_TTL_SECONDS;
    const replacement = await rotateAuthSession(current, ttlSeconds);
    const response = noStoreJson({
      ok: true,
      expiresAt: replacement.expiresAt.toISOString(),
    });
    setAuthCookie(response, replacement.token, replacement.expiresAt);
    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      if (error.code === "AUTH_REQUIRED") {
        return authErrorResponse({
          code: error.code,
          message: error.message,
          status: 401,
        });
      }
      if (error.code === "SESSION_ROTATION_CONFLICT") {
        return authErrorResponse({
          code: error.code,
          message: error.message,
          status: 409,
        });
      }
    }
    console.error("auth.session.rotate.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "세션을 갱신하지 못했습니다.",
      status: 500,
    });
  }
}
