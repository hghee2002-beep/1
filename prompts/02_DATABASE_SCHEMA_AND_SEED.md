# 세션 02 — Prisma/PostgreSQL 스키마와 Seed

`docs/DATA_MODEL.md`의 전체 데이터 모델을 Prisma/PostgreSQL로 구현하라. 이 세션은 business logic을 만들기보다, 이후 서비스가 의존할 정확한 schema·constraint·seed·DB test 기반을 완성하는 데 집중한다.

## 구현 범위

1. 현재 Prisma 안정 버전의 공식 구성 방식에 맞춰 client와 migration을 설정한다.
2. `docs/DATA_MODEL.md`에 정의된 인증, 신청, 참가자, 시즌/주차, 랭크 snapshot, 경기, draw/ledger, MVP baseline/evaluation, mission, sync/job, announcement/legal/audit/feature flag/system setting 모델을 구현한다.
3. enum, relation, onDelete 정책, timestamp, JSON payload 사용을 문서대로 적용한다.
4. 핵심 unique constraint를 DB에 둔다. 최소:
   - loginId
   - PUUID 기반 참가 중복
   - season + Riot match ID
   - participantMatch 유일성
   - score ledger idempotency key
   - draw 종류/소유권 유일성
   - mission assignment 처리 키
   - completion 유일성
   - sync cursor/job lease 키
5. leaderboard, recent matches, active missions, sync 대상으로 필요한 복합 index를 추가한다.
6. 금액이 아닌 점수는 정수로, 비율/평가값은 명세에 맞는 정밀도로 저장한다. 무분별한 float 비교를 피한다.
7. 최초 migration과 seed를 만든다.

## Seed 요구

- 개발 관리자 1명, 일반 회원, 승인 대기 회원을 구분한다. 비밀번호는 seed 전용 환경 변수 또는 명확한 개발 기본값을 Argon2id로 hash한다.
- 진행 중 시즌 1개, 2개 주차, 종료 시즌 1개를 만든다.
- 최소 20명의 참가자와 다양한 긴 Riot ID/tagLine을 포함한다.
- 공동 순위, 긴 연승/연패, 기록 없음, draw 미공개/공개/재추첨 가능 상태를 포함한다.
- 승·패·remake·무효 queue·timeline 의존 케이스용 match fixture를 넣는다.
- 100개 mission definition을 `docs/MISSION_CATALOG.md`에서 seed한다.
- `DEMO_ONLY` MVP baseline version과 샘플 metric을 명확히 표시한다.
- seed는 반복 실행해도 duplicate로 실패하지 않거나 개발 DB reset 절차가 명확해야 한다.

## DB 접근 기반

- singleton Prisma client를 올바른 server-only 위치에 둔다.
- test database를 격리하는 helper와 transaction cleanup 전략을 만든다.
- repository interface를 과도하게 추상화하지 말되 domain/service가 UI에서 직접 Prisma를 사용하지 않도록 최소 경계를 만든다.

## 테스트

- schema validate/generate
- migration from empty DB
- seed 완료
- 핵심 unique constraint가 실제로 duplicate를 거부
- cascade/restrict 정책
- 대표 leaderboard/recent match/active mission query의 결과

## 인수 조건

- 비어 있는 PostgreSQL에서 migration과 seed가 성공한다.
- `pnpm db:seed` 후 메인·순위·미션·관리자 화면에 필요한 상태를 조회할 수 있다.
- append-only와 idempotency를 위한 DB 제약이 명세에 맞다.
- production secret이나 실제 Riot 개인정보가 seed에 없다.

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
