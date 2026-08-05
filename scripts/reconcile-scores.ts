import "dotenv/config";

const args = process.argv.slice(2);
const repair = args.includes("--repair");
const weekIndex = args.indexOf("--week-id");
const weekId = weekIndex >= 0 ? args[weekIndex + 1] : undefined;

if (weekIndex >= 0 && !weekId) {
  throw new Error("--week-id requires a UUID value.");
}

const [{ db }, { reconcileScoreCaches }] = await Promise.all([
  import("../src/server/db/client"),
  import("../src/server/scoring/reconciliation"),
]);

try {
  const result = await reconcileScoreCaches({
    repair,
    ...(weekId ? { weekId } : {}),
  });
  console.info(JSON.stringify(result, null, 2));
  if (!repair && result.mismatches.length > 0) process.exitCode = 2;
} finally {
  await db.$disconnect();
}
