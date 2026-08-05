# 개발·배포·대회 운영 Runbook

## 1. 로컬 개발 준비

필수 도구:

- Git
- 현재 지원되는 Node.js LTS
- Corepack/pnpm
- PostgreSQL 또는 호환되는 개발 DB

권장 시작:

```powershell
git init
corepack enable
pnpm install
Copy-Item .env.example .env
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

Node.js 24 LTS(`>=24.15.0`)와 pnpm 11을 기준으로 한다. 현재 저장소에는 Prisma schema와 migration이 있으므로 새 DB나 빈 DB에는 seed보다 먼저 `pnpm db:migrate:deploy`를 실행한다. `pnpm db:migrate`는 로컬에서 새 migration을 작성할 때만 사용하고 production에서는 실행하지 않는다. Windows PowerShell 정책 문제로 pnpm script가 차단되면 시스템 전체 보안 설정을 낮추지 말고 `pnpm.cmd` 또는 명령 프롬프트를 사용한다.

## 2. 환경 변수

`.env.example`에 이름과 설명만 넣고 실제 secret은 커밋하지 않는다.

```dotenv
NODE_ENV=development
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
CRON_SECRET=
POINT_DRAW_SECRET=
RIOT_API_KEY=
RIOT_PLATFORM_REGION=KR
RIOT_REGIONAL_ROUTE=ASIA
MOCK_RIOT_API=true
SYNC_MODE=MANUAL
POINT_MODE=RANDOM_17_23
AUTO_REVEAL_HOURS=12
ALLOW_DEMO_MVP_REWARDS=false
SYNC_BATCH_SIZE=5
SYNC_OVERLAP_MINUTES=30
SYNC_TIME_BUDGET_MS=20000
SYNC_MATCH_PAGE_SIZE=20
SYNC_PARTICIPANT_COOLDOWN_SECONDS=60
SYNC_LEASE_SECONDS=120
SYNC_LEASE_RECOVERY_GRACE_SECONDS=30
NEXT_PUBLIC_POLL_INTERVAL_MS=20000
APP_URL=http://localhost:3000
APP_TIME_ZONE=Asia/Seoul
TEST_DATABASE_URL=
E2E_DATABASE_URL=
```

로컬 `.env`는 `NODE_ENV=development`, test runner는 `NODE_ENV=test`, production 배포는 `NODE_ENV=production`을 명시한다. 개발 seed는 `development` 또는 `test`에서만 실행되고 값이 없거나 다른 환경에서는 fail-closed된다. `AUTH_SECRET`, `CRON_SECRET`, `POINT_DRAW_SECRET`은 서로 다른 32자 이상의 안전한 난수로 채운다. production에서 `POINT_DRAW_SECRET`은 필수이며 개발·테스트만 `AUTH_SECRET` fallback을 허용한다. `TEST_DATABASE_URL`은 integration test 준비에, `E2E_DATABASE_URL`은 Playwright의 spec별 격리 schema 생성에 사용한다. 두 테스트 URL은 서로 달라야 하며 모두 `DATABASE_URL`과 분리한다. `TEST_DATABASE_URL`이 `DATABASE_URL`과 같으면 `pnpm db:test:prepare`가 변경 전에 중단한다. 선택 변수는 architecture 문서에 추가하되 이름을 여러 방식으로 중복 정의하지 않는다. 앱 시작 시 환경 변수 schema validation을 실행하고 secret 값 자체는 오류에 출력하지 않는다.

포인트 nonce는 `POINT_DRAW_SECRET`으로 보호되므로 일반 secret rotation처럼 즉시 교체하지 않는다. 회전 전 모든 FIRST/SECOND envelope를 새 키로 재암호화하고 commitment 검증 dry-run을 통과시킨 뒤 구 키를 폐기한다. 현재 저장소에는 rotation CLI가 없으므로 운영 중 키 회전이 필요하면 먼저 별도 migration 도구를 구현해야 한다.

## 3. 최초 관리자 생성

production에서 공개 회원가입만으로 ADMIN이 되게 하지 않는다. 다음 중 한 방식을 구현한다.

- 일회성 CLI `pnpm admin:create`
- 환경 변수에 지정한 loginId를 최초 deploy에서 한 번 승격하는 명시적 bootstrap

이 저장소는 CLI 방식을 사용한다. 빈 운영 DB에는 개발용 `pnpm db:seed`를 실행하지 않는다. migration을 적용하고 production-safe 미션 catalog를 bootstrap한 뒤 최초 관리자를 생성한다.

```powershell
pnpm db:preflight:migrations
pnpm db:migrate:deploy
pnpm db:bootstrap:missions
pnpm admin:create -- --login-id deluxe.admin --display-name "운영 관리자"
```

`db:preflight:migrations`는 과거 MVP 평가 행의 안전한 season mapping 여부를 read-only로 검사하고 모호한 legacy 행이 있으면 deploy 전에 중단한다. `db:bootstrap:missions`는 M001~M100 정의와 evaluator mapping만 idempotent하게 준비하며 DEMO_ONLY 사용자·경기·법적 문서를 생성하지 않아야 한다. 비밀번호는 TTY에서 숨김 입력한다. 비대화형 자동화에서는 해당 한 명령의 프로세스 환경에만 `ADMIN_CREATE_PASSWORD`를 설정하고 `.env`, shell history, CI log에 남기지 않는다. CLI는 이미 활성 관리자가 있으면 중단하며 비밀번호를 출력하지 않는다. 모든 후속 관리자 승격은 기존 ADMIN이 수행하고 `sessionVersion` 증가, 기존 세션 폐기, AuditLog를 함께 남긴다. 개발 seed에는 별도 DEMO_ONLY 관리자가 있으므로 seed DB에서는 bootstrap CLI를 실행하지 않는다.

## 4. Mock 모드

`MOCK_RIOT_API=true`에서 다음 시나리오가 결정론적으로 제공되어야 한다.

- 정상 Riot ID
- 존재하지 않는 Riot ID
- API rate limit
- 만료된 key
- 솔로 랭크 승리/패배
- remake/무효 queue
- timeline 포함 경기
- timeline 영구 누락 및 첫 시도 실패 후 재시도 성공
- 여러 페이지 match ID와 비지원 queue/remake
- PUUID는 같고 표시 Riot ID가 길게 변경된 계정
- MVP/ACE 동점
- 여러 미션 동시 완료
- 누적 미션 진행
- 신청 성공 fixture: `Cloud Tempo#0217`, `ApprovalReady#KR1`
- 신청 오류 fixture: `NotFound#KR1`, `TemporaryFailure#KR1`, `RateLimited#KR1`, `InvalidKey#KR1`
- E2E 격리 fixture namespace: `E2E-<unique>#TEST`는 입력에서 결정론적 PUUID를 생성

seed마다 무작위 결과가 바뀌지 않게 fixture와 clock을 고정한다. 데모 UI에서 Mock 데이터임을 숨기지 않는다.

## 5. 실 Riot API 연결 절차

1. 서버 환경에만 API key를 설정한다.
2. staging에서 `MOCK_RIOT_API=false`로 전환한다.
3. Account-V1로 테스트 Riot ID를 PUUID로 변환한다.
4. KR/ASIA routing 로그가 올바른지 확인한다. 로그에는 key가 없어야 한다.
5. 최근 match ID 목록과 match info를 조회한다.
6. timeline이 필요한 fixture를 하나 조회한다.
7. 404, 429, 403을 의도적으로 mock해 오류 UI와 재시도를 확인한다.
8. 최소 3개 계정을 한 batch에서 동기화한다.
9. 동일 batch 재실행 시 점수 변화가 없는지 확인한다.
10. production key 준비 전 공개 운영을 시작하지 않는다.

## 6. DB 마이그레이션

### 개발

- schema 변경과 migration 파일을 함께 커밋한다.
- seed가 새 schema에서 처음부터 동작해야 한다.
- destructive migration은 샘플 데이터를 포함해 dry run한다.

### Staging/Production

1. backup 또는 provider snapshot을 확인한다.
2. migration SQL을 리뷰한다.
3. read-only 또는 maintenance 필요 여부를 판단한다.
4. 승인된 deploy migration 명령을 한 번 실행한다.
5. health check와 핵심 query를 확인한다.
6. 실패 시 application rollback과 DB forward-fix/restore 절차를 구분한다.

production DB에서 `db push`로 즉석 변경하지 않는다.

## 7. 시즌 생성 체크리스트

- [ ] 시즌 이름·slug
- [ ] 시작/종료 시각(Asia/Seoul 화면, UTC 저장)
- [ ] 1주 또는 2주 주차 경계
- [ ] 인정 queue와 최소 경기 시간
- [ ] 시작 기준 랭크 snapshot 시각
- [ ] 포인트 모드 RANDOM_17_23 또는 FIXED_20
- [ ] 자동 공개 시간
- [ ] 재추첨 기한
- [ ] 미션 풀 버전과 점수
- [ ] MVP baseline published version
- [ ] 규칙·개인정보·고지 문서 published version
- [ ] 참가 신청 마감
- [ ] 최신 Community Competition Guidelines 적용 대상·제외 조직 여부 확인
- [ ] 적용 가능한 공식 대회 제출 양식의 URL·제출 여부와 제출 증빙 기록
- [ ] 이벤트명·홍보물의 비공식성, 금지 스폰서, Riot 자산 사용 범위 검토
- [ ] Riot API 제품 등록·키 유형·비공식 제품 고지 상태 확인
- [ ] 동기화 모드와 secret

`start` 버튼은 필수 항목이 없으면 이유를 나열하고 실행되지 않아야 한다.

## 8. 참가 승인

1. 신청의 `gameName#tagLine`을 서버에서 검증한다.
2. PUUID 중복 참가 여부를 확인한다.
3. 현재 표시 Riot ID와 필요 랭크 정보를 확인한다.
4. 관리자 승인 또는 구체적 사유로 거절한다.
5. 승인 시 참가자·시즌 연결·초기 상태를 한 transaction에서 만든다.
6. 시작 후 중도 참가 정책을 적용하고 AuditLog를 남긴다.

거절된 신청은 이력을 유지하고 새 행으로 재신청한다. PENDING 신청은 한 사용자당 하나이며 사용자가 덮어쓰지 않는다. 승인 후 Riot ID 변경은 참가 신청이 아닌 PUUID 기준 갱신 흐름으로 처리한다. 진행 중 승인에서는 신청 검증 시점 랭크를 시작 snapshot으로 사용하고, 승인 이후 남아 있는 주차 상태만 초기화한다.

## 9. 동기화 운영

### 수동

관리자 `/admin/matches`에서 대상 참가자 또는 전체 제한 batch를 선택한다. 브라우저 요청은 ADMIN 세션·Origin 검증·rate limit을 통과한 뒤 `POST /api/admin/sync`를 호출한다. 동일 시즌의 버튼 연타는 `JobLease`로 한 작업만 실행한다.

### 예약

- `GITHUB_SCHEDULE`과 `WORKER`는 JSON `POST /api/scheduler/sync`, `VERCEL_CRON`은 공식 bodyless `GET /api/scheduler/sync`를 사용한다. `MANUAL`에서는 예약 endpoint가 비활성화된다.
- 요청은 `Authorization: Bearer <CRON_SECRET>`을 constant-time 비교한 뒤 실행한다. secret, Authorization, query/payload는 로그에 남기지 않는다.
- GitHub/worker POST는 `Content-Type: application/json`과 8자 이상의 delivery별 `invocationKey`가 필수다. 같은 key 재전송은 기존 `SyncRun` 결과를 반환한다.
- Vercel GET은 query를 허용하지 않고 수신 UTC minute bucket을 invocation key로 사용한다.
- `JobLease`로 동일 job의 동시 실행을 막는다.
- lease 만료 뒤에도 `SYNC_LEASE_RECOVERY_GRACE_SECONDS` 동안 회수하지 않아 늦은 heartbeat와의 경합을 줄인다.
- batch size와 time budget 안에서 처리한다.
- 남은 대상은 cursor로 다음 호출에 넘긴다.
- 각 `SyncRun`에 시작/종료, 처리 수, 신규 경기, 건너뜀, 오류 수를 기록한다.
- 성공 응답은 `runId/processed/new/skipped/failed/remaining`만 제공한다. `remaining=true`면 다음 bounded invocation이 이어서 처리한다.

#### GitHub Actions 무료 운영

1. repository variable `SCHEDULER_BASE_URL`에 production deployment base URL을 넣는다.
2. repository secret `CRON_SECRET`에 서버와 같은 32자 이상 secret을 넣는다.
3. 서버 `SYNC_MODE=GITHUB_SCHEDULE`을 설정한다.
4. `.github/workflows/scheduler.yml`의 `workflow_dispatch`를 한 번 실행해 sync/scoring/missions 세 endpoint가 모두 2xx인지 job summary에서 확인한다.
5. `/admin/matches`에서 마지막 성공, 실패 code, 429/5xx, backlog lag를 확인한다.

GitHub schedule의 최소 간격은 5분이지만 혼잡 시 지연·누락될 수 있다. 공개 저장소는 60일간 활동이 없으면 예약 workflow가 비활성화될 수 있으므로 정확한 SLA가 아니며 Actions 비활성화 여부를 운영 체크리스트에 넣는다. 누락은 다음 overlap scan과 수동 `workflow_dispatch`로 복구한다.

#### Vercel/worker 안정 운영

- 2026-08-05 Vercel 공식 문서 재확인 기준 Hobby Cron은 하루 한 번, 최대 59분 오차이므로 경기 동기화에 사용하지 않는다.
- 5분 주기가 허용되는 plan에서만 README의 `vercel.json` 예시대로 sync/scoring/missions 세 GET 경로를 stagger해 추가한다. Vercel project `CRON_SECRET`은 자동으로 Bearer header에 실린다.
- worker는 `pnpm sync:worker -- --invocation-key <delivery-id>`로 공용 service를 한 번 호출한다. supervisor가 non-zero exit와 `remaining`을 감시하고 재호출한다.
- 함수/worker timeout보다 `SYNC_TIME_BUDGET_MS`를 충분히 짧게 유지한다. 외부 API backoff까지 고려해 기본은 20초다.

### 점수 정산·공개 작업

- 인정 경기 ingest 직후 `PointDraw`, `MATCH_INITIAL`, 참가자 주차 점수·승패·순위와 처리 상태를 하나의 Serializable transaction에서 반영한다.
- 중간 실패로 `PROCESSING`에 남은 경기는 다음 sync의 backfill 또는 관리자 `POST /api/admin/scoring/backfill`로 복구한다.
- 예약 점수 작업은 `GITHUB_SCHEDULE`/`WORKER`에서 JSON `POST /api/scheduler/scoring`, `VERCEL_CRON`에서 bodyless `GET /api/scheduler/scoring`을 사용한다. 모든 모드는 `Authorization: Bearer <CRON_SECRET>`을 요구하며 `MANUAL`에서는 route가 비활성화된다.
- 자동 공개 기준은 시즌의 `autoRevealHours`이며 기본 12시간이다. 공개는 상태와 시각만 바꾸고 원장·순위를 바꾸지 않는다.
- 참가자 목록 `GET /api/draws`는 봉인 상태의 value/nonce를 반환하지 않는다. `POST /api/draws/{id}/reveal`과 `POST /api/draws/{id}/reroll`은 본인 세션, 정확한 Origin, rate limit을 다시 확인한다.
- DEMO_ONLY 재추첨권은 `ALLOW_DEMO_MVP_REWARDS=true`인 명시적 개발·테스트 환경에서만 소비할 수 있고 production 환경 검증은 이 설정을 거부한다.
- ingest는 10명의 시작 tier snapshot을 외부 호출 단계에서 수집한 뒤 MVP/ACE 평가 outbox를 만든다. 점수 정산 후 평가를 즉시 실행하고 실패한 `EVALUATE_MVP_ACE` outbox는 같은 scheduler/admin backfill에서 재시도한다.
- baseline 게시 전, 지원하지 않는 tier, position·metric 누락은 평가를 pending으로 기록하며 포인트 첫 정산을 되돌리지 않는다. pending 상태에는 재추첨권이 없다. 새 주차는 `PUBLISHED` baseline만 선택하고, 이미 주차에 고정된 `PUBLISHED`/`RETIRED` immutable 버전은 재평가·복구에서 그대로 사용한다.

### 미션 lifecycle 작업

- 예약 작업은 `GITHUB_SCHEDULE`/`WORKER`에서 JSON `POST /api/scheduler/missions`와 선택 body `{ "limit": 20 }`, `VERCEL_CRON`에서 bodyless `GET /api/scheduler/missions`를 사용한다. 모든 모드는 `Authorization: Bearer <CRON_SECRET>`을 요구하며 `MANUAL`에서는 route가 비활성화된다.
- 같은 시각에 반복 호출해도 ParticipantWeek 잠금, assignment selection key, active definition partial unique index로 중복 배정하지 않는다.
- 주차 시작 후 아직 초기화되지 않은 ParticipantWeek는 최초 5개를 배정하고, 이후 주차 시작 anchor 기준 누락된 6시간 tick을 한 번에 계산한다.
- 참가자 조회는 `GET /api/missions`, 리롤은 `POST /api/missions/{assignmentId}/reroll`과 UUID `idempotencyKey`를 사용한다. 리롤은 본인 세션·Origin·rate limit을 다시 확인한다.
- 경기 ingest는 assignment가 0개여도 `MissionMatchSnapshot` 부모를 생성하고 `EVALUATE_MISSIONS` outbox를 남긴다. M001~M100 evaluator worker는 summary·timeline·static·aggregate 판정을 처리하고, 필요한 timeline/Data Dragon을 transaction 밖에서 수집한 뒤 평가한다. `PENDING_DATA`는 실패로 완료하지 않고 retry 대상으로 유지한다.
- assignment 후보는 catalog code와 registry evaluator key가 모두 일치하는 M001~M100 정의로 제한한다. seed가 evaluator mapping 누락을 발견하면 즉시 실패한다. M100은 MVP/ACE backfill 다음에 평가하며 게시된 non-demo baseline award가 아니면 완료하지 않는다.
- 미션 화면은 20초 polling으로 갱신한다. `/me`와 `/missions`는 같은 주차의 보지 않은 복수 완료를 한 알림으로 합치며, `/history`는 현재 테이블을 재계산하지 않고 종료 시 생성한 `WeekSnapshot.missionStandings`만 읽는다.

### 기회성

페이지 방문 시 무조건 Riot API를 호출하지 않는다. 마지막 sync가 threshold보다 오래되었고 participant별 cooldown이 지났을 때 비동기 요청을 시도한다. 사용자 응답을 외부 호출 완료까지 무한 대기시키지 않는다.

## 10. 장애 처리

### 401/403 Riot API

- 자동 반복 호출을 중단한다.
- 운영자 경고를 생성한다.
- key 상태와 제품 권한을 확인한다.
- 사이트는 마지막 성공 데이터를 표시하고 “갱신 지연”을 명시한다.

### 429 Rate limit

- `Retry-After`를 기록한다.
- 대상별 backoff와 jitter를 적용한다.
- 전체 batch를 즉시 실패시키기보다 재처리 큐로 넘긴다.
- 같은 participant를 여러 사용자 요청이 중복 갱신하지 않게 한다.
- `SyncRun.rateLimitSnapshot`의 API 호출 수, 2xx/404/429/5xx, 재시도 수, 최대 Retry-After를 확인한다.

### 5xx/네트워크

- 제한된 횟수의 exponential backoff
- 재시도 소진 후 SyncRunItem 실패 기록
- 다음 scheduler에서 재시도

### DB 연결 장애

- 점수 정산 전 transaction 실패는 아무 것도 반영되지 않아야 한다.
- 외부 응답을 얻었더라도 DB 반영 실패 시 다음 run이 안전하게 다시 처리한다.
- 복구 후 ledger reconciliation을 실행한다.

### 잘못된 경기 판정

1. 원본 raw payload와 evaluator version을 확인한다.
2. 수정 evaluator를 새 버전으로 배포한다.
3. dry-run 재평가 차이를 출력한다.
4. 해당 경기의 `MissionProgressEvent` 존재 여부를 확인한다. 존재하면 일반 경기 무효화 API는 `SCORING_CONFLICT`로 fail-closed되므로 메인 점수만 먼저 뒤집지 않는다.
5. 미션 효과가 없으면 관리자 승인 후 append-only reversal ledger를 추가한다. 미션 효과가 있으면 versioned evaluator와 signed correction/rebuild 절차를 별도로 승인한다.
6. score·mission 원장과 cache를 대사하고 참가자에게 영향을 공개한다.

## 11. 점수 대사

`pnpm reconcile:scores` 또는 관리자 dry-run 도구는 다음을 비교한다. dry-run에서 불일치가 있으면 보고서를 출력하고 exit code 2를 반환한다. 검토 후 `pnpm reconcile:scores -- --repair`를 실행하면 원장 행은 건드리지 않고 캐시·순위를 복구하며 `ScoreReconciliation`과 AuditLog를 남긴다. 특정 주차는 `--week-id <uuid>`로 제한한다.

- ParticipantWeek 표시 점수
- 유효 ScoreLedger 합
- 인정·처리 완료 경기별 PointDraw 존재, 승패 부호, 상태와 final 값
- 경기별 `MATCH_INITIAL` 정확히 1건과 draw 금액 일치
- reroll 상태와 `MATCH_REROLL_ADJUSTMENT` 차액
- 무효화·복구 cycle의 reversal/reinstatement pair, 반전 금액과 ledger net
- `ParticipantMatch.pointSignedCached`와 권위 원장 일치
- 관리자 adjustment

차이가 있으면 자동 덮어쓰기 전에 보고서를 생성한다. cache만 어긋난 경우에만 idempotent reconciliation event로 복구하고, draw·원장·reversal 같은 권위 데이터 결함은 `unresolved`로 남겨 finalize를 차단한다.

## 12. 미션 대사

- 활성 assignment 수가 정상적으로 0~5인지
- refill credit 0~3인지
- 동일 assignment completion 중복 여부
- progress event와 currentValue 일치
- 경기 시작 snapshot과 평가 assignment 일치
- 완료 점수 ledger 합과 주간 순위 일치

## 13. 이벤트 중 운영 화면

운영자에게 최소 다음을 보여준다.

- 마지막 성공 sync와 다음 예정 시각
- 최근 24시간 신규 경기 수
- 429/403/5xx 수
- 처리 대기 경기
- reconciliation 오류
- unpublished/DEMO_ONLY baseline 경고
- 자동 공개 대기 draw 수
- 실패한 timeline mission 판정
- scheduler mode
- 마지막 run의 duration/API 2xx·404·429·5xx·retry 수
- 자동 공개, MVP/ACE, 미션 outbox의 oldest pending lag
- stale lease 수와 최근 실패 stage/error code/retryable 여부

## 14. 이벤트 종료

1. 종료 시각 이전 시작 경기의 grace period를 기다린다.
2. 마지막 전체 sync를 실행한다.
3. 활성 `JobLease`와 최근 `RUNNING` SyncRun이 없고 pending match/outbox가 0인지 확인한다.
4. 실패 항목을 재처리하고 모든 `SEALED` PointDraw를 공개 또는 운영상 해결한다.
5. 전체 score/mission reconciliation을 실행한다.
6. 관리자 확인 후 시즌 finalize를 실행한다.
7. FinalStandingSnapshot과 WeekSnapshot을 만든다.
8. 점수·미션 mutation을 차단한다.
9. 결과 CSV/JSON을 export한다.
10. 개인정보 보존 정책에 따라 raw data retention 일정을 기록한다.

finalize는 반복 호출해도 snapshot이 중복 생성되지 않아야 하며, unfinalize는 일반 UI에서 제공하지 않는다.
finalize transaction은 시즌 행을 잠근 뒤 pending match/outbox, `SEALED` draw, 활성 sync lease/run을 확인하고, 경기별 draw·initial·reroll·무효화/복구 원장과 `ParticipantMatch` cache, 메인 `ScoreLedger` 합과 `mainScoreCached`, `MissionCompletionLedger` 합과 `missionScoreCached`를 모두 대조한다. 어느 하나라도 다르면 snapshot이나 상태를 만들기 전에 차단한다. 종료 뒤에는 DB trigger도 경기·정산·미션·MVP·주차 cache 쓰기를 거부한다.

## 15. 백업과 내보내기

- provider DB snapshot 정책 확인
- 시즌 시작 직전 backup
- 종료 직전/직후 backup
- 참가자·경기·ledger·mission completion·설정 version export
- secret과 password hash는 export에서 제외
- CSV formula injection 방지

## 16. 개인정보와 삭제 요청

- 수집 항목과 목적을 규칙/개인정보 문서에 명시한다.
- 계정 삭제와 대회 기록 보존을 분리한다.
- 통계 무결성을 위해 필요한 경우 표시명 익명화 후 경기·ledger 식별자는 유지한다.
- raw Riot payload의 보존 기간을 설정한다.
- 관리자 export 접근을 기록한다.

## 17. 배포 전 최종 명령

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

DB와 외부 자격 증명이 없어 실행하지 못한 명령은 성공으로 보고하지 않는다. 필요한 조건과 재현 명령을 릴리스 체크리스트에 남긴다.

## 18. 롤백 기준

즉시 롤백 또는 feature disable 대상:

- 점수 이중 반영
- 권한 상승 또는 개인정보 노출
- API key 노출
- 광범위한 잘못된 미션 완료
- migration으로 인한 데이터 손상
- 관리자 조정 감사 로그 누락

UI 경미한 문제는 별도 hotfix로 처리할 수 있지만, 데이터 무결성 결함이 있으면 sync·정산 관련 feature flag를 먼저 끈다.
