# 세션 10 — MVP/ACE 표준화 평가 엔진

포지션·티어 차이를 표준화해 각 경기 승리 팀의 MVP와 패배 팀의 ACE를 계산하고, 신뢰할 수 있는 baseline에서만 재추첨 entitlement를 발급하라.

## Baseline 데이터

- 포지션: TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY
- tier bucket: PLATINUM/EMERALD/DIAMOND/MASTER_PLUS
- metric별 mean, stddev, sampleCount, patchRange, collectedAt, sourceLabel, version
- 상태: DRAFT/VALIDATED/PUBLISHED/RETIRED/REJECTED와 `DEMO_ONLY`
- CSV/JSON import: schema validation → dry-run report → publish의 2단계
- publish 후 immutable. 새 버전으로 교체하고 과거 평가는 기존 version 유지
- stddev <= 0, 표본 부족, 필수 metric 누락을 차단 또는 명시적으로 보류

실제 외부 표본을 생성했다고 가장하지 마라. fixture는 DEMO_ONLY로 표시한다.

## 평가 계산

`docs/DECISIONS.md` D-005/D-006의 공통 70%와 포지션 보정 30%를 정확히 구현한다.

- raw metric → per-minute/ratio normalized metric
- baseline mean/stddev로 z-score
- 기본 `[-3,3]` winsorize
- metric group 내 평균
- 누락 metric 처리 정책을 명확히 구현: 최소 충족률 미달은 PENDING, 허용 범위면 남은 weight를 결정론적으로 renormalize
- game participant의 시작 시점 tier bucket과 teamPosition 사용
- score calculation version 저장
- 각 group score와 최종 score를 audit 가능한 breakdown으로 저장

## 팀 우승자 선택

- 승리 팀 최고 = MVP, 패배 팀 최고 = ACE
- tie-break: total → KDA/KP group → objective involvement → fewer deaths → deterministic participant key
- 대회 추적 참가자가 해당 팀의 최고 평가자일 때만 entitlement 발급
- 동일 팀에 대회 참가자가 여러 명이면 전체 5명과 비교한 뒤 각자에게 올바르게 처리
- invalid/remake/missing data 경기는 보상 없음 또는 PENDING

## Pipeline 연결

- match normalize 완료 후 evaluation job
- baseline publish 전 대기 상태
- retry/idempotency key
- evaluation 완료 시 scoring service에 reroll entitlement 생성
- rerun은 결과를 중복 발급하지 않는다.
- baseline bug correction은 old row mutation 대신 새 version/re-evaluation/correction audit 절차

## 관리자 기능 최소 연결

- baseline 목록/상세
- CSV/JSON dry-run validation report
- publish confirmation
- DEMO_ONLY 경고
- 경기 평가 breakdown 조회

## 테스트

- 포지션별 weight 합
- z-score/winsorize
- missing/stddev zero/sample 부족
- tier bucket 경계
- 모든 tie-break
- 승리/패배 팀 선택
- 추적 참가자가 최고가 아닌 경우
- DEMO_ONLY production 차단
- duplicate evaluation/entitlement
- 과거 baseline version 보존

## 인수 조건

- 동일 raw match와 동일 baseline/version은 항상 같은 결과다.
- 참가자에게 점수 산출 근거를 group 단위로 설명할 수 있다.
- 실제 published baseline 없이는 production 재추첨권이 발급되지 않는다.

## 공통 실행 규칙

- 저장소 루트의 `AGENTS.md`와 이 작업에 관련된 `docs/` 문서를 먼저 읽어라.
- 현재 저장소를 조사하고 이미 올바르게 구현된 부분은 보존하라.
- 시작할 때 5~12개 항목의 구체적 실행 계획과 영향 파일을 제시한 뒤, 계획만 말하고 멈추지 말고 구현까지 진행하라.
- 안전한 로컬 파일 수정, 패키지 설치, migration 생성, 테스트 실행은 수행해도 된다.
- Git push, 외부 배포, production DB 변경, 유료 리소스 생성, 실제 secret 변경은 하지 마라.
- 외부 자격 증명이 없으면 Mock과 adapter 경계까지 완성하고, 실제 연동이 끝났다고 가장하지 마라.
- 타입 오류를 `any`, 무분별한 assertion, lint 비활성화로 숨기지 마라.
- 구현이 명세 결정을 바꾸면 같은 change에서 `docs/DECISIONS.md`를 갱신하라.
- 현재 세션 범위를 넘는 대규모 기능은 만들지 말고, 필요한 interface와 후속 TODO만 명확히 남겨라.

## 종료 전 검증 및 보고

가능한 범위에서 다음을 실행하라.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

DB 또는 주요 사용자 흐름을 다룬 세션은 관련 integration/E2E 테스트도 실행하라. 마지막 응답에는 다음을 포함하라.

1. 구현 결과와 핵심 결정
2. 변경 파일
3. 실행한 명령과 성공/실패 결과
4. 추가한 테스트와 검증한 경계 사례
5. 실행하지 못한 항목과 정확한 이유
6. 남은 외부 의존성 또는 리스크
7. 추천 Git commit message
