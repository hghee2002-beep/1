import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { AUTH_SESSION_COOKIE } from "@/features/auth/session-cookie";
import { resolveAuthSessionToken } from "@/server/auth/session-store";

export const getCurrentAuthSession = cache(async () => {
  const cookieStore = await cookies();
  return resolveAuthSessionToken(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
});
