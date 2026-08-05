export type SeasonChecklistItem = {
  key: string;
  label: string;
  status: "OK" | "WARNING" | "BLOCKER";
  detail: string;
};

export type SeasonReadinessFacts = {
  validPeriod: boolean;
  weekCount: number;
  contiguousWeeks: boolean;
  activeParticipants: number;
  missingStartingSnapshots: number;
  missingParticipantWeeks: number;
  activeMissionDefinitions: number;
  invalidMissionRegistryMappings: number;
  missingBaselines: number;
  invalidBaselines: number;
  incompleteBaselineCoverage: number;
  demoBaselines: number;
  publishedLegalTypes: number;
  otherActiveSeasons: number;
};

export function buildSeasonReadinessChecklist(
  facts: SeasonReadinessFacts,
): SeasonChecklistItem[] {
  return [
    {
      key: "period",
      label: "시즌·주차 시간 경계",
      status:
        facts.validPeriod &&
        facts.weekCount >= 1 &&
        facts.weekCount <= 2 &&
        facts.contiguousWeeks
          ? "OK"
          : "BLOCKER",
      detail: `주차 ${facts.weekCount}개 · [startAt, endAt) 연속 경계`,
    },
    {
      key: "participants",
      label: "정책 최소 참가자",
      status: facts.activeParticipants >= 20 ? "OK" : "BLOCKER",
      detail: `${facts.activeParticipants}/20명`,
    },
    {
      key: "rank-snapshots",
      label: "시작 랭크 snapshot",
      status: facts.missingStartingSnapshots === 0 ? "OK" : "BLOCKER",
      detail: `누락 ${facts.missingStartingSnapshots}명`,
    },
    {
      key: "participant-weeks",
      label: "참가자 주차 상태",
      status: facts.missingParticipantWeeks === 0 ? "OK" : "WARNING",
      detail:
        facts.missingParticipantWeeks === 0
          ? "생성 완료"
          : `누락 ${facts.missingParticipantWeeks}개 · start transaction에서 생성`,
    },
    {
      key: "missions",
      label: "M001~M100 registry",
      status:
        facts.activeMissionDefinitions === 100 &&
        facts.invalidMissionRegistryMappings === 0
          ? "OK"
          : "BLOCKER",
      detail: `${facts.activeMissionDefinitions}/100 · mapping 오류 ${facts.invalidMissionRegistryMappings}`,
    },
    {
      key: "baselines",
      label: "유효한 non-demo MVP baseline snapshot",
      status:
        facts.missingBaselines === 0 &&
        facts.invalidBaselines === 0 &&
        facts.incompleteBaselineCoverage === 0 &&
        facts.demoBaselines === 0
          ? "OK"
          : "BLOCKER",
      detail: `미지정 ${facts.missingBaselines}주 · 상태 오류 ${facts.invalidBaselines}주 · coverage 오류 ${facts.incompleteBaselineCoverage}주 · DEMO_ONLY ${facts.demoBaselines}주`,
    },
    {
      key: "legal",
      label: "규칙·약관·개인정보·비공식 고지",
      status: facts.publishedLegalTypes === 4 ? "OK" : "BLOCKER",
      detail: `${facts.publishedLegalTypes}/4 유형 게시`,
    },
    {
      key: "active-season",
      label: "동시 활성 시즌",
      status: facts.otherActiveSeasons === 0 ? "OK" : "BLOCKER",
      detail: `다른 ACTIVE 시즌 ${facts.otherActiveSeasons}개`,
    },
  ];
}
