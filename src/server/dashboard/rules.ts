import { SeasonStatus } from "@/generated/prisma/client";

export const PUBLIC_RULES_SEASON_STATUSES = [
  SeasonStatus.ACTIVE,
  SeasonStatus.FINALIZING,
  SeasonStatus.SCHEDULED,
  SeasonStatus.COMPLETED,
] as const;

type RulesSeasonCandidate = {
  status: SeasonStatus;
  startAt: Date;
};

export function selectPublicRulesSeason<T extends RulesSeasonCandidate>(
  candidates: readonly T[],
): T | undefined {
  for (const status of PUBLIC_RULES_SEASON_STATUSES) {
    const latest = candidates
      .filter((candidate) => candidate.status === status)
      .sort(
        (left, right) => right.startAt.getTime() - left.startAt.getTime(),
      )[0];
    if (latest) return latest;
  }
  return undefined;
}
