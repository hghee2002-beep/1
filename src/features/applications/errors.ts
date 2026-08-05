import type { RiotIdentityErrorCode } from "@/features/riot/identity";

export type ApplicationErrorCode =
  | RiotIdentityErrorCode
  | "APPLICATION_PENDING_EXISTS"
  | "APPLICATION_ALREADY_APPROVED"
  | "APPLICATION_NOT_FOUND"
  | "APPLICATION_NOT_PENDING"
  | "APPLICATION_VERIFICATION_REQUIRED"
  | "DUPLICATE_RIOT_ACCOUNT"
  | "NO_JOINABLE_SEASON"
  | "AMBIGUOUS_ACTIVE_SEASON"
  | "LATE_JOIN_ACKNOWLEDGEMENT_REQUIRED"
  | "APPLICATION_REVIEW_CONFLICT";

export class ApplicationServiceError extends Error {
  override readonly name = "ApplicationServiceError";

  constructor(
    readonly code: ApplicationErrorCode,
    message: string,
    readonly retryable = false,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
