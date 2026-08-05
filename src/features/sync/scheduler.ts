import { timingSafeEqual } from "node:crypto";

import type { SyncRunSummary } from "@/features/sync/types";

export type SchedulerMode =
  "MANUAL" | "GITHUB_SCHEDULE" | "VERCEL_CRON" | "WORKER";

export type SchedulerTransportResult =
  | {
      ok: true;
      trigger: "GITHUB_SCHEDULE" | "VERCEL_CRON" | "WORKER";
    }
  | {
      ok: false;
      code:
        | "SCHEDULER_DISABLED"
        | "SCHEDULER_METHOD_NOT_ALLOWED"
        | "SCHEDULER_UNAUTHORIZED"
        | "SCHEDULER_UNSUPPORTED_MEDIA_TYPE";
      status: 401 | 405 | 409 | 415;
      allow?: "GET" | "POST";
    };

function secureEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function hasValidSchedulerSecret(
  authorization: string | null,
  secret: string,
) {
  return secureEqual(authorization ?? "", `Bearer ${secret}`);
}

export function validateSchedulerTransport(input: {
  mode: SchedulerMode;
  method: string;
  contentType: string | null;
  authorization: string | null;
  secret: string;
}): SchedulerTransportResult {
  if (!hasValidSchedulerSecret(input.authorization, input.secret)) {
    return { ok: false, code: "SCHEDULER_UNAUTHORIZED", status: 401 };
  }

  if (input.mode === "MANUAL") {
    return { ok: false, code: "SCHEDULER_DISABLED", status: 409 };
  }

  const expectedMethod = input.mode === "VERCEL_CRON" ? "GET" : "POST";
  if (input.method.toUpperCase() !== expectedMethod) {
    return {
      ok: false,
      code: "SCHEDULER_METHOD_NOT_ALLOWED",
      status: 405,
      allow: expectedMethod,
    };
  }

  if (
    expectedMethod === "POST" &&
    input.contentType?.split(";", 1)[0]?.trim().toLowerCase() !==
      "application/json"
  ) {
    return {
      ok: false,
      code: "SCHEDULER_UNSUPPORTED_MEDIA_TYPE",
      status: 415,
    };
  }

  return { ok: true, trigger: input.mode };
}

export function resolveSchedulerInvocationKey(input: {
  mode: Exclude<SchedulerMode, "MANUAL">;
  providedKey?: string;
  now: Date;
}) {
  if (input.mode === "VERCEL_CRON") {
    // Vercel Cron sends a bodyless GET and does not provide a delivery ID.
    // A UTC minute bucket makes duplicate delivery in the same scheduled minute
    // a deterministic no-op through SyncRun.invocationKey.
    return `vercel:${input.now.toISOString().slice(0, 16)}`;
  }
  const key = input.providedKey?.trim();
  return key && key.length >= 8 ? key : null;
}

export function toSchedulerRunResponse(summary: SyncRunSummary) {
  return {
    runId: summary.runId,
    processed: summary.participantCount,
    new: summary.matchesProcessed,
    skipped: summary.matchesSkipped,
    failed: summary.errorCount,
    remaining: summary.hasMore,
  };
}
