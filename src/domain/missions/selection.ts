export const MAX_ACTIVE_MISSIONS = 5;
export const MAX_HIGH_DIFFICULTY_MISSIONS = 1;
export const MAX_TIMELINE_MISSIONS = 2;
export const MAX_CUMULATIVE_MISSIONS = 2;

export type MissionKindValue = "SINGLE" | "CUMULATIVE";
export type MissionSourceValue =
  "MATCH_INFO" | "MATCH_TIMELINE" | "DATA_DRAGON" | "DERIVED" | "INTERNAL";
export type MissionPosition =
  "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";

export type MissionDefinitionCandidate = {
  id: string;
  code: string;
  version: number;
  points: number;
  kind: MissionKindValue;
  sourceType: MissionSourceValue;
  evaluatorKey: string;
  evaluatorConfig: unknown;
  active: boolean;
};

export type ActiveMissionGuard = Pick<
  MissionDefinitionCandidate,
  | "id"
  | "code"
  | "points"
  | "kind"
  | "sourceType"
  | "evaluatorKey"
  | "evaluatorConfig"
>;

export type MissionCandidateHistoryState = {
  missionDefinitionId: string;
  status: "UNSEEN" | "ACTIVE" | "COMPLETED" | "DEFERRED" | "EXHAUSTED";
};

export type MissionSelectionProof = {
  index: number;
  entropyHash: string;
  algorithm: string;
};

export interface MissionIndexSelector {
  choose(upperExclusive: number): MissionSelectionProof;
}

export type MissionCandidatePool = "UNSEEN" | "DEFERRED";

export type SelectedMission = {
  definition: MissionDefinitionCandidate;
  pool: MissionCandidatePool;
  proof: MissionSelectionProof;
  candidateDefinitionIds: readonly string[];
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function missionRole(candidate: ActiveMissionGuard): MissionPosition | null {
  if (candidate.evaluatorKey !== "position.winAs") return null;
  const target = asRecord(candidate.evaluatorConfig)?.target;
  return target === "TOP" ||
    target === "JUNGLE" ||
    target === "MIDDLE" ||
    target === "BOTTOM" ||
    target === "UTILITY"
    ? target
    : null;
}

function configuredEligibleRoles(
  candidate: MissionDefinitionCandidate,
): readonly MissionPosition[] | null {
  const configured = asRecord(candidate.evaluatorConfig)?.eligibleRoles;
  if (!Array.isArray(configured)) return null;
  const roles = configured.filter(
    (role): role is MissionPosition =>
      role === "TOP" ||
      role === "JUNGLE" ||
      role === "MIDDLE" ||
      role === "BOTTOM" ||
      role === "UTILITY",
  );
  return roles.length > 0 ? roles : null;
}

export function canActivateMission(input: {
  candidate: MissionDefinitionCandidate;
  active: readonly ActiveMissionGuard[];
  participantPrimaryPosition: MissionPosition | null;
  timelineAvailable: boolean;
  hasPublishedMvpBaseline: boolean;
}) {
  const { active, candidate } = input;
  if (!candidate.active || active.length >= MAX_ACTIVE_MISSIONS) return false;
  if (active.some((mission) => mission.code === candidate.code)) return false;
  if (candidate.code === "M100" && !input.hasPublishedMvpBaseline) {
    return false;
  }
  if (candidate.sourceType === "MATCH_TIMELINE" && !input.timelineAvailable) {
    return false;
  }

  const eligibleRoles = configuredEligibleRoles(candidate);
  if (
    eligibleRoles &&
    input.participantPrimaryPosition &&
    !eligibleRoles.includes(input.participantPrimaryPosition)
  ) {
    return false;
  }
  if (
    candidate.points >= 5 &&
    active.filter((mission) => mission.points >= 5).length >=
      MAX_HIGH_DIFFICULTY_MISSIONS
  ) {
    return false;
  }
  if (
    candidate.sourceType === "MATCH_TIMELINE" &&
    active.filter((mission) => mission.sourceType === "MATCH_TIMELINE")
      .length >= MAX_TIMELINE_MISSIONS
  ) {
    return false;
  }
  if (
    candidate.kind === "CUMULATIVE" &&
    active.filter((mission) => mission.kind === "CUMULATIVE").length >=
      MAX_CUMULATIVE_MISSIONS
  ) {
    return false;
  }

  const candidateRole = missionRole(candidate);
  return !(
    candidateRole &&
    active.some((mission) => missionRole(mission) === candidateRole)
  );
}

export function selectMissionCandidate(input: {
  definitions: readonly MissionDefinitionCandidate[];
  history: readonly MissionCandidateHistoryState[];
  active: readonly ActiveMissionGuard[];
  participantPrimaryPosition: MissionPosition | null;
  timelineAvailable: boolean;
  hasPublishedMvpBaseline: boolean;
  requireLowPointMission?: boolean;
  selector: MissionIndexSelector;
}): SelectedMission | null {
  const historyByDefinition = new Map(
    input.history.map((entry) => [entry.missionDefinitionId, entry.status]),
  );
  const eligible = input.definitions.filter((candidate) =>
    canActivateMission({
      candidate,
      active: input.active,
      participantPrimaryPosition: input.participantPrimaryPosition,
      timelineAvailable: input.timelineAvailable,
      hasPublishedMvpBaseline: input.hasPublishedMvpBaseline,
    }),
  );
  const unseen = eligible.filter((candidate) => {
    const status = historyByDefinition.get(candidate.id);
    return status === undefined || status === "UNSEEN";
  });
  const deferred = eligible.filter(
    (candidate) => historyByDefinition.get(candidate.id) === "DEFERRED",
  );
  const pool: MissionCandidatePool = unseen.length > 0 ? "UNSEEN" : "DEFERRED";
  let candidates = pool === "UNSEEN" ? unseen : deferred;

  if (input.requireLowPointMission) {
    const lowPointCandidates = candidates.filter(
      (candidate) => candidate.points >= 1 && candidate.points <= 2,
    );
    if (lowPointCandidates.length > 0) candidates = lowPointCandidates;
  }
  if (candidates.length === 0) return null;

  const proof = input.selector.choose(candidates.length);
  const definition = candidates[proof.index];
  if (!definition || proof.index < 0 || proof.index >= candidates.length) {
    throw new RangeError("Mission selector returned an out-of-range index.");
  }
  return {
    definition,
    pool,
    proof,
    candidateDefinitionIds: candidates.map((candidate) => candidate.id),
  };
}
