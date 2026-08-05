# 세션 17 — 보안·접근성·성능·릴리스 준비

새 기능을 추가하는 세션이 아니라, 전체 저장소를 공격적으로 검토하고 출시 차단 결함을 수정하라. `docs/TEST_PLAN.md`와 `docs/RUNBOOK.md`를 실제 코드에 맞춰 실행한다.

## 보안 감사

- auth/session/cookie/JWT/Argon2id
- RBAC가 UI가 아닌 server에서 강제되는지
- CSRF/origin, rate limit, brute force
- input validation과 output escaping
- open redirect, path traversal, unsafe file upload
- Riot/CRON/DATABASE secret 노출
- server-only module의 client bundle 유입
- log/analytics PII
- CSV injection
- dependency audit와 불필요 package
- production debug endpoint/seed credential

발견한 문제를 severity와 exploit path로 기록하고 Critical/High를 수정한다.

## 데이터 무결성 감사

- match/ledger/draw/mission/evaluation idempotency constraint
- transaction 경계
- concurrent reveal/reroll/refill/sync
- score reconciliation
- mission rebuild
- season finalization
- timezone/DST가 없는 Asia/Seoul이라도 UTC 변환 경계
- migration from empty DB 및 기존 staging data migration dry-run

## 접근성

- keyboard navigation
- focus order/modal focus
- labels/error summary
- table semantics/mobile alternative
- color contrast와 비색상 신호
- reduced motion
- live region의 과도한 반복 방지
- axe 자동 검사와 수동 핵심 흐름

## 성능

- server/client component 경계
- bundle와 dynamic import
- leaderboard query/index/N+1
- image/static data cache
- scheduler batch time
- public page caching/stale correctness
- 관리자 pagination

## E2E 인수

`docs/TEST_PLAN.md`의 출시 전 12단계 시나리오를 자동/수동 가능한 범위로 실행한다. 최소 desktop과 390px mobile에서:

- signup/login/apply/admin approval
- sync fixture → score
- draw reveal/reroll
- mission progress/reroll/refill
- leaderboard/history
- admin adjustment/reversal/finalize

## 릴리스 산출물

- `RELEASE_CHECKLIST.md`
- migration/rollback notes
- 환경 변수 matrix(dev/staging/prod, 값 제외)
- known limitations
- policy checklist와 FIXED_20 전환법
- production key와 baseline이 없을 때 launch-blocking 표시

## 인수 조건

- lint/typecheck/unit/integration/build/E2E 결과가 문서화되어 있다.
- Critical/High 보안 및 데이터 무결성 결함이 열려 있지 않다.
- 외부 자격 증명 때문에 못 한 검증은 정확한 command와 조건이 있다.
- 테스트를 통과시키려고 보호 장치를 제거하지 않았다.

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
