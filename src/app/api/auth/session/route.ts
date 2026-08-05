import type { NextRequest } from "next/server";

import { AuthServiceError } from "@/server/auth/errors";
import { requireApiUser } from "@/server/auth/guards";
import { authErrorResponse, noStoreJson } from "@/server/auth/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiUser(request);
    return noStoreJson({
      ok: true,
      session: {
        user: session.user,
        expiresAt: session.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof AuthServiceError && error.code === "AUTH_REQUIRED") {
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: 401,
      });
    }
    console.error("auth.session.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "세션을 확인하지 못했습니다.",
      status: 500,
    });
  }
}
