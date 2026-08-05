import type { NextRequest } from "next/server";
import { revalidatePublicDashboard } from "@/server/dashboard/revalidation";

import { scoringBackfillInputSchema } from "@/features/scoring/validation";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import { scoringErrorResponse } from "@/server/scoring/http";
import { backfillMissionEvaluations } from "@/server/missions/evaluation-service";
import { backfillMvpEvaluations } from "@/server/mvp/evaluation-service";
import {
  autoRevealPointDraws,
  backfillUnscoredMatches,
} from "@/server/scoring/service";
import {
  schedulerTransportErrorResponse,
  validateSchedulerRequest,
} from "@/server/sync/http";

export const runtime = "nodejs";

async function executeSchedulerScoring(request: NextRequest, body: unknown) {
  const transport = validateSchedulerRequest(request);
  if (!transport.ok) return schedulerTransportErrorResponse(transport);
  if (request.method === "GET" && new URL(request.url).search.length > 0) {
    return validationErrorResponse({
      request: ["scheduler query payload는 허용되지 않습니다."],
    });
  }

  try {
    const parsed = scoringBackfillInputSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return validationErrorResponse({
        request: ["예약 점수 작업 옵션을 확인해 주세요."],
      });
    }
    const scope = {
      limit: parsed.data.limit,
      ...(parsed.data.seasonId === undefined
        ? {}
        : { seasonId: parsed.data.seasonId }),
    };
    const backfill = await backfillUnscoredMatches(scope);
    const [mvpEvaluation, autoReveal] = await Promise.all([
      backfillMvpEvaluations(scope),
      autoRevealPointDraws({ limit: parsed.data.limit }),
    ]);
    const missionEvaluation = await backfillMissionEvaluations(scope);
    revalidatePublicDashboard();
    return noStoreJson({
      ok: true,
      backfill,
      missionEvaluation,
      mvpEvaluation,
      autoReveal,
    });
  } catch (error) {
    const response = scoringErrorResponse(error);
    if (response) return response;
    console.error("scheduler.scoring.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "예약 점수 작업을 완료하지 못했습니다.",
      status: 500,
    });
  }
}

export async function POST(request: NextRequest) {
  const transport = validateSchedulerRequest(request);
  if (!transport.ok) return schedulerTransportErrorResponse(transport);
  return executeSchedulerScoring(request, (await readJsonBody(request)) ?? {});
}

export async function GET(request: NextRequest) {
  return executeSchedulerScoring(request, {});
}
