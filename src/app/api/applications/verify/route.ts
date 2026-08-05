import type { NextRequest } from "next/server";

import {
  applicationFieldErrors,
  verifyRiotIdentityInputSchema,
} from "@/features/applications/validation";
import {
  applicationRouteErrorResponse,
  requestIdFrom,
} from "@/server/applications/http";
import { verifyRiotIdentityForApplication } from "@/server/applications/service";
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
        message:
          "Riot 계정 확인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        status: 429,
        retryAfterSeconds: retryAfter,
      });
    }

    const parsed = verifyRiotIdentityInputSchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      return validationErrorResponse(applicationFieldErrors(parsed.error));
    }
    const account = await verifyRiotIdentityForApplication({
      userId: session.user.id,
      ...parsed.data,
    });
    return noStoreJson({
      ok: true,
      account,
      requestId: requestIdFrom(request),
    });
  } catch (error) {
    const response = applicationRouteErrorResponse(error);
    if (response) return response;
    console.error("application.verify.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "Riot 계정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      status: 500,
    });
  }
}
