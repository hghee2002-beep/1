import "server-only";

import { randomUUID } from "node:crypto";

import { ScoringServiceError } from "@/features/scoring/errors";
import { AuthServiceError } from "@/server/auth/errors";
import { authErrorResponse } from "@/server/auth/http";

const STATUS_BY_CODE: Record<string, number> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  DRAW_NOT_FOUND: 404,
  DRAW_FORBIDDEN: 403,
  DRAW_INTEGRITY_FAILED: 409,
  MATCH_NOT_SCORABLE: 409,
  SEASON_FINALIZED: 409,
  REROLL_CONFIRMATION_REQUIRED: 400,
  REROLL_NOT_ELIGIBLE: 409,
  REROLL_ALREADY_USED: 409,
  REROLL_DEMO_BLOCKED: 409,
  REROLL_EXPIRED: 409,
  WEEK_CLOSED: 409,
  ADJUSTMENT_REASON_REQUIRED: 400,
  SCORING_CONFLICT: 409,
};

export function scoringRequestId(request: Request) {
  const incoming = request.headers.get("x-request-id")?.trim();
  return incoming && incoming.length <= 128 ? incoming : randomUUID();
}

export function scoringErrorResponse(error: unknown) {
  if (
    !(error instanceof ScoringServiceError) &&
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
