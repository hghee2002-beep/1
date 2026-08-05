import { describe, expect, it } from "vitest";

import {
  inspectMatchScoreIntegrity,
  projectWinLossByParticipantWeek,
  type MatchScoreReconciliationInput,
} from "@/domain/scoring/reconciliation";

function activeSettlement(
  overrides: Partial<MatchScoreReconciliationInput> = {},
): MatchScoreReconciliationInput {
  return {
    participantMatchId: "participant-match-1",
    participantWeekId: "participant-week-1",
    seasonMatchStatus: "PROCESSED",
    eligible: true,
    eligibilityReason: null,
    win: true,
    pointSignedCached: 20,
    pointDraw: {
      state: "REVEALED",
      resultSign: 1,
      firstValue: 20,
      secondValue: null,
      rerollUsed: false,
      finalValue: 20,
      finalSignedValue: 20,
    },
    ledgers: [
      {
        id: "initial-1",
        type: "MATCH_INITIAL",
        amount: 20,
        metadata: null,
      },
    ],
    ...overrides,
  };
}

describe("score reconciliation domain rules", () => {
  it("accepts a draw, initial settlement, cache, and ledger that agree", () => {
    expect(inspectMatchScoreIntegrity(activeSettlement())).toMatchObject({
      issues: [],
      expectedPointSignedCached: 20,
      pointCacheRepairable: false,
    });
  });

  it("accepts a reroll and multiple balanced invalidation cycles", () => {
    const result = inspectMatchScoreIntegrity(
      activeSettlement({
        pointSignedCached: 23,
        pointDraw: {
          state: "REROLLED",
          resultSign: 1,
          firstValue: 20,
          secondValue: 23,
          rerollUsed: true,
          finalValue: 23,
          finalSignedValue: 23,
        },
        ledgers: [
          {
            id: "initial-1",
            type: "MATCH_INITIAL",
            amount: 20,
            metadata: null,
          },
          {
            id: "reroll-1",
            type: "MATCH_REROLL_ADJUSTMENT",
            amount: 3,
            metadata: null,
          },
          {
            id: "invalidation-1",
            type: "MATCH_INVALIDATION",
            amount: -23,
            metadata: null,
          },
          {
            id: "reinstatement-1",
            type: "MATCH_REINSTATEMENT",
            amount: 23,
            metadata: { invalidationLedgerId: "invalidation-1" },
          },
          {
            id: "invalidation-2",
            type: "MATCH_INVALIDATION",
            amount: -23,
            metadata: null,
          },
          {
            id: "reinstatement-2",
            type: "MATCH_REINSTATEMENT",
            amount: 23,
            metadata: { invalidationLedgerId: "invalidation-2" },
          },
        ],
      }),
    );

    expect(result.issues).toEqual([]);
  });

  it("accepts one unpaired reversal for an administrator-invalidated match", () => {
    const result = inspectMatchScoreIntegrity(
      activeSettlement({
        seasonMatchStatus: "INVALID",
        eligible: false,
        eligibilityReason: "ADMIN_INVALIDATED",
        pointSignedCached: 0,
        pointDraw: {
          state: "VOID",
          resultSign: 1,
          firstValue: 20,
          secondValue: null,
          rerollUsed: false,
          finalValue: 20,
          finalSignedValue: 20,
        },
        ledgers: [
          {
            id: "initial-1",
            type: "MATCH_INITIAL",
            amount: 20,
            metadata: null,
          },
          {
            id: "invalidation-1",
            type: "MATCH_INVALIDATION",
            amount: -20,
            metadata: { reversedAmount: 20 },
          },
        ],
      }),
    );

    expect(result.issues).toEqual([]);
  });

  it("reports both a missing draw and a missing initial ledger", () => {
    const result = inspectMatchScoreIntegrity(
      activeSettlement({
        pointDraw: null,
        pointSignedCached: null,
        ledgers: [],
      }),
    );

    expect(result.issues.map((issue) => issue.code)).toEqual([
      "MISSING_POINT_DRAW",
      "INITIAL_LEDGER_COUNT_MISMATCH",
    ]);
  });

  it("reports reroll adjustment and match-ledger net drift", () => {
    const result = inspectMatchScoreIntegrity(
      activeSettlement({
        pointSignedCached: 23,
        pointDraw: {
          state: "REROLLED",
          resultSign: 1,
          firstValue: 20,
          secondValue: 23,
          rerollUsed: true,
          finalValue: 23,
          finalSignedValue: 23,
        },
        ledgers: [
          {
            id: "initial-1",
            type: "MATCH_INITIAL",
            amount: 20,
            metadata: null,
          },
          {
            id: "reroll-1",
            type: "MATCH_REROLL_ADJUSTMENT",
            amount: 2,
            metadata: null,
          },
        ],
      }),
    );

    expect(result.issues.map((issue) => issue.code)).toEqual([
      "REROLL_LEDGER_AMOUNT_MISMATCH",
      "MATCH_LEDGER_NET_MISMATCH",
    ]);
  });

  it("requires every reinstatement to reference exactly one reversal", () => {
    const result = inspectMatchScoreIntegrity(
      activeSettlement({
        ledgers: [
          {
            id: "initial-1",
            type: "MATCH_INITIAL",
            amount: 20,
            metadata: null,
          },
          {
            id: "invalidation-1",
            type: "MATCH_INVALIDATION",
            amount: -20,
            metadata: null,
          },
          {
            id: "reinstatement-1",
            type: "MATCH_REINSTATEMENT",
            amount: 20,
            metadata: { invalidationLedgerId: "unknown-invalidation" },
          },
        ],
      }),
    );

    expect(result.issues.map((issue) => issue.code)).toEqual([
      "INVALIDATION_PAIR_MISMATCH",
    ]);
  });

  it("requires invalidation and reinstatement amounts to reverse the final draw", () => {
    const result = inspectMatchScoreIntegrity(
      activeSettlement({
        ledgers: [
          {
            id: "initial-1",
            type: "MATCH_INITIAL",
            amount: 20,
            metadata: null,
          },
          {
            id: "invalidation-1",
            type: "MATCH_INVALIDATION",
            amount: -19,
            metadata: null,
          },
          {
            id: "reinstatement-1",
            type: "MATCH_REINSTATEMENT",
            amount: 19,
            metadata: { invalidationLedgerId: "invalidation-1" },
          },
        ],
      }),
    );

    expect(result.issues.map((issue) => issue.code)).toEqual([
      "INVALIDATION_REVERSAL_AMOUNT_MISMATCH",
    ]);
  });

  it("marks an isolated participant-match cache drift as repairable", () => {
    const result = inspectMatchScoreIntegrity(
      activeSettlement({ pointSignedCached: 19 }),
    );

    expect(result.issues.map((issue) => issue.code)).toEqual([
      "PARTICIPANT_MATCH_CACHE_MISMATCH",
    ]);
    expect(result.pointCacheRepairable).toBe(true);
    expect(result.expectedPointSignedCached).toBe(20);
  });

  it("projects wins and losses only from eligible processed matches", () => {
    const projection = projectWinLossByParticipantWeek([
      activeSettlement(),
      activeSettlement({
        participantMatchId: "participant-match-2",
        win: false,
      }),
      activeSettlement({
        participantMatchId: "participant-match-3",
        eligible: false,
      }),
      activeSettlement({
        participantMatchId: "participant-match-4",
        seasonMatchStatus: "INVALID",
      }),
    ]);

    expect(projection.get("participant-week-1")).toEqual({
      participantWeekId: "participant-week-1",
      wins: 1,
      losses: 1,
    });
  });
});
