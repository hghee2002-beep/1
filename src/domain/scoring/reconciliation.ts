export type ReconciliationMatchStatus =
  "INGESTED" | "PROCESSING" | "PROCESSED" | "INVALID" | "ERROR";

export type ReconciliationDrawState =
  "SEALED" | "REVEALED" | "REROLLED" | "AUTO_REVEALED" | "VOID";

export type ReconciliationLedgerType =
  | "MATCH_INITIAL"
  | "MATCH_REROLL_ADJUSTMENT"
  | "ADMIN_ADJUSTMENT"
  | "MATCH_INVALIDATION"
  | "MATCH_REINSTATEMENT"
  | "MIGRATION_ADJUSTMENT";

export type MatchScoreReconciliationInput = {
  participantMatchId: string;
  participantWeekId: string;
  seasonMatchStatus: ReconciliationMatchStatus;
  eligible: boolean;
  eligibilityReason: string | null;
  win: boolean;
  pointSignedCached: number | null;
  pointDraw: {
    state: ReconciliationDrawState;
    resultSign: number;
    firstValue: number;
    secondValue: number | null;
    rerollUsed: boolean;
    finalValue: number;
    finalSignedValue: number;
  } | null;
  ledgers: readonly {
    id: string;
    type: ReconciliationLedgerType;
    amount: number;
    metadata: unknown;
  }[];
};

export type MatchScoreIntegrityIssueCode =
  | "MATCH_ELIGIBILITY_STATUS_MISMATCH"
  | "MISSING_POINT_DRAW"
  | "UNEXPECTED_SCORING_ARTIFACTS"
  | "DRAW_RESULT_SIGN_MISMATCH"
  | "DRAW_STATE_MISMATCH"
  | "DRAW_FINAL_VALUE_MISMATCH"
  | "INITIAL_LEDGER_COUNT_MISMATCH"
  | "INITIAL_LEDGER_AMOUNT_MISMATCH"
  | "REROLL_LEDGER_COUNT_MISMATCH"
  | "REROLL_LEDGER_AMOUNT_MISMATCH"
  | "UNEXPECTED_MATCH_LEDGER_TYPE"
  | "INVALIDATION_PAIR_MISMATCH"
  | "INVALIDATION_REVERSAL_AMOUNT_MISMATCH"
  | "MATCH_LEDGER_NET_MISMATCH"
  | "PARTICIPANT_MATCH_CACHE_MISMATCH";

export type MatchScoreIntegrityIssue = {
  participantMatchId: string;
  participantWeekId: string;
  code: MatchScoreIntegrityIssueCode;
  expected: string;
  actual: string;
};

export type MatchScoreIntegrityResult = {
  participantMatchId: string;
  participantWeekId: string;
  issues: MatchScoreIntegrityIssue[];
  expectedPointSignedCached: number | null;
  pointCacheRepairable: boolean;
};

export type WinLossProjection = {
  participantWeekId: string;
  wins: number;
  losses: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function metadataString(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return null;
  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function formatLedgerCount(
  ledgers: readonly MatchScoreReconciliationInput["ledgers"][number][],
) {
  return String(ledgers.length);
}

export function inspectMatchScoreIntegrity(
  input: MatchScoreReconciliationInput,
): MatchScoreIntegrityResult {
  const issues: MatchScoreIntegrityIssue[] = [];
  const addIssue = (
    code: MatchScoreIntegrityIssueCode,
    expected: string | number | boolean | null,
    actual: string | number | boolean | null,
  ) => {
    issues.push({
      participantMatchId: input.participantMatchId,
      participantWeekId: input.participantWeekId,
      code,
      expected: String(expected),
      actual: String(actual),
    });
  };

  const isActiveSettlement =
    input.eligible && input.seasonMatchStatus === "PROCESSED";
  const isAdminInvalidated =
    !input.eligible &&
    input.seasonMatchStatus === "INVALID" &&
    input.eligibilityReason === "ADMIN_INVALIDATED";

  if (input.eligible && input.seasonMatchStatus !== "PROCESSED") {
    addIssue(
      "MATCH_ELIGIBILITY_STATUS_MISMATCH",
      "eligible PROCESSED",
      `eligible ${input.seasonMatchStatus}`,
    );
  }

  if (!isActiveSettlement && !isAdminInvalidated) {
    if (
      input.pointDraw ||
      input.ledgers.length > 0 ||
      input.pointSignedCached !== null
    ) {
      addIssue(
        "UNEXPECTED_SCORING_ARTIFACTS",
        "no draw or match-scoped ledger",
        `draw=${Boolean(input.pointDraw)}, ledgers=${input.ledgers.length}`,
      );
    }
    return {
      participantMatchId: input.participantMatchId,
      participantWeekId: input.participantWeekId,
      issues,
      expectedPointSignedCached: null,
      pointCacheRepairable: false,
    };
  }

  const draw = input.pointDraw;
  if (!draw) {
    addIssue("MISSING_POINT_DRAW", "one point draw", null);
    const initialLedgerCount = input.ledgers.filter(
      (ledger) => ledger.type === "MATCH_INITIAL",
    ).length;
    if (initialLedgerCount !== 1) {
      addIssue("INITIAL_LEDGER_COUNT_MISMATCH", 1, initialLedgerCount);
    }
    return {
      participantMatchId: input.participantMatchId,
      participantWeekId: input.participantWeekId,
      issues,
      expectedPointSignedCached: isAdminInvalidated ? 0 : null,
      pointCacheRepairable: false,
    };
  }

  const expectedSign = input.win ? 1 : -1;
  if (draw.resultSign !== expectedSign) {
    addIssue("DRAW_RESULT_SIGN_MISMATCH", expectedSign, draw.resultSign);
  }

  const usesSecondOutcome = draw.secondValue !== null;
  if (usesSecondOutcome !== draw.rerollUsed) {
    addIssue(
      "DRAW_STATE_MISMATCH",
      "second value and reroll timestamp present together",
      `second=${usesSecondOutcome}, rerollUsed=${draw.rerollUsed}`,
    );
  }
  if (isActiveSettlement) {
    const expectedState = usesSecondOutcome ? "REROLLED" : "non-REROLLED";
    const stateMatches = usesSecondOutcome
      ? draw.state === "REROLLED"
      : draw.state !== "REROLLED" && draw.state !== "VOID";
    if (!stateMatches) {
      addIssue("DRAW_STATE_MISMATCH", expectedState, draw.state);
    }
  } else if (draw.state !== "VOID") {
    addIssue("DRAW_STATE_MISMATCH", "VOID", draw.state);
  }

  const expectedFinalValue = draw.secondValue ?? draw.firstValue;
  if (
    draw.finalValue !== expectedFinalValue ||
    draw.finalSignedValue !== expectedSign * expectedFinalValue
  ) {
    addIssue(
      "DRAW_FINAL_VALUE_MISMATCH",
      `${expectedFinalValue}/${expectedSign * expectedFinalValue}`,
      `${draw.finalValue}/${draw.finalSignedValue}`,
    );
  }

  const initialLedgers = input.ledgers.filter(
    (ledger) => ledger.type === "MATCH_INITIAL",
  );
  const rerollLedgers = input.ledgers.filter(
    (ledger) => ledger.type === "MATCH_REROLL_ADJUSTMENT",
  );
  const invalidations = input.ledgers.filter(
    (ledger) => ledger.type === "MATCH_INVALIDATION",
  );
  const reinstatements = input.ledgers.filter(
    (ledger) => ledger.type === "MATCH_REINSTATEMENT",
  );
  const unexpectedLedgers = input.ledgers.filter(
    (ledger) =>
      ledger.type === "ADMIN_ADJUSTMENT" ||
      ledger.type === "MIGRATION_ADJUSTMENT",
  );

  if (initialLedgers.length !== 1) {
    addIssue(
      "INITIAL_LEDGER_COUNT_MISMATCH",
      1,
      formatLedgerCount(initialLedgers),
    );
  } else if (initialLedgers[0]!.amount !== expectedSign * draw.firstValue) {
    addIssue(
      "INITIAL_LEDGER_AMOUNT_MISMATCH",
      expectedSign * draw.firstValue,
      initialLedgers[0]!.amount,
    );
  }

  const expectedRerollCount = usesSecondOutcome ? 1 : 0;
  if (rerollLedgers.length !== expectedRerollCount) {
    addIssue(
      "REROLL_LEDGER_COUNT_MISMATCH",
      expectedRerollCount,
      formatLedgerCount(rerollLedgers),
    );
  } else if (usesSecondOutcome && rerollLedgers[0]) {
    const expectedAdjustment =
      expectedSign * expectedFinalValue - expectedSign * draw.firstValue;
    if (rerollLedgers[0].amount !== expectedAdjustment) {
      addIssue(
        "REROLL_LEDGER_AMOUNT_MISMATCH",
        expectedAdjustment,
        rerollLedgers[0].amount,
      );
    }
  }

  if (unexpectedLedgers.length > 0) {
    addIssue(
      "UNEXPECTED_MATCH_LEDGER_TYPE",
      "settlement/reversal ledger types only",
      unexpectedLedgers.map((ledger) => ledger.type).join(","),
    );
  }

  const invalidationById = new Map(
    invalidations.map((ledger) => [ledger.id, ledger]),
  );
  const pairedInvalidationIds = new Set<string>();
  let invalidationPairsValid = true;
  for (const reinstatement of reinstatements) {
    const invalidationId = metadataString(
      reinstatement.metadata,
      "invalidationLedgerId",
    );
    const invalidation = invalidationId
      ? invalidationById.get(invalidationId)
      : undefined;
    if (
      !invalidationId ||
      !invalidation ||
      pairedInvalidationIds.has(invalidationId) ||
      reinstatement.amount !== -invalidation.amount
    ) {
      invalidationPairsValid = false;
      continue;
    }
    pairedInvalidationIds.add(invalidationId);
  }
  const expectedUnpairedInvalidations = isAdminInvalidated ? 1 : 0;
  const actualUnpairedInvalidations =
    invalidations.length - pairedInvalidationIds.size;
  if (
    !invalidationPairsValid ||
    actualUnpairedInvalidations !== expectedUnpairedInvalidations ||
    reinstatements.length !== pairedInvalidationIds.size
  ) {
    addIssue(
      "INVALIDATION_PAIR_MISMATCH",
      `valid pairs with ${expectedUnpairedInvalidations} unpaired invalidation(s)`,
      `${pairedInvalidationIds.size} pair(s), ${actualUnpairedInvalidations} unpaired invalidation(s)`,
    );
  }

  const expectedSettledAmount = expectedSign * expectedFinalValue;
  const invalidReversalAmount = invalidations.some(
    (ledger) => ledger.amount !== -expectedSettledAmount,
  );
  const invalidReinstatementAmount = reinstatements.some(
    (ledger) => ledger.amount !== expectedSettledAmount,
  );
  if (invalidReversalAmount || invalidReinstatementAmount) {
    addIssue(
      "INVALIDATION_REVERSAL_AMOUNT_MISMATCH",
      `invalidation=${-expectedSettledAmount}, reinstatement=${expectedSettledAmount}`,
      `invalidation=${invalidations.map((row) => row.amount).join(",")}, reinstatement=${reinstatements.map((row) => row.amount).join(",")}`,
    );
  }

  const ledgerNet = input.ledgers.reduce(
    (sum, ledger) => sum + ledger.amount,
    0,
  );
  const expectedLedgerNet = isAdminInvalidated ? 0 : expectedSettledAmount;
  if (ledgerNet !== expectedLedgerNet) {
    addIssue("MATCH_LEDGER_NET_MISMATCH", expectedLedgerNet, ledgerNet);
  }

  const expectedPointSignedCached = isAdminInvalidated
    ? 0
    : expectedSettledAmount;
  if (input.pointSignedCached !== expectedPointSignedCached) {
    addIssue(
      "PARTICIPANT_MATCH_CACHE_MISMATCH",
      expectedPointSignedCached,
      input.pointSignedCached,
    );
  }
  const pointCacheRepairable =
    issues.length === 1 &&
    issues[0]?.code === "PARTICIPANT_MATCH_CACHE_MISMATCH";

  return {
    participantMatchId: input.participantMatchId,
    participantWeekId: input.participantWeekId,
    issues,
    expectedPointSignedCached,
    pointCacheRepairable,
  };
}

export function projectWinLossByParticipantWeek(
  matches: readonly Pick<
    MatchScoreReconciliationInput,
    "participantWeekId" | "seasonMatchStatus" | "eligible" | "win"
  >[],
) {
  const projections = new Map<string, WinLossProjection>();
  for (const match of matches) {
    if (!match.eligible || match.seasonMatchStatus !== "PROCESSED") continue;
    const projection = projections.get(match.participantWeekId) ?? {
      participantWeekId: match.participantWeekId,
      wins: 0,
      losses: 0,
    };
    if (match.win) projection.wins += 1;
    else projection.losses += 1;
    projections.set(match.participantWeekId, projection);
  }
  return projections;
}
