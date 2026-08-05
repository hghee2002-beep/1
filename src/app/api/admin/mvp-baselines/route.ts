import type { NextRequest } from "next/server";

import { requireApiAdmin } from "@/server/auth/guards";
import { authErrorResponse, noStoreJson } from "@/server/auth/http";
import { listMvpBaselines } from "@/server/mvp/baseline-service";
import { mvpErrorResponse } from "@/server/mvp/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireApiAdmin(request);
    return noStoreJson({ ok: true, baselines: await listMvpBaselines() });
  } catch (error) {
    const response = mvpErrorResponse(error);
    if (response) return response;
    console.error("admin.mvp-baselines.list.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "baseline 목록을 불러오지 못했습니다.",
      status: 500,
    });
  }
}
