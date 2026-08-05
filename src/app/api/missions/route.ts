import type { NextRequest } from "next/server";

import { requireApiUser } from "@/server/auth/guards";
import { authErrorResponse, noStoreJson } from "@/server/auth/http";
import { missionErrorResponse } from "@/server/missions/http";
import { getMyMissionDashboard } from "@/server/missions/read";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiUser(request);
    const dashboard = await getMyMissionDashboard(session.user.id);
    return noStoreJson({ ok: true, dashboard });
  } catch (error) {
    const response = missionErrorResponse(error);
    if (response) return response;
    console.error("mission.dashboard.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "미션 상태를 불러오지 못했습니다.",
      status: 500,
    });
  }
}
