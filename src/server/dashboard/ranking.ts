export type MainRankingInput = {
  participantId: string;
  score: number;
  wins: number;
  losses: number;
};

export type RankedMainStanding<T extends MainRankingInput> = T & {
  rank: number;
};

export function rankMainStandings<T extends MainRankingInput>(
  rows: readonly T[],
): Array<RankedMainStanding<T>> {
  const sorted = [...rows].sort((left, right) => {
    const score = right.score - left.score;
    if (score !== 0) return score;
    const record = right.wins - right.losses - (left.wins - left.losses);
    if (record !== 0) return record;
    const wins = right.wins - left.wins;
    if (wins !== 0) return wins;
    return left.participantId.localeCompare(right.participantId);
  });

  let lastRank = 0;
  return sorted.map((row, index) => {
    const previous = sorted[index - 1];
    const tied =
      previous !== undefined &&
      previous.score === row.score &&
      previous.wins - previous.losses === row.wins - row.losses &&
      previous.wins === row.wins;
    lastRank = tied ? lastRank : index + 1;
    return {
      ...row,
      rank: lastRank,
    };
  });
}

export function calculateRankLpDelta(
  current:
    { leaguePoints: number | null; displayOrdinal: number | null } | undefined,
  baseline:
    { leaguePoints: number | null; displayOrdinal: number | null } | undefined,
) {
  if (!current || !baseline) return 0;
  if (current.displayOrdinal !== null && baseline.displayOrdinal !== null) {
    return current.displayOrdinal - baseline.displayOrdinal;
  }
  return (current.leaguePoints ?? 0) - (baseline.leaguePoints ?? 0);
}
