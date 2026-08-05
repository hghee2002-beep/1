import type { PointMode } from "@/domain/scoring/point-draw";
import type { DrawState, Position } from "@/generated/prisma/client";

export type RerollEntitlementSource = "MVP" | "ACE" | "DEMO_ONLY";

export interface RerollEntitlement {
  entitlementKey: string;
  participantMatchId: string;
  source: RerollEntitlementSource;
  grantedAt: Date;
  expiresAt: Date;
  reason: string;
  demoOnly: boolean;
}

export interface RerollEntitlementIssuer {
  grant(entitlement: RerollEntitlement): Promise<{
    drawId: string;
    granted: boolean;
  }>;
}

export type SealedDrawListItem = {
  id: string;
  participantMatchId: string;
  matchId: string;
  state: DrawState;
  resultSign: 1 | -1;
  win: boolean;
  championName: string;
  position: Position | null;
  gameStartAt: string;
  gameEndAt: string;
  commitment: string;
  firstCommitment: string;
  secondCommitment: string | null;
  commitmentVersion: string;
  rngVersion: string;
  pointMode: PointMode;
  revealedAt: string | null;
  autoRevealed: boolean;
  autoRevealAt: string;
  rerollEligible: boolean;
  rerollUsed: boolean;
  rerollEntitlementSource: RerollEntitlementSource | null;
  rerollReason: string | null;
  rerollGrantedAt: string | null;
  rerollExpiresAt: string | null;
  weekEndsAt: string;
  displayMagnitude: number | null;
  signedDelta: number | null;
  firstSignedDelta: number | null;
  secondSignedDelta: number | null;
  rerollAdjustment: number | null;
  currentScore: number;
  currentRank: number | null;
};

export type RevealedDrawResult = {
  id: string;
  participantMatchId: string;
  phase: "FIRST" | "SECOND";
  state: DrawState;
  resultSign: 1 | -1;
  displayMagnitude: number;
  signedDelta: number;
  nonce: string;
  commitment: string;
  commitmentVersion: string;
  rngVersion: string;
  pointMode: PointMode;
  revealedAt: string;
  verifier: {
    algorithm: string;
    encoding: string;
    fields: readonly string[];
    probability: string;
  };
};
