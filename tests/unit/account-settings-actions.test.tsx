import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSettingsActions } from "@/components/account/account-settings-actions";

const refresh = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace }),
}));

describe("account settings actions", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the password form and associates server field errors", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "CURRENT_PASSWORD_INVALID",
            message: "현재 비밀번호가 올바르지 않습니다.",
            fields: {
              currentPassword: ["현재 비밀번호가 올바르지 않습니다."],
            },
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    render(<AccountSettingsActions />);

    await user.click(screen.getByRole("button", { name: /비밀번호 변경/u }));
    const panel = screen.getByRole("region", { name: "비밀번호 변경" });
    await user.type(
      within(panel).getByLabelText("현재 비밀번호"),
      "incorrect password",
    );
    await user.type(
      within(panel).getByLabelText("새 비밀번호", { exact: true }),
      "replacement password 2026",
    );
    await user.type(
      within(panel).getByLabelText("새 비밀번호 확인"),
      "replacement password 2026",
    );
    await user.click(
      within(panel).getByRole("button", { name: "비밀번호 변경" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "현재 비밀번호가 올바르지 않습니다.",
    );
    expect(panel.querySelector("#currentPassword")).toHaveAttribute(
      "aria-describedby",
      "currentPassword-error",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/password",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows the refreshed Riot ID and refreshes server-rendered data", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          participantId: "participant-id",
          identity: {
            gameName: "Renamed Account",
            tagLine: "SHIFT",
            profileIconId: 29,
            soloQueue: { tier: "MASTER", rank: "I", leaguePoints: 187 },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    render(
      <AccountSettingsActions
        participant={{ gameName: "OldDisplayName", tagLine: "KR1" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Riot ID 갱신/u }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Renamed Account#SHIFT · MASTER I 187 LP로 갱신했습니다.",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/riot-identity",
      expect.objectContaining({ method: "POST" }),
    );
    expect(refresh).toHaveBeenCalledOnce();
  });
});
