import { z } from "zod";

export const syncRequestSchema = z
  .object({
    seasonId: z.uuid().optional(),
    participantId: z.uuid().optional(),
    invocationKey: z.string().trim().min(8).max(192).optional(),
    dryRun: z.boolean().default(false),
    force: z.boolean().default(false),
    limit: z.number().int().min(1).max(20).optional(),
    timeBudgetMs: z.number().int().min(1_000).max(60_000).optional(),
  })
  .strict();

export type SyncRequestInput = z.infer<typeof syncRequestSchema>;
