import { z } from "zod";

export const LOGIN_ID_MIN_LENGTH = 4;
export const LOGIN_ID_MAX_LENGTH = 32;
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const LOGIN_ID_PATTERN = /^[a-z0-9._-]+$/u;

export function normalizeLoginIdInput(value: string) {
  return value.normalize("NFKC").trim();
}

export function normalizeLoginId(value: string) {
  return normalizeLoginIdInput(value).toLowerCase();
}

const loginIdField = z
  .string({ error: "로그인 ID를 입력해 주세요." })
  .max(128, { error: "로그인 ID가 너무 깁니다." })
  .superRefine((value, context) => {
    const normalized = normalizeLoginId(value);

    if (
      normalized.length < LOGIN_ID_MIN_LENGTH ||
      normalized.length > LOGIN_ID_MAX_LENGTH
    ) {
      context.addIssue({
        code: "custom",
        message: `로그인 ID는 ${LOGIN_ID_MIN_LENGTH}~${LOGIN_ID_MAX_LENGTH}자여야 합니다.`,
      });
    }

    if (!LOGIN_ID_PATTERN.test(normalized)) {
      context.addIssue({
        code: "custom",
        message: "영문 소문자, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.",
      });
    }
  });

const passwordField = z
  .string({ error: "비밀번호를 입력해 주세요." })
  .min(PASSWORD_MIN_LENGTH, {
    error: `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    error: `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하여야 합니다.`,
  })
  .refine((value) => !value.includes("\u0000"), {
    error: "비밀번호에 사용할 수 없는 문자가 포함되어 있습니다.",
  })
  .refine((value) => value.trim().length > 0, {
    error: "공백으로만 된 비밀번호는 사용할 수 없습니다.",
  });

export const signupInputSchema = z
  .object({
    loginId: loginIdField,
    displayName: z
      .string({ error: "표시 이름을 입력해 주세요." })
      .transform((value) => value.normalize("NFKC").trim())
      .pipe(
        z
          .string()
          .min(2, { error: "표시 이름은 2자 이상이어야 합니다." })
          .max(40, { error: "표시 이름은 40자 이하여야 합니다." }),
      ),
    password: passwordField,
    passwordConfirm: z.string({ error: "비밀번호를 한 번 더 입력해 주세요." }),
  })
  .superRefine((value, context) => {
    if (value.password !== value.passwordConfirm) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirm"],
        message: "비밀번호가 일치하지 않습니다.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    loginId: normalizeLoginIdInput(value.loginId),
    loginIdNormalized: normalizeLoginId(value.loginId),
  }));

export const loginInputSchema = z
  .object({
    loginId: loginIdField,
    password: z
      .string({ error: "비밀번호를 입력해 주세요." })
      .max(PASSWORD_MAX_LENGTH, {
        error: "로그인 ID 또는 비밀번호가 올바르지 않습니다.",
      }),
    rememberMe: z.boolean().default(false),
    redirectTo: z.string().max(2_048).optional(),
  })
  .transform((value) => ({
    ...value,
    loginId: normalizeLoginIdInput(value.loginId),
    loginIdNormalized: normalizeLoginId(value.loginId),
  }));

export const changePasswordInputSchema = z
  .object({
    currentPassword: z
      .string({ error: "현재 비밀번호를 입력해 주세요." })
      .min(1, { error: "현재 비밀번호를 입력해 주세요." })
      .max(PASSWORD_MAX_LENGTH, {
        error: "현재 비밀번호가 올바르지 않습니다.",
      }),
    newPassword: passwordField,
    newPasswordConfirm: z.string({
      error: "새 비밀번호를 한 번 더 입력해 주세요.",
    }),
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.newPasswordConfirm) {
      context.addIssue({
        code: "custom",
        path: ["newPasswordConfirm"],
        message: "새 비밀번호가 일치하지 않습니다.",
      });
    }
    if (value.currentPassword === value.newPassword) {
      context.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "현재 비밀번호와 다른 비밀번호를 사용해 주세요.",
      });
    }
  });

export type SignupInput = z.infer<typeof signupInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

export function zodFieldErrors(error: z.ZodError) {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    const current = fields[field] ?? [];
    if (!current.includes(issue.message)) current.push(issue.message);
    fields[field] = current;
  }

  return fields;
}
