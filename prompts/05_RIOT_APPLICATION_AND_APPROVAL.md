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
