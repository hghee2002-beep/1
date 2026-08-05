export type SyncErrorCode =
  | "JOB_ALREADY_RUNNING"
  | "SYNC_SEASON_NOT_FOUND"
  | "SYNC_SEASON_AMBIGUOUS"
  | "SYNC_SEASON_CLOSED"
  | "SYNC_PARTICIPANT_NOT_FOUND"
  | "SYNC_INVOCATION_CONFLICT";

export class SyncServiceError extends Error {
  override readonly name = "SyncServiceError";

  constructor(
    readonly code: SyncErrorCode,
    message: string,
  ) {
    super(message);
  }
}
