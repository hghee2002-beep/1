import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  MissionCategory,
  MissionDifficulty,
  MissionKind,
  MissionSourceType,
  type Prisma,
} from "../src/generated/prisma/client";
import { missionEvaluatorRegistry } from "../src/domain/missions/evaluator";

const categoryByKoreanName: Record<string, MissionCategory> = {
  결과: MissionCategory.RESULT,
  전투: MissionCategory.COMBAT,
  피해: MissionCategory.DAMAGE,
  보호: MissionCategory.PROTECTION,
  성장: MissionCategory.GROWTH,
  시야: MissionCategory.VISION,
  오브젝트: MissionCategory.OBJECTIVE,
  생존: MissionCategory.SURVIVAL,
  멀티킬: MissionCategory.MULTIKILL,
  속도: MissionCategory.SPEED,
  인내: MissionCategory.ENDURANCE,
  타임라인: MissionCategory.TIMELINE,
  빌드: MissionCategory.BUILD,
  포지션: MissionCategory.POSITION,
  룬: MissionCategory.RUNE,
  챔피언: MissionCategory.CHAMPION,
  누적: MissionCategory.CUMULATIVE,
};

const sourceByName: Record<string, MissionSourceType> = {
  MATCH_INFO: MissionSourceType.MATCH_INFO,
  MATCH_TIMELINE: MissionSourceType.MATCH_TIMELINE,
  DATA_DRAGON: MissionSourceType.DATA_DRAGON,
  DERIVED: MissionSourceType.DERIVED,
  INTERNAL: MissionSourceType.INTERNAL,
};

function difficultyForPoints(points: number) {
  if (points <= 2) return MissionDifficulty.EASY;
  if (points === 3) return MissionDifficulty.NORMAL;
  if (points === 4) return MissionDifficulty.HARD;
  return MissionDifficulty.EPIC;
}

function jsonObject(entries: Prisma.InputJsonObject): Prisma.InputJsonObject {
  return entries;
}

export type MissionCatalogDefinition = Awaited<
  ReturnType<typeof readMissionCatalog>
>[number];

export async function readMissionCatalog() {
  const catalogPath = resolve(process.cwd(), "docs", "MISSION_CATALOG.md");
  const markdown = await readFile(catalogPath, "utf8");
  const definitions = markdown
    .split(/\r?\n/u)
    .filter((line) => /^\| M\d{3} \|/u.test(line))
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim().replaceAll("`", ""));
      const code = cells[0];
      const title = cells[1];
      const categoryName = cells[2];
      const kindName = cells[3];
      const pointsText = cells[4];
      const targetText = cells[5];
      const evaluatorKey = cells[6];
      const sourceName = cells[7];
      const summary = cells[8];

      if (
        !code ||
        !title ||
        !categoryName ||
        !kindName ||
        !pointsText ||
        !targetText ||
        !evaluatorKey ||
        !sourceName ||
        !summary
      ) {
        throw new Error(`Invalid mission catalog row: ${line}`);
      }
      const category = categoryByKoreanName[categoryName];
      const sourceType = sourceByName[sourceName];
      const points = Number(pointsText);
      const numericTarget = Number(targetText);
      const evaluator = missionEvaluatorRegistry.get(evaluatorKey);

      if (!category || !sourceType || !Number.isInteger(points) || !evaluator) {
        throw new Error(`Invalid mission catalog row: ${line}`);
      }

      const minute =
        code === "M059"
          ? 10
          : code === "M060"
            ? 15
            : code === "M061"
              ? 20
              : null;
      const evaluatorConfig: Prisma.InputJsonObject = {
        target: targetText,
        catalogVersion: "v1",
        evaluatorVersion: evaluator.version,
        unit: evaluator.unit,
        ...(minute === null ? {} : { minute }),
      };

      return {
        code,
        version: 1,
        title,
        description: summary,
        category,
        kind:
          kindName === "CUMULATIVE"
            ? MissionKind.CUMULATIVE
            : MissionKind.SINGLE,
        difficulty: difficultyForPoints(points),
        points,
        evaluatorKey,
        evaluatorConfig: jsonObject(evaluatorConfig),
        sourceType,
        target: Number.isFinite(numericTarget) ? numericTarget : 1,
        targetText,
        active: true,
      };
    });

  if (definitions.length !== 100) {
    throw new Error(
      `MISSION_CATALOG.md must contain exactly 100 definitions; found ${definitions.length}.`,
    );
  }

  definitions.forEach((definition, index) => {
    const expectedCode = `M${String(index + 1).padStart(3, "0")}`;
    if (definition.code !== expectedCode) {
      throw new Error(
        `Mission catalog code sequence mismatch: expected ${expectedCode}, found ${definition.code}.`,
      );
    }
  });

  return definitions;
}
