import { describe, expect, it } from "vitest";

import { parsePublicEnv, parseServerEnv } from "@/lib/env/schema";

const validEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL:
    "postgresql://postgres:postgres@localhost:5432/deluxe_soloq_test",
  AUTH_SECRET: "auth-secret-with-at-least-32-characters",
  CRON_SECRET: "cron-secret-with-at-least-32-characters",
  MOCK_RIOT_API: "true",
  APP_URL: "http://localhost:3000",
  APP_TIME_ZONE: "Asia/Seoul",
} as const;

describe("environment schema", () => {
  it("applies safe operational defaults", () => {
    const environment = parseServerEnv(validEnvironment);

    expect(environment.MOCK_RIOT_API).toBe(true);
    expect(environment.SYNC_MODE).toBe("MANUAL");
    expect(environment.SYNC_BATCH_SIZE).toBe(5);
    expect(environment.SYNC_LEASE_RECOVERY_GRACE_SECONDS).toBe(30);
  });

  it("reports invalid field names without echoing secret values", () => {
    const exposedSecretCandidate = "do-not-echo-this";

    expect(() =>
      parseServerEnv({
        ...validEnvironment,
        AUTH_SECRET: exposedSecretCandidate,
        DATABASE_URL: "not-a-postgres-url",
      }),
    ).toThrowError(/AUTH_SECRET, DATABASE_URL/u);

    try {
      parseServerEnv({
        ...validEnvironment,
        AUTH_SECRET: exposedSecretCandidate,
      });
    } catch (error) {
      expect(String(error)).not.toContain(exposedSecretCandidate);
    }
  });

  it("validates the public polling interval bounds", () => {
    expect(() =>
      parsePublicEnv({ NEXT_PUBLIC_POLL_INTERVAL_MS: "1000" }),
    ).toThrowError(/NEXT_PUBLIC_POLL_INTERVAL_MS/u);
  });

  it("requires independent draw protection key material in production", () => {
    expect(() =>
      parseServerEnv({ ...validEnvironment, NODE_ENV: "production" }),
    ).toThrowError(/POINT_DRAW_SECRET/u);
    expect(
      parseServerEnv({
        ...validEnvironment,
        NODE_ENV: "production",
        POINT_DRAW_SECRET: "draw-secret-with-at-least-32-characters",
      }).POINT_DRAW_SECRET,
    ).toBe("draw-secret-with-at-least-32-characters");
  });
});
