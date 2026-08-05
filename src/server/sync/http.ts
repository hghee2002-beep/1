import "server-only";

import {
  validateSchedulerTransport,
  type SchedulerTransportResult,
} from "@/features/sync/scheduler";
import { SyncServiceError } from "@/features/sync/errors";
import { serverEnv } from "@/lib/env/server";
import { authErrorResponse } from "@/server/auth/http";

export function syncErrorResponse(error: unknown) {
  if (!(error instanceof SyncServiceError)) return null;
  const status =
    error.code === "SYNC_SEASON_NOT_FOUND" ||
    error.code === "SYNC_PARTICIPANT_NOT_FOUND"
      ? 404
      : 409;
  return authErrorResponse({
    code: error.code,
    message: error.message,
    status,
  });
}

export function validateSchedulerRequest(request: Request) {
  return validateSchedulerTransport({
    mode: serverEnv.SYNC_MODE,
    method: request.method,
    contentType: request.headers.get("content-type"),
    authorization: request.headers.get("authorization"),
    secret: serverEnv.CRON_SECRET,
  });
}

export function schedulerTransportErrorResponse(
  result: Exclude<SchedulerTransportResult, { ok: true }>,
) {
  const response = authErrorResponse({
    code: result.code,
    message:
      result.code === "SCHEDULER_DISABLED"
        ? "예약 작업이 비활성화되어 있습니다."
        : result.code === "SCHEDULER_METHOD_NOT_ALLOWED"
          ? "현재 scheduler mode에서 허용되지 않는 method입니다."
          : result.code === "SCHEDULER_UNSUPPORTED_MEDIA_TYPE"
            ? "예약 작업 요청은 application/json이어야 합니다."
            : "스케줄러 인증이 필요합니다.",
    status: result.status,
  });
  if (result.allow) response.headers.set("Allow", result.allow);
  return response;
}
