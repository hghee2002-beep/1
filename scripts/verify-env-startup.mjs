import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = "3107";
const invalidSecret = "SHOULD_NOT_APPEAR_SECRET";
const expectedMessage = "Invalid server environment variables: AUTH_SECRET";
const nextCli = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);

const child = spawn(
  process.execPath,
  [nextCli, "dev", "--hostname", "localhost", "--port", port],
  {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: {
      ...process.env,
      DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:5432/deluxe_soloq_env_check",
      AUTH_SECRET: invalidSecret,
      CRON_SECRET: "env-check-cron-secret-with-at-least-32-characters",
      MOCK_RIOT_API: "true",
      APP_URL: `http://localhost:${port}`,
      APP_TIME_ZONE: "Asia/Seoul",
      NEXT_PUBLIC_POLL_INTERVAL_MS: "20000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let output = "";
let requestedHealth = false;
let settled = false;

const timeout = setTimeout(() => {
  finish(
    new Error("Timed out waiting for the safe environment validation error."),
  );
}, 20_000);

function finish(error) {
  if (settled) {
    return;
  }

  settled = true;
  clearTimeout(timeout);
  child.kill();

  if (error) {
    process.exitCode = 1;
    console.error(error.message);
    return;
  }

  console.info(
    "Safe startup validation confirmed: only the invalid field name was reported.",
  );
}

async function requestHealth() {
  try {
    await fetch(`http://localhost:${port}/api/health`);
  } catch {
    // A connection failure is expected if validation stops the server early.
  }
}

function inspect(chunk) {
  output += chunk.toString();

  if (output.includes(invalidSecret)) {
    finish(new Error("Environment validation output exposed a secret value."));
    return;
  }

  if (output.includes(expectedMessage)) {
    finish();
    return;
  }

  if (output.includes("Ready") && !requestedHealth) {
    requestedHealth = true;
    void requestHealth();
  }
}

child.stdout.on("data", inspect);
child.stderr.on("data", inspect);
child.on("error", (error) => finish(error));
child.on("exit", (code) => {
  if (!settled) {
    finish(
      new Error(
        `Next.js exited before reporting the expected environment error (code ${String(code)}).`,
      ),
    );
  }
});
