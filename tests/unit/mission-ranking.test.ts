import { describe, expect, it } from "vitest";

import {
  rankMissionStandings,
  rebuildMissionProgress,
} from "@/domain/missions/ranking";

describe("mission ranking and progress reconstruction", () => {
  it("uses competition ranks for ties", () => {
    expect(
      rankMissionStandings([
        { participantWeekId: "bravo", score: 5 },
        { participantWeekId: "alpha", score: 10 },
        { participantWeekId: "charlie", score: 10 },
        { participantWeekId: "delta", score: 2 },
      ]).map(({ participantWeekId, rank }) => ({ participantWeekId, rank })),
    ).toEqual([
      { participantWeekId: "alpha", rank: 1 },
      { participantWeekId: "charlie", rank: 1 },
      { participantWeekId: "bravo", rank: 3 },
      { participantWeekId: "delta", rank: 4 },
    ]);
  });

  it("rebuilds resettable progress from append-only signed deltas", () => {
    expect(
      rebuildMissionProgress([
        { deltaValue: 1 },
        { deltaValue: -1 },
        { deltaValue: 1 },
        { deltaValue: 1 },
      ]),
    ).toBe(2);
  });
});
