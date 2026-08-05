import { describe, expect, it } from "vitest";

import {
  MVP_GROUPS,
  MVP_GROUP_WEIGHTS,
  MVP_METRIC_CONTRACT,
  MVP_METRIC_KEYS,
  MVP_POSITION_BONUS_WEIGHTS,
  MVP_POSITIONS,
  type MvpMetricKey,
} from "@/domain/mvp/contract";
import {
  deriveMvpMetrics,
  evaluateMvpParticipant,
  groupWeightTotal,
  rankMvpTeams,
  winsorize,
  zScore,
  type MvpParticipantEvaluation,
} from "@/domain/mvp/evaluator";
import { resolveMvpTierBucket } from "@/domain/mvp/tier";

function baseline() {
  return MVP_METRIC_KEYS.map((metricKey) => ({
    tierBucket: "PLATINUM" as const,
    position: "TOP" as const,
    metricKey,
    mean: 10,
    stdDev: 2,
    sampleSize: 100,
  }));
}

function metrics(value = 12) {
  return Object.fromEntries(
    MVP_METRIC_KEYS.map((metricKey) => [metricKey, value]),
  ) as Partial<Record<MvpMetricKey, number>>;
}

function evaluate(
  overrides: Partial<Parameters<typeof evaluateMvpParticipant>[0]> = {},
) {
  return evaluateMvpParticipant(
    {
      participantKey: "participant-a",
      teamId: 100,
      win: true,
      position: "TOP",
      tierBucket: "PLATINUM",
      deaths: 2,
      objectiveInvolvement: 10,
      metrics: metrics(),
      ...overrides,
    },
    baseline(),
  );
}

function completed(input: {
  key: string;
  teamId: number;
  win: boolean;
  total?: number;
  kda?: number;
  objective?: number;
  deaths?: number;
}): MvpParticipantEvaluation {
  return {
    participantKey: input.key,
    teamId: input.teamId,
    win: input.win,
    position: "TOP",
    tierBucket: "PLATINUM",
    deaths: input.deaths ?? 2,
    objectiveInvolvement: input.objective ?? 10,
    status: "COMPLETED",
    errorCode: null,
    groups: {
      VISION_OBJECTIVE: {
        score: 0,
        configuredWeight: 0.175,
        weightedScore: 0,
        coverage: 1,
        missingMetrics: [],
        metrics: {},
      },
      KDA_PARTICIPATION: {
        score: input.kda ?? 1,
        configuredWeight: 0.225,
        weightedScore: 0.225,
        coverage: 1,
        missingMetrics: [],
        metrics: {},
      },
    },
    totalScore: input.total ?? 1,
    teamRank: null,
    award: "NONE",
    tieBreakPath: [],
  };
}

describe("MVP/ACE evaluator", () => {
  it("keeps common 70%, position bonus 30%, and total 100% for every position", () => {
    for (const position of MVP_POSITIONS) {
      expect(
        MVP_GROUPS.reduce(
          (sum, group) => sum + MVP_POSITION_BONUS_WEIGHTS[position][group],
          0,
        ),
      ).toBeCloseTo(0.3, 12);
      expect(groupWeightTotal(position)).toBeCloseTo(1, 12);
      expect(
        MVP_GROUPS.reduce(
          (sum, group) => sum + MVP_GROUP_WEIGHTS[position][group],
          0,
        ),
      ).toBeCloseTo(1, 12);
    }
  });

  it("derives per-minute and ratio metrics and applies z-score winsorization", () => {
    const derived = deriveMvpMetrics({
      durationSeconds: 1_800,
      teamKills: 20,
      championLevel: 15,
      kills: 8,
      deaths: 2,
      assists: 12,
      cs: 240,
      goldEarned: 12_000,
      damageToChampions: 18_000,
      damageTaken: 15_000,
      damageMitigated: 9_000,
      damageToObjectives: 6_000,
      damageToTurrets: 3_000,
      visionScore: 30,
      wardsPlaced: 12,
      wardsKilled: 6,
      healOnTeammates: 1_000,
      shieldOnTeammates: 2_000,
    });
    expect(derived.csPerMinute).toBe(8);
    expect(derived.goldPerMinute).toBe(400);
    expect(derived.killParticipation).toBe(1);
    expect(derived.kda).toBe(10);
    expect(zScore(16, 10, 2)).toBe(3);
    expect(zScore(10, 10, 0)).toBeNull();
    expect(winsorize(9)).toBe(3);
    expect(winsorize(-9)).toBe(-3);
  });

  it("renormalizes one missing metric but pends below 75% group coverage", () => {
    const oneMissing = metrics();
    delete oneMissing.visionScorePerMinute;
    const allowed = evaluate({ metrics: oneMissing });
    expect(allowed.status).toBe("COMPLETED");
    expect(
      allowed.groups.VISION_OBJECTIVE?.metrics.wardsPlacedPerMinute
        ?.effectiveGroupWeight,
    ).toBeCloseTo(1 / 3, 12);

    const twoMissing = metrics();
    delete twoMissing.visionScorePerMinute;
    delete twoMissing.wardsPlacedPerMinute;
    const pending = evaluate({ metrics: twoMissing });
    expect(pending).toMatchObject({
      status: "PENDING_DATA",
      errorCode: "GROUP_COVERAGE_VISION_OBJECTIVE",
      award: "NONE",
    });
  });

  it("pends when position, tier, or baseline coverage is unavailable", () => {
    expect(evaluate({ position: null })).toMatchObject({
      status: "PENDING_DATA",
      errorCode: "POSITION_MISSING",
    });
    expect(evaluate({ tierBucket: null })).toMatchObject({
      status: "PENDING_BASELINE",
      errorCode: "TIER_BUCKET_UNAVAILABLE",
    });
    expect(
      evaluateMvpParticipant(
        {
          participantKey: "a",
          teamId: 100,
          win: true,
          position: "TOP",
          tierBucket: "PLATINUM",
          deaths: 1,
          objectiveInvolvement: 1,
          metrics: metrics(),
        },
        baseline().slice(1),
      ),
    ).toMatchObject({
      status: "PENDING_BASELINE",
      errorCode: "BASELINE_COVERAGE_MISSING",
    });
  });

  it("maps only supported starting tiers without a lower-tier fallback", () => {
    expect(resolveMvpTierBucket("PLATINUM")).toBe("PLATINUM");
    expect(resolveMvpTierBucket("EMERALD")).toBe("EMERALD");
    expect(resolveMvpTierBucket("DIAMOND")).toBe("DIAMOND");
    expect(resolveMvpTierBucket("MASTER")).toBe("MASTER_PLUS");
    expect(resolveMvpTierBucket("GRANDMASTER")).toBe("MASTER_PLUS");
    expect(resolveMvpTierBucket("CHALLENGER")).toBe("MASTER_PLUS");
    expect(resolveMvpTierBucket("GOLD")).toBeNull();
    expect(resolveMvpTierBucket(null)).toBeNull();
  });

  it.each([
    ["TOTAL_SCORE", { total: 2 }, { total: 1 }],
    ["KDA_PARTICIPATION", { total: 1, kda: 2 }, { total: 1, kda: 1 }],
    [
      "OBJECTIVE_INVOLVEMENT",
      { total: 1, kda: 1, objective: 2 },
      { total: 1, kda: 1, objective: 1 },
    ],
    [
      "FEWER_DEATHS",
      { total: 1, kda: 1, objective: 1, deaths: 1 },
      { total: 1, kda: 1, objective: 1, deaths: 2 },
    ],
    [
      "PARTICIPANT_KEY",
      { total: 1, kda: 1, objective: 1, deaths: 1 },
      { total: 1, kda: 1, objective: 1, deaths: 1 },
    ],
  ])("uses %s as a deterministic tie-break", (reason, winner, runnerUp) => {
    const team = [
      completed({ key: "a", teamId: 100, win: true, ...winner }),
      completed({ key: "b", teamId: 100, win: true, ...runnerUp }),
      completed({ key: "c", teamId: 100, win: true, total: 0 }),
      completed({ key: "d", teamId: 100, win: true, total: -1 }),
      completed({ key: "e", teamId: 100, win: true, total: -2 }),
    ];
    const ranked = rankMvpTeams(team);
    expect(ranked.find((item) => item.participantKey === "a")).toMatchObject({
      teamRank: 1,
      award: "MVP",
      tieBreakPath: [reason],
    });
  });

  it("selects one MVP and one ACE only after comparing all five team members", () => {
    const input = [
      ...[0, 1, 2, 3, 4].map((index) =>
        completed({
          key: `winner-${index}`,
          teamId: 100,
          win: true,
          total: index,
        }),
      ),
      ...[0, 1, 2, 3, 4].map((index) =>
        completed({
          key: `loser-${index}`,
          teamId: 200,
          win: false,
          total: index,
        }),
      ),
    ];
    const ranked = rankMvpTeams(input);
    expect(ranked.filter((item) => item.award === "MVP")).toHaveLength(1);
    expect(ranked.filter((item) => item.award === "ACE")).toHaveLength(1);
    expect(ranked.find((item) => item.award === "MVP")?.participantKey).toBe(
      "winner-4",
    );
    expect(ranked.find((item) => item.award === "ACE")?.participantKey).toBe(
      "loser-4",
    );
  });

  it("withholds team awards when any of the five evaluations is pending", () => {
    const team = [
      completed({ key: "a", teamId: 100, win: true, total: 5 }),
      completed({ key: "b", teamId: 100, win: true, total: 4 }),
      completed({ key: "c", teamId: 100, win: true, total: 3 }),
      completed({ key: "d", teamId: 100, win: true, total: 2 }),
      {
        ...completed({ key: "e", teamId: 100, win: true, total: 1 }),
        status: "PENDING_DATA" as const,
      },
    ];
    expect(rankMvpTeams(team).every((item) => item.award === "NONE")).toBe(
      true,
    );
  });

  it("uses every metric in exactly one group", () => {
    const flattened = MVP_GROUPS.flatMap((group) => MVP_METRIC_CONTRACT[group]);
    expect(new Set(flattened).size).toBe(MVP_METRIC_KEYS.length);
    expect(flattened).toEqual(MVP_METRIC_KEYS);
  });
});
