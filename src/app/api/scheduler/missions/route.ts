import type { NextRequest } from "next/server";
import { revalidatePublicDashboard } from "@/server/dashboard/revalidation";

import { missionLifecycleInputSchema } from "@/features/missions/validation";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import { missionErrorResponse } from "@/server/missions/http";
import { runMissionLifecycleBatch } from "@/server/missions/service";
import {
  schedulerTransportErrorResponse,
  validateSchedulerRequest,
} from "@/server/sync/http";

export const runtime = "nodejs";

async function executeSchedulerMissions(request: NextRequest, body: unknown) {
  const transport = validateSchedulerRequest(request);
  if (!transport.ok) return schedulerTransportErrorResponse(transport);
  if (request.method === "GET" && new URL(request.url).search.length > 0) {
    return validationErrorResponse({
      request: ["scheduler query payload는 허용되지 않습니다."],
    });
  }

  try {
    const parsed = missionLifecycleInputSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return validationErrorResponse({
        request: ["예약 미션 작업 옵션을 확인해 주세요."],
      });
    }
    const result = await runMissionLifecycleBatch({
      now: new Date(),
      limit: parsed.data.limit,
    });
    revalidatePublicDashboard();
    return noStoreJson({ ok: true, result });
  } catch (error) {
    const response = missionErrorResponse(error);
    if (response) return response;
    console.error("scheduler.missions.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "예약 미션 작업을 완료하지 못했습니다.",
      status: 500,
    });
  }
}

export async function POST(request: NextRequest) {
  const transport = validateSchedulerRequest(request);
  if (!transport.ok) return schedulerTransportErrorResponse(transport);
  return executeSchedulerMissions(request, (await readJsonBody(request)) ?? {});
}

export async function GET(request: NextRequest) {
  return executeSchedulerMissions(request, {});
}
