import type { NextRequest } from "next/server";

import {
  reinstateMatchInputSchema,
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
import { revalidatePublicDashboard } from "@/server/dashboard/revalidation";
import { consumeAdminMutationRateLimit } from "@/server/rate-limit/database";
import { scoringErrorResponse, scoringRequestId } from "@/server/scoring/http";
import { reinstateSeasonMatch } from "@/server/scoring/service";

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
    const parsed = reinstateMatchInputSchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      return validationErrorResponse(scoringFieldErrors(parsed.error));
    }
    const { id } = await context.params;
    const result = await reinstateSeasonMatch({
      seasonMatchId: id,
      actorUserId: session.user.id,
      reason: parsed.data.reason,
      confirmation: parsed.data.confirmation,
      requestId: scoringRequestId(request),
    });
    revalidatePublicDashboard();
    return noStoreJson({ ok: true, result });
  } catch (error) {
    const response = scoringErrorResponse(error);
    if (response) return response;
    console.error("admin.season-match.reinstate.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "경기를 복구하지 못했습니다.",
      status: 500,
    });
  }
}
