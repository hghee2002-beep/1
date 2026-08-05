import { compareRiotIds, type RiotIdentity } from "@/lib/riot-id-order";

export function contextualRecordLabel(input: {
  todayKey: string;
  recordDate: string | null;
  todayLabel: string;
  recentLabel: string;
  emptyLabel: string;
}) {
  if (!input.recordDate) return input.emptyLabel;
  return input.recordDate === input.todayKey
    ? input.todayLabel
    : `${input.recordDate} ${input.recentLabel}`;
}

export function selectGameLeader<
  TParticipant extends RiotIdentity & { id: string },
>(
  participants: readonly TParticipant[],
  gamesByParticipant: ReadonlyMap<string, number>,
) {
  return (
    participants
      .map((participant) => ({
        participant,
        value: gamesByParticipant.get(participant.id) ?? 0,
      }))
      .filter((entry) => entry.value > 0)
      .sort(
        (left, right) =>
          right.value - left.value ||
          compareRiotIds(left.participant, right.participant) ||
          left.participant.id.localeCompare(right.participant.id),
      )[0] ?? null
  );
}
