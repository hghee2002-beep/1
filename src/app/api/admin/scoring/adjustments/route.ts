import type { NextRequest } from "next/server";

import {
  adminAdjustmentInputSchema,
  scoringFieldErrors,
} from "@/features/scoring/validation";
import { requireApiAdmin } from "@/server/auth/guards";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import { hasTrustedOrigin } from "@/server/auth/origin";
import { consumeAdminMutationRateLimit } from "@/server/rate-limit/database";
import { scoringErrorResponse, scoringRequestId } from "@/server/scoring/http";
import { addAdminScoreAdjustment } from "@/server/scoring/service";
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
    const parsed = adminAdjustmentInputSchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      return validationErrorResponse(scoringFieldErrors(parsed.error));
    }
    const result = await addAdminScoreAdjustment({
      participantWeekId: parsed.data.participantWeekId,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.idempotencyKey,
      actorUserId: session.user.id,
      requestId: scoringRequestId(request),
    });
    revalidatePublicDashboard();
    return noStoreJson({ ok: true, result }, { status: 201 });
  } catch (error) {
    const response = scoringErrorResponse(error);
    if (response) return response;
    console.error("admin.score-adjustment.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "점수 조정을 저장하지 못했습니다.",
      status: 500,
    });
  }
}
