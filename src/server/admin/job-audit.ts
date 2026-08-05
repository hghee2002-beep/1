import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

type AdminJobAuditInput = {
  actorUserId: string;
  action: "ADMIN_MATCH_SYNC_COMPLETED" | "ADMIN_SCORING_BACKFILL_COMPLETED";
  targetType: "SyncRun" | "ScoringBackfill";
  targetId?: string;
  reason: string;
  after: Prisma.InputJsonValue;
  requestId: string;
};

export async function recordAdminJobAudit(input: AdminJobAuditInput) {
  return db.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT 1::integer AS locked
      FROM pg_advisory_xact_lock(
        hashtextextended(${`admin-job-audit:${input.action}:${input.requestId}`}, 0)
      )
    `;
    const existing = await transaction.auditLog.findFirst({
      where: { action: input.action, requestId: input.requestId },
      select: { id: true },
    });
    if (existing) return existing;

    return transaction.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        reason: input.reason,
        after: input.after,
        requestId: input.requestId,
      },
      select: { id: true },
    });
  });
}
