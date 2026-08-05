export type MvpServiceErrorCode =
  | "BASELINE_INVALID"
  | "BASELINE_CHECKSUM_MISMATCH"
  | "BASELINE_CONFIRMATION_REQUIRED"
  | "BASELINE_NAME_CONFLICT"
  | "BASELINE_NOT_FOUND";

export class MvpServiceError extends Error {
  override readonly name = "MvpServiceError";

  constructor(
    readonly code: MvpServiceErrorCode,
    message: string,
  ) {
    super(message);
  }
}
