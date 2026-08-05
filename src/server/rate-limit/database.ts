import "server-only";

import { createHmac } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import { serverEnv } from "@/lib/env/server";

const MINUTE_MS = 60_000;

type RateLimitRule = {
  limit: number;
  windowMs: number;
  blockMs: number;
};

type RateLimitEntry = {
  keyHash: string;
  rule: RateLimitRule;
};

const LOGIN_PAIR_RULE: RateLimitRule = {
  limit: 5,
  windowMs: 15 * MINUTE_MS,
  blockMs: 15 * MINUTE_MS,
};

const LOGIN_ACCOUNT_RULE: RateLimitRule = {
  limit: 20,
  windowMs: 60 * MINUTE_MS,
  blockMs: 30 * MINUTE_MS,
};

const SIGNUP_RULE: RateLimitRule = {
  limit: 10,
  windowMs: 15 * MINUTE_MS,
  blockMs: 15 * MINUTE_MS,
};

const APPLICATION_RULE: RateLimitRule = {
  limit: 10,
  windowMs: 15 * MINUTE_MS,
  blockMs: 15 * MINUTE_MS,
};

const ACCOUNT_MUTATION_RULE: RateLimitRule = {
  limit: 10,
  windowMs: 15 * MINUTE_MS,
  blockMs: 15 * MINUTE_MS,
};

const ADMIN_MUTATION_RULE: RateLimitRule = {
  limit: 60,
  windowMs: 15 * MINUTE_MS,
  blockMs: 15 * MINUTE_MS,
};

const POINT_DRAW_MUTATION_RULE: RateLimitRule = {
  limit: 30,
  windowMs: 15 * MINUTE_MS,
  blockMs: 15 * MINUTE_MS,
};

const MISSION_MUTATION_RULE: RateLimitRule = {
  limit: 30,
  windowMs: 15 * MINUTE_MS,
  blockMs: 15 * MINUTE_MS,
};

function hashKey(value: string) {
  return createHmac("sha256", serverEnv.AUTH_SECRET)
    .update(value)
    .digest("hex");
}

export function requestClientAddress(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || "unknown";
}

function currentWindow(now: Date, windowMs: number) {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

async function lockRateLimitKeys(
  transaction: Prisma.TransactionClient,
  keyHashes: readonly string[],
) {
  for (const keyHash of [...new Set(keyHashes)].sort()) {
    await transaction.$queryRaw`
      SELECT 1::integer AS locked
      FROM pg_advisory_xact_lock(hashtextextended(${keyHash}, 0))
    `;
  }
}

async function retryAfterFor(
  transaction: Prisma.TransactionClient,
  keyHashes: readonly string[],
  now: Date,
) {
  const blocked = await transaction.loginAttempt.findFirst({
    where: {
      keyHash: { in: [...keyHashes] },
      blockedUntil: { gt: now },
    },
    orderBy: { blockedUntil: "desc" },
    select: { blockedUntil: true },
  });

  if (!blocked?.blockedUntil) return 0;
  return Math.max(
    1,
    Math.ceil((blocked.blockedUntil.getTime() - now.getTime()) / 1_000),
  );
}

async function recordAttempt(
  transaction: Prisma.TransactionClient,
  keyHash: string,
  rule: RateLimitRule,
  now: Date,
) {
  const windowStart = currentWindow(now, rule.windowMs);
  const attempt = await transaction.loginAttempt.upsert({
    where: { keyHash_windowStart: { keyHash, windowStart } },
    update: { count: { increment: 1 } },
    create: { keyHash, windowStart, count: 1 },
    select: { id: true, count: true },
  });

  if (attempt.count >= rule.limit) {
    await transaction.loginAttempt.update({
      where: { id: attempt.id },
      data: { blockedUntil: new Date(now.getTime() + rule.blockMs) },
    });
  }

  return attempt.count;
}

async function consumeRateLimits(
  entries: readonly RateLimitEntry[],
  now: Date,
) {
  return db.$transaction(async (transaction) => {
    const keyHashes = entries.map((entry) => entry.keyHash);
    await lockRateLimitKeys(transaction, keyHashes);

    const alreadyBlocked = await retryAfterFor(transaction, keyHashes, now);
    if (alreadyBlocked > 0) return alreadyBlocked;

    let retryAfter = 0;
    for (const entry of entries) {
      const count = await recordAttempt(
        transaction,
        entry.keyHash,
        entry.rule,
        now,
      );
      if (count > entry.rule.limit) {
        retryAfter = Math.max(
          retryAfter,
          Math.ceil(entry.rule.blockMs / 1_000),
        );
      }
    }
    return retryAfter;
  });
}

function loginKeys(loginIdNormalized: string, request: Request) {
  const address = requestClientAddress(request);
  return {
    pair: hashKey(`login-pair:${address}:${loginIdNormalized}`),
    account: hashKey(`login-account:${loginIdNormalized}`),
  };
}

export async function consumeLoginRateLimit(
  loginIdNormalized: string,
  request: Request,
  now = new Date(),
) {
  const keys = loginKeys(loginIdNormalized, request);
  return consumeRateLimits(
    [
      { keyHash: keys.pair, rule: LOGIN_PAIR_RULE },
      { keyHash: keys.account, rule: LOGIN_ACCOUNT_RULE },
    ],
    now,
  );
}

export async function clearLoginFailures(
  loginIdNormalized: string,
  request: Request,
) {
  const keys = loginKeys(loginIdNormalized, request);
  const keyHashes = [keys.pair, keys.account];
  await db.$transaction(async (transaction) => {
    await lockRateLimitKeys(transaction, keyHashes);
    await transaction.loginAttempt.deleteMany({
      where: { keyHash: { in: keyHashes } },
    });
  });
}

export async function consumeSignupRateLimit(
  request: Request,
  now = new Date(),
) {
  const keyHash = hashKey(`signup:${requestClientAddress(request)}`);
  return consumeRateLimits([{ keyHash, rule: SIGNUP_RULE }], now);
}

async function consumeMutationRateLimit(
  scope: string,
  rule: RateLimitRule,
  request: Request,
  actorId: string,
  now: Date,
) {
  const keyHash = hashKey(
    `${scope}:${actorId}:${requestClientAddress(request)}`,
  );
  return consumeRateLimits([{ keyHash, rule }], now);
}

export function consumeApplicationRateLimit(
  request: Request,
  userId: string,
  now = new Date(),
) {
  return consumeMutationRateLimit(
    "application",
    APPLICATION_RULE,
    request,
    userId,
    now,
  );
}

export function consumeAccountMutationRateLimit(
  request: Request,
  userId: string,
  now = new Date(),
) {
  return consumeMutationRateLimit(
    "account-mutation",
    ACCOUNT_MUTATION_RULE,
    request,
    userId,
    now,
  );
}

export function consumeAdminMutationRateLimit(
  request: Request,
  adminUserId: string,
  now = new Date(),
) {
  return consumeMutationRateLimit(
    "admin-mutation",
    ADMIN_MUTATION_RULE,
    request,
    adminUserId,
    now,
  );
}

export function consumePointDrawMutationRateLimit(
  request: Request,
  userId: string,
  now = new Date(),
) {
  return consumeMutationRateLimit(
    "point-draw-mutation",
    POINT_DRAW_MUTATION_RULE,
    request,
    userId,
    now,
  );
}

export function consumeMissionMutationRateLimit(
  request: Request,
  userId: string,
  now = new Date(),
) {
  return consumeMutationRateLimit(
    "mission-mutation",
    MISSION_MUTATION_RULE,
    request,
    userId,
    now,
  );
}
