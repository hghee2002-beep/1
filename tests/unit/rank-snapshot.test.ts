import { describe, expect, it } from "vitest";

import {
  isSameRankSnapshot,
  rankDisplayOrdinal,
  rankObservationStatus,
} from "@/domain/sync/rank-snapshot";
import { rankMainStandings, toSeoulDateOnly } from "@/domain/sync/standings";

const emeraldTwo = {
  tier: "EMERALD",
  rank: "II",
  leaguePoints: 42,
  wins: 20,
  losses: 15,
};

describe("rank snapshots and standings", () => {
  it("creates a version-stable display ordinal without calling it MMR", () => {
    expect(rankDisplayOrdinal(emeraldTwo)).toBe(2_242);
    expect(
      rankDisplayOrdinal({
        ...emeraldTwo,
        tier: "MASTER",
        rank: "I",
        leaguePoints: 186,
      }),
    ).toBe(2_986);
    expect(rankDisplayOrdinal(null)).toBeNull();
    expect(rankDisplayOrdinal({ ...emeraldTwo, tier: "UNKNOWN" })).toBeNull();
  });

  it("distinguishes unchanged, changed, and unranked states", () => {
    expect(isSameRankSnapshot(emeraldTwo, { ...emeraldTwo })).toBe(true);
    expect(
      isSameRankSnapshot(emeraldTwo, { ...emeraldTwo, leaguePoints: 43 }),
    ).toBe(false);
    expect(isSameRankSnapshot(null, null)).toBe(true);
    expect(isSameRankSnapshot(emeraldTwo, null)).toBe(false);
    expect(
      rankObservationStatus({
        current: null,
        previous: null,
        hasPrevious: false,
      }),
    ).toBe("UNRANKED");
    expect(
      rankObservationStatus({
        current: null,
        previous: null,
        hasPrevious: true,
      }),
    ).toBe("UNCHANGED");
    expect(
      rankObservationStatus({
        current: emeraldTwo,
        previous: null,
        hasPrevious: true,
      }),
    ).toBe("CAPTURED");
  });

  it("uses competition ranking with all documented tie breakers", () => {
    expect(
      rankMainStandings([
        { participantWeekId: "c", mainScore: 90, wins: 8, losses: 3 },
        { participantWeekId: "b", mainScore: 100, wins: 7, losses: 2 },
        { participantWeekId: "a", mainScore: 100, wins: 7, losses: 2 },
        { participantWeekId: "d", mainScore: 100, wins: 6, losses: 1 },
      ]).map(({ participantWeekId, rank }) => ({ participantWeekId, rank })),
    ).toEqual([
      { participantWeekId: "a", rank: 1 },
      { participantWeekId: "b", rank: 1 },
      { participantWeekId: "d", rank: 3 },
      { participantWeekId: "c", rank: 4 },
    ]);
  });

  it("derives the stored date from Asia/Seoul rather than UTC", () => {
    expect(toSeoulDateOnly(new Date("2026-08-04T15:30:00.000Z"))).toEqual(
      new Date("2026-08-05T00:00:00.000Z"),
    );
  });
});
