import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

const { Client } = pg;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required. No database changes were attempted.",
  );
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL must differ from DATABASE_URL. No database changes were attempted.",
  );
}

const parsedUrl = new URL(testDatabaseUrl);
if (!/^postgres(?:ql)?:$/u.test(parsedUrl.protocol)) {
  throw new Error(
    "TEST_DATABASE_URL must be a PostgreSQL URL. No database changes were attempted.",
  );
}

const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//u, ""));
if (!/(^|[_-])test($|[_-])/iu.test(databaseName)) {
  throw new Error(
    `Refusing to use database "${databaseName}": its name must contain a standalone test segment.`,
  );
}

const packageManagerCli = process.env.npm_execpath;
if (!packageManagerCli) {
  throw new Error("npm_execpath is unavailable; run this script through pnpm.");
}

const integrationDirectory = resolve("tests/integration");
const testFiles = readdirSync(integrationDirectory)
  .filter((name) => name.endsWith(".test.ts"))
  .sort()
  .map((name) => `tests/integration/${name}`);

function runPackageCommand(args, environment) {
  const result = spawnSync(process.execPath, [packageManagerCli, ...args], {
    env: environment,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  return result.status ?? 1;
}

async function dropTemporarySchema(connectionString, schemaName) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  } finally {
    await client.end();
  }
}

const administrativeUrl = new URL(parsedUrl);
administrativeUrl.searchParams.delete("schema");

for (const [index, testFile] of testFiles.entries()) {
  const schemaName = `integration_${process.pid}_${index}_${randomUUID().replaceAll("-", "")}`;
  const isolatedUrl = new URL(parsedUrl);
  isolatedUrl.searchParams.set("schema", schemaName);
  const environment = {
    ...process.env,
    DATABASE_URL: isolatedUrl.toString(),
    DIRECT_URL: "",
    NODE_ENV: "test",
    TEST_DATABASE_URL: isolatedUrl.toString(),
  };

  console.info(`\nPreparing isolated schema for ${testFile}.`);
  let status = runPackageCommand(
    ["exec", "prisma", "migrate", "deploy"],
    environment,
  );
  if (status === 0) {
    status = runPackageCommand(["exec", "prisma", "db", "seed"], environment);
  }
  if (status === 0) {
    status = runPackageCommand(
      [
        "exec",
        "vitest",
        "run",
        "--config",
        "vitest.integration.config.ts",
        testFile,
      ],
      environment,
    );
  }

  await dropTemporarySchema(administrativeUrl.toString(), schemaName);
  console.info(`Removed temporary schema for ${testFile}.`);

  if (status !== 0) process.exit(status);
}

console.info(
  `\nAll ${testFiles.length} integration test files passed in isolation.`,
);
