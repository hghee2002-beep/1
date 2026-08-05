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
