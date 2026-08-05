import { z } from "zod";

const baselineContentSchema = z.union([
  z.string().min(2).max(2_000_000),
  z.record(z.string(), z.unknown()),
]);

export const baselineValidateInputSchema = z.object({
  format: z.enum(["CSV", "JSON"]),
  content: baselineContentSchema,
});

export const baselinePublishInputSchema = baselineValidateInputSchema.extend({
  expectedChecksum: z.string().regex(/^[a-f0-9]{64}$/u),
  confirmationName: z.string().trim().min(3).max(128),
});
