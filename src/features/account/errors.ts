export class AccountSettingsError extends Error {
  override readonly name = "AccountSettingsError";

  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
