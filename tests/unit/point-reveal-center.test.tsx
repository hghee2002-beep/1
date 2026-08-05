import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { DrawState, Position } from "@/generated/prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PointRevealCenter } from "@/components/draw/point-reveal-center";
import type {
  RevealedDrawResult,
  SealedDrawListItem,
} from "@/features/scoring/types";

vi.mock("@/features/scoring/commitment-client", () => ({
  verifyBrowserDrawCommitment: vi.fn().mockResolvedValue(true),
}));

const drawId = "00000000-0000-4000-8000-000000000001";
const participantMatchId = "00000000-0000-4000-8000-000000000002";
const commitment =
  "df4ee661da58a1e94368cb4a3c72f74f20e72d020ac3d09e55fbe9dcebc238ef";

function drawFixture(
  overrides: Partial<SealedDrawListItem> = {},
): SealedDrawListItem {
  return {
    id: drawId,
    participantMatchId,
    matchId: "KR_814701",
    state: DrawState.SEALED,
    resultSign: 1,
    win: true,
    championName: "탈리야",
    position: Position.JUNGLE,
    gameStartAt: "2026-08-05T00:00:00.000Z",
    gameEndAt: "2026-08-05T00:31:00.000Z",
    commitment,
    firstCommitment: commitment,
    secondCommitment: null,
    commitmentVersion: "v1",
    rngVersion: "rng-v1",
    pointMode: "RANDOM_17_23",
    revealedAt: null,
    autoRevealed: false,
    autoRevealAt: "2026-08-05T12:31:00.000Z",
    rerollEligible: true,
    rerollUsed: false,
    rerollEntitlementSource: "MVP",
    rerollReason: "MVP",
    rerollGrantedAt: "2026-08-05T01:00:00.000Z",
    rerollExpiresAt: "2026-08-06T00:00:00.000Z",
    weekEndsAt: "2026-08-06T00:00:00.000Z",
    displayMagnitude: null,
    signedDelta: null,
    firstSignedDelta: null,
    secondSignedDelta: null,
    rerollAdjustment: null,
    currentScore: 123,
    currentRank: 2,
    ...overrides,
  };
}

function revealedResult(
  overrides: Partial<RevealedDrawResult> = {},
): RevealedDrawResult {
  return {
    id: drawId,
    participantMatchId,
    phase: "FIRST",
    state: DrawState.REVEALED,
    resultSign: 1,
    displayMagnitude: 23,
    signedDelta: 23,
    nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    commitment,
    commitmentVersion: "v1",
    rngVersion: "rng-v1",
    pointMode: "RANDOM_17_23",
    revealedAt: "2026-08-05T01:00:00.000Z",
    verifier: {
      algorithm: "SHA-256",
      encoding: "uint32be-length-prefixed UTF-8 fields",
      fields: ["commitmentVersion", "drawId", "magnitude", "nonce"],
      probability: "Each integer from 17 through 23 has probability 1/7.",
    },
    ...overrides,
  };
}

function disclosedDraw(
  overrides: Partial<SealedDrawListItem> = {},
): SealedDrawListItem {
  return drawFixture({
    state: DrawState.REVEALED,
    revealedAt: "2026-08-05T01:00:00.000Z",
    displayMagnitude: 23,
    signedDelta: 23,
    firstSignedDelta: 23,
    currentScore: 146,
    ...overrides,
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockMotion(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: reduced,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

async function settlePromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function beginReveal() {
  fireEvent.click(screen.getByRole("button", { name: "결과 확인" }));
  fireEvent.click(screen.getByRole("button", { name: "봉인 해제 시작" }));
  await settlePromises();
}

describe("point reveal action center", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T01:00:00.000Z"));
    mockMotion(false);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("advances through timed states without exposing the server value early", async () => {
    const finalDraw = disclosedDraw();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ ok: true, result: revealedResult() }),
        )
        .mockResolvedValueOnce(jsonResponse({ ok: true, draws: [finalDraw] })),
    );
    render(<PointRevealCenter initialDraws={[drawFixture()]} />);

    await beginReveal();
    expect(screen.getByText("봉인 키 정렬")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: /\+23\s*PTS/u }),
    ).not.toBeInTheDocument();

    await act(async () => vi.advanceTimersByTime(550));
    expect(screen.getByText("17~23 신호 대역 스캔")).toBeVisible();
    await act(async () => vi.advanceTimersByTime(1_300));
    expect(screen.getByText("commitment 일치 신호 추적")).toBeVisible();
    await act(async () => vi.advanceTimersByTime(1_300));
    expect(screen.getByText("최종 값 잠금")).toBeVisible();
    await act(async () => vi.advanceTimersByTime(1_650));

    expect(screen.getByRole("heading", { name: /\+23\s*PTS/u })).toBeVisible();
    expect(screen.getByText("브라우저 commitment 일치")).toBeVisible();
  });

  it("describes FIXED_20 as a fixed 100% result without random 1-of-7 wording", () => {
    render(
      <PointRevealCenter
        initialDraws={[
          drawFixture({
            pointMode: "FIXED_20",
            rngVersion: "fixed-20-v1",
          }),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "결과 확인" }));
    expect(
      screen.getByText("FIXED_20 모드에서 20점 확률은 100%"),
    ).toBeVisible();
    expect(screen.queryByText("17~23 각 값의 확률은 1/7")).toBeNull();
  });

  it("unlocks skip only after 1.5 seconds", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ ok: true, result: revealedResult() }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ ok: true, draws: [disclosedDraw()] }),
        ),
    );
    render(<PointRevealCenter initialDraws={[drawFixture()]} />);
    await beginReveal();

    const skip = screen.getByRole("button", { name: "연출 건너뛰기" });
    expect(skip).toBeDisabled();
    expect(skip).toHaveAccessibleDescription(
      "봉인 해제 시작 1.5초 뒤에 건너뛸 수 있습니다.",
    );
    await act(async () => vi.advanceTimersByTime(1_499));
    expect(skip).toBeDisabled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(skip).toBeEnabled();
    fireEvent.click(skip);
    expect(screen.getByRole("heading", { name: /\+23\s*PTS/u })).toBeVisible();
  });

  it("uses the 0.4 second reduced-motion reveal", async () => {
    mockMotion(true);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ ok: true, result: revealedResult() }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ ok: true, draws: [disclosedDraw()] }),
        ),
    );
    render(<PointRevealCenter initialDraws={[drawFixture()]} />);
    await settlePromises();
    await beginReveal();

    expect(screen.getByText("봉인 결과 확인")).toBeVisible();
    await act(async () => vi.advanceTimersByTime(399));
    expect(
      screen.queryByRole("heading", { name: /\+23\s*PTS/u }),
    ).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(1));
    expect(screen.getByRole("heading", { name: /\+23\s*PTS/u })).toBeVisible();
  });

  it("keeps the value hidden during a slow response and enables skip after it arrives", async () => {
    let resolveReveal: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<Response>((resolve) => {
              resolveReveal = resolve;
            }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ ok: true, draws: [disclosedDraw()] }),
        ),
    );
    render(<PointRevealCenter initialDraws={[drawFixture()]} />);
    fireEvent.click(screen.getByRole("button", { name: "결과 확인" }));
    fireEvent.click(screen.getByRole("button", { name: "봉인 해제 시작" }));
    await act(async () => vi.advanceTimersByTime(2_000));

    expect(
      screen.getByRole("dialog", { name: "랭크 신호를 해독하고 있습니다." }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: /\+23\s*PTS/u }),
    ).not.toBeInTheDocument();
    await act(async () => {
      resolveReveal?.(jsonResponse({ ok: true, result: revealedResult() }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await settlePromises();

    const skip = screen.getByRole("button", { name: "연출 건너뛰기" });
    expect(skip).toBeEnabled();
    fireEvent.click(skip);
    expect(screen.getByRole("heading", { name: /\+23\s*PTS/u })).toBeVisible();
  });

  it("keeps a failed request retryable and restores the same server result", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError("offline"))
        .mockResolvedValueOnce(
          jsonResponse({ ok: true, result: revealedResult() }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ ok: true, draws: [disclosedDraw()] }),
        ),
    );
    render(<PointRevealCenter initialDraws={[drawFixture()]} />);
    await beginReveal();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
    );
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await settlePromises();
    await act(async () => vi.advanceTimersByTime(550));
    await act(async () => vi.advanceTimersByTime(1_300));
    await act(async () => vi.advanceTimersByTime(1_300));
    await act(async () => vi.advanceTimersByTime(1_650));
    expect(screen.getByRole("heading", { name: /\+23\s*PTS/u })).toBeVisible();
  });

  it("restores a disclosed result after component unmount and remount", () => {
    const first = render(<PointRevealCenter initialDraws={[drawFixture()]} />);
    first.unmount();
    render(<PointRevealCenter initialDraws={[disclosedDraw()]} />);
    fireEvent.click(screen.getByRole("button", { name: "결과 보기" }));
    expect(screen.getByRole("heading", { name: /\+23\s*PTS/u })).toBeVisible();
  });

  it("repeats reveal idempotently to re-verify an existing result", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({ ok: true, result: revealedResult() }),
        ),
    );
    render(
      <PointRevealCenter
        initialDraws={[disclosedDraw({ rerollEligible: false })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "결과 보기" }));
    fireEvent.click(
      screen.getByRole("button", { name: "검증 정보 다시 확인" }),
    );
    await settlePromises();

    expect(screen.getByText("브라우저 commitment 일치")).toBeVisible();
    expect(screen.getByText(/nonce/u)).toBeVisible();
  });

  it("does not render a mismatched response as the final result", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse({
            ok: true,
            result: revealedResult({ signedDelta: 22 }),
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ ok: true, draws: [disclosedDraw()] }),
        ),
    );
    render(<PointRevealCenter initialDraws={[drawFixture()]} />);
    await beginReveal();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "서버 결과와 commitment가 일치하지 않아 숫자를 표시하지 않았습니다.",
    );
    expect(
      screen.queryByRole("heading", { name: /\+23\s*PTS/u }),
    ).not.toBeInTheDocument();
  });

  it("requires irreversible reroll confirmation and restores a concurrent SECOND result", async () => {
    const first = disclosedDraw({ rerollEligible: true });
    const rerolled = disclosedDraw({
      state: DrawState.REROLLED,
      commitment: "b".repeat(64),
      secondCommitment: "b".repeat(64),
      rerollEligible: false,
      rerollUsed: true,
      displayMagnitude: 17,
      signedDelta: 17,
      firstSignedDelta: 23,
      secondSignedDelta: 17,
      rerollAdjustment: -6,
      currentScore: 140,
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(
            {
              ok: false,
              error: {
                code: "REROLL_ALREADY_USED",
                message: "다른 요청에서 재추첨권을 먼저 사용했습니다.",
              },
            },
            409,
          ),
        )
        .mockResolvedValueOnce(jsonResponse({ ok: true, draws: [rerolled] })),
    );
    render(<PointRevealCenter initialDraws={[first]} />);
    fireEvent.click(screen.getByRole("button", { name: "결과 보기" }));
    fireEvent.click(
      screen.getByRole("button", { name: "MVP 재추첨 규칙 확인" }),
    );

    const confirmAction = screen.getByRole("button", {
      name: "SECOND 결과 확정",
    });
    expect(confirmAction).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirmAction).toBeEnabled();
    fireEvent.click(confirmAction);
    await settlePromises();

    expect(screen.getByText("SECOND · 최종")).toBeVisible();
    expect(screen.getByText("-6")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /재추첨 규칙 확인/u }),
    ).not.toBeInTheDocument();
  });
});
