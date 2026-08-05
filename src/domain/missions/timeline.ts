export const MISSION_START_PURCHASE_CUTOFF_SECONDS = 120;

export type MissionTimelineEvent = {
  type: string;
  timestampMs: number;
  participantId: number | null;
  creatorId: number | null;
  killerId: number | null;
  victimId: number | null;
  assistingParticipantIds: readonly number[];
  itemId: number | null;
  beforeId: number | null;
  afterId: number | null;
  monsterType: string | null;
  monsterSubType: string | null;
};

export type MissionParticipantFrame = {
  participantId: number;
  timestampMs: number;
  minionsKilled: number;
  jungleMinionsKilled: number;
};

export type MissionTimelineFrame = {
  timestampMs: number;
  participantFrames: Readonly<Record<string, MissionParticipantFrame>>;
};

export function missionMillisecondsToSeconds(timestampMs: number) {
  return timestampMs / 1_000;
}

export function missionSecondsToMilliseconds(seconds: number) {
  return seconds * 1_000;
}

export function isMissionEventBeforeSeconds(
  timestampMs: number,
  seconds: number,
) {
  return timestampMs < missionSecondsToMilliseconds(seconds);
}

/**
 * Riot timeline frames are not guaranteed to contain the exact requested
 * timestamp. Use the exact frame when it exists, otherwise walk backwards to
 * the most recent frame at or before the target that contains the participant.
 */
export function selectMissionParticipantFrameAtOrBefore(input: {
  frames: readonly MissionTimelineFrame[];
  participantId: number;
  targetSeconds: number;
}) {
  const targetMs = missionSecondsToMilliseconds(input.targetSeconds);
  for (let index = input.frames.length - 1; index >= 0; index -= 1) {
    const frame = input.frames[index];
    if (!frame || frame.timestampMs > targetMs) continue;
    const participantFrame =
      frame.participantFrames[String(input.participantId)];
    if (participantFrame) {
      return {
        frame: participantFrame,
        requestedTimestampMs: targetMs,
        selectedTimestampMs: frame.timestampMs,
        exact: frame.timestampMs === targetMs,
      };
    }
  }
  return null;
}

function addItem(items: Map<number, number>, itemId: number) {
  items.set(itemId, (items.get(itemId) ?? 0) + 1);
}

function removeItem(items: Map<number, number>, itemId: number) {
  const count = items.get(itemId) ?? 0;
  if (count <= 1) items.delete(itemId);
  else items.set(itemId, count - 1);
}

export type MissionItemReplay = {
  inventory: ReadonlyMap<number, number>;
  effectivePurchases: ReadonlyMap<number, number>;
};

/**
 * Replays the effective item event stream in timestamp order. ITEM_UNDO
 * replaces beforeId with afterId, which handles both purchase undo and sale
 * undo without treating a restored sold item as a new purchase.
 */
export function replayMissionItemEvents(input: {
  events: readonly MissionTimelineEvent[];
  participantId: number;
  beforeSeconds?: number;
}): MissionItemReplay {
  const cutoffMs =
    input.beforeSeconds === undefined
      ? Number.POSITIVE_INFINITY
      : missionSecondsToMilliseconds(input.beforeSeconds);
  const inventory = new Map<number, number>();
  const effectivePurchases = new Map<number, number>();
  const events = [...input.events].sort(
    (left, right) => left.timestampMs - right.timestampMs,
  );

  for (const event of events) {
    if (event.timestampMs >= cutoffMs) continue;
    if (event.participantId !== input.participantId) continue;

    if (event.type === "ITEM_PURCHASED" && event.itemId && event.itemId > 0) {
      addItem(inventory, event.itemId);
      addItem(effectivePurchases, event.itemId);
      continue;
    }
    if (event.type === "ITEM_SOLD" && event.itemId && event.itemId > 0) {
      removeItem(inventory, event.itemId);
      continue;
    }
    if (event.type !== "ITEM_UNDO") continue;

    if (event.beforeId && event.beforeId > 0) {
      removeItem(inventory, event.beforeId);
      removeItem(effectivePurchases, event.beforeId);
    }
    if (event.afterId && event.afterId > 0) {
      addItem(inventory, event.afterId);
    }
  }

  return { inventory, effectivePurchases };
}
