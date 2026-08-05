import "dotenv/config";

import { randomUUID } from "node:crypto";

function argument(name: string) {
  const direct = process.argv.find((value) => value.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const invocationKey = argument("--invocation-key") ?? `worker:${randomUUID()}`;
const seasonId = argument("--season-id");
const participantId = argument("--participant-id");
const limitValue = argument("--limit");
const limit = limitValue === undefined ? undefined : Number(limitValue);

if (
  limit !== undefined &&
  (!Number.isInteger(limit) || limit < 1 || limit > 20)
) {
  throw new Error("--limit must be an integer from 1 to 20.");
}

const [{ db }, { runWorkerSync }] = await Promise.all([
  import("../src/server/db/client"),
  import("../src/server/sync/worker"),
]);

try {
  const result = await runWorkerSync({
    invocationKey,
    dryRun: process.argv.includes("--dry-run"),
    force: process.argv.includes("--force"),
    ...(seasonId ? { seasonId } : {}),
    ...(participantId ? { participantId } : {}),
    ...(limit === undefined ? {} : { limit }),
  });
  console.info(JSON.stringify(result));
  if (result.status === "FAILED") process.exitCode = 1;
} finally {
  await db.$disconnect();
}
