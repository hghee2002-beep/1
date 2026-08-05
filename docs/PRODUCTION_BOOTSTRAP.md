# Production database bootstrap

빈 운영 PostgreSQL 데이터베이스에는 개발 seed를 실행하지 않는다. 승인된 migration을 적용한 뒤 다음 production-safe 명령으로 M001~M100 v1 정의만 설치한다.

```powershell
pnpm db:preflight:migrations
pnpm db:migrate:deploy
pnpm db:bootstrap:missions
pnpm admin:create -- --login-id deluxe.admin --display-name "운영 관리자"
```

`db:preflight:migrations`는 read-only 검사다. 과거 `MvpEvaluation` 행 중 `participantMatchId`가 없는 행은 기존 MVP migration의 `evaluationKey/status` backfill에서 빠져 `NOT NULL` 단계가 실패하므로, 개수와 season mapping 모호성을 보고하고 deploy 전에 중단한다. 이 경우 backup을 유지한 채 별도 검토된 pre-migration data remediation을 적용해야 하며, 여러 시즌 중 하나를 임의 선택하지 않는다.

`db:bootstrap:missions`는 `docs/MISSION_CATALOG.md`와 런타임 evaluator registry를 함께 검증하고, 누락된 v1 정의만 transaction 안에서 생성한다. 사용자, 시즌, 경기, 점수, DEMO_ONLY baseline 또는 기본 비밀번호는 만들지 않는다. 동일 내용으로 재실행하면 no-op이며, 기존 v1 내용이 catalog와 다르면 과거 버전을 덮어쓰지 않고 실패한다.

개발 fixture가 필요한 로컬·테스트 데이터베이스에서만 `NODE_ENV=development` 또는 `NODE_ENV=test`를 명시해 `pnpm db:seed`를 실행한다. 값이 없거나 staging/production인 경우 seed는 mutation 전에 실패한다.
