# 디럭스 솔랭 세션 01~18 실행 계획

## 목적과 사용자 결과

이 계획은 현재의 문서 패키지를 실제 운영 가능한 디럭스 솔랭 애플리케이션으로 전환하는 실행 순서를 고정한다. 세션 18 종료 시 사용자는 Mock 모드에서 가입→참가 신청→관리자 승인→경기 수집→점수 공개/재추첨→미션→순위/기록→시즌 종료를 재현할 수 있고, 운영자는 외부 자격 증명과 법적·정책 준비 상태를 코드 준비 상태와 분리해 판단할 수 있어야 한다.

세션 00에서는 제품 기능을 구현하지 않았다. 저장소 감사, 명세 충돌 해소, 외부 제약 확인, 이 계획과 리스크/질문 문서 작성만 수행했다.

## 범위

### 포함

- 세션 01~18의 실행 순서, 선행조건, 변경 영역, migration 위험, 검증 명령, 완료 조건
- 저장소 현재 상태와 문서 대비 충족도
- 핵심 데이터 불변식, dependency graph, critical path
- Mock으로 완료 가능한 범위와 외부 launch blocker의 분리
- 공식 primary source를 사용한 2026-08-04 기준 기술·외부 제약 확인

### 제외

- Next.js 프로젝트 초기화와 package 설치
- Git 저장소 초기화·commit·push
- 실제 PostgreSQL/Vercel/Riot 자격 증명 생성 또는 변경
- production 배포와 외부 DB migration
- 법률 자문, 실제 MVP/ACE 표본 데이터 생성

## 현재 상태

### 저장소·도구 감사

| 항목                   | 2026-08-04 상태                                                           | 판정                                       |
| ---------------------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| Git                    | Git 2.54.0은 설치되어 있으나 현재 경로와 상위 경로에 `.git`이 없음        | 미초기화                                   |
| 파일 구조              | `docs/`, `prompts/`, 저장소 지침과 패키지 생성 산출물만 존재              | 문서 전용 패키지                           |
| package manager        | `package.json`, `pnpm-lock.yaml`, workspace 설정 없음. 시스템 pnpm 11.8.0 | 앱 기준 미구현                             |
| Node                   | 시스템 Node 24.17.0 LTS, npm 11.13.0, Corepack 0.35.0                     | 사용 가능, 세션 01에서 LTS patch 고정 필요 |
| Next.js/React/Tailwind | 관련 source/config/dependency 없음                                        | 미구현                                     |
| Prisma/PostgreSQL      | `prisma/`, schema, migration, DB config 없음                              | 미구현                                     |
| 테스트                 | Vitest/RTL/Playwright config·test·script 없음                             | 미구현                                     |
| CI                     | `.github/workflows` 없음                                                  | 미구현                                     |
| 환경 변수              | `.env*` 없음. canonical 이름은 ARCHITECTURE/RUNBOOK에만 정의              | 부분 충족                                  |
| secret                 | 파일 검색상 채워진 secret 없음                                            | 충족                                       |
| 하위 지침              | 루트 `AGENTS.md` 하나뿐                                                   | 충족                                       |

### 문서 대비 분류

#### 이미 충족

- 제품 목표, 사용자/화면/관리자 13영역, 인수 조건이 PRD에 정의되어 있다.
- 계층 경계, Riot adapter, sync/score/mission pipeline과 운영 오류 모델이 정의되어 있다.
- M001~M100의 code, evaluator, source, 경계값이 모두 존재한다.
- 핵심 테스트 피라미드·보안·접근성·운영 runbook과 세션 00~18 프롬프트가 있다.
- PUUID, append-only ledger, reveal/정산 분리, reroll 단일성, mission snapshot, UTC/KST 불변식이 결정 문서에 있다.

#### 부분 충족

- 데이터 모델은 상세하지만 실제 Prisma schema/constraint/migration이 없다.
- 환경 변수 이름은 문서화됐지만 runtime schema와 `.env.example`이 없다.
- Mock 시나리오는 정의됐지만 fixture·clock·adapter가 없다.
- release/backup/reconciliation 절차는 문서화됐지만 실행 가능한 command가 없다.
- aggregate인 `MASTER_GUIDE.md`와 `ALL_CODEX_PROMPTS.md`는 세션 00 변경 전 snapshot이라 재생성 전 참고용이다.

#### 미구현

- Next.js UI, 인증/RBAC, Riot 신청/adapter, sync, 점수/재추첨, MVP/ACE, 미션, read model, 관리자 console, scheduler/observability 전체
- package/Node pin, lint/typecheck/test/build script, CI, README, env validation
- DB migration/seed/integration DB, 운영 export/backup/restore rehearsal

#### 세션 00에서 해소한 충돌·누락

- 전역 Match 원본과 시즌별 정산 범위를 `SeasonMatch`로 분리(D-016).
- versioned mission definition과 evaluator correction event의 유일성 확정(D-017).
- 주차 `WeekSnapshot`과 시즌 `FinalStandingSnapshot`을 분리(D-018).
- 포인트 commitment에 version을 포함한 canonical encoding 확정(D-019).
- 공개 실명 opt-in 기본 false, 가입 후 비자동 로그인과 loginId 정책 확정(D-020~D-021).
- 재현되지 않은 Riot 최신 가이드 주장 대신 공개 공식 정책의 최소 20명을 보수적으로 적용(D-022).
- Vercel Hobby Cron을 경기 sync 용도에서 제외하고 무료 기본을 GitHub schedule+manual로 확정(D-023).
- baseline 없는 티어의 임의 매핑 금지와 `PENDING_BASELINE` 처리(D-024).
- 법적 문서별 append-only 동의 이력 추가(D-025).

#### 외부 자격 증명·운영 결정 필요

- production Riot product 등록/key와 개최 전 적용 정책 원문
- 실제 MVP/ACE baseline source·coverage·표본 기준
- production PostgreSQL/backup, hosting/domain, scheduler plan
- 최종 약관·개인정보 문구와 보존 기간
- chance-based scoring 검토 후 RANDOM/FIXED 운영 모드

세부 목록과 기본 중단 조건은 `docs/OPEN_QUESTIONS.md`, 완화책은 `docs/RISK_REGISTER.md`를 따른다.

## 공식 source 확인 결과

확인일은 모두 2026-08-04다. exact dependency는 설치 직전 다시 확인하고 세션 01 lockfile로 고정한다.

| 대상            | 공식 source와 결론                                                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js         | [Node release status](https://nodejs.org/en/about/previous-releases): v24는 LTS, v26은 Current다. production 기준은 Node 24 LTS 최신 patch이며 현재 로컬 24.17.0은 지원선 안이다.                                                                 |
| npm latest tags | 공식 npm registry의 `npm view` 결과: Next 16.3.0, React/React DOM 19.2.8, TypeScript 7.0.2, Tailwind 4.3.3, Prisma 7.9.1, Vitest 4.1.10, Playwright 1.62.1, pnpm 11.20.0. beta/canary tag는 선택하지 않는다.                                      |
| Prisma          | [Prisma system requirements](https://docs.prisma.io/docs/orm/reference/system-requirements)와 [v7 upgrade guide](https://www.prisma.io/docs/orm/v6/more/upgrades/to-v7): Node 24 지원, ESM과 새 `prisma-client` generator/output 구성이 필요하다. |
| Riot routing/ID | [Riot LoL API docs](https://developer.riotgames.com/docs/lol): Riot ID→PUUID는 Account-V1, KR platform과 ASIA regional route가 현재 문서와 일치한다.                                                                                              |
| Riot queue      | [공식 queues.json](https://static.developer.riotgames.com/docs/lol/queues.json): `queueId=420`은 Summoner's Rift 5v5 Ranked Solo다. 상수 이름과 source 확인일을 저장한다.                                                                         |
| Riot key        | [Developer Portal docs](https://developer.riotgames.com/docs/portal): development key는 24시간마다 비활성화되고 공개 product는 적절한 등록/key가 필요하다.                                                                                        |
| Riot 정책       | [General Policies](https://developer.riotgames.com/policies/general): 공개 페이지 최종 갱신 2025-03-11 기준 tournament 최소 20명·공정/투명·no gambling이 명시되어 있다. 더 최신 적용 지역 원문이 확인될 때까지 보수 적용한다.                     |
| Vercel Cron     | [Usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs): Hobby는 하루 1회, 최대 59분 오차, 실패 자동 재시도 없음. 경기 sync에 부적합하다.              |
| GitHub schedule | [GitHub Actions troubleshooting](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows): 혼잡 시 scheduled run이 지연되거나 drop될 수 있으므로 수동 복구와 overlap cursor가 필요하다.                                                 |

## 핵심 결정과 불변식

- 외부 Riot HTTP 호출은 DB transaction 밖, 정규화 후 짧은 transaction만 연다.
- raw Match는 전역 유일, 시즌 정산은 `(seasonId, matchId)`, 참가자 정산은 `(participantId, seasonMatchId)`로 유일하다.
- 모든 점수 변경은 append-only `ScoreLedger`; cached score는 원장에서 재구축 가능하다.
- 첫 draw는 경기 처리 때 생성·정산하고 reveal은 결과를 새로 만들지 않는다.
- reroll은 entitlement당 최대 1회이며 second가 무조건 final, 차이 ledger만 추가한다.
- mission definition·assignment·evaluator version과 경기 시작 assignment interval을 고정한다.
- 정상 mission event는 `(assignment, participantMatch, evaluatorVersion)`가 유일하며 correction은 차이만 반영한다.
- DEMO_ONLY/coverage 없는 baseline은 production entitlement를 만들지 않는다.
- 시간은 DB UTC, 화면·주차 계산은 `Asia/Seoul`, 경기 인정은 `[startAt,endAt)`이다.
- 모든 admin mutation은 server-side RBAC·입력 검증·사유·AuditLog를 요구한다.
- 공개 실명은 opt-in이며 secret, password hash, nonce, raw payload를 공개 read model에 넣지 않는다.

## dependency graph와 critical path

```text
01 Foundation
 ├─ 02 Data model ───────────────────────────────────────────────────────┐
 └─ 03 Static UI ────────────────┐                                      │
                                 ▼                                      │
02 → 04 Auth → 05 Application → 06 Riot adapter → 07 Sync → 08 Scoring │
                                                     │          ├→ 09 Reveal UI
                                                     │          └→ 10 MVP/ACE
                                                     └────────────→ 11 Assignment
10 ───────────────────────────────────────────────────────────────→ 13 M056~M100
11 → 12 M001~M055 → 13 Mission integration → 14 Read models/dashboard
03 ───────────────────────────────→ 09, 14, 15 Admin UI
14 → 15 Admin console → 16 Scheduler/observability → 17 Release QA → 18 Final audit
```

순차 프롬프트 실행의 critical path는 `01→02→03→04→05→06→07→08→09→10→11→12→13→14→15→16→17→18`이다. 기능 의존성만 보면 03 일부와 04~08의 domain 작업은 분리할 수 있지만, 이 패키지는 각 세션을 독립 검증·commit 가능한 상태로 끝내므로 번호 순서를 유지한다.

외부 launch blocker는 critical path와 별도로 추적한다. production key·DB·domain·법적 문서·scheduler·non-demo baseline이 없어도 세션 01~16의 Mock 코드 준비는 진행할 수 있으나 세션 17은 이를 launch blocker로 표시하고 세션 18은 코드 준비와 운영 준비를 분리 판정한다.

## 단계

### Milestone 01 — Next.js 기반과 개발 도구

- 목표: 새 clone이 하나의 pnpm 앱으로 설치·개발·품질 검사를 실행할 수 있는 최소 production 기반을 만든다.
- 예상 변경 영역: `package.json`, `pnpm-lock.yaml`, Node/Corepack pin, `src/app`, `src/lib/env`, `src/server`, test config, `.github/workflows`, `.env.example`, 루트 `README.md`.
- 선행조건: 현재 문서와 D-016~D-025를 읽고 npm latest/peer/runtime을 다시 확인한다. Git 초기화는 사용자가 저장소로 만들겠다는 범위 안에서만 수행한다.
- 데이터 migration 위험: DB migration 없음. Prisma 7 generator/output·ESM 구성을 세션 02와 호환되게 잡아야 하며, secret 기본값으로 production이 부팅되지 않게 한다.
- 검증 명령: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`(기본 smoke), `/api/health` 수동 확인.
- 완료 조건: exact lockfile, strict TS, server-only env boundary, 안전한 env 오류, 기본/error/loading/not-found route, unit 1개와 Playwright smoke 1개, CI와 실제 README 명령이 모두 동작한다.

### Milestone 02 — Prisma/PostgreSQL 스키마와 seed

- 목표: 빈 PostgreSQL에서 전체 권위 schema·constraint·seed를 재현하고 이후 서비스의 transaction 기반을 만든다.
- 예상 변경 영역: `prisma/schema.prisma`, `prisma/migrations`, `prisma/seed`, `src/server/db`, DB test helper, repository/read query 기반, DATA_MODEL 동기화.
- 선행조건: 01 완료, 격리된 개발/test PostgreSQL 연결. D-016 SeasonMatch, D-017 mission version/correction, D-018 FinalStandingSnapshot, D-020 consent, D-025 LegalConsent를 최초 schema에 포함한다.
- 데이터 migration 위험: 매우 높음. 최초 migration이므로 빈 DB 성공이 필수이고, 전역 Match와 시즌 정산 FK/unique, append-only 원장, onDelete, Decimal precision을 SQL까지 검토한다. DB trigger로 강제할 append-only 범위도 명시한다.
- 검증 명령: `pnpm db:generate`, schema validate 명령, empty DB `pnpm db:migrate`, `pnpm db:seed`, `pnpm test:integration`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- 완료 조건: migration+seed 반복 절차, 20명/긴 Riot ID/공동순위/draw/mission/DEMO baseline fixture, 핵심 duplicate 거부·rollback·대표 쿼리 test, secret/실 개인정보 없는 seed가 확인된다.

### Milestone 03 — 디자인 시스템과 전체 정적 UI

- 목표: seed/mock read model로 모든 public/participant/admin route의 고밀도 graphite UI와 반응형 정보 구조를 검증한다.
- 예상 변경 영역: `src/styles`, `src/components/{ui,layout,leaderboard,matches,missions,draw,admin}`, `src/app` route tree, UI fixture/read DTO, Playwright screenshots.
- 선행조건: 01 완료, 가능하면 02 seed read model 사용. 기능 mutation은 disabled/demo로 명확히 표시한다.
- 데이터 migration 위험: 없음. UI fixture shape가 향후 DB model을 권위로 대체할 수 있게 adapter를 둔다.
- 검증 명령: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` with 390/768/1440 viewports와 reduced-motion.
- 완료 조건: PRD route가 모두 존재하고 TOP5/countdown/leaderboard link가 첫 화면에 보이며 sticky scroll shadow, tagLine, mobile row expansion, keyboard focus, empty/error/stale 상태에 overflow·hydration 오류가 없다.

### Milestone 04 — Credentials 인증·세션·권한

- 목표: 자체 loginId/password 가입, 로그인/로그아웃, revocable session, USER/ADMIN server guard를 완성한다.
- 예상 변경 영역: `src/features/auth`, `src/server/auth`, signup/login/me routes, cookie/JWT, rate limit/origin defense, `admin:create` CLI, AuthSession/LegalConsent DB service.
- 선행조건: 02 User/AuthSession/LegalDocument/LegalConsent schema, 03 auth UI. D-021의 비자동 로그인·loginId 정책을 적용한다.
- 데이터 migration 위험: 중간. schema가 빠진 login attempt/consent/index가 있으면 additive migration만 허용하고 normalized ID 충돌 test를 먼저 한다.
- 검증 명령: 공통 품질 명령 + `pnpm test:integration` + auth Playwright flow + cookie/header 수동 검사.
- 완료 조건: signup→login→protected page→logout, forged/expired/revoked session, duplicate normalized ID, generic failure, rate limit, CSRF/origin, USER admin 차단, CLI admin 생성이 통과하고 hash/token/secret 노출이 없다.

### Milestone 05 — Riot ID 참가 신청과 관리자 승인

- 목표: Mock identity resolver로 Riot ID 검증·신청·상태 조회·관리자 승인/거절과 참가자 초기화를 end-to-end 구현한다.
- 예상 변경 영역: `src/features/applications`, participants/seasons service, `/apply`, `/me`, admin applications, Mock resolver interface, AuditLog.
- 선행조건: 04 인증/RBAC, 02 application/participant/season schema, 활성 draft season fixture.
- 데이터 migration 위험: 중간. 시즌별 PUUID 중복 race를 DB constraint/transaction으로 보장하고 공개 실명 동의 필드가 없으면 additive migration한다.
- 검증 명령: 공통 품질 명령 + integration test + 신청→admin 승인 E2E.
- 완료 조건: 정상/parse 오류/not found/temporary failure/duplicate PUUID를 구분하고 승인 transaction rollback, 중도 참가 경고, USER 승인 차단, AuditLog, 미승인 USER의 경기·미션 제외가 검증된다.

### Milestone 06 — Riot API client·정규화·Mock

- 목표: server-only Real/Mock RiotClient와 방어적 normalized DTO, static data resolver를 완성한다.
- 예상 변경 영역: `src/features/riot/{domain,infrastructure}`, HTTP/retry/redaction, contract fixtures, Data Dragon cache, env composition root.
- 선행조건: 01 env/server boundary, 05 resolver interface. 구현일 공식 API reference·queue JSON·DTO와 실제 비식별 fixture를 다시 확인한다.
- 데이터 migration 위험: 낮음. raw retention metadata나 static version cache가 schema에 없다면 additive migration; raw JSON을 일반 query와 분리한다.
- 검증 명령: 공통 품질 명령 + offline contract tests. 실 key가 명시적으로 제공된 경우에만 staging read-only smoke를 별도 실행한다.
- 완료 조건: Account/Match/Timeline/Rank의 KR·ASIA routing, path encoding, timeout, 401/403/404/429/5xx, Retry-After, malformed/missing field, Mock parity가 통과하고 key가 client/HTML/log/error에 없다.

### Milestone 07 — 경기 sync와 랭크 snapshot

- 목표: 승인 참가자의 시즌 내 queue 420 경기와 공식 랭크를 idempotent하게 ingest하고 후속 처리 상태를 만든다.
- 예상 변경 영역: `src/features/sync`, match eligibility domain, Riot repositories, JobLease/SyncCursor/SyncRun, scheduler/admin entrypoint, rank/daily snapshots, outbox/backfill.
- 선행조건: 02 schema, 05 approved participants, 06 adapter. `SeasonMatch`와 `[startAt,endAt)` 귀속이 구현되어야 한다.
- 데이터 migration 위험: 높음. D-016 관계·unique/index가 빠졌으면 처리 전에 migration한다. cursor backfill과 late arrival overlap이 기존 row를 건너뛰지 않는지 dry-run한다.
- 검증 명령: 공통 품질 명령 + `pnpm test:integration` + Mock sync E2E/관리자 run summary.
- 완료 조건: 반복/동시 sync, 복수 추적 참가자, exact start/end, invalid queue/remake, API partial failure, pagination/late arrival, lease 경쟁, transaction rollback에서 Match/SeasonMatch/ParticipantMatch/outbox가 중복되지 않는다.

### Milestone 08 — 점수 원장·commitment·재추첨

- 목표: RANDOM/FIXED draw, 즉시 ledger 정산, reveal, 자동 공개, reroll adjustment, ranking/reconciliation을 원자적으로 구현한다.
- 예상 변경 영역: `src/features/scoring`, crypto/canonical encoding domain, PointDraw/ScoreLedger services, reveal/reroll API, reconciliation CLI, admin adjustment/invalidation.
- 선행조건: 07 unscored ParticipantMatch, 02 constraints, D-019 commitment. 세션 10 entitlement를 받을 명확한 interface를 먼저 둔다.
- 데이터 migration 위험: 매우 높음. draw/ledger unique와 nonce 보호, commitmentVersion, final value constraints, append-only enforcement를 migration SQL로 검토한다. 기존 fixture backfill은 idempotency key 보고 후 수행한다.
- 검증 명령: 공통 품질 명령 + integration/concurrency tests + reconciliation dry-run.
- 완료 조건: 17~23 branch와 부호, FIXED_20, tamper, 비공개 DTO, repeated reveal, 12시간 auto reveal, reroll same/better/worse/concurrent, duplicate/rollback, `1,1,3`가 통과하고 ledger update/delete 경로가 없다.

### Milestone 09 — 포인트 공개 UI

- 목표: 세션 08의 실제 reveal/reroll state를 사용해 접근 가능한 “신호 해독/봉인 해제” UI를 구현한다.
- 예상 변경 영역: `src/components/draw`, `/me`, recent match/history integration, CSS motion tokens, client state machine tests.
- 선행조건: 03 design tokens/components, 08 reveal/reroll API와 DTO.
- 데이터 migration 위험: 없음. UI state는 서버 결과의 projection이며 점수 권위가 되지 않는다.
- 검증 명령: 공통 품질 명령 + fake-timer unit/component tests + Playwright mobile/keyboard/reduced-motion/slow-network.
- 완료 조건: 약 4.8초, 1.5초 후 skip, 약 0.4초 reduced motion, DOM/ARIA 조기 값 미노출, reload/retry/repeated reveal, reroll 확인·동시 오류가 안전하며 카지노·현금성 표현이 없다.

### Milestone 10 — MVP/ACE 평가 엔진

- 목표: versioned baseline과 결정론적 표준화 평가를 구현하고 게시된 non-demo coverage에서만 reroll entitlement를 발급한다.
- 예상 변경 영역: `src/features/mvp`, baseline import/validation/publish service, evaluation pipeline, admin baseline/breakdown UI, scoring entitlement adapter.
- 선행조건: 06 normalized 10인 participant data, 07 processed match, 08 entitlement interface, 02 baseline/evaluation schema. D-024를 적용한다.
- 데이터 migration 위험: 높음. status enum은 DRAFT/VALIDATED/PUBLISHED/RETIRED/REJECTED로 통일하고 evaluation status, version/checksum/coverage unique가 빠졌으면 migration한다. 게시 version은 immutable이다.
- 검증 명령: 공통 품질 명령 + integration tests + import dry-run fixture test.
- 완료 조건: 공통 70%/포지션 30%, z-score/winsorize, missing renormalization threshold, tier boundary, 모든 tie-break, 전체 5명 비교, duplicate evaluation/entitlement, DEMO/coverage 차단, 과거 version 재현이 통과한다.

### Milestone 11 — 미션 배정·리롤·보충 엔진

- 목표: evaluator와 독립적인 주간 mission lifecycle, unseen/deferred 후보, 6시간 refill, 1시간 reroll, 경기 시작 snapshot을 완성한다.
- 예상 변경 영역: `src/features/missions/{domain,application}`, candidate/refill/reroll repositories, `/me` mission actions, admin pool config, clock/RNG adapters.
- 선행조건: 02 versioned mission schema, 07 ParticipantMatch 시작 시각, MISSION_CATALOG guardrail. 10은 M100 후보 조건 interface를 제공한다.
- 데이터 migration 위험: 매우 높음. 복합 unique, active interval, candidate history, refill/reroll state, selection metadata와 correction field를 처리 전에 검증한다. 시간 backfill은 week anchor를 권위로 삼는다.
- 검증 명령: 공통 품질 명령 + fake-clock unit + DB concurrency integration + mission action E2E.
- 완료 조건: 최초 5개 guardrail, unseen 우선/deferred 후순위, exact 6시간/cap3, vacancy refill, exact 1시간 cooldown, concurrent refill/reroll, 경기 중 reroll snapshot, week reset, 후보 부족이 결정론적·idempotent하다.

### Milestone 12 — 미션 evaluator M001~M055

- 목표: summary/objective evaluator 55개를 실제 registry와 processing pipeline에 연결한다.
- 예상 변경 영역: `src/features/missions/evaluators`, registry, evidence DTO, pending retry, table-driven/complex fixtures, completion service.
- 선행조건: 06 normalized summary/timeline subset, 07 eligible match, 11 snapshot/progress service, catalog seed key 일치.
- 데이터 migration 위험: 낮음. schema는 11에서 완성해야 한다. evidence 크기/index 문제가 발견되면 additive migration만 한다.
- 검증 명령: 공통 품질 명령 + evaluator completeness/unit suite + mission processing integration.
- 완료 조건: M001~M055 성공/실패/경계/missing/invalid fixture, team kills 0, 15:57, first assists, objective assistants, Challenges 누락, duplicate match, multi-completion이 통과하고 `PENDING_DATA`가 FAIL로 바뀌지 않는다.

### Milestone 13 — 미션 evaluator M056~M100과 통합

- 목표: timeline/build/static/position/rune/champion/cumulative evaluator를 추가하고 주간 mission 시스템을 end-to-end 완성한다.
- 예상 변경 영역: timeline/static resolvers, M056~M100 evaluators, cumulative event rebuild, weekly mission read model, `/me`, `/missions`, `/history`.
- 선행조건: 10 trusted MVP event, 11 lifecycle, 12 registry, 06 timeline/Data Dragon, 07/08 processing events.
- 데이터 migration 위험: 중간. distinct set/evidence와 correction semantics가 기존 JSON 한계를 넘으면 migration 전 rebuild dry-run을 만든다. definition은 `(code,version)`으로 유지한다.
- 검증 명령: 공통 품질 명령 + full M001~M100 completeness + integration + mission/history E2E.
- 완료 조건: purchase/sell/undo, exact frame fallback, activation 전후, distinct duplicate, streak reset, M100 demo exclusion, simultaneous completion, rollover/history, mission rank `1,1,3`, event rebuild가 통과하고 100개 mapping이 완전하다.

### Milestone 14 — 실제 데이터 대시보드·순위·기록

- 목표: 정적 화면을 server-only read model에 연결해 public/participant/history 데이터가 원장과 일치하게 보이도록 한다.
- 예상 변경 영역: `src/features/leaderboard` read services, dashboard/profile/match/history queries, Recharts client islands, cache/revalidation, route DTO.
- 선행조건: 03 UI, 07 snapshots, 08 score ledger, 10 evaluation, 13 mission ledger, 02 Week/FinalStandingSnapshot.
- 데이터 migration 위험: 중간. 실제 explain에서 필요한 index만 additive migration한다. cache field 변경은 원장 rebuild command와 함께 한다.
- 검증 명령: 공통 품질 명령 + read query integration/explain + public/private E2E at 390/1440.
- 완료 조건: Mock 하드코딩이 제거되고 score/ledger, mission/completion, TOP5/full rank, today/recent fallback, public privacy, immutable Week/FinalStanding history가 일치하며 N+1과 전체 페이지 500 fallback 문제가 없다.

### Milestone 15 — 관리자 운영 console 13영역

- 목표: DB console 없이 정상 대회 흐름을 운영하되 위험 action은 validation·dry-run·confirmation·AuditLog로 통제한다.
- 예상 변경 영역: `src/app/admin` 13 route, `src/features/admin`, user/application/season/scoring/match/mission/MVP/content/export/system services, pagination/forms.
- 선행조건: 04 ADMIN guard, 05~14의 application services/read models. 직접 Prisma mutation을 UI에 두지 않는다.
- 데이터 migration 위험: 높음. LegalDocument/Consent, ExportJob, FeatureFlag, audit metadata, finalization state가 누락되면 additive migration 후 backfill report를 만든다. hard delete/ledger update는 만들지 않는다.
- 검증 명령: 공통 품질 명령 + admin integration + export sanitization + desktop/mobile admin E2E.
- 완료 조건: 13영역 route와 핵심 mutation, season validation/start/finalize, sync/reprocess, adjustment/reversal, baseline/mission version publish, content/legal, audit/export, env readiness가 동작하며 USER/unauthenticated·double submit·무사유 action이 차단된다.

### Milestone 16 — scheduler·준실시간 갱신·관측성

- 목표: MANUAL/GITHUB_SCHEDULE/VERCEL_CRON/WORKER entrypoint가 같은 sync service를 안전하게 호출하고 운영자가 지연·실패·복구 상태를 볼 수 있게 한다.
- 예상 변경 영역: signed cron route, `.github/workflows`, optional `vercel.json`, scheduler adapters, structured logger/redaction, polling hooks, retry/backfill/reconciliation tools, README/RUNBOOK.
- 선행조건: 07 sync service, 08/10/13 processing backlog, 15 system UI. D-023에 따라 Hobby를 sync mode로 제안하지 않는다.
- 데이터 migration 위험: 중간. SyncRun metrics, nonce/replay record, lease heartbeat, backlog status가 없다면 additive migration한다. 기존 run retention을 정한다.
- 검증 명령: 공통 품질 명령 + scheduler auth/concurrency/continuation integration + polling visibility component/E2E + log redaction scan.
- 완료 조건: wrong secret, replay, concurrent run, timeout continuation, partial failure, 429, stale lease, mode parity가 통과하고 운영 UI에 last success/failure/staleness가 보이며 무료/안정 모드 차이가 문서와 일치한다.

### Milestone 17 — 보안·접근성·성능·릴리스 준비

- 목표: 새 기능 추가 없이 Critical/High 보안·데이터 무결성 결함을 수정하고 재현 가능한 release evidence를 만든다.
- 예상 변경 영역: 전체 코드/schema/tests/docs, `RELEASE_CHECKLIST.md`, migration/rollback notes, env matrix, known limitations, policy/fallback runbook.
- 선행조건: 01~16 기능/테스트 완료, staging DB와 Mock E2E. 외부 credential이 없으면 명령·조건을 명확히 남긴다.
- 데이터 migration 위험: 매우 높음. empty DB와 staging-like data migration dry-run, drift, backup/restore rehearsal을 검증한다. 감사 중 발견된 constraint 변경은 forward migration과 rollback/forward-fix 계획 없이 적용하지 않는다.
- 검증 명령: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm build`, `pnpm test:e2e`, migration drift/empty DB/secret/dependency/axe/bundle 검사.
- 완료 조건: Critical/High가 0이고 출시 12단계 흐름이 desktop/390px에서 통과한다. production key/baseline/legal/DB/domain/scheduler 같은 외부 차단은 checklist에 명확히 남고 보호 장치를 약화한 예외가 없다.

### Milestone 18 — 최종 production 감사와 결함 수정

- 목표: 독립 감사처럼 clean install부터 운영 시나리오까지 재검증하고 저장소 내부 출시 차단 결함을 수정한 뒤 준비도를 판정한다.
- 예상 변경 영역: 발견 결함 관련 최소 코드/schema/tests/docs, `PRODUCTION_READINESS_REPORT.md`, 최종 first-day/fallback/sync-stop 절차.
- 선행조건: 17 release checklist, 현재 Git diff, 모든 canonical docs/plan. real integration은 실제 key가 있을 때만 read-only로 한다.
- 데이터 migration 위험: 치명적. schema drift/empty migration/seed/staging dry-run/rollback evidence가 없으면 READY가 될 수 없다. production DB를 직접 변경하지 않는다.
- 검증 명령: 17의 전체 suite + 390/768/1440 visual/reduced-motion + dead code/TODO/disabled test/ignored TS/fake data/secret scan + 10개 대표 사용자·운영 시나리오.
- 완료 조건: 내부 수정 가능 blocker를 고치고 `READY|CONDITIONALLY_READY|NOT_READY` 결론을 evidence에 연결한다. 코드 준비와 외부 운영 준비를 분리하고 외부 준비 후 deploy/dry-run 명령 순서를 제공한다.

## 데이터·migration

- 세션 02에서 D-016~D-025를 포함한 하나의 coherent 최초 migration을 만든다. 초기 앱에 이미 알 수 있는 모델을 여러 후속 migration으로 쪼개지 않는다.
- 각 후속 세션은 schema 변경 전 현재 migration history, seed, integration fixture를 읽고 additive change를 우선한다.
- 핵심 unique/foreign key/check와 append-only enforcement는 Prisma schema뿐 아니라 생성 SQL을 검토한다.
- raw external payload와 mutable cache는 권위 원장·normalized table과 분리한다.
- backfill은 dry-run report→duplicate/invalid row 해소→migration→reconciliation 순서이며 자동 덮어쓰기를 금지한다.
- production에서는 `db push`를 사용하지 않고 backup/snapshot 확인 후 승인된 deploy migration만 실행한다.
- rollback은 application rollback과 DB forward-fix/restore를 구분한다. irreversible migration은 restore rehearsal 없이는 출시하지 않는다.

## 보안·외부 서비스

- 필요한 secret: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `CRON_SECRET`, 실제 모드의 `RIOT_API_KEY`. 실제 값은 파일·로그·snapshot에 기록하지 않는다.
- Node/Prisma/argon2 경로는 Node runtime을 사용하고 Edge로 강제하지 않는다.
- state mutation은 인증/RBAC·schema validation·origin/CSRF·rate limit을 적용한다.
- Riot 401/403은 자동 반복 중단, 429는 Retry-After+backoff, 5xx는 제한 재시도 후 run item에 남긴다.
- public product는 적절한 Riot 등록/key, 공식 고지, 정책 재확인 없이는 시작하지 않는다.
- Vercel Hobby Cron은 sync에서 제외한다. GitHub schedule 지연·누락은 overlap cursor, stale indicator, manual recovery로 완화한다.
- 실제 baseline/법적 문구/production DB/domain은 코드로 만들어낼 수 없는 launch blocker다.

## 테스트

- unit: crypto/ranking/time/eligibility/MVP/100 evaluators/refill/reroll처럼 IO 없는 domain 규칙.
- integration: PostgreSQL unique/transaction/concurrency/auth/approval/sync/score/mission/admin/finalize.
- contract: Riot routing/error/optional field/Data Dragon/Mock parity. 실 개인정보와 key를 fixture에서 제거한다.
- E2E: visitor, signup/login/apply/approve, sync fixture, reveal/reroll, mission, leaderboard/history, admin recovery/finalize를 desktop과 mobile에서 수행한다.
- manual acceptance: 실제 key가 있는 staging 3계정 dry run, backup/restore, keyboard/200% zoom, visual overflow, 정책/고지 검토.
- 테스트를 통과시키기 위한 assertion/lint/type 완화, skip/only/disabled test는 허용하지 않는다.

## Progress

- [x] 2026-08-04 — 세션 00: 필수 문서와 01~18 프롬프트 전체, 저장소·도구·config 상태 감사
- [x] 2026-08-04 — 공식 npm/Node/Prisma/Riot/Vercel/GitHub source 확인과 외부 차단 분리
- [x] 2026-08-04 — D-016~D-025로 schema·privacy·policy·scheduler 충돌 해소
- [x] 2026-08-04 — `docs/RISK_REGISTER.md`, `docs/OPEN_QUESTIONS.md`, 본 실행 계획 작성
- [ ] 세션 01 — foundation 구현 및 실제 lockfile/README/CI 확정
- [ ] 세션 02~16 — 각 milestone 구현·검증·독립 commit
- [x] 2026-08-05 — 세션 05: Mock Riot ID 검증, 신청 상태, 관리자 승인·거절·재검증, 참가자 초기화와 전체 E2E 구현
- [ ] 세션 17 — release QA와 외부 launch blocker 확정
- [ ] 세션 18 — production readiness 최종 판정

## Surprises & Discoveries

- 이 폴더는 “빈 Git 저장소”가 아니라 `.git`조차 없는 문서 배포 패키지다. 세션 01에서 앱과 저장소 기반을 함께 정리해야 한다.
- 로컬 Node는 지원되는 v24 LTS지만 공식 최신 LTS patch와 시스템 pnpm latest가 다르다. global tool을 신뢰하지 않고 project `packageManager`/lockfile로 고정해야 한다.
- Vercel Hobby Cron의 현재 하루 1회 제한은 문서의 완곡한 “잦은 호출에 부적합”보다 강하다.
- Riot 최신 커뮤니티 가이드와 Competition Visibility Form 주장은 공식 URL로 재현되지 않았고, 공개 General Policies의 최소 20명 규칙과 충돌했다.
- `MissionDefinition.code unique`, mission progress unique, 시즌 match scope, FinalStandingSnapshot, 법적 동의 version은 실제 schema 구현 전에 수정하지 않으면 후속 세션을 막는 문서 결함이었다.
- package manifest/aggregate는 생성 snapshot이므로 canonical 수정 후 current source로 사용할 수 없다.
- 최초 migration에 사용자당 PENDING 하나를 보장하는 partial unique index가 이미 있어 세션 05 migration은 신청 포지션 필드와 PUUID 상태 조회 index만 추가했다.
- 모바일 관리자 신청 화면은 긴 이력표와 Riot ID 때문에 root horizontal overflow가 발생할 수 있어 표 자체 스크롤과 root 폭 제한을 함께 적용했다.

## Decision Log

- 2026-08-04 — 전역 Match 원본과 시즌별 정산을 `SeasonMatch`로 분리 / 중복 raw 없이 요구한 season scope unique를 보장하기 위해.
- 2026-08-04 — mission 정의를 `(code,version)`, 정상 progress를 `(assignment,participantMatch,evaluatorVersion)`로 유일화 / 과거 재현과 correction을 동시에 보장하기 위해.
- 2026-08-04 — Week/FinalStanding snapshot 분리 / 2주 시즌에서 주차와 시즌 최종 결과를 혼동하지 않기 위해.
- 2026-08-04 — public realName opt-in false, 가입 후 비자동 로그인 / 개인정보 최소화와 session 경계 단순화를 위해.
- 2026-08-04 — 최소 20명 보수 적용, Vercel Hobby sync 제외 / 현재 접근 가능한 공식 source의 실제 제약을 따르기 위해.
- 2026-08-04 — 하위 티어 baseline 누락 시 entitlement 보류 / 근거 없는 표준화 매핑을 막기 위해.
- 2026-08-05 — 거절 후 신청은 새 행, 승인 후 변경은 PUUID 신원 갱신으로 분리 / 신청·검토 이력을 보존하기 위해.
- 2026-08-05 — 진행 중 승인은 검증 시점 랭크 snapshot과 남은 주차만 생성 / 중도 참가를 과거 주차에 소급하지 않기 위해.

## 완료 보고

- 결과: 세션 00 산출물은 현재 상태 감사, 실행 가능한 18단계 dependency graph, critical path, 데이터/외부 위험, 실제 미결정 목록을 제공한다.
- 검증: 문서 요구 항목·세션 번호·필수 리스크·공식 source를 정적 검사하고, 앱 명령은 존재하지 않으므로 실행하지 않는다.
- 남은 외부 의존성: `docs/OPEN_QUESTIONS.md` Q-001~Q-007과 `docs/RISK_REGISTER.md`의 LAUNCH 항목.
