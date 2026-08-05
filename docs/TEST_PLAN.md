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
    "test:integration": "node scripts/run-integration-tests.mjs",
    "test:e2e": "node scripts/run-e2e-tests.mjs",
    "build": "next build",
    "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
  }
}
```

실제 도구 선택에 따라 명령 본문은 조정하되 스크립트 이름은 유지한다.

통합·E2E runner는 `TEST_DATABASE_URL` 또는 `E2E_DATABASE_URL`이 일반 `DATABASE_URL`과 다르고 DB 이름에 독립된 `test` 구간이 있을 때만 실행한다. 각 spec 파일마다 임시 PostgreSQL schema를 만들고 migration·seed부터 검증한 뒤 해당 schema만 삭제한다. 공용 test schema를 reset하거나 이전 spec의 mutation에 의존하지 않는다. 특정 E2E 파일은 `pnpm test:e2e -- tests/e2e/<file>.spec.ts`로 재현한다.

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
- 미션 진행 event가 있는 경기는 범용 rebuild 전까지 무효화를 mutation 없이 차단
- read model 재구축 결과가 ledger 합계와 동일
- 메인·미션 completion 원장과 cache가 불일치하면 finalization 차단
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
- 정확히 5명 전원이 완료되지 않은 팀은 award·entitlement 없음
- 동일 evaluation/outbox 재처리 시 평가 행·MVP/ACE 횟수·entitlement 중복 없음
- CSV/JSON 320행 coverage, checksum 재검증, 게시 baseline·평가 append-only DB 보호

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
