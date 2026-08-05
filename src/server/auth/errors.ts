import "server-only";

export type AuthErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_CREDENTIALS"
  | "LOGIN_ID_UNAVAILABLE"
  | "LEGAL_DOCUMENT_UNAVAILABLE"
  | "RATE_LIMITED"
  | "SESSION_ROTATION_CONFLICT";

export class AuthServiceError extends Error {
  override readonly name = "AuthServiceError";

  constructor(
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
  }
}
