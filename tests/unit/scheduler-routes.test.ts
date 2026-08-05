import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const scheduler = vi.hoisted(() => ({
  environment: {
    SYNC_MODE: "VERCEL_CRON" as
      "MANUAL" | "GITHUB_SCHEDULE" | "VERCEL_CRON" | "WORKER",
    CRON_SECRET: "scheduler-route-secret-with-at-least-32-characters",
  },
  backfillUnscoredMatches: vi.fn(async () => ({ processed: 0 })),
  autoRevealPointDraws: vi.fn(async () => ({ revealed: 0 })),
  backfillMissionEvaluations: vi.fn(async () => ({ processed: 0 })),
  backfillMvpEvaluations: vi.fn(async () => ({ processed: 0 })),
  runMissionLifecycleBatch: vi.fn(async () => ({ processed: 0 })),
  revalidatePublicDashboard: vi.fn(),
}));

vi.mock("@/lib/env/server", () => ({ serverEnv: scheduler.environment }));
vi.mock("@/server/scoring/service", () => ({
  backfillUnscoredMatches: scheduler.backfillUnscoredMatches,
  autoRevealPointDraws: scheduler.autoRevealPointDraws,
}));
vi.mock("@/server/missions/evaluation-service", () => ({
  backfillMissionEvaluations: scheduler.backfillMissionEvaluations,
}));
vi.mock("@/server/mvp/evaluation-service", () => ({
  backfillMvpEvaluations: scheduler.backfillMvpEvaluations,
}));
vi.mock("@/server/missions/service", () => ({
  runMissionLifecycleBatch: scheduler.runMissionLifecycleBatch,
}));
vi.mock("@/server/dashboard/revalidation", () => ({
  revalidatePublicDashboard: scheduler.revalidatePublicDashboard,
}));

import {
  GET as scoringGET,
  POST as scoringPOST,
} from "@/app/api/scheduler/scoring/route";
import {
  GET as missionsGET,
  POST as missionsPOST,
} from "@/app/api/scheduler/missions/route";

function request(path: string, method: "GET" | "POST") {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${scheduler.environment.CRON_SECRET}`,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: "{}" } : {}),
  });
}

describe("scheduler scoring and mission route transport", () => {
  beforeEach(() => {
    scheduler.environment.SYNC_MODE = "VERCEL_CRON";
  });

  it("runs both jobs through bodyless Vercel GET requests", async () => {
    const [scoringResponse, missionsResponse] = await Promise.all([
      scoringGET(request("/api/scheduler/scoring", "GET")),
      missionsGET(request("/api/scheduler/missions", "GET")),
    ]);

    expect(scoringResponse.status).toBe(200);
    expect(missionsResponse.status).toBe(200);
    expect(scheduler.backfillUnscoredMatches).toHaveBeenCalledWith({
      limit: 20,
    });
    expect(scheduler.runMissionLifecycleBatch).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 }),
    );
  });

  it("rejects POST in Vercel mode and disables both routes in MANUAL mode", async () => {
    const vercelResponse = await scoringPOST(
      request("/api/scheduler/scoring", "POST"),
    );
    expect(vercelResponse.status).toBe(405);
    expect(vercelResponse.headers.get("allow")).toBe("GET");

    scheduler.environment.SYNC_MODE = "MANUAL";
    const [scoringResponse, missionsResponse] = await Promise.all([
      scoringPOST(request("/api/scheduler/scoring", "POST")),
      missionsPOST(request("/api/scheduler/missions", "POST")),
    ]);
    expect(scoringResponse.status).toBe(409);
    expect(missionsResponse.status).toBe(409);
  });

  it("accepts signed JSON POST requests in GitHub schedule mode", async () => {
    scheduler.environment.SYNC_MODE = "GITHUB_SCHEDULE";
    const [scoringResponse, missionsResponse] = await Promise.all([
      scoringPOST(request("/api/scheduler/scoring", "POST")),
      missionsPOST(request("/api/scheduler/missions", "POST")),
    ]);
    expect(scoringResponse.status).toBe(200);
    expect(missionsResponse.status).toBe(200);
  });
});
