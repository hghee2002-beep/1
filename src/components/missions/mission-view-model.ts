export type MissionCardView = {
  code: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  unit: string;
  points: number;
  difficulty: "일반" | "도전" | "고난도";
  source: string;
  state: "진행 중" | "판정 대기" | "완료";
  evidence?: string | undefined;
};

export function missionSourceLabel(sourceType: string) {
  if (sourceType === "MATCH_TIMELINE") return "경기 타임라인";
  if (sourceType === "INTERNAL") return "내부 평가";
  if (sourceType === "DATA_DRAGON") return "패치 정적 데이터";
  if (sourceType === "DERIVED") return "누적 경기 이벤트";
  return "경기 요약";
}

export function missionDifficultyLabel(
  difficulty: string,
): MissionCardView["difficulty"] {
  if (difficulty === "EPIC") return "고난도";
  if (difficulty === "HARD") return "도전";
  return "일반";
}

export function missionUnitLabel(unit: string) {
  const labels: Record<string, string> = {
    win: "승",
    game: "경기",
    kda: "KDA",
    kill: "킬",
    assist: "어시스트",
    death: "데스",
    ratio: "비율",
    damage: "피해",
    damage_per_minute: "피해/분",
    second: "초",
    shield_heal: "회복·보호막",
    cs: "CS",
    cs_per_minute: "CS/분",
    gold: "골드",
    gold_per_minute: "골드/분",
    vision_score: "점",
    ward: "개",
    level: "레벨",
    multikill: "회",
    participation: "회",
    takedown: "회",
    steal: "회",
    dragon: "회",
    completion: "회",
    purchase: "개",
    item: "개",
    champion: "명",
    position: "개",
    award: "회",
  };
  return labels[unit] ?? unit;
}

type MissionAssignmentViewInput = {
  code: string;
  title: string;
  description: string;
  progress: string;
  target: string;
  unit: string;
  points: number;
  difficulty: string;
  sourceType: string;
  state: string;
  evaluation: {
    status: string;
    currentValue: number;
    targetValue: number;
    unit: string;
    reason: string;
  } | null;
};

export function missionAssignmentToCard(
  assignment: MissionAssignmentViewInput,
): MissionCardView {
  const evaluation = assignment.evaluation;
  const state =
    assignment.state === "COMPLETED"
      ? "완료"
      : evaluation?.status === "PENDING_DATA"
        ? "판정 대기"
        : "진행 중";
  return {
    code: assignment.code,
    title: assignment.title,
    description: assignment.description,
    progress: Number(assignment.progress),
    target: Number(assignment.target),
    unit: missionUnitLabel(assignment.unit),
    points: assignment.points,
    difficulty: missionDifficultyLabel(assignment.difficulty),
    source: missionSourceLabel(assignment.sourceType),
    state,
    ...(evaluation
      ? {
          evidence: `${evaluation.currentValue.toLocaleString("ko-KR", { maximumFractionDigits: 3 })} ${missionUnitLabel(evaluation.unit)} / 판정 기준 ${evaluation.targetValue.toLocaleString("ko-KR", { maximumFractionDigits: 3 })} · ${evaluation.reason}`,
        }
      : {}),
  };
}
