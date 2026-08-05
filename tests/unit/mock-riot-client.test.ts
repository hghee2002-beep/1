// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { MockRiotClient } from "@/features/riot/mock-client";
import type { RiotClient } from "@/features/riot/types";

function acceptsRiotClient(client: RiotClient) {
  return client;
}

describe("deterministic Mock Riot client", () => {
  it("implements the shared RiotClient contract without network access", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const client = acceptsRiotClient(new MockRiotClient());
    await expect(
      client.resolveRiotId("Cloud Tempo", "0217"),
    ).resolves.toMatchObject({
      puuid: "MOCK_PUUID_CLOUD_TEMPO_0217",
      source: "MOCK",
      soloQueue: { tier: "MASTER", rank: "I", leaguePoints: 186 },
    });
    await expect(client.getStaticData("16.15.1")).resolves.toMatchObject({
      version: "MOCK-16.15.1",
      source: "MOCK",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["NotFound", "RIOT_ACCOUNT_NOT_FOUND", false],
    ["TemporaryFailure", "RIOT_TEMPORARY_FAILURE", true],
    ["RateLimited", "RIOT_RATE_LIMITED", true],
    ["InvalidKey", "RIOT_KEY_INVALID", false],
  ])(
    "provides the %s account failure scenario",
    async (name, code, retryable) => {
      const client = new MockRiotClient();
      await expect(client.resolveRiotId(name, "KR1")).rejects.toMatchObject({
        code,
        retryable,
      });
    },
  );

  it("paginates deterministic match ids and covers result/queue/remake fixtures", async () => {
    const client = new MockRiotClient();
    const firstPage = await client.listMatchIds({
      puuid: "MOCK_PUUID_CLOUD_TEMPO_0217",
      start: 0,
      count: 2,
    });
    const secondPage = await client.listMatchIds({
      puuid: "MOCK_PUUID_CLOUD_TEMPO_0217",
      start: 2,
      count: 2,
    });
    expect(firstPage).toHaveLength(2);
    expect(secondPage).toHaveLength(2);
    expect(new Set([...firstPage, ...secondPage]).size).toBe(4);

    const win = await client.getMatch("KR_MOCK_WIN_001");
    expect(win).toMatchObject({
      queueId: 420,
      remake: false,
    });
    expect(win.participants[0]?.win).toBe(true);
    const loss = await client.getMatch("KR_MOCK_LOSS_001");
    expect(loss.participants[0]?.win).toBe(false);
    await expect(client.getMatch("KR_MOCK_REMAKE_001")).resolves.toMatchObject({
      remake: true,
      earlySurrender: true,
      durationSeconds: 240,
    });
    await expect(
      client.getMatch("KR_MOCK_UNSUPPORTED_QUEUE_001"),
    ).resolves.toMatchObject({ queueId: 440 });
  });

  it("includes all positions and representative mission facts", async () => {
    const match = await new MockRiotClient().getMatch("KR_MOCK_WIN_001");
    expect(
      match.participants.slice(0, 5).map((entry) => entry.position),
    ).toEqual(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);
    expect(match.participants[0]).toMatchObject({
      kills: 12,
      assists: 11,
      damageToChampions: 24_000,
      controlWardsBought: 2,
      challenges: { soloKills: 3, turretTakedowns: 3 },
    });
  });

  it("models missing timeline and a deterministic retry-success timeline", async () => {
    const client = new MockRiotClient();
    await expect(
      client.getTimeline("KR_MOCK_TIMELINE_MISSING_001"),
    ).rejects.toMatchObject({
      code: "RIOT_TIMELINE_UNAVAILABLE",
      retryable: true,
    });
    await expect(
      client.getTimeline("KR_MOCK_TIMELINE_RETRY_001"),
    ).rejects.toMatchObject({ code: "RIOT_TEMPORARY_FAILURE" });
    await expect(
      client.getTimeline("KR_MOCK_TIMELINE_RETRY_001"),
    ).resolves.toMatchObject({
      matchId: "KR_MOCK_TIMELINE_RETRY_001",
      frames: expect.any(Array),
    });
  });

  it("tracks a long Riot ID rename by stable PUUID and hashes E2E ids deterministically", async () => {
    const client = new MockRiotClient();
    const renamed = await client.resolveRiotId("OldDisplayName", "KR1");
    expect(renamed).toMatchObject({
      puuid: "MOCK_PUUID_RENAMED_LONG_ID",
      gameName: "A Very Long Changed Riot Identifier",
      tagLine: "SHIFT",
    });
    await expect(
      client.getIdentityByPuuid(renamed.puuid),
    ).resolves.toMatchObject({
      gameName: "A Very Long Changed Riot Identifier",
    });
    const first = await client.resolveRiotId("E2E-stable-user", "TEST");
    const second = await new MockRiotClient().resolveRiotId(
      "E2E-stable-user",
      "TEST",
    );
    expect(first.puuid).toBe(second.puuid);
  });
});
