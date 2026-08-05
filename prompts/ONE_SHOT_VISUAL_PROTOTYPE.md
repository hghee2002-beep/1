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
