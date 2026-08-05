import type { NextRequest } from "next/server";

import { requireApiAdmin } from "@/server/auth/guards";
import { authErrorResponse, noStoreJson } from "@/server/auth/http";
import { getMvpEvaluationBreakdown } from "@/server/mvp/baseline-service";
import { mvpErrorResponse } from "@/server/mvp/http";

export const runtime = "nodejs";

type Context = { params: Promise<{ seasonMatchId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    await requireApiAdmin(request);
    const { seasonMatchId } = await context.params;
    return noStoreJson({
      ok: true,
      evaluation: await getMvpEvaluationBreakdown(seasonMatchId),
    });
  } catch (error) {
    const response = mvpErrorResponse(error);
    if (response) return response;
    console.error("admin.mvp-evaluations.detail.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "경기 평가 breakdown을 불러오지 못했습니다.",
      status: 500,
    });
  }
}
