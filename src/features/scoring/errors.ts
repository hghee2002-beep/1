export type ScoringErrorCode =
  | "DRAW_NOT_FOUND"
  | "DRAW_FORBIDDEN"
  | "DRAW_INTEGRITY_FAILED"
  | "MATCH_NOT_SCORABLE"
  | "SEASON_FINALIZED"
  | "REROLL_CONFIRMATION_REQUIRED"
  | "REROLL_NOT_ELIGIBLE"
  | "REROLL_ALREADY_USED"
  | "REROLL_DEMO_BLOCKED"
  | "REROLL_EXPIRED"
  | "WEEK_CLOSED"
  | "ADJUSTMENT_REASON_REQUIRED"
  | "SCORING_CONFLICT";

export class ScoringServiceError extends Error {
  override readonly name = "ScoringServiceError";

  constructor(
    readonly code: ScoringErrorCode,
    message: string,
  ) {
    super(message);
  }
}
