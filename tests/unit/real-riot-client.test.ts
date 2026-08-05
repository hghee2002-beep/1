// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { RealRiotClient } from "@/server/riot/real-client";
import { createRawMatch, createRawTimeline } from "../fixtures/riot";

function json(value: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("Real Riot client routing contract", () => {
  it("separates ASIA account routing from KR summoner and league routing", async () => {
    const requests: { url: URL; token: string | null }[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      requests.push({
        url,
        token: new Headers(init?.headers).get("x-riot-token"),
      });
      if (url.pathname.includes("/accounts/by-riot-id/")) {
        return json({
          puuid: "PUUID_ACCOUNT_1",
          gameName: "Name With/Slash",
          tagLine: "KR 1",
        });
      }
      if (url.pathname.includes("/summoners/by-puuid/")) {
        return json({
          id: "SUMMONER_1",
          puuid: "PUUID_ACCOUNT_1",
          profileIconId: 29,
          summonerLevel: 411,
        });
      }
      if (url.pathname.includes("/league/v4/entries/by-puuid/")) {
        return json([
          {
            queueType: "RANKED_SOLO_5x5",
            tier: "MASTER",
            rank: "I",
            leaguePoints: 186,
            wins: 100,
            losses: 80,
            hotStreak: true,
            veteran: true,
            freshBlood: false,
            inactive: false,
          },
        ]);
      }
      return json({}, 404);
    });
    const client = new RealRiotClient({
      apiKey: "RGAPI-server-only-secret",
      http: { fetch: fetchMock, maxRetries: 0, logger: () => undefined },
    });

    await expect(
      client.resolveRiotId("Name With/Slash", "KR 1"),
    ).resolves.toMatchObject({
      puuid: "PUUID_ACCOUNT_1",
      summonerId: "SUMMONER_1",
      gameName: "Name With/Slash",
      tagLine: "KR 1",
      source: "RIOT_API",
      soloQueue: { queueType: "RANKED_SOLO_5x5", leaguePoints: 186 },
    });

    const accountRequest = requests.find((request) =>
      request.url.pathname.includes("accounts/by-riot-id"),
    );
    expect(accountRequest?.url.host).toBe("asia.api.riotgames.com");
    expect(accountRequest?.url.pathname).toContain(
      "Name%20With%2FSlash/KR%201",
    );
    expect(
      requests
        .filter(
          (request) =>
            request.url.pathname.includes("/lol/summoner/") ||
            request.url.pathname.includes("/lol/league/"),
        )
        .map((request) => request.url.host),
    ).toEqual(["kr.api.riotgames.com", "kr.api.riotgames.com"]);
    expect(
      requests.every((request) => request.token === "RGAPI-server-only-secret"),
    ).toBe(true);
    expect(
      requests.every((request) => !request.url.href.includes("RGAPI")),
    ).toBe(true);
  });

  it("uses ASIA Match-V5 paths and encodes pagination/time filters", async () => {
    const requests: URL[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      if (url.pathname.endsWith("/ids")) return json(["KR_TEST_001"]);
      if (url.pathname.endsWith("/timeline")) return json(createRawTimeline());
      return json(createRawMatch());
    });
    const client = new RealRiotClient({
      apiKey: "test-key",
      http: { fetch: fetchMock, maxRetries: 0, logger: () => undefined },
    });

    await expect(
      client.listMatchIds({
        puuid: "PUUID/value",
        startTime: new Date("2026-08-01T00:00:00.000Z"),
        endTime: new Date("2026-08-02T00:00:00.000Z"),
        queueId: 420,
        type: "ranked",
        start: 20,
        count: 10,
      }),
    ).resolves.toEqual(["KR_TEST_001"]);
    await expect(client.getMatch("KR_TEST_001")).resolves.toMatchObject({
      matchId: "KR_TEST_001",
      queueId: 420,
    });
    await expect(client.getTimeline("KR_TEST_001")).resolves.toMatchObject({
      matchId: "KR_TEST_001",
      frameIntervalMs: 60_000,
    });

    expect(requests.every((url) => url.host === "asia.api.riotgames.com")).toBe(
      true,
    );
    const list = requests[0];
    expect(list?.pathname).toContain("/by-puuid/PUUID%2Fvalue/ids");
    expect(Object.fromEntries(list?.searchParams ?? [])).toEqual({
      startTime: "1785542400",
      endTime: "1785628800",
      queue: "420",
      type: "ranked",
      start: "20",
      count: "10",
    });
  });

  it("maps account 404 separately and rejects malformed match payloads", async () => {
    const notFound = new RealRiotClient({
      apiKey: "test-key",
      http: {
        fetch: vi.fn<typeof fetch>(async () => json({}, 404)),
        maxRetries: 0,
        logger: () => undefined,
      },
    });
    await expect(
      notFound.resolveRiotId("NotFound", "KR1"),
    ).rejects.toMatchObject({
      code: "RIOT_ACCOUNT_NOT_FOUND",
    });
    await expect(
      notFound.getTimeline("KR_MISSING_TIMELINE"),
    ).rejects.toMatchObject({
      code: "RIOT_TIMELINE_UNAVAILABLE",
      retryable: true,
    });

    const malformed = new RealRiotClient({
      apiKey: "test-key",
      http: {
        fetch: vi.fn<typeof fetch>(async () =>
          json({ metadata: {}, info: {} }),
        ),
        maxRetries: 0,
        logger: () => undefined,
      },
    });
    await expect(malformed.getMatch("KR_TEST_001")).rejects.toMatchObject({
      code: "RIOT_MALFORMED_RESPONSE",
    });
  });
});
