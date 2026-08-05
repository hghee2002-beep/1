import type { NextRequest } from "next/server";

import {
  applicationFieldErrors,
  reviewApplicationInputSchema,
} from "@/features/applications/validation";
import {
  applicationRouteErrorResponse,
  requestIdFrom,
} from "@/server/applications/http";
import { rejectParticipationApplication } from "@/server/applications/service";
import { requireApiAdmin } from "@/server/auth/guards";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import { hasTrustedOrigin } from "@/server/auth/origin";
import { consumeAdminMutationRateLimit } from "@/server/rate-limit/database";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
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
    const parsed = reviewApplicationInputSchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      return validationErrorResponse(applicationFieldErrors(parsed.error));
    }
    const { id } = await context.params;
    const result = await rejectParticipationApplication({
      applicationId: id,
      actorUserId: session.user.id,
      requestId: requestIdFrom(request),
      reason: parsed.data.reason,
    });
    return noStoreJson({ ok: true, result });
  } catch (error) {
    const response = applicationRouteErrorResponse(error);
    if (response) return response;
    console.error("admin.application.reject.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "참가 신청을 거절하지 못했습니다.",
      status: 500,
    });
  }
}
