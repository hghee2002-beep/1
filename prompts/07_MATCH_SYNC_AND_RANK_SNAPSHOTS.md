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
