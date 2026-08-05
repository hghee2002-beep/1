import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { rankMainStandings } from "@/domain/sync/standings";

export type ScoringDatabaseClient = PrismaClient | Prisma.TransactionClient;

export function isPrismaError(error: unknown, code: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

export async function refreshWeekRanks(
  transaction: Prisma.TransactionClient,
  weekId: string,
) {
  const rows = await transaction.participantWeek.findMany({
    where: { weekId },
    select: {
      id: true,
      mainScoreCached: true,
      wins: true,
      losses: true,
    },
  });
  const standings = rankMainStandings(
    rows.map((row) => ({
      participantWeekId: row.id,
      mainScore: row.mainScoreCached,
      wins: row.wins,
      losses: row.losses,
    })),
  );
  for (const standing of standings) {
    await transaction.participantWeek.update({
      where: { id: standing.participantWeekId },
      data: { rankCached: standing.rank },
    });
  }
}
