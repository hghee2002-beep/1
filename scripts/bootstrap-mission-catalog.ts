import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { bootstrapMissionCatalog } from "../prisma/mission-catalog-bootstrap";
import { PrismaClient } from "../src/generated/prisma/client";
import { prismaPgAdapterConfig } from "../src/lib/database-url";

async function main() {
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or DIRECT_URL is required.");
  }

  const adapterConfig = prismaPgAdapterConfig(databaseUrl);
  const adapter = new PrismaPg(
    adapterConfig.poolConfig,
    adapterConfig.adapterOptions,
  );
  const prisma = new PrismaClient({ adapter });
  try {
    const result = await bootstrapMissionCatalog(prisma);
    console.info(
      `Mission catalog v1 verified: ${result.verified}; created: ${result.created}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`db:bootstrap:missions failed: ${message}`);
  process.exitCode = 1;
});
