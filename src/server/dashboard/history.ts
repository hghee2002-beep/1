import type { HistoryStanding } from "@/server/dashboard/types";

function historyStanding(value: unknown): HistoryStanding | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.gameName !== "string" ||
    typeof row.tagLine !== "string" ||
    typeof row.score !== "number"
  ) {
    return null;
  }
  return {
    rank: typeof row.rank === "number" ? row.rank : 0,
    participantId:
      typeof row.participantId === "string" ? row.participantId : null,
    gameName: row.gameName,
    tagLine: row.tagLine,
    realName: typeof row.realName === "string" ? row.realName : null,
    score: row.score,
    wins: typeof row.wins === "number" ? row.wins : 0,
    losses: typeof row.losses === "number" ? row.losses : 0,
    completed: typeof row.completed === "number" ? row.completed : 0,
  };
}

export function parseHistoryStandings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    const parsed = historyStanding(row);
    return parsed ? [parsed] : [];
  });
}

export function snapshotRulesVersion(value: unknown, fallback: string) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fallback;
  }
  const version = (value as Record<string, unknown>).version;
  return typeof version === "string" ? version : fallback;
}
