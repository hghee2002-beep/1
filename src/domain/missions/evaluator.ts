import type { MissionStaticData } from "@/domain/missions/static-data";
import {
  isMissionEventBeforeSeconds,
  MISSION_START_PURCHASE_CUTOFF_SECONDS,
  replayMissionItemEvents,
  selectMissionParticipantFrameAtOrBefore,
  type MissionTimelineEvent,
  type MissionTimelineFrame,
} from "@/domain/missions/timeline";

export type {
  MissionParticipantFrame,
  MissionTimelineEvent,
  MissionTimelineFrame,
} from "@/domain/missions/timeline";

export type MissionEvaluationStatus =
  "PASS" | "FAIL" | "PENDING_DATA" | "NOT_APPLICABLE";

export type MissionProgressMode = "MAX" | "ADD" | "SET" | "DISTINCT";

export type MissionEvidenceValue = string | number | boolean | null;

export type MissionEvaluation = {
  status: MissionEvaluationStatus;
  currentValue: number;
  targetValue: number;
  progressValue: number;
  progressMode: MissionProgressMode;
  progressKey?: string;
  completionReached?: boolean;
  completionParticipantMatchId?: string;
  unit: string;
  reason: string;
  evidence: Readonly<Record<string, MissionEvidenceValue>>;
  evaluatorVersion: string;
};

export type MissionEvaluationContext = {
  match: {
    eligible: boolean;
    queueId: number | null;
    requiredQueueId: number;
    durationSeconds: number | null;
    minimumDurationSeconds: number;
    startedAt: Date;
  };
  participant: {
    participantId: number;
    teamId: number;
    position: "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | null;
    primaryPosition: "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | null;
    championId: number;
    itemIds: readonly number[];
    primaryRuneStyleId: number | null;
    summonerSpellIds: readonly number[];
    win: boolean;
    kills: number | null;
    deaths: number | null;
    assists: number | null;
    totalMinionsKilled: number | null;
    neutralMinionsKilled: number | null;
    goldEarned: number | null;
    damageToChampions: number | null;
    damageTaken: number | null;
    damageMitigated: number | null;
    damageToObjectives: number | null;
    damageToTurrets: number | null;
    visionScore: number | null;
    wardsKilled: number | null;
    controlWardsBought: number | null;
    timeCCingOthers: number | null;
    healOnTeammates: number | null;
    shieldOnTeammates: number | null;
    championLevel: number | null;
    doubleKills: number | null;
    tripleKills: number | null;
    quadraKills: number | null;
    pentaKills: number | null;
    largestKillingSpree: number | null;
    firstBloodKill: boolean | null;
    firstBloodAssist: boolean | null;
    firstTowerKill: boolean | null;
    firstTowerAssist: boolean | null;
    turretKills: number | null;
    turretAssists: number | null;
    inhibitorKills: number | null;
    inhibitorAssists: number | null;
    inhibitorTakedowns: number | null;
    challenges: {
      soloKills: number | null;
      turretTakedowns: number | null;
      inhibitorTakedowns: number | null;
      objectivesStolen: number | null;
      longestTimeSpentLiving: number | null;
    };
  };
  team: {
    teamId: number;
    championKills: number | null;
    dragonKills: number | null;
    baronKills: number | null;
  } | null;
  timeline: {
    status: "AVAILABLE" | "MISSING" | "NOT_REQUESTED";
    events: readonly MissionTimelineEvent[];
    frames: readonly MissionTimelineFrame[];
  };
  staticData: MissionStaticData;
  internal: {
    mvpAceAward: "PENDING" | "NONE" | "MVP" | "ACE" | "DEMO_EXCLUDED";
  };
  assignment: {
    activeFrom: Date;
  };
  aggregate: {
    currentProgress: number;
    winStreak?: {
      current: number;
      maximum: number;
      completionParticipantMatchId: string | null;
    };
  };
  evaluatorVersion: string;
};

export interface MissionEvaluator {
  readonly key: string;
  readonly version: string;
  readonly source: "SUMMARY" | "TIMELINE" | "AGGREGATE" | "STATIC_SUMMARY";
  readonly unit: string;
  evaluate(
    context: MissionEvaluationContext,
    config: unknown,
  ): MissionEvaluation;
}

type JsonRecord = Record<string, unknown>;
type EvaluationBody = (
  context: MissionEvaluationContext,
  target: number,
  unit: string,
) => MissionEvaluation;

const EVALUATOR_VERSION = "v1";

function numericTarget(config: unknown) {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return null;
  }
  const target = (config as JsonRecord).target;
  const numeric = typeof target === "number" ? target : Number(target);
  return Number.isFinite(numeric) ? numeric : null;
}

function stringTarget(config: unknown) {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return null;
  }
  const target = (config as JsonRecord).target;
  return typeof target === "string" && target.trim() ? target.trim() : null;
}

function result(input: {
  context: MissionEvaluationContext;
  status: MissionEvaluationStatus;
  currentValue: number;
  targetValue: number;
  progressValue: number;
  unit: string;
  reason: string;
  evidence?: Readonly<Record<string, MissionEvidenceValue>>;
  progressMode?: MissionProgressMode;
  progressKey?: string;
  completionReached?: boolean;
  completionParticipantMatchId?: string;
}): MissionEvaluation {
  return {
    status: input.status,
    currentValue: input.currentValue,
    targetValue: input.targetValue,
    progressValue: Math.max(0, input.progressValue),
    progressMode: input.progressMode ?? "MAX",
    ...(input.progressKey === undefined
      ? {}
      : { progressKey: input.progressKey }),
    ...(input.completionReached === undefined
      ? {}
      : { completionReached: input.completionReached }),
    ...(input.completionParticipantMatchId === undefined
      ? {}
      : {
          completionParticipantMatchId: input.completionParticipantMatchId,
        }),
    unit: input.unit,
    reason: input.reason,
    evidence: input.evidence ?? {},
    evaluatorVersion: input.context.evaluatorVersion,
  };
}

function pending(
  context: MissionEvaluationContext,
  target: number,
  unit: string,
  reason: string,
  evidence: Readonly<Record<string, MissionEvidenceValue>> = {},
) {
  return result({
    context,
    status: "PENDING_DATA",
    currentValue: 0,
    targetValue: target,
    progressValue: 0,
    unit,
    reason,
    evidence,
  });
}

function notApplicable(
  context: MissionEvaluationContext,
  target: number,
  unit: string,
  reason: string,
  evidence: Readonly<Record<string, MissionEvidenceValue>> = {},
) {
  return result({
    context,
    status: "NOT_APPLICABLE",
    currentValue: 0,
    targetValue: target,
    progressValue: 0,
    unit,
    reason,
    evidence,
  });
}

function commonGate(
  context: MissionEvaluationContext,
  target: number,
  unit: string,
) {
  if (!context.match.eligible) {
    return notApplicable(context, target, unit, "MATCH_NOT_ELIGIBLE");
  }
  if (context.match.queueId === null) {
    return pending(context, target, unit, "MISSING_MATCH_FIELD", {
      field: "queueId",
    });
  }
  if (context.match.queueId !== context.match.requiredQueueId) {
    return notApplicable(context, target, unit, "UNSUPPORTED_QUEUE", {
      queueId: context.match.queueId,
      requiredQueueId: context.match.requiredQueueId,
    });
  }
  if (context.match.durationSeconds === null) {
    return pending(context, target, unit, "MISSING_MATCH_FIELD", {
      field: "durationSeconds",
    });
  }
  if (context.match.durationSeconds < context.match.minimumDurationSeconds) {
    return notApplicable(context, target, unit, "MATCH_TOO_SHORT", {
      durationSeconds: context.match.durationSeconds,
      minimumDurationSeconds: context.match.minimumDurationSeconds,
    });
  }
  if (
    context.match.startedAt.getTime() < context.assignment.activeFrom.getTime()
  ) {
    return notApplicable(
      context,
      target,
      unit,
      "ASSIGNMENT_NOT_ACTIVE_AT_START",
      {
        matchStartedAt: context.match.startedAt.toISOString(),
        assignmentActiveFrom: context.assignment.activeFrom.toISOString(),
      },
    );
  }
  return null;
}

function configuredEvaluator(input: {
  key: string;
  source: MissionEvaluator["source"];
  unit: string;
  body: EvaluationBody;
}): MissionEvaluator {
  return {
    key: input.key,
    version: EVALUATOR_VERSION,
    source: input.source,
    unit: input.unit,
    evaluate(context, config) {
      const target = numericTarget(config);
      if (target === null) {
        return pending(context, 0, input.unit, "INVALID_EVALUATOR_CONFIG", {
          configField: "target",
        });
      }
      const gated = commonGate(context, target, input.unit);
      return gated ?? input.body(context, target, input.unit);
    },
  };
}

function configuredStringEvaluator(input: {
  key: string;
  source: MissionEvaluator["source"];
  unit: string;
  body: (
    context: MissionEvaluationContext,
    target: string,
    unit: string,
  ) => MissionEvaluation;
}): MissionEvaluator {
  return {
    key: input.key,
    version: EVALUATOR_VERSION,
    source: input.source,
    unit: input.unit,
    evaluate(context, config) {
      const target = stringTarget(config);
      if (target === null) {
        return pending(context, 0, input.unit, "INVALID_EVALUATOR_CONFIG", {
          configField: "target",
        });
      }
      const gated = commonGate(context, 1, input.unit);
      return gated ?? input.body(context, target, input.unit);
    },
  };
}

function numberField(
  context: MissionEvaluationContext,
  target: number,
  unit: string,
  field: keyof Omit<MissionEvaluationContext["participant"], "challenges">,
) {
  const value = context.participant[field];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : pending(context, target, unit, "MISSING_PARTICIPANT_FIELD", { field });
}

function thresholdResult(input: {
  context: MissionEvaluationContext;
  currentValue: number;
  targetValue: number;
  unit: string;
  pass: boolean;
  evidence?: Readonly<Record<string, MissionEvidenceValue>>;
  progressValue?: number;
  progressMode?: MissionProgressMode;
  progressKey?: string;
}) {
  return result({
    context: input.context,
    status: input.pass ? "PASS" : "FAIL",
    currentValue: input.currentValue,
    targetValue: input.targetValue,
    progressValue:
      input.progressValue ??
      Math.min(input.targetValue, Math.max(0, input.currentValue)),
    unit: input.unit,
    reason: input.pass ? "TARGET_MET" : "TARGET_NOT_MET",
    ...(input.evidence ? { evidence: input.evidence } : {}),
    ...(input.progressMode ? { progressMode: input.progressMode } : {}),
    ...(input.progressKey ? { progressKey: input.progressKey } : {}),
  });
}

function participantAtLeast(
  key: string,
  field: keyof Omit<MissionEvaluationContext["participant"], "challenges">,
  unit = "count",
) {
  return configuredEvaluator({
    key,
    source: "SUMMARY",
    unit,
    body(context, target, evaluatorUnit) {
      const value = numberField(context, target, evaluatorUnit, field);
      if (typeof value !== "number") return value;
      return thresholdResult({
        context,
        currentValue: value,
        targetValue: target,
        unit: evaluatorUnit,
        pass: value >= target,
        evidence: { field, value },
      });
    },
  });
}

function teamOrPending(
  context: MissionEvaluationContext,
  target: number,
  unit: string,
) {
  if (!context.team || context.team.teamId !== context.participant.teamId) {
    return pending(context, target, unit, "PARTICIPANT_TEAM_NOT_FOUND", {
      participantTeamId: context.participant.teamId,
    });
  }
  return context.team;
}

function timelineObjectiveEvaluator(input: {
  key: string;
  monsterType: "DRAGON" | "BARON_NASHOR" | "RIFTHERALD";
}) {
  return configuredEvaluator({
    key: input.key,
    source: "TIMELINE",
    unit: "takedown",
    body(context, target, unit) {
      if (context.timeline.status !== "AVAILABLE") {
        return pending(context, target, unit, "TIMELINE_NOT_AVAILABLE", {
          timelineStatus: context.timeline.status,
        });
      }
      const participantId = context.participant.participantId;
      const matching = context.timeline.events.filter((event) => {
        if (event.type !== "ELITE_MONSTER_KILL") return false;
        const monster = event.monsterType ?? event.monsterSubType;
        if (monster !== input.monsterType) return false;
        return (
          event.killerId === participantId ||
          event.assistingParticipantIds.includes(participantId)
        );
      });
      return thresholdResult({
        context,
        currentValue: matching.length,
        targetValue: target,
        unit,
        pass: matching.length >= target,
        evidence: {
          source: "MATCH_TIMELINE",
          monsterType: input.monsterType,
          participantId,
          matchedEvents: matching.length,
          timestampUnit: "milliseconds",
        },
      });
    },
  });
}

const matchWin = configuredEvaluator({
  key: "match.win",
  source: "SUMMARY",
  unit: "win",
  body(context, target, unit) {
    return thresholdResult({
      context,
      currentValue: context.participant.win ? 1 : 0,
      targetValue: target,
      unit,
      pass: context.participant.win,
      evidence: { win: context.participant.win },
    });
  },
});

const kdaAtLeast = configuredEvaluator({
  key: "combat.kdaAtLeast",
  source: "SUMMARY",
  unit: "kda",
  body(context, target, unit) {
    const kills = numberField(context, target, unit, "kills");
    const deaths = numberField(context, target, unit, "deaths");
    const assists = numberField(context, target, unit, "assists");
    if (typeof kills !== "number") return kills;
    if (typeof deaths !== "number") return deaths;
    if (typeof assists !== "number") return assists;
    const kda = (kills + assists) / Math.max(1, deaths);
    return thresholdResult({
      context,
      currentValue: kda,
      targetValue: target,
      unit,
      pass: kda >= target,
      evidence: { kills, deaths, assists, denominator: Math.max(1, deaths) },
    });
  },
});

const winWithDeathsAtMost = configuredEvaluator({
  key: "combat.winWithDeathsAtMost",
  source: "SUMMARY",
  unit: "death",
  body(context, target, unit) {
    const deaths = numberField(context, target, unit, "deaths");
    if (typeof deaths !== "number") return deaths;
    const pass = context.participant.win && deaths <= target;
    return thresholdResult({
      context,
      currentValue: deaths,
      targetValue: target,
      unit,
      pass,
      progressValue: pass ? target : 0,
      evidence: { deaths, win: context.participant.win, comparison: "lte" },
    });
  },
});

const killParticipationAtLeast = configuredEvaluator({
  key: "combat.killParticipationAtLeast",
  source: "SUMMARY",
  unit: "ratio",
  body(context, target, unit) {
    const team = teamOrPending(context, target, unit);
    if ("status" in team) return team;
    const kills = numberField(context, target, unit, "kills");
    const assists = numberField(context, target, unit, "assists");
    if (typeof kills !== "number") return kills;
    if (typeof assists !== "number") return assists;
    if (team.championKills === null) {
      return pending(context, target, unit, "MISSING_TEAM_FIELD", {
        field: "championKills",
        teamId: team.teamId,
      });
    }
    const participation =
      team.championKills === 0 ? 0 : (kills + assists) / team.championKills;
    return thresholdResult({
      context,
      currentValue: participation,
      targetValue: target,
      unit,
      pass: team.championKills > 0 && participation >= target,
      evidence: {
        kills,
        assists,
        teamKills: team.championKills,
        zeroTeamKillsRule: team.championKills === 0 ? "FAIL" : "NOT_USED",
      },
    });
  },
});

function perMinuteEvaluator(input: {
  key: string;
  field: "damageToChampions" | "goldEarned";
  unit: string;
}) {
  return configuredEvaluator({
    key: input.key,
    source: "SUMMARY",
    unit: input.unit,
    body(context, target, unit) {
      const value = numberField(context, target, unit, input.field);
      if (typeof value !== "number") return value;
      const durationSeconds = context.match.durationSeconds;
      if (durationSeconds === null || durationSeconds <= 0) {
        return pending(context, target, unit, "INVALID_GAME_DURATION", {
          durationSeconds,
        });
      }
      const perMinute = value / (durationSeconds / 60);
      return thresholdResult({
        context,
        currentValue: perMinute,
        targetValue: target,
        unit,
        pass: perMinute >= target,
        evidence: {
          numerator: value,
          durationSeconds,
          durationUnit: "seconds",
        },
      });
    },
  });
}

const allyHealShieldAtLeast = configuredEvaluator({
  key: "support.allyHealShieldAtLeast",
  source: "SUMMARY",
  unit: "shield_heal",
  body(context, target, unit) {
    const heal = numberField(context, target, unit, "healOnTeammates");
    const shield = numberField(context, target, unit, "shieldOnTeammates");
    if (typeof heal !== "number") return heal;
    if (typeof shield !== "number") return shield;
    const combined = heal + shield;
    return thresholdResult({
      context,
      currentValue: combined,
      targetValue: target,
      unit,
      pass: combined >= target,
      evidence: { healOnTeammates: heal, shieldOnTeammates: shield },
    });
  },
});

const csAtLeast = configuredEvaluator({
  key: "growth.csAtLeast",
  source: "SUMMARY",
  unit: "cs",
  body(context, target, unit) {
    const lane = numberField(context, target, unit, "totalMinionsKilled");
    const neutral = numberField(context, target, unit, "neutralMinionsKilled");
    if (typeof lane !== "number") return lane;
    if (typeof neutral !== "number") return neutral;
    const cs = lane + neutral;
    return thresholdResult({
      context,
      currentValue: cs,
      targetValue: target,
      unit,
      pass: cs >= target,
      evidence: { laneMinions: lane, neutralMinions: neutral },
    });
  },
});

const csPerMinuteAtLeast = configuredEvaluator({
  key: "growth.csPerMinuteAtLeast",
  source: "SUMMARY",
  unit: "cs_per_minute",
  body(context, target, unit) {
    const lane = numberField(context, target, unit, "totalMinionsKilled");
    const neutral = numberField(context, target, unit, "neutralMinionsKilled");
    if (typeof lane !== "number") return lane;
    if (typeof neutral !== "number") return neutral;
    const durationSeconds = context.match.durationSeconds;
    if (durationSeconds === null || durationSeconds <= 0) {
      return pending(context, target, unit, "INVALID_GAME_DURATION", {
        durationSeconds,
      });
    }
    const cs = lane + neutral;
    const perMinute = cs / (durationSeconds / 60);
    return thresholdResult({
      context,
      currentValue: perMinute,
      targetValue: target,
      unit,
      pass: perMinute >= target,
      evidence: {
        cs,
        laneMinions: lane,
        neutralMinions: neutral,
        durationSeconds,
        durationUnit: "seconds",
      },
    });
  },
});

const longestLifeAtLeast = configuredEvaluator({
  key: "combat.longestLifeAtLeast",
  source: "SUMMARY",
  unit: "second",
  body(context, target, unit) {
    const value = context.participant.challenges.longestTimeSpentLiving;
    if (value === null) {
      return pending(context, target, unit, "MISSING_CHALLENGES_FIELD", {
        field: "longestTimeSpentLiving",
      });
    }
    return thresholdResult({
      context,
      currentValue: value,
      targetValue: target,
      unit,
      pass: value >= target,
      evidence: { source: "challenges", longestTimeSpentLiving: value },
    });
  },
});

const soloKillsAtLeast = configuredEvaluator({
  key: "combat.soloKillsAtLeast",
  source: "SUMMARY",
  unit: "kill",
  body(context, target, unit) {
    const value = context.participant.challenges.soloKills;
    if (value === null) {
      return pending(context, target, unit, "MISSING_CHALLENGES_FIELD", {
        field: "soloKills",
      });
    }
    return thresholdResult({
      context,
      currentValue: value,
      targetValue: target,
      unit,
      pass: value >= target,
      evidence: { source: "challenges", soloKills: value },
    });
  },
});

function booleanParticipationEvaluator(input: {
  key: string;
  killField: "firstBloodKill" | "firstTowerKill";
  assistField: "firstBloodAssist" | "firstTowerAssist";
}) {
  return configuredEvaluator({
    key: input.key,
    source: "SUMMARY",
    unit: "participation",
    body(context, target, unit) {
      const kill = context.participant[input.killField];
      const assist = context.participant[input.assistField];
      if (kill === null || assist === null) {
        return pending(context, target, unit, "MISSING_PARTICIPANT_FIELD", {
          field: kill === null ? input.killField : input.assistField,
        });
      }
      const participated = kill || assist;
      return thresholdResult({
        context,
        currentValue: participated ? 1 : 0,
        targetValue: target,
        unit,
        pass: participated,
        evidence: {
          kill,
          assist,
          participationRule: "kill_or_assist",
        },
      });
    },
  });
}

const turretTakedownsAtLeast = configuredEvaluator({
  key: "objective.turretTakedownsAtLeast",
  source: "SUMMARY",
  unit: "takedown",
  body(context, target, unit) {
    const challengeValue = context.participant.challenges.turretTakedowns;
    const fallbackAvailable =
      context.participant.turretKills !== null &&
      context.participant.turretAssists !== null;
    if (challengeValue === null && !fallbackAvailable) {
      return pending(context, target, unit, "MISSING_TURRET_TAKEDOWN_DATA", {
        preferredField: "challenges.turretTakedowns",
        fallbackFields: "turretKills+turretAssists",
      });
    }
    const value =
      challengeValue ??
      (context.participant.turretKills ?? 0) +
        (context.participant.turretAssists ?? 0);
    const source =
      challengeValue === null ? "kill_assist_fallback" : "challenges";
    return thresholdResult({
      context,
      currentValue: value,
      targetValue: target,
      unit,
      pass: value >= target,
      evidence: { source, turretTakedowns: value },
    });
  },
});

const inhibitorTakedownsAtLeast = configuredEvaluator({
  key: "objective.inhibitorTakedownsAtLeast",
  source: "SUMMARY",
  unit: "takedown",
  body(context, target, unit) {
    const challengeValue = context.participant.challenges.inhibitorTakedowns;
    const normalizedValue = context.participant.inhibitorTakedowns;
    const fallbackAvailable =
      context.participant.inhibitorKills !== null &&
      context.participant.inhibitorAssists !== null;
    if (
      challengeValue === null &&
      normalizedValue === null &&
      !fallbackAvailable
    ) {
      return pending(context, target, unit, "MISSING_INHIBITOR_TAKEDOWN_DATA");
    }
    const value =
      challengeValue ??
      normalizedValue ??
      (context.participant.inhibitorKills ?? 0) +
        (context.participant.inhibitorAssists ?? 0);
    const source =
      challengeValue !== null
        ? "challenges"
        : normalizedValue !== null
          ? "normalized_takedowns"
          : "kill_assist_fallback";
    return thresholdResult({
      context,
      currentValue: value,
      targetValue: target,
      unit,
      pass: value >= target,
      evidence: { source, inhibitorTakedowns: value },
    });
  },
});

const objectivesStolenAtLeast = configuredEvaluator({
  key: "objective.stealsAtLeast",
  source: "SUMMARY",
  unit: "steal",
  body(context, target, unit) {
    const value = context.participant.challenges.objectivesStolen;
    if (value === null) {
      return pending(context, target, unit, "MISSING_CHALLENGES_FIELD", {
        field: "objectivesStolen",
      });
    }
    return thresholdResult({
      context,
      currentValue: value,
      targetValue: target,
      unit,
      pass: value >= target,
      evidence: { source: "normalized_challenge", objectivesStolen: value },
    });
  },
});

const teamDragonsAtLeast = configuredEvaluator({
  key: "objective.teamDragonsAtLeast",
  source: "SUMMARY",
  unit: "dragon",
  body(context, target, unit) {
    const team = teamOrPending(context, target, unit);
    if ("status" in team) return team;
    if (team.dragonKills === null) {
      return pending(context, target, unit, "MISSING_TEAM_FIELD", {
        field: "dragonKills",
        teamId: team.teamId,
      });
    }
    return thresholdResult({
      context,
      currentValue: team.dragonKills,
      targetValue: target,
      unit,
      pass: team.dragonKills >= target,
      evidence: { teamId: team.teamId, dragonKills: team.dragonKills },
    });
  },
});

const winWithTeamBaron = configuredEvaluator({
  key: "objective.winWithTeamBaron",
  source: "SUMMARY",
  unit: "completion",
  body(context, target, unit) {
    const team = teamOrPending(context, target, unit);
    if ("status" in team) return team;
    if (team.baronKills === null) {
      return pending(context, target, unit, "MISSING_TEAM_FIELD", {
        field: "baronKills",
        teamId: team.teamId,
      });
    }
    const pass = context.participant.win && team.baronKills >= 1;
    return thresholdResult({
      context,
      currentValue: pass ? 1 : 0,
      targetValue: target,
      unit,
      pass,
      evidence: {
        win: context.participant.win,
        teamId: team.teamId,
        baronKills: team.baronKills,
      },
    });
  },
});

function winDurationEvaluator(input: {
  key: "result.winWithinSeconds" | "result.winAfterSeconds";
  comparison: "lte" | "gte";
}) {
  return configuredEvaluator({
    key: input.key,
    source: "SUMMARY",
    unit: "second",
    body(context, target, unit) {
      const duration = context.match.durationSeconds;
      if (duration === null) {
        return pending(context, target, unit, "MISSING_MATCH_FIELD", {
          field: "durationSeconds",
        });
      }
      const durationMet =
        input.comparison === "lte" ? duration <= target : duration >= target;
      const pass = context.participant.win && durationMet;
      return thresholdResult({
        context,
        currentValue: duration,
        targetValue: target,
        unit,
        pass,
        progressValue: pass ? target : 0,
        evidence: {
          win: context.participant.win,
          durationSeconds: duration,
          durationUnit: "seconds",
          comparison: input.comparison,
        },
      });
    },
  });
}

const winWithDragonsAndBaron = configuredEvaluator({
  key: "objective.winWithDragonsAndBaron",
  source: "SUMMARY",
  unit: "completion",
  body(context, target, unit) {
    const team = teamOrPending(context, target, unit);
    if ("status" in team) return team;
    if (team.dragonKills === null || team.baronKills === null) {
      return pending(context, target, unit, "MISSING_TEAM_FIELD", {
        field: team.dragonKills === null ? "dragonKills" : "baronKills",
        teamId: team.teamId,
      });
    }
    const pass =
      context.participant.win && team.dragonKills >= 2 && team.baronKills >= 1;
    return thresholdResult({
      context,
      currentValue: pass ? 1 : 0,
      targetValue: target,
      unit,
      pass,
      evidence: {
        win: context.participant.win,
        teamId: team.teamId,
        dragonKills: team.dragonKills,
        baronKills: team.baronKills,
      },
    });
  },
});

function requireTimeline(
  context: MissionEvaluationContext,
  target: number,
  unit: string,
) {
  return context.timeline.status === "AVAILABLE"
    ? null
    : pending(context, target, unit, "TIMELINE_NOT_AVAILABLE", {
        timelineStatus: context.timeline.status,
      });
}

function requireStaticData(
  context: MissionEvaluationContext,
  target: number,
  unit: string,
) {
  return context.staticData.status === "AVAILABLE"
    ? null
    : pending(context, target, unit, "STATIC_DATA_NOT_AVAILABLE");
}

function killBeforeEvaluator(input: { key: string; fixedSeconds?: number }) {
  return configuredEvaluator({
    key: input.key,
    source: "TIMELINE",
    unit: "kill",
    body(context, target, unit) {
      const unavailable = requireTimeline(context, target, unit);
      if (unavailable) return unavailable;
      const seconds = input.fixedSeconds ?? target;
      const kills = context.timeline.events.filter(
        (event) =>
          event.type === "CHAMPION_KILL" &&
          event.killerId === context.participant.participantId &&
          isMissionEventBeforeSeconds(event.timestampMs, seconds),
      ).length;
      const requiredKills = input.fixedSeconds === undefined ? 1 : target;
      return thresholdResult({
        context,
        currentValue: kills,
        targetValue: requiredKills,
        unit,
        pass: kills >= requiredKills,
        evidence: {
          kills,
          beforeSeconds: seconds,
          comparison: "strictly_before",
          timestampUnit: "milliseconds",
        },
      });
    },
  });
}

const noDeathUntilSeconds = configuredEvaluator({
  key: "timeline.noDeathUntilSeconds",
  source: "TIMELINE",
  unit: "completion",
  body(context, target, unit) {
    const unavailable = requireTimeline(context, target, unit);
    if (unavailable) return unavailable;
    const deaths = context.timeline.events.filter(
      (event) =>
        event.type === "CHAMPION_KILL" &&
        event.victimId === context.participant.participantId &&
        isMissionEventBeforeSeconds(event.timestampMs, target),
    ).length;
    const pass = deaths === 0;
    return thresholdResult({
      context,
      currentValue: pass ? 1 : 0,
      targetValue: 1,
      unit,
      pass,
      evidence: {
        deaths,
        untilSeconds: target,
        comparison: "strictly_before",
      },
    });
  },
});

const csAtMinuteAtLeast: MissionEvaluator = {
  key: "timeline.csAtMinuteAtLeast",
  version: EVALUATOR_VERSION,
  source: "TIMELINE",
  unit: "cs",
  evaluate(context, config) {
    const target = numericTarget(config);
    const record =
      typeof config === "object" && config !== null && !Array.isArray(config)
        ? (config as JsonRecord)
        : null;
    const configuredMinute = record?.minute;
    const minute =
      typeof configuredMinute === "number" &&
      Number.isInteger(configuredMinute) &&
      configuredMinute > 0
        ? configuredMinute
        : target === 50
          ? 10
          : target === 100
            ? 15
            : target === 150
              ? 20
              : null;
    if (target === null || minute === null) {
      return pending(context, target ?? 0, "cs", "INVALID_EVALUATOR_CONFIG", {
        configField: target === null ? "target" : "minute",
      });
    }
    const gated = commonGate(context, target, "cs");
    if (gated) return gated;
    const unavailable = requireTimeline(context, target, "cs");
    if (unavailable) return unavailable;
    if (
      context.match.durationSeconds !== null &&
      context.match.durationSeconds < minute * 60
    ) {
      return thresholdResult({
        context,
        currentValue: 0,
        targetValue: target,
        unit: "cs",
        pass: false,
        evidence: {
          requestedMinute: minute,
          durationSeconds: context.match.durationSeconds,
          frameRule: "target_time_not_reached",
        },
      });
    }
    const selected = selectMissionParticipantFrameAtOrBefore({
      frames: context.timeline.frames,
      participantId: context.participant.participantId,
      targetSeconds: minute * 60,
    });
    if (!selected) {
      return pending(context, target, "cs", "TIMELINE_FRAME_NOT_AVAILABLE", {
        requestedMinute: minute,
      });
    }
    const cs =
      selected.frame.minionsKilled + selected.frame.jungleMinionsKilled;
    return thresholdResult({
      context,
      currentValue: cs,
      targetValue: target,
      unit: "cs",
      pass: cs >= target,
      evidence: {
        requestedMinute: minute,
        requestedTimestampMs: selected.requestedTimestampMs,
        selectedTimestampMs: selected.selectedTimestampMs,
        exactFrame: selected.exact,
        minionsKilled: selected.frame.minionsKilled,
        jungleMinionsKilled: selected.frame.jungleMinionsKilled,
      },
    });
  },
};

function effectivePurchases(
  context: MissionEvaluationContext,
  beforeSeconds?: number,
) {
  return replayMissionItemEvents({
    events: context.timeline.events,
    participantId: context.participant.participantId,
    ...(beforeSeconds === undefined ? {} : { beforeSeconds }),
  });
}

function purchasedClassifiedCount(input: {
  context: MissionEvaluationContext;
  target: number;
  unit: string;
  beforeSeconds?: number;
  classification: keyof Omit<
    MissionStaticData["items"] extends ReadonlyMap<number, infer Value>
      ? Value
      : never,
    "id" | "totalGold"
  >;
}) {
  const timelineUnavailable = requireTimeline(
    input.context,
    input.target,
    input.unit,
  );
  if (timelineUnavailable) return timelineUnavailable;
  const staticUnavailable = requireStaticData(
    input.context,
    input.target,
    input.unit,
  );
  if (staticUnavailable) return staticUnavailable;
  const replay = effectivePurchases(input.context, input.beforeSeconds);
  let count = 0;
  for (const [itemId, purchases] of replay.effectivePurchases) {
    const item = input.context.staticData.items.get(itemId);
    if (!item) {
      return pending(
        input.context,
        input.target,
        input.unit,
        "STATIC_ITEM_NOT_FOUND",
        { itemId, staticDataVersion: input.context.staticData.version },
      );
    }
    if (item[input.classification]) count += purchases;
  }
  return count;
}

function classifiedPurchaseBefore(input: {
  key: string;
  classification: "controlWard" | "doran" | "supportStart";
  beforeSeconds: number;
  configuredTargetIsSeconds?: boolean;
}) {
  return configuredEvaluator({
    key: input.key,
    source: "TIMELINE",
    unit: "purchase",
    body(context, target, unit) {
      const beforeSeconds = input.configuredTargetIsSeconds
        ? target
        : input.beforeSeconds;
      const requiredPurchases = input.configuredTargetIsSeconds ? 1 : target;
      const count = purchasedClassifiedCount({
        context,
        target: requiredPurchases,
        unit,
        beforeSeconds,
        classification: input.classification,
      });
      if (typeof count !== "number") return count;
      return thresholdResult({
        context,
        currentValue: count,
        targetValue: requiredPurchases,
        unit,
        pass: count >= requiredPurchases,
        evidence: {
          classification: input.classification,
          beforeSeconds,
          effectivePurchases: count,
          staticDataVersion: context.staticData.version,
        },
      });
    },
  });
}

const noPotionPurchase = configuredEvaluator({
  key: "build.noPotionPurchase",
  source: "TIMELINE",
  unit: "purchase",
  body(context, target, unit) {
    const count = purchasedClassifiedCount({
      context,
      target,
      unit,
      classification: "potion",
    });
    if (typeof count !== "number") return count;
    const pass = count === 0;
    return thresholdResult({
      context,
      currentValue: count,
      targetValue: target,
      unit,
      pass,
      progressValue: pass ? 1 : 0,
      evidence: {
        effectivePotionPurchases: count,
        staticDataVersion: context.staticData.version,
        comparison: "equals_zero",
      },
    });
  },
});

const winWithoutFlash = configuredEvaluator({
  key: "build.winWithoutFlash",
  source: "SUMMARY",
  unit: "completion",
  body(context, target, unit) {
    if (context.participant.summonerSpellIds.length < 2) {
      return pending(context, target, unit, "MISSING_SUMMONER_SPELLS");
    }
    const hasFlash = context.participant.summonerSpellIds.includes(4);
    const pass = context.participant.win && !hasFlash;
    return thresholdResult({
      context,
      currentValue: pass ? 1 : 0,
      targetValue: 1,
      unit,
      pass,
      evidence: {
        win: context.participant.win,
        hasFlash,
        summonerSpellIds: context.participant.summonerSpellIds.join(","),
      },
    });
  },
});

const winWithoutBoots = configuredEvaluator({
  key: "build.winWithoutBoots",
  source: "TIMELINE",
  unit: "completion",
  body(context, target, unit) {
    const purchased = purchasedClassifiedCount({
      context,
      target,
      unit,
      classification: "boots",
    });
    if (typeof purchased !== "number") return purchased;
    let finalBoots = 0;
    for (const itemId of context.participant.itemIds) {
      const item = context.staticData.items.get(itemId);
      if (!item) {
        return pending(context, target, unit, "STATIC_ITEM_NOT_FOUND", {
          itemId,
          staticDataVersion: context.staticData.version,
        });
      }
      if (item.boots) finalBoots += 1;
    }
    const pass = context.participant.win && purchased === 0 && finalBoots === 0;
    return thresholdResult({
      context,
      currentValue: pass ? 1 : 0,
      targetValue: 1,
      unit,
      pass,
      evidence: {
        win: context.participant.win,
        effectiveBootPurchases: purchased,
        finalBoots,
        staticDataVersion: context.staticData.version,
      },
    });
  },
});

const completedItemsAtLeast = configuredEvaluator({
  key: "build.completedItemsAtLeast",
  source: "STATIC_SUMMARY",
  unit: "item",
  body(context, target, unit) {
    const unavailable = requireStaticData(context, target, unit);
    if (unavailable) return unavailable;
    let completed = 0;
    for (const itemId of context.participant.itemIds) {
      const item = context.staticData.items.get(itemId);
      if (!item) {
        return pending(context, target, unit, "STATIC_ITEM_NOT_FOUND", {
          itemId,
          staticDataVersion: context.staticData.version,
        });
      }
      if (item.completed) completed += 1;
    }
    return thresholdResult({
      context,
      currentValue: completed,
      targetValue: target,
      unit,
      pass: completed >= target,
      evidence: {
        completedItems: completed,
        staticDataVersion: context.staticData.version,
      },
    });
  },
});

const startPurchaseCostAtMost = configuredEvaluator({
  key: "build.startPurchaseCostAtMost",
  source: "TIMELINE",
  unit: "gold",
  body(context, target, unit) {
    const timelineUnavailable = requireTimeline(context, target, unit);
    if (timelineUnavailable) return timelineUnavailable;
    const staticUnavailable = requireStaticData(context, target, unit);
    if (staticUnavailable) return staticUnavailable;
    const replay = effectivePurchases(
      context,
      MISSION_START_PURCHASE_CUTOFF_SECONDS,
    );
    let cost = 0;
    for (const [itemId, count] of replay.inventory) {
      const item = context.staticData.items.get(itemId);
      if (!item) {
        return pending(context, target, unit, "STATIC_ITEM_NOT_FOUND", {
          itemId,
          staticDataVersion: context.staticData.version,
        });
      }
      if (!item.trinket) cost += item.totalGold * count;
    }
    const pass = cost <= target;
    return thresholdResult({
      context,
      currentValue: cost,
      targetValue: target,
      unit,
      pass,
      progressValue: pass ? target : 0,
      evidence: {
        cost,
        beforeSeconds: MISSION_START_PURCHASE_CUTOFF_SECONDS,
        excludesTrinkets: true,
        itemEvents: "purchase_sell_undo_replayed",
        staticDataVersion: context.staticData.version,
      },
    });
  },
});

type StandardPosition = NonNullable<
  MissionEvaluationContext["participant"]["position"]
>;

function standardPosition(value: string): StandardPosition | null {
  return value === "TOP" ||
    value === "JUNGLE" ||
    value === "MIDDLE" ||
    value === "BOTTOM" ||
    value === "UTILITY"
    ? value
    : null;
}

const winAsPosition = configuredStringEvaluator({
  key: "position.winAs",
  source: "SUMMARY",
  unit: "completion",
  body(context, target, unit) {
    const expected = standardPosition(target);
    if (!expected) {
      return pending(context, 0, unit, "INVALID_EVALUATOR_CONFIG", {
        configField: "target",
      });
    }
    if (!context.participant.position) {
      return pending(context, 1, unit, "POSITION_NOT_AVAILABLE");
    }
    const pass =
      context.participant.win && context.participant.position === expected;
    return thresholdResult({
      context,
      currentValue: pass ? 1 : 0,
      targetValue: 1,
      unit,
      pass,
      evidence: {
        win: context.participant.win,
        position: context.participant.position,
        expectedPosition: expected,
      },
    });
  },
});

const winOffPrimary = configuredEvaluator({
  key: "position.winOffPrimary",
  source: "SUMMARY",
  unit: "completion",
  body(context, target, unit) {
    if (!context.participant.position || !context.participant.primaryPosition) {
      return pending(context, target, unit, "POSITION_NOT_AVAILABLE", {
        matchPosition: context.participant.position,
        primaryPosition: context.participant.primaryPosition,
      });
    }
    const pass =
      context.participant.win &&
      context.participant.position !== context.participant.primaryPosition;
    return thresholdResult({
      context,
      currentValue: pass ? 1 : 0,
      targetValue: target,
      unit,
      pass,
      evidence: {
        win: context.participant.win,
        matchPosition: context.participant.position,
        primaryPosition: context.participant.primaryPosition,
      },
    });
  },
});

const winWithPrimaryRuneStyle = configuredEvaluator({
  key: "rune.winWithPrimaryStyle",
  source: "SUMMARY",
  unit: "completion",
  body(context, target, unit) {
    const primaryStyleId = context.participant.primaryRuneStyleId;
    if (primaryStyleId === null) {
      return pending(context, target, unit, "PRIMARY_RUNE_STYLE_NOT_AVAILABLE");
    }
    const pass = context.participant.win && primaryStyleId === target;
    return thresholdResult({
      context,
      currentValue: pass ? 1 : 0,
      targetValue: 1,
      unit,
      pass,
      evidence: {
        win: context.participant.win,
        primaryStyleId,
        expected: target,
      },
    });
  },
});

const winWithChampionTag = configuredStringEvaluator({
  key: "champion.winWithTag",
  source: "STATIC_SUMMARY",
  unit: "completion",
  body(context, target, unit) {
    const unavailable = requireStaticData(context, 1, unit);
    if (unavailable) return unavailable;
    const tags = context.staticData.championTags.get(
      context.participant.championId,
    );
    if (!tags) {
      return pending(context, 1, unit, "STATIC_CHAMPION_NOT_FOUND", {
        championId: context.participant.championId,
        staticDataVersion: context.staticData.version,
      });
    }
    const pass = context.participant.win && tags.includes(target);
    return thresholdResult({
      context,
      currentValue: pass ? 1 : 0,
      targetValue: 1,
      unit,
      pass,
      evidence: {
        win: context.participant.win,
        championId: context.participant.championId,
        championTags: tags.join(","),
        expectedTag: target,
        staticDataVersion: context.staticData.version,
      },
    });
  },
});

function cumulativeAddEvaluator(input: {
  key: string;
  unit: string;
  value: (context: MissionEvaluationContext) => number | null;
  field: string;
}) {
  return configuredEvaluator({
    key: input.key,
    source: "AGGREGATE",
    unit: input.unit,
    body(context, target, unit) {
      const delta = input.value(context);
      if (delta === null) {
        return pending(context, target, unit, "MISSING_CUMULATIVE_FIELD", {
          field: input.field,
        });
      }
      return result({
        context,
        status: delta > 0 ? "PASS" : "FAIL",
        currentValue: delta,
        targetValue: target,
        progressValue: delta,
        progressMode: "ADD",
        unit,
        reason: delta > 0 ? "PROGRESS_ADDED" : "NO_PROGRESS",
        evidence: { field: input.field, delta },
      });
    },
  });
}

const cumulativeWinStreak = configuredEvaluator({
  key: "cumulative.winStreak",
  source: "AGGREGATE",
  unit: "win",
  body(context, target, unit) {
    const canonical = context.aggregate.winStreak;
    const next = canonical
      ? canonical.current
      : context.participant.win
        ? context.aggregate.currentProgress + 1
        : 0;
    const maximum = canonical?.maximum ?? next;
    return result({
      context,
      status: maximum >= target ? "PASS" : "FAIL",
      currentValue: next,
      targetValue: target,
      progressValue: next,
      progressMode: "SET",
      completionReached: maximum >= target,
      ...(canonical?.completionParticipantMatchId
        ? {
            completionParticipantMatchId:
              canonical.completionParticipantMatchId,
          }
        : {}),
      unit,
      reason: next > 0 ? "STREAK_CONTINUED" : "STREAK_RESET",
      evidence: {
        win: context.participant.win,
        previousStreak: context.aggregate.currentProgress,
        nextStreak: next,
        maximumStreak: maximum,
      },
    });
  },
});

function cumulativeDistinctEvaluator(input: {
  key: string;
  unit: string;
  field: string;
  value: (context: MissionEvaluationContext) => string | null;
}) {
  return configuredEvaluator({
    key: input.key,
    source: "AGGREGATE",
    unit: input.unit,
    body(context, target, unit) {
      const key = input.value(context);
      if (key === null) {
        return pending(context, target, unit, "MISSING_CUMULATIVE_FIELD", {
          field: input.field,
        });
      }
      return result({
        context,
        status: "PASS",
        currentValue: 1,
        targetValue: target,
        progressValue: 1,
        progressMode: "DISTINCT",
        progressKey: key,
        unit,
        reason: "DISTINCT_VALUE_OBSERVED",
        evidence: { field: input.field, distinctValue: key },
      });
    },
  });
}

const cumulativeMvpAceAwards = configuredEvaluator({
  key: "cumulative.mvpAceAwards",
  source: "AGGREGATE",
  unit: "award",
  body(context, target, unit) {
    const award = context.internal.mvpAceAward;
    if (award === "PENDING") {
      return pending(context, target, unit, "MVP_ACE_EVALUATION_PENDING");
    }
    const eligible = award === "MVP" || award === "ACE";
    return result({
      context,
      status: eligible ? "PASS" : "FAIL",
      currentValue: eligible ? 1 : 0,
      targetValue: target,
      progressValue: eligible ? 1 : 0,
      progressMode: "ADD",
      unit,
      reason:
        award === "DEMO_EXCLUDED"
          ? "DEMO_MVP_ACE_EXCLUDED"
          : eligible
            ? "PUBLISHED_MVP_ACE_AWARD"
            : "NO_MVP_ACE_AWARD",
      evidence: { award, publishedNonDemoRequired: true },
    });
  },
});

const cumulativeGames = cumulativeAddEvaluator({
  key: "cumulative.games",
  unit: "game",
  field: "game",
  value: () => 1,
});
const cumulativeWins = cumulativeAddEvaluator({
  key: "cumulative.wins",
  unit: "win",
  field: "win",
  value: (context) => (context.participant.win ? 1 : 0),
});
const cumulativeKills = cumulativeAddEvaluator({
  key: "cumulative.kills",
  unit: "kill",
  field: "kills",
  value: (context) => context.participant.kills,
});
const cumulativeAssists = cumulativeAddEvaluator({
  key: "cumulative.assists",
  unit: "assist",
  field: "assists",
  value: (context) => context.participant.assists,
});
const cumulativeCs = cumulativeAddEvaluator({
  key: "cumulative.cs",
  unit: "cs",
  field: "cs",
  value: (context) => {
    const lane = context.participant.totalMinionsKilled;
    const neutral = context.participant.neutralMinionsKilled;
    return lane === null || neutral === null ? null : lane + neutral;
  },
});
const cumulativeVisionScore = cumulativeAddEvaluator({
  key: "cumulative.visionScore",
  unit: "vision_score",
  field: "visionScore",
  value: (context) => context.participant.visionScore,
});
const cumulativeDamage = cumulativeAddEvaluator({
  key: "cumulative.damageToChampions",
  unit: "damage",
  field: "damageToChampions",
  value: (context) => context.participant.damageToChampions,
});
const cumulativeDistinctChampions = cumulativeDistinctEvaluator({
  key: "cumulative.distinctChampions",
  unit: "champion",
  field: "championId",
  value: (context) => String(context.participant.championId),
});
const cumulativeDistinctPositions = cumulativeDistinctEvaluator({
  key: "cumulative.distinctPositions",
  unit: "position",
  field: "position",
  value: (context) => context.participant.position,
});
const cumulativeControlWards = cumulativeAddEvaluator({
  key: "cumulative.controlWardsBought",
  unit: "ward",
  field: "controlWardsBought",
  value: (context) => context.participant.controlWardsBought,
});
const cumulativeTeamDragons = cumulativeAddEvaluator({
  key: "cumulative.teamDragons",
  unit: "dragon",
  field: "team.dragonKills",
  value: (context) => context.team?.dragonKills ?? null,
});

const implementedEvaluators: readonly MissionEvaluator[] = [
  matchWin,
  kdaAtLeast,
  participantAtLeast("combat.killsAtLeast", "kills", "kill"),
  participantAtLeast("combat.assistsAtLeast", "assists", "assist"),
  winWithDeathsAtMost,
  killParticipationAtLeast,
  participantAtLeast(
    "damage.toChampionsAtLeast",
    "damageToChampions",
    "damage",
  ),
  perMinuteEvaluator({
    key: "damage.perMinuteAtLeast",
    field: "damageToChampions",
    unit: "damage_per_minute",
  }),
  participantAtLeast("damage.takenAtLeast", "damageTaken", "damage"),
  participantAtLeast("damage.mitigatedAtLeast", "damageMitigated", "damage"),
  participantAtLeast("combat.ccTimeAtLeast", "timeCCingOthers", "second"),
  allyHealShieldAtLeast,
  csAtLeast,
  csPerMinuteAtLeast,
  participantAtLeast("growth.goldAtLeast", "goldEarned", "gold"),
  participantAtLeast("vision.scoreAtLeast", "visionScore", "vision_score"),
  participantAtLeast(
    "vision.controlWardsBoughtAtLeast",
    "controlWardsBought",
    "ward",
  ),
  participantAtLeast("vision.wardsKilledAtLeast", "wardsKilled", "ward"),
  participantAtLeast("objective.damageAtLeast", "damageToObjectives", "damage"),
  participantAtLeast(
    "objective.turretDamageAtLeast",
    "damageToTurrets",
    "damage",
  ),
  participantAtLeast("growth.levelAtLeast", "championLevel", "level"),
  longestLifeAtLeast,
  perMinuteEvaluator({
    key: "growth.goldPerMinuteAtLeast",
    field: "goldEarned",
    unit: "gold_per_minute",
  }),
  participantAtLeast("combat.doubleKillsAtLeast", "doubleKills", "multikill"),
  participantAtLeast("combat.tripleKillsAtLeast", "tripleKills", "multikill"),
  participantAtLeast("combat.quadraKillsAtLeast", "quadraKills", "multikill"),
  participantAtLeast("combat.pentaKillsAtLeast", "pentaKills", "multikill"),
  participantAtLeast(
    "combat.largestKillingSpreeAtLeast",
    "largestKillingSpree",
    "kill",
  ),
  soloKillsAtLeast,
  booleanParticipationEvaluator({
    key: "combat.firstBloodParticipation",
    killField: "firstBloodKill",
    assistField: "firstBloodAssist",
  }),
  booleanParticipationEvaluator({
    key: "objective.firstTowerParticipation",
    killField: "firstTowerKill",
    assistField: "firstTowerAssist",
  }),
  turretTakedownsAtLeast,
  inhibitorTakedownsAtLeast,
  timelineObjectiveEvaluator({
    key: "objective.dragonTakedownsAtLeast",
    monsterType: "DRAGON",
  }),
  timelineObjectiveEvaluator({
    key: "objective.baronTakedownsAtLeast",
    monsterType: "BARON_NASHOR",
  }),
  timelineObjectiveEvaluator({
    key: "objective.heraldTakedownsAtLeast",
    monsterType: "RIFTHERALD",
  }),
  objectivesStolenAtLeast,
  teamDragonsAtLeast,
  winWithTeamBaron,
  winDurationEvaluator({
    key: "result.winWithinSeconds",
    comparison: "lte",
  }),
  winDurationEvaluator({
    key: "result.winAfterSeconds",
    comparison: "gte",
  }),
  winWithDragonsAndBaron,
  killBeforeEvaluator({ key: "timeline.killBeforeSeconds" }),
  killBeforeEvaluator({
    key: "timeline.killsBeforeTenAtLeast",
    fixedSeconds: 600,
  }),
  noDeathUntilSeconds,
  csAtMinuteAtLeast,
  classifiedPurchaseBefore({
    key: "timeline.controlWardPurchaseBefore",
    classification: "controlWard",
    beforeSeconds: 480,
    configuredTargetIsSeconds: true,
  }),
  classifiedPurchaseBefore({
    key: "build.doranStart",
    classification: "doran",
    beforeSeconds: MISSION_START_PURCHASE_CUTOFF_SECONDS,
  }),
  classifiedPurchaseBefore({
    key: "build.supportStart",
    classification: "supportStart",
    beforeSeconds: MISSION_START_PURCHASE_CUTOFF_SECONDS,
  }),
  noPotionPurchase,
  winWithoutFlash,
  winWithoutBoots,
  completedItemsAtLeast,
  startPurchaseCostAtMost,
  winAsPosition,
  winOffPrimary,
  winWithPrimaryRuneStyle,
  winWithChampionTag,
  cumulativeGames,
  cumulativeWins,
  cumulativeWinStreak,
  cumulativeKills,
  cumulativeAssists,
  cumulativeCs,
  cumulativeVisionScore,
  cumulativeDamage,
  cumulativeDistinctChampions,
  cumulativeDistinctPositions,
  cumulativeControlWards,
  cumulativeTeamDragons,
  cumulativeMvpAceAwards,
];

export const MISSION_EVALUATOR_KEYS_M001_M055 = {
  M001: "match.win",
  M002: "combat.kdaAtLeast",
  M003: "combat.kdaAtLeast",
  M004: "combat.kdaAtLeast",
  M005: "combat.killsAtLeast",
  M006: "combat.killsAtLeast",
  M007: "combat.killsAtLeast",
  M008: "combat.assistsAtLeast",
  M009: "combat.assistsAtLeast",
  M010: "combat.winWithDeathsAtMost",
  M011: "combat.winWithDeathsAtMost",
  M012: "combat.killParticipationAtLeast",
  M013: "combat.killParticipationAtLeast",
  M014: "damage.toChampionsAtLeast",
  M015: "damage.toChampionsAtLeast",
  M016: "damage.perMinuteAtLeast",
  M017: "damage.takenAtLeast",
  M018: "damage.mitigatedAtLeast",
  M019: "combat.ccTimeAtLeast",
  M020: "support.allyHealShieldAtLeast",
  M021: "growth.csAtLeast",
  M022: "growth.csAtLeast",
  M023: "growth.csPerMinuteAtLeast",
  M024: "growth.csPerMinuteAtLeast",
  M025: "growth.goldAtLeast",
  M026: "vision.scoreAtLeast",
  M027: "vision.scoreAtLeast",
  M028: "vision.scoreAtLeast",
  M029: "vision.controlWardsBoughtAtLeast",
  M030: "vision.wardsKilledAtLeast",
  M031: "objective.damageAtLeast",
  M032: "objective.turretDamageAtLeast",
  M033: "growth.levelAtLeast",
  M034: "combat.longestLifeAtLeast",
  M035: "growth.goldPerMinuteAtLeast",
  M036: "combat.doubleKillsAtLeast",
  M037: "combat.tripleKillsAtLeast",
  M038: "combat.quadraKillsAtLeast",
  M039: "combat.pentaKillsAtLeast",
  M040: "combat.largestKillingSpreeAtLeast",
  M041: "combat.soloKillsAtLeast",
  M042: "combat.firstBloodParticipation",
  M043: "objective.firstTowerParticipation",
  M044: "objective.turretTakedownsAtLeast",
  M045: "objective.inhibitorTakedownsAtLeast",
  M046: "objective.dragonTakedownsAtLeast",
  M047: "objective.baronTakedownsAtLeast",
  M048: "objective.heraldTakedownsAtLeast",
  M049: "objective.stealsAtLeast",
  M050: "objective.teamDragonsAtLeast",
  M051: "objective.winWithTeamBaron",
  M052: "result.winWithinSeconds",
  M053: "result.winWithinSeconds",
  M054: "result.winAfterSeconds",
  M055: "objective.winWithDragonsAndBaron",
} as const;

export const MISSION_EVALUATOR_KEYS_M001_M100 = {
  ...MISSION_EVALUATOR_KEYS_M001_M055,
  M056: "timeline.killBeforeSeconds",
  M057: "timeline.killsBeforeTenAtLeast",
  M058: "timeline.noDeathUntilSeconds",
  M059: "timeline.csAtMinuteAtLeast",
  M060: "timeline.csAtMinuteAtLeast",
  M061: "timeline.csAtMinuteAtLeast",
  M062: "timeline.controlWardPurchaseBefore",
  M063: "build.doranStart",
  M064: "build.supportStart",
  M065: "build.noPotionPurchase",
  M066: "build.winWithoutFlash",
  M067: "build.winWithoutBoots",
  M068: "build.completedItemsAtLeast",
  M069: "build.completedItemsAtLeast",
  M070: "build.startPurchaseCostAtMost",
  M071: "position.winAs",
  M072: "position.winAs",
  M073: "position.winAs",
  M074: "position.winAs",
  M075: "position.winAs",
  M076: "position.winOffPrimary",
  M077: "rune.winWithPrimaryStyle",
  M078: "rune.winWithPrimaryStyle",
  M079: "rune.winWithPrimaryStyle",
  M080: "rune.winWithPrimaryStyle",
  M081: "rune.winWithPrimaryStyle",
  M082: "champion.winWithTag",
  M083: "champion.winWithTag",
  M084: "champion.winWithTag",
  M085: "champion.winWithTag",
  M086: "cumulative.games",
  M087: "cumulative.games",
  M088: "cumulative.wins",
  M089: "cumulative.wins",
  M090: "cumulative.winStreak",
  M091: "cumulative.kills",
  M092: "cumulative.assists",
  M093: "cumulative.cs",
  M094: "cumulative.visionScore",
  M095: "cumulative.damageToChampions",
  M096: "cumulative.distinctChampions",
  M097: "cumulative.distinctPositions",
  M098: "cumulative.controlWardsBought",
  M099: "cumulative.teamDragons",
  M100: "cumulative.mvpAceAwards",
} as const;

export type ImplementedMissionCode =
  keyof typeof MISSION_EVALUATOR_KEYS_M001_M055;
export type MissionCode = keyof typeof MISSION_EVALUATOR_KEYS_M001_M100;

export class MissionEvaluatorRegistry {
  private readonly evaluators = new Map<string, MissionEvaluator>();

  constructor(evaluators: readonly MissionEvaluator[] = implementedEvaluators) {
    for (const evaluator of evaluators) {
      if (this.evaluators.has(evaluator.key)) {
        throw new Error(`Duplicate mission evaluator key: ${evaluator.key}`);
      }
      this.evaluators.set(evaluator.key, evaluator);
    }
  }

  get(key: string) {
    return this.evaluators.get(key) ?? null;
  }

  getByCode(code: MissionCode) {
    return this.get(MISSION_EVALUATOR_KEYS_M001_M100[code]);
  }

  has(key: string) {
    return this.evaluators.has(key);
  }

  keys() {
    return [...this.evaluators.keys()].sort();
  }

  codes() {
    return Object.keys(MISSION_EVALUATOR_KEYS_M001_M100) as MissionCode[];
  }
}

export const missionEvaluatorRegistry = new MissionEvaluatorRegistry();
