import { describe, expect, it } from "vitest";

import {
  evaluateMatchEligibility,
  RANKED_SOLO_QUEUE_ID,
} from "@/domain/sync/match-eligibility";
import type { MatchSummary } from "@/features/riot/types";

const startAt = new Date("2026-08-01T00:00:00.000Z");
const endAt = new Date("2026-08-08T00:00:00.000Z");

function match(overrides: Partial<MatchSummary> = {}): MatchSummary {
  const gameStartAt = overrides.gameStartAt ?? startAt;
  const durationSeconds = overrides.durationSeconds ?? 1_800;
  return {
    matchId: "KR_ELIGIBILITY_TEST",
    dataVersion: "2",
    platformId: "KR",
    queueId: RANKED_SOLO_QUEUE_ID,
    mapId: 11,
    gameMode: "CLASSIC",
    gameType: "MATCHED_GAME",
    gameVersion: "16.15.1",
    gameStartAt,
    gameEndAt: new Date(gameStartAt.getTime() + durationSeconds * 1_000),
    durationSeconds,
    earlySurrender: false,
    remake: false,
    ...overrides,
  };
}

function evaluate(overrides: Partial<MatchSummary> = {}) {
  return evaluateMatchEligibility({
    match: match(overrides),
    season: { startAt, endAt, minGameDurationSeconds: 600 },
    weeks: [{ id: "week-1", startAt, endAt }],
  });
}

describe("match eligibility", () => {
  it("uses an exact [startAt, endAt) interval", () => {
    expect(evaluate({ gameStartAt: startAt })).toMatchObject({
      eligible: true,
      weekId: "week-1",
    });
    expect(
      evaluate({ gameStartAt: new Date(startAt.getTime() - 1) }),
    ).toMatchObject({ eligible: false, reason: "BEFORE_SEASON" });
    expect(
      evaluate({ gameStartAt: new Date(endAt.getTime() - 1) }),
    ).toMatchObject({ eligible: true, weekId: "week-1" });
    expect(evaluate({ gameStartAt: endAt })).toMatchObject({
      eligible: false,
      reason: "AFTER_SEASON",
    });
  });

  it.each([
    [{ queueId: 440 }, "UNSUPPORTED_QUEUE"],
    [{ mapId: 12 }, "UNSUPPORTED_MAP"],
    [{ gameMode: "ARAM" }, "UNSUPPORTED_MODE"],
    [{ remake: true }, "REMAKE"],
    [{ earlySurrender: true }, "EARLY_SURRENDER"],
    [{ durationSeconds: 599 }, "BELOW_MINIMUM_DURATION"],
  ] as const)("rejects %j as %s", (overrides, reason) => {
    expect(evaluate(overrides)).toMatchObject({ eligible: false, reason });
  });

  it("accepts the exact minimum duration", () => {
    expect(evaluate({ durationSeconds: 600 })).toMatchObject({
      eligible: true,
      reason: "ELIGIBLE",
    });
  });
});
