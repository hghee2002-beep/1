import "server-only";

import { randomUUID } from "node:crypto";

import { ApplicationServiceError } from "@/features/applications/errors";
import { RiotIdentityError } from "@/features/riot/identity";
import { AuthServiceError } from "@/server/auth/errors";
import { authErrorResponse } from "@/server/auth/http";

const HTTP_STATUS_BY_CODE: Record<string, number> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  RIOT_ID_INVALID: 400,
  RIOT_ACCOUNT_NOT_FOUND: 404,
  RIOT_KEY_INVALID: 503,
  RIOT_RATE_LIMITED: 429,
  RIOT_TEMPORARY_FAILURE: 503,
  APPLICATION_NOT_FOUND: 404,
  APPLICATION_PENDING_EXISTS: 409,
  APPLICATION_ALREADY_APPROVED: 409,
  APPLICATION_NOT_PENDING: 409,
  APPLICATION_VERIFICATION_REQUIRED: 409,
  DUPLICATE_RIOT_ACCOUNT: 409,
  NO_JOINABLE_SEASON: 409,
  AMBIGUOUS_ACTIVE_SEASON: 409,
  LATE_JOIN_ACKNOWLEDGEMENT_REQUIRED: 409,
  APPLICATION_REVIEW_CONFLICT: 409,
};

export function requestIdFrom(request: Request) {
  const incoming = request.headers.get("x-request-id")?.trim();
  return incoming && incoming.length <= 128 ? incoming : randomUUID();
}

export function applicationRouteErrorResponse(error: unknown) {
  if (
    error instanceof ApplicationServiceError ||
    error instanceof AuthServiceError ||
    error instanceof RiotIdentityError
  ) {
    const retryAfterSeconds =
      "retryAfterSeconds" in error ? error.retryAfterSeconds : undefined;
    return authErrorResponse({
      code: error.code,
      message: error.message,
      status: HTTP_STATUS_BY_CODE[error.code] ?? 400,
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    });
  }
  return null;
}
