import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicationForm } from "@/components/applications/application-form";

const refresh = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
}));

describe("participation application Riot preview", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows official profile and rank art without internal identifiers", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          account: {
            gameName: "Cloud Tempo",
            tagLine: "0217",
            profileIconId: 29,
            summonerLevel: 411,
            soloQueue: { tier: "EMERALD", rank: "II", leaguePoints: 42 },
            source: "RIOT_API",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const user = userEvent.setup();
    render(<ApplicationForm defaults={{}} />);

    await user.type(screen.getByLabelText("게임 이름"), "Cloud Tempo");
    await user.type(screen.getByLabelText("태그라인"), "0217");
    await user.click(screen.getByRole("button", { name: "Riot 계정 검증" }));

    const profile = await screen.findByRole("img", {
      name: "Cloud Tempo 프로필 아이콘",
    });
    const rank = screen.getByRole("img", { name: "EMERALD 티어 엠블럼" });
    expect(profile.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("profileicon%2F29.png"),
    );
    expect(rank.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("emerald.png"),
    );
    expect(screen.getByText("EMERALD II · 42 LP")).toBeVisible();
    expect(screen.getByText("411")).toBeVisible();
    expect(screen.queryByText("PUUID")).not.toBeInTheDocument();
    expect(screen.queryByText(/서버 전용|마스킹/u)).not.toBeInTheDocument();
  });
});
