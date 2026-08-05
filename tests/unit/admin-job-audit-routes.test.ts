import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const jobs = vi.hoisted(() => ({
  requireApiAdmin: vi.fn(async () => ({ user: { id: "admin-user-id" } })),
  consumeAdminMutationRateLimit: vi.fn(async () => 0),
  recordAdminJobAudit: vi.fn(async () => ({ id: "audit-id" })),
  runMatchSync: vi.fn(async () => ({
    runId: "sync-run-id",
    status: "SUCCEEDED",
    participantCount: 2,
    matchIdsFound: 3,
    matchesFetched: 3,
    matchesProcessed: 2,
    matchesSkipped: 1,
    errorCount: 0,
    hasMore: false,
    dryRun: false,
  })),
  backfillUnscoredMatches: vi.fn(async () => ({
    examined: 2,
    processed: 2,
    failed: 0,
  })),
  backfillMvpEvaluations: vi.fn(async () => ({
    examined: 2,
    processed: 2,
    skipped: 0,
    failed: 0,
  })),
  revalidatePublicDashboard: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  requireApiAdmin: jobs.requireApiAdmin,
}));
vi.mock("@/server/auth/origin", () => ({ hasTrustedOrigin: () => true }));
vi.mock("@/server/rate-limit/database", () => ({
  consumeAdminMutationRateLimit: jobs.consumeAdminMutationRateLimit,
}));
vi.mock("@/server/admin/job-audit", () => ({
  recordAdminJobAudit: jobs.recordAdminJobAudit,
}));
vi.mock("@/server/sync/service", () => ({ runMatchSync: jobs.runMatchSync }));
vi.mock("@/server/sync/http", () => ({ syncErrorResponse: () => null }));
vi.mock("@/server/scoring/http", () => ({
  scoringErrorResponse: () => null,
  scoringRequestId: () => "admin-job-request-id",
}));
vi.mock("@/server/scoring/service", () => ({
  backfillUnscoredMatches: jobs.backfillUnscoredMatches,
}));
vi.mock("@/server/mvp/evaluation-service", () => ({
  backfillMvpEvaluations: jobs.backfillMvpEvaluations,
}));
vi.mock("@/server/dashboard/revalidation", () => ({
  revalidatePublicDashboard: jobs.revalidatePublicDashboard,
}));

import { POST as syncPOST } from "@/app/api/admin/sync/route";
import { POST as backfillPOST } from "@/app/api/admin/scoring/backfill/route";

function request(path: string, body: object) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("admin job route audit trail", () => {
  beforeEach(() => {
    jobs.recordAdminJobAudit.mockClear();
  });

  it("records the actor and sanitized result for a manual sync", async () => {
    const response = await syncPOST(request("/api/admin/sync", {}));

    expect(response.status).toBe(200);
    expect(jobs.recordAdminJobAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-user-id",
        action: "ADMIN_MATCH_SYNC_COMPLETED",
        targetType: "SyncRun",
        targetId: "sync-run-id",
        requestId: "admin-job-request-id",
      }),
    );
  });

  it("records the actor and bounded scope for a scoring backfill", async () => {
    const seasonId = "00000000-0000-4000-8000-000000000001";
    const response = await backfillPOST(
      request("/api/admin/scoring/backfill", { seasonId, limit: 10 }),
    );

    expect(response.status).toBe(200);
    expect(jobs.recordAdminJobAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-user-id",
        action: "ADMIN_SCORING_BACKFILL_COMPLETED",
        targetType: "ScoringBackfill",
        targetId: seasonId,
        requestId: "admin-job-request-id",
      }),
    );
  });
});
