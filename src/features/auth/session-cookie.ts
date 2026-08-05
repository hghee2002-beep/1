export const AUTH_SESSION_COOKIE = "deluxe_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const REMEMBERED_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export function sessionCookieOptions(input: {
  production: boolean;
  maxAge: number;
}) {
  return {
    httpOnly: true,
    secure: input.production,
    sameSite: "lax" as const,
    path: "/",
    maxAge: input.maxAge,
  };
}
