export type RiotErrorCode =
  | "RIOT_ID_INVALID"
  | "RIOT_ACCOUNT_NOT_FOUND"
  | "RIOT_RESOURCE_NOT_FOUND"
  | "RIOT_KEY_INVALID"
  | "RIOT_RATE_LIMITED"
  | "RIOT_TEMPORARY_FAILURE"
  | "RIOT_NETWORK_FAILURE"
  | "RIOT_TIMEOUT"
  | "RIOT_MALFORMED_RESPONSE"
  | "RIOT_CONFIGURATION_ERROR"
  | "RIOT_TIMELINE_UNAVAILABLE"
  | "RIOT_STATIC_DATA_UNAVAILABLE";

export type RiotErrorDetails = {
  status?: number;
  operation?: string;
  correlationId?: string;
  cause?: unknown;
};

/**
 * Safe, normalized Riot boundary error. Messages must never contain request
 * headers, response bodies, API keys, PUUIDs, or raw URLs.
 */
export class RiotApiError extends Error {
  override readonly name = "RiotApiError";
  readonly status: number | undefined;
  readonly operation: string | undefined;
  readonly correlationId: string | undefined;

  constructor(
    readonly code: RiotErrorCode,
    message: string,
    readonly retryable = false,
    readonly retryAfterSeconds?: number,
    details: RiotErrorDetails = {},
  ) {
    super(
      message,
      details.cause === undefined ? undefined : { cause: details.cause },
    );
    this.status = details.status;
    this.operation = details.operation;
    this.correlationId = details.correlationId;
  }
}

export function isRiotApiError(error: unknown): error is RiotApiError {
  return error instanceof RiotApiError;
}
