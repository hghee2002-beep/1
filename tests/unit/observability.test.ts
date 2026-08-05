import { describe, expect, it, vi } from "vitest";

import { createLogRecord } from "@/server/observability/logger";
import {
  createSyncHttpMetrics,
  observeRiotHttp,
  withSyncHttpMetrics,
} from "@/server/observability/sync-metrics";

describe("observability safety", () => {
  it("redacts secrets, query payloads, and participant PII recursively", () => {
    const record = createLogRecord(
      "error",
      "scheduler.failed",
      {
        authorization: "Bearer super-secret",
        requestId: "request-safe",
        query: { participantId: "participant-secret" },
        nested: {
          puuid: "PUUID-SECRET",
          nonce: "nonce-secret",
          errorCode: "RIOT_RATE_LIMITED",
        },
      },
      new Date("2026-08-05T00:00:00.000Z"),
    );

    expect(record).toMatchObject({
      requestId: "request-safe",
      authorization: "[REDACTED]",
      query: "[REDACTED]",
      nested: {
        puuid: "[REDACTED]",
        nonce: "[REDACTED]",
        errorCode: "RIOT_RATE_LIMITED",
      },
    });
    expect(JSON.stringify(record)).not.toContain("super-secret");
    expect(JSON.stringify(record)).not.toContain("PUUID-SECRET");
  });

  it("records retry and 429 backoff metadata in the active sync context", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const metrics = createSyncHttpMetrics();
    await withSyncHttpMetrics(metrics, async () => {
      observeRiotHttp({
        operation: "match.ids-by-puuid",
        correlationId: "correlation-safe",
        attempt: 1,
        durationMs: 12,
        status: 429,
        result: "RETRY",
        retryAfterSeconds: 17,
        rateLimit: null,
      });
      observeRiotHttp({
        operation: "match.ids-by-puuid",
        correlationId: "correlation-safe",
        attempt: 2,
        durationMs: 8,
        status: 200,
        result: "SUCCESS",
        retryAfterSeconds: null,
        rateLimit: null,
      });
    });

    expect(metrics).toMatchObject({
      apiCalls: 2,
      status2xx: 1,
      status429: 1,
      retries: 1,
      maxRetryAfterSeconds: 17,
    });
  });
});
