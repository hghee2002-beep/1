# 세션 18 — 최종 프로덕션 감사와 결함 수정

이 저장소가 실제 동아리 대회를 운영할 준비가 되었는지 독립적인 최종 감사처럼 검토하라. 기존 구현이 완료됐다는 전제를 믿지 말고 코드·DB schema·tests·docs·build output을 직접 확인하라. 계획만 작성하고 끝내지 말고, 저장소 안에서 고칠 수 있는 결함은 수정하라.

## 감사 순서

1. `AGENTS.md`, 모든 docs, `IMPLEMENTATION_PLAN.md`, `RELEASE_CHECKLIST.md`, 최근 Git diff를 읽는다.
2. clean install과 모든 품질 명령을 실행한다.
3. Prisma schema/migration drift, empty DB migration, seed를 검증한다.
4. 핵심 불변식 8개를 코드와 DB constraint 양쪽에서 추적한다.
5. 대표 user/admin/cron route의 auth·validation·error behavior를 검토한다.
6. Riot key 없이 Mock E2E 전체를 실행한다.
7. real integration은 key가 있을 때만 최소 read-only dry run을 수행한다. 없으면 절대 성공으로 표시하지 않는다.
8. 390/768/1440 viewport에서 주요 페이지와 overflow/reduced motion을 확인한다.
9. docs/RUNBOOK과 실제 command/env 이름의 차이를 고친다.
10. dead code, placeholder TODO, fake data leakage, disabled test, ignored TypeScript error를 검색한다.

## 반드시 추적할 사용자 시나리오

- 신규 회원 → 참가 신청 → 관리자 승인
- 시즌 시작 전 validation → 시작
- 같은 경기의 반복/동시 sync
- 승리와 패배 draw 정산 → 공개
- MVP/ACE entitlement → 더 나쁜 두 번째 결과 포함 재추첨
- mission 5개 → 경기 중 reroll snapshot → 여러 완료 → refill
- 공동 순위 `1,1,3`
- admin adjustment와 match invalidation reversal
- scheduler failure/recovery
- 시즌 finalize와 history snapshot

## 최종 보고서

`PRODUCTION_READINESS_REPORT.md`를 생성하라.

포함할 내용:

- `READY`, `CONDITIONALLY_READY`, `NOT_READY` 중 하나의 결론
- 증거가 있는 완료 항목
- Critical/High/Medium/Low 잔여 이슈
- 외부 launch blocker: production Riot key, legal docs, domain, DB, scheduler plan, published non-demo baseline
- 실행한 모든 명령과 결과
- migration/rollback 상태
- 운영 첫날 체크리스트
- FIXED_20 fallback과 sync 중지 절차

결론을 좋게 보이게 만들기 위해 실패를 숨기지 마라. 반대로 외부 secret이 없다는 이유만으로 저장소 내부 구현까지 미완성으로 취급하지 말고 “코드 준비”와 “운영 자격 증명 준비”를 분리하라.

## 완료 조건

- 저장소 내부에서 수정 가능한 출시 차단 결함을 수정했다.
- 보고서의 각 결론이 test/build/code evidence와 연결된다.
- 사용자가 외부 준비물만 채우면 어떤 명령과 순서로 배포·dry run할지 명확하다.

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
