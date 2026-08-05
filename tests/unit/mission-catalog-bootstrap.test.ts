import { describe, expect, it } from "vitest";

import { missionCatalogDefinitionMismatches } from "../../prisma/mission-catalog-bootstrap";
import { readMissionCatalog } from "../../prisma/mission-catalog";
import { Prisma } from "../../src/generated/prisma/client";

describe("production mission catalog bootstrap", () => {
  it("reads exactly the ordered M001-M100 production definitions", async () => {
    const definitions = await readMissionCatalog();

    expect(definitions).toHaveLength(100);
    expect(definitions[0]?.code).toBe("M001");
    expect(definitions[99]?.code).toBe("M100");
  });

  it("accepts identical immutable content but rejects v1 drift", async () => {
    const [definition] = await readMissionCatalog();
    if (!definition) throw new Error("M001 is missing");
    const existing = {
      ...definition,
      category: definition.category,
      kind: definition.kind,
      difficulty: definition.difficulty,
      sourceType: definition.sourceType,
      evaluatorConfig: definition.evaluatorConfig,
      target: new Prisma.Decimal(definition.target),
      targetText: definition.targetText,
      minPatch: null,
      maxPatch: null,
    };

    expect(missionCatalogDefinitionMismatches(definition, existing)).toEqual(
      [],
    );
    expect(
      missionCatalogDefinitionMismatches(definition, {
        ...existing,
        points: existing.points + 1,
      }),
    ).toEqual(["points"]);
  });
});
