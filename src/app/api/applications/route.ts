import type { NextRequest } from "next/server";

import {
  applicationFieldErrors,
  submitApplicationInputSchema,
} from "@/features/applications/validation";
import {
  applicationRouteErrorResponse,
  requestIdFrom,
} from "@/server/applications/http";
import { submitParticipationApplication } from "@/server/applications/service";
import { requireApiUser } from "@/server/auth/guards";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import { hasTrustedOrigin } from "@/server/auth/origin";
import { consumeApplicationRateLimit } from "@/server/rate-limit/database";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return authErrorResponse({
      code: "CSRF_REJECTED",
      message: "요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.",
      status: 403,
    });
  }

  try {
    const session = await requireApiUser(request);
    const retryAfter = await consumeApplicationRateLimit(
      request,
      session.user.id,
    );
    if (retryAfter > 0) {
      return authErrorResponse({
        code: "RATE_LIMITED",
        message: "참가 신청 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        status: 429,
        retryAfterSeconds: retryAfter,
      });
    }

    const parsed = submitApplicationInputSchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      return validationErrorResponse(applicationFieldErrors(parsed.error));
    }
    const application = await submitParticipationApplication({
      userId: session.user.id,
      requestId: requestIdFrom(request),
      ...parsed.data,
    });
    return noStoreJson(
      { ok: true, application, next: "/me?application=submitted" },
      { status: 201 },
    );
  } catch (error) {
    const response = applicationRouteErrorResponse(error);
    if (response) return response;
    console.error("application.submit.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "참가 신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      status: 500,
    });
  }
}
