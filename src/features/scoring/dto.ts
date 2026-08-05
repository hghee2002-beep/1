import { DrawState } from "@/generated/prisma/client";
import {
  publicDrawRngVersion,
  resolveDrawPointMode,
  type PointModeLedgerEntry,
} from "@/domain/scoring/point-draw";
import type {
  RerollEntitlementSource,
  SealedDrawListItem,
} from "@/features/scoring/types";

function sign(value: number): 1 | -1 {
  if (value === 1 || value === -1) return value;
  throw new Error("Stored point draw sign is invalid.");
}

function entitlementSource(
  value: string | null,
): RerollEntitlementSource | null {
  return value === "MVP" || value === "ACE" || value === "DEMO_ONLY"
    ? value
    : null;
}

export function toSafeDrawListItem(
  input: {
    id: string;
    participantMatchId: string;
    state: DrawState;
    resultSign: number;
    firstValue: number;
    firstCommitment: string;
    firstCommitmentVersion: string;
    firstRngVersion: string;
    firstGeneratedAt: Date;
    revealedAt: Date | null;
    autoRevealed: boolean;
    rerollEligible: boolean;
    rerollReason: string | null;
    rerollEntitlementSource: string | null;
    rerollGrantedAt: Date | null;
    rerollExpiresAt: Date | null;
    rerollUsedAt: Date | null;
    secondValue: number | null;
    secondCommitment: string | null;
    secondCommitmentVersion: string | null;
    secondRngVersion: string | null;
    finalValue: number;
    finalSignedValue: number;
    participantMatch: {
      win: boolean;
      championName: string;
      position: SealedDrawListItem["position"];
      participantWeek: {
        mainScoreCached: number;
        rankCached: number | null;
        week: {
          endAt: Date;
          season: { autoRevealHours: number };
        };
      };
      scoreLedger: PointModeLedgerEntry[];
      seasonMatch: {
        match: { riotMatchId: string; gameStartAt: Date; gameEndAt: Date };
      };
    };
  },
  now: Date,
): SealedDrawListItem {
  const sealed = input.state === DrawState.SEALED;
  const rerolled = input.state === DrawState.REROLLED;
  const voided = input.state === DrawState.VOID;
  const disclosed = !sealed && !voided;
  const resultSign = sign(input.resultSign);
  const firstSignedDelta = disclosed ? resultSign * input.firstValue : null;
  const secondSignedDelta =
    rerolled && input.secondValue !== null
      ? resultSign * input.secondValue
      : null;
  const currentCommitment =
    rerolled && input.secondCommitment
      ? input.secondCommitment
      : input.firstCommitment;
  const participantWeek = input.participantMatch.participantWeek;
  const storedRngVersion =
    rerolled && input.secondRngVersion
      ? input.secondRngVersion
      : input.firstRngVersion;
  const pointMode = resolveDrawPointMode({
    rngVersion: storedRngVersion,
    ledgerEntries: input.participantMatch.scoreLedger,
    useSecond: rerolled,
  });
  const weekEndsAt = participantWeek.week.endAt;
  const rerollDeadline = input.rerollExpiresAt ?? weekEndsAt;
  const rerollWindowOpen =
    now.getTime() < rerollDeadline.getTime() &&
    now.getTime() < weekEndsAt.getTime();
  return {
    id: input.id,
    participantMatchId: input.participantMatchId,
    matchId: input.participantMatch.seasonMatch.match.riotMatchId,
    state: input.state,
    resultSign,
    win: input.participantMatch.win,
    championName: input.participantMatch.championName,
    position: input.participantMatch.position,
    gameStartAt:
      input.participantMatch.seasonMatch.match.gameStartAt.toISOString(),
    gameEndAt: input.participantMatch.seasonMatch.match.gameEndAt.toISOString(),
    commitment: currentCommitment,
    firstCommitment: input.firstCommitment,
    secondCommitment: rerolled ? input.secondCommitment : null,
    commitmentVersion:
      rerolled && input.secondCommitmentVersion
        ? input.secondCommitmentVersion
        : input.firstCommitmentVersion,
    rngVersion: publicDrawRngVersion(storedRngVersion, pointMode),
    pointMode,
    revealedAt: input.revealedAt?.toISOString() ?? null,
    autoRevealed: input.autoRevealed,
    autoRevealAt: new Date(
      input.firstGeneratedAt.getTime() +
        participantWeek.week.season.autoRevealHours * 60 * 60 * 1_000,
    ).toISOString(),
    rerollEligible:
      input.rerollEligible &&
      input.rerollUsedAt === null &&
      !voided &&
      rerollWindowOpen,
    rerollUsed: input.rerollUsedAt !== null,
    rerollEntitlementSource: entitlementSource(input.rerollEntitlementSource),
    rerollReason: input.rerollReason,
    rerollGrantedAt: input.rerollGrantedAt?.toISOString() ?? null,
    rerollExpiresAt: input.rerollExpiresAt?.toISOString() ?? null,
    weekEndsAt: weekEndsAt.toISOString(),
    displayMagnitude: sealed || voided ? null : input.finalValue,
    signedDelta: sealed || voided ? null : input.finalSignedValue,
    firstSignedDelta,
    secondSignedDelta,
    rerollAdjustment:
      firstSignedDelta !== null && secondSignedDelta !== null
        ? secondSignedDelta - firstSignedDelta
        : null,
    currentScore: participantWeek.mainScoreCached,
    currentRank: participantWeek.rankCached,
  };
}
