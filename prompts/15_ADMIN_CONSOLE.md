# 세션 15 — 관리자 운영 콘솔 13개 영역

PRD의 관리자 정보 구조 13개 영역을 실제 application service와 연결하라. 단순 CRUD generator가 아니라 대회 운영 사고를 방지하는 validation, confirmation, audit, dry-run 중심 UI로 구현한다.

## 영역

1. Dashboard
2. Users
3. Applications
4. Participants
5. Seasons/Weeks
6. Scoring
7. Matches/Sync
8. Draws/Rerolls
9. Missions
10. MVP Baselines
11. Content/Legal
12. Audit/Exports
13. System

## 공통 요구

- 모든 route와 mutation은 ADMIN server guard
- search/filter/pagination
- destructive/irreversible action은 명확한 confirmation과 reason
- form schema validation과 field errors
- AuditLog: actor, action, target, before/after summary, reason, request metadata
- raw secret/password hash/Riot key는 어떤 표에도 표시하지 않음
- bulk action은 dry-run, 부분 실패, idempotency를 고려
- optimistic UI로 운영 결과를 거짓 표시하지 않음

## 핵심 기능

### 시즌/주차

- draft 생성, validation checklist, start, finalize
- 시간대 표시와 UTC 저장
- point mode, min duration, auto reveal, mission pool, baseline version
- 시작 전 필수 요소가 없으면 차단

### 경기/점수

- 수동 sync와 run 상세
- match 인정/무효 상태와 근거
- 재처리 dry-run
- 무효화 reversal
- reason-required admin score adjustment
- ledger reconciliation report

### 미션

- definition version 목록/복제/게시/비활성화
- 진행 중 version overwrite 금지
- assignment/progress/completion breakdown
- correction event
- 100개 registry 상태 확인

### MVP

- baseline upload dry-run/publish/archive
- DEMO_ONLY 경고
- evaluation breakdown와 pending/error
- entitlement 상태

### 사용자·신청·참가자

- role 변경 안전장치
- PUUID/Riot ID history
- 승인/거절
- 시즌 참가 활성/비활성, 중도 참가 정책

### 콘텐츠·감사·내보내기

- announcement/rules/privacy/terms version publish
- audit filter와 read-only detail
- CSV/JSON export job, formula injection 방지, secret 제외

### 시스템

- scheduler mode, last sync, feature flags, env readiness의 값 없는 상태
- health checks
- failed jobs/retry
- production에서 위험한 debug 기능 차단

## 테스트

- USER/unauthenticated 접근 차단
- 각 핵심 mutation의 validation/audit
- double submit
- season start/finalize 불변식
- adjustment/reversal
- baseline publish
- mission version immutability
- export sanitization
- mobile 최소 사용성과 desktop table

## 인수 조건

- 관리자가 DB 콘솔 없이 정상 대회 흐름을 운영할 수 있다.
- 직접 점수 덮어쓰기·경기 hard delete 같은 위험 UI가 없다.
- 모든 중요 변경을 누가 왜 했는지 추적할 수 있다.

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
