# 디럭스 솔랭 — Codex 전체 제작 가이드

> **세션 00 이후 사용 주의:** 이 파일은 원본 패키지 생성 시점의 통합 snapshot이다. 2026-08-04 세션 00에서 canonical `docs/`, `prompts/`, `README_FIRST.md`, `PACKAGE_REVIEW.md`가 수정되었으므로 재생성 전까지 구현 기준으로 사용하지 않는다. 이후 작업은 개별 canonical 파일과 `IMPLEMENTATION_PLAN.md`를 읽는다.

제품 기획, 아키텍처, 데이터 모델, 100개 미션, 테스트·운영 지침, 원샷 및 00~18 세션 프롬프트를 한 파일로 합친 버전이다.

---

<!-- SOURCE: README_FIRST.md -->

# 디럭스 솔랭 — Codex 제작 패키지

이 패키지는 약 20명이 참가하는 리그 오브 레전드 솔로 랭크 대회 사이트를 Codex로 구현하기 위한 제품 명세, 저장소 지침, 데이터 설계, 미션 카탈로그, 단계별 실행 프롬프트를 포함한다.

## 핵심 결론

완성형 서비스를 한 번의 프롬프트로 생성하는 방식은 권장하지 않는다. 화면만 있는 데모는 한 번에 만들 수 있지만, 다음 항목은 단계별 검증이 필요하다.

- 계정·권한·관리자 승인
- PostgreSQL 스키마와 마이그레이션
- Riot API 키·라우팅·속도 제한·오류 처리
- 경기 중복 방지와 재처리 안전성
- 17~23점 추첨과 재추첨의 원자적 정산
- MVP/ACE 기준 데이터 버전 관리
- 주간 미션 활성 시점·리롤·보충 규칙
- Cron 동시 실행·중복 호출·배포 환경
- 보안·접근성·모바일·통합 테스트

가장 안정적인 방법은 저장소에 `AGENTS.md`, `PLANS.md`, `docs/`를 먼저 넣고, `prompts/`의 세션을 순서대로 실행하는 것이다.


## 패키지 안의 주요 파일

- `MASTER_GUIDE.md`: 기획서·기술 설계·테스트·운영·프롬프트 전체 통합본
- `ALL_CODEX_PROMPTS.md`: Codex에 입력할 프롬프트만 합친 파일
- `AGENTS.md`: 저장소 전체에서 Codex가 자동으로 따라야 할 공통 규칙
- `PLANS.md`: 장기 구현 계획 작성 형식
- `PACKAGE_REVIEW.md`: 원샷 가능 범위와 설계 검토 결과
- `docs/PRD.md`: 사이트·대회 운영 제품 기획서
- `docs/MISSION_CATALOG.md`: M001~M100 미션 정의
- `prompts/`: 단계별·원샷 프롬프트 원본

## 권장 실행 순서

1. 이 압축 파일을 새 Git 저장소 루트에 푼다.
2. Codex를 저장소 루트에서 시작한다.
3. `prompts/00_REPOSITORY_AUDIT_AND_PLAN.md`부터 순서대로 입력한다.
4. 각 세션이 끝날 때 diff와 테스트 결과를 확인한다.
5. 통과한 상태를 Git 커밋으로 남긴 뒤 다음 세션으로 이동한다.
6. 외부 키가 없는 동안에는 `MOCK_RIOT_API=true`로 개발한다.
7. 실 API 연결 전 `prompts/17_SECURITY_QA_AND_RELEASE.md`까지 완료한다.
8. 배포 후 `prompts/18_FINAL_PRODUCTION_AUDIT.md`로 최종 검토한다.

## 빠른 선택

### 화면과 흐름을 먼저 보고 싶을 때

`prompts/ONE_SHOT_VISUAL_PROTOTYPE.md`를 사용한다. 이 결과는 모든 주요 화면과 포인트 추첨 연출을 포함하지만, 실 DB·실 인증·실 Riot API가 없는 시각적 프로토타입이다.

### 실제 운영 가능한 서비스를 만들 때

`00`부터 `18`까지 순차 실행한다. 이 경로가 기본 권장안이다.

### 한 번의 긴 작업으로 전체를 시도할 때

`prompts/MASTER_FULL_BUILD_ATTEMPT.md`를 사용한다. 다만 Codex가 작업을 내부 단계로 나누도록 지시하며, 외부 자격 증명 없이 실제 Riot API나 배포가 완료되었다고 가장하지 못하게 한다.

## 세션 목록

| 번호 | 목적 |
|---|---|
| 00 | 저장소 점검, 구현 계획, 리스크 확인 |
| 01 | Next.js 기반, 품질 도구, 문서 구조 |
| 02 | Prisma/PostgreSQL 데이터 모델과 시드 |
| 03 | 디자인 시스템과 전체 정적 화면 |
| 04 | 회원가입·로그인·세션·권한 |
| 05 | Riot ID 참가 신청과 관리자 승인 |
| 06 | Riot API 클라이언트와 Mock 어댑터 |
| 07 | 경기 동기화·랭크 스냅샷·중복 방지 |
| 08 | 17~23점 정산·원장·재추첨 |
| 09 | 긴장감 있는 포인트 공개 연출 |
| 10 | MVP/ACE 표준화 평가 |
| 11 | 미션 배정·리롤·6시간 보충·경기 시작 스냅샷 |
| 12 | 미션 판정기 M001~M055 |
| 13 | 미션 판정기 M056~M100과 주간 순위 통합 |
| 14 | 대시보드·순위표·프로필·기록 |
| 15 | 관리자 사이트 13개 영역 |
| 16 | 스케줄러·새로고침·운영 관측 |
| 17 | 보안·테스트·접근성·릴리스 준비 |
| 18 | 최종 프로덕션 감사와 결함 수정 |

## 기술 스택

- Next.js App Router
- TypeScript strict
- Tailwind CSS
- shadcn/ui
- lucide-react
- Recharts
- Prisma ORM + PostgreSQL
- Credentials 기반 인증
- Argon2id 비밀번호 해시
- HttpOnly 쿠키의 서명된 JWT 세션
- Riot API: KR 플랫폼, ASIA 리전
- Vercel 배포
- Vitest, React Testing Library, Playwright
- pnpm

버전은 작업 시작 시점의 최신 안정 GA 버전을 사용하되, 실험·canary·beta 패키지는 사용하지 않고 `pnpm-lock.yaml`에 고정한다.

## 배포와 경기 동기화 전략

Vercel Hobby Cron은 잦은 호출에 적합하지 않으므로 다음 3단계를 지원한다.

1. 개발·시연: 관리자 수동 동기화 + 로그인/페이지 방문 시 제한된 기회성 동기화
2. 무료 운영: 서명된 API 엔드포인트를 GitHub Actions가 약 5분 간격으로 호출
3. 안정적 운영: Vercel Pro Cron 또는 별도 워커/큐

GitHub Actions 예약 실행은 지연될 수 있으므로 “정확한 실시간” 보장은 하지 않는다. 이 사이트의 “실시간”은 경기가 끝난 뒤 수 분 내 반영되는 준실시간을 의미한다.

## 외부 준비물

- PostgreSQL 연결 문자열
- 충분히 긴 `AUTH_SECRET`
- 충분히 긴 `CRON_SECRET`
- Riot Developer Portal에서 발급한 API 키
- 배포 도메인
- 운영 전 개인정보처리방침·이용약관·대회 규칙
- MVP/ACE용 실제 기준 데이터 CSV/JSON

Riot API 키가 없거나 만료되었을 때도 전체 사이트가 Mock 모드로 작동해야 한다.

2026-08-03 공개된 최신 LoL 커뮤니티 대회 가이드라인 기준으로, 대회 자체는 대부분 별도의 사전 대회 승인을 기다리지 않고 가이드라인에 따라 운영할 수 있으며 Riot은 Competition Visibility Form(현황 양식) 제출을 권장한다. 이는 공개 Riot API 제품의 등록·Production key 절차와 별개다. 실제 개최·배포 직전에 두 문서를 각각 다시 확인한다.

## 중요한 운영 원칙

- Riot API 키는 브라우저에 절대 전달하지 않는다.
- 모든 점수 변경은 append-only 원장에 남긴다.
- 경기 ID, 점수 원장 키, 미션 처리 키는 유일해야 한다.
- Cron은 중복 실행되어도 결과가 두 번 반영되지 않아야 한다.
- 관리자 수정도 기존 기록을 덮어쓰지 말고 조정 원장을 추가한다.
- 실제 기준 데이터가 없으면 MVP/ACE는 `DEMO_ONLY`로 명확히 표시한다.
- 유료 재추첨, 현금 환전, 베팅 기능은 구현하지 않는다.
- 17~23점은 각 값이 동일 확률인 것으로 공개한다.
- Riot 정책 검토 결과에 따라 고정 20점 모드로 즉시 전환할 수 있게 한다.
- 공식 Riot 서비스의 화면이나 브랜드를 복제하지 않는다.
- Data Dragon 또는 사용 허용된 공식 게임 데이터 자산만 사용한다.

## Codex 사용 규칙

각 프롬프트는 다음을 전제로 한다.

- Codex는 안전한 로컬 파일 읽기·수정·테스트를 별도 승인 없이 수행한다.
- 외부 배포, 외부 DB 변경, 유료 서비스 생성, 비밀값 회전, Git push는 수행하지 않는다.
- 구현 전에 현재 코드와 문서를 읽는다.
- 이미 작동하는 범위를 불필요하게 재작성하지 않는다.
- 완료 후 `lint`, `typecheck`, `test`, `build`를 실행한다.
- 실패를 숨기거나 “완료”라고 가장하지 않는다.
- 외부 키가 필요한 작업은 Mock과 명확한 연결 지점까지 구현한다.
- 최종 응답에는 변경 파일, 검증 결과, 남은 외부 의존성, 추천 커밋 메시지를 적는다.

## Windows 참고

Node.js LTS와 Git 설치 후 `corepack enable`로 pnpm을 활성화한다. PowerShell에서 스크립트 실행 정책 오류가 발생하면 관리자 전체가 아니라 현재 사용자 범위에서만 정책을 조정하거나 명령 프롬프트를 사용한다.

## 문서 우선순위

충돌이 있을 때 다음 우선순위를 적용한다.

1. 현재 사용자가 명시한 세션 프롬프트
2. `docs/DECISIONS.md`
3. `docs/PRD.md`
4. `docs/ARCHITECTURE.md`
5. `docs/DATA_MODEL.md`
6. `docs/MISSION_CATALOG.md`
7. 기존 구현

충돌을 임의로 숨기지 말고 `docs/DECISIONS.md`에 기록한다.

---

<!-- SOURCE: PACKAGE_REVIEW.md -->

# 기획·프롬프트 패키지 검토 결과

## 1. 결론

이 프로젝트는 **시각 프로토타입은 원샷 가능**, **실제 운영형은 단계별 구현이 필요**하다.

원샷 전체 구현이 불안정한 이유는 단순한 코드 양이 아니라 다음 상태가 서로 원자적으로 연결되어야 하기 때문이다.

- 같은 Riot 경기를 여러 동기화 경로가 발견할 수 있음
- 첫 포인트는 사용자 공개 전 이미 순위에 반영되어야 함
- MVP/ACE 평가가 완료된 뒤에만 재추첨 자격이 생김
- 재추첨은 기존 점수를 수정하지 않고 차이 원장을 추가해야 함
- 미션은 “현재 활성 상태”가 아니라 경기 시작 당시 상태로 평가해야 함
- 6시간 보충과 1시간 리롤이 scheduler 지연·중복 호출에도 일관되어야 함
- 실제 MVP 기준 데이터와 Riot Production Key는 코드 생성으로 대체할 수 없음

따라서 저장소 공통 지침을 `AGENTS.md`에 고정하고 세션 00~18을 순차 실행하는 안을 기본으로 채택했다.

## 2. 확정·보완한 핵심 사항

### 포인트 공개의 악용 방지

사용자가 패배 결과 공개를 미뤄 순위를 늦게 반영하는 문제를 막기 위해, 포인트는 경기 처리 시 서버에서 생성·원장 반영한다. 공개 버튼은 이미 봉인된 결과를 보여주는 동작이다.

### 공정성 검증

첫 결과의 value와 nonce로 commitment를 만들고, 공개 후 검증할 수 있게 했다. 각 17~23 값은 1/7이며, 클라이언트 난수를 사용하지 않는다.

### Riot 절차 분리와 정책 fallback

2026-08-03 공개된 최신 LoL 커뮤니티 대회 가이드라인은 대부분의 커뮤니티 이벤트에서 별도의 사전 대회 승인을 기다리지 않아도 된다고 안내하며 Competition Visibility Form(현황 양식) 제출을 권장한다. 반면 Riot API를 공개 제품에 사용하는 경우의 제품 등록·키 요건은 Developer Portal의 별도 절차다. 두 절차를 하나의 “Riot 승인”으로 뭉뚱그리지 않도록 문서를 수정했다.

확률형 점수는 현금·유료 요소가 없더라도 출시 전 최신 Riot 정책과 국내 적용 법률 검토가 필요할 수 있다. 코드 전체를 바꾸지 않고 `POINT_MODE=FIXED_20`으로 전환할 수 있게 명세했다.

### MVP/ACE 신뢰성

실제 표본 데이터가 없는 상태에서 그럴듯한 평균·표준편차를 생성하지 않는다. 개발 fixture는 `DEMO_ONLY`이며 production 보상은 기본 차단한다.

### 미션 충돌 해결

- 완료 미션: 같은 주차 재등장 금지
- 리롤 미션: 후순위로 이동, unseen 미션 소진 후에만 재후보
- 새 주차: 상태 초기화, 새 5개 지급
- 경기 중 리롤: 경기 시작 snapshot으로 판정

### 준실시간 정의

게임 중 실시간 감지가 아니라 경기 종료 후 Match-V5 데이터가 제공된 뒤 수 분 안에 반영되는 구조다. 화면은 15~30초 간격으로 갱신하고, sync는 수동/예약/worker adapter를 공유한다.

### 관리자 수정

점수 직접 덮어쓰기와 경기 hard delete를 금지했다. 조정·무효화·복구는 append-only 원장과 AuditLog로 추적한다.

## 3. 패키지 구성 검토

- 제품 PRD: 사용자, 화면, 관리자 13영역, 품질·정책·출시 조건 포함
- 아키텍처: UI/application/domain/infrastructure 경계와 sync pipeline 포함
- 데이터 모델: 인증부터 원장·미션·작업·감사까지 포함
- 미션: M001~M100 고유 코드와 evaluator 전략 포함
- 테스트: unit/integration/contract/E2E/security/accessibility/performance 포함
- Runbook: 환경 변수, API 연결, 동기화, 대사, 장애, 종료·백업 포함
- Codex 지침: AGENTS/PLANS와 00~18 단계별 prompt 포함
- 원샷 선택지: 시각 프로토타입용과 전체 장기 시도용을 분리

## 4. 의도적으로 확정하지 않은 외부 항목

다음은 Codex가 임의로 만들어서는 안 되며, 실제 작업 시 공식 문서·운영자 입력으로 확정한다.

- 작업일의 정확한 Next.js/Prisma 등 package version
- 현재 Riot Queue ID와 API DTO의 optional field 상태
- Riot API 제품 등록과 공개 운영에 맞는 key 승인
- 최신 Community Competition Guidelines 확인과 Competition Visibility Form(현황 양식) 제출 기록
- 공식 고지 문구의 최신 원문
- 개인정보처리방침·이용약관의 최종 법적 문구
- 실제 MVP/ACE 기준 데이터의 출처와 표본
- Vercel/GitHub scheduler의 실제 선택 플랜
- production DB provider, domain, backup 정책

## 5. 구현 중 중단 기준

다음 상태에서는 다음 기능으로 넘어가지 않고 현재 세션을 수정해야 한다.

- migration from empty DB 실패
- 동일 경기 재처리 시 점수 변화
- ledger와 cached score 불일치
- reveal 전 value/nonce 노출
- 동시 reroll 두 건 성공
- 미션 snapshot 경계 실패
- USER의 admin mutation 성공
- Riot/CRON secret의 client 또는 로그 노출
- DEMO_ONLY baseline의 production entitlement 발급

## 6. 권장 사용법

- 첫 시각 검토: `prompts/ONE_SHOT_VISUAL_PROTOTYPE.md`
- 실제 제작 시작: `prompts/START_HERE.md` 또는 바로 `prompts/00_REPOSITORY_AUDIT_AND_PLAN.md`
- 각 세션 후 검증 통과 상태를 commit
- 세션 17에서 출시 준비, 세션 18에서 독립 최종 감사
- 한 번에 전체 시도는 `MASTER_FULL_BUILD_ATTEMPT.md`를 사용하되 단계별 경로보다 신뢰도가 낮음을 전제로 함

---

<!-- SOURCE: AGENTS.md -->

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

---

<!-- SOURCE: PLANS.md -->

# PLANS.md — 실행 계획 운영 규칙

복잡하거나 여러 세션에 걸친 작업은 구현 전에 이 문서 아래에 실행 계획(ExecPlan)을 작성하거나 갱신한다. 계획은 구현 중 발견에 따라 살아 있는 문서로 유지한다.

## 계획 작성 원칙

- 코드베이스를 읽지 않고 추측으로 파일명을 확정하지 않는다.
- 사용자가 확인할 수 있는 결과와 acceptance criteria를 중심으로 쓴다.
- 마이그레이션, 외부 API, 데이터 정산, 보안 위험을 명시한다.
- 각 milestone은 독립적으로 검증하고 Git commit 가능한 상태로 끝낸다.
- external credential이 필요한 부분과 Mock으로 완료 가능한 부분을 분리한다.
- 예상 시간 대신 작업 순서와 중단 조건을 쓴다.
- 계획이 바뀌면 `Decision Log`와 `Progress`를 즉시 갱신한다.

## ExecPlan 템플릿

```md
# [작업명]

## 목적과 사용자 결과
완료 후 사용자가 무엇을 할 수 있고 어떤 화면/데이터로 확인하는지 설명한다.

## 범위
### 포함
- ...

### 제외
- ...

## 현재 상태
- 관련 파일과 기존 동작
- 재사용 가능한 코드
- 발견한 결함 또는 부채

## 핵심 결정과 불변식
- ...

## 단계
### Milestone 1 — ...
- 수정 대상
- 구현 내용
- 검증 방법
- 완료 조건

### Milestone 2 — ...
...

## 데이터·마이그레이션
- schema 변경
- backfill
- rollback/forward-fix
- seed/fixture

## 보안·외부 서비스
- 필요한 secret/권한
- 네트워크 실패 처리
- rate limit
- 사용자 데이터 영향

## 테스트
- unit
- integration
- E2E
- manual acceptance

## Progress
- [ ] YYYY-MM-DD — ...

## Surprises & Discoveries
- ...

## Decision Log
- YYYY-MM-DD — 결정 / 이유

## 완료 보고
- 결과
- 검증
- 남은 외부 의존성
```

## 현재 제품 마일스톤

### M0. 저장소·문서·Mock

- package manager와 품질 스크립트
- 환경 변수 schema
- 문서와 fixture
- 기본 CI

### M1. 데이터 기반

- Prisma schema와 migration
- seed
- repository/service boundaries

### M2. UI shell과 시각 프로토타입

- 공통 layout/navigation
- public/participant/admin 주요 화면
- 반응형 표와 포인트 공개 연출 mock

### M3. 인증과 참가 승인

- credentials auth
- RBAC
- Riot ID application/approval

### M4. Riot 수집

- adapter/mock
- match/rank sync
- idempotency, lease, cursor

### M5. 정산과 평가

- append-only score ledger
- draw commitment/reveal/reroll
- MVP/ACE baseline/evaluator

### M6. 미션

- 100개 registry
- assignment/refill/reroll/snapshot/progress
- weekly ranking

### M7. 운영 UI와 스케줄러

- admin 13영역
- scheduler modes
- logs, health, reconciliation, export

### M8. 출시 감사

- security, accessibility, performance
- migration and recovery dry run
- E2E acceptance
- production readiness report

---

<!-- SOURCE: docs/DECISIONS.md -->

# 확정 설계 결정

이 문서는 서로 충돌하거나 구현 전에 명확히 해야 했던 규칙을 운영 가능한 형태로 고정한다.

## D-001. 서비스 범위

- 기본 참가 규모: 약 20명
- 기본 이벤트: 1주 또는 연속된 2개 주차
- 이벤트·주차 시간대: `Asia/Seoul`
- 기본 언어: 한국어
- 경기 수 제한: 없음
- 인정 경기: 이벤트 기간 안에 시작된 `RANKED_SOLO_5x5` 경기
- 기본 Queue ID는 현재 공식 상수에서 확인해 설정하며 코드에 의미 없는 숫자를 흩뿌리지 않는다.
- 조기 종료·무효 경기 기준은 관리자가 설정할 수 있고 기본 최소 경기 시간은 10분이다.

## D-002. 메인 순위

메인 점수는 경기마다 승리 시 `+17~+23`, 패배 시 `-17~-23` 중 하나를 동일 확률로 적용한 합계다.

정렬 순서:

1. 메인 점수 내림차순
2. 순수 승패 차(`wins - losses`) 내림차순
3. 승리 수 내림차순
4. 모두 같으면 공동 순위

공동 순위는 competition ranking을 사용한다. 예: `1, 1, 3`.

## D-003. 포인트 추첨의 공정성과 공개 시점

- 결과는 클라이언트의 `Math.random()`으로 정하지 않는다.
- 서버에서 암호학적으로 안전한 균등 난수로 17~23을 생성한다.
- 경기 처리 시 첫 결과를 미리 생성하고 해시 commitment를 저장한다.
- 점수는 경기 처리 트랜잭션에서 즉시 원장에 반영한다. 사용자가 공개 화면을 늦게 열어도 순위가 왜곡되지 않는다.
- 사용자의 버튼은 “결과 생성”이 아니라 “봉인 결과 공개” 역할을 한다.
- 공개 전 API 응답에는 실제 숫자와 nonce를 포함하지 않는다.
- 공개 시 숫자와 nonce를 제공해 commitment를 검증할 수 있다.
- 각 값의 확률은 `1/7`로 공개한다.
- 기본 자동 공개 시간은 경기 반영 후 12시간이며 관리자 설정 가능하다.
- 현금·유료 재추첨·환전·베팅은 없다.
- 정책 검토에 따라 `FIXED_20` 모드로 즉시 전환할 수 있다.

## D-004. MVP/ACE 재추첨

- 한 경기의 승리 팀 최고 평가 참가자는 MVP, 패배 팀 최고 평가 참가자는 ACE다.
- 추적 중인 대회 참가자가 해당 팀의 최고 평가자일 때만 재추첨권을 받는다.
- 재추첨은 선택 사항이다.
- 재추첨을 실행하면 두 번째 결과가 무조건 최종이다. 첫 결과로 되돌릴 수 없다.
- 재추첨 전 확인 화면에서 이 규칙을 명시한다.
- 두 번째 값은 첫 값과 같을 수 있다.
- 재추첨 시 점수 원장에는 기존 행 수정이 아니라 차이값 조정 행을 추가한다.
- 기본 사용 기한은 해당 주차 종료 전까지다.
- 관리자는 기한을 변경할 수 있으나 이미 종료된 결과를 은밀히 바꾸지 못한다.

## D-005. MVP/ACE 기준 데이터

- 포지션: TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
- 티어 버킷: PLATINUM, EMERALD, DIAMOND, MASTER_PLUS
- 기준 데이터는 평균, 표준편차, 표본 수, 패치 범위, 수집일, 버전을 포함한다.
- 실제 데이터가 없는 개발 환경에서는 명시적으로 `DEMO_ONLY`인 fixture를 사용한다.
- 프로덕션에서 `DEMO_ONLY` 기준으로 보상을 지급하는 기능은 기본 차단한다.
- 기준 데이터는 관리자 CSV/JSON 업로드 후 검증·게시한다.
- 과거 경기는 당시 사용한 기준 버전을 유지한다.

## D-006. MVP/ACE 계산

공통 70%:

- 시야·오브젝트 그룹 17.5%
- 골드·CS·분당 성장 그룹 17.5%
- 가한·받은 피해 그룹 17.5%
- KDA·킬 관여 그룹 17.5%

포지션 보정 30%:

- TOP: 피해/탱킹 15%, 성장 10%, KDA 5%
- JUNGLE: 시야/오브젝트 15%, KDA 10%, 피해 5%
- MIDDLE: 피해 15%, 성장 10%, KDA 5%
- BOTTOM: 피해 15%, 성장 10%, KDA 5%
- UTILITY: 시야/오브젝트 15%, KDA 10%, 피해/보호 5%

세부 지표는 동일 그룹 안에서 평균한다. 모든 z-score는 기본 `[-3, 3]` 범위로 winsorize한다.

동점 우선순위:

1. 총 평가 점수
2. KDA·킬 관여 그룹
3. 오브젝트 관여
4. 적은 사망
5. 결정론적 participant key

## D-007. 주간 미션

- 주차 시작 시 개인별 5개 활성 미션을 지급한다.
- 같은 주차에서 완료한 미션은 다시 등장하지 않는다.
- 리롤한 미션은 후순위 보관함으로 이동한다.
- 아직 한 번도 본 적 없는 활성 가능 미션이 남아 있으면 리롤 미션은 재등장하지 않는다.
- 미확인 미션을 모두 소진한 경우에만 리롤 미션이 다시 후보가 될 수 있다.
- 새 주차가 시작되면 주차 단위 상태를 초기화한다. 이벤트 전체 무반복 옵션은 관리자 설정으로 제공한다.
- 완료로 빈 슬롯이 생기면 보충 크레딧이 있을 때 즉시 채운다.
- 보충 크레딧은 주차 시작 시각을 기준으로 6시간마다 1개, 최대 3개까지 누적된다.
- 리롤은 1시간 쿨타임이며 즉시 다음 미션으로 교체한다. 보충 크레딧을 소비하지 않는다.
- 경기 시작 시각에 활성 상태였던 미션만 해당 경기로 평가한다.
- 경기 중 새로 활성된 미션은 그 경기에 적용하지 않는다.
- 경기 중 리롤한 경우에도 경기 시작 당시 활성 미션이 그 경기 판정 대상이다.
- 한 경기에서 여러 미션을 동시에 완료할 수 있다.
- 누적형 미션은 활성된 뒤 시작된 경기만 집계한다.
- 모든 진행도는 정확한 수치로 저장하고 표시한다.

## D-008. 회원가입과 Riot 계정

- 초기 버전은 사이트 자체 `loginId + password` 회원가입을 사용한다.
- 비밀번호는 Argon2id로 해시한다.
- 사이트 로그인과 Riot 계정 연결은 별개다.
- 사용자는 Riot ID의 `gameName`과 `tagLine`을 제출한다.
- 서버가 Riot ID를 PUUID로 변환해 검증한다.
- 관리자 승인 후 Participant가 된다.
- PUUID는 참가자 고유 식별자의 기준이다.
- Riot ID 변경은 PUUID로 추적해 갱신한다.
- RSO는 승인된 Production 앱과 별도 요구사항이 생길 때 추가하는 후속 기능이다.

## D-009. 준실시간의 의미

- 이 서비스는 게임 중 행동을 실시간 감시하지 않는다.
- Match-V5 데이터가 제공된 뒤 자동 판정한다.
- 목표 반영 시간은 경기 종료 후 수 분 이내다.
- 무료 스케줄러는 지연될 수 있어 SLA를 보장하지 않는다.
- 화면 데이터는 15~30초 간격 폴링과 사용자 행동 후 재검증으로 갱신한다.
- 서버리스 WebSocket을 기본 의존성으로 도입하지 않는다.

## D-010. 동기화 배포 모드

- `MANUAL`: 관리자 또는 제한된 기회성 동기화
- `GITHUB_SCHEDULE`: 서명된 엔드포인트를 예약 워크플로가 호출
- `VERCEL_CRON`: 유료 플랜 또는 허용 주기에 맞춘 Vercel Cron
- `WORKER`: 별도 지속 실행 워커

모든 모드는 같은 idempotent sync service를 호출한다.

## D-011. UI 원칙

- 실제 대형 스포츠·전적 서비스의 정보 위계와 밀도를 참고하되 화면을 복제하지 않는다.
- 과도한 그라디언트, 유리 효과, 둥근 카드 남발, 의미 없는 큰 여백을 피한다.
- 어두운 graphite 기반, 제한적인 전광판 glow, 명확한 승패 색상, 높은 데이터 가독성을 사용한다.
- 순위표는 순위와 Riot ID 열을 고정한다.
- 가로 스크롤이 발생한 뒤에만 경계 그림자를 표시한다.
- Riot ID는 먼저 글자 크기를 줄이고, 그래도 넘치면 셀 폭을 확장한다.
- 태그라인은 항상 표시한다.
- 모바일에서는 핵심 열을 보존하고 부가 정보는 행 확장 패널로 이동한다.
- 움직임 감소 설정을 존중한다.

## D-012. 포인트 공개 연출

- 카지노·슬롯머신·현금성 이미지를 사용하지 않는다.
- 콘셉트는 “랭크 신호 해독/봉인 해제”다.
- 기본 연출 길이: 약 4.8초
- 1.5초 뒤 건너뛰기 허용
- 소리는 기본 꺼짐
- `prefers-reduced-motion`에서는 약 0.4초의 단순 공개
- 최종 숫자는 서버 결과와 항상 일치
- 애니메이션 실패가 정산 실패로 이어지지 않음
- 재접속해도 같은 결과를 다시 확인 가능

## D-013. 관리자 수정

- 직접 DB 행을 임의 수정하는 UI를 만들지 않는다.
- 점수 수정은 사유가 포함된 `ADMIN_ADJUSTMENT` 원장 행으로 처리한다.
- 경기 무효화도 원본 삭제 대신 반전 원장과 상태 변경을 사용한다.
- 모든 관리자 작업은 AuditLog에 남긴다.
- 하드 삭제는 개발 fixture 외에는 사용하지 않는다.

## D-014. 미래 기능

다음은 현재 스키마에서 확장 가능하게만 설계하고 초기 운영 범위에서는 제외한다.

- 전적검색 사이트 수준의 임의 플레이어 검색
- 팀전·경매·코인 상점·슬롯 미니게임
- 실시간 관전 데이터
- Riot Sign On
- 푸시 알림
- 다국어

## D-015. Riot 정책 절차의 분리

- Riot API를 사용하는 공개 제품의 등록·키 승인은 Riot Developer Portal 절차로 관리한다.
- 대회 자체의 개최 조건은 최신 LoL Esports Community Competition Guidelines로 관리한다.
- 2026-08-03 공개된 최신 가이드라인 기준으로 대부분의 커뮤니티 대회는 사전 대회 승인을 기다리지 않아도 되지만, Competition Visibility Form(현황 양식) 제출을 운영 기본값으로 둔다.
- 약 20명은 이 서비스의 목표 참가 규모이며 정책상 최소 참가 인원이라고 가정하지 않는다.
- 이벤트와 사이트는 Riot Games·LoL Esports의 공식 주최·승인·후원으로 오인되지 않게 한다.
- Riot Games 로고 및 공식 esports 대회 상표는 사용하지 않는다.
- 금지 스폰서 범주, 운영자 적용 제외 범주, 자산 사용 조건은 개최 직전 최신 원문으로 다시 확인한다.
- chance-based scoring은 별도 정책·법률 검토 대상이며 불확실하면 `POINT_MODE=FIXED_20`을 사용한다.

---

<!-- SOURCE: docs/PRD.md -->

# 디럭스 솔랭 제품 요구사항 명세서(PRD)

## 1. 제품 개요

디럭스 솔랭은 동아리 구성원 약 20명이 일정 기간 동안 리그 오브 레전드 솔로 랭크를 플레이하고, Riot API로 경기 결과와 미션을 자동 판정하며, 사이트에서 순위·기록·포인트 공개·주간 미션을 확인하는 대회 운영 플랫폼이다.

핵심 재미는 다음 세 요소의 결합이다.

1. 실제 솔로 랭크 경기 결과가 자동으로 대회에 반영되는 신뢰성
2. 승패마다 17~23점이 결정되는 긴장감 있는 포인트 공개
3. 개인별 주간 미션과 MVP/ACE 재추첨으로 생기는 추가 목표

사이트는 참가자가 경기 후 직접 결과를 신고하는 구조가 아니라 Riot API 데이터를 기준으로 자동 처리한다. 관리자는 참가 승인, 이벤트 기간, 미션, 기준 데이터, 동기화와 예외 조정만 관리한다.

## 2. 제품 목표

### 2.1 1차 목표

- 회원가입부터 참가 승인까지 하나의 흐름으로 처리
- 승인된 Riot ID의 솔로 랭크 경기 자동 수집
- 경기당 17~23점 랜덤 가감
- 공정하고 중복 없는 점수 원장
- 긴장감 있는 결과 공개 UI
- 메인 순위표와 개인 기록
- MVP/ACE 재추첨 자격 자동 판정
- 개인별 주간 미션 5개와 정확한 진행도
- 관리자가 운영 전 과정을 사이트에서 처리
- 모바일과 데스크톱 모두에서 높은 가독성

### 2.2 2차 목표

- 지난 주차 기록 비교
- 티어·LP 변화 추이
- 오늘의 주요 기록
- 동기화 상태와 장애 원인 가시화
- CSV 내보내기
- Riot Production Key 신청에 사용할 수 있는 완성된 사용자 흐름, 법적 고지, 시연 모드

### 2.3 현재 제외

- 공식 랭크를 대체하는 MMR/ELO 추정
- 상대 사전 분석이나 게임 중 경쟁 우위 제공
- 현금성 재화, 유료 뽑기, 베팅
- 임의 플레이어 대규모 전적검색
- 팀전, 경매, 코인 상점
- 게임 클라이언트 설치형 오버레이
- 실시간 인게임 명령 또는 조언

## 3. 성공 기준

### 기능

- 동일 경기 재수집 시 점수가 두 번 반영되지 않는다.
- 동일 Cron이 중복 호출되어도 결과가 동일하다.
- 참가자가 공개 버튼을 누르지 않아도 순위 점수는 정확하다.
- 재추첨은 최대 한 번만 가능하고 두 번째 결과로 확정된다.
- 경기 시작 시점 기준 미션 규칙이 모든 경계 사례에서 유지된다.
- 관리자 조정은 원본 삭제 없이 감사 가능한 형태로 남는다.
- Riot API 장애 시 기존 데이터와 사이트 열람은 유지된다.

### 품질

- 모바일 360px 폭에서도 핵심 기능 사용 가능
- 키보드만으로 회원가입, 신청, 결과 공개, 리롤, 관리자 주요 작업 가능
- 색상만으로 승패를 구분하지 않음
- 운영 경로의 서버 오류가 사용자에게 내부 스택이나 비밀값을 노출하지 않음
- 프로덕션 빌드, 타입 검사, 린트, 단위·통합 테스트 통과
- 주요 E2E 흐름 통과

## 4. 사용자와 권한

### 4.1 방문자

- 메인 대시보드 열람
- 전체 순위표 열람
- 공개 참가자 기록 열람
- 대회 규칙·법적 고지 열람
- 회원가입·로그인

### 4.2 일반 회원

- Riot ID 참가 신청
- 신청 상태 확인
- 계정 설정
- 아직 승인되지 않은 경기·점수 기능은 사용 불가

### 4.3 참가자

- 자신의 포인트 공개 대기 목록 확인
- 포인트 공개 연출 실행
- MVP/ACE 재추첨 실행
- 개인 미션과 진행도 확인
- 개인 경기·점수 원장 확인
- 공개 프로필과 동일한 데이터 확인
- Riot ID 변경 감지 및 갱신 요청

### 4.4 관리자

- 사용자·신청·참가자·이벤트·주차 관리
- Riot ID 검증과 승인/거절
- 동기화 실행·재처리·오류 확인
- 미션 정의와 주간 배정 상태 관리
- MVP 기준 데이터 업로드·검증·게시
- 점수 조정·경기 무효화
- 공지·규칙·법적 고지 관리
- 시스템 상태·감사 로그·내보내기

## 5. 핵심 사용자 흐름

## 5.1 가입과 참가 신청

1. 사용자가 `loginId`, 비밀번호, 실명을 입력해 가입한다.
2. 서버는 입력을 검증하고 Argon2id 해시만 저장한다.
3. 로그인 후 사용자는 `게임 이름`과 `태그라인`을 분리 입력한다.
4. 서버는 ASIA Account-V1로 Riot ID를 조회해 PUUID를 얻는다.
5. 서버는 KR Summoner-V4와 League-V4로 계정·솔로 랭크 정보를 확인한다.
6. 검증 결과를 사용자에게 보여주고 신청을 제출한다.
7. 관리자가 실명, Riot ID, 현재 티어, 중복 PUUID 여부를 확인한다.
8. 승인 시 Participant와 현재 시즌 참가 레코드가 생성된다.
9. 승인 시점이 이벤트 시작 전이면 시작 스냅샷 대기 상태가 된다.
10. 이벤트 진행 중 승인하려면 관리자 경고와 명시적 예외 사유가 필요하다.

### 실패 처리

- Riot ID 미존재: 입력 오류 표시
- API 키 만료/429/5xx: 신청 내용을 잃지 않고 재시도 안내
- 이미 등록된 PUUID: 중복 신청 차단
- Riot ID 변경: PUUID가 같으면 기존 참가자 갱신 후보
- Mock 모드: fixture 계정만 검증 가능

## 5.2 이벤트 시작

1. 관리자가 시즌 이름, 시작·종료, 주차 수를 설정한다.
2. 시작 전 참가자별 현재 솔로 랭크 스냅샷을 수집한다.
3. 각 주차에 5개 미션을 배정한다.
4. 보충 크레딧 타이머를 주차 시작 시각에 맞춘다.
5. 참가자 동기화 cursor를 시작 시각 직전으로 설정한다.
6. 시스템은 시작 전 경기를 점수에 포함하지 않는다.

## 5.3 경기 자동 수집

1. 스케줄러 또는 관리자가 sync service를 호출한다.
2. sync service가 활성 참가자를 작은 배치로 선택한다.
3. ASIA Match-V5에서 PUUID의 새 match ID 목록을 가져온다.
4. 이벤트 시간과 queue 조건에 맞는 ID만 선택한다.
5. 아직 저장되지 않은 경기에 대해 summary를 가져온다.
6. timeline이 필요한 미션이 존재할 때만 timeline을 가져온다.
7. 외부 응답을 정규화하고 DB에 upsert한다.
8. 대회 참가자의 ParticipantMatch를 생성한다.
9. 포인트 첫 결과와 commitment를 생성하고 원장에 반영한다.
10. MVP/ACE 평가와 재추첨 자격을 기록한다.
11. 경기 시작 시점의 미션을 평가한다.
12. 랭크·LP 스냅샷을 필요 주기에 따라 갱신한다.
13. SyncRun에 성공·스킵·오류 건수를 남긴다.

### 인정 경기 기본 조건

- 주차의 `[startAt, endAt)` 안에 게임이 시작됨
- 승인된 Participant의 PUUID가 match에 존재
- 솔로/듀오 랭크 queue
- Summoner's Rift
- 최소 경기 시간 이상
- 관리자가 무효화하지 않음
- Riot match ID가 중복 처리되지 않음

## 5.4 포인트 공개

1. 경기 처리 직후 점수는 이미 원장에 반영된다.
2. 참가자 화면에는 봉인된 결과 카드가 표시된다.
3. 카드에는 승패, 챔피언, 경기 시각, commitment, 재추첨 가능 여부만 표시한다.
4. 사용자가 `결과 공개`를 누른다.
5. 서버가 접근 권한과 상태를 검증하고 공개 시각을 기록한다.
6. 클라이언트가 약 4.8초의 봉인 해제 연출을 실행한다.
7. 최종 17~23 숫자와 부호, 해당 경기 뒤 누적 점수를 표시한다.
8. 클라이언트는 value+nonce로 commitment를 검증한다.
9. 애니메이션 중 새로고침해도 서버 상태를 다시 읽어 동일 결과를 표시한다.
10. 자동 공개 시간이 지나면 연출 없이 결과가 확인 가능하다.

## 5.5 MVP/ACE 재추첨

1. 재추첨 가능 카드에 `재추첨권 1회` 배지를 표시한다.
2. 사용자가 규칙을 읽고 확인한다.
3. 서버는 자격, 미사용 상태, 주차 종료 여부를 트랜잭션 안에서 다시 검사한다.
4. 두 번째 봉인 값을 최종값으로 채택한다.
5. 원장에 `secondSignedValue - firstSignedValue` 조정 행을 추가한다.
6. `rerollUsedAt`을 기록한다.
7. 재추첨 전용 연출로 두 번째 결과를 공개한다.
8. 이후 버튼은 비활성화되고 첫 결과로 복구할 수 없다.

## 5.6 주간 미션

1. 주차 시작 시 5개 활성 미션을 받는다.
2. 미션은 단일 경기형과 누적형이 섞인다.
3. 경기 수집 시 경기 시작 시점에 활성인 assignment를 조회한다.
4. 모든 조건을 평가해 진행 이벤트를 생성한다.
5. 한 경기에서 여러 미션을 동시에 완료할 수 있다.
6. 완료된 미션 점수는 주간 미션 원장에 반영한다.
7. 빈 슬롯은 보충 크레딧이 있으면 즉시 채운다.
8. 크레딧이 없으면 다음 6시간 tick에 배정한다.
9. 참가자는 1시간마다 활성 미션 1개를 리롤할 수 있다.
10. 리롤 대상은 후순위 보관함으로 이동하고 새 미션은 즉시 배정된다.
11. 진행 UI는 `37/100`처럼 정확 수치를 표시한다.
12. 여러 미확인 경기가 한 번에 처리되면 알림은 합산하되 원장과 세부 기록은 경기별로 유지한다.

## 6. 화면 구조

## 6.1 공통 내비게이션

데스크톱:

- 로고/서비스명
- 홈
- 순위표
- 경기 기록
- 주간 미션
- 지난 주차
- 대회 규칙
- 로그인 상태 메뉴
- 관리자일 때 관리자 바로가기

모바일:

- 상단 최소 헤더
- 하단 고정 내비게이션: 홈, 순위, 미션, 기록, 내 정보
- 관리자는 내 정보 안에서 관리자 진입
- 중요 배지: 공개 대기 수, 리롤 가능 수

## 6.2 메인 `/`

첫 화면의 스크롤 전 필수 영역:

- 이벤트 이름과 상태
- 종료 카운트다운
- 현재 TOP 5
- 전체 순위표 바로가기

TOP 5 표시 항목:

- 순위
- Riot ID + 항상 표시되는 태그라인
- 실명
- 메인 점수
- 승/패와 승패 차
- 현재 티어·LP
- 어제 대비 순위 변화
- 시작 대비 LP 변화
- 최근 연승·연패
- 대회 기간 승률
- 최근 5경기 요약
- 상세보기

추가 섹션:

- 로그인 참가자의 공개 대기 포인트
- 오늘의 주요 기록
- 최근 경기 결과
- 주간 미션 상위권
- 공지
- 동기화 상태

오늘의 주요 기록:

- 오늘 가장 공식 LP가 많이 오른 참가자
- 오늘 최다 연승
- 오늘 최다 게임
- 오늘 데이터가 없으면 최근 주요 기록이라는 라벨과 함께 최근 기록 표시

최근 경기 카드/행:

- 참가자 Riot ID
- 승리·패배
- 챔피언
- 경기 종료 시각
- 경기 시간
- K/D/A
- 포인트 변화 또는 아직 봉인 상태
- 연승·연패
- 참가자 상세
- 전체 경기 기록

## 6.3 전체 순위 `/leaderboard`

열:

- 순위
- Riot ID + 태그라인
- 실명
- 메인 점수
- 승
- 패
- 승패 차
- 승률
- 경기 수
- 최근 흐름
- 현재 티어·LP
- 시작 대비 LP
- 미공개 결과 수
- 상세

동작:

- 순위와 Riot ID 열 sticky
- 스크롤되지 않았을 때 불필요한 그림자 없음
- 수평 스크롤이 시작되면 고정 영역 경계선과 그림자 표시
- 긴 Riot ID는 단계적으로 축소 후 셀 최소 너비 확장
- 모바일 핵심 열: 순위, Riot ID, 점수, 승패 차
- 행 탭/클릭으로 나머지 정보 확장
- 정렬 기준 설명과 갱신 시각 표시
- 동점은 공동 순위

## 6.4 주간 미션 순위 `/missions`

상단:

- 현재 주차
- 다음 보충까지 시간
- 내 보충 크레딧
- 내 리롤 쿨타임
- 내 미션 점수와 순위

개인 미션 카드:

- 제목
- 조건
- 난이도
- 점수
- 정확 진행도
- 활성 시각
- 평가 가능한 경기 범위
- 완료 상태
- 리롤 버튼
- 데이터 출처 설명

전체 주간 순위:

- 공동 순위
- Riot ID + 실명
- 미션 점수
- 완료 수
- 진행 중 수
- 최근 완료
- 지난 주 대비

## 6.5 참가자 상세 `/participants/[id]`

- Riot ID, 실명, 프로필 아이콘
- 현재 티어·LP
- 시작 티어·LP
- 메인 점수와 순위
- 승/패/승률/승패 차
- 현재 연승·연패
- 점수 변화 그래프
- 공식 티어·LP 변화 그래프
- 최근 경기
- 챔피언 사용 통계
- 포지션 통계
- MVP/ACE 횟수
- 미션 완료 기록
- 점수 원장 요약
- 공개 가능한 정보만 제공

## 6.6 내 정보 `/me`

- 신청/승인 상태
- 공개 대기 결과
- 재추첨 가능 결과
- 활성 미션
- 다음 보충·리롤 시간
- 내 최근 경기
- Riot ID 갱신
- 비밀번호 변경
- 로그아웃

## 6.7 경기 기록 `/matches`

- 기간, 참가자, 승패, 챔피언, 포지션, 포인트 범위 필터
- 최신순 기본
- 경기 상세 drawer
- Riot match ID
- 점수 결과와 commitment 검증
- MVP/ACE 세부 점수
- 미션 진척
- 무효 처리 여부
- 원본 API 전체 JSON은 관리자만 접근

## 6.8 지난 주차 `/history`

- 주차 선택
- 해당 주 최종 메인 순위
- 미션 순위
- 참가자별 변화
- 주요 기록
- 종료 당시 규칙·기준 버전
- 현재 데이터로 재계산하지 않고 당시 snapshot 사용

## 6.9 규칙 `/rules`

- 참가 자격
- 인정 경기 기준
- 17~23점 동일 확률
- 재추첨 규칙
- 순위 동점 규칙
- 미션 규칙
- 조기 종료/무효 경기
- 관리자 조정 정책
- 개인정보와 Riot 데이터 사용
- 비공식 서비스 고지
- 문의 경로
- 규칙 버전과 시행일

## 6.10 인증

`/signup`

- loginId
- 실명
- 비밀번호
- 비밀번호 확인
- 이용약관·개인정보 동의

`/login`

- loginId
- 비밀번호
- 일반적인 실패 메시지
- 과도한 시도 제한

`/apply`

- gameName
- tagLine
- 입력 예시
- 검증 미리보기
- 제출

## 7. 관리자 정보 구조

관리자 사이드바는 13개 영역으로 구성한다.

1. 대시보드
2. 사용자
3. 참가 신청
4. 참가자
5. 시즌·주차
6. 점수 규칙
7. 경기·동기화
8. 포인트 추첨
9. 미션
10. MVP/ACE 기준
11. 공지·규칙·법적 문서
12. 감사 로그·내보내기
13. 시스템·운영 상태

### 7.1 관리자 대시보드

- 활성 시즌
- 승인 참가자 수
- 최근 sync 성공/실패
- 처리 대기 경기
- API 429/5xx
- 공개 대기 수
- 미션 처리 오류
- 기준 데이터 상태
- 최근 관리자 작업

### 7.2 사용자

- 역할·상태
- 로그인 ID
- 실명
- 가입 시각
- 잠금/해제
- 비밀번호 초기화 토큰 발급
- 하드 삭제 금지

### 7.3 신청

- PENDING/APPROVED/REJECTED
- Riot 검증 재시도
- 중복 PUUID 경고
- 승인·거절 사유
- 일괄 승인 금지 또는 강한 확인

### 7.4 참가자

- 활성 여부
- Riot ID/PUUID
- 주 포지션·부 포지션
- 시작 스냅샷
- 현재 상태
- 동기화 cursor
- 강제 재동기화
- 이벤트 중 제외/복귀는 감사 로그 필수

### 7.5 시즌·주차

- 시간대 표시
- draft/scheduled/active/finalizing/completed
- 시작 전 검증 체크리스트
- 주차 생성
- 시작·종료 잠금
- 완료 snapshot 생성
- 종료 후 규칙 변경 경고

### 7.6 점수 규칙

- RANDOM_17_23 / FIXED_20
- 각 값 확률 표
- 최소 경기 시간
- 인정 queue
- 자동 공개 시간
- 재추첨 만료
- 변경은 다음 주차부터 기본 적용
- 현재 주차 변경은 명시적 migration과 감사 로그

### 7.7 경기·동기화

- 수동 sync
- participant 단위 sync
- match ID 재처리
- SyncRun 로그
- 429 Retry-After
- raw payload 조회
- 무효화/복구
- 외부 요청 재시도
- cursor 되감기

### 7.8 포인트 추첨

- 공개/미공개
- commitment
- 첫 값·두 번째 값은 권한이 있는 관리자에게만 표시
- 사용자 공개 전 숫자 조회는 별도 감사 로그
- 재추첨 자격
- 원장 연결
- 불일치 검증

### 7.9 미션

- 100개 정의
- 활성/비활성
- 점수·난이도
- evaluator config
- summary/timeline 요구
- 주차 배정 현황
- 사용자별 강제 교체는 사유 필수
- evaluator dry-run

### 7.10 MVP/ACE 기준

- 버전 목록
- CSV/JSON 업로드
- 스키마 검증
- 표본 수 경고
- mean/std 유효성
- DEMO_ONLY 차단
- 게시·폐기
- 평가 재현
- 과거 평가 버전 고정

### 7.11 콘텐츠·법적 문서

- 공지
- 규칙
- 개인정보처리방침
- 이용약관
- Riot 비공식 고지
- 게시 버전과 시행일

### 7.12 감사·내보내기

- actor, action, target, before/after, reason, timestamp
- 필터
- CSV export
- 민감 필드 마스킹
- 원장 export
- 주차 snapshot export

### 7.13 시스템

- 환경 상태는 값 자체가 아닌 설정 여부만 표시
- DB 연결
- Riot API 상태
- 최근 Data Dragon 버전
- scheduler mode
- feature flags
- queue backlog
- maintenance mode
- 진단 실행

## 8. 데이터와 계산 규칙

### 8.1 시간

- DB에는 UTC 저장
- UI에는 Asia/Seoul 표시
- 경기 인정은 `gameStartTimestamp` 기준
- 종료 시각과 경계는 반개구간 `[startAt, endAt)`
- 브라우저 시간은 권위 있는 기준으로 사용하지 않음

### 8.2 Riot ID

- 화면에는 `gameName#tagLine`
- tagLine 항상 표시
- 비교용 정규화 값은 별도 저장하되 원문 보존
- 신원 기준은 PUUID
- deprecated summoner name 검색에 의존하지 않음

### 8.3 공식 랭크

- League-V4의 `RANKED_SOLO_5x5`만 사용
- 티어와 division, LP를 원형 보존
- 그래프용 ordinal은 표시 편의용이며 MMR/ELO라고 부르지 않음
- 스냅샷 시각과 데이터 소스를 표시

### 8.4 점수 원장

원장 유형:

- MATCH_INITIAL
- MATCH_REROLL_ADJUSTMENT
- ADMIN_ADJUSTMENT
- MATCH_INVALIDATION
- MATCH_REINSTATEMENT
- MIGRATION_ADJUSTMENT

각 행:

- participantWeek
- signed amount
- source entity
- idempotency key
- reason
- actor
- metadata
- createdAt

현재 점수는 원장 합계가 권위이며 캐시는 언제든 재구축 가능해야 한다.

### 8.5 미션 점수

메인 점수와 완전히 분리한다.

- MissionProgressEvent: 진행도 변경
- MissionCompletionLedger: 완료 점수
- 주간 미션 순위는 completion ledger 합계
- 관리자 수정은 별도 adjustment

## 9. MVP/ACE 표시

참가자에게 보여줄 내용:

- MVP 또는 ACE 여부
- 총 표준화 점수
- 4개 지표군 점수
- 해당 포지션 가중치
- 사용한 기준 버전과 패치 범위
- 과도한 정밀도를 피한 소수점
- “Riot 공식 MVP가 아니라 대회 내부 계산” 고지

관리자에게 추가 표시:

- 원시 지표
- mean/std
- z-score
- winsorize 전후
- 누락 필드 처리
- 동점 처리 경로

## 10. UI 디자인 요구

### 10.1 방향

- 전문 스포츠 기록 보드와 대형 게임 통계 서비스 수준의 정보 위계
- 한 화면에서 핵심 수치가 빠르게 비교됨
- 장식보다 데이터 읽기 우선
- 디럭스 솔랭만의 제한적인 전광판 신호 표현
- 특정 서비스의 로고, 헤더, 카드, 색 조합을 그대로 복사하지 않음

### 10.2 디자인 토큰 기본안

- 배경: 매우 어두운 graphite
- 1차 표면: 짙은 blue-gray
- 2차 표면: 약간 밝은 slate
- 기본 텍스트: near-white
- 보조 텍스트: cool gray
- 강조: amber-gold
- 보조 강조: electric mint
- 승리: 청록 계열 + `승`
- 패배: coral-red 계열 + `패`
- 경고: amber
- 선: 저대비 slate

실제 값은 CSS theme variable로 중앙 관리한다. 색상 대비는 WCAG AA를 만족한다.

### 10.3 금지 패턴

- 모든 카드에 과도한 border radius
- 의미 없는 glassmorphism
- 읽기 어려운 neon bloom
- AI 생성 랜딩페이지처럼 큰 문구와 빈 공간만 있는 구성
- 전체 화면의 무분별한 gradient
- hover가 없으면 기능을 알 수 없는 UI
- 모바일에서 데스크톱 테이블을 단순 축소
- 승패를 색으로만 표현
- 숫자를 움직이는 동안 실제 결과를 바꾸는 로직

## 11. 오류·빈 상태·로딩

각 화면은 다음 상태를 별도로 설계한다.

- 초기 로딩
- 부분 데이터 로딩
- 데이터 없음
- 이벤트 시작 전
- 이벤트 종료
- 신청 대기
- Riot API 일시 오류
- API 키 만료
- rate limit
- 동기화 지연
- 기준 데이터 없음
- 미션 evaluator 비활성
- 권한 없음
- maintenance

Skeleton은 실제 레이아웃과 유사하게 만들고 무한 spinner만 사용하지 않는다.

## 12. 보안 요구

- 비밀번호 평문·복호화 가능 형태 저장 금지
- Argon2id 파라미터는 중앙 설정과 테스트
- JWT는 HttpOnly, Secure, SameSite=Lax 쿠키
- 세션 `jti`를 DB allowlist/denylist로 관리
- 권한 검사는 UI가 아니라 서버 함수와 route handler에서 수행
- 상태 변경 요청에 Origin/CSRF 방어
- 로그인·신청·공개·재추첨·관리자 API rate limit
- Zod 등으로 모든 외부 입력 검증
- ORM parameterization
- 민감 정보 로그 마스킹
- Riot API key 서버 전용
- raw API payload 관리자 전용
- 사용자에게 내부 오류·스택 노출 금지
- 비밀값 없는 `.env.example`
- 보안 헤더
- 의존성 감사
- 관리자 변경 이유 필수
- 감사 로그는 일반 관리자도 임의 삭제 불가

## 13. 성능 요구

- 참가자 20명, 경기 수 수천 건까지 원활
- 메인 페이지는 집계 테이블/효율적 쿼리 사용
- N+1 쿼리 금지
- 큰 raw JSON은 일반 조회와 분리
- 순위표는 서버 렌더링 후 15~30초 갱신
- 차트 데이터 downsample 가능
- 이미지 크기 명시
- Data Dragon 버전 캐시
- 외부 API fetch timeout
- sync batch와 cursor
- DB index는 실제 쿼리 기준으로 생성

## 14. 접근성

- semantic heading과 landmark
- 테이블 caption/column header
- sticky 영역 screen reader 순서 유지
- dialog focus trap
- form label과 오류 연결
- 키보드 조작
- visible focus
- 최소 터치 영역
- `prefers-reduced-motion`
- 숫자 공개 시 `aria-live`를 남발하지 않고 최종 결과만 알림
- 그래프의 텍스트 요약
- 색각 이상에서도 승패 식별

## 15. 분석과 운영 지표

개인정보를 과도하게 수집하지 않는 범위에서:

- 가입 완료율
- 신청 제출/승인율
- 경기 동기화 성공률
- 평균 반영 지연
- 429/5xx 비율
- 포인트 공개율
- 재추첨 사용률
- 미션 완료율
- 화면 오류율
- 관리자 조정 횟수
- commitment 검증 실패 0건

## 16. 법적·정책 요구

- 사이트와 대회가 Riot Games 또는 LoL Esports의 공식 서비스·공식 행사·후원 행사 아님을 명시
- Riot이 요구하는 비공식 서비스 고지를 눈에 잘 띄는 위치에 게시
- Riot API 제품 등록과 커뮤니티 대회 운영 가이드라인을 별도 절차로 관리
- 제품과 사용자 흐름을 Riot Developer Portal에 등록·갱신하고 공개 운영에 맞는 키를 사용
- 최신 Community Competition Guidelines의 적용 대상·제외 조직·브랜딩·자산 사용·금지 스폰서 규칙을 확인
- Riot이 권장하는 Competition Visibility Form(현황 양식) 제출 여부와 증빙을 운영 기록에 보관
- Riot Games 로고와 Worlds, MSI, LCK 등 공식 esports 대회 상표로 공식성을 암시하지 않음
- API 키를 클라이언트 코드에 포함하지 않음
- 허용된 정적 게임 자산만 원형을 유지해 필요한 범위에서 사용
- 공식 랭크를 대체하는 랭킹이라고 표현하지 않음
- 포인트 랜덤 규칙을 숨기지 않음
- 유료 재추첨·베팅·현금 환전을 구현하지 않음
- chance-based scoring은 출시 전 최신 정책과 국내 적용 법률을 다시 검토하고, 불확실하면 FIXED_20 fallback 사용
- 개인정보 수집 항목, 목적, 보유 기간, 삭제 문의 명시
- 운영 직전 최신 Riot 정책을 다시 확인하고 확인 날짜·결론을 기록

## 17. 출시 단계

### Stage 0 — 문서·Mock

- 전체 사용자 흐름
- Mock Riot 데이터
- 정적 화면
- 공개 연출
- Riot 키 없이 시연 가능

### Stage 1 — 내부 알파

- DB
- 인증
- 참가 승인
- 수동 sync
- 점수·원장
- 기본 미션
- 관리자
- 테스트 fixture

### Stage 2 — 동아리 비공개 운영

- 실제 Riot API
- 예약 sync
- 기준 데이터
- 약관·개인정보
- 모니터링
- 백업
- 운영 리허설

### Stage 3 — 이벤트 본 운영

- 참가자 잠금
- 시작 스냅샷
- 규칙 버전 잠금
- 장애 대응 담당
- 일일 export
- 종료 snapshot

### Stage 4 — 종료 후

- 주차/시즌 확정
- 공개 기록 보존
- API 키·불필요 데이터 점검
- 회고
- 다음 시즌 migration

## 18. 최종 인수 조건

다음 조건을 모두 만족해야 “완성”으로 본다.

- 새 환경에서 문서대로 설치 가능
- Mock 모드 전체 E2E 통과
- 실제 API는 키만 넣으면 어댑터 전환 가능
- DB migration과 seed 성공
- 회원가입·로그인·로그아웃·권한 차단 성공
- 신청·검증·승인 성공
- 동일 match 재처리 시 원장 변화 없음
- 17~23 범위와 부호 테스트
- commitment 검증 성공
- 재추첨 동시 요청 중 한 건만 성공
- 미션 경기 시작 시점 경계 테스트
- 보충 크레딧 최대 3
- 리롤 1시간 쿨타임
- MVP 기준 버전 재현
- 순위 동점 `1,1,3`
- 관리자 조정 감사 가능
- 모바일 핵심 흐름 성공
- reduced motion 성공
- lint/typecheck/test/build 통과
- `.env.example`, 운영 가이드, 백업/복구 가이드 존재
- 외부 비밀값이나 demo-only 기준을 프로덕션으로 오인하지 않음

---

<!-- SOURCE: docs/ARCHITECTURE.md -->

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
  resolveRiotId(gameName: string, tagLine: string): Promise<RiotAccount>;
  getSummonerByPuuid(puuid: string): Promise<RiotSummoner>;
  getSoloQueueEntry(summonerId: string): Promise<SoloQueueEntry | null>;
  listMatchIds(input: MatchListInput): Promise<string[]>;
  getMatch(matchId: string): Promise<NormalizedMatch>;
  getTimeline(matchId: string): Promise<NormalizedTimeline>;
  getStaticDataVersion(): Promise<string>;
}
```

### 라우팅

- Account-V1, Match-V5: ASIA regional routing
- Summoner-V4, League-V4: KR platform routing
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

`MockRiotClient`

- 동일 타입과 오류 모드
- fixture 기반
- 성공, 404, 403/키 만료, 429, 5xx, malformed data
- E2E에서 결정론적

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

원본 payload는 필요할 때 JSONB로 별도 보관하며 일반 쿼리에서 읽지 않는다.

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
- `ParticipantMatch(participantId, matchId)`
- `PointDraw.participantMatchId`
- `ScoreLedger.idempotencyKey`
- `MissionProgressEvent(assignmentId, participantMatchId)`
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
commitment = SHA-256(drawId + ":" + value + ":" + nonce)
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

### 진행 이벤트

- assignment + participantMatch 유일
- before, delta, after
- 완료 경계 통과 여부
- evaluator version
- source facts
- 재실행 시 동일 결과

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
8. immutable WeekSnapshot 생성
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
RIOT_API_KEY=
APP_URL=http://localhost:3000
APP_TIME_ZONE=Asia/Seoul
RIOT_PLATFORM_REGION=KR
RIOT_REGIONAL_ROUTE=ASIA
MOCK_RIOT_API=true
SYNC_MODE=MANUAL
SYNC_BATCH_SIZE=5
SYNC_OVERLAP_MINUTES=30
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

---

<!-- SOURCE: docs/DATA_MODEL.md -->

# 데이터 모델 명세

이 문서는 Prisma 스키마 구현의 기준이다. 실제 필드명은 일관성을 위해 영어 camelCase를 사용한다. 모든 시간은 DB에 UTC로 저장한다.

## 1. 공통 원칙

- 기본 ID: UUID 또는 CUID2 중 하나를 프로젝트 전체에서 통일
- 외부 Riot match ID, PUUID, summoner ID는 별도 unique/key 필드
- 금액이 아닌 점수는 정수
- 상태는 Prisma enum
- 외부 원본은 JSONB로 보관 가능하나 핵심 조회 필드는 정규화
- 관리자 삭제 대신 상태 전환과 감사 로그
- mutable cache와 append-only 원장을 구분
- 모든 idempotent mutation에는 고유 key
- 개인정보와 운영 원본의 접근 범위 분리

## 2. 인증·사용자

## User

| 필드 | 타입 | 규칙 |
|---|---|---|
| id | ID | PK |
| loginId | String | unique, case-normalized |
| loginIdNormalized | String | unique |
| realName | String | 참가 표시에 사용 |
| passwordHash | String | Argon2id |
| role | UserRole | USER, ADMIN |
| status | UserStatus | ACTIVE, LOCKED, DISABLED |
| sessionVersion | Int | 권한/비밀번호 변경 시 증가 |
| termsAcceptedAt | DateTime? | |
| privacyAcceptedAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| lastLoginAt | DateTime? | |

관계:

- AuthSession[]
- ParticipationApplication[]
- Participant?
- AuditLog actor

## AuthSession

| 필드 | 타입 | 규칙 |
|---|---|---|
| id | ID | PK |
| userId | ID | FK |
| jtiHash | String | unique, 원문 jti 저장 금지 |
| sessionVersion | Int | 발급 당시 |
| expiresAt | DateTime | index |
| revokedAt | DateTime? | |
| revokeReason | String? | |
| lastSeenAt | DateTime? | |
| createdAt | DateTime | |

선택적 개인정보인 IP와 user-agent는 운영 필요성을 검토한 뒤 해시/축약 형태로만 저장한다.

## LoginAttempt

분산 rate limiter를 DB로 구현할 경우 사용한다.

- keyHash
- windowStart
- count
- blockedUntil
- updatedAt

향후 Redis로 교체 가능하게 인터페이스로 감싼다.

## 3. 참가 신청·참가자

## ParticipationApplication

| 필드 | 타입 | 규칙 |
|---|---|---|
| id | ID | PK |
| userId | ID | FK |
| gameName | String | 원문 |
| tagLine | String | 원문 |
| riotIdNormalized | String | index |
| puuid | String? | 검증 성공 시 |
| summonerId | String? | |
| profileIconId | Int? | |
| soloTier | String? | |
| soloRank | String? | |
| soloLeaguePoints | Int? | |
| status | ApplicationStatus | DRAFT, PENDING, APPROVED, REJECTED, WITHDRAWN |
| verificationStatus | VerificationStatus | |
| verificationErrorCode | String? | |
| submittedAt | DateTime? | |
| reviewedAt | DateTime? | |
| reviewedById | ID? | User FK |
| reviewReason | String? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

규칙:

- 사용자당 활성 PENDING 신청 최대 1
- 승인된 PUUID는 Participant에서 unique
- 승인 transaction에서 Participant 생성과 status 변경을 함께 수행

## Participant

| 필드 | 타입 | 규칙 |
|---|---|---|
| id | ID | PK |
| userId | ID | unique FK |
| puuid | String | unique |
| summonerId | String | unique 가능 |
| gameName | String | 최신 |
| tagLine | String | 최신 |
| profileIconId | Int? | |
| primaryPosition | Position? | |
| secondaryPosition | Position? | |
| status | ParticipantStatus | ACTIVE, PAUSED, REMOVED |
| approvedAt | DateTime | |
| approvedById | ID | |
| lastIdentitySyncAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

## ParticipantIdentityHistory

- participantId
- gameName
- tagLine
- validFrom
- validTo
- source
- unique(participantId, validFrom)

Riot ID 변경 이력을 보존한다.

## 4. 시즌·주차

## Season

| 필드 | 타입 |
|---|---|
| id | ID |
| name | String |
| slug | String unique |
| description | String? |
| status | SeasonStatus |
| timezone | String default Asia/Seoul |
| startAt | DateTime |
| endAt | DateTime |
| scoringMode | ScoringMode |
| minGameDurationSeconds | Int |
| autoRevealHours | Int |
| rulesVersion | String |
| config | Json |
| createdById | ID |
| createdAt | DateTime |
| updatedAt | DateTime |

상태:

- DRAFT
- SCHEDULED
- ACTIVE
- FINALIZING
- COMPLETED
- ARCHIVED

## Week

| 필드 | 타입 |
|---|---|
| id | ID |
| seasonId | ID |
| number | Int |
| name | String |
| status | WeekStatus |
| startAt | DateTime |
| endAt | DateTime |
| baselineVersionId | ID? |
| missionCatalogVersion | String |
| rulesSnapshot | Json |
| finalizedAt | DateTime? |
| createdAt | DateTime |
| updatedAt | DateTime |

unique(seasonId, number)

## SeasonParticipant

참가자가 시즌에 포함되는 관계.

- id
- seasonId
- participantId
- status
- joinedAt
- leftAt
- exceptionReason
- startingRankSnapshotId?
- unique(seasonId, participantId)

## ParticipantWeek

주차별 집계와 캐시.

| 필드 | 타입 |
|---|---|
| id | ID |
| weekId | ID |
| participantId | ID |
| mainScoreCached | Int default 0 |
| missionScoreCached | Int default 0 |
| wins | Int default 0 |
| losses | Int default 0 |
| currentStreakType | StreakType? |
| currentStreakCount | Int default 0 |
| bestWinStreak | Int default 0 |
| mvpCount | Int default 0 |
| aceCount | Int default 0 |
| rankCached | Int? |
| missionRankCached | Int? |
| lastProcessedMatchAt | DateTime? |
| createdAt | DateTime |
| updatedAt | DateTime |

unique(weekId, participantId)

권위 있는 점수는 원장 합계다. cache reconciliation command가 있어야 한다.

## WeekSnapshot

- id
- weekId unique
- generatedAt
- rulesSnapshot
- standings Json
- missionStandings Json
- highlights Json
- checksum
- generatedById?
- immutable

## 5. 공식 랭크 스냅샷

## RankSnapshot

| 필드 | 타입 |
|---|---|
| id | ID |
| participantId | ID |
| seasonId | ID? |
| weekId | ID? |
| capturedAt | DateTime |
| queueType | String |
| tier | String? |
| rank | String? |
| leaguePoints | Int? |
| wins | Int? |
| losses | Int? |
| isUnranked | Boolean |
| displayOrdinal | Int? |
| source | SnapshotSource |
| raw | Json? |

index(participantId, capturedAt)
index(weekId, capturedAt)

`displayOrdinal`은 그래프 표시용이며 공식 MMR로 표현하지 않는다.

## DailyStandingSnapshot

- weekId
- participantId
- localDate
- mainScore
- rank
- wins
- losses
- tier/rank/lp
- unique(weekId, participantId, localDate)

어제 대비 순위와 오늘 기록 계산에 사용한다.

## 6. 경기

## Match

| 필드 | 타입 |
|---|---|
| id | ID |
| riotMatchId | String unique |
| regionalRoute | String |
| queueId | Int |
| mapId | Int |
| gameMode | String |
| gameType | String |
| gameVersion | String |
| gameStartAt | DateTime |
| gameEndAt | DateTime |
| durationSeconds | Int |
| earlySurrender | Boolean |
| status | MatchStatus |
| invalidReason | String? |
| rawSummary | Json? |
| rawTimeline | Json? |
| timelineFetchedAt | DateTime? |
| ingestedAt | DateTime |
| processedAt | DateTime? |
| createdAt | DateTime |
| updatedAt | DateTime |

status:

- INGESTED
- PROCESSING
- PROCESSED
- INVALID
- ERROR

indexes:

- gameStartAt
- queueId, gameStartAt
- status, ingestedAt

## MatchTeam

- id
- matchId
- teamId
- win
- championKills
- towerKills
- inhibitorKills
- dragonKills
- baronKills
- heraldKills
- objectives Json
- unique(matchId, teamId)

## MatchParticipantRaw

10명 전체의 MVP 평가를 위해 대회 참가자가 아니어도 정규화한 통계를 저장한다.

| 필드 | 타입 |
|---|---|
| id | ID |
| matchId | ID |
| puuid | String |
| teamId | Int |
| participantIndex | Int |
| position | Position? |
| championId | Int |
| championName | String |
| win | Boolean |
| kills/deaths/assists | Int |
| totalMinionsKilled | Int |
| neutralMinionsKilled | Int |
| goldEarned | Int |
| damageToChampions | Int |
| damageTaken | Int |
| damageMitigated | Int |
| damageToObjectives | Int |
| damageToTurrets | Int |
| visionScore | Int |
| wardsPlaced | Int |
| wardsKilled | Int |
| controlWardsPlaced | Int |
| timeCCingOthers | Int |
| healOnTeammates | Int |
| shieldOnTeammates | Int |
| items | Json |
| perks | Json |
| summonerSpells | Json |
| challenges | Json |
| normalizedMetrics | Json |
| createdAt | DateTime |

unique(matchId, participantIndex)
index(matchId, teamId)

## ParticipantMatch

대회 참가자와 경기의 관계.

| 필드 | 타입 |
|---|---|
| id | ID |
| participantId | ID |
| participantWeekId | ID |
| matchId | ID |
| matchParticipantRawId | ID |
| eligible | Boolean |
| eligibilityReason | String? |
| win | Boolean |
| position | Position? |
| championId | Int |
| championName | String |
| kills | Int |
| deaths | Int |
| assists | Int |
| cs | Int |
| kda | Decimal |
| killParticipation | Decimal? |
| pointSignedCached | Int? |
| processedAt | DateTime? |
| createdAt | DateTime |
| updatedAt | DateTime |

unique(participantId, matchId)
index(participantWeekId, matchId)

## 7. 포인트 추첨·원장

## PointDraw

| 필드 | 타입 |
|---|---|
| id | ID |
| participantMatchId | ID unique |
| state | DrawState |
| resultSign | Int |
| firstValue | Int |
| firstNonceEncryptedOrProtected | String |
| firstCommitment | String |
| firstRngVersion | String |
| firstGeneratedAt | DateTime |
| revealedAt | DateTime? |
| autoRevealed | Boolean |
| rerollEligible | Boolean |
| rerollReason | String? |
| secondValue | Int? |
| secondNonceEncryptedOrProtected | String? |
| secondCommitment | String? |
| secondRngVersion | String? |
| rerollUsedAt | DateTime? |
| finalValue | Int |
| finalSignedValue | Int |
| createdAt | DateTime |
| updatedAt | DateTime |

state:

- SEALED
- REVEALED
- REROLLED
- AUTO_REVEALED
- VOID

제약:

- value는 17~23
- resultSign은 win=1, loss=-1
- finalSignedValue = resultSign * finalValue
- 사용자용 select에서 비공개 값 제외

nonce 보호 방식은 위협 모델에 맞게 결정한다. 최소한 일반 read API와 로그에 노출되지 않아야 한다.

## ScoreLedger

| 필드 | 타입 |
|---|---|
| id | ID |
| participantWeekId | ID |
| participantMatchId | ID? |
| type | ScoreLedgerType |
| amount | Int |
| idempotencyKey | String unique |
| reason | String? |
| actorUserId | ID? |
| metadata | Json? |
| createdAt | DateTime |

index(participantWeekId, createdAt)
index(participantMatchId)

원장 행 update/delete 금지. 잘못된 행은 반전 행 추가.

## ScoreReconciliation

- id
- participantWeekId
- ledgerSum
- cachedValue
- difference
- checkedAt
- repairedAt?
- actor?
- details

## 8. MVP/ACE

## MvpBaselineVersion

| 필드 | 타입 |
|---|---|
| id | ID |
| name | String unique |
| status | BaselineStatus |
| sourceDescription | String |
| patchFrom | String |
| patchTo | String |
| collectedAt | DateTime |
| sampleNotes | String? |
| demoOnly | Boolean |
| checksum | String |
| uploadedById | ID |
| publishedAt | DateTime? |
| retiredAt | DateTime? |
| createdAt | DateTime |

status: DRAFT, VALIDATED, PUBLISHED, RETIRED, REJECTED

## MvpBaselineMetric

| 필드 | 타입 |
|---|---|
| id | ID |
| versionId | ID |
| tierBucket | TierBucket |
| position | Position |
| metricKey | String |
| mean | Decimal |
| stdDev | Decimal |
| sampleSize | Int |
| lowerBound | Decimal? |
| upperBound | Decimal? |

unique(versionId, tierBucket, position, metricKey)

stdDev는 0보다 커야 한다.

## MvpEvaluation

| 필드 | 타입 |
|---|---|
| id | ID |
| matchParticipantRawId | ID |
| participantMatchId | ID? |
| baselineVersionId | ID |
| tierBucket | TierBucket |
| position | Position |
| visionObjectiveScore | Decimal |
| growthScore | Decimal |
| damageScore | Decimal |
| kdaParticipationScore | Decimal |
| totalScore | Decimal |
| teamRank | Int |
| award | MvpAward |
| evaluatorVersion | String |
| metrics | Json |
| tieBreak | Json |
| createdAt | DateTime |

unique(matchParticipantRawId, baselineVersionId)
award: NONE, MVP, ACE

## 9. 미션

## MissionDefinition

| 필드 | 타입 |
|---|---|
| id | ID |
| code | String unique |
| version | Int |
| title | String |
| description | String |
| category | MissionCategory |
| kind | MissionKind |
| difficulty | MissionDifficulty |
| points | Int |
| evaluatorKey | String |
| evaluatorConfig | Json |
| sourceType | MissionSourceType |
| target | Decimal |
| active | Boolean |
| minPatch | String? |
| maxPatch | String? |
| createdAt | DateTime |
| updatedAt | DateTime |

DB config는 데이터이며 실행 코드를 담지 않는다.

## WeeklyMissionAssignment

| 필드 | 타입 |
|---|---|
| id | ID |
| participantWeekId | ID |
| missionDefinitionId | ID |
| state | MissionAssignmentState |
| assignedAt | DateTime |
| activeFrom | DateTime |
| activeTo | DateTime? |
| progress | Decimal |
| target | Decimal |
| completedAt | DateTime? |
| completedByParticipantMatchId | ID? |
| seenOrder | Int |
| deferredOrder | Int? |
| evaluatorVersion | String |
| createdAt | DateTime |
| updatedAt | DateTime |

state:

- ACTIVE
- COMPLETED
- REROLLED
- DEFERRED
- EXPIRED
- CANCELLED

index(participantWeekId, state)
index(participantWeekId, activeFrom, activeTo)

같은 주차에서 동일 definition의 재배정 규칙은 DECISIONS에 따른다. 이력을 위해 단순 unique(participantWeek, definition)를 강제하지 않을 수 있으며 generation 번호를 둔다.

## MissionProgressEvent

| 필드 | 타입 |
|---|---|
| id | ID |
| assignmentId | ID |
| participantMatchId | ID |
| beforeValue | Decimal |
| deltaValue | Decimal |
| afterValue | Decimal |
| completed | Boolean |
| evaluatorVersion | String |
| facts | Json |
| idempotencyKey | String unique |
| createdAt | DateTime |

unique(assignmentId, participantMatchId)

## MissionCompletionLedger

| 필드 | 타입 |
|---|---|
| id | ID |
| participantWeekId | ID |
| assignmentId | ID? |
| type | MissionLedgerType |
| points | Int |
| idempotencyKey | String unique |
| actorUserId | ID? |
| reason | String? |
| metadata | Json? |
| createdAt | DateTime |

## MissionRefillState

- id
- participantWeekId unique
- credits Int default 0
- maxCredits Int default 3
- intervalMinutes Int default 360
- anchorAt DateTime
- accountedThroughAt DateTime
- nextAccrualAt DateTime
- updatedAt

tick을 행 추가로 쌓기보다 현재 시각에서 누적 가능한 수를 계산해 반영한다.

## MissionRerollState

- id
- participantWeekId unique
- lastUsedAt DateTime?
- nextAvailableAt DateTime?
- cooldownMinutes Int default 60
- totalUsed Int default 0
- updatedAt

## MissionCandidateHistory

- participantWeekId
- missionDefinitionId
- firstSeenAt
- completedAt?
- rerolledAt?
- timesAssigned
- status
- unique(participantWeekId, missionDefinitionId)

unseen/deferred 후보 선택에 사용한다.

## 10. 동기화·작업

## SyncCursor

| 필드 | 타입 |
|---|---|
| id | ID |
| participantId | ID unique |
| lastRequestedStartAt | DateTime? |
| lastSuccessfulMatchStartAt | DateTime? |
| newestKnownMatchId | String? |
| lastSuccessAt | DateTime? |
| lastErrorAt | DateTime? |
| lastErrorCode | String? |
| consecutiveFailures | Int |
| nextEligibleAt | DateTime? |
| updatedAt | DateTime |

## SyncRun

| 필드 | 타입 |
|---|---|
| id | ID |
| invocationKey | String unique |
| trigger | SyncTrigger |
| status | SyncRunStatus |
| startedAt | DateTime |
| finishedAt | DateTime? |
| participantCount | Int |
| matchIdsFound | Int |
| matchesFetched | Int |
| matchesProcessed | Int |
| matchesSkipped | Int |
| errorCount | Int |
| rateLimitSnapshot | Json? |
| requestedById | ID? |
| metadata | Json? |

## SyncRunItem

- syncRunId
- participantId?
- riotMatchId?
- stage
- status
- errorCode?
- messageSanitized?
- retryable
- durationMs
- createdAt

## JobLease

| 필드 | 타입 |
|---|---|
| key | String PK |
| ownerToken | String |
| acquiredAt | DateTime |
| expiresAt | DateTime |
| heartbeatAt | DateTime |

조건부 acquire/update로 중복 worker를 제어한다.

## ProcessingOutbox (선택 권장)

- id
- type
- aggregateId
- payload
- status
- attempts
- availableAt
- lockedAt
- processedAt
- lastError
- unique dedupe key

초기 버전에서는 같은 request 안에서 처리할 수 있으나, 함수 시간 제한 문제가 생기면 outbox/worker로 전환한다.

## 11. 콘텐츠·감사·운영

## Announcement

- id
- title
- body
- status
- pinned
- publishedAt
- expiresAt?
- createdById
- updatedById
- createdAt
- updatedAt

## LegalDocument

- id
- type (RULES, TERMS, PRIVACY, RIOT_DISCLAIMER)
- version
- title
- body
- effectiveAt
- publishedAt?
- status
- createdById
- checksum
- unique(type, version)

## AuditLog

| 필드 | 타입 |
|---|---|
| id | ID |
| actorUserId | ID? |
| action | String |
| targetType | String |
| targetId | String? |
| reason | String? |
| before | Json? |
| after | Json? |
| requestId | String? |
| ipHash | String? |
| createdAt | DateTime |

index(actorUserId, createdAt)
index(targetType, targetId, createdAt)
index(action, createdAt)

비밀번호 hash, JWT, Riot key, nonce 원문 등은 before/after에 넣지 않는다.

## FeatureFlag

- key PK
- enabled
- config Json
- description
- updatedById
- updatedAt

예:

- scoring.fixed20Fallback
- mvp.rewardsEnabled
- sync.opportunisticEnabled
- history.searchEnabled
- maintenance.enabled

## SystemSetting

민감하지 않은 운영 설정만 저장한다. 비밀은 환경 변수/secret manager.

- key
- value Json
- version
- updatedById
- updatedAt

## ExportJob

- id
- type
- status
- weekId?
- requestedById
- objectPath?
- checksum?
- expiresAt?
- createdAt
- finishedAt?
- errorCode?

## 12. 주요 관계

```text
User 1 ─ 0..1 Participant
User 1 ─ * ParticipationApplication
Participant * ─ * Season through SeasonParticipant
Participant 1 ─ * ParticipantWeek
Week 1 ─ * ParticipantWeek
Match 1 ─ 10 MatchParticipantRaw
Participant 1 ─ * ParticipantMatch
Match 1 ─ * ParticipantMatch
ParticipantMatch 1 ─ 1 PointDraw
ParticipantWeek 1 ─ * ScoreLedger
MatchParticipantRaw 1 ─ * MvpEvaluation(versioned)
ParticipantWeek 1 ─ * WeeklyMissionAssignment
WeeklyMissionAssignment 1 ─ * MissionProgressEvent
ParticipantWeek 1 ─ * MissionCompletionLedger
```

## 13. 인덱스 체크리스트

구현 후 실제 explain을 확인한다.

- User.loginIdNormalized unique
- Participant.puuid unique
- ParticipationApplication(status, submittedAt)
- Season(status, startAt, endAt)
- Week(seasonId, number) unique
- ParticipantWeek(weekId, participantId) unique
- RankSnapshot(participantId, capturedAt desc)
- Match.riotMatchId unique
- Match(gameStartAt desc)
- ParticipantMatch(participantId, matchId) unique
- ParticipantMatch(participantWeekId, createdAt desc)
- ScoreLedger.idempotencyKey unique
- ScoreLedger(participantWeekId, createdAt)
- PointDraw.participantMatchId unique
- WeeklyMissionAssignment(participantWeekId, state)
- MissionProgressEvent.idempotencyKey unique
- SyncRun.invocationKey unique
- SyncRun(status, startedAt desc)
- AuditLog(createdAt desc)
- AuditLog(targetType, targetId)

## 14. 삭제·보존

- User: 계정 삭제 요청 시 법적/운영 요구 범위에서 pseudonymize
- Match raw payload: 운영 필요 기간 후 축소 또는 삭제 가능
- 정규화 경기·원장·snapshot: 대회 기록 보존 정책에 따름
- Session/LoginAttempt: 짧은 보존 기간
- AuditLog: 대회 종료 후 정한 기간
- Export file: 자동 만료
- 삭제 작업 자체를 AuditLog에 기록

---

<!-- SOURCE: docs/MISSION_CATALOG.md -->

# 주간 미션 카탈로그 v1

이 문서는 1차 운영에 사용할 100개 미션 정의와 Riot Match-V5 판정 전략을 고정한다. 데이터 필드가 패치나 API 응답에 따라 누락될 수 있으므로 모든 evaluator는 `PASS | FAIL | PENDING_DATA | NOT_APPLICABLE`을 반환해야 한다. `PENDING_DATA`를 실패로 간주하지 않는다.

## 1. 공통 규칙

- 미션은 `MissionDefinition` 데이터로 저장하고 evaluator 코드는 registry에서 관리한다.
- `SINGLE`은 한 경기 단위, `CUMULATIVE`는 할당 활성 이후 여러 경기의 누적이다.
- 미션 판정 대상은 경기 시작 시 활성 상태였던 assignment snapshot으로 고정한다.
- 인정 경기 조건을 통과한 솔로 랭크 경기만 평가한다.
- 타임라인이 필요한 미션은 Match Timeline 조회 성공 후 판정한다. 타임라인 호출 실패 시 재시도 가능한 `PENDING_DATA`다.
- DDragon 데이터는 경기의 gameVersion과 가장 가까운 캐시 버전을 사용하고 사용한 버전을 기록한다.
- 숫자는 정수 원본을 보존하고 비율 계산에서만 소수점을 사용한다. 경계값은 본 문서의 `이상/이하`를 그대로 포함한다.
- 포지션이 비어 있거나 비정상인 경우 포지션 미션은 `PENDING_DATA` 또는 운영 규칙에 따른 수동 검토로 보낸다.
- 점수는 난이도 기준 기본안이며, 시즌 시작 후에는 해당 주차 중 값을 바꾸지 않는다. 변경은 다음 주차용 정의 버전으로 게시한다.

## 2. 데이터 원천

| 값 | 의미 |
|---|---|
| `MATCH_INFO` | Match-V5 info/team/participant 필드만 필요 |
| `MATCH_TIMELINE` | Match Timeline event/frame 필요 |
| `DATA_DRAGON` | 정적 챔피언·아이템 분류 데이터 필요 |
| `DERIVED` | 정규화된 경기 데이터 또는 여러 경기에서 계산 |
| `INTERNAL` | 이 서비스가 산출한 MVP/ACE 등 내부 이벤트 |

## 3. 100개 정의

| 코드 | 미션 | 분류 | 유형 | 점수 | 목표 | Evaluator | 원천 | 판정 요약 |
|---|---|---|---:|---:|---|---|---|---|
| M001 | 승리 1회 | 결과 | SINGLE | 2 | `1` | `match.win` | MATCH_INFO | 활성 이후 시작된 인정 경기에서 1승 |
| M002 | KDA 3.0 이상 | 전투 | SINGLE | 2 | `3.0` | `combat.kdaAtLeast` | MATCH_INFO | (킬+어시스트)/max(1,데스) 3.0 이상 |
| M003 | KDA 5.0 이상 | 전투 | SINGLE | 3 | `5.0` | `combat.kdaAtLeast` | MATCH_INFO | KDA 5.0 이상 |
| M004 | KDA 8.0 이상 | 전투 | SINGLE | 4 | `8.0` | `combat.kdaAtLeast` | MATCH_INFO | KDA 8.0 이상 |
| M005 | 8킬 이상 | 전투 | SINGLE | 2 | `8` | `combat.killsAtLeast` | MATCH_INFO | 한 경기 8킬 이상 |
| M006 | 12킬 이상 | 전투 | SINGLE | 3 | `12` | `combat.killsAtLeast` | MATCH_INFO | 한 경기 12킬 이상 |
| M007 | 15킬 이상 | 전투 | SINGLE | 4 | `15` | `combat.killsAtLeast` | MATCH_INFO | 한 경기 15킬 이상 |
| M008 | 15어시스트 이상 | 전투 | SINGLE | 2 | `15` | `combat.assistsAtLeast` | MATCH_INFO | 한 경기 15어시스트 이상 |
| M009 | 25어시스트 이상 | 전투 | SINGLE | 4 | `25` | `combat.assistsAtLeast` | MATCH_INFO | 한 경기 25어시스트 이상 |
| M010 | 2데스 이하 승리 | 전투 | SINGLE | 3 | `2` | `combat.winWithDeathsAtMost` | MATCH_INFO | 승리하면서 2데스 이하 |
| M011 | 노데스 승리 | 전투 | SINGLE | 5 | `0` | `combat.winWithDeathsAtMost` | MATCH_INFO | 승리하면서 0데스 |
| M012 | 킬 관여율 60% | 전투 | SINGLE | 2 | `0.6` | `combat.killParticipationAtLeast` | MATCH_INFO | 팀 킬이 0이면 미달 처리 |
| M013 | 킬 관여율 75% | 전투 | SINGLE | 4 | `0.75` | `combat.killParticipationAtLeast` | MATCH_INFO | 팀 킬이 0이면 미달 처리 |
| M014 | 챔피언 피해 25,000 | 피해 | SINGLE | 2 | `25000` | `damage.toChampionsAtLeast` | MATCH_INFO | totalDamageDealtToChampions 기준 |
| M015 | 챔피언 피해 40,000 | 피해 | SINGLE | 4 | `40000` | `damage.toChampionsAtLeast` | MATCH_INFO | totalDamageDealtToChampions 기준 |
| M016 | 분당 챔피언 피해 800 | 피해 | SINGLE | 4 | `800` | `damage.perMinuteAtLeast` | DERIVED | 피해량/(게임초/60), 10분 미만 무효 경기 제외 |
| M017 | 받은 피해 35,000 | 피해 | SINGLE | 3 | `35000` | `damage.takenAtLeast` | MATCH_INFO | totalDamageTaken 기준 |
| M018 | 감소시킨 피해 30,000 | 피해 | SINGLE | 3 | `30000` | `damage.mitigatedAtLeast` | MATCH_INFO | damageSelfMitigated 기준 |
| M019 | 군중 제어 30초 | 전투 | SINGLE | 3 | `30` | `combat.ccTimeAtLeast` | MATCH_INFO | timeCCingOthers 기준 |
| M020 | 아군 회복·보호막 10,000 | 보호 | SINGLE | 3 | `10000` | `support.allyHealShieldAtLeast` | MATCH_INFO | totalHealsOnTeammates+totalDamageShieldedOnTeammates |
| M021 | CS 150개 | 성장 | SINGLE | 1 | `150` | `growth.csAtLeast` | MATCH_INFO | 미니언+중립 몬스터 처치 합 |
| M022 | CS 200개 | 성장 | SINGLE | 2 | `200` | `growth.csAtLeast` | MATCH_INFO | 미니언+중립 몬스터 처치 합 |
| M023 | 분당 CS 7.0 | 성장 | SINGLE | 2 | `7.0` | `growth.csPerMinuteAtLeast` | DERIVED | CS/(게임초/60) |
| M024 | 분당 CS 8.5 | 성장 | SINGLE | 4 | `8.5` | `growth.csPerMinuteAtLeast` | DERIVED | CS/(게임초/60) |
| M025 | 골드 15,000 | 성장 | SINGLE | 2 | `15000` | `growth.goldAtLeast` | MATCH_INFO | goldEarned 기준 |
| M026 | 시야 점수 40 | 시야 | SINGLE | 2 | `40` | `vision.scoreAtLeast` | MATCH_INFO | visionScore 기준 |
| M027 | 시야 점수 70 | 시야 | SINGLE | 3 | `70` | `vision.scoreAtLeast` | MATCH_INFO | visionScore 기준 |
| M028 | 시야 점수 100 | 시야 | SINGLE | 5 | `100` | `vision.scoreAtLeast` | MATCH_INFO | visionScore 기준 |
| M029 | 제어 와드 3개 구매 | 시야 | SINGLE | 2 | `3` | `vision.controlWardsBoughtAtLeast` | MATCH_INFO | visionWardsBoughtInGame 기준 |
| M030 | 와드 5개 제거 | 시야 | SINGLE | 2 | `5` | `vision.wardsKilledAtLeast` | MATCH_INFO | wardsKilled 기준 |
| M031 | 오브젝트 피해 20,000 | 오브젝트 | SINGLE | 3 | `20000` | `objective.damageAtLeast` | MATCH_INFO | damageDealtToObjectives 기준 |
| M032 | 포탑 피해 5,000 | 오브젝트 | SINGLE | 2 | `5000` | `objective.turretDamageAtLeast` | MATCH_INFO | damageDealtToTurrets 기준 |
| M033 | 18레벨 달성 | 성장 | SINGLE | 2 | `18` | `growth.levelAtLeast` | MATCH_INFO | champLevel 기준 |
| M034 | 한 번에 15분 생존 | 생존 | SINGLE | 3 | `900` | `combat.longestLifeAtLeast` | MATCH_INFO | longestTimeSpentLiving 초 기준 |
| M035 | 분당 골드 450 | 성장 | SINGLE | 3 | `450` | `growth.goldPerMinuteAtLeast` | DERIVED | goldEarned/(게임초/60) |
| M036 | 더블 킬 | 멀티킬 | SINGLE | 1 | `1` | `combat.doubleKillsAtLeast` | MATCH_INFO | doubleKills 1 이상 |
| M037 | 트리플 킬 | 멀티킬 | SINGLE | 3 | `1` | `combat.tripleKillsAtLeast` | MATCH_INFO | tripleKills 1 이상 |
| M038 | 쿼드라 킬 | 멀티킬 | SINGLE | 5 | `1` | `combat.quadraKillsAtLeast` | MATCH_INFO | quadraKills 1 이상 |
| M039 | 펜타 킬 | 멀티킬 | SINGLE | 8 | `1` | `combat.pentaKillsAtLeast` | MATCH_INFO | pentaKills 1 이상 |
| M040 | 5연속 킬 | 전투 | SINGLE | 3 | `5` | `combat.largestKillingSpreeAtLeast` | MATCH_INFO | largestKillingSpree 기준 |
| M041 | 솔로 킬 3회 | 전투 | SINGLE | 4 | `3` | `combat.soloKillsAtLeast` | MATCH_INFO | Challenges의 soloKills 사용; 필드 누락 시 판정 보류 |
| M042 | 퍼스트 블러드 관여 | 전투 | SINGLE | 2 | `1` | `combat.firstBloodParticipation` | MATCH_INFO | firstBloodKill 또는 firstBloodAssist |
| M043 | 퍼스트 타워 관여 | 오브젝트 | SINGLE | 2 | `1` | `objective.firstTowerParticipation` | MATCH_INFO | firstTowerKill 또는 firstTowerAssist |
| M044 | 포탑 철거 관여 3회 | 오브젝트 | SINGLE | 3 | `3` | `objective.turretTakedownsAtLeast` | MATCH_INFO | Challenges.turretTakedowns 우선, 없으면 킬/어시스트 필드 |
| M045 | 억제기 철거 관여 | 오브젝트 | SINGLE | 3 | `1` | `objective.inhibitorTakedownsAtLeast` | MATCH_INFO | inhibitorKills+inhibitorTakedowns/assist 정규화 |
| M046 | 드래곤 처치 관여 2회 | 오브젝트 | SINGLE | 3 | `2` | `objective.dragonTakedownsAtLeast` | MATCH_TIMELINE | 타임라인 ELITE_MONSTER_KILL의 killer/assistingParticipantIds |
| M047 | 바론 처치 관여 | 오브젝트 | SINGLE | 3 | `1` | `objective.baronTakedownsAtLeast` | MATCH_TIMELINE | 타임라인 BARON_NASHOR 처치 관여 |
| M048 | 전령 처치 관여 | 오브젝트 | SINGLE | 2 | `1` | `objective.heraldTakedownsAtLeast` | MATCH_TIMELINE | 타임라인 RIFTHERALD 처치 관여 |
| M049 | 오브젝트 스틸 | 오브젝트 | SINGLE | 5 | `1` | `objective.stealsAtLeast` | MATCH_INFO | objectivesStolen 1 이상 |
| M050 | 팀 드래곤 3회 | 오브젝트 | SINGLE | 3 | `3` | `objective.teamDragonsAtLeast` | MATCH_INFO | participant team의 objectives.dragon.kills |
| M051 | 바론 처치 후 승리 | 오브젝트 | SINGLE | 4 | `1` | `objective.winWithTeamBaron` | MATCH_INFO | 승리 팀의 바론 처치 1회 이상 |
| M052 | 25분 이내 승리 | 속도 | SINGLE | 4 | `1500` | `result.winWithinSeconds` | MATCH_INFO | gameDuration <= 1500초 |
| M053 | 15분 57초 이내 승리 | 속도 | SINGLE | 7 | `957` | `result.winWithinSeconds` | MATCH_INFO | gameDuration <= 957초 |
| M054 | 35분 이상 경기 승리 | 인내 | SINGLE | 3 | `2100` | `result.winAfterSeconds` | MATCH_INFO | gameDuration >= 2100초 |
| M055 | 용 2회·바론 1회와 승리 | 오브젝트 | SINGLE | 5 | `1` | `objective.winWithDragonsAndBaron` | MATCH_INFO | 승리+팀 드래곤>=2+바론>=1 |
| M056 | 5분 전 킬 | 타임라인 | SINGLE | 2 | `300` | `timeline.killBeforeSeconds` | MATCH_TIMELINE | 본인 CHAMPION_KILL timestamp < 300초 |
| M057 | 10분 전 3킬 | 타임라인 | SINGLE | 4 | `3` | `timeline.killsBeforeTenAtLeast` | MATCH_TIMELINE | 본인 킬 3회 이상을 600초 이전 달성 |
| M058 | 15분까지 무데스 | 타임라인 | SINGLE | 2 | `900` | `timeline.noDeathUntilSeconds` | MATCH_TIMELINE | 900초 전 CHAMPION_KILL victimId가 본인인 이벤트 없음 |
| M059 | 10분 CS 50 | 타임라인 | SINGLE | 2 | `50` | `timeline.csAtMinuteAtLeast` | MATCH_TIMELINE | 10분 프레임의 totalMinionsKilled+jungleMinionsKilled |
| M060 | 15분 CS 100 | 타임라인 | SINGLE | 3 | `100` | `timeline.csAtMinuteAtLeast` | MATCH_TIMELINE | 15분 프레임 기준 |
| M061 | 20분 CS 150 | 타임라인 | SINGLE | 4 | `150` | `timeline.csAtMinuteAtLeast` | MATCH_TIMELINE | 20분 프레임 기준 |
| M062 | 8분 전 제어 와드 구매 | 타임라인 | SINGLE | 2 | `480` | `timeline.controlWardPurchaseBefore` | MATCH_TIMELINE | ITEM_PURCHASED itemId=2055, timestamp < 480초 |
| M063 | 도란 시작 아이템 | 빌드 | SINGLE | 1 | `1` | `build.doranStart` | MATCH_TIMELINE | 첫 귀환 전 도란 계열 아이템 구매 |
| M064 | 서포트 퀘스트 시작 아이템 | 빌드 | SINGLE | 1 | `1` | `build.supportStart` | MATCH_TIMELINE | 첫 귀환 전 현재 패치 지원 아이템 시작 구성 구매 |
| M065 | 물약 미구매 | 빌드 | SINGLE | 2 | `0` | `build.noPotionPurchase` | MATCH_TIMELINE | 전체 타임라인에 허용된 물약 itemId 구매 이벤트 없음 |
| M066 | 점멸 없이 승리 | 빌드 | SINGLE | 4 | `0` | `build.winWithoutFlash` | MATCH_INFO | summoner spell 1/2에 Flash가 없고 승리 |
| M067 | 신발 없이 승리 | 빌드 | SINGLE | 4 | `0` | `build.winWithoutBoots` | MATCH_TIMELINE | 경기 종료 보유 및 구매 이력에서 신발 계열 없음 |
| M068 | 완성 아이템 3개 | 빌드 | SINGLE | 2 | `3` | `build.completedItemsAtLeast` | MATCH_INFO | DDragon item 분류로 완성 아이템 3개 이상 |
| M069 | 완성 아이템 4개 | 빌드 | SINGLE | 3 | `4` | `build.completedItemsAtLeast` | MATCH_INFO | DDragon item 분류로 완성 아이템 4개 이상 |
| M070 | 초반 구매 500골드 이하 | 빌드 | SINGLE | 3 | `500` | `build.startPurchaseCostAtMost` | MATCH_TIMELINE | 2분 전 구매 원가 합, 장신구 제외; 판매/되돌리기 반영 |
| M071 | 탑으로 승리 | 포지션 | SINGLE | 2 | `TOP` | `position.winAs` | MATCH_INFO | teamPosition 정규화 TOP |
| M072 | 정글로 승리 | 포지션 | SINGLE | 2 | `JUNGLE` | `position.winAs` | MATCH_INFO | teamPosition 정규화 JUNGLE |
| M073 | 미드로 승리 | 포지션 | SINGLE | 2 | `MIDDLE` | `position.winAs` | MATCH_INFO | teamPosition 정규화 MIDDLE |
| M074 | 원딜로 승리 | 포지션 | SINGLE | 2 | `BOTTOM` | `position.winAs` | MATCH_INFO | teamPosition 정규화 BOTTOM |
| M075 | 서포터로 승리 | 포지션 | SINGLE | 2 | `UTILITY` | `position.winAs` | MATCH_INFO | teamPosition 정규화 UTILITY |
| M076 | 주 포지션 외 승리 | 포지션 | SINGLE | 3 | `1` | `position.winOffPrimary` | DERIVED | Participant.primaryPosition과 다른 유효 포지션으로 승리 |
| M077 | 정밀 룬으로 승리 | 룬 | SINGLE | 2 | `8000` | `rune.winWithPrimaryStyle` | MATCH_INFO | primaryStyle ID 8000 |
| M078 | 지배 룬으로 승리 | 룬 | SINGLE | 2 | `8100` | `rune.winWithPrimaryStyle` | MATCH_INFO | primaryStyle ID 8100 |
| M079 | 마법 룬으로 승리 | 룬 | SINGLE | 2 | `8200` | `rune.winWithPrimaryStyle` | MATCH_INFO | primaryStyle ID 8200 |
| M080 | 결의 룬으로 승리 | 룬 | SINGLE | 2 | `8400` | `rune.winWithPrimaryStyle` | MATCH_INFO | primaryStyle ID 8400 |
| M081 | 영감 룬으로 승리 | 룬 | SINGLE | 2 | `8300` | `rune.winWithPrimaryStyle` | MATCH_INFO | primaryStyle ID 8300 |
| M082 | 탱커 챔피언으로 승리 | 챔피언 | SINGLE | 2 | `Tank` | `champion.winWithTag` | DATA_DRAGON | 현재 경기 패치와 매핑된 champion tag |
| M083 | 전사 챔피언으로 승리 | 챔피언 | SINGLE | 2 | `Fighter` | `champion.winWithTag` | DATA_DRAGON | 현재 경기 패치와 매핑된 champion tag |
| M084 | 마법사 챔피언으로 승리 | 챔피언 | SINGLE | 2 | `Mage` | `champion.winWithTag` | DATA_DRAGON | 현재 경기 패치와 매핑된 champion tag |
| M085 | 원거리 딜러 챔피언으로 승리 | 챔피언 | SINGLE | 2 | `Marksman` | `champion.winWithTag` | DATA_DRAGON | 현재 경기 패치와 매핑된 champion tag |
| M086 | 경기 3회 플레이 | 누적 | CUMULATIVE | 2 | `3` | `cumulative.games` | DERIVED | 활성 이후 인정 경기 3회 |
| M087 | 경기 5회 플레이 | 누적 | CUMULATIVE | 3 | `5` | `cumulative.games` | DERIVED | 활성 이후 인정 경기 5회 |
| M088 | 2승 달성 | 누적 | CUMULATIVE | 2 | `2` | `cumulative.wins` | DERIVED | 활성 이후 2승 |
| M089 | 4승 달성 | 누적 | CUMULATIVE | 4 | `4` | `cumulative.wins` | DERIVED | 활성 이후 4승 |
| M090 | 3연승 달성 | 누적 | CUMULATIVE | 4 | `3` | `cumulative.winStreak` | DERIVED | 활성 이후 연속 승리 3회; 패배 시 진행 연속값 초기화 |
| M091 | 누적 20킬 | 누적 | CUMULATIVE | 2 | `20` | `cumulative.kills` | DERIVED | 활성 이후 킬 합계 |
| M092 | 누적 50어시스트 | 누적 | CUMULATIVE | 3 | `50` | `cumulative.assists` | DERIVED | 활성 이후 어시스트 합계 |
| M093 | 누적 CS 600 | 누적 | CUMULATIVE | 3 | `600` | `cumulative.cs` | DERIVED | 활성 이후 CS 합계 |
| M094 | 누적 시야 점수 150 | 누적 | CUMULATIVE | 3 | `150` | `cumulative.visionScore` | DERIVED | 활성 이후 visionScore 합계 |
| M095 | 누적 챔피언 피해 100,000 | 누적 | CUMULATIVE | 4 | `100000` | `cumulative.damageToChampions` | DERIVED | 활성 이후 피해 합계 |
| M096 | 서로 다른 챔피언 5명 | 누적 | CUMULATIVE | 4 | `5` | `cumulative.distinctChampions` | DERIVED | 활성 이후 championId distinct count |
| M097 | 서로 다른 포지션 3개 | 누적 | CUMULATIVE | 4 | `3` | `cumulative.distinctPositions` | DERIVED | 유효 teamPosition distinct count |
| M098 | 누적 제어 와드 10개 | 누적 | CUMULATIVE | 3 | `10` | `cumulative.controlWardsBought` | DERIVED | 활성 이후 구매 합계 |
| M099 | 팀 드래곤 누적 8회 | 누적 | CUMULATIVE | 4 | `8` | `cumulative.teamDragons` | DERIVED | 활성 이후 참가 팀 드래곤 처치 합 |
| M100 | MVP 또는 ACE 1회 | 누적 | CUMULATIVE | 5 | `1` | `cumulative.mvpAceAwards` | INTERNAL | 게시된 실데이터 기준 평가에서 MVP/ACE 획득 |

## 4. 활성 풀과 난이도 가드레일

기본적으로 100개를 모두 게시할 수 있으나, 주차별 `eligibleRoles`, `minDuration`, `requiresTimeline`, `requiresPublishedMvpBaseline` 조건을 적용한다. 다음 규칙을 권장한다.

- 한 참가자의 최초 5개에 5점 이상 미션은 최대 1개다.
- 최초 5개 중 최소 1개는 1~2점의 일반 미션이다.
- 역할 제한 미션은 해당 참가자의 주 포지션만 강제하지 않되, 동일 포지션 미션이 동시에 두 개 이상 활성화되지 않게 한다.
- 타임라인 의존 미션은 동시에 최대 2개다.
- 누적 미션은 동시에 최대 2개다.
- `M100`은 실제 게시된 MVP 기준 버전이 없으면 후보 풀에서 제외한다.
- 패치 변경으로 evaluator가 안정적이지 않으면 해당 정의를 `DISABLED`로 게시하고 대체 미션을 사용한다.

## 5. 난수 배정

미션 배정은 서버의 안전한 난수를 사용하되, 운영 감사가 가능하도록 assignment의 `selectionSeedHash`, 후보 정의 버전, 선택된 mission ID를 기록한다. 사용자가 후보를 예측하거나 클라이언트에서 다시 뽑을 수 없어야 한다. 동일한 정의를 같은 참가자·주차에 중복 활성화하지 않는다.

## 6. 진행도 저장

- `currentValue`, `targetValue`, `unit`, `lastEvaluatedMatchId`를 저장한다.
- distinct 기반 미션은 단순 숫자뿐 아니라 중복 제거용 별도 progress payload 또는 event ledger를 유지한다.
- 연승은 현재 연속값과 최대 연속값을 분리한다.
- 완료 시 `MissionCompletionLedger`를 한 번만 생성하고 주간 미션 점수 read model에 반영한다.
- 재처리 시 동일 `(assignmentId, matchId, evaluatorVersion)`은 한 번만 반영한다.

## 7. 관리자 편집 제한

관리자는 새 버전의 미션 정의를 만들 수 있지만 진행 중인 주차의 정의를 직접 덮어쓰지 않는다. 오판정 정정은 사유와 함께 correction event를 추가하고 AuditLog를 남긴다. evaluator 코드가 없는 임의 표현식을 운영 UI에서 실행하지 않는다.

## 8. 출시 전 fixture

각 evaluator는 최소 다음 fixture를 가진다.

- 정확히 경계값인 성공 사례
- 경계보다 1 작은 실패 사례
- 데이터 필드 누락 사례
- 10분 미만 또는 무효 큐 사례
- 타임라인 이벤트 순서가 뒤섞인 사례
- 동일 경기를 두 번 처리한 사례
- 누적 미션이 활성되기 전 경기와 후 경기의 혼합 사례
- 경기 도중 리롤되어 snapshot과 현재 assignment가 다른 사례

---

<!-- SOURCE: docs/EXTERNAL_CONSTRAINTS.md -->

# 외부 서비스 제약과 구현 경계

이 문서는 구현 시 변하기 쉬운 외부 규칙을 코드에 흩뿌리지 않기 위한 체크리스트다. 실제 작업일에 공식 문서를 다시 확인하고, 확인 날짜와 결론을 `docs/DECISIONS.md` 또는 릴리스 노트에 기록한다.

## 1. Riot Developer API

### 1.1 계정 식별

- 사용자 입력은 `gameName#tagLine` 형식의 Riot ID다.
- Account-V1의 regional routing으로 Riot ID를 PUUID로 변환한다.
- 이후 내부 참조와 Match-V5 조회의 기준 식별자는 PUUID다.
- 표시 이름 변경은 동일 PUUID를 기준으로 history에 기록한다.

### 1.2 라우팅

- 한국 리그·소환사 관련 platform 호출은 KR host를 사용한다.
- Account-V1 및 Match-V5는 ASIA regional host를 사용한다.
- host 문자열을 UI나 여러 서비스에 복제하지 말고 Riot client 설정 한 곳에서 관리한다.

### 1.3 키 보안

- API 키는 서버 환경 변수에서만 읽는다.
- `NEXT_PUBLIC_*`, 브라우저 bundle, 로그, 오류 응답에 포함하지 않는다.
- 클라이언트가 임의 Riot endpoint를 대신 호출하게 하는 범용 proxy를 만들지 않는다.
- 401/403은 키 만료·권한 문제로 분리하고, 429는 `Retry-After`를 존중한다.
- 개발 키가 만료되어도 Mock 모드와 나머지 사이트가 작동해야 한다.

### 1.4 API 제품 등록과 운영 준비

커뮤니티 대회 운영 허용 여부와 Riot API 제품 등록은 서로 다른 절차로 취급한다.

- 공개 API 제품 운영 전 Riot Developer Portal의 제품 등록·Production key 요건을 확인한다.
- 개발 키는 prototype 용도이며 만료될 수 있으므로 공개 서비스의 영구 자격 증명으로 취급하지 않는다.
- 기능이 작동하는 사이트, 개인정보처리방침, 이용약관, 제품 설명, 데이터 사용 흐름을 준비한다.
- Riot Sign On은 초기 버전의 필수 사항이 아니다. Production 앱 승인과 별도 요구사항이 충족된 뒤 후속 단계로 도입한다.
- Riot이 요구하는 비공식 제품 고지 문구를 footer와 규칙 문서에 제공한다.

### 1.5 커뮤니티 대회 운영 경계

2026-08-03 공개된 최신 LoL Esports Community Competition Guidelines를 현재 기준선으로 삼되, 실제 개최 직전에 다시 확인한다.

- 지역 LAN, 학교·대학, 온라인 커뮤니티 대회 등은 거의 모든 규모에서 가이드라인 적용 대상이 될 수 있다. 이 프로젝트의 약 20명 규모는 제품 목표이지 정책상 최소 인원으로 가정하지 않는다.
- 최신 안내상 대부분의 커뮤니티 대회는 별도의 사전 대회 승인을 기다리지 않고 가이드라인에 따라 진행할 수 있다.
- Riot은 대회 정보를 Competition Visibility Form(현황 양식)으로 제출할 것을 강하게 권장하므로, 제출 여부와 제출 기록을 운영 체크리스트에 남긴다.
- 운영 주체가 정부기관·비승인 기업 브랜드·프로 LoL Esports 팀/선수 등 적용 제외 범주에 해당하는지 확인한다.
- 이벤트 이름과 홍보물은 Riot Games 또는 LoL Esports의 공식 주최·승인·후원 행사로 오인되지 않게 한다.
- Riot Games 로고와 Worlds, MSI, LCK 등 공식 esports 대회 상표를 이벤트 브랜딩에 사용하지 않는다.
- 허용된 League of Legends 자산은 대회 홍보에 필요한 범위에서 원형을 유지해 사용하며, 스폰서 제품을 보증하는 방식으로 사용하지 않는다.
- 도박·스포츠 베팅·카지노 등 최신 가이드라인의 금지 스폰서 범주를 받지 않는다.
- 참가비·상금·스폰서가 생기면 합리적이고 공정하게 운영하고 관련 법률·세무·약관을 별도로 검토한다.

### 1.6 점수제와 정책상 안전 장치

- 대회 규칙은 참가자에게 공개하고 공정하게 적용한다.
- 현금 베팅, 유료 재추첨, 현금성 환전, 구매형 확률 요소를 넣지 않는다.
- 17~23점의 각 확률과 재추첨 규칙을 사전에 공개한다.
- 무상·비현금형 점수 연출이라도 출시 전 최신 Riot 정책과 국내 적용 법률을 다시 확인한다.
- 검토 결과가 불확실하면 `POINT_MODE=FIXED_20`으로 운영할 수 있어야 한다.
- Riot 로고·화면·상표를 공식 서비스처럼 보이게 복제하지 않는다.

### 1.7 정적 데이터

- 챔피언·아이템 이미지와 분류는 사용 가능한 공식 정적 데이터 자산을 우선한다.
- gameVersion과 정적 데이터 버전이 다를 수 있으므로 nearest-compatible resolver와 fallback을 둔다.
- 원격 이미지 실패 시 텍스트·placeholder로 화면이 깨지지 않아야 한다.

## 2. 스케줄러와 배포

### 2.1 Vercel

- Hobby 환경의 Cron 호출 빈도는 준실시간 동기화 요구를 충족하지 못할 수 있다.
- 모든 Cron endpoint는 `CRON_SECRET` 또는 동등한 서명 검증을 요구한다.
- 서버리스 함수는 시간 제한이 있으므로 전체 참가자를 한 요청에서 무한 처리하지 않는다.
- batch size, cursor, lease, 다음 실행 continuation을 사용한다.
- 스케줄러가 자동 재시도를 보장한다고 가정하지 않는다.

### 2.2 GitHub Actions 예약 호출

- 무료 운영 대안으로 서명된 sync endpoint를 예약 호출할 수 있다.
- 예약 실행은 혼잡 시 지연되거나 누락될 수 있으므로 정확한 분 단위 SLA로 표현하지 않는다.
- workflow 권한은 최소화하고 secret은 repository secret에서 읽는다.
- 로그에 endpoint secret이나 Riot key를 출력하지 않는다.
- 장기간 저장소 활동이 없을 때 예약 실행 상태를 운영자가 점검한다.

### 2.3 권장 모드

| 상황 | 동기화 방식 |
|---|---|
| 로컬 개발 | Mock + 관리자 수동 동기화 |
| 내부 데모 | 관리자 수동 + 제한된 기회성 동기화 |
| 무료 동아리 운영 | GitHub Actions 예약 호출 + 수동 복구 |
| 안정적인 본 운영 | 유료 Cron 또는 별도 worker/queue |

## 3. PostgreSQL·Prisma

- 앱과 마이그레이션이 같은 production DB를 무분별하게 동시에 변경하지 않는다.
- 로컬은 migration 생성, CI는 drift 검증, production은 승인된 deploy migration만 수행한다.
- 점수·미션·경기 처리의 핵심 유일성은 애플리케이션 검사뿐 아니라 DB unique constraint로 보장한다.
- 장시간 외부 API 호출을 DB transaction 안에서 수행하지 않는다.
- connection pool 환경과 serverless adapter의 현재 권장 구성을 작업 시 공식 문서로 재확인한다.

## 4. 인증

- 사이트 자체 Credentials 인증은 Riot 계정 소유 인증과 동일하지 않다.
- 초기 내부 대회에서는 Riot ID 제출과 관리자 승인으로 참가자를 연결한다.
- 비밀번호는 Argon2id로 해시하며 평문·복호화 가능한 형태를 저장하지 않는다.
- 세션은 HttpOnly, Secure(production), SameSite=Lax 기본 쿠키를 사용한다.
- 상태 변경 요청은 origin 검증 또는 CSRF 방어를 적용한다.
- 로그인·신청·관리자 동작에 rate limit과 감사 로그를 적용한다.

## 5. 구현 시 재확인 체크리스트

- [ ] 현재 안정 Next.js·React·Prisma 버전과 호환성
- [ ] Riot API method·DTO·routing·rate limit 정책
- [ ] Queue ID 및 솔로 랭크 판정 상수
- [ ] Match-V5 Challenges/Timeline 필드의 실제 fixture
- [ ] Riot API 제품 등록·Production key와 비공식 제품 고지 문구
- [ ] 최신 Community Competition Guidelines 적용 범위·브랜딩·금지 스폰서 확인
- [ ] Competition Visibility Form(현황 양식) 제출 여부와 증빙 기록
- [ ] Vercel 함수·Cron 플랜 제한
- [ ] GitHub Actions 예약 실행 제약
- [ ] 개인정보 보존 기간과 동아리 내부 운영 동의
- [ ] 이벤트 시작 전 실 API로 최소 3개 계정의 end-to-end dry run

---

<!-- SOURCE: docs/TEST_PLAN.md -->

# 테스트 및 인수 계획

## 1. 목적

이 사이트에서 가장 위험한 오류는 “화면이 조금 어긋나는 문제”가 아니라 경기·점수·미션이 중복 반영되거나 참가자 간에 다르게 보이는 문제다. 테스트 우선순위는 다음과 같다.

1. 점수·경기·미션 데이터 무결성
2. 인증·권한·비밀값 보호
3. Riot API 실패와 재처리 안전성
4. 주요 사용자 흐름
5. 반응형·접근성·시각 품질

## 2. 필수 명령

`package.json`에는 다음 스크립트를 제공한다.

```json
{
  "scripts": {
    "lint": "...",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "...",
    "test:e2e": "playwright test",
    "build": "next build",
    "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
  }
}
```

실제 도구 선택에 따라 명령 본문은 조정하되 스크립트 이름은 유지한다.

## 3. 테스트 피라미드

### 3.1 단위 테스트

외부 IO 없이 빠르고 결정론적으로 검증한다.

- 점수 값 17~23 범위와 균등 분기 매핑
- commitment 생성·검증
- 승리/패배 signed delta
- 재추첨 차이값 계산
- 공동 순위 `1,1,3`
- Riot ID parse·정규화·표시
- KDA, KP, CS/min, damage/min 경계값
- z-score 및 `[-3,3]` winsorize
- MVP/ACE 가중치 합과 tie-break
- 미션 evaluator 100개
- 미션 후보 필터·미확인 우선·rerolled 후순위
- 보충 크레딧 계산(6시간, 최대 3)
- 1시간 리롤 쿨다운
- 주차 경계와 Asia/Seoul 시간 변환
- feature flag와 설정 파싱
- 관리자 adjustment validation

### 3.2 통합 테스트

실 PostgreSQL test database 또는 격리된 container DB를 사용한다.

- 회원가입 → 로그인 → 세션 조회 → 로그아웃
- 중복 loginId와 rate limit
- 참가 신청 생성 → Riot identity 검증 mock → 관리자 승인
- 승인 트랜잭션이 Participant/SeasonParticipant를 정확히 생성
- 동일 matchId 두 번 ingest해도 Match·ParticipantMatch가 한 번만 생성
- 동일 경기 scoring service 두 번 호출해도 ledger가 한 번만 반영
- sync lease 경쟁에서 한 작업만 소유
- 외부 API 호출 실패 후 재실행 시 안전 복구
- 첫 draw 정산과 reveal
- MVP/ACE reroll이 adjustment ledger 한 행만 생성
- mission assignment snapshot과 경기 시작 시점
- 누적 미션의 activation 이전 데이터 제외
- 동일 completion 재처리 방지
- 관리자 경기 무효화가 반전 원장을 생성
- read model 재구축 결과가 ledger 합계와 동일
- event finalization 후 mutable 동작 차단

### 3.3 계약 테스트

Riot adapter 경계를 fixture로 고정한다.

- Account-V1 success/not-found/rate-limit/expired-key
- Match ID list pagination
- Match info 정상·remake·unsupported queue·필드 누락
- Timeline 정상·누락·이벤트 순서 변형
- Rank/Summoner 응답 정규화
- Retry-After 파싱
- Data Dragon 캐시와 fallback

실제 Riot 응답 JSON을 저장할 때 개인정보와 API key를 제거한다. fixture 출처 패치와 수집일을 metadata에 기록한다.

### 3.4 E2E 테스트

Playwright에서 mobile과 desktop 프로젝트를 운영한다.

#### 공개 사용자

- 메인 TOP 5, 카운트다운, 순위표 링크
- 전체 순위 정렬과 sticky 열
- 참가자 상세와 최근 경기
- 규칙·확률·고지 확인
- 종료된 이벤트 history

#### 회원/참가자

- 가입·로그인
- Riot ID 참가 신청
- 승인 대기 상태
- 내 미션 5개와 정확한 진행도
- 포인트 봉인 공개
- MVP/ACE 재추첨 확인·최종 확정
- 이미 공개/사용한 결과의 재호출 안정성

#### 관리자

- 권한 없는 접근 403/redirect
- 신청 승인·거절
- 시즌/주차 생성과 시작 전 validation
- 수동 sync와 실행 로그
- 기준 데이터 업로드 dry-run·publish
- 점수 조정과 사유
- 미션 definition 버전 게시
- export 다운로드

## 4. 핵심 불변식 테스트

다음은 property-based 또는 반복 생성 테스트를 권장한다.

### I-001 점수 보존

각 참가자의 표시 점수는 활성 ledger delta의 합과 항상 같다.

### I-002 경기 유일성

동일 Riot match ID는 한 시즌에서 한 번만 정산된다.

### I-003 공개와 정산 분리

포인트를 공개하지 않아도 점수는 이미 반영되어 있다. 공개 여부는 순위를 바꾸지 않는다.

### I-004 재추첨 단일성

재추첨권 하나는 최대 한 번 소비되고, 두 번째 결과가 최종이며 원본 ledger를 수정하지 않는다.

### I-005 미션 시점

경기 시작 순간 활성화되어 있지 않은 미션은 해당 경기로 진행되지 않는다.

### I-006 완료 단일성

동일 assignment는 한 번만 완료되고 점수를 한 번만 지급한다.

### I-007 권한 격리

일반 사용자는 다른 사람의 비공개 상태나 admin mutation에 접근할 수 없다.

### I-008 결정론적 재구축

동일 raw match와 동일 evaluator/baseline version을 재처리하면 동일 결과가 나온다.

## 5. 점수 추첨 테스트 상세

- `crypto` 기반 샘플을 value로 변환하는 mapping에 modulo bias가 없어야 한다.
- 17,18,19,20,21,22,23 모두 생성 가능한 deterministic stub 테스트가 있어야 한다.
- 실제 RNG의 “통계적 공정성”을 CI의 flaky한 빈도 검정으로 판단하지 않는다.
- commitment에 drawId, value, nonce, version을 포함하고 순서가 고정되어야 한다.
- reveal 전 DTO에는 value/nonce가 없어야 한다.
- reveal API는 repeated request에 동일 응답을 반환한다.
- loss의 displayed magnitude와 signed ledger delta를 혼동하지 않는다.
- reroll 동일 값, 더 좋은 값, 더 나쁜 값 세 경우를 테스트한다.

## 6. 미션 evaluator 테스트

100개 정의 각각 최소 다음 fixture를 가진다.

- 성공
- 실패
- 정확한 경계
- 필수 필드 누락
- 지원하지 않는 큐
- remake/최소 시간 미만

Timeline evaluator는 timestamp 단위(ms)를 domain 초와 혼동하지 않는 테스트가 필요하다. 아이템 구매는 purchase/sell/undo 순서를 반영한다. distinct·누적 evaluator는 동일 경기를 다시 처리해도 증가하지 않아야 한다.

## 7. MVP/ACE 테스트

- 모든 그룹의 가중치 합 1.0
- 포지션별 추가 가중치 합 0.30
- 표준편차 0 또는 표본 부족 처리
- missing metric renormalization 또는 판정 보류 규칙
- winsorize 경계
- 팀별 최고 참가자 선택
- 참가자가 팀 최고가 아닌 경우 보상 없음
- 동점 tie-break 결정론
- `DEMO_ONLY` 기준에서 production 보상 차단
- 과거 경기 재조회 시 당시 baselineVersion 유지

## 8. 보안 테스트

- 비밀번호 hash가 평문과 다르고 Argon2id인지 확인
- session cookie의 HttpOnly/Secure/SameSite
- forged/expired JWT 거부
- CSRF 또는 origin 검증
- login/application/admin rate limit
- open redirect 차단
- SQL injection은 ORM만 믿지 않고 raw query 금지/파라미터화 검토
- XSS: Riot ID, 공지, 관리자 사유 출력 escape
- API key가 client bundle, HTML, source map, 로그에 없음
- CRON endpoint secret 없거나 틀리면 거부
- admin action AuditLog
- CSV injection 방지: export cell이 `= + - @`로 시작하면 안전 처리
- file upload 크기·MIME·schema 검증

## 9. 접근성 테스트

- 키보드만으로 전체 주요 흐름 가능
- visible focus
- 모달 focus trap과 ESC/close
- 추첨 연출 screen reader 상태 알림
- 색상만으로 승패·증감을 표현하지 않음
- `prefers-reduced-motion` 지원
- zoom 200%에서 주요 기능 유지
- 표 header/scope와 모바일 대체 구조
- icon-only button에 accessible name
- axe 기반 자동 점검 + 수동 점검

## 10. 반응형·시각 회귀 체크

권장 viewport:

- 390×844
- 768×1024
- 1280×800
- 1440×900
- 1920×1080

확인 사항:

- TOP 5와 카운트다운이 첫 화면에서 의미 있게 보이는가
- 순위·Riot ID sticky 열이 겹치지 않는가
- 가로 스크롤 그림자가 실제 스크롤 후에만 보이는가
- 긴 `gameName#tagLine`이 한 줄 규칙을 지키는가
- 5자리 이상 점수와 공동 순위가 깨지지 않는가
- 빈 상태와 loading skeleton이 layout shift를 과도하게 만들지 않는가
- 추첨 모달이 작은 화면에서 잘리지 않는가

## 11. 성능 예산

정확한 수치는 실제 배포에서 측정하되 다음을 기본 가드레일로 둔다.

- public dashboard는 불필요한 client component를 최소화
- TOP 5/leaderboard query는 explain으로 index 사용 확인
- 이미지 크기와 lazy loading
- 최초 화면에 전체 100개 미션 JS를 보내지 않음
- 관리자 표는 pagination/filter를 server-side로 수행
- sync endpoint는 한 번에 처리할 참가자 수에 상한
- N+1 query 탐지
- production build bundle 분석은 릴리스 전 최소 1회

## 12. CI 게이트

Pull request 또는 최종 감사 전 다음이 모두 성공해야 한다.

1. lockfile 일치 설치
2. lint
3. typecheck
4. unit tests
5. integration tests
6. build
7. 핵심 E2E smoke
8. migration drift check
9. secret scan

실패한 검증을 무시하도록 CI를 바꾸지 않는다. 예외가 필요하면 사유·만료일·추적 이슈를 기록한다.

## 13. 출시 전 수동 인수 시나리오

1. 테스트 시즌과 주차를 생성한다.
2. 관리자·참가자·일반 회원 계정을 준비한다.
3. 최소 3개 실제 Riot ID를 검증한다.
4. 이미 끝난 경기 fixture를 순서대로 ingest한다.
5. 모든 참가자의 점수 합과 ledger를 대조한다.
6. 첫 draw를 공개하고 commitment를 검증한다.
7. MVP/ACE 한 명의 재추첨을 실행한다.
8. 미션을 완료·리롤·보충하고 주차 시작 snapshot을 확인한다.
9. 동일 sync를 다시 호출해 변화가 없는지 확인한다.
10. 한 경기를 무효화하고 반전 내역을 확인한다.
11. 모바일에서 주요 흐름을 수행한다.
12. 이벤트 종료 후 final snapshot과 read-only 상태를 확인한다.

## 14. 완료 보고 형식

각 Codex 세션은 다음을 보고한다.

- 구현한 acceptance criteria
- 변경 파일
- 실행한 명령과 결과
- 추가한 테스트
- 실행하지 못한 테스트와 이유
- 남은 외부 의존성
- 발견한 데이터/정책 리스크
- 추천 Git commit message

---

<!-- SOURCE: docs/RUNBOOK.md -->

# 개발·배포·대회 운영 Runbook

## 1. 로컬 개발 준비

필수 도구:

- Git
- 현재 지원되는 Node.js LTS
- Corepack/pnpm
- PostgreSQL 또는 호환되는 개발 DB

권장 시작:

```bash
git init
corepack enable
pnpm install
cp .env.example .env.local
pnpm db:migrate
pnpm db:seed
pnpm dev
```

실제 스크립트가 만들어진 뒤 README와 이 문서를 동기화한다. Windows PowerShell 정책 문제로 pnpm script가 차단되면 시스템 전체 보안 설정을 낮추지 말고 현재 사용자 범위 또는 명령 프롬프트를 사용한다.

## 2. 환경 변수

`.env.example`에 이름과 설명만 넣고 실제 secret은 커밋하지 않는다.

```dotenv
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
CRON_SECRET=
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
NEXT_PUBLIC_POLL_INTERVAL_MS=20000
APP_URL=http://localhost:3000
APP_TIME_ZONE=Asia/Seoul
```

선택 변수는 architecture 문서에 추가하되 이름을 여러 방식으로 중복 정의하지 않는다. 앱 시작 시 환경 변수 schema validation을 실행하고 secret 값 자체는 오류에 출력하지 않는다.

## 3. 최초 관리자 생성

production에서 공개 회원가입만으로 ADMIN이 되게 하지 않는다. 다음 중 한 방식을 구현한다.

- 일회성 CLI `pnpm admin:create`
- 환경 변수에 지정한 loginId를 최초 deploy에서 한 번 승격하는 명시적 bootstrap

권장 방식은 CLI다. 생성 후 출력에는 임시 비밀번호를 반복 노출하지 않고 즉시 변경하도록 한다. 모든 후속 관리자 승격은 기존 ADMIN이 수행하고 AuditLog에 남긴다.

## 4. Mock 모드

`MOCK_RIOT_API=true`에서 다음 시나리오가 결정론적으로 제공되어야 한다.

- 정상 Riot ID
- 존재하지 않는 Riot ID
- API rate limit
- 만료된 key
- 솔로 랭크 승리/패배
- remake/무효 queue
- timeline 포함 경기
- MVP/ACE 동점
- 여러 미션 동시 완료
- 누적 미션 진행

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
- [ ] Competition Visibility Form(현황 양식) 제출 여부와 제출 증빙 기록
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

## 9. 동기화 운영

### 수동

관리자 `/admin/system`에서 대상 참가자 또는 전체 batch를 선택한다. 버튼 연타를 막고 동일 job에 대한 진행 상태를 표시한다.

### 예약

- 요청은 secret 검증 후 실행한다.
- `JobLease`로 동일 job의 동시 실행을 막는다.
- batch size와 time budget 안에서 처리한다.
- 남은 대상은 cursor로 다음 호출에 넘긴다.
- 각 `SyncRun`에 시작/종료, 처리 수, 신규 경기, 건너뜀, 오류 수를 기록한다.

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
4. 관리자 승인 후 correction/ reversal ledger를 추가한다.
5. 참가자에게 영향을 공개한다.

## 11. 점수 대사

`pnpm reconcile:scores` 또는 관리자 dry-run 도구는 다음을 비교한다.

- ParticipantWeek 표시 점수
- 유효 ScoreLedger 합
- 경기별 첫 draw와 reroll adjustment
- 무효화 reversal
- 관리자 adjustment

차이가 있으면 자동 덮어쓰기 전에 보고서를 생성한다. 수정은 idempotent reconciliation event로 수행한다.

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

## 14. 이벤트 종료

1. 종료 시각 이전 시작 경기의 grace period를 기다린다.
2. 마지막 전체 sync를 실행한다.
3. 실패 항목을 재처리한다.
4. score/mission reconciliation을 실행한다.
5. 관리자 확인 후 시즌 finalize를 실행한다.
6. FinalStandingSnapshot과 WeekSnapshot을 만든다.
7. 점수·미션 mutation을 차단한다.
8. 결과 CSV/JSON을 export한다.
9. 개인정보 보존 정책에 따라 raw data retention 일정을 기록한다.

finalize는 반복 호출해도 snapshot이 중복 생성되지 않아야 하며, unfinalize는 일반 UI에서 제공하지 않는다.

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

---

<!-- SOURCE: ALL_CODEX_PROMPTS.md -->

# 디럭스 솔랭 — Codex 프롬프트 모음

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
