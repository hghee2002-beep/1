import "server-only";

import { randomUUID } from "node:crypto";

import { RiotApiError } from "@/features/riot/errors";

export type RiotRateLimitObservation = {
  appLimit: string | null;
  appCount: string | null;
  methodLimit: string | null;
  methodCount: string | null;
  limitType: string | null;
};

export type RiotHttpObservation = {
  operation: string;
  correlationId: string;
  attempt: number;
  durationMs: number;
  status: number | null;
  result: "SUCCESS" | "RETRY" | "ERROR";
  retryAfterSeconds: number | null;
  rateLimit: RiotRateLimitObservation | null;
};

export type RiotHttpClientOptions = {
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  logger?: (observation: RiotHttpObservation) => void;
};

export type RiotHttpRequest = {
  host: string;
  path: string;
  operation: string;
  query?: Readonly<Record<string, string | number | undefined>>;
  correlationId?: string;
};

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_RETRY_DELAY_MS = 250;
const DEFAULT_MAX_RETRY_DELAY_MS = 120_000;

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function rateLimitObservation(
  headers: Headers,
): RiotRateLimitObservation | null {
  const observation = {
    appLimit: headers.get("x-app-rate-limit"),
    appCount: headers.get("x-app-rate-limit-count"),
    methodLimit: headers.get("x-method-rate-limit"),
    methodCount: headers.get("x-method-rate-limit-count"),
    limitType: headers.get("x-rate-limit-type"),
  };
  return Object.values(observation).some((value) => value !== null)
    ? observation
    : null;
}

export function parseRetryAfterSeconds(
  value: string | null,
  nowMs = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return Math.ceil(numeric);
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return undefined;
  return Math.max(0, Math.ceil((timestamp - nowMs) / 1_000));
}

function isAbortError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

function safeErrorForStatus(input: {
  status: number;
  operation: string;
  correlationId: string;
  retryAfterSeconds?: number;
}) {
  const details = {
    status: input.status,
    operation: input.operation,
    correlationId: input.correlationId,
  };
  if (input.status === 401 || input.status === 403) {
    return new RiotApiError(
      "RIOT_KEY_INVALID",
      "Riot API 자격 증명 또는 endpoint 권한을 확인할 수 없습니다.",
      false,
      undefined,
      details,
    );
  }
  if (input.status === 404) {
    return new RiotApiError(
      "RIOT_RESOURCE_NOT_FOUND",
      "요청한 Riot 리소스를 찾을 수 없습니다.",
      false,
      undefined,
      details,
    );
  }
  if (input.status === 429) {
    return new RiotApiError(
      "RIOT_RATE_LIMITED",
      "Riot API 요청 한도에 도달했습니다.",
      true,
      input.retryAfterSeconds,
      details,
    );
  }
  if (input.status >= 500) {
    return new RiotApiError(
      "RIOT_TEMPORARY_FAILURE",
      "Riot API가 일시적으로 응답하지 않습니다.",
      true,
      undefined,
      details,
    );
  }
  return new RiotApiError(
    "RIOT_TEMPORARY_FAILURE",
    "Riot API 요청을 처리하지 못했습니다.",
    false,
    undefined,
    details,
  );
}

export class RiotHttpClient {
  private readonly apiKey: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly baseRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly logger: (observation: RiotHttpObservation) => void;

  constructor(options: RiotHttpClientOptions) {
    if (!options.apiKey.trim()) {
      throw new RiotApiError(
        "RIOT_CONFIGURATION_ERROR",
        "실 Riot API 모드에는 서버 자격 증명이 필요합니다.",
      );
    }
    this.apiKey = options.apiKey;
    this.fetchImplementation = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.baseRetryDelayMs =
      options.baseRetryDelayMs ?? DEFAULT_BASE_RETRY_DELAY_MS;
    this.maxRetryDelayMs =
      options.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
    this.logger = options.logger ?? (() => undefined);
  }

  async requestJson(request: RiotHttpRequest): Promise<unknown> {
    const correlationId = request.correlationId ?? randomUUID();
    const url = new URL(request.path, `https://${request.host}`);
    for (const [key, value] of Object.entries(request.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt += 1) {
      const startedAt = this.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      let response: Response;

      try {
        response = await this.fetchImplementation(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "X-Riot-Token": this.apiKey,
          },
          signal: controller.signal,
          cache: "no-store",
        });
      } catch (error) {
        clearTimeout(timeout);
        const retryable = attempt <= this.maxRetries;
        const normalized = isAbortError(error)
          ? new RiotApiError(
              "RIOT_TIMEOUT",
              "Riot API 응답 시간이 초과되었습니다.",
              true,
              undefined,
              { operation: request.operation, correlationId, cause: error },
            )
          : new RiotApiError(
              "RIOT_NETWORK_FAILURE",
              "Riot API 네트워크 요청에 실패했습니다.",
              true,
              undefined,
              { operation: request.operation, correlationId, cause: error },
            );
        this.logger({
          operation: request.operation,
          correlationId,
          attempt,
          durationMs: Math.max(0, this.now() - startedAt),
          status: null,
          result: retryable ? "RETRY" : "ERROR",
          retryAfterSeconds: null,
          rateLimit: null,
        });
        if (!retryable) throw normalized;
        await this.sleep(this.exponentialDelay(attempt));
        continue;
      } finally {
        clearTimeout(timeout);
      }

      const durationMs = Math.max(0, this.now() - startedAt);
      const retryAfterSeconds = parseRetryAfterSeconds(
        response.headers.get("retry-after"),
        this.now(),
      );
      const rateLimit = rateLimitObservation(response.headers);

      if (response.ok) {
        this.logger({
          operation: request.operation,
          correlationId,
          attempt,
          durationMs,
          status: response.status,
          result: "SUCCESS",
          retryAfterSeconds: retryAfterSeconds ?? null,
          rateLimit,
        });
        try {
          return await response.json();
        } catch (error) {
          throw new RiotApiError(
            "RIOT_MALFORMED_RESPONSE",
            "Riot API가 올바른 JSON 응답을 반환하지 않았습니다.",
            true,
            undefined,
            { operation: request.operation, correlationId, cause: error },
          );
        }
      }

      const statusError = safeErrorForStatus({
        status: response.status,
        operation: request.operation,
        correlationId,
        ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
      });
      const statusRetryable = response.status === 429 || response.status >= 500;
      const attemptsRemain = attempt <= this.maxRetries;
      const retryDelay =
        response.status === 429 && retryAfterSeconds !== undefined
          ? retryAfterSeconds * 1_000
          : this.exponentialDelay(attempt);
      const canRetry =
        statusRetryable && attemptsRemain && retryDelay <= this.maxRetryDelayMs;
      this.logger({
        operation: request.operation,
        correlationId,
        attempt,
        durationMs,
        status: response.status,
        result: canRetry ? "RETRY" : "ERROR",
        retryAfterSeconds: retryAfterSeconds ?? null,
        rateLimit,
      });
      if (!canRetry) throw statusError;
      await this.sleep(retryDelay);
    }

    throw new RiotApiError(
      "RIOT_TEMPORARY_FAILURE",
      "Riot API 재시도 한도를 초과했습니다.",
      true,
    );
  }

  private exponentialDelay(attempt: number) {
    const exponential = this.baseRetryDelayMs * 2 ** Math.max(0, attempt - 1);
    const jitter = Math.floor(this.random() * this.baseRetryDelayMs);
    return Math.min(this.maxRetryDelayMs, exponential + jitter);
  }
}
