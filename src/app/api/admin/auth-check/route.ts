import type { NextRequest } from "next/server";

import { AuthServiceError } from "@/server/auth/errors";
import { requireApiAdmin } from "@/server/auth/guards";
import { authErrorResponse, noStoreJson } from "@/server/auth/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiAdmin(request);
    return noStoreJson({
      ok: true,
      admin: {
        id: session.user.id,
        loginId: session.user.loginId,
        displayName: session.user.displayName,
      },
    });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: error.code === "AUTH_REQUIRED" ? 401 : 403,
      });
    }
    console.error("admin.auth-check.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "권한을 확인하지 못했습니다.",
      status: 500,
    });
  }
}
