import type { MatchSummary } from "@/features/riot/types";

export const RANKED_SOLO_QUEUE_ID = 420;
export const SUMMONERS_RIFT_MAP_ID = 11;

export type MatchEligibilityReason =
  | "ELIGIBLE"
  | "BEFORE_SEASON"
  | "AFTER_SEASON"
  | "WEEK_NOT_FOUND"
  | "UNSUPPORTED_QUEUE"
  | "UNSUPPORTED_MAP"
  | "UNSUPPORTED_MODE"
  | "REMAKE"
  | "EARLY_SURRENDER"
  | "BELOW_MINIMUM_DURATION";

export type MatchEligibilityResult = {
  eligible: boolean;
  reason: MatchEligibilityReason;
  weekId: string | null;
};

export type MatchEligibilityInput = {
  match: MatchSummary;
  season: {
    startAt: Date;
    endAt: Date;
    minGameDurationSeconds: number;
  };
  weeks: readonly { id: string; startAt: Date; endAt: Date }[];
};

export function evaluateMatchEligibility({
  match,
  season,
  weeks,
}: MatchEligibilityInput): MatchEligibilityResult {
  const startedAt = match.gameStartAt.getTime();
  if (startedAt < season.startAt.getTime()) {
    return { eligible: false, reason: "BEFORE_SEASON", weekId: null };
  }
  if (startedAt >= season.endAt.getTime()) {
    return { eligible: false, reason: "AFTER_SEASON", weekId: null };
  }

  const week = weeks.find(
    (candidate) =>
      startedAt >= candidate.startAt.getTime() &&
      startedAt < candidate.endAt.getTime(),
  );
  if (!week) {
    return { eligible: false, reason: "WEEK_NOT_FOUND", weekId: null };
  }
  if (match.queueId !== RANKED_SOLO_QUEUE_ID) {
    return {
      eligible: false,
      reason: "UNSUPPORTED_QUEUE",
      weekId: week.id,
    };
  }
  if (match.mapId !== SUMMONERS_RIFT_MAP_ID) {
    return { eligible: false, reason: "UNSUPPORTED_MAP", weekId: week.id };
  }
  if (match.gameMode !== "CLASSIC") {
    return { eligible: false, reason: "UNSUPPORTED_MODE", weekId: week.id };
  }
  if (match.remake) {
    return { eligible: false, reason: "REMAKE", weekId: week.id };
  }
  if (match.earlySurrender) {
    return {
      eligible: false,
      reason: "EARLY_SURRENDER",
      weekId: week.id,
    };
  }
  if (match.durationSeconds < season.minGameDurationSeconds) {
    return {
      eligible: false,
      reason: "BELOW_MINIMUM_DURATION",
      weekId: week.id,
    };
  }
  return { eligible: true, reason: "ELIGIBLE", weekId: week.id };
}
