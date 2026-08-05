import { Prisma, type PrismaClient } from "../src/generated/prisma/client";
import {
  readMissionCatalog,
  type MissionCatalogDefinition,
} from "./mission-catalog";

type ExistingDefinition = {
  code: string;
  version: number;
  title: string;
  description: string;
  category: string;
  kind: string;
  difficulty: string;
  points: number;
  evaluatorKey: string;
  evaluatorConfig: Prisma.JsonValue | Prisma.InputJsonValue;
  sourceType: string;
  target: Prisma.Decimal;
  targetText: string | null;
  minPatch: string | null;
  maxPatch: string | null;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function missionCatalogDefinitionMismatches(
  expected: MissionCatalogDefinition,
  existing: ExistingDefinition,
) {
  const comparisons: ReadonlyArray<readonly [string, unknown, unknown]> = [
    ["code", existing.code, expected.code],
    ["version", existing.version, expected.version],
    ["title", existing.title, expected.title],
    ["description", existing.description, expected.description],
    ["category", existing.category, expected.category],
    ["kind", existing.kind, expected.kind],
    ["difficulty", existing.difficulty, expected.difficulty],
    ["points", existing.points, expected.points],
    ["evaluatorKey", existing.evaluatorKey, expected.evaluatorKey],
    [
      "evaluatorConfig",
      canonicalJson(existing.evaluatorConfig),
      canonicalJson(expected.evaluatorConfig),
    ],
    ["sourceType", existing.sourceType, expected.sourceType],
    [
      "target",
      existing.target.toString(),
      new Prisma.Decimal(expected.target).toString(),
    ],
    ["targetText", existing.targetText, expected.targetText],
    ["minPatch", existing.minPatch, null],
    ["maxPatch", existing.maxPatch, null],
  ];

  return comparisons
    .filter(([, actual, wanted]) => actual !== wanted)
    .map(([field]) => field);
}

export async function bootstrapMissionCatalog(client: PrismaClient) {
  const definitions = await readMissionCatalog();

  return client.$transaction(
    async (transaction) => {
      await transaction.$queryRaw`
        SELECT 1::integer AS locked
        FROM pg_advisory_xact_lock(
          hashtextextended('deluxe-soloq:mission-catalog-v1', 0)
        )
      `;

      const existing = await transaction.missionDefinition.findMany({
        where: {
          version: 1,
          code: { in: definitions.map((definition) => definition.code) },
        },
        select: {
          code: true,
          version: true,
          title: true,
          description: true,
          category: true,
          kind: true,
          difficulty: true,
          points: true,
          evaluatorKey: true,
          evaluatorConfig: true,
          sourceType: true,
          target: true,
          targetText: true,
          minPatch: true,
          maxPatch: true,
        },
      });
      const existingByCode = new Map(existing.map((row) => [row.code, row]));
      const missing: MissionCatalogDefinition[] = [];

      for (const definition of definitions) {
        const current = existingByCode.get(definition.code);
        if (!current) {
          missing.push(definition);
          continue;
        }
        const mismatches = missionCatalogDefinitionMismatches(
          definition,
          current,
        );
        if (mismatches.length > 0) {
          throw new Error(
            `Mission catalog drift for ${definition.code} v1: ${mismatches.join(", ")}. Publish a new version instead of mutating v1.`,
          );
        }
      }

      if (missing.length > 0) {
        await transaction.missionDefinition.createMany({ data: missing });
      }

      const verified = await transaction.missionDefinition.count({
        where: {
          version: 1,
          code: { in: definitions.map((definition) => definition.code) },
        },
      });
      if (verified !== 100) {
        throw new Error(
          `Mission catalog bootstrap expected 100 v1 definitions; found ${verified}.`,
        );
      }

      return { created: missing.length, verified };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 30_000,
    },
  );
}
