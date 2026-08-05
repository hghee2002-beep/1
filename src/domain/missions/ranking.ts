export type MissionStandingInput = {
  participantWeekId: string;
  score: number;
};

export function rankMissionStandings<T extends MissionStandingInput>(
  standings: readonly T[],
): Array<T & { rank: number }> {
  const sorted = [...standings].sort(
    (left, right) =>
      right.score - left.score ||
      left.participantWeekId.localeCompare(right.participantWeekId),
  );
  let rank = 0;
  let previousScore: number | null = null;
  return sorted.map((standing, index) => {
    if (previousScore === null || standing.score !== previousScore) {
      rank = index + 1;
      previousScore = standing.score;
    }
    return { ...standing, rank };
  });
}

export function rebuildMissionProgress(
  events: readonly { deltaValue: number }[],
) {
  return events.reduce((total, event) => total + event.deltaValue, 0);
}
