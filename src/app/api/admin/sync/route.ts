import type { NextRequest } from "next/server";

import { syncRequestSchema } from "@/features/sync/validation";
import { AuthServiceError } from "@/server/auth/errors";
import { requireApiAdmin } from "@/server/auth/guards";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import { hasTrustedOrigin } from "@/server/auth/origin";
import { recordAdminJobAudit } from "@/server/admin/job-audit";
import { consumeAdminMutationRateLimit } from "@/server/rate-limit/database";
import { scoringRequestId } from "@/server/scoring/http";
import { syncErrorResponse } from "@/server/sync/http";
import { runMatchSync } from "@/server/sync/service";
import { revalidatePublicDashboard } from "@/server/dashboard/revalidation";

export const runtime = "nodejs";

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
    const parsed = syncRequestSchema.safeParse(
      (await readJsonBody(request)) ?? {},
    );
    if (!parsed.success) {
      return validationErrorResponse({
        request: ["동기화 옵션을 다시 확인해 주세요."],
      });
    }
    const requestId = scoringRequestId(request);
    const result = await runMatchSync({
      ...parsed.data,
      trigger: "MANUAL",
      requestedById: session.user.id,
      requestId,
    });
    await recordAdminJobAudit({
      actorUserId: session.user.id,
      action: "ADMIN_MATCH_SYNC_COMPLETED",
      targetType: "SyncRun",
      targetId: result.runId,
      reason: "관리자 API 수동 경기 동기화",
      after: {
        status: result.status,
        participantCount: result.participantCount,
        matchesProcessed: result.matchesProcessed,
        matchesSkipped: result.matchesSkipped,
        errorCount: result.errorCount,
        hasMore: result.hasMore,
        dryRun: result.dryRun,
      },
      requestId,
    });
    revalidatePublicDashboard();
    return noStoreJson({ ok: true, result });
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: error.code === "AUTH_REQUIRED" ? 401 : 403,
      });
    }
    const response = syncErrorResponse(error);
    if (response) return response;
    console.error("admin.match-sync.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "경기 동기화를 실행하지 못했습니다.",
      status: 500,
    });
  }
}
