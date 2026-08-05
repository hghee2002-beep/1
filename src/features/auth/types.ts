export type AuthRole = "USER" | "ADMIN";

export type AuthParticipant = {
  id: string;
  gameName: string;
  tagLine: string;
  approvedAt: Date;
};

export type AuthViewer = {
  id: string;
  loginId: string;
  displayName: string;
  role: AuthRole;
  participant: AuthParticipant | null;
};

export type AuthSessionView = {
  sessionId: string;
  user: AuthViewer;
  expiresAt: Date;
};

export type AuthFieldErrors = Record<string, string[]>;

export type AuthApiErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
    fields?: AuthFieldErrors;
  };
};

export function isAuthApiErrorBody(value: unknown): value is AuthApiErrorBody {
  if (!value || typeof value !== "object" || !("ok" in value)) return false;
  if (value.ok !== false || !("error" in value)) return false;

  const error = value.error;
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string",
  );
}
