import { NextResponse, type NextRequest } from "next/server";

import { AUTH_SESSION_COOKIE } from "@/features/auth/session-cookie";
import { safeRedirectPath } from "@/features/auth/redirect";
import { clearAuthCookie } from "@/server/auth/cookies";
import { authErrorResponse } from "@/server/auth/http";
import { hasTrustedOrigin } from "@/server/auth/origin";
import { revokeAuthSessionToken } from "@/server/auth/session-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return authErrorResponse({
      code: "CSRF_REJECTED",
      message: "요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.",
      status: 403,
    });
  }

  await revokeAuthSessionToken(
    request.cookies.get(AUTH_SESSION_COOKIE)?.value,
    "LOGOUT",
  );

  const redirectTo = safeRedirectPath(
    request.nextUrl.searchParams.get("redirectTo"),
    "/login?loggedOut=1",
  );
  const response = NextResponse.redirect(new URL(redirectTo, request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  clearAuthCookie(response);
  return response;
}
