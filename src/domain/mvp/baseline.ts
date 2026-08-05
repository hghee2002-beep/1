import { z } from "zod";

import {
  MVP_METRIC_KEYS,
  MVP_MIN_SAMPLE_SIZE,
  MVP_POSITIONS,
  MVP_TIER_BUCKETS,
  isMvpMetricKey,
  isMvpPosition,
  isMvpTierBucket,
  type MvpMetricKey,
  type MvpPosition,
  type MvpTierBucket,
} from "@/domain/mvp/contract";

const metadataSchema = z.object({
  name: z.string().trim().min(3).max(128),
  sourceDescription: z.string().trim().min(3).max(2_000),
  patchFrom: z.string().trim().min(1).max(32),
  patchTo: z.string().trim().min(1).max(32),
  collectedAt: z.iso.datetime({ offset: true }),
  sampleNotes: z.string().trim().max(2_000).optional(),
  demoOnly: z.boolean(),
});

const metricSchema = z.object({
  tierBucket: z.string().trim(),
  position: z.string().trim(),
  metricKey: z.string().trim(),
  mean: z.number().finite(),
  stdDev: z.number().finite(),
  sampleSize: z.number().int().nonnegative(),
  lowerBound: z.number().finite().nullable().optional(),
  upperBound: z.number().finite().nullable().optional(),
});

const jsonPayloadSchema = z.object({
  metadata: metadataSchema,
  metrics: z.array(metricSchema).max(10_000),
});

export type BaselineImportFormat = "CSV" | "JSON";

export type ValidatedBaselineMetric = {
  tierBucket: MvpTierBucket;
  position: MvpPosition;
  metricKey: MvpMetricKey;
  mean: number;
  stdDev: number;
  sampleSize: number;
  lowerBound: number | null;
  upperBound: number | null;
};

export type ValidatedBaselinePayload = {
  metadata: z.infer<typeof metadataSchema>;
  metrics: ValidatedBaselineMetric[];
};

export type BaselineValidationIssue = {
  severity: "ERROR" | "WARNING";
  code: string;
  path: string;
  message: string;
};

export type BaselineCoverage = {
  tierBucket: MvpTierBucket;
  position: MvpPosition;
  present: number;
  required: number;
  missing: MvpMetricKey[];
};

export type BaselineValidationReport = {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  rowCount: number;
  requiredRowCount: number;
  issues: BaselineValidationIssue[];
  coverage: BaselineCoverage[];
  payload: ValidatedBaselinePayload | null;
};

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += character;
  }
  if (quoted) throw new Error("CSV_QUOTE_UNCLOSED");
  row.push(cell);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);
  return rows;
}

const CSV_COLUMNS = [
  "name",
  "sourceDescription",
  "patchFrom",
  "patchTo",
  "collectedAt",
  "sampleNotes",
  "demoOnly",
  "tierBucket",
  "position",
  "metricKey",
  "mean",
  "stdDev",
  "sampleSize",
  "lowerBound",
  "upperBound",
] as const;

function csvBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return value;
}

function csvNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : value;
}

function csvPayload(content: string): unknown {
  const rows = parseCsvRows(content);
  const header = rows[0]?.map((cell) => cell.trim().replace(/^\uFEFF/u, ""));
  if (!header || header.length === 0) throw new Error("CSV_EMPTY");
  const missingHeaders = CSV_COLUMNS.filter(
    (column) => !header.includes(column),
  );
  if (missingHeaders.length > 0) {
    throw new Error(`CSV_HEADERS_MISSING:${missingHeaders.join(",")}`);
  }
  const records = rows
    .slice(1)
    .map((cells) =>
      Object.fromEntries(
        header.map((column, index) => [column, cells[index] ?? ""]),
      ),
    );
  const first = records[0];
  if (!first) throw new Error("CSV_NO_DATA_ROWS");
  return {
    metadata: {
      name: first.name,
      sourceDescription: first.sourceDescription,
      patchFrom: first.patchFrom,
      patchTo: first.patchTo,
      collectedAt: first.collectedAt,
      sampleNotes: first.sampleNotes || undefined,
      demoOnly: csvBoolean(first.demoOnly ?? ""),
    },
    metrics: records.map((record) => ({
      tierBucket: record.tierBucket,
      position: record.position,
      metricKey: record.metricKey,
      mean: csvNumber(record.mean ?? ""),
      stdDev: csvNumber(record.stdDev ?? ""),
      sampleSize: csvNumber(record.sampleSize ?? ""),
      lowerBound: csvNumber(record.lowerBound ?? ""),
      upperBound: csvNumber(record.upperBound ?? ""),
    })),
  };
}

function rawPayload(format: BaselineImportFormat, content: unknown): unknown {
  if (format === "CSV") {
    if (typeof content !== "string") throw new Error("CSV_CONTENT_REQUIRED");
    return csvPayload(content);
  }
  if (typeof content === "string") return JSON.parse(content) as unknown;
  return content;
}

function issueFromZod(
  path: PropertyKey[],
  message: string,
): BaselineValidationIssue {
  return {
    severity: "ERROR",
    code: "SCHEMA_INVALID",
    path: path.map(String).join("."),
    message,
  };
}

export function canonicalBaselinePayload(payload: ValidatedBaselinePayload) {
  const tierOrder = new Map(
    MVP_TIER_BUCKETS.map((tier, index) => [tier, index]),
  );
  const positionOrder = new Map(
    MVP_POSITIONS.map((position, index) => [position, index]),
  );
  const metricOrder = new Map(
    MVP_METRIC_KEYS.map((metric, index) => [metric, index]),
  );
  return {
    metadata: {
      ...payload.metadata,
      sampleNotes: payload.metadata.sampleNotes,
    },
    metrics: [...payload.metrics].sort(
      (left, right) =>
        (tierOrder.get(left.tierBucket) ?? 0) -
          (tierOrder.get(right.tierBucket) ?? 0) ||
        (positionOrder.get(left.position) ?? 0) -
          (positionOrder.get(right.position) ?? 0) ||
        (metricOrder.get(left.metricKey) ?? 0) -
          (metricOrder.get(right.metricKey) ?? 0),
    ),
  };
}

export function validateBaselineImport(input: {
  format: BaselineImportFormat;
  content: unknown;
}): BaselineValidationReport {
  const requiredRowCount =
    MVP_TIER_BUCKETS.length * MVP_POSITIONS.length * MVP_METRIC_KEYS.length;
  let parsedRaw: unknown;
  try {
    parsedRaw = rawPayload(input.format, input.content);
  } catch (error) {
    return {
      valid: false,
      errorCount: 1,
      warningCount: 0,
      rowCount: 0,
      requiredRowCount,
      issues: [
        {
          severity: "ERROR",
          code: "PARSE_FAILED",
          path: "content",
          message:
            error instanceof Error
              ? error.message
              : "입력 파일을 해석할 수 없습니다.",
        },
      ],
      coverage: [],
      payload: null,
    };
  }
  const parsed = jsonPayloadSchema.safeParse(parsedRaw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) =>
      issueFromZod(issue.path, issue.message),
    );
    return {
      valid: false,
      errorCount: issues.length,
      warningCount: 0,
      rowCount:
        typeof parsedRaw === "object" &&
        parsedRaw !== null &&
        "metrics" in parsedRaw &&
        Array.isArray(parsedRaw.metrics)
          ? parsedRaw.metrics.length
          : 0,
      requiredRowCount,
      issues,
      coverage: [],
      payload: null,
    };
  }

  const issues: BaselineValidationIssue[] = [];
  const metrics: ValidatedBaselineMetric[] = [];
  const seen = new Set<string>();
  for (const [index, metric] of parsed.data.metrics.entries()) {
    const path = `metrics.${index}`;
    if (!isMvpTierBucket(metric.tierBucket)) {
      issues.push({
        severity: "ERROR",
        code: "TIER_INVALID",
        path,
        message: "지원하지 않는 tier bucket입니다.",
      });
      continue;
    }
    if (!isMvpPosition(metric.position)) {
      issues.push({
        severity: "ERROR",
        code: "POSITION_INVALID",
        path,
        message: "지원하지 않는 position입니다.",
      });
      continue;
    }
    if (!isMvpMetricKey(metric.metricKey)) {
      issues.push({
        severity: "ERROR",
        code: "METRIC_INVALID",
        path,
        message: "evaluator contract에 없는 metric입니다.",
      });
      continue;
    }
    const key = `${metric.tierBucket}:${metric.position}:${metric.metricKey}`;
    if (seen.has(key)) {
      issues.push({
        severity: "ERROR",
        code: "METRIC_DUPLICATE",
        path,
        message: `중복 metric입니다: ${key}`,
      });
      continue;
    }
    seen.add(key);
    if (metric.stdDev <= 0) {
      issues.push({
        severity: "ERROR",
        code: "STDDEV_NON_POSITIVE",
        path,
        message: "stdDev는 0보다 커야 합니다.",
      });
    }
    if (metric.sampleSize < MVP_MIN_SAMPLE_SIZE) {
      issues.push({
        severity: "ERROR",
        code: "SAMPLE_TOO_SMALL",
        path,
        message: `sampleSize는 최소 ${MVP_MIN_SAMPLE_SIZE}이어야 합니다.`,
      });
    }
    const lowerBound = metric.lowerBound ?? null;
    const upperBound = metric.upperBound ?? null;
    if (lowerBound !== null && upperBound !== null && lowerBound > upperBound) {
      issues.push({
        severity: "ERROR",
        code: "BOUNDS_INVALID",
        path,
        message: "lowerBound는 upperBound보다 클 수 없습니다.",
      });
    }
    metrics.push({
      tierBucket: metric.tierBucket,
      position: metric.position,
      metricKey: metric.metricKey,
      mean: metric.mean,
      stdDev: metric.stdDev,
      sampleSize: metric.sampleSize,
      lowerBound,
      upperBound,
    });
  }

  const coverage: BaselineCoverage[] = [];
  for (const tierBucket of MVP_TIER_BUCKETS) {
    for (const position of MVP_POSITIONS) {
      const missing = MVP_METRIC_KEYS.filter(
        (metricKey) => !seen.has(`${tierBucket}:${position}:${metricKey}`),
      );
      coverage.push({
        tierBucket,
        position,
        present: MVP_METRIC_KEYS.length - missing.length,
        required: MVP_METRIC_KEYS.length,
        missing,
      });
      for (const metricKey of missing) {
        issues.push({
          severity: "ERROR",
          code: "METRIC_MISSING",
          path: `${tierBucket}.${position}.${metricKey}`,
          message: "필수 baseline metric이 없습니다.",
        });
      }
    }
  }
  if (parsed.data.metadata.demoOnly) {
    issues.push({
      severity: "WARNING",
      code: "DEMO_ONLY",
      path: "metadata.demoOnly",
      message: "DEMO_ONLY baseline은 production 재추첨권을 발급하지 않습니다.",
    });
  }
  const errorCount = issues.filter(
    (issue) => issue.severity === "ERROR",
  ).length;
  const warningCount = issues.length - errorCount;
  const payload: ValidatedBaselinePayload = {
    metadata: parsed.data.metadata,
    metrics,
  };
  return {
    valid: errorCount === 0 && metrics.length === requiredRowCount,
    errorCount,
    warningCount,
    rowCount: parsed.data.metrics.length,
    requiredRowCount,
    issues,
    coverage,
    payload: errorCount === 0 ? canonicalBaselinePayload(payload) : null,
  };
}
