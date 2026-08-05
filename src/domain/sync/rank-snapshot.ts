import type { RankedSoloSnapshot } from "@/features/riot/types";

export const RANK_DISPLAY_ORDINAL_VERSION = "rank-display-v1";

const tierBase: Readonly<Record<string, number>> = {
  IRON: 0,
  BRONZE: 400,
  SILVER: 800,
  GOLD: 1_200,
  PLATINUM: 1_600,
  EMERALD: 2_000,
  DIAMOND: 2_400,
  MASTER: 2_800,
  GRANDMASTER: 3_200,
  CHALLENGER: 3_600,
};

const divisionOffset: Readonly<Record<string, number>> = {
  IV: 0,
  III: 100,
  II: 200,
  I: 300,
};

export type ComparableRankSnapshot = Pick<
  RankedSoloSnapshot,
  "tier" | "rank" | "leaguePoints" | "wins" | "losses"
> | null;

export type RankObservationStatus = "CAPTURED" | "UNRANKED" | "UNCHANGED";

export function rankDisplayOrdinal(
  snapshot: ComparableRankSnapshot,
): number | null {
  if (!snapshot) return null;
  const base = tierBase[snapshot.tier.toUpperCase()];
  if (base === undefined) return null;
  const masterBase = tierBase.MASTER ?? 2_800;
  const division =
    base < masterBase ? divisionOffset[snapshot.rank.toUpperCase()] : 0;
  if (division === undefined) return null;
  return base + division + Math.max(0, snapshot.leaguePoints);
}

export function isSameRankSnapshot(
  current: ComparableRankSnapshot,
  previous: ComparableRankSnapshot,
) {
  if (!current || !previous) return current === previous;
  return (
    current.tier === previous.tier &&
    current.rank === previous.rank &&
    current.leaguePoints === previous.leaguePoints &&
    current.wins === previous.wins &&
    current.losses === previous.losses
  );
}

export function rankObservationStatus(input: {
  current: ComparableRankSnapshot;
  previous: ComparableRankSnapshot;
  hasPrevious: boolean;
}): RankObservationStatus {
  if (!input.current) {
    return input.hasPrevious && !input.previous ? "UNCHANGED" : "UNRANKED";
  }
  return input.hasPrevious && isSameRankSnapshot(input.current, input.previous)
    ? "UNCHANGED"
    : "CAPTURED";
}
