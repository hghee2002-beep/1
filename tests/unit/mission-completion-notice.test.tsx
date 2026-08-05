import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MissionCompletionNotice } from "@/components/missions/mission-completion-notice";

describe("MissionCompletionNotice", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("combines every unseen completion and remembers dismissal per week", async () => {
    const user = userEvent.setup();
    const completions = [
      { id: "first", title: "첫 미션", points: 2 },
      { id: "second", title: "둘째 미션", points: 5 },
    ];
    const view = render(
      <MissionCompletionNotice weekId="week-1" completions={completions} />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "2개 미션 완료 · +7 PTS",
    );
    expect(screen.getByRole("status")).toHaveTextContent("첫 미션 · 둘째 미션");
    await user.click(
      screen.getByRole("button", { name: "미션 완료 알림 확인" }),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      JSON.parse(
        localStorage.getItem("deluxe-soloq:mission-completions:week-1") ?? "[]",
      ),
    ).toEqual(["first", "second"]);

    view.unmount();
    render(
      <MissionCompletionNotice weekId="week-1" completions={completions} />,
    );
    await act(async () => undefined);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
