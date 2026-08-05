import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import {
  MVP_METRIC_KEYS,
  MVP_POSITIONS,
  MVP_TIER_BUCKETS,
} from "@/domain/mvp/contract";
import {
  canonicalBaselinePayload,
  validateBaselineImport,
  type ValidatedBaselinePayload,
} from "@/domain/mvp/baseline";

function checksum(payload: ValidatedBaselinePayload) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalBaselinePayload(payload)))
    .digest("hex");
}

function payload() {
  return {
    metadata: {
      name: "baseline-26.15-v1",
      sourceDescription: "Verified external sample maintained by the operator",
      patchFrom: "26.14",
      patchTo: "26.15",
      collectedAt: "2026-08-05T00:00:00.000Z",
      demoOnly: false,
    },
    metrics: MVP_TIER_BUCKETS.flatMap((tierBucket) =>
      MVP_POSITIONS.flatMap((position) =>
        MVP_METRIC_KEYS.map((metricKey, index) => ({
          tierBucket,
          position,
          metricKey,
          mean: index + 1,
          stdDev: 1,
          sampleSize: 100,
          lowerBound: 0,
          upperBound: 10_000,
        })),
      ),
    ),
  };
}

describe("MVP baseline import", () => {
  it("accepts complete JSON and produces deterministic canonical data", () => {
    const first = validateBaselineImport({
      format: "JSON",
      content: payload(),
    });
    const reversed = payload();
    reversed.metrics.reverse();
    const second = validateBaselineImport({
      format: "JSON",
      content: reversed,
    });
    expect(first).toMatchObject({
      valid: true,
      errorCount: 0,
      rowCount: 320,
      requiredRowCount: 320,
    });
    expect(first.payload).not.toBeNull();
    expect(second.payload).not.toBeNull();
    if (!first.payload || !second.payload) throw new Error("expected payload");
    expect(checksum(first.payload)).toBe(checksum(second.payload));
  });

  it("blocks stddev zero, insufficient samples, duplicates, and missing metrics", () => {
    const invalid = payload();
    const first = invalid.metrics[0];
    if (!first) throw new Error("fixture missing metric");
    first.stdDev = 0;
    first.sampleSize = 29;
    invalid.metrics.push({ ...first });
    const report = validateBaselineImport({ format: "JSON", content: invalid });
    expect(report.valid).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "STDDEV_NON_POSITIVE",
        "SAMPLE_TOO_SMALL",
        "METRIC_DUPLICATE",
      ]),
    );

    const missing = payload();
    missing.metrics.pop();
    const missingReport = validateBaselineImport({
      format: "JSON",
      content: missing,
    });
    expect(
      missingReport.issues.some((issue) => issue.code === "METRIC_MISSING"),
    ).toBe(true);
  });

  it("parses complete CSV and marks demo fixtures with a warning", () => {
    const source = payload();
    source.metadata.demoOnly = true;
    const header = [
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
    ].join(",");
    const csv = [
      header,
      ...source.metrics.map((metric) =>
        [
          source.metadata.name,
          source.metadata.sourceDescription,
          source.metadata.patchFrom,
          source.metadata.patchTo,
          source.metadata.collectedAt,
          "DEMO_ONLY fixture",
          "true",
          metric.tierBucket,
          metric.position,
          metric.metricKey,
          metric.mean,
          metric.stdDev,
          metric.sampleSize,
          metric.lowerBound,
          metric.upperBound,
        ].join(","),
      ),
    ].join("\n");
    const report = validateBaselineImport({ format: "CSV", content: csv });
    expect(report.valid).toBe(true);
    expect(report.warningCount).toBe(1);
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: "DEMO_ONLY", severity: "WARNING" }),
    );
  });
});
