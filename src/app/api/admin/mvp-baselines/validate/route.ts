import type { NextRequest } from "next/server";

import { baselineValidateInputSchema } from "@/features/mvp/validation";
import { requireApiAdmin } from "@/server/auth/guards";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import { hasTrustedOrigin } from "@/server/auth/origin";
import { validateMvpBaseline } from "@/server/mvp/baseline-service";
import { mvpErrorResponse } from "@/server/mvp/http";
import { consumeAdminMutationRateLimit } from "@/server/rate-limit/database";

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
    const parsed = baselineValidateInputSchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      return validationErrorResponse({
        request: ["CSV/JSON baseline 입력을 확인해 주세요."],
      });
    }
    return noStoreJson({ ok: true, ...validateMvpBaseline(parsed.data) });
  } catch (error) {
    const response = mvpErrorResponse(error);
    if (response) return response;
    console.error("admin.mvp-baselines.validate.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "baseline dry-run을 완료하지 못했습니다.",
      status: 500,
    });
  }
}
