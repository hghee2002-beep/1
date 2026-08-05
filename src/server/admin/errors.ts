import "server-only";

export class AdminOperationError extends Error {
  override readonly name = "AdminOperationError";

  constructor(
    readonly code:
      | "NOT_FOUND"
      | "CONFLICT"
      | "CONFIRMATION_MISMATCH"
      | "READINESS_BLOCKED"
      | "IMMUTABLE"
      | "PRODUCTION_BLOCKED",
    message: string,
  ) {
    super(message);
  }
}
