export type StandingInput = {
  participantWeekId: string;
  mainScore: number;
  wins: number;
  losses: number;
};

export type RankedStanding = StandingInput & { rank: number };

function sameStanding(left: StandingInput, right: StandingInput) {
  return (
    left.mainScore === right.mainScore &&
    left.wins - left.losses === right.wins - right.losses &&
    left.wins === right.wins
  );
}

export function rankMainStandings(
  standings: readonly StandingInput[],
): RankedStanding[] {
  const sorted = [...standings].sort(
    (left, right) =>
      right.mainScore - left.mainScore ||
      right.wins - right.losses - (left.wins - left.losses) ||
      right.wins - left.wins ||
      left.participantWeekId.localeCompare(right.participantWeekId),
  );
  const ranked: RankedStanding[] = [];
  for (const [index, standing] of sorted.entries()) {
    const previous = ranked.at(-1);
    ranked.push({
      ...standing,
      rank:
        previous && sameStanding(standing, previous)
          ? previous.rank
          : index + 1,
    });
  }
  return ranked;
}

const seoulDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toSeoulDateOnly(value: Date) {
  const parts = Object.fromEntries(
    seoulDateFormatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  if (![year, month, day].every(Number.isInteger)) {
    throw new Error("Asia/Seoul local date could not be resolved.");
  }
  return new Date(Date.UTC(year, month - 1, day));
}
