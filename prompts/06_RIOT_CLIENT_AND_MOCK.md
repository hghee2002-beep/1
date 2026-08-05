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
