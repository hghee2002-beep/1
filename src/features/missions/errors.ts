export type MissionErrorCode =
  | "MISSION_ASSIGNMENT_NOT_FOUND"
  | "MISSION_ASSIGNMENT_FORBIDDEN"
  | "MISSION_ASSIGNMENT_NOT_ACTIVE"
  | "MISSION_REROLL_COOLDOWN"
  | "MISSION_POOL_EXHAUSTED"
  | "MISSION_SNAPSHOT_MISSING"
  | "MISSION_CONFLICT"
  | "WEEK_CLOSED";

export class MissionServiceError extends Error {
  override readonly name = "MissionServiceError";

  constructor(
    readonly code: MissionErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, string | number | null>>,
  ) {
    super(message);
  }
}
