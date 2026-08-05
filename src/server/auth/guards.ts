import "server-only";

import type { NextRequest } from "next/server";

import { AUTH_SESSION_COOKIE } from "@/features/auth/session-cookie";
import { AuthServiceError } from "@/server/auth/errors";
import { resolveAuthSessionToken } from "@/server/auth/session-store";

export async function requireApiUser(request: NextRequest) {
  const session = await resolveAuthSessionToken(
    request.cookies.get(AUTH_SESSION_COOKIE)?.value,
  );
  if (!session) {
    throw new AuthServiceError("AUTH_REQUIRED", "로그인이 필요합니다.");
  }
  return session;
}

export async function requireApiAdmin(request: NextRequest) {
  const session = await requireApiUser(request);
  if (session.user.role !== "ADMIN") {
    throw new AuthServiceError("FORBIDDEN", "접근 권한이 없습니다.");
  }
  return session;
}
