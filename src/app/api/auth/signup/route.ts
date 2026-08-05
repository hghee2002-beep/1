import type { NextRequest } from "next/server";

import { signupInputSchema, zodFieldErrors } from "@/features/auth/validation";
import { AuthServiceError } from "@/server/auth/errors";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import { hasTrustedOrigin } from "@/server/auth/origin";
import { registerUser } from "@/server/auth/accounts";
import { consumeSignupRateLimit } from "@/server/rate-limit/database";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return authErrorResponse({
      code: "CSRF_REJECTED",
      message: "요청 출처를 확인할 수 없습니다. 페이지를 새로고침해 주세요.",
      status: 403,
    });
  }

  const retryAfter = await consumeSignupRateLimit(request);
  if (retryAfter > 0) {
    return authErrorResponse({
      code: "RATE_LIMITED",
      message: "가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      status: 429,
      retryAfterSeconds: retryAfter,
    });
  }

  const parsed = signupInputSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return validationErrorResponse(zodFieldErrors(parsed.error));
  }

  try {
    await registerUser(parsed.data);
    return noStoreJson(
      {
        ok: true,
        next: "/login?registered=1",
        message: "계정이 생성되었습니다. 새 자격 증명으로 로그인해 주세요.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthServiceError) {
      if (error.code === "LOGIN_ID_UNAVAILABLE") {
        return authErrorResponse({
          code: error.code,
          message: error.message,
          status: 409,
          fields: { loginId: [error.message] },
        });
      }
      if (error.code === "LEGAL_DOCUMENT_UNAVAILABLE") {
        return authErrorResponse({
          code: error.code,
          message: error.message,
          status: 503,
        });
      }
    }

    console.error("auth.signup.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "계정을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.",
      status: 500,
    });
  }
}
