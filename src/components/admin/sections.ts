export const adminSections = {
  dashboard: {
    title: "운영 대시보드",
    description: "활성 시즌과 동기화·정산 상태를 한 화면에서 확인합니다.",
  },
  users: {
    title: "사용자",
    description:
      "역할, 상태, 가입 시각을 조회합니다. 하드 삭제는 제공하지 않습니다.",
  },
  applications: {
    title: "참가 신청",
    description: "Riot ID 검증 결과와 PUUID 중복 경고를 검토합니다.",
  },
  participants: {
    title: "참가자",
    description: "승인 참가자와 동기화 cursor 상태를 조회합니다.",
  },
  seasons: {
    title: "시즌 · 주차",
    description: "Asia/Seoul 기준 일정과 시작 전 체크를 관리합니다.",
  },
  scoring: {
    title: "점수 규칙",
    description: "17~23 균등 확률과 FIXED_20 fallback 상태를 확인합니다.",
  },
  matches: {
    title: "경기 · 동기화",
    description: "SyncRun과 오류를 조회합니다. 원본 삭제는 지원하지 않습니다.",
  },
  draws: {
    title: "포인트 추첨",
    description: "commitment, 공개 상태, 재추첨 원장 연결을 검증합니다.",
  },
  missions: {
    title: "미션",
    description: "정의 버전과 assignment 판정 상태를 확인합니다.",
  },
  "mvp-baselines": {
    title: "MVP/ACE 기준",
    description: "게시된 기준 버전과 DEMO_ONLY 차단 상태를 확인합니다.",
  },
  content: {
    title: "공지 · 법적 문서",
    description: "게시 버전과 시행일을 관리합니다.",
  },
  "audit-exports": {
    title: "감사 · 내보내기",
    description: "관리자 작업과 안전한 export 이력을 조회합니다.",
  },
  system: {
    title: "시스템",
    description: "비밀값 자체가 아닌 설정 여부와 운영 상태만 표시합니다.",
  },
} as const;

export type AdminSectionKey = keyof typeof adminSections;
