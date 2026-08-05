import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { UserStatus } from "@/generated/prisma/client";

import {
  signSessionToken,
  verifySessionToken,
} from "@/features/auth/session-token";
import type { AuthRole, AuthSessionView } from "@/features/auth/types";
import { serverEnv } from "@/lib/env/server";
import { AuthServiceError } from "@/server/auth/errors";
import { db } from "@/server/db/client";

type SessionPrincipal = {
  id: string;
  role: AuthRole;
  sessionVersion: number;
};

type PreparedSession = {
  jti: string;
  jtiHash: string;
  token: string;
  expiresAt: Date;
};

function hashJti(jti: string) {
  return createHash("sha256").update(jti).digest("hex");
}

async function prepareSession(
  user: SessionPrincipal,
  ttlSeconds: number,
  now: Date,
): Promise<PreparedSession> {
  const jti = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1_000);
  const token = await signSessionToken(
    {
      userId: user.id,
      role: user.role,
      jti,
      issuedAt: now,
      expiresAt,
    },
    serverEnv.AUTH_SECRET,
  );

  return { jti, jtiHash: hashJti(jti), token, expiresAt };
}

export async function createAuthSession(
  user: SessionPrincipal,
  ttlSeconds: number,
  now = new Date(),
) {
  const prepared = await prepareSession(user, ttlSeconds, now);
  const session = await db.authSession.create({
    data: {
      userId: user.id,
      jtiHash: prepared.jtiHash,
      sessionVersion: user.sessionVersion,
      expiresAt: prepared.expiresAt,
    },
    select: { id: true },
  });

  return { ...prepared, sessionId: session.id };
}

export async function resolveAuthSessionToken(
  token: string | undefined,
  now = new Date(),
): Promise<AuthSessionView | null> {
  if (!token) return null;
  const claims = await verifySessionToken(token, serverEnv.AUTH_SECRET, now);
  if (!claims) return null;

  const session = await db.authSession.findUnique({
    where: { jtiHash: hashJti(claims.jti) },
    select: {
      id: true,
      userId: true,
      sessionVersion: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          loginId: true,
          realName: true,
          role: true,
          status: true,
          sessionVersion: true,
          participant: {
            select: {
              id: true,
              gameName: true,
              tagLine: true,
              approvedAt: true,
            },
          },
        },
      },
    },
  });

  if (
    !session ||
    session.userId !== claims.userId ||
    session.revokedAt ||
    session.expiresAt <= now ||
    session.sessionVersion !== session.user.sessionVersion ||
    session.user.status !== UserStatus.ACTIVE ||
    session.user.role !== claims.role
  ) {
    return null;
  }

  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
    user: {
      id: session.user.id,
      loginId: session.user.loginId,
      displayName: session.user.realName,
      role: session.user.role,
      participant: session.user.participant,
    },
  };
}

export async function revokeAuthSessionToken(
  token: string | undefined,
  reason: string,
  now = new Date(),
) {
  if (!token) return;
  const claims = await verifySessionToken(token, serverEnv.AUTH_SECRET, now);
  if (!claims) return;

  await db.authSession.updateMany({
    where: {
      userId: claims.userId,
      jtiHash: hashJti(claims.jti),
      revokedAt: null,
    },
    data: { revokedAt: now, revokeReason: reason },
  });
}

export async function rotateAuthSession(
  current: AuthSessionView,
  ttlSeconds: number,
  now = new Date(),
) {
  const user = await db.user.findUnique({
    where: { id: current.user.id },
    select: { id: true, role: true, status: true, sessionVersion: true },
  });
  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new AuthServiceError("AUTH_REQUIRED", "로그인이 필요합니다.");
  }

  const prepared = await prepareSession(user, ttlSeconds, now);
  const sessionId = await db.$transaction(async (transaction) => {
    const revoked = await transaction.authSession.updateMany({
      where: {
        id: current.sessionId,
        userId: current.user.id,
        revokedAt: null,
        expiresAt: { gt: now },
        sessionVersion: user.sessionVersion,
      },
      data: { revokedAt: now, revokeReason: "ROTATED" },
    });
    if (revoked.count !== 1) {
      throw new AuthServiceError(
        "SESSION_ROTATION_CONFLICT",
        "세션이 이미 갱신되었거나 만료되었습니다.",
      );
    }

    const created = await transaction.authSession.create({
      data: {
        userId: user.id,
        jtiHash: prepared.jtiHash,
        sessionVersion: user.sessionVersion,
        expiresAt: prepared.expiresAt,
      },
      select: { id: true },
    });
    return created.id;
  });

  return { ...prepared, sessionId };
}
