# 디럭스 솔랭

약 20명이 참여하는 League of Legends 솔로 랭크 대회를 운영하기 위한 Next.js 애플리케이션입니다. 현재 저장소에는 production-grade 기반과 전체 Prisma/PostgreSQL 데이터 모델, Credentials 인증·DB 세션·USER/ADMIN 권한 경계, 결정적 개발 seed, Riot API/Mock client, idempotent 경기 동기화·랭크 snapshot pipeline, 17~~23점 봉인 정산·공개·재추첨 원장, 표준화 MVP/ACE 평가, M001~~M100 주간 미션 평가·누적·순위 흐름, 원장과 snapshot을 직접 집계하는 공개 대시보드·순위·기록 read model이 구성되어 있습니다.

이 프로젝트는 Riot Games 또는 LoL Esports의 공식 서비스가 아니며, Riot Games의 승인·후원·운영을 암시하지 않습니다.

## 요구 환경

- Node.js 24 LTS (`>=24.15.0`)
- pnpm 11 (`packageManager`에 고정)
- Git
- PostgreSQL 15 이상 권장(데이터 세션 및 통합 테스트에서 필요)
- Windows 11, macOS 또는 Linux

현재 안정 조합은 Next.js 16, React 19, Prisma 7입니다. Prisma 7 직접 연결은 PostgreSQL 드라이버 어댑터를 사용합니다.

`pnpm-workspace.yaml`은 pnpm 11이 요구하는 프로젝트 설정 파일로만 사용합니다. `packages` 항목이나 하위 패키지가 없으므로 애플리케이션은 루트 단일 패키지입니다.

## Windows 11에서 시작하기

PowerShell에서 저장소 루트로 이동한 뒤 실행합니다.

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

`.env`의 `AUTH_SECRET`과 `CRON_SECRET`에는 서로 다른 32자 이상의 임의 문자열을 입력해야 합니다. 안전한 값을 생성하는 PowerShell 예시는 다음과 같습니다.

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

같은 명령을 두 번 실행해 각 secret에 다른 값을 사용합니다. 실제 값은 채팅, 이슈, 커밋 또는 로그에 복사하지 않습니다. 앱은 [http://localhost:3000](http://localhost:3000), health endpoint는 [http://localhost:3000/api/health](http://localhost:3000/api/health)에서 확인합니다.

PowerShell 실행 정책으로 `pnpm.ps1`이 차단되면 시스템 전체 보안 설정을 낮추지 말고 `pnpm.cmd` 또는 명령 프롬프트를 사용합니다.

## 환경 변수

`.env.example`이 권위 있는 이름 목록입니다. 애플리케이션 시작 시 Zod schema로 검증하며, 실패 메시지는 잘못된 변수명만 표시하고 값은 출력하지 않습니다.

| 변수                                | 필수 조건              | 용도                                    |
| ----------------------------------- | ---------------------- | --------------------------------------- |
| `DATABASE_URL`                      | 항상                   | 애플리케이션 PostgreSQL 연결            |
| `DIRECT_URL`                        | 선택                   | pooled URL과 분리한 migration 직접 연결 |
| `AUTH_SECRET`                       | 항상, 32자 이상        | 서명 세션 키 재료                       |
| `CRON_SECRET`                       | 항상, 32자 이상        | 예약 endpoint 인증 키 재료              |
| `POINT_DRAW_SECRET`                 | production, 32자 이상  | 봉인 nonce 전용 AES 키 재료             |
| `RIOT_API_KEY`                      | `MOCK_RIOT_API=false`  | 서버 전용 Riot API key                  |
| `MOCK_RIOT_API`                     | 기본 `true`            | Mock/실 API adapter 선택                |
| `RIOT_PLATFORM_REGION`              | 기본 `KR`              | platform routing                        |
| `RIOT_REGIONAL_ROUTE`               | 기본 `ASIA`            | regional routing                        |
| `SYNC_MODE`                         | 기본 `MANUAL`          | scheduler adapter 선택                  |
| `SYNC_BATCH_SIZE`                   | 기본 `5`               | 한 실행의 최대 참가자 수                |
| `SYNC_OVERLAP_MINUTES`              | 기본 `30`              | late-arriving 경기 재조회 범위          |
| `SYNC_TIME_BUDGET_MS`               | 기본 `20000`           | 한 실행의 soft time budget              |
| `SYNC_MATCH_PAGE_SIZE`              | 기본 `20`              | Match-V5 목록 page 크기                 |
| `SYNC_PARTICIPANT_COOLDOWN_SECONDS` | 기본 `60`              | 정상 참가자 재조회 cooldown             |
| `SYNC_LEASE_SECONDS`                | 기본 `120`             | 시즌 sync lease 만료                    |
| `SYNC_LEASE_RECOVERY_GRACE_SECONDS` | 기본 `30`              | 만료 lease 회수 전 안전 유예            |
| `POINT_MODE`                        | 기본 `RANDOM_17_23`    | 포인트 전략과 안전 fallback             |
| `AUTO_REVEAL_HOURS`                 | 기본 `12`              | 시즌 기본 자동 공개 시간                |
| `ALLOW_DEMO_MVP_REWARDS`            | 기본 `false`           | 개발 fixture 재추첨권 허용              |
| `APP_URL`                           | 항상                   | 애플리케이션 기준 URL                   |
| `APP_TIME_ZONE`                     | 항상 `Asia/Seoul`      | 화면·주차 기준 시간대                   |
| `NEXT_PUBLIC_POLL_INTERVAL_MS`      | 기본 `20000`           | 브라우저 공개 polling 간격              |
| `TEST_DATABASE_URL`                 | DB 통합 테스트 준비 시 | 격리된 테스트 DB                        |
| `E2E_DATABASE_URL`                  | E2E DB 재정의 시       | Playwright 전용 격리 DB                 |
| `SEED_PASSWORD`                     | seed 실행 시 선택      | 개발 fixture 계정 공통 비밀번호         |

`NEXT_PUBLIC_*` 이외의 모듈은 브라우저에서 읽지 않습니다. `src/lib/env/server.ts`는 `server-only`로 표시되어 있고, client component에서 가져오면 저장소 ESLint 규칙과 Next.js build 경계가 차단합니다.

## Mock 모드

기본값은 `MOCK_RIOT_API=true`입니다. 공통 `RiotClient` composition root가 외부 네트워크를 사용하지 않는 결정적 Mock adapter를 선택합니다. 실제 key가 없어도 기반 페이지, health check, 참가 신청, 단위·DB 통합 테스트와 브라우저 smoke를 실행할 수 있습니다.

Mock client는 다음 경계를 제공합니다.

- 성공 계정: `Cloud Tempo#0217`, `ApprovalReady#KR1`
- 계정 오류: `NotFound#KR1`, `TemporaryFailure#KR1`, `RateLimited#KR1`, `InvalidKey#KR1`
- PUUID는 유지하면서 긴 표시 Riot ID로 변경된 `OldDisplayName#KR1`
- `start`/`count` 페이지가 적용되는 승리·패배·remake·비지원 queue match 목록
- 5개 포지션과 summary/timeline 미션 대표 필드
- timeline 영구 누락과 첫 호출 실패 후 두 번째 호출 성공 시나리오
- 입력에서 동일 PUUID를 만드는 `E2E-<unique>#TEST` namespace

Mock clock과 fixture ID는 고정되어 같은 입력이 같은 결과를 냅니다. DB seed의 `DEMO_ONLY` 경기·MVP baseline도 실제 Riot 데이터로 오인하지 않습니다.

`MOCK_RIOT_API=false`로 바꾸면 `RIOT_API_KEY`가 필수입니다. production 공개 운영은 Riot 제품 등록과 운영 정책 확인 전 시작하지 않습니다.

## 공개 대시보드 read model

메인, 전체 순위, 경기 기록, 참가자 상세, 내 정보, 주간 미션, 지난 기록, 규칙 화면은 Server Component에서 `src/server/dashboard`의 DTO query를 호출합니다. 점수는 append-only `ScoreLedger`, 미션 점수는 `MissionCompletionLedger`, 과거 순위는 immutable snapshot을 권위로 사용하며 UI가 Prisma나 Riot 응답 구조를 직접 읽지 않습니다.

공개 query는 짧은 TTL과 공통 cache tag를 사용하고 승인·동기화·정산·공개·재추첨·미션 mutation 뒤 해당 tag를 무효화합니다. 모든 공개 화면은 기본 20초 간격으로 Server Component read model을 다시 요청하며, hidden 탭에서는 polling을 중단하고 탭 복귀 시 즉시 한 번 갱신합니다. 조회 장애는 마지막 동기화 시각과 재시도 안내가 있는 unavailable/empty state로 제한하며 PUUID, draw nonce, raw payload는 공개 DTO에 포함하지 않습니다.

## Riot API와 Data Dragon 경계

- Account-V1과 Match-V5는 `asia.api.riotgames.com`, Summoner-V4와 League-V4는 `kr.api.riotgames.com`으로 분리합니다.
- API key는 `server-only` transport가 `X-Riot-Token` 요청 header에만 넣습니다. URL, 정규화 DTO, 오류 메시지, 관측 로그에는 넣지 않습니다.
- timeout/abort와 401·403·404·429·5xx·network typed error를 제공하며, 429의 `Retry-After`보다 일찍 재시도하지 않습니다. 5xx/network는 제한된 exponential backoff+jitter를 사용합니다.
- 외부 JSON은 Zod schema로 검증한 뒤 `RiotIdentity`, `RankedSoloSnapshot`, `NormalizedMatch`, `NormalizedTimeline` 등 내부 DTO로 정규화합니다. adapter는 raw payload를 DB나 UI에 전달하지 않습니다.
- Data Dragon은 경기 patch와 같은 major/minor의 최신 build를 우선하고, 없으면 같은 season에서 가장 가까운 버전을 고릅니다. 성공 응답을 메모리에 캐시하고 장애 시 마지막 성공 snapshot을 사용합니다.
- cold-start Data Dragon 장애에는 미션 개발용 최소 내장 champion/item/rune 분류만 사용합니다. 이 제한된 fallback에 없는 정적 데이터는 추측하지 말고 후속 evaluator에서 `PENDING_DATA`로 처리해야 합니다.

live adapter와 오류 경계는 합성 응답을 사용한 network-free contract test로 검증했습니다. 실제 Riot 자격 증명을 사용한 staging dry run과 production 제품 등록은 별도 운영 작업입니다.

## 경기 동기화

관리자는 `/admin/matches`에서 제한 batch 또는 참가자 한 명을 수동 동기화할 수 있습니다. `POST /api/admin/sync`는 ADMIN 세션, 정확한 Origin, rate limit을 요구합니다. 모든 adapter는 동일한 idempotent `runMatchSync` application service를 호출합니다.

| `SYNC_MODE`       | 호출 방식                                      | replay/continuation 정책                      |
| ----------------- | ---------------------------------------------- | --------------------------------------------- |
| `MANUAL`          | 관리자 `POST /api/admin/sync`                  | 관리자 UUID invocation key와 시즌 lease       |
| `GITHUB_SCHEDULE` | `POST /api/scheduler/sync` + JSON              | workflow run/attempt 기반 invocation key 필수 |
| `VERCEL_CRON`     | Vercel 공식 bodyless `GET /api/scheduler/sync` | 수신 UTC minute bucket invocation key         |
| `WORKER`          | `pnpm sync:worker` 또는 같은 adapter import    | worker delivery ID 권장, 없으면 UUID 생성     |

예약 endpoint는 `Authorization: Bearer <CRON_SECRET>`을 constant-time 비교하고 모드별 method, `application/json` content type, query payload 금지를 적용합니다. GitHub/worker의 동일 invocation key 재전송은 기존 `SyncRun` 결과를 반환하며, 다른 호출이 겹치면 시즌 lease와 DB unique constraint가 이중 반영을 차단합니다. 성공 응답은 `runId`, `processed`, `new`, `skipped`, `failed`, `remaining`만 포함하고 PUUID, API key, raw payload는 포함하지 않습니다.

### GitHub Actions 무료 운영

`.github/workflows/scheduler.yml`은 매시 2분부터 약 5분 간격으로 sync, scoring/자동 공개, mission lifecycle endpoint를 제한 batch로 호출합니다. 저장소 Settings에서 `SCHEDULER_BASE_URL` repository variable과 동일한 서버 `CRON_SECRET` 값을 repository secret으로 설정하고 서버는 `SYNC_MODE=GITHUB_SCHEDULE`로 둡니다. workflow는 GitHub token 권한을 모두 끄며, endpoint별 HTTP 상태와 안전한 JSON 응답을 job summary에 남기고 하나라도 실패하면 실패 exit code를 반환합니다. `workflow_dispatch`에서 시즌/참가자/limit/force를 지정해 수동 복구할 수 있습니다.

GitHub 공식 문서상 schedule은 혼잡 시 지연되거나 일부 실행이 누락될 수 있고, 공개 저장소는 60일간 활동이 없으면 예약 workflow가 비활성화될 수 있습니다. 따라서 “정확히 5분 SLA”로 표현하지 않으며 운영자는 `/admin/matches`의 마지막 성공·실패 원인과 Actions 상태를 함께 확인합니다.

### Vercel과 worker 운영

2026-08-05 재확인한 Vercel 공식 제한에서 Hobby Cron은 하루 한 번, 지정 시간 안에서 최대 59분 오차가 있어 준실시간 경기 수집용으로 사용하지 않습니다. Pro 이상에서 Vercel Cron을 선택할 때만 다음 공식 형식의 `vercel.json`을 추가하고 `SYNC_MODE=VERCEL_CRON` 및 project `CRON_SECRET`을 설정합니다. Vercel은 cron path에 GET과 Bearer header를 보냅니다.

```json
{
  "crons": [
    { "path": "/api/scheduler/sync", "schedule": "2/5 * * * *" },
    { "path": "/api/scheduler/scoring", "schedule": "3/5 * * * *" },
    { "path": "/api/scheduler/missions", "schedule": "4/5 * * * *" }
  ]
}
```

별도 지속 worker는 환경에 `SYNC_MODE=WORKER`를 설정한 뒤 `pnpm sync:worker -- --invocation-key <delivery-id>`로 한 bounded batch를 실행합니다. `--season-id`, `--participant-id`, `--limit`, `--force`, `--dry-run`을 지원하며 process supervisor가 `remaining=true`를 보고 다음 실행을 예약해야 합니다. worker 내부에 정산 규칙을 복제하지 않습니다.

목록 pagination은 start/end window를 cursor에 고정한 뒤 offset을 이어서 처리하므로 새 경기가 목록 앞에 삽입되어도 진행 중 page가 밀리지 않습니다. 성공한 scan은 overlap window로 되감아 late-arriving 경기를 다시 확인하며 DB unique constraint가 중복을 제거합니다. 인정 경기는 `[season.startAt, season.endAt)`에 시작한 queue 420, map 11, CLASSIC 경기이고 최소 시간·remake·early surrender 조건을 통과해야 합니다.

인정 경기 ingest 뒤 점수 서비스가 FIRST draw, 보호된 nonce, commitment, `MATCH_INITIAL` 원장, 참가자 주차 점수·승패·순위, 처리 상태를 하나의 Serializable transaction에서 반영합니다. 같은 경기 재처리와 동시 호출은 `PointDraw.participantMatchId`, 원장 idempotency key, 경기별 partial unique index가 중복을 차단합니다. 중간 실패로 `PROCESSING`에 남은 경기는 다음 sync 또는 scoring backfill로 복구됩니다. MVP/ACE 평가는 점수 정산 직후, M001~M100 snapshot 미션 평가는 그 다음 실행되며 실패한 outbox는 scheduler/admin backfill이 재시도합니다. 누적 미션은 append-only progress event로 재구성할 수 있고 완료 점수는 별도 원장이 권위다.

## MVP/ACE baseline과 평가

관리자 `/admin/mvp-baselines`에서 CSV 또는 JSON payload를 dry-run한 뒤 같은 checksum과 version 이름을 확인해 게시합니다. v1 baseline은 `4 tier bucket × 5 position × 16 metric = 320행`이 모두 있어야 하며 `stdDev > 0`, `sampleSize >= 30`을 요구합니다. 게시본의 내용과 metric은 DB trigger로 immutable하며 교체 시 이전 게시본은 `RETIRED`가 됩니다. 새 주차에는 `PUBLISHED` 버전만 선택할 수 있지만, 이미 `Week.mvpBaselineVersionId`로 고정된 `PUBLISHED` 또는 `RETIRED` 버전은 과거 경기 재평가와 복구에 계속 사용합니다.

평가는 10명 전체를 position·경기 수집 시점 tier snapshot으로 표준화해 4개 group 점수와 total, tie-break 경로를 append-only로 저장합니다. 팀 5명 전원이 완료된 경우에만 승리 팀 MVP와 패배 팀 ACE를 결정하고, 추적 중인 참가자가 실제 팀 1위일 때만 기존 point draw에 재추첨권을 연결합니다. 지원하지 않는 tier, 미게시 baseline, position·metric 누락은 pending으로 남고 보상하지 않습니다. `DEMO_ONLY` 게시본은 production에서 보상 지급이 항상 차단됩니다.

## 포인트 공개와 재추첨

- RANDOM 모드는 crypto rejection sampling으로 17~23을 정확히 1/7로 선택하고, `POINT_MODE=FIXED_20`은 같은 transaction·원장 pipeline에서 20을 사용합니다.
- commitment v1은 version, draw ID, magnitude, nonce를 uint32 big-endian length-prefixed UTF-8로 canonicalize한 SHA-256입니다.
- nonce는 production 전용 `POINT_DRAW_SECRET`에서 HKDF로 분리한 AES-256-GCM 키로 보호하며 draw ID와 FIRST/SECOND phase에 결합합니다.
- `GET /api/draws`는 봉인 값과 nonce를 제외합니다. 본인만 reveal할 수 있고 반복 reveal은 같은 결과를 반환하며 순위는 변하지 않습니다.
- 재추첨은 첫 결과 공개 후 유효한 entitlement가 있을 때 한 번만 가능하고 SECOND가 항상 최종입니다. FIRST 원장은 수정하지 않고 `newSignedDelta - oldSignedDelta` 조정 원장을 추가합니다.
- `POST /api/scheduler/scoring`은 Cron secret으로 미정산 backfill과 시즌별 자동 공개를 실행합니다.

## 명령

| 명령                           | 설명                                             |
| ------------------------------ | ------------------------------------------------ |
| `pnpm dev`                     | Next.js 개발 서버                                |
| `pnpm lint`                    | Next.js, TypeScript, client/server 경계 lint     |
| `pnpm typecheck`               | strict TypeScript 검사                           |
| `pnpm test`                    | Vitest 단위/컴포넌트 테스트                      |
| `pnpm test:integration`        | Node 계약 및 격리 PostgreSQL 통합 테스트         |
| `pnpm test:e2e`                | Playwright desktop/mobile smoke                  |
| `pnpm build`                   | production build                                 |
| `pnpm check`                   | lint → typecheck → unit test → build             |
| `pnpm db:generate`             | Prisma Client 생성                               |
| `pnpm db:preflight:migrations` | 기존 데이터의 migration 차단 조건 read-only 검사 |
| `pnpm db:migrate`              | 개발 migration 생성·적용                         |
| `pnpm db:migrate:deploy`       | 승인된 migration 적용                            |
| `pnpm db:bootstrap:missions`   | 운영 DB에 M001~M100 v1만 안전하게 설치           |
| `pnpm db:seed`                 | 명시적 development/test 전용 결정적 seed         |
| `pnpm db:studio`               | Prisma Studio                                    |
| `pnpm db:test:prepare`         | 테스트 DB에 migration 적용 후 seed               |
| `pnpm admin:create`            | 빈 운영 DB에 최초 관리자 1명 생성                |
| `pnpm reconcile:scores`        | 원장 합계와 점수 캐시 dry-run 대사               |
| `pnpm sync:worker`             | 공용 sync service를 worker mode로 1회 실행       |

Playwright 최초 실행 전 Chromium을 설치합니다.

```powershell
pnpm exec playwright install chromium
pnpm test:e2e
```

`db:test:prepare`는 비파괴적인 `migrate deploy`와 재실행 가능한 seed만 수행합니다. `TEST_DATABASE_URL`이 없거나 `DATABASE_URL`과 같거나 DB 이름에 독립된 `test` 구간이 없으면 데이터 변경 전에 실패합니다. 운영 DB URL을 테스트 변수에 사용하지 않습니다. 통합·E2E runner는 spec마다 임시 PostgreSQL schema를 만들어 migration과 seed부터 실행하고, 종료 시 그 schema만 삭제합니다. 특정 E2E 파일은 `pnpm test:e2e -- tests/e2e/<file>.spec.ts`로 실행할 수 있습니다.

## 개발 seed

`pnpm db:seed`는 `NODE_ENV=development` 또는 `NODE_ENV=test`를 명시한 경우에만 다음 상태를 생성하며 반복 실행해도 중복 행으로 실패하지 않습니다. 값이 없거나 staging/production이면 mutation 전에 실패합니다.

- 관리자 `admin`, 승인 참가자 `player01`~`player20`, 승인 대기 회원 `pending-user`
- 진행 중인 2주 시즌과 종료 시즌, 공동 1위·장기 연승/연패·기록 없음 순위 상태
- 시작·전일·일별 순위 snapshot과 종료 주차 archive/final standing snapshot
- `docs/MISSION_CATALOG.md`에서 엄격히 검증해 읽은 100개 미션 정의
- 승리·패배·remake·무효 queue·timeline 경기와 봉인·공개·재추첨 draw
- production 보상 지급이 금지된 게시 상태의 `DEMO_ONLY-v1` MVP baseline과 320개 표본 metric

기본 개발 비밀번호는 `DeluxeSoloq-Dev-Only-2026!`입니다. 공유 환경에서는 `.env`의 `SEED_PASSWORD`로 교체하고, production에서 기본값을 쓰면 seed가 중단됩니다. seed의 Riot 식별자와 payload는 모두 합성 데이터이며 실제 개인정보나 production secret을 포함하지 않습니다.

## 인증과 권한

- 회원가입은 loginId, 표시 이름, 12~128자 비밀번호, 현재 게시된 이용약관·개인정보 문서 동의를 요구합니다. 가입 후 자동 로그인하지 않습니다.
- 세션은 HttpOnly·SameSite=Lax 쿠키의 서명 JWT와 DB `AuthSession`을 함께 확인합니다. 일반 세션은 12시간, 로그인 유지 세션은 30일이며 logout/rotation/role 변경은 기존 세션을 폐기합니다.
- `/me`, `/apply`, `/admin/*`는 Server Component 경계에서 다시 인증하며 `/api/admin/*`도 endpoint 안에서 ADMIN을 재검증합니다.
- 로그인 실패 메시지는 계정 존재·잠금 여부와 무관하게 같고 DB 기반 rate limit을 적용합니다. 상태 변경 route는 `APP_URL`과 일치하는 Origin을 요구합니다.
- 최초 production 관리자는 seed나 공개 API가 아니라 `pnpm admin:create -- --login-id <id> --display-name <name>`으로 만듭니다. 후속 역할 변경은 감사 가능한 service 경계를 사용합니다.
- 빈 production DB도 `pnpm db:preflight:migrations` → `pnpm db:migrate:deploy` → `pnpm db:bootstrap:missions` → `pnpm admin:create` 순서를 사용합니다. 개발 seed는 실행하지 않습니다.

## Riot ID 참가 신청

- 로그인한 사용자는 `/apply`에서 Riot ID, 주·부 포지션, 실명 공개 여부를 선택하고 Mock resolver로 PUUID와 솔로 랭크를 검증한 뒤 신청합니다.
- 기본 성공 fixture는 `Cloud Tempo#0217`, `ApprovalReady#KR1`이며 `NotFound#KR1`, `TemporaryFailure#KR1`, `RateLimited#KR1`, `InvalidKey#KR1`로 오류 경계를 재현할 수 있습니다.
- `/me`는 대기·검증 실패·거절 사유·승인 상태를 실제 DB에서 읽습니다. 거절 후 새 신청은 가능하지만 PENDING 중복 제출과 승인 후 재신청은 차단합니다.
- `/admin/applications`의 승인·거절·재검증은 ADMIN 권한, Origin, rate limit, 사유, AuditLog를 요구합니다. 진행 중 시즌 승인은 중도 참가 확인 후 시작 랭크 snapshot과 남은 주차 상태를 한 transaction에서 만듭니다.
- `MOCK_RIOT_API=false`에서는 Account-V1 → Summoner-V4/League-V4 순서로 실제 계정을 검증합니다. key가 없으면 환경 검증 단계에서 값 자체를 노출하지 않는 구성 오류로 중단합니다. 실제 key를 사용한 staging 검증은 운영자가 별도로 수행해야 합니다.

## 저장소 구조

| 경로                | 책임                                                         |
| ------------------- | ------------------------------------------------------------ |
| `src/app`           | App Router 화면, route handler, loading/error/not-found 경계 |
| `src/components`    | 표현과 접근성 중심의 재사용 UI; Prisma/Riot 직접 호출 금지   |
| `src/features`      | 유스케이스별 application service와 infrastructure port 조합  |
| `src/domain`        | framework 독립 점수·순위·미션·MVP 계산                       |
| `src/server`        | DB, 인증, 작업, rate limit, 관측성 infrastructure            |
| `src/lib`           | 환경, formatting 등 작은 공통 유틸리티                       |
| `prisma`            | schema, migration, deterministic seed                        |
| `tests/unit`        | 외부 I/O 없는 빠른 계약 테스트                               |
| `tests/integration` | 격리된 PostgreSQL 또는 infrastructure 계약 테스트            |
| `tests/e2e`         | desktop/mobile 사용자 smoke                                  |

Route Handler와 Server Action은 인증·입력 검증 후 feature service를 호출합니다. 외부 HTTP 요청은 열린 DB transaction 안에서 실행하지 않으며, UI에서 Prisma나 Riot client를 직접 사용하지 않습니다.

## CI

`.github/workflows/ci.yml`은 PostgreSQL 18 service에 최초 migration과 seed를 적용한 뒤 lint, typecheck, unit/integration test, production build를 수행합니다. 별도 smoke job은 Chromium에서 desktop/mobile Playwright 테스트를 실행합니다.

상세 운영 절차는 [`docs/RUNBOOK.md`](docs/RUNBOOK.md), 확정 규칙은 [`docs/DECISIONS.md`](docs/DECISIONS.md)를 따릅니다.
#   1  
 