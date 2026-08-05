// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  DataDragonClient,
  selectDataDragonVersion,
} from "@/server/riot/data-dragon";
import { dataDragonFixtures } from "../fixtures/riot";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Data Dragon cache and fallback", () => {
  it("selects the exact patch or closest same-season version", () => {
    const versions = ["16.15.2", "16.15.1", "16.14.1", "15.24.1"];
    expect(selectDataDragonVersion("16.15.1.123", versions)).toBe("16.15.2");
    expect(selectDataDragonVersion("16.13.9", versions)).toBe("16.14.1");
    expect(selectDataDragonVersion("14.1.1", versions)).toBe("16.15.2");
    expect(selectDataDragonVersion(undefined, versions)).toBe("16.15.2");
  });

  it("loads champion/item/rune mappings once and serves subsequent reads from cache", async () => {
    const requests: { url: string; token: string | null }[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      requests.push({
        url,
        token: new Headers(init?.headers).get("x-riot-token"),
      });
      if (url.endsWith("/api/versions.json")) return json(["16.15.1"]);
      if (url.endsWith("/champion.json"))
        return json(dataDragonFixtures.champions);
      if (url.endsWith("/item.json")) return json(dataDragonFixtures.items);
      if (url.endsWith("/runesReforged.json"))
        return json(dataDragonFixtures.runes);
      return json({}, 404);
    });
    const client = new DataDragonClient({ fetch: fetchMock });

    const first = await client.getStaticData("16.15.1.100");
    const second = await client.getStaticData("16.15.1.200");
    expect(first).toMatchObject({
      version: "16.15.1",
      locale: "ko_KR",
      source: "DATA_DRAGON",
    });
    expect(first.champions.get(103)).toMatchObject({
      key: "Ahri",
      tags: ["Mage", "Assassin"],
    });
    expect(first.items.get(2055)).toMatchObject({ totalGold: 75 });
    expect(first.runes.get(8005)).toMatchObject({ key: "PressTheAttack" });
    expect(second.source).toBe("CACHE");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(requests.every((request) => request.token === null)).toBe(true);
  });

  it("falls back to bundled static data on a cold failure", async () => {
    const client = new DataDragonClient({
      fetch: vi.fn<typeof fetch>(async () => {
        throw new TypeError("offline");
      }),
    });
    const snapshot = await client.getStaticData("16.15.1");
    expect(snapshot).toMatchObject({ source: "BUNDLED_FALLBACK" });
    expect(snapshot.champions.get(103)?.name).toBe("아리");
    expect(snapshot.items.get(2055)?.tags).toContain("Vision");
    expect(snapshot.runes.get(8000)?.key).toBe("Precision");
  });

  it("uses the last successful snapshot if refreshing versions later fails", async () => {
    let now = 0;
    let offline = false;
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      if (offline) throw new TypeError("offline");
      const url = String(input);
      if (url.endsWith("/api/versions.json")) return json(["16.15.1"]);
      if (url.endsWith("/champion.json"))
        return json(dataDragonFixtures.champions);
      if (url.endsWith("/item.json")) return json(dataDragonFixtures.items);
      return json(dataDragonFixtures.runes);
    });
    const client = new DataDragonClient({ fetch: fetchMock, now: () => now });
    await expect(client.getStaticData("16.15.1")).resolves.toMatchObject({
      source: "DATA_DRAGON",
    });
    now = 3_700_000;
    offline = true;
    await expect(client.getStaticData("16.16.1")).resolves.toMatchObject({
      version: "16.15.1",
      source: "CACHE",
    });
  });
});
