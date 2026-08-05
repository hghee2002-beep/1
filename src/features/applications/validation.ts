import { z } from "zod";

import {
  RIOT_GAME_NAME_MAX_LENGTH,
  RIOT_TAG_LINE_MAX_LENGTH,
} from "@/features/riot/identity";

export const PARTICIPANT_POSITIONS = [
  "TOP",
  "JUNGLE",
  "MIDDLE",
  "BOTTOM",
  "UTILITY",
] as const;

const riotIdentityFields = {
  gameName: z
    .string({ error: "게임 이름을 입력해 주세요." })
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, { error: "게임 이름을 입력해 주세요." })
        .max(RIOT_GAME_NAME_MAX_LENGTH, {
          error: `게임 이름은 ${RIOT_GAME_NAME_MAX_LENGTH}자 이하여야 합니다.`,
        })
        .refine((value) => !value.includes("#"), {
          error: "게임 이름에는 #을 입력하지 마세요.",
        }),
    ),
  tagLine: z
    .string({ error: "태그라인을 입력해 주세요." })
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(1, { error: "태그라인을 입력해 주세요." })
        .max(RIOT_TAG_LINE_MAX_LENGTH, {
          error: `태그라인은 ${RIOT_TAG_LINE_MAX_LENGTH}자 이하여야 합니다.`,
        })
        .refine((value) => !value.includes("#"), {
          error: "태그라인에는 #을 입력하지 마세요.",
        }),
    ),
};

const optionalPosition = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.enum(PARTICIPANT_POSITIONS).optional(),
);

export const verifyRiotIdentityInputSchema = z.object(riotIdentityFields);

export const submitApplicationInputSchema = z
  .object({
    ...riotIdentityFields,
    primaryPosition: optionalPosition,
    secondaryPosition: optionalPosition,
    realNamePublic: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (
      value.primaryPosition &&
      value.secondaryPosition &&
      value.primaryPosition === value.secondaryPosition
    ) {
      context.addIssue({
        code: "custom",
        path: ["secondaryPosition"],
        message: "부 포지션은 주 포지션과 다르게 선택해 주세요.",
      });
    }
  });

export const reviewApplicationInputSchema = z.object({
  reason: z
    .string({ error: "관리자 사유를 입력해 주세요." })
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(5, { error: "관리자 사유는 5자 이상 입력해 주세요." })
        .max(500, { error: "관리자 사유는 500자 이하여야 합니다." }),
    ),
  acknowledgeLateJoin: z.boolean().default(false),
});

export const reverifyApplicationInputSchema = z.object({
  reason: z
    .string({ error: "재검증 사유를 입력해 주세요." })
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(5, { error: "재검증 사유는 5자 이상 입력해 주세요." })
        .max(500, { error: "재검증 사유는 500자 이하여야 합니다." }),
    ),
});

export type SubmitApplicationInput = z.infer<
  typeof submitApplicationInputSchema
>;
export type ReviewApplicationInput = z.infer<
  typeof reviewApplicationInputSchema
>;

export function applicationFieldErrors(error: z.ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    const current = fields[field] ?? [];
    if (!current.includes(issue.message)) current.push(issue.message);
    fields[field] = current;
  }
  return fields;
}
