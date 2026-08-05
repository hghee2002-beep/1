import { z } from "zod";

type EnvironmentInput = Record<string, string | undefined>;

const emptyStringToUndefined = (value: unknown) =>
  value === "" ? undefined : value;

const optionalString = z.preprocess(
  emptyStringToUndefined,
  z.string().min(1).optional(),
);

const optionalSecret = z.preprocess(
  emptyStringToUndefined,
  z.string().min(32).optional(),
);

const optionalPostgresUrl = z.preprocess(
  emptyStringToUndefined,
  z
    .string()
    .refine(
      (value) =>
        value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "must be a PostgreSQL connection URL",
    )
    .optional(),
);

const booleanString = (defaultValue: "true" | "false") =>
  z
    .enum(["true", "false"])
    .default(defaultValue)
    .transform((value) => value === "true");

const integerString = (
  minimum: number,
  maximum: number,
  defaultValue: number,
) => z.coerce.number().int().min(minimum).max(maximum).default(defaultValue);

const serverEnvironmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z
      .string()
      .refine(
        (value) =>
          value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "must be a PostgreSQL connection URL",
      ),
    DIRECT_URL: optionalPostgresUrl,
    AUTH_SECRET: z.string().min(32),
    CRON_SECRET: z.string().min(32),
    POINT_DRAW_SECRET: optionalSecret,
    RIOT_API_KEY: optionalString,
    RIOT_PLATFORM_REGION: z.enum(["KR"]).default("KR"),
    RIOT_REGIONAL_ROUTE: z.enum(["ASIA"]).default("ASIA"),
    MOCK_RIOT_API: booleanString("true"),
    SYNC_MODE: z
      .enum(["MANUAL", "GITHUB_SCHEDULE", "VERCEL_CRON", "WORKER"])
      .default("MANUAL"),
    SYNC_BATCH_SIZE: integerString(1, 20, 5),
    SYNC_OVERLAP_MINUTES: integerString(1, 180, 30),
    SYNC_TIME_BUDGET_MS: integerString(1_000, 60_000, 20_000),
    SYNC_MATCH_PAGE_SIZE: integerString(1, 100, 20),
    SYNC_PARTICIPANT_COOLDOWN_SECONDS: integerString(0, 3_600, 60),
    SYNC_LEASE_SECONDS: integerString(30, 600, 120),
    SYNC_LEASE_RECOVERY_GRACE_SECONDS: integerString(0, 300, 30),
    POINT_MODE: z.enum(["RANDOM_17_23", "FIXED_20"]).default("RANDOM_17_23"),
    AUTO_REVEAL_HOURS: integerString(1, 168, 12),
    ALLOW_DEMO_MVP_REWARDS: booleanString("false"),
    APP_URL: z.url(),
    APP_TIME_ZONE: z.literal("Asia/Seoul"),
  })
  .superRefine((environment, context) => {
    if (!environment.MOCK_RIOT_API && !environment.RIOT_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["RIOT_API_KEY"],
        message: "is required when MOCK_RIOT_API=false",
      });
    }

    if (
      environment.NODE_ENV === "production" &&
      environment.ALLOW_DEMO_MVP_REWARDS
    ) {
      context.addIssue({
        code: "custom",
        path: ["ALLOW_DEMO_MVP_REWARDS"],
        message: "must be false in production",
      });
    }

    if (
      environment.NODE_ENV === "production" &&
      !environment.POINT_DRAW_SECRET
    ) {
      context.addIssue({
        code: "custom",
        path: ["POINT_DRAW_SECRET"],
        message: "is required in production",
      });
    }
  });

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_POLL_INTERVAL_MS: integerString(5_000, 60_000, 20_000),
});

export class EnvironmentValidationError extends Error {
  override readonly name = "EnvironmentValidationError";

  constructor(scope: "server" | "public", fields: readonly string[]) {
    super(
      `Invalid ${scope} environment variables: ${[...fields].sort().join(", ")}`,
    );
  }
}

function issueFields(error: z.ZodError): string[] {
  return [
    ...new Set(error.issues.map((issue) => String(issue.path[0] ?? "unknown"))),
  ];
}

export function parseServerEnv(input: EnvironmentInput) {
  const result = serverEnvironmentSchema.safeParse(input);

  if (!result.success) {
    throw new EnvironmentValidationError("server", issueFields(result.error));
  }

  return Object.freeze(result.data);
}

export function parsePublicEnv(input: EnvironmentInput) {
  const result = publicEnvironmentSchema.safeParse(input);

  if (!result.success) {
    throw new EnvironmentValidationError("public", issueFields(result.error));
  }

  return Object.freeze(result.data);
}

export type ServerEnv = ReturnType<typeof parseServerEnv>;
export type PublicEnv = ReturnType<typeof parsePublicEnv>;
