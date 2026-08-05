import type { SyncRunStatus } from "@/generated/prisma/client";

export type SyncRunSummary = {
  runId: string;
  status: SyncRunStatus;
  participantCount: number;
  matchIdsFound: number;
  matchesFetched: number;
  matchesProcessed: number;
  matchesSkipped: number;
  errorCount: number;
  hasMore: boolean;
  dryRun: boolean;
};
