import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { prismaPgAdapterConfig } from "@/lib/database-url";
import { serverEnv } from "@/lib/env/server";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapterConfig = prismaPgAdapterConfig(serverEnv.DATABASE_URL);
  const adapter = new PrismaPg(
    adapterConfig.poolConfig,
    adapterConfig.adapterOptions,
  );

  return new PrismaClient({
    adapter,
    log: serverEnv.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (serverEnv.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
