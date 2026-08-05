import "server-only";

import { AuthServiceError } from "@/server/auth/errors";
import { authErrorResponse } from "@/server/auth/http";
import { MissionServiceError } from "@/features/missions/errors";

const STATUS_BY_CODE: Record<string, number> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  MISSION_ASSIGNMENT_NOT_FOUND: 404,
  MISSION_ASSIGNMENT_FORBIDDEN: 403,
  MISSION_ASSIGNMENT_NOT_ACTIVE: 409,
  MISSION_REROLL_COOLDOWN: 409,
  MISSION_POOL_EXHAUSTED: 409,
  MISSION_SNAPSHOT_MISSING: 409,
  MISSION_CONFLICT: 409,
  WEEK_CLOSED: 409,
};

export function missionErrorResponse(error: unknown) {
  if (
    !(error instanceof MissionServiceError) &&
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
