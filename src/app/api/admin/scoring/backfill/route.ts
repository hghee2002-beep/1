import type { NextRequest } from "next/server";
import { revalidatePublicDashboard } from "@/server/dashboard/revalidation";

import {
  scoringBackfillInputSchema,
  scoringFieldErrors,
} from "@/features/scoring/validation";
import { requireApiAdmin } from "@/server/auth/guards";
import {
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  validationErrorResponse,
} from "@/server/auth/http";
import { hasTrustedOrigin } from "@/server/auth/origin";
import { recordAdminJobAudit } from "@/server/admin/job-audit";
import { consumeAdminMutationRateLimit } from "@/server/rate-limit/database";
import { scoringErrorResponse, scoringRequestId } from "@/server/scoring/http";
import { backfillMvpEvaluations } from "@/server/mvp/evaluation-service";
import { backfillUnscoredMatches } from "@/server/scoring/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return authErrorResponse({
      code: "CSRF_REJECTED",
      message: "요청 출처를 확인할 수 없습니다.",
      status: 403,
    });
  }
  try {
    const session = await requireApiAdmin(request);
    const retryAfter = await consumeAdminMutationRateLimit(
      request,
      session.user.id,
    );
    if (retryAfter > 0) {
      return authErrorResponse({
        code: "RATE_LIMITED",
        message: "관리자 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        status: 429,
        retryAfterSeconds: retryAfter,
      });
    }
    const parsed = scoringBackfillInputSchema.safeParse(
      (await readJsonBody(request)) ?? {},
    );
    if (!parsed.success) {
      return validationErrorResponse(scoringFieldErrors(parsed.error));
    }
    const scope = {
      limit: parsed.data.limit,
      ...(parsed.data.seasonId === undefined
        ? {}
        : { seasonId: parsed.data.seasonId }),
    };
    const requestId = scoringRequestId(request);
    const scoring = await backfillUnscoredMatches(scope);
    const mvpEvaluation = await backfillMvpEvaluations(scope);
    await recordAdminJobAudit({
      actorUserId: session.user.id,
      action: "ADMIN_SCORING_BACKFILL_COMPLETED",
      targetType: "ScoringBackfill",
      ...(parsed.data.seasonId === undefined
        ? {}
        : { targetId: parsed.data.seasonId }),
      reason: "관리자 API 점수 및 MVP backfill",
      after: {
        seasonId: parsed.data.seasonId ?? null,
        limit: parsed.data.limit,
        scoring,
        mvpEvaluation,
      },
      requestId,
    });
    revalidatePublicDashboard();
    return noStoreJson({ ok: true, result: { scoring, mvpEvaluation } });
  } catch (error) {
    const response = scoringErrorResponse(error);
    if (response) return response;
    console.error("admin.scoring-backfill.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "미정산 경기 복구를 실행하지 못했습니다.",
      status: 500,
    });
  }
}
