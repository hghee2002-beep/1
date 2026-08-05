import { z } from "zod";

const reason = z.string().trim().min(3).max(500);

export const revealDrawInputSchema = z.object({}).strict();

export const rerollDrawInputSchema = z
  .object({ confirmed: z.literal(true) })
  .strict();

export const adminAdjustmentInputSchema = z
  .object({
    participantWeekId: z.uuid(),
    amount: z
      .number()
      .int()
      .min(-1_000_000)
      .max(1_000_000)
      .refine((value) => value !== 0),
    reason,
    idempotencyKey: z.string().trim().min(8).max(192),
  })
  .strict();

export const invalidateMatchInputSchema = z
  .object({ reason, confirmation: z.string().trim().min(1).max(128) })
  .strict();

export const reinstateMatchInputSchema = invalidateMatchInputSchema;

export const scoringBackfillInputSchema = z
  .object({
    seasonId: z.uuid().optional(),
    limit: z.number().int().min(1).max(100).default(20),
  })
  .strict();

export const reconcileScoresInputSchema = z
  .object({
    weekId: z.uuid().optional(),
    repair: z.boolean().default(false),
    reason: reason.optional(),
    confirmation: z.string().trim().max(64).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.repair && value.confirmation !== "REPAIR") {
      context.addIssue({
        code: "custom",
        path: ["confirmation"],
        message: "복구 실행에는 REPAIR 확인 문구가 필요합니다.",
      });
    }
    if (value.repair && !value.reason) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "복구 실행 사유가 필요합니다.",
      });
    }
  });

export function scoringFieldErrors(error: z.ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "request");
    (fields[field] ??= []).push(issue.message);
  }
  return fields;
}
