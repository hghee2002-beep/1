import type { NextRequest } from "next/server";
import { z } from "zod";

import { missionRerollInputSchema } from "@/features/missions/validation";
import { requireApiUser } from "@/server/auth/guards";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import { hasTrustedOrigin } from "@/server/auth/origin";
import { missionErrorResponse } from "@/server/missions/http";
import { rerollMissionAssignment } from "@/server/missions/service";
import { consumeMissionMutationRateLimit } from "@/server/rate-limit/database";
import { revalidatePublicDashboard } from "@/server/dashboard/revalidation";

export const runtime = "nodejs";

type Context = { params: Promise<{ assignmentId: string }> };

export async function POST(request: NextRequest, context: Context) {
  if (!hasTrustedOrigin(request)) {
    return authErrorResponse({
      code: "CSRF_REJECTED",
      message: "요청 출처를 확인할 수 없습니다.",
      status: 403,
    });
  }
  try {
    const session = await requireApiUser(request);
    const retryAfter = await consumeMissionMutationRateLimit(
      request,
      session.user.id,
    );
    if (retryAfter > 0) {
      return authErrorResponse({
        code: "RATE_LIMITED",
        message: "미션 리롤 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        status: 429,
        retryAfterSeconds: retryAfter,
      });
    }
    const parsed = missionRerollInputSchema.safeParse(
      await readJsonBody(request),
    );
    const params = await context.params;
    const assignmentId = z.uuid().safeParse(params.assignmentId);
    if (!parsed.success || !assignmentId.success) {
      return validationErrorResponse({
        request: ["미션 리롤 요청 값을 확인해 주세요."],
      });
    }
    const result = await rerollMissionAssignment({
      assignmentId: assignmentId.data,
      userId: session.user.id,
      idempotencyKey: parsed.data.idempotencyKey,
      now: new Date(),
    });
    revalidatePublicDashboard();
    return noStoreJson({ ok: true, result });
  } catch (error) {
    const response = missionErrorResponse(error);
    if (response) return response;
    console.error("mission.reroll.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "미션을 리롤하지 못했습니다.",
      status: 500,
    });
  }
}
