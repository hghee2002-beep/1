# PLANS.md — 실행 계획 운영 규칙

복잡하거나 여러 세션에 걸친 작업은 구현 전에 이 문서 아래에 실행 계획(ExecPlan)을 작성하거나 갱신한다. 계획은 구현 중 발견에 따라 살아 있는 문서로 유지한다.

## 계획 작성 원칙

- 코드베이스를 읽지 않고 추측으로 파일명을 확정하지 않는다.
- 사용자가 확인할 수 있는 결과와 acceptance criteria를 중심으로 쓴다.
- 마이그레이션, 외부 API, 데이터 정산, 보안 위험을 명시한다.
- 각 milestone은 독립적으로 검증하고 Git commit 가능한 상태로 끝낸다.
- external credential이 필요한 부분과 Mock으로 완료 가능한 부분을 분리한다.
- 예상 시간 대신 작업 순서와 중단 조건을 쓴다.
- 계획이 바뀌면 `Decision Log`와 `Progress`를 즉시 갱신한다.

## ExecPlan 템플릿

```md
# [작업명]

## 목적과 사용자 결과

완료 후 사용자가 무엇을 할 수 있고 어떤 화면/데이터로 확인하는지 설명한다.

## 범위

### 포함

- ...

### 제외

- ...

## 현재 상태

- 관련 파일과 기존 동작
- 재사용 가능한 코드
- 발견한 결함 또는 부채

## 핵심 결정과 불변식

- ...

## 단계

### Milestone 1 — ...

- 수정 대상
- 구현 내용
- 검증 방법
- 완료 조건

### Milestone 2 — ...

...

## 데이터·마이그레이션

- schema 변경
- backfill
- rollback/forward-fix
- seed/fixture

## 보안·외부 서비스

- 필요한 secret/권한
- 네트워크 실패 처리
- rate limit
- 사용자 데이터 영향

## 테스트

- unit
- integration
- E2E
- manual acceptance

## Progress

- [ ] YYYY-MM-DD — ...

## Surprises & Discoveries

- ...

## Decision Log

- YYYY-MM-DD — 결정 / 이유

## 완료 보고

- 결과
- 검증
- 남은 외부 의존성
```

## 현재 제품 마일스톤

### M0. 저장소·문서·Mock

- package manager와 품질 스크립트
- 환경 변수 schema
- 문서와 fixture
- 기본 CI

### M1. 데이터 기반

- Prisma schema와 migration
- seed
- repository/service boundaries

### M2. UI shell과 시각 프로토타입

- 공통 layout/navigation
- public/participant/admin 주요 화면
- 반응형 표와 포인트 공개 연출 mock

### M3. 인증과 참가 승인

- credentials auth
- RBAC
- Riot ID application/approval

### M4. Riot 수집

- adapter/mock
- match/rank sync
- idempotency, lease, cursor

### M5. 정산과 평가

- append-only score ledger
- draw commitment/reveal/reroll
- MVP/ACE baseline/evaluator

### M6. 미션

- 100개 registry
- assignment/refill/reroll/snapshot/progress
- weekly ranking

### M7. 운영 UI와 스케줄러

- admin 13영역
- scheduler modes
- logs, health, reconciliation, export

### M8. 출시 감사

- security, accessibility, performance
- migration and recovery dry run
- E2E acceptance
- production readiness report
