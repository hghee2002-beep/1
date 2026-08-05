import { describe, expect, it } from "vitest";

import { compareRiotIds } from "@/lib/riot-id-order";
import {
  contextualRecordLabel,
  selectGameLeader,
} from "@/server/dashboard/highlights";
import { parseHistoryStandings } from "@/server/dashboard/history";
import {
  calculateRankLpDelta,
  rankMainStandings,
} from "@/server/dashboard/ranking";
import { kstDateKey } from "@/server/dashboard/time";

describe("dashboard read-model calculations", () => {
  it("applies score, record difference, wins, and competition ranking", () => {
    const ranked = rankMainStandings([
      { participantId: "b", score: 120, wins: 9, losses: 0 },
      { participantId: "a", score: 120, wins: 9, losses: 0 },
      { participantId: "c", score: 120, wins: 8, losses: 0 },
      { participantId: "d", score: 98, wins: 20, losses: 0 },
    ]);

    expect(ranked.map((row) => [row.participantId, row.rank])).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 3],
      ["d", 4],
    ]);
  });

  it("falls back safely when the starting rank snapshot is missing", () => {
    expect(
      calculateRankLpDelta(
        { leaguePoints: 70, displayOrdinal: 4_100 },
        undefined,
      ),
    ).toBe(0);
    expect(
      calculateRankLpDelta(
        { leaguePoints: 70, displayOrdinal: null },
        { leaguePoints: 42, displayOrdinal: null },
      ),
    ).toBe(28);
  });

  it("orders tied public rows by normalized Riot ID instead of random database ids", () => {
    const rows = [
      { gameName: "한글", tagLine: "KR1" },
      { gameName: "graphite", tagLine: "KR001" },
      { gameName: "Graphite", tagLine: "KR1" },
    ].sort(compareRiotIds);

    expect(rows).toEqual([
      { gameName: "graphite", tagLine: "KR001" },
      { gameName: "Graphite", tagLine: "KR1" },
      { gameName: "한글", tagLine: "KR1" },
    ]);
  });

  it("orders tied daily-game highlights by normalized Riot ID", () => {
    const korean = { id: "a-random-id", gameName: "한글", tagLine: "KR1" };
    const graphite = {
      id: "z-random-id",
      gameName: "Graphite",
      tagLine: "KR1",
    };

    expect(
      selectGameLeader(
        [korean, graphite],
        new Map([
          [korean.id, 1],
          [graphite.id, 1],
        ]),
      ),
    ).toEqual({ participant: graphite, value: 1 });
  });

  it("labels missing-today data as a dated recent fallback", () => {
    expect(
      contextualRecordLabel({
        todayKey: "2026-08-05",
        recordDate: "2026-08-04",
        todayLabel: "오늘 LP 상승",
        recentLabel: "최근 LP 상승",
        emptyLabel: "LP 기록 없음",
      }),
    ).toBe("2026-08-04 최근 LP 상승");
  });

  it("keeps the Asia/Seoul date across the UTC day boundary", () => {
    expect(kstDateKey(new Date("2026-08-04T16:30:00.000Z"))).toBe("2026-08-05");
  });

  it("projects immutable history JSON through the public data boundary", () => {
    const [row] = parseHistoryStandings([
      {
        rank: 1,
        participantId: "participant-id",
        gameName: "SafeName",
        tagLine: "KR1",
        realName: null,
        score: 77,
        wins: 4,
        losses: 1,
        puuid: "must-not-leak",
        nonce: "must-not-leak",
        rawTimeline: { secret: true },
      },
    ]);

    expect(row).toEqual({
      rank: 1,
      participantId: "participant-id",
      gameName: "SafeName",
      tagLine: "KR1",
      realName: null,
      score: 77,
      wins: 4,
      losses: 1,
      completed: 0,
    });
    expect(row).not.toHaveProperty("puuid");
    expect(row).not.toHaveProperty("nonce");
    expect(row).not.toHaveProperty("rawTimeline");
  });
});
