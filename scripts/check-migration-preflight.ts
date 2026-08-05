import "dotenv/config";

import pg from "pg";

import { prismaPgAdapterConfig } from "../src/lib/database-url";

const { Client } = pg;

type LegacyMvpRisk = {
  totalEvaluations: string;
  rawOnlyEvaluations: string;
  unmappedRawOnlyEvaluations: string;
  ambiguousRawOnlyEvaluations: string;
};

async function main() {
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or DIRECT_URL is required.");
  }
  const adapterConfig = prismaPgAdapterConfig(databaseUrl);
  const client = new Client({
    connectionString: adapterConfig.poolConfig.connectionString,
  });
  await client.connect();
  try {
    const relation = await client.query<{ name: string | null }>(
      `SELECT to_regclass('"MvpEvaluation"')::text AS name`,
    );
    if (!relation.rows[0]?.name) {
      console.info(
        "Migration preflight passed: MvpEvaluation does not exist yet (empty database path).",
      );
      return;
    }

    const columns = await client.query<{ columnName: string }>(`
      SELECT column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'MvpEvaluation'
    `);
    const columnNames = new Set(columns.rows.map((row) => row.columnName));
    if (columnNames.has("evaluationKey")) {
      const invalid = await client.query<{ invalidRows: string }>(`
        SELECT COUNT(*)::text AS "invalidRows"
        FROM "MvpEvaluation"
        WHERE "evaluationKey" IS NULL
          OR "status" IS NULL
          OR "seasonMatchId" IS NULL
      `);
      const invalidRows = Number(invalid.rows[0]?.invalidRows ?? "0");
      if (invalidRows > 0) {
        throw new Error(
          `Migration preflight failed: ${invalidRows} migrated MVP evaluations have incomplete scope/idempotency columns.`,
        );
      }
      console.info(
        "Migration preflight passed: MVP season scope migration is already complete.",
      );
      return;
    }

    const result = await client.query<LegacyMvpRisk>(`
      WITH evaluation_scope AS (
        SELECT
          evaluation."id",
          evaluation."participantMatchId",
          COUNT(DISTINCT season_match."id") AS season_match_count
        FROM "MvpEvaluation" evaluation
        JOIN "MatchParticipantRaw" raw_participant
          ON raw_participant."id" = evaluation."matchParticipantRawId"
        LEFT JOIN "SeasonMatch" season_match
          ON season_match."matchId" = raw_participant."matchId"
        GROUP BY evaluation."id", evaluation."participantMatchId"
      )
      SELECT
        COUNT(*)::text AS "totalEvaluations",
        COUNT(*) FILTER (
          WHERE "participantMatchId" IS NULL
        )::text AS "rawOnlyEvaluations",
        COUNT(*) FILTER (
          WHERE "participantMatchId" IS NULL AND season_match_count = 0
        )::text AS "unmappedRawOnlyEvaluations",
        COUNT(*) FILTER (
          WHERE "participantMatchId" IS NULL AND season_match_count > 1
        )::text AS "ambiguousRawOnlyEvaluations"
      FROM evaluation_scope
    `);
    const risk = result.rows[0];
    if (!risk)
      throw new Error("Migration preflight could not inspect MVP rows.");
    const rawOnly = Number(risk.rawOnlyEvaluations);
    if (rawOnly > 0) {
      throw new Error(
        [
          "Migration preflight failed: legacy MVP data is incompatible with 20260805200000_mvp_ace_engine.",
          `total=${risk.totalEvaluations}`,
          `rawOnly=${risk.rawOnlyEvaluations}`,
          `unmapped=${risk.unmappedRawOnlyEvaluations}`,
          `ambiguous=${risk.ambiguousRawOnlyEvaluations}`,
          "That historical migration only backfills evaluationKey/status for participantMatch-linked rows and would fail its NOT NULL step.",
          "Stop deploy, keep the backup, and apply a separately reviewed pre-migration data remediation; do not choose an arbitrary season for ambiguous rows.",
        ].join(" "),
      );
    }

    console.info(
      `Migration preflight passed: ${risk.totalEvaluations} legacy MVP evaluations are participantMatch-scoped.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`db:preflight:migrations failed: ${message}`);
  process.exitCode = 1;
});
