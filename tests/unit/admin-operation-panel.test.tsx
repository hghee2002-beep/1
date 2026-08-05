import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminOperationPanel } from "@/components/admin/admin-operation-panel";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("AdminOperationPanel", () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("disables submission while the first mutation is pending", async () => {
    let resolveRequest: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminOperationPanel section="announcement" rows={[]} />);

    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "운영 공지" },
    });
    fireEvent.change(screen.getByLabelText("본문"), {
      target: { value: "운영 공지 본문입니다." },
    });
    fireEvent.change(screen.getByLabelText("작성·게시 사유"), {
      target: { value: "통합 운영 공지 등록" },
    });

    const button = screen.getByRole("button", { name: "공지 version 저장" });
    const form = button.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    expect(button).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest?.(
        new Response(
          JSON.stringify({ ok: true, result: { id: "announcement-id" } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(button).not.toBeDisabled();
  });

  it("shows server validation errors with their field names", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: false,
            error: {
              message: "입력을 확인해 주세요.",
              fields: { reason: ["사유는 5자 이상이어야 합니다."] },
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    render(<AdminOperationPanel section="announcement" rows={[]} />);

    fireEvent.submit(
      screen
        .getByRole("button", { name: "공지 version 저장" })
        .closest("form")!,
    );

    await expect(screen.findByRole("status")).resolves.toHaveTextContent(
      "reason: 사유는 5자 이상이어야 합니다.",
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});
