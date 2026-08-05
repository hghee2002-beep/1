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
