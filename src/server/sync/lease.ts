import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";

function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function acquireJobLease(input: {
  key: string;
  now: Date;
  durationMs: number;
  recoveryGraceMs?: number;
}) {
  const ownerToken = randomUUID();
  const expiresAt = new Date(input.now.getTime() + input.durationMs);
  const reclaimBefore = new Date(
    input.now.getTime() - Math.max(0, input.recoveryGraceMs ?? 0),
  );
  const reclaimed = await db.jobLease.updateMany({
    where: { key: input.key, expiresAt: { lte: reclaimBefore } },
    data: {
      ownerToken,
      acquiredAt: input.now,
      heartbeatAt: input.now,
      expiresAt,
    },
  });
  if (reclaimed.count === 1) return ownerToken;

  try {
    await db.jobLease.create({
      data: {
        key: input.key,
        ownerToken,
        acquiredAt: input.now,
        heartbeatAt: input.now,
        expiresAt,
      },
    });
    return ownerToken;
  } catch (error) {
    if (isUniqueConflict(error)) return null;
    throw error;
  }
}

export async function heartbeatJobLease(input: {
  key: string;
  ownerToken: string;
  now: Date;
  durationMs: number;
}) {
  const updated = await db.jobLease.updateMany({
    where: { key: input.key, ownerToken: input.ownerToken },
    data: {
      heartbeatAt: input.now,
      expiresAt: new Date(input.now.getTime() + input.durationMs),
    },
  });
  return updated.count === 1;
}

export async function releaseJobLease(key: string, ownerToken: string) {
  await db.jobLease.deleteMany({ where: { key, ownerToken } });
}
