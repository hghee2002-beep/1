import "server-only";

import { DrawState } from "@/generated/prisma/client";
import {
  drawCommitmentExplanation,
  publicDrawRngVersion,
  resolveDrawPointMode,
  verifyDrawCommitment,
  type PointModeLedgerEntry,
} from "@/domain/scoring/point-draw";
import { revealProtectedDrawNonce } from "@/domain/scoring/nonce-protection";
import { ScoringServiceError } from "@/features/scoring/errors";
import type { RevealedDrawResult } from "@/features/scoring/types";
import { serverEnv } from "@/lib/env/server";

export type RevealProofSelection = {
  id: string;
  participantMatchId: string;
  state: DrawState;
  resultSign: number;
  firstValue: number;
  firstNonceEncryptedOrProtected: string;
  firstCommitment: string;
  firstCommitmentVersion: string;
  firstRngVersion: string;
  revealedAt: Date | null;
  secondValue: number | null;
  secondNonceEncryptedOrProtected: string | null;
  secondCommitment: string | null;
  secondCommitmentVersion: string | null;
  secondRngVersion: string | null;
  rerollUsedAt: Date | null;
  pointModeLedgerEntries?: readonly PointModeLedgerEntry[];
};

export function pointDrawProtectionSecret() {
  return serverEnv.POINT_DRAW_SECRET ?? serverEnv.AUTH_SECRET;
}

export function normalizedSign(value: number): 1 | -1 {
  if (value === 1 || value === -1) return value;
  throw new ScoringServiceError(
    "DRAW_INTEGRITY_FAILED",
    "포인트 결과의 부호가 올바르지 않습니다.",
  );
}

function assertRevealIntegrity(input: {
  drawId: string;
  magnitude: number;
  nonce: string;
  commitment: string;
  commitmentVersion: string;
}) {
  if (
    !verifyDrawCommitment(
      {
        commitmentVersion: input.commitmentVersion,
        drawId: input.drawId,
        magnitude: input.magnitude,
        nonce: input.nonce,
      },
      input.commitment,
    )
  ) {
    throw new ScoringServiceError(
      "DRAW_INTEGRITY_FAILED",
      "봉인 결과의 commitment 검증에 실패했습니다.",
    );
  }
}

export function resolveVerifiedRevealedDraw(
  draw: RevealProofSelection,
  revealedAt: Date,
): RevealedDrawResult {
  const useSecond = draw.state === DrawState.REROLLED;
  const magnitude = useSecond ? draw.secondValue : draw.firstValue;
  const protectedNonce = useSecond
    ? draw.secondNonceEncryptedOrProtected
    : draw.firstNonceEncryptedOrProtected;
  const commitment = useSecond ? draw.secondCommitment : draw.firstCommitment;
  const commitmentVersion = useSecond
    ? draw.secondCommitmentVersion
    : draw.firstCommitmentVersion;
  const rngVersion = useSecond ? draw.secondRngVersion : draw.firstRngVersion;
  if (
    magnitude === null ||
    !protectedNonce ||
    !commitment ||
    !commitmentVersion ||
    !rngVersion
  ) {
    throw new ScoringServiceError(
      "DRAW_INTEGRITY_FAILED",
      "봉인 결과 데이터가 완전하지 않습니다.",
    );
  }
  const phase = useSecond ? "SECOND" : "FIRST";
  let nonce: string;
  try {
    nonce = revealProtectedDrawNonce({
      protectedNonce,
      drawId: draw.id,
      phase,
      secret: pointDrawProtectionSecret(),
    });
  } catch {
    throw new ScoringServiceError(
      "DRAW_INTEGRITY_FAILED",
      "봉인 결과를 안전하게 해제하지 못했습니다.",
    );
  }
  assertRevealIntegrity({
    drawId: draw.id,
    magnitude,
    nonce,
    commitment,
    commitmentVersion,
  });
  const resultSign = normalizedSign(draw.resultSign);
  const pointMode = resolveDrawPointMode({
    rngVersion,
    ledgerEntries: draw.pointModeLedgerEntries,
    useSecond,
  });
  const explanation = drawCommitmentExplanation(pointMode);
  return {
    id: draw.id,
    participantMatchId: draw.participantMatchId,
    phase,
    state: draw.state,
    resultSign,
    displayMagnitude: magnitude,
    signedDelta: resultSign * magnitude,
    nonce,
    commitment,
    commitmentVersion,
    rngVersion: publicDrawRngVersion(rngVersion, pointMode),
    pointMode,
    revealedAt: revealedAt.toISOString(),
    verifier: {
      algorithm: explanation.algorithm,
      encoding: explanation.encoding,
      fields: explanation.fields,
      probability: explanation.probability,
    },
  };
}
