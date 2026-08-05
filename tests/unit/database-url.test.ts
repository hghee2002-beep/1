import { describe, expect, it } from "vitest";

import { prismaPgAdapterConfig } from "@/lib/database-url";

describe("Prisma PostgreSQL adapter URL options", () => {
  it("uses an explicitly selected schema", () => {
    expect(
      prismaPgAdapterConfig(
        "postgresql://user:pass@localhost:5432/deluxe_test?schema=release_qa",
      ),
    ).toEqual({
      poolConfig: {
        connectionString:
          "postgresql://user:pass@localhost:5432/deluxe_test?schema=release_qa&options=-c+search_path%3Drelease_qa",
      },
      adapterOptions: { schema: "release_qa" },
    });
  });

  it("keeps the adapter default when no schema is selected", () => {
    expect(
      prismaPgAdapterConfig(
        "postgresql://user:pass@localhost:5432/deluxe_test",
      ),
    ).toEqual({
      poolConfig: {
        connectionString: "postgresql://user:pass@localhost:5432/deluxe_test",
      },
      adapterOptions: undefined,
    });
  });

  it("rejects unsafe schema identifiers before connecting", () => {
    expect(() =>
      prismaPgAdapterConfig(
        "postgresql://user:pass@localhost:5432/deluxe_test?schema=bad-name",
      ),
    ).toThrow("safe identifier");
  });
});
