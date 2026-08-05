import { describe, expect, it } from "vitest";

import {
  calculateMissionRefillAccrual,
  isMissionActiveAt,
  missionRerollNextAvailableAt,
} from "@/domain/missions/lifecycle";
import {
  MissionEvaluatorRegistry,
  missionEvaluatorRegistry,
} from "@/domain/missions/evaluator";
import {
  canActivateMission,
  selectMissionCandidate,
  type MissionDefinitionCandidate,
  type MissionIndexSelector,
} from "@/domain/missions/selection";
import { CryptoMissionIndexSelector } from "@/server/missions/random";

class SeededSelector implements MissionIndexSelector {
  private cursor = 0;

  constructor(private readonly values: readonly number[]) {}

  choose(upperExclusive: number) {
    const value = this.values[this.cursor] ?? 0;
    this.cursor += 1;
    return {
      index: value % upperExclusive,
      entropyHash: `seed-${this.cursor}`,
      algorithm: "test-seeded-v1",
    };
  }
}

function definition(
  code: string,
  overrides: Partial<MissionDefinitionCandidate> = {},
): MissionDefinitionCandidate {
  return {
    id: `definition-${code}`,
    code,
    version: 1,
    points: 2,
    kind: "SINGLE",
    sourceType: "MATCH_INFO",
    evaluatorKey: "match.win",
    evaluatorConfig: { target: "1" },
    active: true,
    ...overrides,
  };
}

describe("mission candidate assignment", () => {
  it("uses rejection sampling and stores only an entropy hash", () => {
    const samples = [
      new Uint8Array(32).fill(255),
      Uint8Array.from([...new Uint8Array(31), 2]),
    ];
    const selector = new CryptoMissionIndexSelector(() => samples.shift()!);
    const proof = selector.choose(3);
    expect(proof).toMatchObject({
      index: 2,
      algorithm: "crypto-rejection-u256-v1",
    });
    expect(proof.entropyHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("prioritizes unseen candidates and only returns deferred after unseen exhaustion", () => {
    const unseen = definition("M001");
    const deferred = definition("M002");
    const first = selectMissionCandidate({
      definitions: [unseen, deferred],
      history: [{ missionDefinitionId: deferred.id, status: "DEFERRED" }],
      active: [],
      participantPrimaryPosition: null,
      timelineAvailable: true,
      hasPublishedMvpBaseline: false,
      selector: new SeededSelector([1]),
    });
    expect(first).toMatchObject({
      definition: { id: unseen.id },
      pool: "UNSEEN",
    });

    const second = selectMissionCandidate({
      definitions: [unseen, deferred],
      history: [
        { missionDefinitionId: unseen.id, status: "COMPLETED" },
        { missionDefinitionId: deferred.id, status: "DEFERRED" },
      ],
      active: [],
      participantPrimaryPosition: null,
      timelineAvailable: true,
      hasPublishedMvpBaseline: false,
      selector: new SeededSelector([0]),
    });
    expect(second).toMatchObject({
      definition: { id: deferred.id },
      pool: "DEFERRED",
    });
  });

  it("enforces high-point, timeline, cumulative, role, and M100 caps", () => {
    const active = [
      definition("M011", { points: 5 }),
      definition("M046", { sourceType: "MATCH_TIMELINE" }),
      definition("M047", { sourceType: "MATCH_TIMELINE" }),
      definition("M071", {
        evaluatorKey: "position.winAs",
        evaluatorConfig: { target: "TOP" },
      }),
    ];
    expect(
      canActivateMission({
        candidate: definition("M100", {
          points: 5,
          kind: "CUMULATIVE",
          sourceType: "INTERNAL",
        }),
        active,
        participantPrimaryPosition: "TOP",
        timelineAvailable: true,
        hasPublishedMvpBaseline: false,
      }),
    ).toBe(false);
    expect(
      canActivateMission({
        candidate: definition("M056", { sourceType: "MATCH_TIMELINE" }),
        active,
        participantPrimaryPosition: "TOP",
        timelineAvailable: true,
        hasPublishedMvpBaseline: true,
      }),
    ).toBe(false);
    expect(
      canActivateMission({
        candidate: definition("M071-B", {
          evaluatorKey: "position.winAs",
          evaluatorConfig: { target: "TOP" },
        }),
        active,
        participantPrimaryPosition: "TOP",
        timelineAvailable: true,
        hasPublishedMvpBaseline: true,
      }),
    ).toBe(false);
  });

  it("can reserve the first slot for a low-point general mission", () => {
    const selected = selectMissionCandidate({
      definitions: [definition("M039", { points: 8 }), definition("M001")],
      history: [],
      active: [],
      participantPrimaryPosition: null,
      timelineAvailable: true,
      hasPublishedMvpBaseline: false,
      requireLowPointMission: true,
      selector: new SeededSelector([0]),
    });
    expect(selected?.definition.code).toBe("M001");
  });

  it("returns null safely when the eligible pool is smaller than a slot request", () => {
    const only = definition("M001");
    expect(
      selectMissionCandidate({
        definitions: [only],
        history: [{ missionDefinitionId: only.id, status: "COMPLETED" }],
        active: [],
        participantPrimaryPosition: null,
        timelineAvailable: true,
        hasPublishedMvpBaseline: false,
        selector: new SeededSelector([0]),
      }),
    ).toBeNull();
  });
});

describe("mission refill and time boundaries", () => {
  const weekStart = new Date("2026-08-02T15:00:00.000Z"); // 00:00 KST

  it("accrues exactly on six-hour boundaries and catches up missed ticks", () => {
    const before = calculateMissionRefillAccrual({
      anchorAt: weekStart,
      accountedThroughAt: weekStart,
      now: new Date("2026-08-02T20:59:59.999Z"),
      credits: 0,
    });
    expect(before.credits).toBe(0);

    const boundary = calculateMissionRefillAccrual({
      anchorAt: weekStart,
      accountedThroughAt: weekStart,
      now: new Date("2026-08-02T21:00:00.000Z"),
      credits: 0,
    });
    expect(boundary).toMatchObject({ credits: 1, accrued: 1 });
    expect(boundary.nextAccrualAt.toISOString()).toBe(
      "2026-08-03T03:00:00.000Z",
    );

    const missed = calculateMissionRefillAccrual({
      anchorAt: weekStart,
      accountedThroughAt: weekStart,
      now: new Date("2026-08-04T21:00:00.000Z"),
      credits: 1,
    });
    expect(missed.accrued).toBe(9);
    expect(missed.credits).toBe(3);
  });

  it("uses a one-hour reroll cooldown and half-open activation intervals", () => {
    const usedAt = new Date("2026-08-05T03:00:00.000Z");
    expect(missionRerollNextAvailableAt(usedAt).toISOString()).toBe(
      "2026-08-05T04:00:00.000Z",
    );
    expect(
      isMissionActiveAt({
        activeFrom: usedAt,
        activeTo: new Date("2026-08-05T04:00:00.000Z"),
        at: new Date("2026-08-05T03:59:59.999Z"),
      }),
    ).toBe(true);
    expect(
      isMissionActiveAt({
        activeFrom: usedAt,
        activeTo: new Date("2026-08-05T04:00:00.000Z"),
        at: new Date("2026-08-05T04:00:00.000Z"),
      }),
    ).toBe(false);
  });
});

describe("mission evaluator registry boundary", () => {
  it("contains the complete M001-M100 evaluator set", () => {
    expect(missionEvaluatorRegistry.codes()).toHaveLength(100);
    expect(missionEvaluatorRegistry.keys()).toContain("combat.kdaAtLeast");
    expect(missionEvaluatorRegistry.keys()).toContain(
      "objective.dragonTakedownsAtLeast",
    );
    expect(missionEvaluatorRegistry.keys()).toContain("cumulative.games");
    expect(missionEvaluatorRegistry.has("timeline.killBeforeSeconds")).toBe(
      true,
    );
    expect(missionEvaluatorRegistry.has("cumulative.mvpAceAwards")).toBe(true);
    expect(
      () =>
        new MissionEvaluatorRegistry([
          missionEvaluatorRegistry.get("match.win")!,
          missionEvaluatorRegistry.get("match.win")!,
        ]),
    ).toThrow(/Duplicate mission evaluator key/u);
  });
});
