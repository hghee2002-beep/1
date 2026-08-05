# 원샷 시도 — 전체 운영형 프로젝트 구현

이 저장소의 문서 패키지를 단일 장기 작업으로 구현하라. 단, “한 번에 아무 코드나 생성”하지 말고 내부적으로 milestone을 나눠 각 단계마다 테스트하고 다음 단계로 진행하라. 질문만 남기거나 계획만 쓰고 멈추지 말며, 외부 credential 없이 가능한 부분은 끝까지 구현하라.

## 먼저 읽을 것

- `README_FIRST.md`
- `AGENTS.md`
- `PLANS.md`
- `docs/DECISIONS.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/MISSION_CATALOG.md`
- `docs/TEST_PLAN.md`
- `docs/RUNBOOK.md`
- `docs/EXTERNAL_CONSTRAINTS.md`

## 실행 방식

1. 저장소를 감사하고 `IMPLEMENTATION_PLAN.md`를 만든다.
2. 아래 milestone을 순서대로 구현한다. 각 milestone이 test/build 가능한 상태가 아니면 다음으로 넘어가기 전에 수정한다.
3. context 또는 실행 한계로 전체를 끝내지 못하면, 가장 마지막으로 검증된 milestone까지 clean commit 가능한 상태를 만들고 `CONTINUATION.md`에 정확한 다음 작업·파일·테스트를 기록한다. 미완성 코드를 완료라고 표시하지 않는다.

## Milestone

1. Next.js/TypeScript/Tailwind/shadcn/pnpm/test/CI 기반
2. Prisma/PostgreSQL 전체 schema, migration, 20명 seed
3. 디자인 시스템과 public/participant/admin route shell
4. Argon2id credentials auth, signed HttpOnly session, RBAC
5. Riot ID 신청/승인
6. Riot API real/mock adapter와 Data Dragon
7. idempotent match/rank sync
8. 17~23 commitment draw, append-only ledger, reveal/reroll
9. 포인트 공개 UI
10. MVP/ACE baseline import/evaluator/entitlement
11. mission assignment/refill/reroll/snapshot
12. M001~M100 evaluator와 weekly rank
13. 실제 dashboard/profile/history 연결
14. admin 13개 영역
15. scheduler modes, polling, observability/reconciliation
16. security/accessibility/performance/E2E/release audit

## 절대 불변식

- Riot PUUID가 참가자 식별 기준
- 동일 경기·ledger·mission completion 중복 금지
- 외부 API 호출을 DB transaction 안에서 하지 않음
- 점수는 경기 처리 시 즉시 반영, reveal은 표시 동작
- 모든 점수 변경 append-only
- 재추첨 두 번째 결과 최종
- 미션은 경기 시작 snapshot
- DEMO_ONLY baseline으로 production 보상 금지
- API key와 secret server-only
- USER는 admin mutation 불가
- `POINT_MODE=FIXED_20` fallback

## 외부 의존성 처리

Riot production key, production DB, 배포 domain, legal 문서 최종 문구, 실제 MVP baseline이 제공되지 않았다면:

- 명확한 env/interface/Mock/dry-run까지 구현
- `RELEASE_CHECKLIST.md`에서 launch blocker로 표시
- 실제 호출·배포·승인이 완료됐다고 쓰지 않음
- production 동작은 fail closed

## 최종 검증

가능한 모든 lint/typecheck/unit/integration/build/E2E/migration/seed를 실행한다. 실패를 숨기기 위해 test를 삭제하거나 설정을 약화하지 않는다. `PRODUCTION_READINESS_REPORT.md`에 완료 범위, 테스트 증거, 잔여 이슈, 외부 준비물, 실행 순서를 기록한다.

최종 응답에는 milestone별 상태(완료/부분/미착수), 변경 파일, 검증 결과, 외부 blocker, 정확한 다음 명령을 제공하라.
