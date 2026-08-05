import type { NextRequest } from "next/server";

import { emptyAccountMutationSchema } from "@/features/account/validation";
import { zodFieldErrors } from "@/features/auth/validation";
import { accountErrorResponse, accountRequestId } from "@/server/account/http";
import { refreshOwnRiotIdentity } from "@/server/account/service";
import { requireApiUser } from "@/server/auth/guards";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import { hasTrustedOrigin } from "@/server/auth/origin";
import { revalidatePublicDashboard } from "@/server/dashboard/revalidation";
import { consumeAccountMutationRateLimit } from "@/server/rate-limit/database";

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
    const retryAfter = await consumeAccountMutationRateLimit(
      request,
      session.user.id,
    );
    if (retryAfter > 0) {
      return authErrorResponse({
        code: "RATE_LIMITED",
        message: "계정 갱신 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        status: 429,
        retryAfterSeconds: retryAfter,
      });
    }
    const parsed = emptyAccountMutationSchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      return validationErrorResponse(zodFieldErrors(parsed.error));
    }
    const requestId = accountRequestId(request);
    const result = await refreshOwnRiotIdentity({
      userId: session.user.id,
      ...(requestId ? { requestId } : {}),
    });
    revalidatePublicDashboard(result.participantId);
    return noStoreJson({ ok: true, ...result });
  } catch (error) {
    const response = accountErrorResponse(error);
    if (response) return response;
    console.error("account.riot-identity-refresh.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "Riot ID를 갱신하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      status: 500,
    });
  }
}
