import { describe, expect, it } from "vitest";

import {
  normalizeAccount,
  normalizeMatch,
  normalizeSoloQueueEntries,
  normalizeSummoner,
  normalizeTimeline,
} from "@/features/riot/normalizers";
import { createRawMatch, createRawTimeline } from "../fixtures/riot";

describe("Riot response normalization", () => {
  it("normalizes account, summoner, and only the solo queue entry", () => {
    expect(
      normalizeAccount(
        { puuid: "PUUID_1" },
        { gameName: "Cloud Tempo", tagLine: "0217" },
      ),
    ).toEqual({
      puuid: "PUUID_1",
      gameName: "Cloud Tempo",
      tagLine: "0217",
    });
    expect(
      normalizeSummoner({
        id: "SUMMONER_1",
        puuid: "PUUID_1",
        profileIconId: 29,
        summonerLevel: 411,
        ignoredRawField: "not propagated",
      }),
    ).toEqual({
      id: "SUMMONER_1",
      puuid: "PUUID_1",
      profileIconId: 29,
      summonerLevel: 411,
    });
    expect(
      normalizeSoloQueueEntries([
        {
          queueType: "RANKED_FLEX_SR",
          tier: "MASTER",
          rank: "I",
          leaguePoints: 99,
        },
        {
          queueType: "RANKED_SOLO_5x5",
          tier: "DIAMOND",
          rank: "II",
          leaguePoints: 54,
          wins: 20,
          losses: 10,
          hotStreak: true,
        },
      ]),
    ).toMatchObject({
      queueType: "RANKED_SOLO_5x5",
      tier: "DIAMOND",
      rank: "II",
      leaguePoints: 54,
      wins: 20,
      losses: 10,
      hotStreak: true,
    });
  });

  it("normalizes all positions and representative mission facts", () => {
    const match = normalizeMatch(createRawMatch());
    expect(match).toMatchObject({
      matchId: "KR_TEST_001",
      queueId: 420,
      mapId: 11,
      durationSeconds: 1_800,
      remake: false,
    });
    expect(
      match.participants.slice(0, 5).map((entry) => entry.position),
    ).toEqual(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);
    expect(match.participants[0]).toMatchObject({
      cs: 185,
      controlWardsBought: 3,
      summonerSpellIds: [4, 14],
      challenges: {
        soloKills: 3,
        turretTakedowns: 4,
        longestTimeSpentLiving: 930,
      },
    });
    expect(match.teams[0]).toMatchObject({
      championKills: 30,
      objectives: { dragon: { kills: 3 }, baron: { kills: 1 } },
    });
  });

  it("keeps omitted challenge fields unavailable rather than turning them into zero", () => {
    const raw = createRawMatch();
    const first = raw.info.participants[0];
    if (!first) throw new Error("fixture participant missing");
    const withoutChallenges: Record<string, unknown> = { ...first };
    Reflect.deleteProperty(withoutChallenges, "challenges");
    Reflect.deleteProperty(withoutChallenges, "objectivesStolen");
    Reflect.deleteProperty(withoutChallenges, "detectorWardsPlaced");
    Reflect.deleteProperty(withoutChallenges, "longestTimeSpentLiving");
    const match = normalizeMatch({
      ...raw,
      info: {
        ...raw.info,
        participants: [withoutChallenges, ...raw.info.participants.slice(1)],
      },
    });
    expect(match.participants[0]?.challenges).toEqual({
      soloKills: null,
      turretTakedowns: null,
      inhibitorTakedowns: null,
      objectivesStolen: null,
      controlWardsPlaced: null,
      longestTimeSpentLiving: null,
    });
  });

  it("sorts timeline frames and events while preserving the required subset", () => {
    const raw = createRawTimeline();
    const sourceFrame = raw.info.frames[0];
    if (!sourceFrame) throw new Error("fixture timeline frame missing");
    raw.info.frames.push({
      ...sourceFrame,
      timestamp: 0,
      events: [],
    });
    const timeline = normalizeTimeline(raw);
    expect(timeline.frames.map((frame) => frame.timestampMs)).toEqual([
      0, 600_000,
    ]);
    expect(
      timeline.frames[1]?.events.map((event) => event.timestampMs),
    ).toEqual([240_000, 540_000]);
    expect(timeline.frames[1]?.events[1]).toMatchObject({
      type: "ELITE_MONSTER_KILL",
      killerId: 2,
      assistingParticipantIds: [1, 3],
      monsterType: "DRAGON",
    });
  });

  it("rejects missing critical fields with a safe typed error", () => {
    const raw = createRawMatch();
    const malformed = { ...raw, metadata: { dataVersion: "2" } };
    expect(() => normalizeMatch(malformed)).toThrowError(
      expect.objectContaining({ code: "RIOT_MALFORMED_RESPONSE" }),
    );
    expect(() => normalizeAccount({ puuid: "PUUID_1" })).toThrowError(
      expect.objectContaining({ code: "RIOT_MALFORMED_RESPONSE" }),
    );
  });
});
