# 시스템 아키텍처

## 1. 아키텍처 목표

- 소규모 대회에는 과도하지 않지만 운영 중 데이터 손상이 어려운 구조
- 외부 API 장애와 중복 호출에 안전
- Mock과 실제 Riot API를 같은 인터페이스로 교체
- 메인 점수, 미션 점수, 관리자 조정의 완전한 감사 가능성
- Next.js 단일 저장소에서 시작하되 도메인 로직을 UI와 분리
- 향후 worker 또는 전적검색 기능으로 확장 가능

## 2. 상위 구성

```text
Browser
  ├─ Public pages
  ├─ Participant pages
  └─ Admin pages
        │
        ▼
Next.js App Router
  ├─ Server Components
  ├─ Route Handlers / Server Actions
  ├─ Auth & Authorization
  ├─ Application Services
  └─ Read Models
        │
        ├──────────────► PostgreSQL / Prisma
        │
        ├──────────────► Riot API Adapter
        │                  ├─ RealRiotClient
        │                  └─ MockRiotClient
        │
        └──────────────► Scheduler entrypoints
                           ├─ Manual
                           ├─ GitHub schedule
                           ├─ Vercel Cron
                           └─ Future worker
```

## 3. 권장 저장소 구조

```text
.
├─ AGENTS.md
├─ PLANS.md
├─ README.md
├─ docs/
│  ├─ PRD.md
│  ├─ ARCHITECTURE.md
│  ├─ DATA_MODEL.md
│  ├─ DECISIONS.md
│  ├─ MISSION_CATALOG.md
│  ├─ RUNBOOK.md
│  ├─ TEST_PLAN.md
│  └─ EXTERNAL_CONSTRAINTS.md
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
├─ public/
├─ src/
│  ├─ app/
│  │  ├─ (public)/
│  │  ├─ (auth)/
│  │  ├─ (participant)/
│  │  ├─ admin/
│  │  └─ api/
│  ├─ components/
│  │  ├─ ui/
│  │  ├─ layout/
│  │  ├─ leaderboard/
│  │  ├─ matches/
│  │  ├─ missions/
│  │  ├─ draw/
│  │  └─ admin/
│  ├─ features/
│  │  ├─ auth/
│  │  ├─ applications/
│  │  ├─ participants/
│  │  ├─ seasons/
│  │  ├─ riot/
│  │  ├─ sync/
│  │  ├─ scoring/
│  │  ├─ mvp/
│  │  ├─ missions/
│  │  ├─ leaderboard/
│  │  └─ admin/
│  ├─ server/
│  │  ├─ db/
│  │  ├─ auth/
│  │  ├─ jobs/
│  │  ├─ rate-limit/
│  │  └─ observability/
│  ├─ lib/
│  ├─ styles/
│  ├─ types/
│  └─ test/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  ├─ e2e/
│  └─ fixtures/
├─ .github/workflows/
├─ .env.example
├─ package.json
└─ pnpm-lock.yaml
```

## 4. 계층 규칙

### UI 계층

- 화면 배치, 사용자 상호작용, 접근성
- 직접 Prisma 호출 금지
- Riot API 직접 호출 금지
- 도메인 계산 금지
- Server Component는 read service를 호출
- Client Component는 꼭 필요한 상호작용 범위에만 사용

### Application service 계층

- 유스케이스 단위 조정
- 트랜잭션 경계
- 권한 검사 호출
- 도메인 함수 조합
- idempotency 보장
- 외부 어댑터 호출 순서

### Domain 계층

가능하면 순수 함수로 유지한다.

- 점수 부호와 차이 계산
- 순위 계산
- commitment 생성·검증
- z-score와 가중치
- 미션 evaluator
- 보충 크레딧 계산
- 경기 인정 규칙

### Infrastructure 계층

- Prisma
- Riot fetch
- cookie/JWT
- scheduler
- 로그
- rate limiter

도메인 계층이 Next.js, Prisma, 브라우저 API에 의존하지 않게 한다.

## 5. 서버 렌더링과 데이터 갱신

- 첫 화면과 순위표는 Server Component에서 서버 렌더링
- 참가자 전용 동작만 Client Component
- 순위표와 경기 피드는 15~30초의 가벼운 폴링
- 사용자가 결과 공개·재추첨·리롤을 실행하면 해당 read model 즉시 재검증
- 실시간 WebSocket은 초기 범위 제외
- 캐시가 데이터 권위가 되지 않음
- 이벤트 종료 snapshot은 immutable read model로 저장

## 6. 인증 아키텍처

### 자격 증명

- `loginId`
- Argon2id password hash
- 실명은 사용자 프로필에 별도 저장

### 세션

- 서버가 서명한 JWT를 HttpOnly cookie에 저장
- JWT payload는 최소화: `sub`, `role`, `jti`, `iat`, `exp`
- DB `AuthSession`에서 jti 상태 확인
- 로그아웃·잠금 시 revoke
- role 변경 시 기존 session revoke 또는 session version 증가
- cookie: Secure(프로덕션), HttpOnly, SameSite=Lax, Path=/
- 서버 시간 기준 만료
- 공개 캐시에 사용자 세션 데이터가 섞이지 않게 함

### 권한

중앙 함수:

```ts
requireUser()
requireParticipant()
requireAdmin()
assertOwnsParticipantResource()
```

모든 mutation은 함수 시작부에서 권한을 확인한다. Client UI의 숨김은 보조 수단일 뿐이다.

## 7. Riot API 어댑터

```ts
interface RiotClient {
  resolveRiotId(gameName: string, tagLine: string): Promise<RiotIdentity>;
  getIdentityByPuuid(puuid: string): Promise<RiotIdentity>;
  getSummonerByPuuid(puuid: string): Promise<RiotSummoner>;
  getSoloQueueSnapshot(puuid: string): Promise<RankedSoloSnapshot | null>;
  listMatchIds(input: MatchListInput): Promise<string[]>;
  getMatch(matchId: string): Promise<NormalizedMatch>;
  getTimeline(matchId: string): Promise<NormalizedTimeline>;
  getStaticData(gameVersion?: string): Promise<StaticDataSnapshot>;
}
```

### 라우팅

- Account-V1, Match-V5: ASIA regional routing
- Summoner-V4, League-V4 `entries/by-puuid`: KR platform routing
- 라우팅 host는 config에 중앙화
- URL 문자열을 기능 코드에 반복하지 않음

### 구현체

`RealRiotClient`

- server-only
- API key environment variable
- timeout
- response status 기반 오류
- 429 `Retry-After`
- 제한 헤더 관측
- 5xx 제한 재시도 + jitter
- 4xx 무한 재시도 금지
- secret redaction
- operation/correlation ID와 rate-limit header만 관측하고 URL·PUUID·key는 기록하지 않음

`MockRiotClient`

- 동일 타입과 오류 모드
- fixture 기반
- 성공, 404, 403/키 만료, 429, 5xx, malformed data
- E2E에서 결정론적
- 페이지형 match ID, 승리/패배/remake/비지원 queue, timeline 누락/재시도 성공

`DataDragonClient`

- 경기 `gameVersion`의 exact major/minor 최신 build 우선
- exact patch가 없으면 같은 major의 가장 가까운 minor 선택
- version/snapshot 메모리 cache와 last-known-good fallback
- cold-start 장애 시 제한된 bundled metadata를 사용하고, 누락 분류는 추측하지 않음

### 정규화

외부 DTO를 DB와 UI에 직접 전파하지 않는다. `normalizeMatch()`에서 다음을 고정한다.

- match ID
- queue/map/mode
- start/end/duration
- participant PUUID
- team ID
- position
- champion
- K/D/A
- CS, gold, damage, vision
- objective/challenge fields
- item IDs, perks, spells
- team objectives
- early surrender flags
- patch version

Riot client는 원본 payload를 반환하지 않는다. 동기화 계층에서 운영상 보존이 필요할 때만 access-controlled JSONB로 별도 저장하고 일반 쿼리와 UI DTO에서는 읽지 않는다.

## 8. 경기 동기화

## 8.1 흐름

```text
Acquire JobLease
  → Create SyncRun
  → Select participant batch
  → Fetch new match IDs
  → Filter by cursor/time/queue
  → Fetch and normalize unseen matches
  → Upsert Match
  → Process tracked participants
       ├─ ParticipantMatch
       ├─ Point draw + ledger
       ├─ MVP/ACE
       └─ Mission evaluation
  → Update cursor
  → Finish SyncRun
  → Release JobLease
```

## 8.2 외부 호출과 트랜잭션

- Riot HTTP 요청을 열린 DB 트랜잭션 안에서 수행하지 않는다.
- 먼저 외부 데이터를 가져오고 정규화한다.
- 짧은 DB 트랜잭션에서 upsert와 도메인 정산을 수행한다.
- 처리 실패 상태와 재시도 가능 여부를 기록한다.

## 8.3 중복 방지

유일 키 예시:

- `Match.riotMatchId`
- `SeasonMatch(seasonId, matchId)`
- `ParticipantMatch(participantId, seasonMatchId)`
- `PointDraw.participantMatchId`
- `ScoreLedger.idempotencyKey`
- `MissionProgressEvent(assignmentId, participantMatchId, evaluatorVersion)`
- `MissionCompletionLedger.assignmentId`
- `SyncRun.invocationKey`

동일 입력을 두 번 실행해도 두 번째 호출은 no-op 또는 기존 결과 반환이어야 한다.

## 8.4 Cursor

Participant별:

- last requested start time
- last successful match start
- newest known match ID
- last success
- last error
- consecutive failure count
- next eligible sync time

cursor는 API 목록 누락을 대비해 짧은 overlap window를 사용하고 DB unique constraint가 중복을 제거한다.

## 8.5 동시 실행

- DB 기반 `JobLease` 또는 PostgreSQL advisory lock
- lease expiry로 죽은 작업 회복
- 중복 실행은 lock과 idempotency를 함께 사용
- participant batch cursor로 함수 시간 제한 안에 처리

## 9. 점수 정산

## 9.1 RNG

Node의 암호학적 random integer를 사용해 `[17, 24)`를 균등 샘플링한다.

```text
value = secureRandomInt(17, 24)
signed = win ? value : -value
nonce = secureRandomBytes(32)
commitment = SHA-256(lengthPrefixedEncode("v1", drawId, value, nonce))
```

commitment serialization은 버전별로 고정하고 테스트 vector를 둔다.

## 9.2 첫 정산

단일 DB 트랜잭션:

1. ParticipantMatch 존재 확인
2. 기존 PointDraw 확인
3. 없으면 value/nonce/commitment 생성
4. PointDraw 생성
5. `MATCH_INITIAL` 원장 행 생성
6. cached score 갱신
7. 기존 결과가 있으면 그대로 반환

## 9.3 공개

- 공개 endpoint는 draw 소유권 확인
- 이미 공개됐으면 같은 결과 반환
- 공개 시각만 변경
- value+nonce 응답
- 점수 원장에는 변화 없음

## 9.4 재추첨

단일 DB 트랜잭션:

1. row lock에 준하는 조건부 update 또는 serializable transaction
2. eligible 확인
3. not used 확인
4. week open 확인
5. second value 채택
6. adjustment 계산
7. 고유 원장 행 생성
8. rerollUsedAt 기록
9. score cache 갱신
10. 결과 반환

두 동시 요청 중 하나만 성공해야 한다.

## 10. MVP/ACE 엔진

```text
NormalizedMatch
  → resolve position
  → derive metrics
  → load published baseline version
  → z-score per metric
  → winsorize
  → aggregate four groups
  → apply 70% common + 30% position weights
  → rank within each team
  → persist evaluation and explanation
```

### 누락 데이터

- 공식 응답의 omitted numeric field는 evaluator contract에 따라 0 또는 unavailable
- unavailable metric을 임의 평균 0으로 위장하지 않음
- 그룹에 유효 지표가 너무 적으면 평가 불가
- 평가 불가 시 재추첨권을 지급하지 않고 관리자 경고
- DEMO_ONLY 기준은 프로덕션 보상 차단
- v1 group은 각각 4개 metric이며 3개 이상이 유효할 때만 유효 metric끼리 동일 비율로 재정규화한다.
- 한 group이라도 3개 미만이면 참가자 평가는 `PENDING_DATA`이고, 팀 5명 중 한 명이라도 완료되지 않으면 그 팀의 MVP/ACE를 확정하지 않는다.
- 시작 tier snapshot 또는 게시 baseline bucket이 없으면 `PENDING_BASELINE`이다. 하위 tier를 PLATINUM으로 올려 매핑하지 않는다.
- 평가는 `seasonMatch + raw participant + evaluator version + baseline/status`에서 파생한 멱등 키로 append-only 저장하고 재평가는 이전 행을 supersede한다.

## 11. 미션 엔진

### Registry 패턴

각 미션은 DB config와 코드 evaluator key를 연결한다.

```ts
interface MissionEvaluator {
  key: string;
  source: "SUMMARY" | "TIMELINE" | "AGGREGATE" | "STATIC_SUMMARY";
  evaluate(context: MissionContext, config: unknown): MissionDelta;
}
```

DB에 임의 실행 코드나 JavaScript 문자열을 저장하지 않는다.

### 경기 시점 snapshot

`WeeklyMissionAssignment.activeFrom`과 `activeTo`를 이용한다.

```text
activeFrom <= match.gameStartAt
AND (activeTo IS NULL OR match.gameStartAt < activeTo)
```

현재 상태만 조회해서 과거 경기를 판정하지 않는다.

ingest transaction은 위 이력 구간을 조회해 participant match별 `MissionMatchSnapshot` 부모와 assignment entry를 한 번만 만든다. 부모가 빈 assignment 집합도 표현하므로 동일 match 재처리에서 나중에 활성화된 미션을 다시 붙이지 않는다. snapshot 생성 뒤 `EVALUATE_MISSIONS` outbox를 만들며 evaluator 실행은 별도 단계다.

### 진행 이벤트

- assignment + participantMatch + evaluator version 유일
- before, delta, after
- 완료 경계 통과 여부
- evaluator version
- source facts
- 재실행 시 동일 결과

M001~M100 registry는 `MAX`, `ADD`, `SET`, `DISTINCT` progress mode를 사용한다. 누적 결과의 권위는 append-only `MissionProgressEvent`와 완료 `MissionCompletionLedger`이며 assignment progress는 빠른 조회용 cache다. distinct 값은 기존 event evidence의 key 집합으로 중복을 제거한다. 연승은 ingestion 순서에 의존하지 않고 활성 시각 이후 인정 경기를 `gameStartAt`으로 정렬해 현재 streak, 최대 streak, 최초 완료 경기를 계산한다.

timeline/static evaluator는 외부 Data Dragon 조회를 transaction 밖에서 끝낸 뒤 저장 snapshot을 평가한다. frame은 정확한 목표 시각 또는 참가자를 포함한 가장 가까운 직전 frame만 사용하고, item stream은 purchase/sell/undo 순으로 재생한다. 정적 데이터나 timeline이 충분하지 않으면 실패로 고정하지 않고 `PENDING_DATA`로 outbox 재시도한다.

### 보충

현재 시각과 마지막 accrual 기준으로 계산 가능한 순수 함수로 만든다.

- 6시간마다 1
- cap 3
- 빈 슬롯에 즉시 소비
- cron이 정확한 순간에 실행되지 않아도 누락 tick을 계산

### 리롤

- participantWeek 단위 1시간 cooldown
- active assignment 종료
- deferred queue에 기록
- unseen 후보에서 즉시 새 assignment
- transaction
- 동일 요청 idempotency key
- refill과 같은 ParticipantWeek 행 잠금을 사용해 동시 리롤·보충이 활성 슬롯 5개를 넘지 않게 함

## 12. Read model과 쿼리

쓰기 모델을 그대로 복잡한 화면에 노출하지 않는다.

권장 read service:

- `getHomeDashboard()`
- `getLeaderboard(weekId)`
- `getMissionLeaderboard(weekId)`
- `getParticipantProfile(participantId, weekId)`
- `getRecentMatches(filters)`
- `getMyActionCenter(userId)`
- `getAdminOperationsOverview()`

필요 시 다음 캐시 필드를 유지하되 원장에서 재구축 가능해야 한다.

- ParticipantWeek.mainScoreCached
- ParticipantWeek.missionScoreCached
- ParticipantWeek.wins/losses
- ParticipantWeek.currentStreak
- ParticipantWeek.rankCached
- daily snapshots

## 13. 이벤트 종료

주차 종료 작업:

1. 새 경기 인정 cutoff 고정
2. 진행 중 sync 완료
3. 미공개 draw 자동 공개
4. 만료 재추첨 처리
5. 미션 처리 완료
6. 원장 합계 검증
7. 최종 순위 계산
8. immutable WeekSnapshot과 시즌 FinalStandingSnapshot 생성
9. status completed
10. export 생성

종료 후 늦게 발견된 경기는 관리자 “재개→처리→재확정” 절차를 거친다.

## 14. 오류 모델

도메인 오류 예:

- AUTH_REQUIRED
- FORBIDDEN
- VALIDATION_ERROR
- RIOT_ACCOUNT_NOT_FOUND
- RIOT_KEY_INVALID
- RIOT_RATE_LIMITED
- RIOT_TEMPORARY_FAILURE
- MATCH_NOT_ELIGIBLE
- DRAW_ALREADY_REVEALED
- REROLL_NOT_ELIGIBLE
- REROLL_ALREADY_USED
- WEEK_CLOSED
- MISSION_REROLL_COOLDOWN
- BASELINE_NOT_PUBLISHED
- DEMO_BASELINE_BLOCKED
- JOB_ALREADY_RUNNING

UI는 내부 예외가 아니라 안전한 error code와 사용자 메시지를 받는다.

## 15. 관측성

구조화 로그 필드:

- requestId
- userId/actorId
- participantId
- matchId
- syncRunId
- operation
- duration
- result
- errorCode
- retryAfter
- API key나 JWT는 절대 로그하지 않음

DB 운영 레코드:

- SyncRun
- SyncError
- JobLease
- AuditLog
- SystemHealthSnapshot(선택)

## 16. 테스트 전략

### 단위

- random bounds/sign
- commitment vector
- ranking tie
- ledger adjustment
- MVP z-score/weight/tie
- mission evaluators
- mission activation interval
- refill accrual
- cooldown
- queue/time eligibility

### 통합

- auth/session/revoke
- application/approval
- mock Riot sync
- duplicate sync
- point draw transaction
- concurrent reroll
- mission simultaneous completion
- admin adjustment
- cron auth

### E2E

- visitor browsing
- register/login/apply
- admin approve
- import fixture match
- reveal point
- reroll
- leaderboard update
- mission progress
- mobile navigation
- reduced motion
- admin failure recovery

## 17. 배포 고려

- Node runtime이 필요한 argon2/Prisma 경로를 Edge로 강제하지 않음
- managed PostgreSQL의 pooled URL 사용
- migration은 배포 함수 요청 중 자동 실행하지 않음
- production migration은 명시적 CI/운영 단계
- scheduler endpoint는 `Authorization: Bearer CRON_SECRET`
- scheduler가 실패해도 수동 재실행 가능
- GitHub schedule은 지연 가능성을 UI에 표시
- Vercel 함수 시간 제한에 맞춰 batch 크기 조정
- 백업과 restore rehearsal 문서화

## 18. 환경 변수

```dotenv
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
CRON_SECRET=
POINT_DRAW_SECRET=
RIOT_API_KEY=
APP_URL=http://localhost:3000
APP_TIME_ZONE=Asia/Seoul
RIOT_PLATFORM_REGION=KR
RIOT_REGIONAL_ROUTE=ASIA
MOCK_RIOT_API=true
SYNC_MODE=MANUAL
SYNC_BATCH_SIZE=5
SYNC_OVERLAP_MINUTES=30
SYNC_LEASE_RECOVERY_GRACE_SECONDS=30
SYNC_TIME_BUDGET_MS=20000
SYNC_MATCH_PAGE_SIZE=20
SYNC_PARTICIPANT_COOLDOWN_SECONDS=60
SYNC_LEASE_SECONDS=120
POINT_MODE=RANDOM_17_23
AUTO_REVEAL_HOURS=12
ALLOW_DEMO_MVP_REWARDS=false
NEXT_PUBLIC_POLL_INTERVAL_MS=20000
```

실제 이름은 구현 중 중앙 config schema에서 검증한다. `NEXT_PUBLIC_` 변수에 비밀을 넣지 않는다.

## 19. 확장 지점

- RiotClient adapter로 RSO 또는 다른 리전 추가
- scheduler adapter로 worker 전환
- read model로 전적검색 추가
- mission registry로 새 evaluator 추가
- ScoreRule strategy로 새 시즌 규칙 추가
- notification outbox로 이메일/푸시 추가
