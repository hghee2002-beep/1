import { createHmac } from "node:crypto";

import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import {
  adminOperationFieldErrors,
  adminOperationSchema,
} from "@/features/admin/validation";
import { serverEnv } from "@/lib/env/server";
import { AdminOperationError } from "@/server/admin/errors";
import { executeAdminOperation } from "@/server/admin/service";
import { AuthServiceError } from "@/server/auth/errors";
import { requireApiAdmin } from "@/server/auth/guards";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import { hasTrustedOrigin } from "@/server/auth/origin";
import { revalidatePublicDashboard } from "@/server/dashboard/revalidation";
import {
  consumeAdminMutationRateLimit,
  requestClientAddress,
} from "@/server/rate-limit/database";

export const runtime = "nodejs";

function requestIpHash(request: NextRequest) {
  return createHmac("sha256", serverEnv.AUTH_SECRET)
    .update(requestClientAddress(request))
    .digest("hex");
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return authErrorResponse({
      code: "CSRF_REJECTED",
      message: "요청 출처를 확인할 수 없습니다.",
      status: 403,
    });
  }
  try {
    const session = await requireApiAdmin(request);
    const retryAfter = await consumeAdminMutationRateLimit(
      request,
      session.user.id,
    );
    if (retryAfter > 0) {
      return authErrorResponse({
        code: "RATE_LIMITED",
        message: "관리자 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        status: 429,
        retryAfterSeconds: retryAfter,
      });
    }
    const parsed = adminOperationSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return validationErrorResponse(adminOperationFieldErrors(parsed.error));
    }
    const result = await executeAdminOperation({
      operation: parsed.data,
      actorUserId: session.user.id,
      ipHash: requestIpHash(request),
    });
    revalidatePath("/admin", "layout");
    if (parsed.data.action === "FEATURE_FLAG_UPDATE") {
      revalidatePublicDashboard();
    }
    return noStoreJson({ ok: true, result });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: error.code === "AUTH_REQUIRED" ? 401 : 403,
      });
    }
    if (error instanceof AdminOperationError) {
      const status =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "CONFIRMATION_MISMATCH"
            ? 400
            : 409;
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status,
      });
    }
    console.error("admin.operation.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "관리자 작업을 완료하지 못했습니다.",
      status: 500,
    });
  }
}
