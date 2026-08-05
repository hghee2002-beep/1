export const MVP_EVALUATOR_VERSION = "mvp-ace-v1" as const;

export const MVP_SNAPSHOT_BASELINE_STATUSES = ["PUBLISHED", "RETIRED"] as const;

export const MVP_POSITIONS = [
  "TOP",
  "JUNGLE",
  "MIDDLE",
  "BOTTOM",
  "UTILITY",
] as const;

export const MVP_TIER_BUCKETS = [
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER_PLUS",
] as const;

export const MVP_GROUPS = [
  "VISION_OBJECTIVE",
  "GROWTH",
  "DAMAGE",
  "KDA_PARTICIPATION",
] as const;

export const MVP_METRIC_CONTRACT = {
  VISION_OBJECTIVE: [
    "visionScorePerMinute",
    "wardsPlacedPerMinute",
    "wardsKilledPerMinute",
    "damageToObjectivesPerMinute",
  ],
  GROWTH: [
    "goldPerMinute",
    "csPerMinute",
    "championLevelPerMinute",
    "damageToTurretsPerMinute",
  ],
  DAMAGE: [
    "damageToChampionsPerMinute",
    "damageTakenPerMinute",
    "damageMitigatedPerMinute",
    "protectionPerMinute",
  ],
  KDA_PARTICIPATION: [
    "killsPerMinute",
    "assistsPerMinute",
    "kda",
    "killParticipation",
  ],
} as const;

export type MvpPosition = (typeof MVP_POSITIONS)[number];
export type MvpTierBucket = (typeof MVP_TIER_BUCKETS)[number];
export type MvpMetricGroup = (typeof MVP_GROUPS)[number];
export type MvpMetricKey = (typeof MVP_METRIC_CONTRACT)[MvpMetricGroup][number];

export const MVP_METRIC_KEYS = MVP_GROUPS.flatMap(
  (group) => MVP_METRIC_CONTRACT[group],
) as readonly MvpMetricKey[];

export const MVP_COMMON_GROUP_WEIGHTS: Readonly<
  Record<MvpMetricGroup, number>
> = {
  VISION_OBJECTIVE: 0.175,
  GROWTH: 0.175,
  DAMAGE: 0.175,
  KDA_PARTICIPATION: 0.175,
};

export const MVP_POSITION_BONUS_WEIGHTS: Readonly<
  Record<MvpPosition, Readonly<Record<MvpMetricGroup, number>>>
> = {
  TOP: {
    VISION_OBJECTIVE: 0,
    GROWTH: 0.1,
    DAMAGE: 0.15,
    KDA_PARTICIPATION: 0.05,
  },
  JUNGLE: {
    VISION_OBJECTIVE: 0.15,
    GROWTH: 0,
    DAMAGE: 0.05,
    KDA_PARTICIPATION: 0.1,
  },
  MIDDLE: {
    VISION_OBJECTIVE: 0,
    GROWTH: 0.1,
    DAMAGE: 0.15,
    KDA_PARTICIPATION: 0.05,
  },
  BOTTOM: {
    VISION_OBJECTIVE: 0,
    GROWTH: 0.1,
    DAMAGE: 0.15,
    KDA_PARTICIPATION: 0.05,
  },
  UTILITY: {
    VISION_OBJECTIVE: 0.15,
    GROWTH: 0,
    DAMAGE: 0.05,
    KDA_PARTICIPATION: 0.1,
  },
};

export const MVP_GROUP_WEIGHTS = Object.fromEntries(
  MVP_POSITIONS.map((position) => [
    position,
    Object.fromEntries(
      MVP_GROUPS.map((group) => [
        group,
        MVP_COMMON_GROUP_WEIGHTS[group] +
          MVP_POSITION_BONUS_WEIGHTS[position][group],
      ]),
    ),
  ]),
) as Readonly<Record<MvpPosition, Readonly<Record<MvpMetricGroup, number>>>>;

export const MVP_WINSORIZE_LIMIT = 3;
export const MVP_MIN_SAMPLE_SIZE = 30;
export const MVP_MIN_GROUP_METRIC_COVERAGE = 0.75;

export function isMvpPosition(value: string): value is MvpPosition {
  return (MVP_POSITIONS as readonly string[]).includes(value);
}

export function isMvpTierBucket(value: string): value is MvpTierBucket {
  return (MVP_TIER_BUCKETS as readonly string[]).includes(value);
}

export function isMvpMetricKey(value: string): value is MvpMetricKey {
  return (MVP_METRIC_KEYS as readonly string[]).includes(value);
}

export function isMvpSnapshotBaselineStatus(
  value: string | null | undefined,
): value is (typeof MVP_SNAPSHOT_BASELINE_STATUSES)[number] {
  return (
    typeof value === "string" &&
    (MVP_SNAPSHOT_BASELINE_STATUSES as readonly string[]).includes(value)
  );
}

export function metricGroupFor(metricKey: MvpMetricKey): MvpMetricGroup {
  const group = MVP_GROUPS.find((candidate) =>
    (MVP_METRIC_CONTRACT[candidate] as readonly string[]).includes(metricKey),
  );
  if (!group) throw new Error(`Unknown MVP metric: ${metricKey}`);
  return group;
}
