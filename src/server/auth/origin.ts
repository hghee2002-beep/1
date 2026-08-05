import "server-only";

import { isSameOrigin } from "@/features/auth/redirect";
import { serverEnv } from "@/lib/env/server";

export function hasTrustedOrigin(request: Request) {
  return isSameOrigin(request.headers.get("origin"), serverEnv.APP_URL);
}
