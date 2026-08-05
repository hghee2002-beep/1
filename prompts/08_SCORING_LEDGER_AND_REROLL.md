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
