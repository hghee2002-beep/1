# 세션 16 — 스케줄러, 준실시간 갱신, 관측성

동일한 idempotent sync service를 MANUAL, GITHUB_SCHEDULE, VERCEL_CRON, WORKER 모드에서 안전하게 호출할 운영 계층을 완성하라. 무료 환경의 제약을 숨기지 않고 경기 종료 후 수 분 내 반영을 목표로 한다.

## Scheduler endpoint

- `CRON_SECRET` 또는 HMAC 서명 검증
- method와 content type 제한
- replay 방지에 필요한 timestamp/nonce 정책(사용하는 모드에 맞춤)
- global/season job lease
- batch size/time budget/cursor
- 중복 호출 no-op 또는 안전 continuation
- 응답에 run ID, processed/new/skipped/failed/remaining만 제공
- secret/query payload 로그 redaction

## GitHub Actions

- 약 5분 간격의 예약 workflow 예시
- 최소 permissions
- repository secret 사용
- endpoint failure가 눈에 보이도록 exit code/summary
- manual dispatch 복구
- 예약 실행 지연 가능성을 README/운영 UI에 명시

## Vercel/Worker

- `vercel.json` 또는 현재 공식 방식의 Cron 설정은 선택된 플랜 제약과 일치
- Hobby에서 빈번한 Cron이 가능하다고 가정하지 않음
- worker adapter는 같은 service를 사용하고 별도 business logic 복제 금지
- serverless max duration을 넘기지 않게 continuation

## 화면 갱신

- public 데이터는 15~30초 polling 또는 framework revalidation
- tab hidden일 때 빈도 완화
- user mutation 후 즉시 해당 read model 갱신
- stale indicator와 마지막 성공 시각
- WebSocket/Redis를 필수 의존성으로 추가하지 않음

## 관측성

- structured logger와 correlation/run ID
- SyncRun metrics: duration, API calls, 2xx/404/429/5xx, new matches, processed, pending, failed
- draw/mission/MVP processing lag
- failed job/admin alert surface
- PII와 secret redaction
- provider-specific observability SDK는 선택 사항이며 core interface를 오염시키지 않음

## 복구 도구

- retry failed run item
- participant/season resync
- unprocessed match backfill
- score/mission reconciliation dry-run
- automatic reveal backlog
- stale lease recovery with safety window

## 테스트

- missing/wrong secret
- concurrent scheduler request
- timeout continuation
- partial failure/retry
- 429 backoff metadata
- stale lease
- same endpoint across modes
- polling visibility behavior
- log redaction

## 인수 조건

- 예약 호출이 겹치거나 누락되어도 데이터가 이중 반영되지 않는다.
- 운영자는 마지막 성공과 실패 원인을 사이트에서 확인할 수 있다.
- 무료 운영과 안정 운영 모드의 차이가 README/RUNBOOK에 정확히 설명된다.

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
