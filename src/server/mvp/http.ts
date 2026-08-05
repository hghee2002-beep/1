import "server-only";

import { MvpServiceError } from "@/features/mvp/errors";
import { AuthServiceError } from "@/server/auth/errors";
import { authErrorResponse } from "@/server/auth/http";

const STATUS_BY_CODE: Record<string, number> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  BASELINE_INVALID: 400,
  BASELINE_CHECKSUM_MISMATCH: 409,
  BASELINE_CONFIRMATION_REQUIRED: 400,
  BASELINE_NAME_CONFLICT: 409,
  BASELINE_NOT_FOUND: 404,
};

export function mvpErrorResponse(error: unknown) {
  if (
    !(error instanceof MvpServiceError) &&
    !(error instanceof AuthServiceError)
  ) {
    return null;
  }
  return authErrorResponse({
    code: error.code,
    message: error.message,
    status: STATUS_BY_CODE[error.code] ?? 400,
  });
}
