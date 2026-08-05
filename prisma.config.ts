import "dotenv/config";

import { defineConfig } from "prisma/config";

const toolingDatabaseUrl =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL ||
  "postgresql://foundation:foundation@localhost:5432/deluxe_soloq";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: toolingDatabaseUrl,
  },
});
