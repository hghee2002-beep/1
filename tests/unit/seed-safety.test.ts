import { describe, expect, it } from "vitest";

import { assertDevelopmentSeedAllowed } from "../../prisma/seed-safety";

describe("development seed safety", () => {
  it("fails closed in production", () => {
    expect(() => assertDevelopmentSeedAllowed("production")).toThrow(
      "requires explicit NODE_ENV=development or NODE_ENV=test",
    );
  });

  it.each([undefined, "", "staging", "Production", "production "])(
    "fails closed for an implicit or unknown environment (%s)",
    (nodeEnv) => {
      expect(() => assertDevelopmentSeedAllowed(nodeEnv)).toThrow(
        "requires explicit NODE_ENV=development or NODE_ENV=test",
      );
    },
  );

  it("allows explicit development and test environments", () => {
    expect(() => assertDevelopmentSeedAllowed("development")).not.toThrow();
    expect(() => assertDevelopmentSeedAllowed("test")).not.toThrow();
  });
});
