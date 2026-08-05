import { SignJWT, jwtVerify } from "jose";

import type { AuthRole } from "@/features/auth/types";

export type SessionTokenClaims = {
  userId: string;
  role: AuthRole;
  jti: string;
  issuedAt: Date;
  expiresAt: Date;
};

function secretKey(secret: string) {
  return new TextEncoder().encode(secret);
}

export function signSessionToken(claims: SessionTokenClaims, secret: string) {
  return new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.userId)
    .setJti(claims.jti)
    .setIssuedAt(Math.floor(claims.issuedAt.getTime() / 1_000))
    .setExpirationTime(Math.floor(claims.expiresAt.getTime() / 1_000))
    .sign(secretKey(secret));
}

export async function verifySessionToken(
  token: string,
  secret: string,
  now = new Date(),
): Promise<SessionTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret), {
      algorithms: ["HS256"],
      currentDate: now,
    });

    if (
      typeof payload.sub !== "string" ||
      typeof payload.jti !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      (payload.role !== "USER" && payload.role !== "ADMIN")
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      role: payload.role,
      jti: payload.jti,
      issuedAt: new Date(payload.iat * 1_000),
      expiresAt: new Date(payload.exp * 1_000),
    };
  } catch {
    return null;
  }
}
