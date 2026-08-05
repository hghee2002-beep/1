import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  MISSION_EVALUATOR_KEYS_M001_M055,
  missionEvaluatorRegistry,
  type ImplementedMissionCode,
  type MissionEvaluationContext,
} from "@/domain/missions/evaluator";
import { missingMissionStaticData } from "@/domain/missions/static-data";

const targets: Record<ImplementedMissionCode, number> = {
  M001: 1,
  M002: 3,
  M003: 5,
  M004: 8,
  M005: 8,
  M006: 12,
  M007: 15,
  M008: 15,
  M009: 25,
  M010: 2,
  M011: 0,
  M012: 0.6,
  M013: 0.75,
  M014: 25_000,
  M015: 40_000,
  M016: 800,
  M017: 35_000,
  M018: 30_000,
  M019: 30,
  M020: 10_000,
  M021: 150,
  M022: 200,
  M023: 7,
  M024: 8.5,
  M025: 15_000,
  M026: 40,
  M027: 70,
  M028: 100,
  M029: 3,
  M030: 5,
  M031: 20_000,
  M032: 5_000,
  M033: 18,
  M034: 900,
  M035: 450,
  M036: 1,
  M037: 1,
  M038: 1,
  M039: 1,
  M040: 5,
  M041: 3,
  M042: 1,
  M043: 1,
  M044: 3,
  M045: 1,
  M046: 2,
  M047: 1,
  M048: 1,
  M049: 1,
  M050: 3,
  M051: 1,
  M052: 1_500,
  M053: 957,
  M054: 2_100,
  M055: 1,
};

function baseContext(): MissionEvaluationContext {
  return {
    match: {
      eligible: true,
      queueId: 420,
      requiredQueueId: 420,
      durationSeconds: 1_800,
      minimumDurationSeconds: 600,
      startedAt: new Date("2026-08-05T03:00:00.000Z"),
    },
    participant: {
      participantId: 1,
      teamId: 100,
      position: "MIDDLE",
      primaryPosition: "MIDDLE",
      championId: 103,
      itemIds: [],
      primaryRuneStyleId: 8200,
      summonerSpellIds: [4, 14],
      win: false,
      kills: 0,
      deaths: 1,
      assists: 0,
      totalMinionsKilled: 0,
      neutralMinionsKilled: 0,
      goldEarned: 0,
      damageToChampions: 0,
      damageTaken: 0,
      damageMitigated: 0,
      damageToObjectives: 0,
      damageToTurrets: 0,
      visionScore: 0,
      wardsKilled: 0,
      controlWardsBought: 0,
      timeCCingOthers: 0,
      healOnTeammates: 0,
      shieldOnTeammates: 0,
      championLevel: 1,
      doubleKills: 0,
      tripleKills: 0,
      quadraKills: 0,
      pentaKills: 0,
      largestKillingSpree: 0,
      firstBloodKill: false,
      firstBloodAssist: false,
      firstTowerKill: false,
      firstTowerAssist: false,
      turretKills: 0,
      turretAssists: 0,
      inhibitorKills: 0,
      inhibitorAssists: 0,
      inhibitorTakedowns: 0,
      challenges: {
        soloKills: 0,
        turretTakedowns: 0,
        inhibitorTakedowns: 0,
        objectivesStolen: 0,
        longestTimeSpentLiving: 0,
      },
    },
    team: {
      teamId: 100,
      championKills: 20,
      dragonKills: 0,
      baronKills: 0,
    },
    timeline: { status: "AVAILABLE", events: [], frames: [] },
    staticData: missingMissionStaticData,
    internal: { mvpAceAward: "NONE" },
    assignment: {
      activeFrom: new Date("2026-08-05T02:59:59.000Z"),
    },
    aggregate: { currentProgress: 0 },
    evaluatorVersion: "v1",
  };
}

type FixtureMode = "success" | "boundary" | "failure";
type ParticipantNumberField =
  | "kills"
  | "assists"
  | "damageToChampions"
  | "damageTaken"
  | "damageMitigated"
  | "timeCCingOthers"
  | "goldEarned"
  | "visionScore"
  | "controlWardsBought"
  | "wardsKilled"
  | "damageToObjectives"
  | "damageToTurrets"
  | "championLevel"
  | "doubleKills"
  | "tripleKills"
  | "quadraKills"
  | "pentaKills"
  | "largestKillingSpree";

const directFieldByEvaluator: Partial<Record<string, ParticipantNumberField>> =
  {
    "combat.killsAtLeast": "kills",
    "combat.assistsAtLeast": "assists",
    "damage.toChampionsAtLeast": "damageToChampions",
    "damage.takenAtLeast": "damageTaken",
    "damage.mitigatedAtLeast": "damageMitigated",
    "combat.ccTimeAtLeast": "timeCCingOthers",
    "growth.goldAtLeast": "goldEarned",
    "vision.scoreAtLeast": "visionScore",
    "vision.controlWardsBoughtAtLeast": "controlWardsBought",
    "vision.wardsKilledAtLeast": "wardsKilled",
    "objective.damageAtLeast": "damageToObjectives",
    "objective.turretDamageAtLeast": "damageToTurrets",
    "growth.levelAtLeast": "championLevel",
    "combat.doubleKillsAtLeast": "doubleKills",
    "combat.tripleKillsAtLeast": "tripleKills",
    "combat.quadraKillsAtLeast": "quadraKills",
    "combat.pentaKillsAtLeast": "pentaKills",
    "combat.largestKillingSpreeAtLeast": "largestKillingSpree",
  };

function atLeastValue(target: number, mode: FixtureMode) {
  if (mode === "success") return target + 1;
  if (mode === "failure") return Math.max(0, target - 1);
  return target;
}

function countFor(target: number, mode: FixtureMode) {
  return Math.round(atLeastValue(target, mode));
}

function objectiveEvents(
  monsterType: "DRAGON" | "BARON_NASHOR" | "RIFTHERALD",
  count: number,
) {
  return Array.from({ length: count }, (_, index) => ({
    type: "ELITE_MONSTER_KILL",
    timestampMs: 600_000 + index * 1_000,
    participantId: null,
    creatorId: null,
    killerId: 2,
    victimId: null,
    assistingParticipantIds: [1, 3],
    itemId: null,
    beforeId: null,
    afterId: null,
    monsterType,
    monsterSubType: null,
  }));
}

function fixture(
  code: ImplementedMissionCode,
  mode: FixtureMode,
): MissionEvaluationContext {
  const context = baseContext();
  const target = targets[code];
  const key = MISSION_EVALUATOR_KEYS_M001_M055[code];
  const directField = directFieldByEvaluator[key];
  if (directField) {
    context.participant[directField] = atLeastValue(target, mode);
    return context;
  }

  switch (key) {
    case "match.win":
      context.participant.win = mode !== "failure";
      break;
    case "combat.kdaAtLeast":
      context.participant.deaths = 1;
      context.participant.kills = atLeastValue(target, mode);
      break;
    case "combat.winWithDeathsAtMost":
      context.participant.win = true;
      context.participant.deaths =
        mode === "failure"
          ? target + 1
          : mode === "success"
            ? Math.max(0, target - 1)
            : target;
      break;
    case "combat.killParticipationAtLeast":
      context.team = { ...context.team!, championKills: 100 };
      context.participant.kills =
        mode === "success"
          ? Math.round(target * 100) + 1
          : mode === "failure"
            ? Math.round(target * 100) - 1
            : Math.round(target * 100);
      break;
    case "damage.perMinuteAtLeast":
      context.match.durationSeconds = 600;
      context.participant.damageToChampions =
        mode === "success"
          ? target * 10 + 1
          : mode === "failure"
            ? target * 10 - 1
            : target * 10;
      break;
    case "support.allyHealShieldAtLeast":
      context.participant.healOnTeammates =
        mode === "failure" ? target - 1 : target;
      context.participant.shieldOnTeammates = mode === "success" ? 1 : 0;
      break;
    case "growth.csAtLeast":
      context.participant.totalMinionsKilled = atLeastValue(target, mode) - 10;
      context.participant.neutralMinionsKilled = 10;
      break;
    case "growth.csPerMinuteAtLeast":
      context.match.durationSeconds = 600;
      context.participant.totalMinionsKilled =
        mode === "success"
          ? target * 10 + 1
          : mode === "failure"
            ? target * 10 - 1
            : target * 10;
      break;
    case "combat.longestLifeAtLeast":
      context.participant.challenges.longestTimeSpentLiving = atLeastValue(
        target,
        mode,
      );
      break;
    case "growth.goldPerMinuteAtLeast":
      context.match.durationSeconds = 600;
      context.participant.goldEarned =
        mode === "success"
          ? target * 10 + 1
          : mode === "failure"
            ? target * 10 - 1
            : target * 10;
      break;
    case "combat.soloKillsAtLeast":
      context.participant.challenges.soloKills = atLeastValue(target, mode);
      break;
    case "combat.firstBloodParticipation":
      context.participant.firstBloodAssist = mode !== "failure";
      break;
    case "objective.firstTowerParticipation":
      context.participant.firstTowerAssist = mode !== "failure";
      break;
    case "objective.turretTakedownsAtLeast":
      context.participant.challenges.turretTakedowns = atLeastValue(
        target,
        mode,
      );
      break;
    case "objective.inhibitorTakedownsAtLeast":
      context.participant.challenges.inhibitorTakedowns = atLeastValue(
        target,
        mode,
      );
      break;
    case "objective.dragonTakedownsAtLeast":
      context.timeline.events = objectiveEvents(
        "DRAGON",
        countFor(target, mode),
      );
      break;
    case "objective.baronTakedownsAtLeast":
      context.timeline.events = objectiveEvents(
        "BARON_NASHOR",
        countFor(target, mode),
      );
      break;
    case "objective.heraldTakedownsAtLeast":
      context.timeline.events = objectiveEvents(
        "RIFTHERALD",
        countFor(target, mode),
      );
      break;
    case "objective.stealsAtLeast":
      context.participant.challenges.objectivesStolen = atLeastValue(
        target,
        mode,
      );
      break;
    case "objective.teamDragonsAtLeast":
      context.team = {
        ...context.team!,
        dragonKills: atLeastValue(target, mode),
      };
      break;
    case "objective.winWithTeamBaron":
      context.participant.win = mode !== "failure";
      context.team = { ...context.team!, baronKills: 1 };
      break;
    case "result.winWithinSeconds":
      context.participant.win = true;
      context.match.durationSeconds =
        mode === "failure"
          ? target + 1
          : mode === "success"
            ? target - 1
            : target;
      break;
    case "result.winAfterSeconds":
      context.participant.win = true;
      context.match.durationSeconds =
        mode === "failure"
          ? target - 1
          : mode === "success"
            ? target + 1
            : target;
      break;
    case "objective.winWithDragonsAndBaron":
      context.participant.win = mode !== "failure";
      context.team = { ...context.team!, dragonKills: 2, baronKills: 1 };
      break;
    default:
      throw new Error(`Missing fixture builder for ${code} (${key})`);
  }
  return context;
}

function evaluate(code: ImplementedMissionCode, mode: FixtureMode) {
  const evaluator = missionEvaluatorRegistry.getByCode(code);
  if (!evaluator) throw new Error(`Missing evaluator for ${code}`);
  return evaluator.evaluate(fixture(code, mode), {
    target: String(targets[code]),
  });
}

describe("M001-M055 mission evaluator catalog", () => {
  const codes = Object.keys(
    MISSION_EVALUATOR_KEYS_M001_M055,
  ) as ImplementedMissionCode[];
  for (const code of codes) {
    it(`${code} passes an above-threshold success fixture`, () => {
      expect(evaluate(code, "success").status).toBe("PASS");
    });

    it(`${code} passes its inclusive boundary`, () => {
      const result = evaluate(code, "boundary");
      expect(result.status).toBe("PASS");
      expect(result.targetValue).toBe(targets[code]);
      expect(result.evaluatorVersion).toBe("v1");
    });

    it(`${code} fails immediately outside its boundary`, () => {
      expect(evaluate(code, "failure").status).toBe("FAIL");
    });
  }

  it("registers every code and matches the catalog evaluatorKey used by seed", () => {
    expect(codes).toHaveLength(55);
    const markdown = readFileSync("docs/MISSION_CATALOG.md", "utf8");
    const catalog = Object.fromEntries(
      markdown
        .split(/\r?\n/u)
        .filter((line) => /^\| M0(?:[0-4]\d|5[0-5]) \|/u.test(line))
        .map((line) => {
          const cells = line
            .split("|")
            .slice(1, -1)
            .map((cell) => cell.trim().replaceAll("`", ""));
          return [cells[0], cells[6]];
        }),
    );
    expect(catalog).toEqual(MISSION_EVALUATOR_KEYS_M001_M055);
    for (const key of Object.values(MISSION_EVALUATOR_KEYS_M001_M055)) {
      expect(missionEvaluatorRegistry.has(key)).toBe(true);
    }
  });
});

describe("mission evaluator data boundaries", () => {
  it("fails KP explicitly when the participant team has zero kills", () => {
    const context = fixture("M012", "boundary");
    context.team = { ...context.team!, championKills: 0 };
    const result = missionEvaluatorRegistry
      .getByCode("M012")!
      .evaluate(context, { target: "0.6" });
    expect(result).toMatchObject({ status: "FAIL", currentValue: 0 });
    expect(result.evidence.zeroTeamKillsRule).toBe("FAIL");
  });

  it("treats exactly 15:57 as an inclusive win boundary in seconds", () => {
    const result = evaluate("M053", "boundary");
    expect(result).toMatchObject({
      status: "PASS",
      currentValue: 957,
      targetValue: 957,
      unit: "second",
    });
    expect(result.evidence.durationUnit).toBe("seconds");
  });

  it("uses gameDuration seconds for per-minute calculations", () => {
    const result = evaluate("M016", "boundary");
    expect(result).toMatchObject({ status: "PASS", currentValue: 800 });
    expect(result.evidence).toMatchObject({
      durationSeconds: 600,
      durationUnit: "seconds",
    });
  });

  it("accepts first blood assist without requiring the kill", () => {
    const result = evaluate("M042", "boundary");
    expect(result.status).toBe("PASS");
    expect(result.evidence).toMatchObject({ kill: false, assist: true });
  });

  it("counts objective assistingParticipantIds and records millisecond source units", () => {
    const result = evaluate("M046", "boundary");
    expect(result).toMatchObject({ status: "PASS", currentValue: 2 });
    expect(result.evidence).toMatchObject({
      participantId: 1,
      matchedEvents: 2,
      timestampUnit: "milliseconds",
    });
  });

  it("keeps missing Challenges data pending and uses the documented turret fallback", () => {
    const soloContext = fixture("M041", "boundary");
    soloContext.participant.challenges.soloKills = null;
    expect(
      missionEvaluatorRegistry
        .getByCode("M041")!
        .evaluate(soloContext, { target: "3" }),
    ).toMatchObject({
      status: "PENDING_DATA",
      reason: "MISSING_CHALLENGES_FIELD",
    });

    const turretContext = fixture("M044", "boundary");
    turretContext.participant.challenges.turretTakedowns = null;
    turretContext.participant.turretKills = 1;
    turretContext.participant.turretAssists = 2;
    expect(
      missionEvaluatorRegistry
        .getByCode("M044")!
        .evaluate(turretContext, { target: "3" }),
    ).toMatchObject({
      status: "PASS",
      currentValue: 3,
      evidence: { source: "kill_assist_fallback" },
    });
    turretContext.participant.turretKills = null;
    expect(
      missionEvaluatorRegistry
        .getByCode("M044")!
        .evaluate(turretContext, { target: "3" }),
    ).toMatchObject({ status: "PENDING_DATA" });
  });

  it("rechecks queue, duration, and assignment activation in the common gate", () => {
    const evaluator = missionEvaluatorRegistry.getByCode("M001")!;
    const unsupported = fixture("M001", "boundary");
    unsupported.match.queueId = 440;
    expect(evaluator.evaluate(unsupported, { target: "1" })).toMatchObject({
      status: "NOT_APPLICABLE",
      reason: "UNSUPPORTED_QUEUE",
    });

    const short = fixture("M001", "boundary");
    short.match.durationSeconds = 599;
    expect(evaluator.evaluate(short, { target: "1" })).toMatchObject({
      status: "NOT_APPLICABLE",
      reason: "MATCH_TOO_SHORT",
    });

    const inactive = fixture("M001", "boundary");
    inactive.assignment.activeFrom = new Date("2026-08-05T03:00:00.001Z");
    expect(evaluator.evaluate(inactive, { target: "1" })).toMatchObject({
      status: "NOT_APPLICABLE",
      reason: "ASSIGNMENT_NOT_ACTIVE_AT_START",
    });
  });
});
