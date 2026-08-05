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
