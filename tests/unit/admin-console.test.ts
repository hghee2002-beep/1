import { describe, expect, it } from "vitest";

import { encodeCsv, sanitizeExportCell } from "@/features/admin/export";
import {
  buildSeasonReadinessChecklist,
  type SeasonReadinessFacts,
} from "@/features/admin/season-readiness";
import { adminOperationSchema } from "@/features/admin/validation";

const readyFacts: SeasonReadinessFacts = {
  validPeriod: true,
  weekCount: 2,
  contiguousWeeks: true,
  activeParticipants: 20,
  missingStartingSnapshots: 0,
  missingParticipantWeeks: 0,
  activeMissionDefinitions: 100,
  invalidMissionRegistryMappings: 0,
  missingBaselines: 0,
  invalidBaselines: 0,
  incompleteBaselineCoverage: 0,
  demoBaselines: 0,
  publishedLegalTypes: 4,
  otherActiveSeasons: 0,
};

describe("admin console boundaries", () => {
  it("requires a reason, typed confirmation, and UUID idempotency key", () => {
    const parsed = adminOperationSchema.safeParse({
      action: "USER_STATUS_UPDATE",
      targetId: "00000000-0000-4000-8000-000000000001",
      status: "LOCKED",
      reason: "짧음",
      confirmation: "",
      idempotencyKey: "not-a-uuid",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["reason", "confirmation", "idempotencyKey"]),
      );
    }
  });

  it("rejects reversed season dates and CSV full archives", () => {
    expect(
      adminOperationSchema.safeParse({
        action: "SEASON_CREATE_DRAFT",
        name: "테스트 시즌",
        slug: "test-season",
        startAt: "2026-08-12T00:00:00+09:00",
        endAt: "2026-08-11T00:00:00+09:00",
        weekCount: 1,
        scoringMode: "FIXED_20",
        minGameDurationSeconds: 600,
        autoRevealHours: 12,
        rulesVersion: "v1",
        reason: "날짜 검증 테스트",
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
      }).success,
    ).toBe(false);
    expect(
      adminOperationSchema.safeParse({
        action: "EXPORT_CREATE",
        type: "FULL_ARCHIVE",
        format: "CSV",
        reason: "전체 보관본 생성",
        idempotencyKey: "00000000-0000-4000-8000-000000000003",
      }).success,
    ).toBe(false);
  });

  it("turns readiness facts into explicit blockers and warnings", () => {
    expect(
      buildSeasonReadinessChecklist(readyFacts).every(
        (item) => item.status === "OK",
      ),
    ).toBe(true);

    const checklist = buildSeasonReadinessChecklist({
      ...readyFacts,
      activeParticipants: 19,
      missingParticipantWeeks: 3,
      invalidBaselines: 1,
      demoBaselines: 1,
    });
    expect(checklist.find((item) => item.key === "participants")?.status).toBe(
      "BLOCKER",
    );
    expect(
      checklist.find((item) => item.key === "participant-weeks")?.status,
    ).toBe("WARNING");
    expect(checklist.find((item) => item.key === "baselines")?.status).toBe(
      "BLOCKER",
    );
  });

  it("neutralizes spreadsheet formulas and escapes CSV structure", () => {
    expect(sanitizeExportCell('=HYPERLINK("https://bad.test")')).toBe(
      '\'=HYPERLINK("https://bad.test")',
    );
    expect(sanitizeExportCell("+1+1")).toBe("'+1+1");
    expect(sanitizeExportCell("  =1+1")).toBe("'  =1+1");
    expect(sanitizeExportCell("\n@SUM(A1:A2)")).toBe("'\n@SUM(A1:A2)");
    expect(
      encodeCsv([
        ["name", "memo"],
        ["player", 'a,"b"'],
      ]),
    ).toBe('name,memo\r\nplayer,"a,""b"""');
  });
});
