"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  History,
  LockKeyhole,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { StatusBadge } from "@/components/system/status-badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { verifyBrowserDrawCommitment } from "@/features/scoring/commitment-client";
import {
  isRevealSequenceState,
  nextRevealTransitionMs,
  POINT_REVEAL_CANDIDATES,
  POINT_REVEAL_TIMING,
  revealStateAt,
  revealStateLabel,
  type PointRevealState,
} from "@/features/scoring/reveal-machine";
import type {
  RevealedDrawResult,
  SealedDrawListItem,
} from "@/features/scoring/types";

const KST_DATE_TIME = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

const POSITION_LABEL: Record<string, string> = {
  TOP: "탑",
  JUNGLE: "정글",
  MIDDLE: "미드",
  BOTTOM: "원거리",
  UTILITY: "서포터",
};

type RequestKind = "reveal" | "reroll";
type VerificationState = "none" | "verified" | "server-verified";
type DialogMode = "result" | "reroll-confirm";

type ApiErrorShape = {
  code: string;
  message: string;
};

class PointRevealRequestError extends Error {
  override readonly name = "PointRevealRequestError";

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function apiError(value: unknown): ApiErrorShape | null {
  if (!isRecord(value) || !isRecord(value.error)) return null;
  const { code, message } = value.error;
  return typeof code === "string" && typeof message === "string"
    ? { code, message }
    : null;
}

function isRevealedDrawResult(value: unknown): value is RevealedDrawResult {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.participantMatchId === "string" &&
    (value.phase === "FIRST" || value.phase === "SECOND") &&
    (value.resultSign === 1 || value.resultSign === -1) &&
    typeof value.displayMagnitude === "number" &&
    typeof value.signedDelta === "number" &&
    typeof value.nonce === "string" &&
    typeof value.commitment === "string" &&
    typeof value.commitmentVersion === "string" &&
    typeof value.rngVersion === "string" &&
    (value.pointMode === "RANDOM_17_23" || value.pointMode === "FIXED_20") &&
    typeof value.revealedAt === "string" &&
    isRecord(value.verifier)
  );
}

function revealedResultFromBody(value: unknown) {
  if (
    !isRecord(value) ||
    value.ok !== true ||
    !isRevealedDrawResult(value.result)
  ) {
    return null;
  }
  return value.result;
}

function drawListFromBody(value: unknown) {
  if (!isRecord(value) || value.ok !== true || !Array.isArray(value.draws)) {
    return null;
  }
  return value.draws as SealedDrawListItem[];
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function compactHash(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function entitlementLabel(draw: SealedDrawListItem) {
  if (draw.rerollEntitlementSource === "MVP") return "MVP";
  if (draw.rerollEntitlementSource === "ACE") return "ACE";
  if (draw.rerollEntitlementSource === "DEMO_ONLY") return "DEMO";
  return draw.win ? "MVP" : "ACE";
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function useDialogFocus(
  open: boolean,
  panelRef: RefObject<HTMLDivElement | null>,
  trigger: HTMLElement | null,
  onClose: () => void,
  canClose: boolean,
) {
  const triggerRef = useRef(trigger);
  const onCloseRef = useRef(onClose);
  const canCloseRef = useRef(canClose);

  useEffect(() => {
    triggerRef.current = trigger;
    onCloseRef.current = onClose;
    canCloseRef.current = canClose;
  }, [canClose, onClose, trigger]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => {
      panel?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    });

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (canCloseRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const controls = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
        ),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) return;
      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      requestAnimationFrame(() => triggerRef.current?.focus());
    };
  }, [open, panelRef]);
}

function PointDrawCard({
  draw,
  onOpen,
}: {
  draw: SealedDrawListItem;
  onOpen: (drawId: string, trigger: HTMLButtonElement) => void;
}) {
  const sealed = draw.state === "SEALED";
  const voided = draw.state === "VOID";
  const resultLabel = draw.win ? "승리" : "패배";
  const stateLabel = voided
    ? "무효"
    : sealed
      ? "SEALED"
      : draw.state === "AUTO_REVEALED"
        ? "AUTO"
        : draw.state === "REROLLED"
          ? "SECOND"
          : "OPEN";

  return (
    <article
      className={`sealed-draw-card ${sealed ? "is-sealed" : "is-disclosed"} ${voided ? "muted-draw" : ""}`}
      role="listitem"
    >
      <div className="sealed-signal" aria-hidden="true">
        {sealed ? (
          <LockKeyhole />
        ) : voided ? (
          <AlertTriangle />
        ) : (
          <ShieldCheck />
        )}
        <span>{stateLabel}</span>
      </div>
      <div className="sealed-draw-summary">
        <span className="section-label">
          {draw.matchId} · {resultLabel}
        </span>
        <h3>
          {draw.championName} ·{" "}
          {draw.position ? POSITION_LABEL[draw.position] : "포지션 확인 중"}
        </h3>
        <p>
          {KST_DATE_TIME.format(new Date(draw.gameEndAt))} · commitment{" "}
          <code>{compactHash(draw.commitment)}</code>
        </p>
        {sealed ? (
          <small className="sealed-disclosure-note">
            점수는 이미 반영됨 ·{" "}
            {KST_DATE_TIME.format(new Date(draw.autoRevealAt))} 자동 공개
          </small>
        ) : null}
      </div>
      <div className="sealed-actions">
        {draw.rerollEligible || draw.rerollUsed ? (
          <span className="award-badge">
            {entitlementLabel(draw)}
            <small>
              {draw.rerollUsed ? "재추첨 사용 완료" : "재추첨 1회 가능"}
            </small>
          </span>
        ) : draw.autoRevealed ? (
          <StatusBadge label="자동 공개" tone="neutral" />
        ) : null}
        {!sealed && draw.signedDelta !== null ? (
          <strong
            className={`sealed-inline-result ${draw.signedDelta > 0 ? "metric-positive" : "metric-negative"}`}
          >
            {formatSigned(draw.signedDelta)} <small>PTS</small>
          </strong>
        ) : null}
        <button
          className={sealed ? "button-primary" : "button-secondary"}
          type="button"
          disabled={voided}
          onClick={(event) => onOpen(draw.id, event.currentTarget)}
        >
          {sealed ? "결과 확인" : voided ? "무효 처리" : "결과 보기"}
          {!voided ? <ChevronRight aria-hidden="true" /> : null}
        </button>
      </div>
    </article>
  );
}

function DecodeSignal({
  state,
  candidateIndex,
  pointMode,
}: {
  state: PointRevealState;
  candidateIndex: number;
  pointMode: SealedDrawListItem["pointMode"];
}) {
  const fixed20 = pointMode === "FIXED_20";
  const candidates = fixed20 ? ([20] as const) : POINT_REVEAL_CANDIDATES;
  return (
    <div className="decode-stage" data-state={state}>
      <div className="decode-grid" aria-hidden="true">
        <i className="decode-scan-line" />
        <ScanLine />
      </div>
      <p className="decode-state-label">
        {fixed20 && state === "signalScan"
          ? "고정 20점 증명 확인"
          : revealStateLabel(state)}
      </p>
      <div className="decode-candidates" aria-hidden="true">
        {candidates.map((candidate, index) => (
          <span
            className={index === candidateIndex ? "is-active" : undefined}
            key={candidate}
          >
            {candidate}
          </span>
        ))}
      </div>
      <p className="decode-explanation">
        {fixed20
          ? "후보를 추첨하는 과정이 아니라 서버에서 확정된 고정 20점 commitment를 검증하고 있습니다."
          : "후보를 새로 뽑는 과정이 아니라 서버에서 확정된 commitment를 복호화하고 있습니다."}
      </p>
    </div>
  );
}

function ResultSummary({
  draw,
  result,
  verification,
  onVerify,
  verifying,
}: {
  draw: SealedDrawListItem;
  result: RevealedDrawResult | null;
  verification: VerificationState;
  onVerify: () => void;
  verifying: boolean;
}) {
  const signedDelta = result?.signedDelta ?? draw.signedDelta;
  const phase =
    result?.phase ?? (draw.state === "REROLLED" ? "SECOND" : "FIRST");
  const magnitude = result?.displayMagnitude ?? draw.displayMagnitude;
  const commitment = result?.commitment ?? draw.commitment;
  const firstSignedDelta = draw.firstSignedDelta;
  const secondSignedDelta =
    result?.phase === "SECOND" ? result.signedDelta : draw.secondSignedDelta;
  const rerollAdjustment =
    firstSignedDelta !== null && secondSignedDelta !== null
      ? secondSignedDelta - firstSignedDelta
      : draw.rerollAdjustment;
  const currentScore =
    result?.phase === "SECOND" &&
    draw.state !== "REROLLED" &&
    rerollAdjustment !== null
      ? draw.currentScore + rerollAdjustment
      : draw.currentScore;

  if (signedDelta === null || magnitude === null) return null;

  return (
    <div className="reveal-result-panel">
      <div className="reveal-result-lock" aria-hidden="true">
        <ShieldCheck />
        <span>LOCKED</span>
      </div>
      <p className="section-label">
        {phase} RESULT · {draw.win ? "WIN" : "LOSS"}
      </p>
      <h2
        className={signedDelta > 0 ? "metric-positive" : "metric-negative"}
        data-reveal-result
        tabIndex={-1}
      >
        {formatSigned(signedDelta)}
        <small> PTS</small>
      </h2>
      <p className="reveal-result-copy">
        {draw.win ? "승리" : "패배"} 결과의 봉인이 해제되었습니다. 최종 크기는{" "}
        {magnitude}점이며 서버 정산값과 같습니다.
      </p>
      <dl className="reveal-result-stats">
        <div>
          <dt>현재 점수</dt>
          <dd>{currentScore.toLocaleString("ko-KR")} PTS</dd>
        </div>
        <div>
          <dt>현재 순위</dt>
          <dd>{draw.currentRank ? `${draw.currentRank}위` : "집계 중"}</dd>
        </div>
        <div>
          <dt>공개 방식</dt>
          <dd>
            {draw.autoRevealed
              ? "자동 공개"
              : phase === "SECOND"
                ? "재추첨 확정"
                : "직접 공개"}
          </dd>
        </div>
      </dl>
      {firstSignedDelta !== null && secondSignedDelta !== null ? (
        <dl className="reroll-comparison" aria-label="재추첨 결과 비교">
          <div>
            <dt>FIRST</dt>
            <dd>{formatSigned(firstSignedDelta)}</dd>
          </div>
          <div>
            <dt>SECOND · 최종</dt>
            <dd>{formatSigned(secondSignedDelta)}</dd>
          </div>
          <div>
            <dt>조정 원장</dt>
            <dd>{formatSigned(rerollAdjustment ?? 0)}</dd>
          </div>
        </dl>
      ) : null}
      <div className="commitment-proof">
        <div>
          {verification === "verified" ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <ShieldCheck aria-hidden="true" />
          )}
          <span>
            <strong>
              {verification === "verified"
                ? "브라우저 commitment 일치"
                : "서버 commitment 검증 완료"}
            </strong>
            <code>{compactHash(commitment)}</code>
          </span>
        </div>
        {result?.nonce ? (
          <>
            <p>
              nonce <code>{compactHash(result.nonce)}</code> ·{" "}
              {result.commitmentVersion} · {result.rngVersion}
            </p>
            <p>
              {result.pointMode === "FIXED_20"
                ? "FIXED_20 · 20점 확률 100%"
                : "RANDOM_17_23 · 17~23 각 값 확률 1/7"}
            </p>
          </>
        ) : null}
        <button
          className="button-secondary"
          type="button"
          disabled={verifying}
          onClick={onVerify}
        >
          <RefreshCw aria-hidden="true" />
          {verifying ? "검증 중" : "검증 정보 다시 확인"}
        </button>
      </div>
    </div>
  );
}

function PointRevealDialog({
  draw,
  trigger,
  onClose,
  onRefresh,
}: {
  draw: SealedDrawListItem;
  trigger: HTMLElement | null;
  onClose: () => void;
  onRefresh: () => Promise<SealedDrawListItem | null>;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const initialDisclosed = draw.state !== "SEALED" && draw.state !== "VOID";
  const [state, setState] = useState<PointRevealState>(
    initialDisclosed ? "revealed" : "idle",
  );
  const [mode, setMode] = useState<DialogMode>("result");
  const [result, setResult] = useState<RevealedDrawResult | null>(null);
  const [requestKind, setRequestKind] = useState<RequestKind>("reveal");
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [verification, setVerification] = useState<VerificationState>("none");
  const [verifiedExisting, setVerifiedExisting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [requestStartedAt, setRequestStartedAt] = useState<number | null>(null);
  const [sequenceStartedAt, setSequenceStartedAt] = useState<number | null>(
    null,
  );
  const [skipReady, setSkipReady] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const requestInFlight = state === "requesting";
  const activePointMode = result?.pointMode ?? draw.pointMode;
  const candidateCount =
    activePointMode === "FIXED_20" ? 1 : POINT_REVEAL_CANDIDATES.length;

  const close = useCallback(() => {
    if (!requestInFlight) onClose();
  }, [onClose, requestInFlight]);

  useDialogFocus(true, panelRef, trigger, close, !requestInFlight);

  useEffect(() => {
    if (requestStartedAt === null || skipReady) return;
    const remaining = Math.max(
      0,
      POINT_REVEAL_TIMING.skipAfterMs - (Date.now() - requestStartedAt),
    );
    const timer = window.setTimeout(() => setSkipReady(true), remaining);
    return () => window.clearTimeout(timer);
  }, [requestStartedAt, skipReady]);

  useEffect(() => {
    if (sequenceStartedAt === null || !isRevealSequenceState(state)) return;
    const elapsed = Date.now() - sequenceStartedAt;
    const nextAt = nextRevealTransitionMs(state, reducedMotion);
    if (nextAt === null) return;
    const timer = window.setTimeout(
      () =>
        setState(revealStateAt(Date.now() - sequenceStartedAt, reducedMotion)),
      Math.max(0, nextAt - elapsed),
    );
    return () => window.clearTimeout(timer);
  }, [reducedMotion, sequenceStartedAt, state]);

  useEffect(() => {
    if (!isRevealSequenceState(state) || reducedMotion) return;
    const timer = window.setInterval(
      () => setCandidateIndex((current) => (current + 1) % candidateCount),
      POINT_REVEAL_TIMING.candidateTickMs,
    );
    return () => window.clearInterval(timer);
  }, [candidateCount, reducedMotion, state]);

  useEffect(() => {
    if (sequenceStartedAt === null || !result) return;
    const duration = reducedMotion
      ? POINT_REVEAL_TIMING.reducedMotionUntilMs
      : POINT_REVEAL_TIMING.finalApproachUntilMs;
    const fallback = window.setTimeout(
      () => setState("revealed"),
      duration + 750,
    );
    return () => window.clearTimeout(fallback);
  }, [reducedMotion, result, sequenceStartedAt]);

  useEffect(() => {
    if (state !== "revealed") return;
    requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("[data-reveal-result]")
        ?.focus();
    });
  }, [state]);

  const verifyResult = useCallback(
    async (nextResult: RevealedDrawResult, kind: RequestKind) => {
      const expectedPhase = kind === "reroll" ? "SECOND" : "FIRST";
      if (
        nextResult.id !== draw.id ||
        nextResult.participantMatchId !== draw.participantMatchId ||
        nextResult.phase !== expectedPhase ||
        nextResult.resultSign !== draw.resultSign ||
        nextResult.signedDelta !==
          nextResult.resultSign * nextResult.displayMagnitude ||
        (kind === "reveal" && nextResult.commitment !== draw.firstCommitment)
      ) {
        return "mismatch" as const;
      }
      try {
        const valid = await verifyBrowserDrawCommitment(
          {
            commitmentVersion: nextResult.commitmentVersion,
            drawId: nextResult.id,
            magnitude: nextResult.displayMagnitude,
            nonce: nextResult.nonce,
          },
          nextResult.commitment,
        );
        return valid ? ("verified" as const) : ("mismatch" as const);
      } catch {
        return "server-verified" as const;
      }
    },
    [draw.firstCommitment, draw.id, draw.participantMatchId, draw.resultSign],
  );

  const requestResult = useCallback(
    async (kind: RequestKind) => {
      setRequestKind(kind);
      setState("requesting");
      setError(null);
      setSkipReady(false);
      setRequestStartedAt(Date.now());
      try {
        const response = await fetch(
          `/api/draws/${draw.id}/${kind === "reveal" ? "reveal" : "reroll"}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(kind === "reroll" ? { confirmed: true } : {}),
          },
        );
        const body: unknown = await response.json();
        if (!response.ok) {
          const failure = apiError(body);
          throw new PointRevealRequestError(
            failure?.code ?? "REQUEST_FAILED",
            failure?.message ?? "봉인 결과를 확인하지 못했습니다.",
          );
        }
        const nextResult = revealedResultFromBody(body);
        if (!nextResult) {
          throw new PointRevealRequestError(
            "INVALID_RESPONSE",
            "서버 응답 형식을 확인하지 못했습니다.",
          );
        }
        const integrity = await verifyResult(nextResult, kind);
        if (integrity === "mismatch") {
          throw new PointRevealRequestError(
            "DRAW_INTEGRITY_FAILED",
            "서버 결과와 commitment가 일치하지 않아 숫자를 표시하지 않았습니다.",
          );
        }
        setResult(nextResult);
        setVerification(integrity);
        setMode("result");
        const startedAt = Date.now();
        setSequenceStartedAt(startedAt);
        setState(revealStateAt(0, reducedMotion));
        void onRefresh();
      } catch (caught) {
        const failure =
          caught instanceof PointRevealRequestError
            ? { code: caught.code, message: caught.message }
            : {
                code: "NETWORK_ERROR",
                message: "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
              };
        setError(failure);
        setState("error");
        if (
          failure.code === "REROLL_ALREADY_USED" ||
          failure.code === "SCORING_CONFLICT"
        ) {
          const latest = await onRefresh();
          if (latest && latest.state !== "SEALED" && latest.state !== "VOID") {
            setMode("result");
            setError(null);
            setState("revealed");
          }
        } else if (failure.code === "DRAW_INTEGRITY_FAILED") {
          void onRefresh();
        }
      }
    },
    [draw.id, onRefresh, reducedMotion, verifyResult],
  );

  const verifyExisting = useCallback(async () => {
    setVerifiedExisting(true);
    setError(null);
    try {
      const response = await fetch(`/api/draws/${draw.id}/reveal`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const failure = apiError(body);
        throw new PointRevealRequestError(
          failure?.code ?? "REQUEST_FAILED",
          failure?.message ?? "검증 정보를 확인하지 못했습니다.",
        );
      }
      const nextResult = revealedResultFromBody(body);
      if (!nextResult) {
        throw new PointRevealRequestError(
          "INVALID_RESPONSE",
          "검증 응답이 올바르지 않습니다.",
        );
      }
      const integrity = await verifyResult(
        nextResult,
        nextResult.phase === "SECOND" ? "reroll" : "reveal",
      );
      if (integrity === "mismatch") {
        throw new PointRevealRequestError(
          "DRAW_INTEGRITY_FAILED",
          "commitment 검증에 실패했습니다. 결과를 사용하지 않았습니다.",
        );
      }
      setResult(nextResult);
      setVerification(integrity);
    } catch (caught) {
      setError(
        caught instanceof PointRevealRequestError
          ? { code: caught.code, message: caught.message }
          : {
              code: "NETWORK_ERROR",
              message: "검증 정보를 불러오지 못했습니다.",
            },
      );
    } finally {
      setVerifiedExisting(false);
    }
  }, [draw.id, verifyResult]);

  const skipDisabled = !skipReady || !result || state === "requesting";
  const skipReason =
    state === "requesting"
      ? "서버에서 확정 결과를 받는 동안에는 건너뛸 수 없습니다."
      : !skipReady
        ? "봉인 해제 시작 1.5초 뒤에 건너뛸 수 있습니다."
        : "건너뛰기를 사용할 수 있습니다.";
  const dialogTitle =
    mode === "reroll-confirm"
      ? "재추첨은 두 번째 결과로 최종 확정됩니다."
      : state === "idle"
        ? "봉인 결과는 이미 정산되었습니다."
        : state === "revealed"
          ? "봉인 결과 해독 완료"
          : state === "error"
            ? "봉인 결과를 안전하게 확인하지 못했습니다."
            : "랭크 신호를 해독하고 있습니다.";

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        className="dialog-panel reveal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draw-dialog-title"
        aria-describedby="draw-dialog-description"
      >
        <button
          className="dialog-close"
          type="button"
          disabled={requestInFlight}
          onClick={close}
          aria-label={
            requestInFlight
              ? "서버 응답 확인 중에는 닫을 수 없음"
              : "결과 대화상자 닫기"
          }
        >
          <X aria-hidden="true" />
        </button>
        <div className="reveal-dialog-header">
          <span className="dialog-icon">
            <CircleGauge aria-hidden="true" />
          </span>
          <div>
            <p className="section-label">RANK SIGNAL DECODE</p>
            <h2 id="draw-dialog-title">{dialogTitle}</h2>
            <p id="draw-dialog-description">
              {draw.matchId} · {draw.championName} ·{" "}
              {draw.win ? "승리" : "패배"}
            </p>
          </div>
        </div>

        {mode === "reroll-confirm" ? (
          <div className="reroll-confirmation">
            <span className="reroll-warning-icon">
              <AlertTriangle aria-hidden="true" />
            </span>
            <p>
              재추첨을 실행하면 <strong>두 번째 결과가 무조건 최종</strong>
              입니다. 더 나빠지거나 첫 결과와 같을 수 있으며, FIRST로 되돌릴 수
              없습니다.
            </p>
            <dl>
              <div>
                <dt>현재 FIRST</dt>
                <dd>
                  {draw.firstSignedDelta === null
                    ? "-"
                    : formatSigned(draw.firstSignedDelta)}{" "}
                  PTS
                </dd>
              </div>
              <div>
                <dt>자격</dt>
                <dd>{entitlementLabel(draw)} · 1회</dd>
              </div>
              <div>
                <dt>사용 기한</dt>
                <dd>
                  {KST_DATE_TIME.format(
                    new Date(draw.rerollExpiresAt ?? draw.weekEndsAt),
                  )}
                </dd>
              </div>
            </dl>
            <label className="reroll-check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                <Check aria-hidden="true" />두 번째 결과가 최종이며 취소할 수
                없음을 확인했습니다.
              </span>
            </label>
            <div className="dialog-actions">
              <button
                className="button-secondary"
                type="button"
                data-autofocus
                onClick={() => setMode("result")}
              >
                돌아가기
              </button>
              <button
                className="button-primary"
                type="button"
                disabled={!confirmed}
                onClick={() => void requestResult("reroll")}
              >
                SECOND 결과 확정
              </button>
            </div>
          </div>
        ) : state === "idle" ? (
          <div className="reveal-intro">
            <p>
              공개 버튼은 결과를 새로 생성하지 않습니다. 경기 처리 시 확정되어
              점수와 순위에 이미 반영된{" "}
              {draw.pointMode === "FIXED_20" ? "고정 20점" : "17~23점"} 값을
              보여줍니다.
            </p>
            <ul>
              <li>
                <CheckCircle2 aria-hidden="true" />
                {draw.pointMode === "FIXED_20"
                  ? "FIXED_20 모드에서 20점 확률은 100%"
                  : "17~23 각 값의 확률은 1/7"}
              </li>
              <li>
                <CheckCircle2 aria-hidden="true" />
                서버 결과와 nonce로 commitment 검증
              </li>
              <li>
                <CheckCircle2 aria-hidden="true" />
                패배는 음수, 승리는 양수로 명확히 표시
              </li>
            </ul>
            <div className="sealed-proof-row">
              <span>COMMITMENT</span>
              <code>{draw.firstCommitment}</code>
            </div>
            <div className="dialog-actions">
              <button
                className="button-secondary"
                type="button"
                onClick={close}
              >
                나중에
              </button>
              <button
                className="button-primary"
                type="button"
                data-autofocus
                onClick={() => void requestResult("reveal")}
              >
                <LockKeyhole aria-hidden="true" />
                봉인 해제 시작
              </button>
            </div>
          </div>
        ) : state === "requesting" ? (
          <div className="decode-requesting" role="status">
            <span className="requesting-mark" aria-hidden="true">
              <RefreshCw />
            </span>
            <strong>{revealStateLabel(state)}</strong>
            <p>
              네트워크 응답을 기다리고 있습니다. 결과는 서버에서 이미 확정되어
              있습니다.
            </p>
          </div>
        ) : isRevealSequenceState(state) ? (
          <>
            <p className="sr-only" role="status">
              봉인 해제 진행 중입니다. 최종 결과가 확정되면 알려드립니다.
            </p>
            <DecodeSignal
              state={state}
              candidateIndex={candidateIndex}
              pointMode={activePointMode}
            />
            <div className="decode-controls">
              <span id="skip-reason">{skipReason}</span>
              <button
                className="button-secondary"
                type="button"
                disabled={skipDisabled}
                aria-describedby="skip-reason"
                onClick={() => setState("revealed")}
              >
                연출 건너뛰기
              </button>
            </div>
          </>
        ) : state === "error" ? (
          <div className="reveal-error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>
                {error?.message ?? "봉인 결과를 확인하지 못했습니다."}
              </strong>
              <code>{error?.code ?? "UNKNOWN_ERROR"}</code>
              <p>
                정산값은 서버에 안전하게 유지됩니다. 다시 요청하면 이미 처리된
                동일 결과를 반환합니다.
              </p>
            </div>
            <div className="dialog-actions">
              <button
                className="button-secondary"
                type="button"
                onClick={() => void onRefresh()}
              >
                최신 상태 불러오기
              </button>
              <button
                className="button-primary"
                type="button"
                data-autofocus
                onClick={() => void requestResult(requestKind)}
              >
                다시 시도
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="sr-only" role="status" aria-live="polite">
              최종 결과 {draw.win ? "플러스" : "마이너스"}{" "}
              {result?.displayMagnitude ?? draw.displayMagnitude}점이
              공개되었습니다.
            </p>
            <ResultSummary
              draw={draw}
              result={result}
              verification={verification}
              onVerify={() => void verifyExisting()}
              verifying={verifiedExisting}
            />
            {error ? (
              <p className="inline-reveal-error" role="alert">
                {error.message}
              </p>
            ) : null}
            <div className="dialog-actions reveal-final-actions">
              <button
                className="button-secondary"
                type="button"
                onClick={close}
              >
                닫기
              </button>
              {draw.rerollEligible && result?.phase !== "SECOND" ? (
                <button
                  className="button-primary"
                  type="button"
                  data-autofocus
                  onClick={() => {
                    setConfirmed(false);
                    setMode("reroll-confirm");
                  }}
                >
                  {entitlementLabel(draw)} 재추첨 규칙 확인
                </button>
              ) : null}
            </div>
          </>
        )}
        {requestInFlight ? (
          <p className="dialog-close-policy">
            서버 응답 확인 중에는 ESC와 바깥 클릭 닫기를 잠시 막습니다. 응답
            후에는 즉시 닫을 수 있습니다.
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function PointRevealCenter({
  initialDraws,
}: {
  initialDraws: SealedDrawListItem[];
}) {
  const [draws, setDraws] = useState(initialDraws);
  const [active, setActive] = useState<{
    drawId: string;
    trigger: HTMLElement | null;
  } | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const activeDraw = active
    ? (draws.find((draw) => draw.id === active.drawId) ?? null)
    : null;
  const sealedCount = draws.filter((draw) => draw.state === "SEALED").length;
  const disclosedCount = draws.filter(
    (draw) => draw.state !== "SEALED" && draw.state !== "VOID",
  ).length;

  const orderedDraws = useMemo(
    () =>
      [...draws].sort((left, right) => {
        if (left.state === "SEALED" && right.state !== "SEALED") return -1;
        if (left.state !== "SEALED" && right.state === "SEALED") return 1;
        return (
          new Date(right.gameStartAt).getTime() -
          new Date(left.gameStartAt).getTime()
        );
      }),
    [draws],
  );

  const refreshDraws = useCallback(async () => {
    try {
      const response = await fetch("/api/draws", { cache: "no-store" });
      const body: unknown = await response.json();
      const nextDraws = drawListFromBody(body);
      if (!response.ok || !nextDraws) {
        const failure = apiError(body);
        throw new Error(
          failure?.message ?? "포인트 결과 목록을 갱신하지 못했습니다.",
        );
      }
      setDraws(nextDraws);
      setListError(null);
      if (!active) return null;
      return nextDraws.find((draw) => draw.id === active.drawId) ?? null;
    } catch (caught) {
      setListError(
        caught instanceof Error ? caught.message : "목록 갱신에 실패했습니다.",
      );
      return null;
    }
  }, [active]);

  return (
    <section id="sealed-results">
      <SectionHeading
        eyebrow="SEALED RESULTS"
        title="봉인 결과 · 점수 이력"
        description="공개 전에도 점수는 이미 순위에 반영됩니다. 공개는 확정된 서버 결과를 해독해 보여주는 단계입니다."
        action={
          <span className="inline-status">
            <History aria-hidden="true" />
            공개 대기 {sealedCount} · 확인 {disclosedCount}
          </span>
        }
      />
      {listError ? (
        <div className="draw-list-error" role="status">
          <AlertTriangle aria-hidden="true" />
          {listError}
          <button type="button" onClick={() => void refreshDraws()}>
            다시 불러오기
          </button>
        </div>
      ) : null}
      {orderedDraws.length ? (
        <div
          className="sealed-list"
          role="list"
          aria-label="포인트 봉인 결과와 공개 이력"
        >
          {orderedDraws.map((draw) => (
            <PointDrawCard
              draw={draw}
              key={draw.id}
              onOpen={(drawId, trigger) => setActive({ drawId, trigger })}
            />
          ))}
        </div>
      ) : (
        <div className="draw-empty-state">
          <ShieldCheck aria-hidden="true" />
          <div>
            <h3>확인할 봉인 결과가 없습니다.</h3>
            <p>
              새로운 인정 경기가 정산되면 이곳에 commitment와 결과 확인 버튼이
              표시됩니다.
            </p>
          </div>
        </div>
      )}
      {activeDraw ? (
        <PointRevealDialog
          key={activeDraw.id}
          draw={activeDraw}
          trigger={active?.trigger ?? null}
          onClose={() => setActive(null)}
          onRefresh={refreshDraws}
        />
      ) : null}
    </section>
  );
}
