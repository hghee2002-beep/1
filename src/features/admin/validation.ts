import { z } from "zod";

const reason = z.string().trim().min(5).max(500);
const idempotencyKey = z.string().uuid();
const uuid = z.string().uuid();
const confirmation = z.string().trim().min(1).max(160);

const userRoleUpdateSchema = z.object({
  action: z.literal("USER_ROLE_UPDATE"),
  targetId: uuid,
  role: z.enum(["USER", "ADMIN"]),
  reason,
  confirmation,
  idempotencyKey,
});

const userStatusUpdateSchema = z.object({
  action: z.literal("USER_STATUS_UPDATE"),
  targetId: uuid,
  status: z.enum(["ACTIVE", "LOCKED", "DISABLED"]),
  reason,
  confirmation,
  idempotencyKey,
});

const participantStatusUpdateSchema = z.object({
  action: z.literal("PARTICIPANT_STATUS_UPDATE"),
  targetId: uuid,
  status: z.enum(["ACTIVE", "PAUSED", "REMOVED"]),
  reason,
  confirmation,
  idempotencyKey,
});

const seasonCreateSchema = z
  .object({
    action: z.literal("SEASON_CREATE_DRAFT"),
    name: z.string().trim().min(2).max(100),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
    startAt: z.iso.datetime({ offset: true }),
    endAt: z.iso.datetime({ offset: true }),
    weekCount: z.number().int().min(1).max(2),
    scoringMode: z.enum(["RANDOM_17_23", "FIXED_20"]),
    minGameDurationSeconds: z.number().int().min(300).max(3_600),
    autoRevealHours: z.number().int().min(1).max(168),
    rulesVersion: z.string().trim().min(1).max(64),
    reason,
    idempotencyKey,
  })
  .superRefine((value, context) => {
    if (Date.parse(value.startAt) >= Date.parse(value.endAt)) {
      context.addIssue({
        code: "custom",
        path: ["endAt"],
        message: "종료 시각은 시작 시각보다 뒤여야 합니다.",
      });
    }
  });

const seasonActionSchema = z.object({
  action: z.enum(["SEASON_VALIDATE", "SEASON_START", "SEASON_FINALIZE"]),
  targetId: uuid,
  dryRun: z.boolean().default(true),
  reason,
  confirmation,
  idempotencyKey,
});

const missionCloneSchema = z.object({
  action: z.literal("MISSION_CLONE"),
  targetId: uuid,
  reason,
  idempotencyKey,
});

const missionActiveUpdateSchema = z.object({
  action: z.literal("MISSION_ACTIVE_UPDATE"),
  targetId: uuid,
  active: z.boolean(),
  reason,
  confirmation,
  idempotencyKey,
});

const missionCorrectionSchema = z.object({
  action: z.literal("MISSION_PROGRESS_CORRECT"),
  targetId: uuid,
  correctedProgress: z.number().min(0).max(1_000_000),
  reason,
  confirmation,
  idempotencyKey,
});

const baselineArchiveSchema = z.object({
  action: z.literal("BASELINE_ARCHIVE"),
  targetId: uuid,
  reason,
  confirmation,
  idempotencyKey,
});

const announcementCreateSchema = z.object({
  action: z.literal("ANNOUNCEMENT_CREATE"),
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(5).max(20_000),
  pinned: z.boolean().default(false),
  publish: z.boolean().default(false),
  reason,
  idempotencyKey,
});

const legalPublishSchema = z.object({
  action: z.literal("LEGAL_PUBLISH"),
  type: z.enum(["RULES", "TERMS", "PRIVACY", "RIOT_DISCLAIMER"]),
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(20).max(100_000),
  effectiveAt: z.iso.datetime({ offset: true }),
  reason,
  confirmation,
  idempotencyKey,
});

const exportCreateSchema = z
  .object({
    action: z.literal("EXPORT_CREATE"),
    type: z.enum([
      "PARTICIPANTS",
      "MATCHES",
      "SCORE_LEDGER",
      "MISSION_LEDGER",
      "STANDINGS",
      "FULL_ARCHIVE",
    ]),
    format: z.enum(["CSV", "JSON"]),
    weekId: uuid.optional(),
    reason,
    idempotencyKey,
  })
  .superRefine((value, context) => {
    if (value.type === "FULL_ARCHIVE" && value.format !== "JSON") {
      context.addIssue({
        code: "custom",
        path: ["format"],
        message: "전체 archive는 JSON 형식만 지원합니다.",
      });
    }
  });

const featureFlagUpdateSchema = z.object({
  action: z.literal("FEATURE_FLAG_UPDATE"),
  key: z.string().trim().min(2).max(128),
  enabled: z.boolean(),
  reason,
  confirmation,
  idempotencyKey,
});

const outboxRetrySchema = z.object({
  action: z.literal("OUTBOX_RETRY"),
  targetId: uuid,
  reason,
  idempotencyKey,
});

export const adminOperationSchema = z.discriminatedUnion("action", [
  userRoleUpdateSchema,
  userStatusUpdateSchema,
  participantStatusUpdateSchema,
  seasonCreateSchema,
  seasonActionSchema,
  missionCloneSchema,
  missionActiveUpdateSchema,
  missionCorrectionSchema,
  baselineArchiveSchema,
  announcementCreateSchema,
  legalPublishSchema,
  exportCreateSchema,
  featureFlagUpdateSchema,
  outboxRetrySchema,
]);

export type AdminOperationInput = z.infer<typeof adminOperationSchema>;

export const adminListQuerySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.string().trim().max(64).catch(""),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(20),
});

export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

export function adminOperationFieldErrors(error: z.ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "request");
    (fields[field] ??= []).push(issue.message);
  }
  return fields;
}
