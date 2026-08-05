import "server-only";

import {
  SeasonStatus,
  WeekStatus,
  type Prisma,
} from "@/generated/prisma/client";

export type CompetitionWriteScope = {
  weekStatus: WeekStatus;
  seasonStatus: SeasonStatus;
};

export function isCompetitionWriteClosed(scope: CompetitionWriteScope) {
  return (
    scope.weekStatus === WeekStatus.FINALIZING ||
    scope.weekStatus === WeekStatus.COMPLETED ||
    scope.seasonStatus === SeasonStatus.FINALIZING ||
    scope.seasonStatus === SeasonStatus.COMPLETED ||
    scope.seasonStatus === SeasonStatus.ARCHIVED
  );
}

export async function lockParticipantWeekCompetitionScope(
  transaction: Prisma.TransactionClient,
  participantWeekId: string,
) {
  const [scope] = await transaction.$queryRaw<readonly CompetitionWriteScope[]>`
    SELECT
      week_row."status" AS "weekStatus",
      season_row."status" AS "seasonStatus"
    FROM "ParticipantWeek" participant_week
    JOIN "Week" week_row ON week_row."id" = participant_week."weekId"
    JOIN "Season" season_row ON season_row."id" = week_row."seasonId"
    WHERE participant_week."id" = ${participantWeekId}::uuid
    FOR SHARE OF week_row, season_row
  `;
  return scope ?? null;
}

export async function lockSeasonMatchCompetitionScope(
  transaction: Prisma.TransactionClient,
  seasonMatchId: string,
) {
  const [scope] = await transaction.$queryRaw<readonly CompetitionWriteScope[]>`
    SELECT
      week_row."status" AS "weekStatus",
      season_row."status" AS "seasonStatus"
    FROM "SeasonMatch" season_match
    JOIN "Week" week_row ON week_row."id" = season_match."weekId"
    JOIN "Season" season_row ON season_row."id" = season_match."seasonId"
    WHERE season_match."id" = ${seasonMatchId}::uuid
    FOR SHARE OF week_row, season_row
  `;
  return scope ?? null;
}
