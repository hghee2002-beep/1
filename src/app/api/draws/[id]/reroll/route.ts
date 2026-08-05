import type { NextRequest } from "next/server";

import { rerollDrawInputSchema } from "@/features/scoring/validation";
import { requireApiUser } from "@/server/auth/guards";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import { hasTrustedOrigin } from "@/server/auth/origin";
import { consumePointDrawMutationRateLimit } from "@/server/rate-limit/database";
import { scoringErrorResponse, scoringRequestId } from "@/server/scoring/http";
import { rerollPointDraw } from "@/server/scoring/service";
import { revalidatePublicDashboard } from "@/server/dashboard/revalidation";

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
    const session = await requireApiUser(request);
    const retryAfter = await consumePointDrawMutationRateLimit(
      request,
      session.user.id,
    );
    if (retryAfter > 0) {
      return authErrorResponse({
        code: "RATE_LIMITED",
        message: "재추첨 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        status: 429,
        retryAfterSeconds: retryAfter,
      });
    }
    const parsed = rerollDrawInputSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return validationErrorResponse({
        confirmed: ["두 번째 결과가 최종이라는 확인이 필요합니다."],
      });
    }
    const { id } = await context.params;
    const result = await rerollPointDraw({
      drawId: id,
      userId: session.user.id,
      confirmed: parsed.data.confirmed,
      requestId: scoringRequestId(request),
    });
    revalidatePublicDashboard();
    return noStoreJson({ ok: true, result });
  } catch (error) {
    const response = scoringErrorResponse(error);
    if (response) return response;
    console.error("point-draw.reroll.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "재추첨을 처리하지 못했습니다.",
      status: 500,
    });
  }
}
