# AGENTS.md — 디럭스 솔랭 저장소 지침

이 파일은 이 저장소에서 작업하는 Codex/개발 에이전트의 공통 규칙이다. 하위 디렉터리에 더 구체적인 `AGENTS.md`가 있으면 해당 범위에서 우선한다.

## 1. 작업 시작 전에 반드시 읽을 문서

작업 범위와 관련된 문서를 먼저 읽는다.

1. `docs/DECISIONS.md` — 확정 규칙
2. `docs/PRD.md` — 화면·기능·인수 조건
3. `docs/ARCHITECTURE.md` — 계층·동기화·정산 구조
4. `docs/DATA_MODEL.md` — 데이터 불변식과 인덱스
5. `docs/MISSION_CATALOG.md` — 100개 evaluator 명세
6. `docs/TEST_PLAN.md` — 필수 테스트
7. `docs/RUNBOOK.md` — 배포·운영
8. `docs/EXTERNAL_CONSTRAINTS.md` — Riot/Vercel 등 외부 경계

충돌 우선순위는 현재 사용자 지시 → `DECISIONS` → `PRD` → `ARCHITECTURE` → `DATA_MODEL` → 나머지 문서 → 기존 코드다. 해결되지 않는 충돌은 숨기지 말고 `docs/DECISIONS.md`에 새 결정으로 기록한다.

## 2. 제품 목표

약 20명이 참여하는 League of Legends 솔로 랭크 대회를 운영한다. 사이트는 회원가입, Riot ID 참가 신청과 관리자 승인, Riot API 기반 경기 수집, 승패별 17~23점 정산과 봉인 공개, MVP/ACE 재추첨, 주간 미션 5개, 메인·주간 순위, 참가자 기록, 관리자 운영 기능을 제공한다.

초기 범위에서 팀전, 경매, 코인 상점, 슬롯, 임의 플레이어 전적검색, 실시간 관전, Riot Sign On은 제외한다.

## 3. 기술 기준

- Next.js App Router
- React와 TypeScript strict
- Tailwind CSS, shadcn/ui, lucide-react
- Recharts
- Prisma ORM + PostgreSQL
- pnpm
- Vitest + React Testing Library
- Playwright

작업 시작 시점의 최신 안정 GA 버전을 사용한다. beta/canary/experimental 패키지를 임의 도입하지 않는다. 패키지를 추가할 때는 필요성, 유지보수 상태, bundle·보안 영향을 검토하고 lockfile을 커밋한다.

## 4. 권장 명령

저장소가 아직 초기화되지 않았다면 해당 세션 프롬프트에 따라 만든다. 초기화 후 다음 명령을 유지한다.

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm check
```

DB 명령은 `db:generate`, `db:migrate`, `db:seed`, `db:studio`처럼 일관된 이름을 사용한다. production에서 임의 `db push`를 실행하지 않는다.

## 5. 작업 방식

- 먼저 저장소 상태와 관련 구현을 읽고 간단한 계획을 제시한다.
- 현재 세션 범위만 구현한다. 인접 코드를 대규모 재작성하지 않는다.
- 안전한 로컬 파일 수정과 테스트는 진행한다.
- Git push, 외부 배포, production DB 변경, 유료 리소스 생성, secret 교체는 명시적 승인 없이 하지 않는다.
- 외부 키가 없으면 Mock·adapter·검증 가능한 연결점까지 구현하고 완료했다고 가장하지 않는다.
- 생성된 임시 파일, dead code, 주석 처리한 구 구현을 남기지 않는다.
- TODO는 담당 이유와 완료 조건이 명확할 때만 남긴다.

## 6. 아키텍처 경계

- UI 컴포넌트에서 Prisma 또는 Riot SDK를 직접 호출하지 않는다.
- Route Handler/Server Action은 인증·검증 후 application service를 호출한다.
- 점수, 순위, 미션, MVP 계산은 framework 독립적인 domain 코드로 둔다.
- Riot DTO는 infrastructure adapter에서 정규화하고 domain에 외부 응답 구조를 전파하지 않는다.
- 외부 API 호출을 DB transaction 내부에서 수행하지 않는다.
- 날짜는 DB에 UTC로 저장하고 화면·주차 계산은 `Asia/Seoul` 규칙을 명시적으로 적용한다.
- mutation 입력은 schema validation을 거친다.
- read query와 write service를 구분하고 leaderboard N+1을 방지한다.

## 7. 데이터 불변식

다음은 구현 편의로 완화하지 않는다.

- PUUID가 Riot 참가자의 내부 기준 식별자다.
- 동일 Riot match ID를 한 시즌에서 두 번 정산하지 않는다.
- 모든 점수 변경은 append-only `ScoreLedger`다.
- 공개 버튼은 결과를 새로 생성하지 않는다. 첫 draw는 경기 처리 시 생성·정산된다.
- 재추첨은 최대 한 번이며 두 번째 결과가 최종이다. 기존 원장 행을 수정하지 않는다.
- 미션은 경기 시작 시 assignment snapshot으로 평가한다.
- 동일 assignment·match·evaluator version은 한 번만 반영한다.
- 관리자 수정은 correction/adjustment event와 AuditLog를 생성한다.
- Cron과 sync service는 중복·동시 호출에 idempotent하다.
- 실제 기준 데이터가 없으면 `DEMO_ONLY` MVP/ACE로 production 보상을 지급하지 않는다.

핵심 불변식은 애플리케이션 검사뿐 아니라 DB unique constraint와 transaction으로 보장한다.

## 8. Riot API 규칙

- Riot ID는 `gameName#tagLine`으로 입력받고 Account-V1을 통해 PUUID로 변환한다.
- KR platform과 ASIA regional routing을 adapter 설정에서 분리한다.
- API key는 서버 환경 변수에만 두고 브라우저·로그·오류 응답에 노출하지 않는다.
- 429의 `Retry-After`, 401/403, 404, 5xx를 구분한다.
- API가 없거나 실패해도 마지막 성공 데이터와 Mock 개발 환경을 유지한다.
- 범용 proxy를 만들지 않는다.
- 공식 정책·method·queue ID·필드는 구현 시점에 다시 확인한다.

## 9. 인증·보안

- 비밀번호는 Argon2id로 해시한다.
- 세션은 서명되고 만료되는 HttpOnly cookie를 사용한다.
- production cookie는 Secure, 기본 SameSite=Lax다.
- 관리자 권한은 server-side에서 매 mutation마다 확인한다.
- 로그인, 신청, sync, admin mutation은 rate limit 대상이다.
- 상태 변경 요청에 origin/CSRF 방어를 적용한다.
- 사용자·Riot ID·공지·관리자 사유는 안전하게 출력한다.
- secret을 코드·fixture·snapshot·source map에 포함하지 않는다.
- CSV export는 formula injection을 막는다.

## 10. 포인트 추첨

- 서버의 암호학적으로 안전한 난수를 사용한다.
- 17~23을 정확한 균등 확률로 매핑하며 modulo bias를 피한다.
- commitment와 nonce를 사용해 reveal 검증이 가능하게 한다.
- win은 양수, loss는 음수 ledger delta다.
- 자동 공개와 반복 reveal은 동일 결과를 반환한다.
- `POINT_MODE=FIXED_20` fallback을 보존한다.
- 현금, 유료 재추첨, 환전, 베팅 또는 카지노 표현을 추가하지 않는다.

## 11. UI·디자인

- 대형 스포츠 기록·전적 서비스의 정보 위계와 밀도를 참고하되 복제하지 않는다.
- graphite 기반 dark UI, 제한적 LED/glow, 명확한 승패·증감 표현을 사용한다.
- 과도한 gradient, glassmorphism, 둥근 카드 남발, 의미 없는 hero 문구를 피한다.
- 메인 첫 화면에 TOP 5, 종료 카운트다운, 전체 순위 링크가 명확해야 한다.
- 순위표는 순위와 Riot ID 열을 고정하고 실제 가로 스크롤 후 그림자를 보인다.
- `gameName#tagLine`은 tagLine을 항상 표시한다. 먼저 글자를 줄이고 필요하면 셀을 확장한다.
- 모바일에서 핵심 정보는 유지하고 부가 열은 행 확장으로 제공한다.
- icon-only control은 accessible label을 가진다.
- `prefers-reduced-motion`을 존중한다.

## 12. 품질 기준

완료 전 최소 실행:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

DB 작업이면 integration test, 주요 흐름이면 Playwright smoke를 추가한다. 테스트를 통과시키려고 assertion·type check·lint rule을 약화하지 않는다. 외부 조건 때문에 실행하지 못한 검증은 구체적 이유와 재현 명령을 보고한다.

테스트는 특히 다음을 포함한다.

- 경기·ledger·mission 중복 처리
- transaction rollback
- draw commitment/reveal/reroll
- 공동 순위
- 주차 경계와 미션 snapshot
- Riot 오류와 retry/backoff
- 권한 없는 admin 접근
- 모바일·reduced motion

## 13. 문서와 결정 관리

구현이 명세를 변경하면 같은 change에서 문서를 갱신한다. 중요한 결정은 다음 형식으로 `docs/DECISIONS.md`에 추가한다.

```md
## D-XXX. 제목
- 배경
- 결정
- 대안과 기각 이유
- 데이터/마이그레이션 영향
```

README에는 설치·실행·환경 변수·Mock 사용법을 실제 코드와 일치시킨다.

## 14. 세션 완료 보고

최종 응답에 다음을 포함한다.

1. 구현한 범위와 핵심 결정
2. 변경 파일
3. 실행한 테스트/빌드 결과
4. 실행하지 못한 검증과 이유
5. 남은 외부 자격 증명·운영 작업
6. 발견한 리스크 또는 후속 작업
7. 추천 commit message

“완료”라는 표현은 해당 세션 acceptance criteria와 검증이 충족된 경우에만 사용한다.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
