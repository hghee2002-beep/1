import { z } from "zod";

export const missionRerollInputSchema = z
  .object({
    idempotencyKey: z.uuid(),
  })
  .strict();

export const missionLifecycleInputSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(20),
  })
  .strict();
