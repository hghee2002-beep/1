import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublishedLegalDocument } from "@/components/legal/published-legal-document";
import { SeasonStatus } from "@/generated/prisma/client";
import {
  PUBLIC_RULES_SEASON_STATUSES,
  selectPublicRulesSeason,
} from "@/server/dashboard/rules";

describe("public rules selection", () => {
  it("selects a scheduled season before a completed fallback", () => {
    const selected = selectPublicRulesSeason([
      {
        id: "completed",
        status: SeasonStatus.COMPLETED,
        startAt: new Date("2026-07-01T00:00:00.000Z"),
      },
      {
        id: "scheduled",
        status: SeasonStatus.SCHEDULED,
        startAt: new Date("2026-09-01T00:00:00.000Z"),
      },
    ]);

    expect(PUBLIC_RULES_SEASON_STATUSES).toContain(SeasonStatus.SCHEDULED);
    expect(selected?.id).toBe("scheduled");
  });

  it("keeps an active season authoritative over a future scheduled season", () => {
    const selected = selectPublicRulesSeason([
      {
        id: "scheduled",
        status: SeasonStatus.SCHEDULED,
        startAt: new Date("2026-09-01T00:00:00.000Z"),
      },
      {
        id: "active",
        status: SeasonStatus.ACTIVE,
        startAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    ]);

    expect(selected?.id).toBe("active");
  });
});

describe("published legal document", () => {
  it("shows an explicit unpublished state instead of invented legal copy", () => {
    render(<PublishedLegalDocument label="이용약관" document={null} />);

    expect(screen.getByText("이용약관 미게시")).toBeVisible();
    expect(
      screen.getByText(/효력이 있는 문서를 게시하기 전에는/u),
    ).toBeVisible();
    expect(
      screen.queryByText(/회원가입 정보와 Riot ID/u),
    ).not.toBeInTheDocument();
  });

  it("renders the published title, body, version, and effective date", () => {
    render(
      <PublishedLegalDocument
        label="이용약관"
        document={{
          title: "운영 이용약관",
          body: "게시된 약관 본문",
          version: 3,
          effectiveAtLabel: "2026. 8. 5. 09:00",
        }}
      />,
    );

    expect(screen.getByText("운영 이용약관")).toBeVisible();
    expect(screen.getByText("게시된 약관 본문")).toBeVisible();
    expect(screen.getByText("문서 v3 · 시행 2026. 8. 5. 09:00")).toBeVisible();
  });
});
