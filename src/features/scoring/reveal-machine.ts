export type PointRevealState =
  | "idle"
  | "requesting"
  | "sealLocked"
  | "signalScan"
  | "instability"
  | "finalApproach"
  | "revealed"
  | "error"
  | "reducedMotionReveal";

export const POINT_REVEAL_CANDIDATES = [17, 18, 19, 20, 21, 22, 23] as const;

export const POINT_REVEAL_TIMING = Object.freeze({
  skipAfterMs: 1_500,
  sealLockedUntilMs: 550,
  signalScanUntilMs: 1_850,
  instabilityUntilMs: 3_150,
  finalApproachUntilMs: 4_800,
  reducedMotionUntilMs: 400,
  candidateTickMs: 180,
});

export function revealStateAt(
  elapsedMs: number,
  reducedMotion: boolean,
): PointRevealState {
  const elapsed = Math.max(0, elapsedMs);
  if (reducedMotion) {
    return elapsed < POINT_REVEAL_TIMING.reducedMotionUntilMs
      ? "reducedMotionReveal"
      : "revealed";
  }
  if (elapsed < POINT_REVEAL_TIMING.sealLockedUntilMs) return "sealLocked";
  if (elapsed < POINT_REVEAL_TIMING.signalScanUntilMs) return "signalScan";
  if (elapsed < POINT_REVEAL_TIMING.instabilityUntilMs) return "instability";
  if (elapsed < POINT_REVEAL_TIMING.finalApproachUntilMs) {
    return "finalApproach";
  }
  return "revealed";
}

export function nextRevealTransitionMs(
  state: PointRevealState,
  reducedMotion: boolean,
) {
  if (reducedMotion && state === "reducedMotionReveal") {
    return POINT_REVEAL_TIMING.reducedMotionUntilMs;
  }
  switch (state) {
    case "sealLocked":
      return POINT_REVEAL_TIMING.sealLockedUntilMs;
    case "signalScan":
      return POINT_REVEAL_TIMING.signalScanUntilMs;
    case "instability":
      return POINT_REVEAL_TIMING.instabilityUntilMs;
    case "finalApproach":
      return POINT_REVEAL_TIMING.finalApproachUntilMs;
    default:
      return null;
  }
}

export function isRevealSequenceState(state: PointRevealState) {
  return (
    state === "sealLocked" ||
    state === "signalScan" ||
    state === "instability" ||
    state === "finalApproach" ||
    state === "reducedMotionReveal"
  );
}

export function revealStateLabel(state: PointRevealState) {
  switch (state) {
    case "requesting":
      return "서버 봉인 응답 확인 중";
    case "sealLocked":
      return "봉인 키 정렬";
    case "signalScan":
      return "17~23 신호 대역 스캔";
    case "instability":
      return "commitment 일치 신호 추적";
    case "finalApproach":
      return "최종 값 잠금";
    case "reducedMotionReveal":
      return "봉인 결과 확인";
    case "revealed":
      return "해독 완료";
    case "error":
      return "해독 확인 실패";
    default:
      return "봉인 대기";
  }
}
