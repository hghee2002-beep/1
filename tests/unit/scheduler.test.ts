import { describe, expect, it } from "vitest";

import {
  resolveSchedulerInvocationKey,
  toSchedulerRunResponse,
  validateSchedulerTransport,
} from "@/features/sync/scheduler";

const secret = "scheduler-secret-with-at-least-32-characters";

function transport(
  overrides: Partial<Parameters<typeof validateSchedulerTransport>[0]> = {},
) {
  return validateSchedulerTransport({
    mode: "GITHUB_SCHEDULE",
    method: "POST",
    contentType: "application/json; charset=utf-8",
    authorization: `Bearer ${secret}`,
    secret,
    ...overrides,
  });
}

describe("scheduler transport contract", () => {
  it("rejects missing and wrong secrets without weakening method checks", () => {
    expect(transport({ authorization: null })).toMatchObject({
      ok: false,
      code: "SCHEDULER_UNAUTHORIZED",
      status: 401,
    });
    expect(transport({ authorization: "Bearer wrong" })).toMatchObject({
      ok: false,
      code: "SCHEDULER_UNAUTHORIZED",
      status: 401,
    });
    expect(transport({ method: "GET" })).toMatchObject({
      ok: false,
      code: "SCHEDULER_METHOD_NOT_ALLOWED",
      status: 405,
      allow: "POST",
    });
  });

  it("requires JSON for GitHub/worker and bodyless GET for Vercel", () => {
    expect(transport({ contentType: "text/plain" })).toMatchObject({
      ok: false,
      code: "SCHEDULER_UNSUPPORTED_MEDIA_TYPE",
      status: 415,
    });
    expect(transport()).toMatchObject({
      ok: true,
      trigger: "GITHUB_SCHEDULE",
    });
    expect(transport({ mode: "WORKER" })).toMatchObject({
      ok: true,
      trigger: "WORKER",
    });
    expect(
      transport({
        mode: "VERCEL_CRON",
        method: "GET",
        contentType: null,
      }),
    ).toMatchObject({ ok: true, trigger: "VERCEL_CRON" });
    expect(transport({ mode: "MANUAL" })).toMatchObject({
      ok: false,
      code: "SCHEDULER_DISABLED",
      status: 409,
    });
  });

  it("makes retries deterministic and reports continuation without internals", () => {
    const now = new Date("2026-08-05T03:04:59.000Z");
    expect(
      resolveSchedulerInvocationKey({ mode: "GITHUB_SCHEDULE", now }),
    ).toBeNull();
    expect(
      resolveSchedulerInvocationKey({
        mode: "GITHUB_SCHEDULE",
        providedKey: "github:123:1:sync",
        now,
      }),
    ).toBe("github:123:1:sync");
    expect(resolveSchedulerInvocationKey({ mode: "VERCEL_CRON", now })).toBe(
      "vercel:2026-08-05T03:04",
    );

    expect(
      toSchedulerRunResponse({
        runId: "run-id",
        status: "PARTIAL",
        participantCount: 2,
        matchIdsFound: 5,
        matchesFetched: 3,
        matchesProcessed: 2,
        matchesSkipped: 2,
        errorCount: 1,
        hasMore: true,
        dryRun: false,
      }),
    ).toEqual({
      runId: "run-id",
      processed: 2,
      new: 2,
      skipped: 2,
      failed: 1,
      remaining: true,
    });
  });
});
