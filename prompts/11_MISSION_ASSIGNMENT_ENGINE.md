# 세션 11 — 주간 미션 배정·리롤·보충 엔진

100개 개별 evaluator를 실행하기 전에, 주간 미션의 상태 머신과 후보 배정 규칙을 완성하라. 이 세션에서는 evaluator registry interface와 몇 개의 stub/대표 evaluator만 사용하고 M001~M100 전체 구현은 다음 두 세션에서 수행한다.

## 상태와 배정

- 주차 시작 시 참가자마다 5개 active assignment
- assignment definition version snapshot
- 동일 주차에서 완료한 미션 재등장 금지
- rerolled mission은 deferred pool로 이동
- unseen eligible mission이 남아 있으면 deferred는 후보에서 제외
- unseen을 모두 본 뒤에만 deferred 재등장 가능
- 같은 미션 동시 중복 활성화 금지
- 난이도/유형/role/timeline cap은 `MISSION_CATALOG` 가드레일 적용
- crypto-safe selection과 audit 가능한 selection metadata

## 보충

- 주차 시작 시각 기준 6시간마다 credit 1개
- 최대 3개
- 완료로 빈 슬롯이 생기면 credit이 있으면 즉시 채우고 1개 소비
- credit이 없으면 vacancy 유지, 다음 accrual 시 즉시 채움
- scheduler가 놓친 시간이 있어도 현재 시각으로 누적 credit을 결정론적으로 계산
- 동시 refill job에서 중복 assignment 금지

## 리롤

- 참가자별 1시간 cooldown
- active mission 하나를 즉시 대체
- refill credit은 소비하지 않음
- 완료/이미 reroll 중/주차 종료 assignment는 리롤 불가
- 경기 진행 중 리롤해도 해당 경기 판정은 game-start snapshot 사용
- 동시 클릭 race에서 한 번만 성공

## 경기 시작 Snapshot

- match의 gameStartTimestamp에 각 참가자에게 활성인 assignment ID 집합을 확정
- 경기 ingestion이 늦어도 과거 시점 상태 이력으로 정확히 복원
- 새로 활성된 누적 미션은 activation 이후 시작 경기만 집계
- snapshot 생성과 evaluator 실행을 분리하되 동일 match 재처리에 idempotent

## API/UI 연결

- 내 active 5개, vacancy, current/target, next credit, stored credits, reroll cooldown
- history: completed/rerolled/expired
- reroll mutation의 구체적 오류
- admin이 정의 version/pool을 설정하되 진행 중 definition을 덮어쓰지 않음

## 테스트

fake clock과 seeded RNG adapter를 사용해 검증한다.

- 최초 5개 가드레일
- unseen 우선/deferred 후순위
- 6시간 경계와 cap 3
- vacancy 즉시 채움
- 1시간 cooldown
- concurrent reroll/refill
- 경기 중 reroll snapshot
- 주차 종료/새 주차 reset
- 100개보다 후보가 적은 상태의 안전한 동작

## 인수 조건

- 모든 시간 규칙이 `Asia/Seoul` 표시와 UTC 저장에서 일관된다.
- scheduler가 여러 번 호출되어도 동일 시각의 상태가 중복 생성되지 않는다.
- evaluator 구현과 무관하게 assignment lifecycle을 완전히 테스트할 수 있다.

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
