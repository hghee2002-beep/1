import type { NextRequest } from "next/server";

import { requireApiAdmin } from "@/server/auth/guards";
import { authErrorResponse, noStoreJson } from "@/server/auth/http";
import { getMvpBaselineDetail } from "@/server/mvp/baseline-service";
import { mvpErrorResponse } from "@/server/mvp/http";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    await requireApiAdmin(request);
    const { id } = await context.params;
    return noStoreJson({
      ok: true,
      baseline: await getMvpBaselineDetail(id),
    });
  } catch (error) {
    const response = mvpErrorResponse(error);
    if (response) return response;
    console.error("admin.mvp-baselines.detail.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "baseline 상세를 불러오지 못했습니다.",
      status: 500,
    });
  }
}
