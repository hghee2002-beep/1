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
