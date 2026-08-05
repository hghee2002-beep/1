import "server-only";

import type { NextResponse } from "next/server";

import {
  AUTH_SESSION_COOKIE,
  sessionCookieOptions,
} from "@/features/auth/session-cookie";
import { serverEnv } from "@/lib/env/server";

export function setAuthCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
  now = new Date(),
) {
  const maxAge = Math.max(
    0,
    Math.floor((expiresAt.getTime() - now.getTime()) / 1_000),
  );
  response.cookies.set(
    AUTH_SESSION_COOKIE,
    token,
    sessionCookieOptions({
      production: serverEnv.NODE_ENV === "production",
      maxAge,
    }),
  );
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_SESSION_COOKIE, "", {
    ...sessionCookieOptions({
      production: serverEnv.NODE_ENV === "production",
      maxAge: 0,
    }),
    expires: new Date(0),
  });
}
