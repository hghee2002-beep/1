import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import pg from "pg";

const { Client } = pg;
const baseDatabaseUrl =
  process.env.E2E_DATABASE_URL ?? process.env.TEST_DATABASE_URL;

if (!baseDatabaseUrl) {
  throw new Error(
    "E2E_DATABASE_URL or TEST_DATABASE_URL is required. No database changes were attempted.",
  );
}

if (baseDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error(
    "The E2E database must differ from DATABASE_URL. No database changes were attempted.",
  );
}

const parsedUrl = new URL(baseDatabaseUrl);
if (!/^postgres(?:ql)?:$/u.test(parsedUrl.protocol)) {
  throw new Error(
    "The E2E database must use PostgreSQL. No database changes were attempted.",
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

const e2eDirectory = resolve("tests/e2e");
const availableTestFiles = readdirSync(e2eDirectory)
  .filter((name) => name.endsWith(".spec.ts"))
  .sort()
  .map((name) => `tests/e2e/${name}`);
const requestedTestFiles = process.argv.slice(2);
const testFiles =
  requestedTestFiles.length === 0
    ? availableTestFiles
    : requestedTestFiles.map((name) => name.replaceAll("\\", "/"));

for (const testFile of testFiles) {
  if (!availableTestFiles.includes(testFile)) {
    throw new Error(
      `Unknown E2E test file "${testFile}". Choose a file under tests/e2e.`,
    );
  }
}

function runPlaywright(testFile, environment) {
  const playwrightArguments = [
    packageManagerCli,
    "exec",
    "playwright",
    "test",
    testFile,
  ];
  if (process.env.E2E_UPDATE_SNAPSHOTS === "true") {
    playwrightArguments.push("--update-snapshots");
  }
  if (process.env.E2E_GREP) {
    playwrightArguments.push("--grep", process.env.E2E_GREP);
  }
  if (process.env.E2E_PROJECT) {
    playwrightArguments.push("--project", process.env.E2E_PROJECT);
  }
  const result = spawnSync(process.execPath, playwrightArguments, {
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
  const schemaName = `e2e_${process.pid}_${index}_${randomUUID().replaceAll("-", "")}`;
  const isolatedUrl = new URL(parsedUrl);
  isolatedUrl.searchParams.set("schema", schemaName);
  const environment = {
    ...process.env,
    E2E_DATABASE_URL: isolatedUrl.toString(),
    E2E_ISOLATED_RUN: "true",
  };

  console.info(`\nRunning ${testFile} in an isolated schema.`);
  const status = runPlaywright(testFile, environment);
  await dropTemporarySchema(administrativeUrl.toString(), schemaName);
  console.info(`Removed temporary schema for ${testFile}.`);
  if (status !== 0) process.exit(status);
}

console.info(`\nAll ${testFiles.length} E2E test files passed in isolation.`);
