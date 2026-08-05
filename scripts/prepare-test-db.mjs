import { spawnSync } from "node:child_process";

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
    `Refusing to prepare database "${databaseName}": its name must contain a standalone test segment.`,
  );
}

const packageManagerCli = process.env.npm_execpath;
if (!packageManagerCli) {
  throw new Error("npm_execpath is unavailable; run this script through pnpm.");
}
const commandEnvironment = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  DIRECT_URL: "",
  NODE_ENV: "test",
};

function runPrisma(args) {
  const result = spawnSync(
    process.execPath,
    [packageManagerCli, "exec", "prisma", ...args],
    {
      env: commandEnvironment,
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.info(`Preparing isolated test database "${databaseName}".`);
runPrisma(["migrate", "deploy"]);
runPrisma(["db", "seed"]);
console.info(`Test database "${databaseName}" is migrated and seeded.`);
