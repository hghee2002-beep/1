import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import {
  resolveSchedulerInvocationKey,
  toSchedulerRunResponse,
} from "@/features/sync/scheduler";
import { syncRequestSchema } from "@/features/sync/validation";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import {
  schedulerTransportErrorResponse,
  syncErrorResponse,
  validateSchedulerRequest,
} from "@/server/sync/http";
import { runMatchSync } from "@/server/sync/service";
import { revalidatePublicDashboard } from "@/server/dashboard/revalidation";
import { logError, logInfo } from "@/server/observability/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

function requestId(request: NextRequest) {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[a-zA-Z0-9:_-]{8,128}$/u.test(supplied)
    ? supplied
    : randomUUID();
}

async function executeSchedulerSync(
  request: NextRequest,
  body: unknown,
  correlationId: string,
) {
  const transport = validateSchedulerRequest(request);
  if (!transport.ok) {
    logInfo("scheduler.sync.rejected", {
      requestId: correlationId,
      operation: "MATCH_SYNC",
      result: transport.code,
    });
    return schedulerTransportErrorResponse(transport);
  }
  if (request.method === "GET" && new URL(request.url).search.length > 0) {
    return validationErrorResponse({
      request: ["scheduler query payload는 허용되지 않습니다."],
    });
  }

  try {
    const parsed = syncRequestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return validationErrorResponse({
        request: ["동기화 옵션을 다시 확인해 주세요."],
      });
    }
    const invocationKey = resolveSchedulerInvocationKey({
      mode: transport.trigger,
      ...(parsed.data.invocationKey
        ? { providedKey: parsed.data.invocationKey }
        : {}),
      now: new Date(),
    });
    if (!invocationKey) {
      return validationErrorResponse({
        invocationKey: [
          "GitHub/worker 호출은 재전송 방지를 위한 invocationKey가 필요합니다.",
        ],
      });
    }
    const result = await runMatchSync({
      ...parsed.data,
      invocationKey,
      trigger: transport.trigger,
      requestId: correlationId,
    });
    revalidatePublicDashboard();
    logInfo("scheduler.sync.completed", {
      requestId: correlationId,
      syncRunId: result.runId,
      operation: "MATCH_SYNC",
      result: result.status,
      processed: result.participantCount,
      newMatches: result.matchesProcessed,
      skipped: result.matchesSkipped,
      failed: result.errorCount,
      remaining: result.hasMore,
    });
    return noStoreJson(toSchedulerRunResponse(result));
  } catch (error) {
    const response = syncErrorResponse(error);
    if (response) return response;
    logError("scheduler.sync.failed", {
      requestId: correlationId,
      operation: "MATCH_SYNC",
      result: "FAILED",
    });
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "예약 경기 동기화를 실행하지 못했습니다.",
      status: 500,
    });
  }
}

export async function POST(request: NextRequest) {
  const correlationId = requestId(request);
  const transport = validateSchedulerRequest(request);
  if (!transport.ok) return schedulerTransportErrorResponse(transport);
  return executeSchedulerSync(
    request,
    (await readJsonBody(request)) ?? {},
    correlationId,
  );
}

export async function GET(request: NextRequest) {
  const correlationId = requestId(request);
  return executeSchedulerSync(request, {}, correlationId);
}
