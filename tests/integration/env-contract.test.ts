import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { parseServerEnv } from "@/lib/env/schema";

describe("live Riot environment contract", () => {
  it("requires a Riot API key when mock mode is disabled", () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: "test",
        DATABASE_URL:
          "postgresql://postgres:postgres@localhost:5432/deluxe_soloq_test",
        AUTH_SECRET: "auth-secret-with-at-least-32-characters",
        CRON_SECRET: "cron-secret-with-at-least-32-characters",
        MOCK_RIOT_API: "false",
        APP_URL: "http://localhost:3000",
        APP_TIME_ZONE: "Asia/Seoul",
      }),
    ).toThrowError(/RIOT_API_KEY/u);
  });

  it("rejects the scheduler endpoint before any work when the bearer secret is missing", async () => {
    Object.assign(process.env, {
      NODE_ENV: "test",
      DATABASE_URL:
        "postgresql://postgres:postgres@localhost:5432/deluxe_soloq_test",
      AUTH_SECRET: "scheduler-test-auth-secret-at-least-32-characters",
      CRON_SECRET: "scheduler-test-cron-secret-at-least-32-characters",
      MOCK_RIOT_API: "true",
      APP_URL: "http://localhost:3000",
      APP_TIME_ZONE: "Asia/Seoul",
    });
    const route = await import("@/app/api/scheduler/sync/route");
    const response = await route.POST(
      new NextRequest("http://localhost:3000/api/scheduler/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "SCHEDULER_UNAUTHORIZED" },
    });
  });
});
