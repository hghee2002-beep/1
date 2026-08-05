import {
  MVP_GROUPS,
  MVP_GROUP_WEIGHTS,
  MVP_METRIC_CONTRACT,
  MVP_METRIC_KEYS,
  MVP_MIN_GROUP_METRIC_COVERAGE,
  MVP_MIN_SAMPLE_SIZE,
  MVP_WINSORIZE_LIMIT,
  type MvpMetricGroup,
  type MvpMetricKey,
  type MvpPosition,
  type MvpTierBucket,
} from "@/domain/mvp/contract";

export type MvpBaselineMetric = {
  tierBucket: MvpTierBucket;
  position: MvpPosition;
  metricKey: MvpMetricKey;
  mean: number;
  stdDev: number;
  sampleSize: number;
};

export type MvpRawStats = {
  durationSeconds: number;
  teamKills: number;
  championLevel: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  goldEarned: number;
  damageToChampions: number;
  damageTaken: number;
  damageMitigated: number;
  damageToObjectives: number;
  damageToTurrets: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
  healOnTeammates: number;
  shieldOnTeammates: number;
};

export type DerivedMvpMetrics = Partial<Record<MvpMetricKey, number | null>>;

export type MvpMetricBreakdown = {
  raw: number;
  mean: number;
  stdDev: number;
  sampleSize: number;
  zScore: number;
  winsorizedZScore: number;
  effectiveGroupWeight: number;
};

export type MvpGroupBreakdown = {
  score: number;
  configuredWeight: number;
  weightedScore: number;
  coverage: number;
  missingMetrics: MvpMetricKey[];
  metrics: Partial<Record<MvpMetricKey, MvpMetricBreakdown>>;
};

export type MvpParticipantInput = {
  participantKey: string;
  teamId: number;
  win: boolean;
  position: MvpPosition | null;
  tierBucket: MvpTierBucket | null;
  deaths: number;
  objectiveInvolvement: number;
  metrics: DerivedMvpMetrics;
};

export type MvpParticipantEvaluation = {
  participantKey: string;
  teamId: number;
  win: boolean;
  position: MvpPosition | null;
  tierBucket: MvpTierBucket | null;
  deaths: number;
  objectiveInvolvement: number;
  status: "COMPLETED" | "PENDING_BASELINE" | "PENDING_DATA";
  errorCode: string | null;
  groups: Partial<Record<MvpMetricGroup, MvpGroupBreakdown>>;
  totalScore: number | null;
  teamRank: number | null;
  award: "NONE" | "MVP" | "ACE";
  tieBreakPath: string[];
};

function finiteOrNull(value: number) {
  return Number.isFinite(value) ? value : null;
}

export function deriveMvpMetrics(input: MvpRawStats): DerivedMvpMetrics {
  const minutes = input.durationSeconds / 60;
  if (!Number.isFinite(minutes) || minutes <= 0) return {};
  const perMinute = (value: number) => finiteOrNull(value / minutes);
  return {
    visionScorePerMinute: perMinute(input.visionScore),
    wardsPlacedPerMinute: perMinute(input.wardsPlaced),
    wardsKilledPerMinute: perMinute(input.wardsKilled),
    damageToObjectivesPerMinute: perMinute(input.damageToObjectives),
    goldPerMinute: perMinute(input.goldEarned),
    csPerMinute: perMinute(input.cs),
    championLevelPerMinute: perMinute(input.championLevel),
    damageToTurretsPerMinute: perMinute(input.damageToTurrets),
    damageToChampionsPerMinute: perMinute(input.damageToChampions),
    damageTakenPerMinute: perMinute(input.damageTaken),
    damageMitigatedPerMinute: perMinute(input.damageMitigated),
    protectionPerMinute: perMinute(
      input.healOnTeammates + input.shieldOnTeammates,
    ),
    killsPerMinute: perMinute(input.kills),
    assistsPerMinute: perMinute(input.assists),
    kda: finiteOrNull(
      (input.kills + input.assists) / Math.max(1, input.deaths),
    ),
    killParticipation:
      input.teamKills > 0
        ? finiteOrNull((input.kills + input.assists) / input.teamKills)
        : null,
  };
}

export function zScore(value: number, mean: number, stdDev: number) {
  if (!Number.isFinite(stdDev) || stdDev <= 0) return null;
  const result = (value - mean) / stdDev;
  return Number.isFinite(result) ? result : null;
}

export function winsorize(value: number, limit = MVP_WINSORIZE_LIMIT) {
  return Math.max(-limit, Math.min(limit, value));
}

function pending(
  input: MvpParticipantInput,
  status: "PENDING_BASELINE" | "PENDING_DATA",
  errorCode: string,
  groups: Partial<Record<MvpMetricGroup, MvpGroupBreakdown>> = {},
): MvpParticipantEvaluation {
  return {
    ...input,
    status,
    errorCode,
    groups,
    totalScore: null,
    teamRank: null,
    award: "NONE",
    tieBreakPath: [],
  };
}

export function evaluateMvpParticipant(
  input: MvpParticipantInput,
  baselineMetrics: readonly MvpBaselineMetric[],
): MvpParticipantEvaluation {
  if (!input.position) {
    return pending(input, "PENDING_DATA", "POSITION_MISSING");
  }
  if (!input.tierBucket) {
    return pending(input, "PENDING_BASELINE", "TIER_BUCKET_UNAVAILABLE");
  }

  const baseline = new Map(
    baselineMetrics
      .filter(
        (metric) =>
          metric.position === input.position &&
          metric.tierBucket === input.tierBucket,
      )
      .map((metric) => [metric.metricKey, metric] as const),
  );
  if (baseline.size !== MVP_METRIC_KEYS.length) {
    return pending(input, "PENDING_BASELINE", "BASELINE_COVERAGE_MISSING");
  }
  const groups: Partial<Record<MvpMetricGroup, MvpGroupBreakdown>> = {};
  for (const group of MVP_GROUPS) {
    const keys = MVP_METRIC_CONTRACT[group] as readonly MvpMetricKey[];
    const missingMetrics: MvpMetricKey[] = [];
    const available: Array<{
      key: MvpMetricKey;
      value: number;
      baseline: MvpBaselineMetric;
      zScore: number;
    }> = [];
    for (const key of keys) {
      const value = input.metrics[key];
      const metricBaseline = baseline.get(key);
      const standardized =
        typeof value === "number" && metricBaseline
          ? zScore(value, metricBaseline.mean, metricBaseline.stdDev)
          : null;
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        !metricBaseline ||
        metricBaseline.sampleSize < MVP_MIN_SAMPLE_SIZE ||
        standardized === null
      ) {
        missingMetrics.push(key);
        continue;
      }
      available.push({
        key,
        value,
        baseline: metricBaseline,
        zScore: standardized,
      });
    }
    const coverage = available.length / keys.length;
    if (coverage < MVP_MIN_GROUP_METRIC_COVERAGE) {
      return pending(input, "PENDING_DATA", `GROUP_COVERAGE_${group}`, groups);
    }
    const effectiveGroupWeight = 1 / available.length;
    const metrics: Partial<Record<MvpMetricKey, MvpMetricBreakdown>> = {};
    let groupScore = 0;
    for (const item of available) {
      const clamped = winsorize(item.zScore);
      groupScore += clamped * effectiveGroupWeight;
      metrics[item.key] = {
        raw: item.value,
        mean: item.baseline.mean,
        stdDev: item.baseline.stdDev,
        sampleSize: item.baseline.sampleSize,
        zScore: item.zScore,
        winsorizedZScore: clamped,
        effectiveGroupWeight,
      };
    }
    const configuredWeight = MVP_GROUP_WEIGHTS[input.position][group];
    groups[group] = {
      score: groupScore,
      configuredWeight,
      weightedScore: groupScore * configuredWeight,
      coverage,
      missingMetrics,
      metrics,
    };
  }

  const totalScore = MVP_GROUPS.reduce(
    (sum, group) => sum + (groups[group]?.weightedScore ?? 0),
    0,
  );
  return {
    ...input,
    status: "COMPLETED",
    errorCode: null,
    groups,
    totalScore,
    teamRank: null,
    award: "NONE",
    tieBreakPath: [],
  };
}

function compareCompleted(
  left: MvpParticipantEvaluation,
  right: MvpParticipantEvaluation,
) {
  const total = (right.totalScore ?? 0) - (left.totalScore ?? 0);
  if (total !== 0) return { order: total, reason: "TOTAL_SCORE" };
  const leftKda = left.groups.KDA_PARTICIPATION?.score ?? 0;
  const rightKda = right.groups.KDA_PARTICIPATION?.score ?? 0;
  if (leftKda !== rightKda) {
    return { order: rightKda - leftKda, reason: "KDA_PARTICIPATION" };
  }
  if (left.objectiveInvolvement !== right.objectiveInvolvement) {
    return {
      order: right.objectiveInvolvement - left.objectiveInvolvement,
      reason: "OBJECTIVE_INVOLVEMENT",
    };
  }
  if (left.deaths !== right.deaths) {
    return { order: left.deaths - right.deaths, reason: "FEWER_DEATHS" };
  }
  return {
    order: left.participantKey.localeCompare(right.participantKey, "en"),
    reason: "PARTICIPANT_KEY",
  };
}

export function rankMvpTeams(
  evaluations: readonly MvpParticipantEvaluation[],
): MvpParticipantEvaluation[] {
  const result = evaluations.map((evaluation) => ({ ...evaluation }));
  const teams = new Map<number, MvpParticipantEvaluation[]>();
  for (const evaluation of result) {
    const team = teams.get(evaluation.teamId) ?? [];
    team.push(evaluation);
    teams.set(evaluation.teamId, team);
  }
  for (const team of teams.values()) {
    if (
      team.length !== 5 ||
      team.some((evaluation) => evaluation.status !== "COMPLETED")
    ) {
      continue;
    }
    const ranked = [...team].sort(
      (left, right) => compareCompleted(left, right).order,
    );
    ranked.forEach((evaluation, index) => {
      const target = result.find(
        (candidate) => candidate.participantKey === evaluation.participantKey,
      );
      if (!target) return;
      target.teamRank = index + 1;
      if (index === 0) target.award = target.win ? "MVP" : "ACE";
      if (index > 0) {
        const previous = ranked[index - 1];
        if (previous) {
          target.tieBreakPath = [compareCompleted(previous, evaluation).reason];
        }
      } else if (ranked[1]) {
        target.tieBreakPath = [compareCompleted(evaluation, ranked[1]).reason];
      }
    });
  }
  return result;
}

export function groupWeightTotal(position: MvpPosition) {
  return MVP_GROUPS.reduce(
    (total, group) => total + MVP_GROUP_WEIGHTS[position][group],
    0,
  );
}
