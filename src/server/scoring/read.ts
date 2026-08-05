import "server-only";

import { ScoreLedgerType } from "@/generated/prisma/client";
import { toSafeDrawListItem } from "@/features/scoring/dto";
import { db } from "@/server/db/client";

export async function listMyPointDraws(userId: string, now = new Date()) {
  const draws = await db.pointDraw.findMany({
    where: { participantMatch: { participant: { userId } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      participantMatchId: true,
      state: true,
      resultSign: true,
      firstValue: true,
      firstCommitment: true,
      firstCommitmentVersion: true,
      firstRngVersion: true,
      firstGeneratedAt: true,
      revealedAt: true,
      autoRevealed: true,
      rerollEligible: true,
      rerollReason: true,
      rerollEntitlementSource: true,
      rerollGrantedAt: true,
      rerollExpiresAt: true,
      rerollUsedAt: true,
      secondValue: true,
      secondCommitment: true,
      secondCommitmentVersion: true,
      secondRngVersion: true,
      finalValue: true,
      finalSignedValue: true,
      participantMatch: {
        select: {
          win: true,
          championName: true,
          position: true,
          scoreLedger: {
            where: {
              type: {
                in: [
                  ScoreLedgerType.MATCH_INITIAL,
                  ScoreLedgerType.MATCH_REROLL_ADJUSTMENT,
                ],
              },
            },
            orderBy: { createdAt: "asc" },
            select: { type: true, metadata: true },
          },
          participantWeek: {
            select: {
              mainScoreCached: true,
              rankCached: true,
              week: {
                select: {
                  endAt: true,
                  season: { select: { autoRevealHours: true } },
                },
              },
            },
          },
          seasonMatch: {
            select: {
              match: {
                select: {
                  riotMatchId: true,
                  gameStartAt: true,
                  gameEndAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
  return draws.map((draw) => toSafeDrawListItem(draw, now));
}
