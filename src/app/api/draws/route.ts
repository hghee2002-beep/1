import type { NextRequest } from "next/server";

import { requireApiUser } from "@/server/auth/guards";
import { authErrorResponse, noStoreJson } from "@/server/auth/http";
import { listMyPointDraws } from "@/server/scoring/read";
import { scoringErrorResponse } from "@/server/scoring/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiUser(request);
    const draws = await listMyPointDraws(session.user.id);
    return noStoreJson({ ok: true, draws });
  } catch (error) {
    const response = scoringErrorResponse(error);
    if (response) return response;
    console.error("point-draw.list.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "포인트 결과 목록을 불러오지 못했습니다.",
      status: 500,
    });
  }
}
