import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { MatchTable } from "@/components/matches/match-table";
import { MissionCard } from "@/components/missions/mission-card";
import { RiotId } from "@/components/ui/riot-id";
import type { MissionCardView } from "@/components/missions/mission-view-model";
import type { MatchSummary, StandingRow } from "@/server/dashboard/types";

const mission: MissionCardView = {
  code: "M094",
  title: "누적 시야 점수 150",
  description: "활성 이후 시야 점수 150을 누적하세요.",
  progress: 117,
  target: 150,
  unit: "점",
  points: 3,
  difficulty: "도전",
  source: "경기 요약",
  state: "진행 중",
};

const standing: StandingRow = {
  id: "participant-id",
  participantWeekId: "participant-week-id",
  rank: 1,
  previousRank: 2,
  gameName: "NeonVandal",
  tagLine: "KR1",
  realName: null,
  score: 120,
  wins: 18,
  losses: 7,
  tier: "MASTER",
  division: "",
  lp: 186,
  startLpDelta: 20,
  comparisonLpDelta: 7,
  comparisonDate: "2026-08-04",
  currentRankDate: "2026-08-05",
  streak: 5,
  sealed: 1,
  recent: ["W", "W", "L"],
};

const match: MatchSummary = {
  id: "match-id",
  riotMatchId: "KR_TEST_001",
  participantId: "participant-id",
  gameName: "NeonVandal",
  tagLine: "KR1",
  champion: "Ahri",
  position: "MIDDLE",
  role: "MIDDLE",
  result: "승",
  kda: "12 / 2 / 8",
  cs: 245,
  duration: "31:20",
  endedAt: "방금 전",
  endedAtIso: "2026-08-05T00:00:00.000Z",
  point: 23,
  streak: 4,
  invalid: false,
  invalidReason: null,
  award: "MVP",
  details: {
    point: {
      state: "REVEALED",
      signedPoint: 23,
      drawId: "draw-id",
      phase: "FIRST",
      magnitude: 23,
      nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      commitment: "a".repeat(64),
      commitmentVersion: "v1",
      rngVersion: "crypto-rejection-u8-v1",
      pointMode: "RANDOM_17_23",
      generatedAt: "2026-08-04T23:00:00.000Z",
      revealedAt: "2026-08-05T00:00:00.000Z",
      autoRevealed: false,
      rerolled: false,
      verification: "VERIFIED",
      verifier: {
        algorithm: "SHA-256",
        encoding: "length-prefixed UTF-8",
        fields: ["commitmentVersion", "drawId", "magnitude", "nonce"],
        probability: "1/7",
      },
    },
    mvp: {
      award: "MVP",
      totalScore: 1.234,
      teamRank: 1,
      position: "MIDDLE",
      evaluatorVersion: "mvp-v1",
      baseline: {
        name: "MASTER MIDDLE",
        patchFrom: "26.15",
        patchTo: "26.15",
        demoOnly: false,
      },
      groups: [
        {
          key: "DAMAGE",
          label: "전투",
          score: 1.2,
          weight: 0.3,
        },
      ],
    },
    missions: [
      {
        assignmentId: "assignment-id",
        code: "M094",
        title: "누적 시야 점수 150",
        before: 10,
        delta: 20,
        after: 30,
        target: 150,
        unit: "점",
        completed: false,
        correction: false,
        evaluatorVersion: "mission-v1",
      },
    ],
  },
};

describe("static UI primitives", () => {
  it("always renders the Riot ID tagLine", () => {
    render(<RiotId gameName="아주긴소환사이름테스트" tagLine="BOOKS" />);

    expect(screen.getByText("#BOOKS")).toBeVisible();
  });

  it("exposes exact mission progress to assistive technology", () => {
    render(<MissionCard mission={mission} />);

    expect(
      screen.getByRole("progressbar", { name: `${mission.title} 진행도` }),
    ).toHaveAttribute("aria-valuenow", "117");
    expect(screen.getByText("117 / 150 점")).toBeVisible();
  });

  it("keeps conditional streak and award content inside one stable match signal", () => {
    render(<MatchTable rows={[match]} />);

    const row = screen.getByRole("listitem");
    const stableRow = row.querySelector(".match-row");
    const signal = stableRow?.querySelector(".match-signal");
    expect(signal).not.toBeNull();
    expect(signal?.querySelector(".streak")).not.toBeNull();
    expect(signal?.querySelector(".award-badge")).not.toBeNull();
    expect(stableRow?.querySelector(":scope > .match-point")).not.toBeNull();
    expect(stableRow?.querySelector(":scope > .icon-link")).not.toBeNull();
  });

  it("opens normalized match details from the keyboard", async () => {
    const user = userEvent.setup();
    render(<MatchTable rows={[match]} />);

    const button = screen
      .getAllByRole("button", {
        name: `${match.gameName} 경기 상세 펼치기`,
      })
      .at(-1)!;
    button.focus();
    await user.keyboard("{Enter}");

    expect(button).toHaveAttribute("aria-expanded", "true");
    const detail = screen.getByRole("region", {
      name: `${match.gameName} 경기 상세`,
    });
    expect(detail).toBeVisible();
    expect(within(detail).getByText("commitment 검증 완료")).toBeVisible();
    expect(within(detail).getByText(match.details.point.nonce!)).toBeVisible();
    expect(within(detail).getByText("누적 시야 점수 150")).toBeVisible();
  });

  it("expands mobile row details with an explicit accessible control", async () => {
    const user = userEvent.setup();
    const row = standing;

    render(<LeaderboardTable rows={[row]} />);
    const button = screen.getByRole("button", {
      name: `${row.gameName} 부가 정보 펼치기`,
    });
    await user.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(`${row.wins}승 ${row.losses}패 · 승률 72%`),
    ).toBeVisible();
  });
});
