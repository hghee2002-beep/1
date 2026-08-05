import { describe, expect, it } from "vitest";

import {
  MISSION_EVALUATOR_KEYS_M001_M100,
  missionEvaluatorRegistry,
  type ImplementedMissionCode,
  type MissionCode,
  type MissionEvaluationContext,
  type MissionTimelineEvent,
} from "@/domain/missions/evaluator";
import { buildMissionStaticData } from "@/domain/missions/static-data";
import {
  missionMillisecondsToSeconds,
  missionSecondsToMilliseconds,
  replayMissionItemEvents,
  selectMissionParticipantFrameAtOrBefore,
} from "@/domain/missions/timeline";

type NewMissionCode = Exclude<MissionCode, ImplementedMissionCode>;
type FixtureMode = "success" | "boundary" | "failure";

const targets: Record<NewMissionCode, number | string> = {
  M056: 300,
  M057: 3,
  M058: 900,
  M059: 50,
  M060: 100,
  M061: 150,
  M062: 480,
  M063: 1,
  M064: 1,
  M065: 0,
  M066: 0,
  M067: 0,
  M068: 3,
  M069: 4,
  M070: 500,
  M071: "TOP",
  M072: "JUNGLE",
  M073: "MIDDLE",
  M074: "BOTTOM",
  M075: "UTILITY",
  M076: 1,
  M077: 8000,
  M078: 8100,
  M079: 8200,
  M080: 8400,
  M081: 8300,
  M082: "Tank",
  M083: "Fighter",
  M084: "Mage",
  M085: "Marksman",
  M086: 3,
  M087: 5,
  M088: 2,
  M089: 4,
  M090: 3,
  M091: 20,
  M092: 50,
  M093: 600,
  M094: 150,
  M095: 100_000,
  M096: 5,
  M097: 3,
  M098: 10,
  M099: 8,
  M100: 1,
};

const missionStaticData = buildMissionStaticData({
  version: "16.15.1",
  items: [
    {
      id: 2055,
      name: "Control Ward",
      tags: ["Consumable", "Vision"],
      totalGold: 75,
      purchasable: true,
      from: [],
      into: [],
    },
    {
      id: 1054,
      name: "Doran's Shield",
      tags: ["Health", "Lane"],
      totalGold: 450,
      purchasable: true,
      from: [],
      into: [],
    },
    {
      id: 3865,
      name: "World Atlas",
      tags: ["Vision", "GoldPer", "Lane"],
      totalGold: 400,
      purchasable: true,
      from: [],
      into: [],
    },
    {
      id: 2003,
      name: "Health Potion",
      tags: ["Consumable", "HealthRegen"],
      totalGold: 50,
      purchasable: true,
      from: [],
      into: [],
    },
    {
      id: 1001,
      name: "Boots",
      tags: ["Boots"],
      totalGold: 300,
      purchasable: true,
      from: [],
      into: [3006],
    },
    {
      id: 3340,
      name: "Stealth Ward",
      tags: ["Trinket", "Vision"],
      totalGold: 0,
      purchasable: true,
      from: [],
      into: [],
    },
    {
      id: 3078,
      name: "Trinity Force",
      tags: ["Damage"],
      totalGold: 3_333,
      purchasable: true,
      from: [3057],
      into: [],
    },
    {
      id: 3089,
      name: "Rabadon's Deathcap",
      tags: ["SpellDamage"],
      totalGold: 3_600,
      purchasable: true,
      from: [1058],
      into: [],
    },
    {
      id: 3153,
      name: "Blade of the Ruined King",
      tags: ["Damage"],
      totalGold: 3_200,
      purchasable: true,
      from: [3144],
      into: [],
    },
    {
      id: 6672,
      name: "Kraken Slayer",
      tags: ["Damage"],
      totalGold: 3_100,
      purchasable: true,
      from: [6670],
      into: [],
    },
    {
      id: 9000,
      name: "Boundary Item",
      tags: ["Lane"],
      totalGold: 500,
      purchasable: true,
      from: [],
      into: [9002],
    },
    {
      id: 9001,
      name: "Over Item",
      tags: ["Lane"],
      totalGold: 501,
      purchasable: true,
      from: [],
      into: [9002],
    },
  ],
  champions: [
    { id: 1, tags: ["Tank"] },
    { id: 2, tags: ["Fighter"] },
    { id: 3, tags: ["Mage"] },
    { id: 4, tags: ["Marksman"] },
  ],
});

function event(
  type: string,
  timestampMs: number,
  overrides: Partial<MissionTimelineEvent> = {},
): MissionTimelineEvent {
  return {
    type,
    timestampMs,
    participantId: 1,
    creatorId: null,
    killerId: null,
    victimId: null,
    assistingParticipantIds: [],
    itemId: null,
    beforeId: null,
    afterId: null,
    monsterType: null,
    monsterSubType: null,
    ...overrides,
  };
}

function baseContext(): MissionEvaluationContext {
  return {
    match: {
      eligible: true,
      queueId: 420,
      requiredQueueId: 420,
      durationSeconds: 2_100,
      minimumDurationSeconds: 600,
      startedAt: new Date("2026-08-05T03:00:00.000Z"),
    },
    participant: {
      participantId: 1,
      teamId: 100,
      position: "MIDDLE",
      primaryPosition: "TOP",
      championId: 3,
      itemIds: [3078, 3089, 3153, 6672],
      primaryRuneStyleId: 8200,
      summonerSpellIds: [14, 12],
      win: true,
      kills: 20,
      deaths: 0,
      assists: 50,
      totalMinionsKilled: 600,
      neutralMinionsKilled: 0,
      goldEarned: 15_000,
      damageToChampions: 100_000,
      damageTaken: 10_000,
      damageMitigated: 10_000,
      damageToObjectives: 10_000,
      damageToTurrets: 5_000,
      visionScore: 150,
      wardsKilled: 5,
      controlWardsBought: 10,
      timeCCingOthers: 30,
      healOnTeammates: 0,
      shieldOnTeammates: 0,
      championLevel: 18,
      doubleKills: 1,
      tripleKills: 1,
      quadraKills: 1,
      pentaKills: 1,
      largestKillingSpree: 5,
      firstBloodKill: false,
      firstBloodAssist: true,
      firstTowerKill: false,
      firstTowerAssist: true,
      turretKills: 1,
      turretAssists: 2,
      inhibitorKills: 0,
      inhibitorAssists: 1,
      inhibitorTakedowns: 1,
      challenges: {
        soloKills: 3,
        turretTakedowns: 3,
        inhibitorTakedowns: 1,
        objectivesStolen: 1,
        longestTimeSpentLiving: 900,
      },
    },
    team: { teamId: 100, championKills: 20, dragonKills: 8, baronKills: 1 },
    timeline: { status: "AVAILABLE", events: [], frames: [] },
    staticData: missionStaticData,
    internal: { mvpAceAward: "MVP" },
    assignment: { activeFrom: new Date("2026-08-05T02:59:59.000Z") },
    aggregate: { currentProgress: 0 },
    evaluatorVersion: "v1",
  };
}

function itemPurchase(itemId: number, timestampMs: number) {
  return event("ITEM_PURCHASED", timestampMs, { itemId });
}

function config(code: NewMissionCode) {
  const target = targets[code];
  const minute =
    code === "M059" ? 10 : code === "M060" ? 15 : code === "M061" ? 20 : null;
  return { target: String(target), ...(minute === null ? {} : { minute }) };
}

function fixture(code: NewMissionCode, mode: FixtureMode) {
  const context = baseContext();
  const target = targets[code];
  const numeric = typeof target === "number" ? target : 1;
  const before = (seconds: number) =>
    mode === "failure"
      ? missionSecondsToMilliseconds(seconds)
      : missionSecondsToMilliseconds(seconds) - 1;

  if (code === "M056") {
    context.timeline.events = [
      event("CHAMPION_KILL", before(300), { killerId: 1 }),
    ];
  } else if (code === "M057") {
    const count = mode === "success" ? 4 : mode === "boundary" ? 3 : 2;
    context.timeline.events = Array.from({ length: count }, (_, index) =>
      event("CHAMPION_KILL", 100_000 + index, { killerId: 1 }),
    );
  } else if (code === "M058") {
    context.timeline.events =
      mode === "success"
        ? []
        : [
            event("CHAMPION_KILL", mode === "boundary" ? 900_000 : 899_999, {
              victimId: 1,
            }),
          ];
  } else if (code === "M059" || code === "M060" || code === "M061") {
    const minute = code === "M059" ? 10 : code === "M060" ? 15 : 20;
    const cs =
      mode === "success"
        ? numeric + 1
        : mode === "boundary"
          ? numeric
          : numeric - 1;
    context.timeline.frames = [
      {
        timestampMs: minute * 60_000,
        participantFrames: {
          "1": {
            participantId: 1,
            timestampMs: minute * 60_000,
            minionsKilled: cs,
            jungleMinionsKilled: 0,
          },
        },
      },
    ];
  } else if (code === "M062") {
    context.timeline.events = [itemPurchase(2055, before(480))];
  } else if (code === "M063") {
    context.timeline.events = [itemPurchase(1054, before(120))];
  } else if (code === "M064") {
    context.timeline.events = [itemPurchase(3865, before(120))];
  } else if (code === "M065") {
    context.timeline.events =
      mode === "success"
        ? []
        : mode === "boundary"
          ? [
              itemPurchase(2003, 1_000),
              event("ITEM_UNDO", 1_100, { beforeId: 2003, afterId: 0 }),
            ]
          : [itemPurchase(2003, 1_000)];
  } else if (code === "M066") {
    context.participant.summonerSpellIds =
      mode === "failure" ? [4, 14] : [14, 12];
  } else if (code === "M067") {
    context.participant.itemIds = [];
    context.timeline.events =
      mode === "success"
        ? []
        : mode === "boundary"
          ? [
              itemPurchase(1001, 1_000),
              event("ITEM_UNDO", 1_100, { beforeId: 1001, afterId: 0 }),
            ]
          : [itemPurchase(1001, 1_000)];
  } else if (code === "M068" || code === "M069") {
    const completedIds = [3078, 3089, 3153, 6672];
    const count =
      mode === "success"
        ? numeric + 1
        : mode === "boundary"
          ? numeric
          : numeric - 1;
    context.participant.itemIds = completedIds.slice(
      0,
      Math.min(count, completedIds.length),
    );
  } else if (code === "M070") {
    context.timeline.events = [
      itemPurchase(mode === "failure" ? 9001 : 9000, 1_000),
      itemPurchase(3340, 1_100),
    ];
  } else if (code >= "M071" && code <= "M075") {
    context.participant.position =
      mode === "failure"
        ? "MIDDLE"
        : (target as NonNullable<
            MissionEvaluationContext["participant"]["position"]
          >);
    if (mode === "failure" && target === "MIDDLE")
      context.participant.position = "TOP";
  } else if (code === "M076") {
    context.participant.position = mode === "failure" ? "TOP" : "MIDDLE";
  } else if (code >= "M077" && code <= "M081") {
    context.participant.primaryRuneStyleId =
      mode === "failure" ? 9999 : numeric;
  } else if (code >= "M082" && code <= "M085") {
    const championByTag: Record<string, number> = {
      Tank: 1,
      Fighter: 2,
      Mage: 3,
      Marksman: 4,
    };
    context.participant.championId =
      mode === "failure" ? 3 : (championByTag[String(target)] ?? 3);
    if (mode === "failure" && target === "Mage")
      context.participant.championId = 4;
  } else if (code === "M086" || code === "M087" || code === "M096") {
    if (mode === "failure") context.match.eligible = false;
  } else if (code === "M088" || code === "M089") {
    context.participant.win = mode !== "failure";
  } else if (code === "M090") {
    context.aggregate.currentProgress = numeric - 1;
    context.participant.win = mode !== "failure";
  } else if (code === "M091") {
    context.participant.kills = mode === "failure" ? 0 : numeric;
  } else if (code === "M092") {
    context.participant.assists = mode === "failure" ? 0 : numeric;
  } else if (code === "M093") {
    context.participant.totalMinionsKilled = mode === "failure" ? 0 : numeric;
    context.participant.neutralMinionsKilled = 0;
  } else if (code === "M094") {
    context.participant.visionScore = mode === "failure" ? 0 : numeric;
  } else if (code === "M095") {
    context.participant.damageToChampions = mode === "failure" ? 0 : numeric;
  } else if (code === "M097") {
    context.participant.position = mode === "failure" ? null : "MIDDLE";
  } else if (code === "M098") {
    context.participant.controlWardsBought = mode === "failure" ? 0 : numeric;
  } else if (code === "M099") {
    context.team = {
      ...context.team!,
      dragonKills: mode === "failure" ? 0 : numeric,
    };
  } else if (code === "M100") {
    context.internal.mvpAceAward =
      mode === "failure"
        ? "DEMO_EXCLUDED"
        : mode === "boundary"
          ? "ACE"
          : "MVP";
  }
  return context;
}

function evaluate(code: NewMissionCode, mode: FixtureMode) {
  const evaluator = missionEvaluatorRegistry.getByCode(code);
  if (!evaluator) throw new Error(`Missing evaluator for ${code}`);
  return evaluator.evaluate(fixture(code, mode), config(code));
}

const newCodes = Object.keys(targets) as NewMissionCode[];

describe("M056-M100 mission evaluator catalog", () => {
  for (const code of newCodes) {
    it(`${code} accepts its success fixture`, () => {
      expect(evaluate(code, "success").status).toBe("PASS");
    });

    it(`${code} handles the exact boundary`, () => {
      expect(evaluate(code, "boundary").status).toBe("PASS");
    });

    it(`${code} rejects or safely defers its failure fixture`, () => {
      expect(evaluate(code, "failure").status).not.toBe("PASS");
    });
  }

  it("registers all 100 catalog codes and evaluator mappings", () => {
    expect(missionEvaluatorRegistry.codes()).toHaveLength(100);
    expect(Object.keys(MISSION_EVALUATOR_KEYS_M001_M100)).toHaveLength(100);
    for (const [code, key] of Object.entries(
      MISSION_EVALUATOR_KEYS_M001_M100,
    )) {
      expect(missionEvaluatorRegistry.get(key), code).not.toBeNull();
    }
  });
});

describe("timeline conversion, frames, and item replay", () => {
  it("converts milliseconds and seconds in the shared boundary", () => {
    expect(missionMillisecondsToSeconds(900_000)).toBe(900);
    expect(missionSecondsToMilliseconds(900)).toBe(900_000);
  });

  it("uses the exact frame or the closest safe earlier participant frame", () => {
    const selected = selectMissionParticipantFrameAtOrBefore({
      participantId: 1,
      targetSeconds: 600,
      frames: [
        {
          timestampMs: 590_000,
          participantFrames: {
            "1": {
              participantId: 1,
              timestampMs: 590_000,
              minionsKilled: 49,
              jungleMinionsKilled: 0,
            },
          },
        },
        {
          timestampMs: 610_000,
          participantFrames: {
            "1": {
              participantId: 1,
              timestampMs: 610_000,
              minionsKilled: 51,
              jungleMinionsKilled: 0,
            },
          },
        },
      ],
    });
    expect(selected).toMatchObject({
      selectedTimestampMs: 590_000,
      exact: false,
    });
  });

  it("replays purchase, sale, and undo without counting an undone purchase", () => {
    const replay = replayMissionItemEvents({
      participantId: 1,
      events: [
        itemPurchase(2003, 1_000),
        event("ITEM_SOLD", 2_000, { itemId: 2003 }),
        event("ITEM_UNDO", 3_000, { beforeId: 0, afterId: 2003 }),
        event("ITEM_UNDO", 4_000, { beforeId: 2003, afterId: 0 }),
      ],
    });
    expect(replay.inventory.size).toBe(0);
    expect(replay.effectivePurchases.size).toBe(0);
  });

  it("keeps timeline-dependent missions pending when timeline data is absent", () => {
    const context = fixture("M056", "success");
    context.timeline = { status: "MISSING", events: [], frames: [] };
    expect(
      missionEvaluatorRegistry
        .getByCode("M056")
        ?.evaluate(context, config("M056")),
    ).toMatchObject({ status: "PENDING_DATA" });
  });
});
