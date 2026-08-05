import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import type { RiotHttpObservation } from "@/server/riot/http-client";
import { logInfo, logWarn } from "@/server/observability/logger";

export type SyncHttpMetrics = {
  apiCalls: number;
  status2xx: number;
  status404: number;
  status429: number;
  status5xx: number;
  other4xx: number;
  networkErrors: number;
  retries: number;
  maxRetryAfterSeconds: number;
};

const storage = new AsyncLocalStorage<SyncHttpMetrics>();

export function createSyncHttpMetrics(): SyncHttpMetrics {
  return {
    apiCalls: 0,
    status2xx: 0,
    status404: 0,
    status429: 0,
    status5xx: 0,
    other4xx: 0,
    networkErrors: 0,
    retries: 0,
    maxRetryAfterSeconds: 0,
  };
}

export function withSyncHttpMetrics<T>(
  metrics: SyncHttpMetrics,
  operation: () => Promise<T>,
) {
  return storage.run(metrics, operation);
}

export function observeRiotHttp(observation: RiotHttpObservation) {
  const metrics = storage.getStore();
  if (metrics) {
    metrics.apiCalls += 1;
    if (observation.status === null) metrics.networkErrors += 1;
    else if (observation.status >= 200 && observation.status < 300)
      metrics.status2xx += 1;
    else if (observation.status === 404) metrics.status404 += 1;
    else if (observation.status === 429) metrics.status429 += 1;
    else if (observation.status >= 500) metrics.status5xx += 1;
    else if (observation.status >= 400) metrics.other4xx += 1;
    if (observation.result === "RETRY") metrics.retries += 1;
    metrics.maxRetryAfterSeconds = Math.max(
      metrics.maxRetryAfterSeconds,
      observation.retryAfterSeconds ?? 0,
    );
  }

  const fields = {
    requestId: observation.correlationId,
    operation: observation.operation,
    attempt: observation.attempt,
    durationMs: observation.durationMs,
    status: observation.status,
    result: observation.result,
    retryAfterSeconds: observation.retryAfterSeconds,
    rateLimit: observation.rateLimit,
  };
  if (observation.result === "SUCCESS") logInfo("riot.http", fields);
  else logWarn("riot.http", fields);
}
