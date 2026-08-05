# 디럭스 솔랭 — Codex 프롬프트 모음

> **세션 00 이후 사용 주의:** 이 파일은 원본 패키지 생성 시점의 프롬프트 통합 snapshot이다. 2026-08-04 세션 00에서 개별 canonical 프롬프트와 결정 문서가 수정되었으므로 재생성 전까지 순차 실행에 사용하지 않는다. `prompts/00_REPOSITORY_AUDIT_AND_PLAN.md`와 `prompts/01_...`~`18_...` 개별 파일 및 `IMPLEMENTATION_PLAN.md`를 사용한다.

각 구분선 아래의 프롬프트를 Codex에 복사해 사용한다. 실제 운영형은 00부터 18까지 순서대로 실행한다.

---

<!-- SOURCE: prompts/START_HERE.md -->

# 시작 프롬프트 — 문서 패키지 인식

이 저장소는 `README_FIRST.md`, `AGENTS.md`, `PLANS.md`, `docs/`, `prompts/`에 디럭스 솔랭 전체 명세가 들어 있다.

먼저 `README_FIRST.md`와 `AGENTS.md`를 읽고 저장소를 조사하라. 실제 운영 가능한 서비스를 목표로 한다면 `prompts/00_REPOSITORY_AUDIT_AND_PLAN.md`의 내용을 지금 수행하라. 화면 프로토타입만 필요한 경우가 아니라면 `ONE_SHOT_VISUAL_PROTOTYPE.md`를 실행하지 마라.

현재 단계에서 외부 Riot key나 production DB가 없어도 질문만 하고 멈추지 말고, 문서·Mock·adapter·테스트까지 진행 가능한 범위를 완수하라. 결과는 변경 파일, 검증 명령, 남은 외부 blocker, 다음에 실행할 prompt 파일명으로 보고하라.

---

<!-- SOURCE: prompts/ONE_SHOT_VISUAL_PROTOTYPE.md -->

# 원샷 — 고완성도 시각 프로토타입

현재 폴더에 **디럭스 솔랭**의 고완성도 프론트엔드 프로토타입을 한 번에 구현하라. 질문하거나 계획만 말하고 멈추지 말고, 저장소를 조사한 뒤 실행 가능한 코드를 만들고 테스트하라. 이 프롬프트의 결과는 실제 운영 백엔드가 아니라 UI/UX 검증용이다. 실제 DB·인증·Riot API가 연결됐다고 가장하지 말고 모든 데이터는 하나의 typed mock data layer에서 일관되게 제공하라.

## 기술

- Next.js App Router + TypeScript strict
- Tailwind CSS
- shadcn/ui 패턴
- lucide-react
- Recharts
- pnpm
- 외부 유료 자산 금지
- 최신 안정 GA 패키지만 사용

빈 폴더면 프로젝트를 초기화하라. 기존 프로젝트면 구조를 보존하며 구현하라. 설치, `lint`, `typecheck`, `test`, `build`가 가능한 스크립트를 제공하라.

## 제품

약 20명이 1~2주 동안 진행하는 LoL 솔로 랭크 대회 사이트다. 한 경기 승리 시 +17~+23, 패배 시 -17~-23이 동일 확률로 정해진다. 참가자는 결과가 이미 서버에서 봉인되어 있다는 설정 아래 “공개” 버튼으로 긴장감 있는 연출을 본다. MVP/ACE는 한 번 재추첨할 수 있고 두 번째 결과가 무조건 최종이다. 매주 100개 풀에서 개인별 미션 5개가 활성화된다.

## 디자인

실제 대형 스포츠 기록·전적 서비스처럼 정보가 촘촘하고 반복 사용에 적합해야 한다.

- dark graphite base, 높은 대비, 얇은 border, 제한적인 electric glow/LED
- 과도한 gradient, glassmorphism, 둥근 카드 남발, 거대한 마케팅 hero 금지
- 승리/상승, 패배/하락, 중립을 색상+아이콘+텍스트로 구분
- 브랜드 화면을 복제하지 말고 고유한 “랭크 신호/전광판” 정체성
- 390px mobile부터 1440px desktop까지 완성
- keyboard focus, semantic HTML, reduced motion

## Mock 데이터

하나의 typed repository에 최소 20명, 2개 주차, 30개 경기, 100개 미션 정의 요약을 넣어라. 다음 edge case를 포함하라.

- 공동 순위 `1,1,3`
- 매우 긴 `gameName#tagLine`
- 오늘 경기 없음
- unranked
- 7연승/6연패
- 미공개 승리/패배 draw
- MVP 재추첨 가능, ACE 재추첨 완료
- 미션 37/100 진행
- API 갱신 지연
- 종료된 지난 주차

모든 페이지가 같은 데이터에서 파생되어 점수·승패·최근 경기 정보가 모순되지 않게 하라.

## 페이지

### `/`

스크롤 전 영역에 종료 countdown, 현재 TOP 5, 전체 순위 바로가기를 둔다. TOP 5에는 순위, Riot ID+tagLine, score, tier/LP, 어제 대비 순위, 시작 대비 LP, 승/패/승률, streak, 최근 결과를 표시한다. 이어서 오늘 LP 최대 상승, 최다 연승, 최다 게임, 최근 경기, 공지를 배치한다. 오늘 데이터가 없으면 “최근 기록”이라고 정확히 표시한다.

### `/leaderboard`

전체 20명 표. columns: rank, Riot ID, score, W-L diff, wins/losses, tier/LP, start LP change, yesterday change, win rate, streak, recent form. rank와 Riot ID를 sticky로 두고 실제 가로 스크롤 뒤에만 border+shadow를 표시한다. Riot ID는 tagLine 항상 표시, 글자 축소 후 셀 확장. 모바일은 핵심 열+행 확장.

### `/missions`

주간 미션 순위 `1,1,3`, mission score, 완료 수, 최근 완료. 규칙 요약과 내 미션 CTA.

### `/participants/[id]`

프로필, tier/LP, score, W/L, LP trend와 score trend chart, 최근 경기, point ledger, mission summary, MVP/ACE badge.

### `/matches`

Riot ID, W/L, champion, KDA, duration, ended time, point change, streak, detail. participant/result 필터 UI.

### `/me`

내 대회 상태, 5개 active mission, exact progress, refill credit 2/3, 다음 보충, reroll cooldown. 미공개 draw queue와 score history.

### `/history`, `/rules`, `/login`, `/signup`, `/apply`

실제 product 수준의 빈/오류/대기 상태를 포함한다. 규칙에는 각 17~23이 1/7, 재추첨은 두 번째가 최종, 현금/유료 요소 없음, 비공식 제품 고지 placeholder를 명시한다.

### `/admin/*`

공통 admin shell과 13개 navigation: dashboard, users, applications, participants, seasons, scoring, matches, draws, missions, mvp baselines, content, audit/exports, system. 대표적인 table/form/dry-run/publish UI를 만들되 버튼은 “프로토타입”이라고 명확히 표시하고 데이터가 저장되는 척하지 않는다.

## 포인트 공개 연출

동작하는 client-side prototype을 구현한다.

- 약 4.8초: seal lock → signal scan → instability → final approach → reveal
- 후보 17~23이 복호화되는 듯한 연출
- 1.5초 뒤 skip
- reduced motion 약 0.4초
- sound off 기본
- 카지노/슬롯/현금 표현 금지
- 승리는 +, 패배는 -
- 재추첨 확인에는 더 나빠질 수 있고 두 번째가 최종이라고 명시
- mock 결과는 draw ID에 기반한 deterministic 값이라 새로고침해도 같다.

## 컴포넌트 품질

- 공통 RiotId, RankCell, ResultBadge, Streak, DataTable, StickyColumns, EmptyState, Freshness, DrawRevealDialog, MissionCard, StatStrip
- loading skeleton과 error boundary
- 챔피언 이미지 실패 fallback
- chart에 텍스트 summary
- 의미 없는 animation이나 랜덤 layout 금지

## 인수 조건

- 모든 route가 직접 열리고 navigation이 작동한다.
- 390/768/1440 viewport에서 overflow와 sticky 열을 확인한다.
- hydration warning과 console error가 없다.
- typed mock data 외 페이지별 중복 하드코딩을 최소화한다.
- 실제 backend가 없음을 README에 명시한다.
- 마지막 응답에 실행 방법, 주요 화면, 변경 파일, 테스트 결과, 운영 버전에서 반드시 교체할 mock 경계를 보고하라.

---

<!-- SOURCE: prompts/MASTER_FULL_BUILD_ATTEMPT.md -->

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

---

<!-- SOURCE: prompts/00_REPOSITORY_AUDIT_AND_PLAN.md -->

# 세션 00 — 저장소 감사와 실행 계획

이 세션의 목적은 코드를 성급히 생성하는 것이 아니라, 현재 저장소를 정확히 파악하고 이후 18개 세션이 충돌 없이 진행될 실행 계획을 만드는 것이다. 이 세션에서는 제품 기능을 본격 구현하지 마라. 문서의 명백한 모순·누락을 바로잡는 것과 최소한의 검사 스크립트 추가만 허용한다.

## 수행 작업

1. 다음 파일을 모두 읽어라.
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
2. Git 상태, 파일 구조, package manager, Node 설정, 기존 Next.js/Prisma 여부, 테스트·CI·환경 변수 파일을 조사하라.
3. 문서와 기존 구현을 대조해 다음을 분류하라.
   - 이미 충족
   - 부분 충족
   - 미구현
   - 서로 충돌
   - 외부 자격 증명/운영 결정 필요
4. `IMPLEMENTATION_PLAN.md`를 `PLANS.md`의 템플릿에 맞춰 작성하라. 세션 01~18 각각에 대해:
   - 목표
   - 예상 변경 영역
   - 선행조건
   - 데이터 migration 위험
   - 검증 명령
   - 완료 조건
   을 적어라.
5. `docs/RISK_REGISTER.md`를 만들어 최소 다음 위험을 기록하라.
   - Riot API key와 제품 등록
   - Vercel Hobby scheduler 한계
   - 경기 중복 정산
   - 랜덤 점수 정책 검토와 FIXED_20 fallback
   - MVP 기준 데이터 부재
   - Timeline 필드 누락
   - 주차 경계/Asia/Seoul
   - admin 권한과 개인정보
6. 실제로 결정되지 않은 사항만 `docs/OPEN_QUESTIONS.md`에 남겨라. 문서에 이미 답이 있는 질문을 다시 만들지 마라. 구현을 막지 않는 항목은 합리적 기본값을 선택하고 결정 로그에 기록하라.
7. 현재 dependency 버전 또는 외부 제약을 확인할 네트워크가 있다면 공식 primary documentation만 사용하라. 확인 날짜와 결론만 기록하고 임의 블로그를 근거로 삼지 마라.

## 완료 조건

- 현재 저장소가 빈 저장소인지 기존 앱인지 명확히 기록되어 있다.
- 세션 01~18의 순서와 dependency graph가 실행 가능하다.
- critical path와 외부 차단 요소가 구분되어 있다.
- 문서 간 충돌이 있으면 해결됐거나 명시적으로 기록되어 있다.
- 본격 기능 구현은 시작하지 않았다.

이 세션의 테스트는 존재하는 명령만 실행한다. 프로젝트가 아직 초기화되지 않았다면 명령 부재를 실패로 가장하지 말고 세션 01의 작업으로 기록하라.

---

<!-- SOURCE: prompts/01_FOUNDATION_AND_TOOLING.md -->

# 세션 01 — Next.js 기반과 개발 도구

빈 저장소라면 production-grade Next.js App Router 프로젝트를 초기화하고, 기존 프로젝트라면 명세와 충돌하지 않게 기반을 정리하라. 이 세션의 목표는 이후 모든 기능이 일관된 구조·명령·검증 위에서 개발되게 하는 것이다.

## 구현 범위

- pnpm workspace가 아닌 단일 앱을 기본으로 한다. 기존 monorepo라면 구조를 존중한다.
- Next.js App Router, TypeScript strict, `src/` 구조, Tailwind CSS를 설정한다.
- shadcn/ui와 lucide-react를 사용할 준비를 하되 불필요한 전체 컴포넌트를 복사하지 않는다.
- Recharts, Prisma/PostgreSQL client, Argon2id, JWT 서명 라이브러리, Zod, Vitest, React Testing Library, Playwright에 필요한 안정 패키지를 설정한다.
- 현재 시점의 안정 GA 버전을 공식 문서와 peer dependency로 확인하고 lockfile에 고정한다. beta/canary를 사용하지 않는다.
- import alias, strict compiler option, server-only 경계, 환경 변수 schema validation을 구성한다.
- `.env.example`을 `docs/RUNBOOK.md`와 일치시킨다. 실제 secret은 넣지 않는다.
- 공통 `src/app/layout.tsx`, error/not-found/loading 경계, 기본 metadata, health route를 만든다.
- `src/lib/env/server.ts`와 필요한 public env 모듈을 분리해 server secret이 client import될 수 없게 한다.
- ESLint/formatting 정책, Vitest setup, Playwright config, test DB를 위한 문서·스크립트 골격을 만든다.
- `package.json`에 `dev`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `build`, `check`, Prisma 관련 명령을 제공한다.
- GitHub Actions CI를 추가해 install → lint → typecheck → unit test → build를 수행한다. DB가 필요한 단계는 명시적 service/환경을 사용하거나 후속 세션까지 조건부로 둔다.
- 루트 README를 만들어 Windows 11을 포함한 로컬 실행 순서, Mock 모드, 환경 변수, 테스트 명령을 설명한다.

## 구조 원칙

- `src/app`, `src/components`, `src/features`, `src/domain`, `src/server`, `src/lib`, `prisma`, `tests`의 책임을 문서화한다.
- client component는 꼭 필요한 곳에만 `'use client'`를 붙인다.
- 빈 페이지마다 임시 lorem ipsum을 대량 생성하지 않는다.
- 현재 세션에서는 실제 인증, Riot 호출, 점수, 미션 로직을 구현하지 않는다.

## 인수 조건

- 새 clone에서 문서의 명령으로 설치·개발 서버·품질 검사에 진입할 수 있다.
- 잘못된 필수 환경 변수는 시작 시 안전한 오류를 내며 secret 값을 출력하지 않는다.
- client 코드가 server env 모듈을 import하면 빌드 또는 lint 경계에서 차단된다.
- 기본 페이지와 `/api/health`가 동작한다.
- 최소 1개 unit test와 1개 Playwright smoke test가 실제로 실행된다.

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

---

<!-- SOURCE: prompts/02_DATABASE_SCHEMA_AND_SEED.md -->

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

---

<!-- SOURCE: prompts/03_DESIGN_SYSTEM_AND_STATIC_UI.md -->

# 세션 03 — 디자인 시스템과 전체 정적 UI

실제 데이터 service를 연결하기 전에 모든 핵심 화면의 정보 구조와 반응형 UI를 seed/mock read model로 구현하라. 목표는 “AI가 만든 장식적 랜딩 페이지”가 아니라, 대회 기간 매일 보는 고밀도 스포츠 기록 서비스다.

## 디자인 방향

- graphite/charcoal dark base, 높은 텍스트 대비, 제한적인 electric accent와 LED/glow를 사용한다.
- 승리·상승, 패배·하락, 중립 상태를 색상과 아이콘/텍스트를 함께 사용해 구분한다.
- 과도한 그라디언트, glassmorphism, 모든 것을 둥근 카드로 감싸기, 거대한 마케팅 hero, 의미 없는 통계는 금지한다.
- Riot/OP.GG/대형 스포츠 서비스의 검증된 정보 위계만 참고하고 화면·로고·브랜드를 복제하지 않는다.
- typography, spacing, radius, border, shadow, motion duration을 CSS token으로 관리한다.

## 구현할 공통 요소

- desktop/mobile navigation, season selector, sync freshness indicator, account menu
- page container, section heading, stat strip, compact data table, status badge
- Riot ID renderer: tagLine 항상 표시, 자동 축소 후 최소 폭 확장
- win/loss chip, streak indicator, LP/tier badge, champion portrait fallback
- skeleton, empty, error, stale-data state
- accessible dialog, dropdown, toast/inline feedback
- sticky table utility: rank와 Riot ID 고정, 실제 horizontal scroll 후에만 border+shadow
- mobile row expansion pattern

## 페이지

### 공개

- `/`: 종료 countdown, TOP 5, 전체 순위 CTA, 오늘 주요 기록, 최근 경기, 공지
- `/leaderboard`: 전체 순위, score/wins/losses/diff/tier/LP/streak/win rate/start LP change/yesterday rank change, filter/sort 설명
- `/missions`: 주간 미션 순위와 규칙, 공동 순위
- `/matches`: 최근 경기 표와 필터 UI
- `/participants/[id]`: 프로필, 현재 랭크, 대회 추이 chart, 포인트 내역, 경기 기록, 미션 요약
- `/history`: 지난 주차/종료 시즌 snapshot
- `/rules`: 점수 확률, 재추첨, 미션, 개인정보·비공식 제품 고지 영역

### 인증/참가자

- `/login`, `/signup`, `/apply`, `/me`
- 승인 대기/거절/승인 상태
- 내 active missions 5칸, 정확한 진행도, refill/reroll 상태
- 미공개 draw 목록과 재추첨 가능 상태의 정적 표현

### 관리자 shell

`/admin` 아래 dashboard, users, applications, participants, seasons, scoring, matches, draws, missions, mvp-baselines, content, audit-exports, system의 navigation과 대표 table/form shell을 만든다. 이 단계에서는 mutation을 가짜 성공시키지 말고 disabled/demo 상태를 명확히 한다.

## 반응형 요구

- 390px에서 핵심 동작이 잘리지 않는다.
- leaderboard는 순위와 Riot ID를 고정하며 부가 열은 가로 스크롤 또는 행 확장으로 제공한다.
- 1280~1440px에서 정보 밀도가 지나치게 낮지 않다.
- 긴 이름, 5자리 점수, 공동 순위, 기록 없음, 종료 상태를 fixture로 확인한다.
- reduced motion과 keyboard focus를 기본부터 적용한다.

## 테스트/인수 조건

- Storybook 도입은 필수 아님. 대신 대표 component unit test와 Playwright screenshot/smoke를 만든다.
- 모든 링크가 존재하는 route로 이동한다.
- mobile/desktop에서 overflow가 통제된다.
- console error와 hydration mismatch가 없다.
- Lighthouse 점수를 억지로 맞추기보다 semantic HTML, heading 순서, label, table header를 검증한다.

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

---

<!-- SOURCE: prompts/04_AUTH_AND_AUTHORIZATION.md -->

# 세션 04 — Credentials 인증, 세션, 권한

사이트 자체 `loginId + password` 인증과 USER/ADMIN 권한을 production-grade로 구현하라. Riot 계정 연결은 다음 세션이며, 이 세션에서는 일반 계정과 보안 경계를 완성한다.

## 구현 범위

- 회원가입: loginId, password, password confirmation, display name, 약관 동의 version
- loginId 정규화와 허용 문자/길이 정책
- Argon2id hash와 안전한 parameter 설정
- 로그인, 로그아웃, 현재 세션 조회
- 서명된 JWT에는 최소 정보와 opaque session ID만 두고 `AuthSession` DB 상태로 revoke/expiry를 확인한다.
- HttpOnly cookie, production Secure, SameSite=Lax, 명확한 max age
- 세션 rotation과 logout revocation
- USER/ADMIN server-side guard
- `/me`, `/admin/*`, auth 페이지 redirect 정책
- 관리자 생성은 공개 endpoint가 아닌 `pnpm admin:create` CLI로 제공
- 로그인 실패 기록, generic error, rate limit/lockout 정책
- 상태 변경 route/server action의 origin 또는 CSRF 검증
- audit log가 필요한 관리자 권한 변경 서비스 경계

## 금지

- localStorage token
- 평문 비밀번호 또는 복호화 가능한 저장
- middleware만 믿는 관리자 권한
- client가 role을 보내면 신뢰하는 처리
- hard-coded production admin password
- secret 기본값으로 production 부팅

## UI 연결

- 세션에 따라 navigation과 CTA를 바꾼다.
- field-level validation과 접근 가능한 오류 요약을 제공한다.
- redirect query는 same-origin safe path만 허용한다.
- 가입 후 자동 로그인 여부는 `docs/DECISIONS.md`에 기록하고 일관되게 적용한다.

## 테스트

- signup/login/logout 성공
- 잘못된 credential의 동일한 외부 오류
- duplicate/정규화된 loginId
- hash 검증
- 만료·변조·revoke session
- USER의 admin route/API 차단
- rate limit
- CSRF/origin
- cookie attributes

## 인수 조건

- 브라우저 새로고침과 server component에서 인증 상태가 일치한다.
- 비밀값과 hash가 로그·응답에 노출되지 않는다.
- 관리자 mutation은 각 endpoint/service에서 재검증된다.
- E2E로 가입→로그인→보호 페이지→로그아웃이 통과한다.

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

---

<!-- SOURCE: prompts/05_RIOT_APPLICATION_AND_APPROVAL.md -->

# 세션 05 — Riot ID 참가 신청과 관리자 승인

회원이 `gameName#tagLine`으로 참가 신청하고 관리자가 검토·승인·거절하는 전체 흐름을 구현하라. 실제 Riot 네트워크 adapter는 세션 06에서 완성하므로, 이 세션에서는 명확한 `RiotIdentityResolver` interface와 결정론적 Mock 구현을 사용한다.

## 사용자 흐름

1. 로그인한 USER가 `/apply`에서 Riot ID와 선택 정보(주 포지션, 부 포지션, 실명 공개 동의 등 PRD 항목)를 제출한다.
2. server가 Riot ID를 parse하고 resolver로 PUUID/현재 표시 ID를 검증한다.
3. 신청을 `PENDING`으로 저장한다.
4. 사용자는 상태, 제출 시각, 거절 사유를 `/me`에서 본다.
5. ADMIN은 신청 목록·상세에서 검증 결과와 중복 여부를 보고 승인/거절한다.
6. 승인 transaction은 Participant, identity history, season participant, 초기 participant week 상태를 정확히 만든다.

## 규칙

- `#`가 여러 개이거나 gameName/tagLine이 비어 있으면 거부한다. 표시 문자열과 정규화 검색값을 분리한다.
- PUUID가 참가자 고유 기준이다. Riot ID 변경 가능성을 고려한다.
- 동일 시즌에 같은 PUUID가 두 계정으로 중복 참가하지 못한다.
- 기존 pending 신청 처리, 재신청, 승인 후 변경 정책을 명시한다.
- 관리자 승인/거절/수정은 AuditLog와 actor, reason을 남긴다.
- 시작 이후 중도 참가에는 명시적 경고와 시작 snapshot 정책을 적용한다.
- resolver 장애는 “존재하지 않음”으로 오인하지 말고 재시도 가능한 상태로 구분한다.

## UI

- 신청 form의 `gameName`과 `tagLine`을 분리하거나 하나의 Riot ID 입력으로 받아 명확히 parse한다.
- 승인 대기, 검증 실패, API 일시 장애, 중복 계정 상태를 구분한다.
- 관리자 bulk approve는 초기에는 만들지 않거나, 만들 경우 각 항목 검증과 부분 실패 보고를 제공한다.

## 테스트

- 정상/비정상 Riot ID
- not found와 temporary failure 구분
- 동일 PUUID 중복 race
- 승인 transaction rollback
- USER의 승인 endpoint 차단
- 거절 후 재신청 정책
- AuditLog
- E2E 신청→관리자 승인→참가자 상태 전환

## 인수 조건

- 실제 API key가 없어도 Mock으로 전체 흐름이 작동한다.
- 실제 adapter가 interface만 구현하면 UI/서비스 수정 없이 교체 가능하다.
- 승인되지 않은 USER는 경기·미션 참가자로 취급되지 않는다.

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

---

<!-- SOURCE: prompts/06_RIOT_CLIENT_AND_MOCK.md -->

# 세션 06 — Riot API Client, 정규화, Mock

공식 Riot API를 server-only adapter로 구현하고, 동일 interface를 만족하는 결정론적 Mock adapter를 완성하라. UI나 domain이 Riot 원본 DTO에 직접 의존하지 않게 한다.

## 구현 범위

- Account-V1: Riot ID → PUUID/표시 ID
- Match-V5: PUUID의 match ID 목록, match info, timeline
- 현재 랭크에 필요한 platform API adapter
- KR platform routing과 ASIA regional routing 분리
- Data Dragon 또는 허용된 정적 데이터: champion/item/rune mapping과 cache/fallback
- `MOCK_RIOT_API`에 따른 composition root 선택

## HTTP client 요구

- server-only secret
- timeout과 abort
- 401/403/404/429/5xx/네트워크 오류를 typed error로 변환
- `Retry-After` 존중, bounded exponential backoff+jitter
- 호출별 correlation metadata는 남기되 key와 과도한 개인정보는 로그에서 제거
- response schema validation/defensive normalization
- rate-limit headers가 있으면 관측 정보로 기록
- 범용 proxy endpoint 금지

## Domain DTO

최소 다음 정규화 타입을 만든다.

- RiotIdentity
- RankedSoloSnapshot
- MatchSummary / NormalizedMatch
- NormalizedParticipant
- NormalizedTeam
- TimelineEvent/Frame의 필요한 subset
- StaticChampion/StaticItem

원본 raw JSON 보존이 필요하면 encrypted가 아니라 DB access-controlled JSON으로 제한하고 retention 정책을 문서화한다. domain 계산은 정규화 DTO를 사용한다.

## Mock 시나리오

- 정상 계정, not found, rate limited, expired key
- 여러 페이지 match ID
- 승리/패배/remake/unsupported queue
- timeline 누락 및 retry 성공
- 긴 Riot ID 변경
- 모든 포지션과 representative mission 필드
- deterministic clock/fixture ID

## 테스트

네트워크를 실제 호출하지 않는 contract test를 작성한다.

- URL routing과 query/path encoding
- header에 API key가 server에서만 설정됨
- error mapping/retry
- Retry-After
- malformed/missing fields
- Data Dragon cache/fallback
- Mock과 real adapter의 interface parity

## 인수 조건

- `MOCK_RIOT_API=true`에서 외부 네트워크 없이 테스트가 통과한다.
- key가 없고 Mock=false이면 시작 또는 기능 호출 시 명확하고 안전한 오류를 낸다.
- client bundle, rendered HTML, error payload에 key가 없다.
- Account/Match/Rank routing이 서로 섞이지 않는다.

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

---

<!-- SOURCE: prompts/07_MATCH_SYNC_AND_RANK_SNAPSHOTS.md -->

# 세션 07 — 경기 동기화와 랭크 스냅샷

승인된 참가자의 이벤트 기간 솔로 랭크 경기와 공식 랭크를 수집하는 idempotent sync pipeline을 구현하라. 이 세션에서는 경기 저장과 processing 상태까지 완성하며, 점수 정산 자체는 세션 08에서 연결한다.

## 동기화 흐름

1. sync 대상 season/participant를 선택한다.
2. `JobLease`와 participant cursor/cooldown을 확보한다.
3. Riot API에서 match ID를 페이지별 조회한다.
4. 이미 저장된 ID와 이벤트 범위를 이용해 조기 중단한다.
5. 신규 match info를 가져와 정규화한다.
6. queue, gameStartTimestamp, 최소 시간, remake/aborted 조건을 판정한다.
7. Match/Team/RawParticipant/ParticipantMatch를 transaction으로 upsert한다.
8. timeline 필요 여부를 표시하고 별도 단계에서 가져온다.
9. processing outbox 또는 상태를 통해 후속 score/MVP/mission service가 안전하게 실행되게 한다.
10. 현재 solo rank snapshot과 일일 standing snapshot을 갱신한다.

## 핵심 규칙

- 인정 경기는 이벤트 기간 안에 시작된 `RANKED_SOLO_5x5`다.
- 시작일 이전 경기와 종료 이후 시작 경기는 정산하지 않는다.
- 같은 Riot match ID는 한 시즌에서 한 번만 처리한다.
- 외부 API 호출은 DB transaction 밖에서 수행한다.
- 동일 참가자가 포함된 같은 경기를 여러 participant sync가 발견해도 원본 Match는 한 번만 저장한다.
- 추적 참가자가 한 경기에 둘 이상 있을 가능성을 안전하게 처리한다.
- cursor는 최신만 보는 단순 timestamp가 아니라 late-arriving match와 pagination을 고려한다.
- 한 요청의 time budget과 batch size를 제한한다.
- partial failure를 SyncRun/SyncRunItem에 기록한다.

## 랭크 스냅샷

- 현재 tier/division/LP/wins/losses와 조회 시각
- 이벤트 시작 기준 snapshot
- 일별 snapshot과 어제 대비 순위 변화 계산 기반
- unranked/변동 없음/API 실패 상태
- 티어 환산 LP가 필요하면 domain function과 version을 명시한다.

## 운영 endpoint

- ADMIN 수동 전체/개별 sync
- secret으로 보호된 scheduler endpoint가 같은 application service를 호출
- dry-run 또는 limit 옵션은 production에서 악용되지 않게 admin/secret으로 보호
- 응답은 처리 요약과 run ID를 주고 raw secret/대량 payload를 노출하지 않는다.

## 테스트

- 동일 match 중복 발견/동시 ingest
- API failure 후 재실행
- 이벤트 시작/종료 정확 경계
- invalid queue/remake
- 같은 경기의 복수 참가자
- cursor pagination과 late arrival
- lease 경쟁
- transaction rollback
- rank snapshot/history

## 인수 조건

- 같은 sync를 여러 번 실행해 DB row와 후속 processing 항목이 중복되지 않는다.
- 20명 batch가 함수 time budget 안에서 나뉘어 처리된다.
- 관리자 화면에서 마지막 성공/실패와 신규 경기 수를 확인할 수 있다.
- 아직 점수 정산 전인 match를 명확히 조회할 수 있다.

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

---

<!-- SOURCE: prompts/08_SCORING_LEDGER_AND_REROLL.md -->

# 세션 08 — 17~23점 정산 원장과 재추첨

경기 승패에 따른 포인트를 서버에서 공정하게 생성·즉시 정산하고, 공개와 MVP/ACE 재추첨을 append-only ledger로 처리하라.

## 첫 draw와 정산

- `POINT_MODE=RANDOM_17_23`에서 crypto-safe rejection sampling으로 17~23을 정확히 균등 선택한다.
- `FIXED_20`에서는 magnitude 20을 사용하되 동일 pipeline과 ledger를 거친다.
- 경기 처리 시 FIRST draw value와 nonce를 생성하고 commitment를 저장한다.
- commitment input/version/canonical encoding을 domain 함수로 고정한다.
- win은 `+magnitude`, loss는 `-magnitude`다.
- draw 생성과 score ledger 반영, ParticipantWeek read value 변경은 한 transaction에서 일어난다.
- 사용자가 reveal하지 않아도 leaderboard에는 점수가 반영된다.
- 동일 participantMatch에 첫 draw/ledger가 두 번 생기지 않는다.

## Reveal

- 목록 API는 미공개 value/nonce를 반환하지 않는다.
- reveal mutation은 authorization 후 value/nonce/commitment를 반환하고 timestamp를 기록한다.
- repeated reveal은 같은 결과를 반환한다.
- 기본 12시간 자동 공개 job과 관리자 설정을 지원한다.
- commitment verifier를 사용자에게 보여줄 수 있는 순수 함수/설명 데이터를 제공한다.

## 재추첨

세션 10의 MVP engine이 entitlement를 발급할 interface를 먼저 정의하라. 현재는 권한이 없으면 닫혀 있어야 하며 개발 fixture에서만 명시적으로 테스트한다.

- entitlement당 최대 1회
- 확인 후 SECOND draw 생성
- 두 번째 결과가 무조건 최종, 같은 값 허용
- FIRST ledger를 수정하지 않고 `newSignedDelta - oldSignedDelta`의 adjustment ledger 추가
- first로 되돌리기 금지
- 기한과 season finalization 확인
- 동시 클릭 race에서 한 번만 소비
- 모든 상태와 AuditLog/도메인 이벤트 기록

## 순위 계산

- 총 main score 내림차순
- wins-losses 내림차순
- wins 내림차순
- 완전 동점은 competition rank `1,1,3`
- ParticipantWeek cached score와 ScoreLedger sum reconciliation 도구

## API/서비스 경계

- ingest pipeline의 unscored match backfill service
- score/reveal/reroll application service
- read DTO는 signed delta와 display magnitude를 혼동하지 않는다.
- admin adjustment는 별도 reason-required service로 ledger를 추가한다.
- 무효화는 reversal ledger와 match status 변경으로 처리한다.

## 테스트

- 17~23 모든 branch
- modulo bias 없는 mapping 구조
- win/loss 부호
- commitment tamper 실패
- value/nonce 비공개 DTO
- repeated reveal
- 자동 공개
- reroll better/worse/same
- concurrent reroll
- fixed mode
- duplicate processing/rollback
- rank tie
- reconciliation

## 인수 조건

- 어떤 코드 경로도 기존 ScoreLedger row의 delta를 직접 수정하지 않는다.
- reveal 여부가 순위를 바꾸지 않는다.
- 같은 경기 재처리와 동시 호출에도 점수가 한 번만 반영된다.
- 정책상 random mode를 끄더라도 데이터 모델과 UI가 깨지지 않는다.

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

---

<!-- SOURCE: prompts/09_POINT_REVEAL_EXPERIENCE.md -->

# 세션 09 — 포인트 봉인 공개 연출

세션 08의 실제 reveal API를 사용해 승패 후 17~23점 결과를 공개하는 긴장감 있는 UI를 구현하라. 콘셉트는 카지노 가챠가 아니라 “랭크 신호 해독 / 봉인된 결과 해제”다.

## 상태 머신

다음 상태를 명시적으로 모델링한다.

- idle
- requesting
- sealLocked
- signalScan
- instability
- finalApproach
- revealed
- error
- reducedMotionReveal

애니메이션 duration은 CSS token과 테스트 가능한 clock으로 관리한다. 기본 전체 약 4.8초, 1.5초 이후 건너뛰기 허용, reduced motion은 약 0.4초다.

## 연출 구조

1. 승리/패배 결과와 봉인된 commitment 표시
2. 버튼 누르면 서버 reveal을 한 번 요청
3. 네트워크 응답을 받은 뒤에도 실제 숫자는 마지막 단계까지 시각적으로 숨길 수 있으나 DOM/ARIA에 조기 노출하지 않는다.
4. 스캔 라인, 17~23 후보 pulse, 감쇠하는 tick, 최종 숫자 lock-in
5. 승리는 `+`, 패배는 `-`를 명확히 표시
6. 최종 score 변화, 현재 순위, 재추첨 가능 여부를 함께 보여준다.

후보 숫자 애니메이션은 결과를 다시 뽑는 것처럼 오해시키지 않게 “복호화 중”으로 설명한다. 최종 숫자는 서버 값과 반드시 같다.

## 재추첨 UX

- MVP/ACE badge와 사용 기한
- “두 번째 결과가 무조건 최종이며 더 나쁠 수 있고 되돌릴 수 없음” 확인
- FIRST와 SECOND의 차이, adjustment, 최종 score 표시
- 중복 클릭/새로고침 후 동일 상태 복원

## 접근성·안전

- 소리 기본 꺼짐. 소리를 추가한다면 명시적 사용자 toggle과 짧은 자체/허용 자산만 사용한다.
- flashing/rapid strobe 금지
- `prefers-reduced-motion` 존중
- keyboard focus, dialog trap, ESC 정책
- screen reader에 진행 단계와 최종 결과를 적절히 알림
- 애니메이션 오류가 정산 오류로 보이지 않게 최종 숫자 fallback
- 1.5초 전 skip button은 disabled 이유를 접근 가능하게 제공

## 화면 연결

- `/me`의 미공개 결과 queue
- 최근 경기 행의 “결과 확인”
- participant score history의 공개 상태
- 이미 자동 공개된 결과
- reveal할 것이 없는 empty state

## 테스트

- fake timers로 상태 전환
- reduced motion
- skip 가능 시점
- network slow/failure/retry
- component unmount/remount
- repeated reveal
- server result mismatch 방지
- reroll confirmation/concurrency error
- mobile viewport와 keyboard

## 인수 조건

- 체감 긴장감은 있으나 결과 생성 시점을 속이지 않는다.
- casino/slot/현금성 표현이 없다.
- 새로고침·오류·reduced motion에서도 실제 결과를 잃지 않는다.
- animation code가 scoring domain과 분리되어 있다.

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

---

<!-- SOURCE: prompts/10_MVP_ACE_ENGINE.md -->

# 세션 10 — MVP/ACE 표준화 평가 엔진

포지션·티어 차이를 표준화해 각 경기 승리 팀의 MVP와 패배 팀의 ACE를 계산하고, 신뢰할 수 있는 baseline에서만 재추첨 entitlement를 발급하라.

## Baseline 데이터

- 포지션: TOP/JUNGLE/MIDDLE/BOTTOM/UTILITY
- tier bucket: PLATINUM/EMERALD/DIAMOND/MASTER_PLUS
- metric별 mean, stddev, sampleCount, patchRange, collectedAt, sourceLabel, version
- 상태: DRAFT/VALIDATED/PUBLISHED/ARCHIVED와 `DEMO_ONLY`
- CSV/JSON import: schema validation → dry-run report → publish의 2단계
- publish 후 immutable. 새 버전으로 교체하고 과거 평가는 기존 version 유지
- stddev <= 0, 표본 부족, 필수 metric 누락을 차단 또는 명시적으로 보류

실제 외부 표본을 생성했다고 가장하지 마라. fixture는 DEMO_ONLY로 표시한다.

## 평가 계산

`docs/DECISIONS.md` D-005/D-006의 공통 70%와 포지션 보정 30%를 정확히 구현한다.

- raw metric → per-minute/ratio normalized metric
- baseline mean/stddev로 z-score
- 기본 `[-3,3]` winsorize
- metric group 내 평균
- 누락 metric 처리 정책을 명확히 구현: 최소 충족률 미달은 PENDING, 허용 범위면 남은 weight를 결정론적으로 renormalize
- game participant의 시작 시점 tier bucket과 teamPosition 사용
- score calculation version 저장
- 각 group score와 최종 score를 audit 가능한 breakdown으로 저장

## 팀 우승자 선택

- 승리 팀 최고 = MVP, 패배 팀 최고 = ACE
- tie-break: total → KDA/KP group → objective involvement → fewer deaths → deterministic participant key
- 대회 추적 참가자가 해당 팀의 최고 평가자일 때만 entitlement 발급
- 동일 팀에 대회 참가자가 여러 명이면 전체 5명과 비교한 뒤 각자에게 올바르게 처리
- invalid/remake/missing data 경기는 보상 없음 또는 PENDING

## Pipeline 연결

- match normalize 완료 후 evaluation job
- baseline publish 전 대기 상태
- retry/idempotency key
- evaluation 완료 시 scoring service에 reroll entitlement 생성
- rerun은 결과를 중복 발급하지 않는다.
- baseline bug correction은 old row mutation 대신 새 version/re-evaluation/correction audit 절차

## 관리자 기능 최소 연결

- baseline 목록/상세
- CSV/JSON dry-run validation report
- publish confirmation
- DEMO_ONLY 경고
- 경기 평가 breakdown 조회

## 테스트

- 포지션별 weight 합
- z-score/winsorize
- missing/stddev zero/sample 부족
- tier bucket 경계
- 모든 tie-break
- 승리/패배 팀 선택
- 추적 참가자가 최고가 아닌 경우
- DEMO_ONLY production 차단
- duplicate evaluation/entitlement
- 과거 baseline version 보존

## 인수 조건

- 동일 raw match와 동일 baseline/version은 항상 같은 결과다.
- 참가자에게 점수 산출 근거를 group 단위로 설명할 수 있다.
- 실제 published baseline 없이는 production 재추첨권이 발급되지 않는다.

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

---

<!-- SOURCE: prompts/11_MISSION_ASSIGNMENT_ENGINE.md -->

# 세션 11 — 주간 미션 배정·리롤·보충 엔진

100개 개별 evaluator를 실행하기 전에, 주간 미션의 상태 머신과 후보 배정 규칙을 완성하라. 이 세션에서는 evaluator registry interface와 몇 개의 stub/대표 evaluator만 사용하고 M001~M100 전체 구현은 다음 두 세션에서 수행한다.

## 상태와 배정

- 주차 시작 시 참가자마다 5개 active assignment
- assignment definition version snapshot
- 동일 주차에서 완료한 미션 재등장 금지
- rerolled mission은 deferred pool로 이동
- unseen eligible mission이 남아 있으면 deferred는 후보에서 제외
- unseen을 모두 본 뒤에만 deferred 재등장 가능
- 같은 미션 동시 중복 활성화 금지
- 난이도/유형/role/timeline cap은 `MISSION_CATALOG` 가드레일 적용
- crypto-safe selection과 audit 가능한 selection metadata

## 보충

- 주차 시작 시각 기준 6시간마다 credit 1개
- 최대 3개
- 완료로 빈 슬롯이 생기면 credit이 있으면 즉시 채우고 1개 소비
- credit이 없으면 vacancy 유지, 다음 accrual 시 즉시 채움
- scheduler가 놓친 시간이 있어도 현재 시각으로 누적 credit을 결정론적으로 계산
- 동시 refill job에서 중복 assignment 금지

## 리롤

- 참가자별 1시간 cooldown
- active mission 하나를 즉시 대체
- refill credit은 소비하지 않음
- 완료/이미 reroll 중/주차 종료 assignment는 리롤 불가
- 경기 진행 중 리롤해도 해당 경기 판정은 game-start snapshot 사용
- 동시 클릭 race에서 한 번만 성공

## 경기 시작 Snapshot

- match의 gameStartTimestamp에 각 참가자에게 활성인 assignment ID 집합을 확정
- 경기 ingestion이 늦어도 과거 시점 상태 이력으로 정확히 복원
- 새로 활성된 누적 미션은 activation 이후 시작 경기만 집계
- snapshot 생성과 evaluator 실행을 분리하되 동일 match 재처리에 idempotent

## API/UI 연결

- 내 active 5개, vacancy, current/target, next credit, stored credits, reroll cooldown
- history: completed/rerolled/expired
- reroll mutation의 구체적 오류
- admin이 정의 version/pool을 설정하되 진행 중 definition을 덮어쓰지 않음

## 테스트

fake clock과 seeded RNG adapter를 사용해 검증한다.

- 최초 5개 가드레일
- unseen 우선/deferred 후순위
- 6시간 경계와 cap 3
- vacancy 즉시 채움
- 1시간 cooldown
- concurrent reroll/refill
- 경기 중 reroll snapshot
- 주차 종료/새 주차 reset
- 100개보다 후보가 적은 상태의 안전한 동작

## 인수 조건

- 모든 시간 규칙이 `Asia/Seoul` 표시와 UTC 저장에서 일관된다.
- scheduler가 여러 번 호출되어도 동일 시각의 상태가 중복 생성되지 않는다.
- evaluator 구현과 무관하게 assignment lifecycle을 완전히 테스트할 수 있다.

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

---

<!-- SOURCE: prompts/12_MISSION_EVALUATORS_MATCH_AND_OBJECTIVES.md -->

# 세션 12 — 미션 Evaluator M001~M055

`docs/MISSION_CATALOG.md`의 M001~M055를 실제 evaluator registry에 구현하고 match processing pipeline에 연결하라. 임의로 미션을 생략하거나 단순 title 문자열 평가로 대체하지 마라.

## 구현 대상

- M001~M020: 결과·전투·피해·보호
- M021~M035: 성장·시야·오브젝트 피해
- M036~M055: 멀티킬·first event·team objective·속도/장기전

## Evaluator 계약

각 evaluator는 다음을 입력받는다.

- normalized match/team/participant
- 필요한 경우 normalized timeline
- assignment snapshot과 activation time
- evaluator version/context

각 결과는 최소 다음을 반환한다.

- `PASS | FAIL | PENDING_DATA | NOT_APPLICABLE`
- currentValue, targetValue, unit
- machine-readable reason/evidence
- evaluatorVersion

필드가 없다는 이유로 0을 가정하지 않는다. 타임라인·Challenges 필드가 필요한 M041/M044/M046~M048 등은 source 우선순위와 fallback을 문서대로 구현하고, 신뢰할 수 없으면 PENDING_DATA로 보낸다.

## 계산 기준

- KDA denominator `max(1,deaths)`
- KP는 team kills 0이면 미달/명시 규칙
- per-minute는 gameDuration seconds를 사용
- CS = lane minions + neutral minions
- 경계값은 inclusive
- 최소 경기 시간/인정 queue filter를 evaluator 바깥의 공통 gate에서도 재확인
- team objective는 참가자의 teamId와 정확히 연결
- timestamp 단위를 명확히 변환

## Progress/Completion 연결

- SINGLE 미션은 해당 경기에서 PASS면 완료 event와 completion ledger를 한 번 생성
- 동일 `(assignmentId, matchId, evaluatorVersion)` 재실행은 no-op
- 여러 active mission이 한 경기에서 동시에 완료 가능
- PENDING_DATA는 retry queue에 남고 사용자에게 “판정 대기”로 표시
- evidence는 admin breakdown에서 읽을 수 있게 저장하되 raw payload 전체를 복제하지 않음

## 테스트

M001~M055 각각에 최소 성공/실패/경계 fixture를 작성하라. 공통 table-driven test를 활용하되, 복잡한 evaluator에는 독립 테스트를 추가한다.

반드시 포함:

- team kills 0
- 정확히 15:57
- game duration unit
- first blood assist
- objective assistingParticipantIds
- Challenges 필드 누락
- 동일 경기 재처리
- 한 경기 다중 완료

## 인수 조건

- M001~M055가 registry에 모두 등록되며 missing code check가 통과한다.
- seed의 각 definition evaluatorKey가 실제 구현과 일치한다.
- evaluator 결과가 UI의 exact progress/evidence로 이어진다.
- `pnpm test`에서 누락 evaluator가 있으면 실패하는 registry completeness test가 있다.

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

---

<!-- SOURCE: prompts/13_MISSION_EVALUATORS_TIMELINE_AND_CUMULATIVE.md -->

# 세션 13 — 미션 Evaluator M056~M100과 통합

`docs/MISSION_CATALOG.md`의 M056~M100을 구현하고, 세션 11~12의 assignment engine·match pipeline과 통합해 주간 미션 시스템을 end-to-end로 완성하라.

## 구현 대상

- M056~M070: timeline·초반 CS·아이템 구매/빌드
- M071~M085: 포지션·룬·챔피언 tag
- M086~M100: 누적·distinct·연승·MVP/ACE 내부 이벤트

## Timeline/빌드 규칙

- timestamp ms ↔ seconds 변환을 한 곳에서 처리
- 10/15/20분 frame은 정확한 시점 frame 또는 직전 안전 frame 선택 규칙을 문서화
- ITEM_PURCHASED/ITEM_SOLD/ITEM_UNDO 순서 반영
- 현재 패치의 control ward, potion, Doran, support start, boots, completed item 분류를 static data resolver에서 가져옴
- M070의 2분 전 구매 원가에서 trinket 제외, undo/sell 처리
- timeline이 없으면 FAIL이 아니라 PENDING_DATA

## 포지션·룬·챔피언

- teamPosition을 표준 5포지션으로 정규화
- primaryPosition과 off-primary 비교
- rune primary style ID
- gameVersion에 대응하는 champion tag
- 미지원/누락 position이나 static data는 안전한 보류

## 누적

- activation 이후 시작 경기만 집계
- `MissionProgressEvent` append-only 방식으로 delta/evidence 저장
- 같은 match 중복 처리 방지
- distinct champion/position은 set semantics
- win streak은 패배 시 current reset, target 달성 시 completion
- M100은 published non-demo MVP/ACE award event만 반영
- completion 후 추가 경기로 점수를 다시 지급하지 않음

## 주간 순위

- mission completion score 합
- 동점은 competition rank `1,1,3`
- Riot ID + 실명(정책/동의에 따라) 표시
- 완료 개수, 총점, 최근 완료를 read model로 제공
- 주차 변경 시 과거 데이터는 history에서 유지

## UI/실시간 갱신

- `/me`의 5개 미션, exact progress, 판정 대기, next refill, reroll
- 완료 시 한 번의 시각적 update와 여러 미확인 완료가 있으면 합산 알림
- `/missions` weekly ranking
- `/history` 지난 주차
- 15~30초 polling/revalidation, WebSocket 필수 도입 금지

## 테스트

- M056~M100 각각 성공/실패/경계
- purchase/sell/undo
- frame 누락
- activation 이전/이후 혼합
- distinct duplicate
- streak reset
- MVP demo exclusion
- simultaneous completion
- week rollover/history
- leaderboard tie
- full registry M001~M100 completeness

## 인수 조건

- 100개 definition과 100개 evaluator mapping이 완전하다.
- 하나의 fixture match가 여러 미션을 완료해도 각각 한 번만 반영된다.
- 누적 진행도를 ledger/event에서 재구축할 수 있다.
- UI에서 37/100 같은 정확한 진행도를 표시한다.

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

---

<!-- SOURCE: prompts/14_DASHBOARDS_LEADERBOARDS_AND_HISTORY.md -->

# 세션 14 — 실제 데이터 대시보드·순위·기록

세션 03의 정적 화면을 실제 server-side read model과 연결하라. public dashboard, 전체 순위, 참가자 상세, 경기 기록, 내 정보, 주간/과거 기록이 seed와 production 데이터에서 정확히 동작해야 한다.

## 메인 `/`

첫 viewport 우선순위:

1. 종료 countdown
2. 현재 TOP 5
3. 전체 순위 바로가기

TOP 5 각 행:

- 현재 점수와 순위
- Riot ID + tagLine
- 현재 tier/LP
- 어제 대비 순위 변화
- 시작일 대비 LP 변화
- 승/패/승패 차/승률
- 현재 연승·연패
- 최근 경기 요약과 상세 링크

아래 영역:

- 오늘 가장 점수가 아니라 “LP가 많이 오른 참가자”, 최다 연승, 최다 게임
- 오늘 데이터가 없으면 최근 기록을 쓰되 label로 날짜/대체 상태 표시
- 최근 경기: Riot ID, W/L, champion, game time, KDA, signed point change, streak, detail
- 공지와 last sync freshness

## 전체 순위

- 정렬은 score → W-L diff → wins → joint rank
- sticky rank/Riot ID
- 서버 pagination 또는 20명 전체의 합리적 처리
- column help/tooltip
- mobile row expansion
- stale/finalized/week selector

## 참가자·경기·내 정보

- `/participants/[id]`: rank, official LP trend chart, score ledger chart/table, matches, mission summary, MVP/ACE
- `/matches`: queue-valid matches, filter participant/result/champion/date, no raw sensitive payload
- `/me`: 신청 상태, active missions, draw reveal, reroll, personal history
- `/history`: immutable WeekSnapshot/FinalStandingSnapshot
- `/rules`: 현재 published settings/version에서 규칙·확률·고지 렌더링

## Read model/성능

- query functions는 server-only이고 Prisma를 component 곳곳에서 호출하지 않는다.
- leaderboard/top5/today/recent를 명확한 DTO로 제공한다.
- N+1 방지, 필요한 index 확인, cache/revalidation strategy
- mutation 후 올바른 path/tag revalidate
- 데이터가 없거나 API stale이어도 페이지 전체가 500이 되지 않는다.
- 날짜는 Asia/Seoul 표시, 상대 시간만으로 중요한 경계를 숨기지 않는다.

## 차트

- Recharts를 사용하되 client bundle을 필요한 영역으로 제한
- accessible textual summary/table fallback
- empty/one-point/long history 처리
- 과도한 animation 금지

## 테스트

- read query 정확성
- rank tie
- 오늘 vs 최근 fallback
- yesterday/start snapshot 누락
- long Riot ID/sticky scroll
- public/private data boundary
- finalized history immutability
- representative mobile/desktop E2E

## 인수 조건

- Mock 하드코딩을 제거하고 seed DB의 값이 모든 화면에 일관되게 보인다.
- score와 ledger, mission rank와 completion 합계가 일치한다.
- 첫 화면의 세 핵심 요소가 desktop/mobile에서 식별 가능하다.

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

---

<!-- SOURCE: prompts/15_ADMIN_CONSOLE.md -->

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

---

<!-- SOURCE: prompts/16_SCHEDULER_REFRESH_AND_OBSERVABILITY.md -->

# 세션 16 — 스케줄러, 준실시간 갱신, 관측성

동일한 idempotent sync service를 MANUAL, GITHUB_SCHEDULE, VERCEL_CRON, WORKER 모드에서 안전하게 호출할 운영 계층을 완성하라. 무료 환경의 제약을 숨기지 않고 경기 종료 후 수 분 내 반영을 목표로 한다.

## Scheduler endpoint

- `CRON_SECRET` 또는 HMAC 서명 검증
- method와 content type 제한
- replay 방지에 필요한 timestamp/nonce 정책(사용하는 모드에 맞춤)
- global/season job lease
- batch size/time budget/cursor
- 중복 호출 no-op 또는 안전 continuation
- 응답에 run ID, processed/new/skipped/failed/remaining만 제공
- secret/query payload 로그 redaction

## GitHub Actions

- 약 5분 간격의 예약 workflow 예시
- 최소 permissions
- repository secret 사용
- endpoint failure가 눈에 보이도록 exit code/summary
- manual dispatch 복구
- 예약 실행 지연 가능성을 README/운영 UI에 명시

## Vercel/Worker

- `vercel.json` 또는 현재 공식 방식의 Cron 설정은 선택된 플랜 제약과 일치
- Hobby에서 빈번한 Cron이 가능하다고 가정하지 않음
- worker adapter는 같은 service를 사용하고 별도 business logic 복제 금지
- serverless max duration을 넘기지 않게 continuation

## 화면 갱신

- public 데이터는 15~30초 polling 또는 framework revalidation
- tab hidden일 때 빈도 완화
- user mutation 후 즉시 해당 read model 갱신
- stale indicator와 마지막 성공 시각
- WebSocket/Redis를 필수 의존성으로 추가하지 않음

## 관측성

- structured logger와 correlation/run ID
- SyncRun metrics: duration, API calls, 2xx/404/429/5xx, new matches, processed, pending, failed
- draw/mission/MVP processing lag
- failed job/admin alert surface
- PII와 secret redaction
- provider-specific observability SDK는 선택 사항이며 core interface를 오염시키지 않음

## 복구 도구

- retry failed run item
- participant/season resync
- unprocessed match backfill
- score/mission reconciliation dry-run
- automatic reveal backlog
- stale lease recovery with safety window

## 테스트

- missing/wrong secret
- concurrent scheduler request
- timeout continuation
- partial failure/retry
- 429 backoff metadata
- stale lease
- same endpoint across modes
- polling visibility behavior
- log redaction

## 인수 조건

- 예약 호출이 겹치거나 누락되어도 데이터가 이중 반영되지 않는다.
- 운영자는 마지막 성공과 실패 원인을 사이트에서 확인할 수 있다.
- 무료 운영과 안정 운영 모드의 차이가 README/RUNBOOK에 정확히 설명된다.

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

---

<!-- SOURCE: prompts/17_SECURITY_QA_AND_RELEASE.md -->

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

---

<!-- SOURCE: prompts/18_FINAL_PRODUCTION_AUDIT.md -->

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
