import "server-only";

import { AccountSettingsError } from "@/features/account/errors";
import { AuthServiceError } from "@/server/auth/errors";
import { authErrorResponse } from "@/server/auth/http";

export function accountRequestId(request: Request) {
  const value = request.headers.get("x-request-id")?.trim();
  return value && value.length <= 128 ? value : undefined;
}

export function accountErrorResponse(error: unknown) {
  if (error instanceof AuthServiceError) {
    if (error.code === "AUTH_REQUIRED") {
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: 401,
      });
    }
    if (error.code === "FORBIDDEN") {
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: 403,
      });
    }
  }
  if (!(error instanceof AccountSettingsError)) return null;

  switch (error.code) {
    case "AUTH_REQUIRED":
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: 401,
      });
    case "CURRENT_PASSWORD_INVALID":
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: 401,
        fields: { currentPassword: [error.message] },
      });
    case "PASSWORD_REUSE_NOT_ALLOWED":
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: 400,
        fields: { newPassword: [error.message] },
      });
    case "PARTICIPANT_REQUIRED":
    case "PARTICIPANT_REMOVED":
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: 403,
      });
    case "PASSWORD_CHANGE_CONFLICT":
    case "RIOT_IDENTITY_MISMATCH":
    case "RIOT_IDENTITY_CONFLICT":
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: 409,
      });
    case "RIOT_ACCOUNT_NOT_FOUND":
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: 404,
      });
    case "RIOT_RATE_LIMITED":
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: 429,
        ...(error.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: error.retryAfterSeconds }
          : {}),
      });
    case "RIOT_SERVICE_UNAVAILABLE":
    case "RIOT_TEMPORARY_FAILURE":
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: 503,
        ...(error.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: error.retryAfterSeconds }
          : {}),
      });
    default:
      return authErrorResponse({
        code: "ACCOUNT_UPDATE_FAILED",
        message: "계정 설정을 변경하지 못했습니다.",
        status: 400,
      });
  }
}
