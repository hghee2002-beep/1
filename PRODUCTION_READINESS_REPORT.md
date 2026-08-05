# Production Readiness Report

- 감사 기준 시각: 2026-08-05, Asia/Seoul
- 대상: 디럭스 솔랭 Next.js/PostgreSQL 저장소
- 범위: 코드, route, DB schema/migration, Mock·실 API 최소 검증, 단위·통합·E2E, build 산출물, 운영 문서
- 비범위: 외부 배포, production DB 변경, 유료 리소스 생성, production secret 교체

## 최종 판정: `CONDITIONALLY_READY`

저장소 내부의 release candidate는 **READY**다. 이번 감사에서 발견한 저장소 내부 Critical/High 결함은 수정했고, 최종 lint·typecheck·491개 단위 테스트·84개 격리 DB 통합 테스트·39개 브라우저 테스트·production build가 통과했다. 빈 DB에서 8개 migration과 production-safe 미션 bootstrap, schema drift 없음도 확인했다.

실제 공개 launch는 **NOT READY / BLOCKED**다. production Riot 제품 승인·키와 도메인, 실제 참가자 검증, production 법적 문서, production DB·backup/restore, scheduler plan 실증, 게시된 non-demo MVP/ACE baseline이 아직 외부 증빙으로 제공되지 않았다. 따라서 이 판정은 “코드를 배포할 수 있는 후보”와 “대회를 공개 운영해도 됨”을 분리한다.

| 영역                  | 판정    | 핵심 증거                                                                 |
| --------------------- | ------- | ------------------------------------------------------------------------- |
| 코드·보안 경계        | Ready   | lint/typecheck, server-only 경계, route auth/origin/rate-limit 테스트     |
| 점수·경기·미션 무결성 | Ready   | append-only 원장, 경기별 reconciliation, DB trigger, 84 integration tests |
| 반응형·접근성         | Ready   | 390/768/1440 overflow, reduced motion, axe, keyboard, Windows baseline    |
| migration             | Ready   | 빈 schema에 8개 deploy, bootstrap 100/0, drift 없음                       |
| Mock 운영 흐름        | Ready   | 7개 E2E 파일, 39 pass                                                     |
| 실 Riot 연동          | 제한적  | ASIA Account-V1 read-only 404만 확인; production 승인·실계정은 미확인     |
| 실제 공개 운영        | Blocked | 아래 외부 launch blocker 미충족                                           |

## 이번 감사에서 수정한 주요 결함

### 데이터·정산

- 시즌 finalize가 `SEALED` draw, 활성 sync lease/run, pending match/outbox, 경기별 원장 결함을 모두 차단하도록 시즌 잠금과 동일 transaction reconciliation을 추가했다.
- 인정·처리 완료 경기마다 PointDraw, 승패 부호, `MATCH_INITIAL` 1건, reroll adjustment, 무효화·복구 cycle, `ParticipantMatch.pointSignedCached`를 대사한다. cache만 복구 가능하고 권위 데이터 결함은 `unresolved`로 남긴다.
- 종료 시즌의 SeasonMatch, ParticipantMatch, PointDraw, 미션 snapshot/assignment, MvpEvaluation, ParticipantWeek 파생 쓰기를 DB trigger로 차단했다.
- PointDraw의 FIRST 봉인 증거와 완료된 SECOND/final 증거를 immutable하게 보호했다.
- sync가 외부 호출 뒤 오래된 시즌 상태로 ingest하지 못하도록 write transaction에서 Season/Week를 다시 잠그고 ACTIVE를 확인한다.
- `FIXED_20`은 `fixed-20-v1`, 20점 100% proof를 사용하고 새 원장 metadata에 실제 point mode를 남긴다. 기존 random 결과는 rewrite하지 않는다.

### MVP/ACE·미션

- MVP/ACE pending 평가가 남으면 outbox를 성공 처리하지 않고 재시도 상태를 유지한다. 실패 복구 시 실제 attempts와 원 오류를 보존한다.
- evaluator 결과 fingerprint와 append-only supersede를 도입하고, 새 결과가 나오면 미사용 entitlement는 교체·회수하되 이미 소비한 과거 reroll은 감사 이력과 함께 보존한다.
- 새 주차는 `PUBLISHED` baseline만 선택한다. 이미 Week에 고정된 immutable `PUBLISHED`/`RETIRED` baseline은 재평가·복구에 계속 사용한다.
- baseline readiness는 320행 coverage, `stdDev > 0`, `sampleSize >= 30`, DEMO_ONLY 여부를 검사한다.
- 미션 효과가 있는 경기 무효화는 범용 correction/rebuild가 준비될 때까지 `SCORING_CONFLICT`로 fail-closed한다.

### 계정·route·운영

- 비밀번호 변경은 Argon2id 재해시, 모든 세션 폐기, AuditLog를 하나의 안전한 흐름으로 처리한다.
- 승인 참가자의 Riot ID 갱신은 외부 Account 호출을 transaction 밖에서 수행하고 기존 PUUID와 정확히 같을 때만 표시 ID를 갱신한다. REMOVED 참가자는 거부하고 PAUSED는 허용한다.
- login/application/admin/sync/draw/mission route의 auth, Origin, schema validation, DB-backed rate limit, 일반화된 오류 응답을 재검증했다.
- scheduler transport는 mode별 GET/POST/body 계약과 Bearer secret을 확인하고 job audit를 남긴다.
- `/matches`에 필터, 상세, 검증된 point proof를 제공하되 raw payload·PUUID·보호 nonce는 공개하지 않는다.

### UI·회귀 안정성

- compact 경기행에서 템플릿에 없는 KDA grid item을 제거해 768/1440 implicit track과 가로 overflow를 없앴다.
- leaderboard의 큰 내부 표는 `.table-scroll` 안에서만 가로 스크롤하고 document 폭으로 새지 않게 했다.
- 390px 첫 viewport에서 카운트다운, TOP 5, 전체 순위 링크가 모두 들어오도록 여백을 조정했다.
- 상세 토글 테스트는 동적으로 변하는 접근명으로 다른 버튼을 재대상화하지 않도록 stable locator를 사용하고 `펼치기 → 접기`, `aria-expanded`, `aria-controls`를 검증한다.
- “오늘 최다 경기” 동률을 random UUID가 아니라 normalized `gameName#tagLine`으로 정렬해 visual baseline을 결정적으로 만들었다.

## 핵심 사용자 시나리오 추적

| 시나리오                                           | 코드·DB 경계                                                              | 자동 증거                                          | 결과 |
| -------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- | ---- |
| 회원가입 → 참가 신청 → 관리자 승인                 | LegalConsent, PENDING unique, PUUID/Participant unique, admin RBAC        | auth/application unit·integration·E2E              | Pass |
| 시즌 시작 validation → 주차 시작                   | admin readiness, mission catalog, baseline 상태                           | admin-console integration                          | Pass |
| 같은 경기 반복·동시 sync                           | SeasonMatch unique, JobLease, invocation, write-time ACTIVE 재검증        | match-sync integration 17 tests                    | Pass |
| 승패 17~23 draw 정산 → 공개                        | crypto rejection sampling, commitment, MATCH_INITIAL, read-only reveal    | scoring unit/integration, draw E2E                 | Pass |
| MVP/ACE entitlement → 1회 reroll                   | evaluator fingerprint, pending recovery, entitlement consume/replace      | MVP unit, match-sync/scoring integration, draw E2E | Pass |
| 미션 5개 → 경기 중 reroll snapshot → 완료 → refill | assignment snapshot, evaluator version unique, progress/completion ledger | mission unit/integration 12 tests                  | Pass |
| 공동 순위 `1,1,3`                                  | competition rank + normalized Riot ID display order                       | ranking unit, dashboard integration/E2E            | Pass |
| admin adjustment·경기 무효화·복구                  | append-only adjustment/reversal/reinstatement, AuditLog                   | scoring/admin integration                          | Pass |
| scheduler 실패·재시도·복구                         | mode transport, attempts, retry/backoff, outbox state                     | scheduler unit, match-sync integration             | Pass |
| 시즌 finalize·history snapshot                     | season lock, sealed/sync/reconciliation blockers, immutable snapshots     | admin/database integration                         | Pass |

## Severity별 상태

### Critical

- 열린 항목: **0**

### High

- 열린 저장소 내부 항목: **0**
- 이번 감사에서 해결: production seed fail-closed, 종료/sync 경합, 봉인·원장별 finalize 차단, PointDraw 증거 immutable, 종료 범위 DB fence, MVP pending/outbox와 evaluator supersede, 계정 변경·Riot PUUID 경계.

### Medium — 미해결 또는 외부 조건

1. **Production Riot 제품 승인·실계정 연동**: 형식상 유효한 로컬 키로 ASIA Account-V1 단일 read-only 요청이 예상 404를 반환했다. 그러나 development credential일 수 있으며 production product 승인, 실제 Riot ID 3개, Match-V5·League/Summoner, 429 운영은 검증하지 못했다. Riot은 공개 제품에 등록된 production 자격 증명과 정책 준수를 요구한다. [Riot LoL 개발 문서](https://developer.riotgames.com/docs/lol), [Riot API 약관](https://developer.riotgames.com/terms)
2. **법률·정책**: production 이용약관·개인정보 문구·보존 기간·문의 경로와 국내 chance-based 점수 검토가 미확정이다. 불명확하면 `FIXED_20`을 사용해야 한다.
3. **Production DB**: provider, pooled/direct 권한 분리, backup/restore rehearsal, staging snapshot migration dry-run이 없다.
4. **Scheduler/hosting**: GitHub Actions, Vercel Pro Cron 또는 worker 중 실제 방식을 선택하고 지연·중복·실패 복구를 staging에서 증명해야 한다. Vercel Cron은 실패 자동 재시도가 없고 중복 호출 가능성을 고려해야 한다. [Vercel Cron 운영 문서](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [GitHub scheduled workflow 문서](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
5. **Non-demo MVP baseline**: 실제 출처·표본·320행 coverage를 가진 게시본이 없다. DEMO_ONLY는 production 보상을 지급하지 않는다.
6. **미션 효과 경기 무효화**: 안전을 위해 현재 차단한다. 범용 append-only correction/rebuild workflow가 후속 작업이다.
7. **CSP**: 현재 Next bootstrap/global style 호환을 위해 `unsafe-inline`이 남아 있다. nonce/hash CSP는 별도 hardening이 필요하다.
8. **릴리스 이력**: Git 저장소에 HEAD/기준 commit이 없고 모든 파일이 untracked다. 정확한 최근 diff·review·rollback artifact를 만들 수 없으므로 첫 기준 commit과 branch protection이 배포 전 필요하다.

### Low

- `pg` 8.22에서 pg 9가 제거할 concurrent `client.query()` 동작 deprecation warning이 통합/E2E teardown 중 관찰됐다. 현재 테스트는 통과하지만 pg 9 전환 전에 정리해야 한다.
- E2E 서버 종료 중 `The destination stream closed early`가 한 번 출력됐으나 해당 테스트와 전체 run은 통과했고 listener/schema는 정리됐다.
- OneDrive workspace에서 Next가 느린 filesystem 경고를 냈다. CI/release 성능 측정은 로컬 SSD workspace를 권장한다.
- `public/og.png` 약 1.7 MiB는 초기 JS bundle에는 없지만 CDN 전송 최적화 후보다.
- `pnpm outdated`는 production dependency 차이를 보고하지 않았고 dev major인 ESLint 10, TypeScript 7만 보고했다. 별도 upgrade change에서 다룬다.
- 로컬 test DB의 기존 public schema는 과거 적용 뒤 편집된 migration checksum을 가질 수 있어 감사 증거로 사용하지 않았다. 모든 최종 DB 증거는 새 임시 schema에서 만들고 제거했다.

## 최종 명령과 결과

| 명령·검사                                                       | 최종 결과                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`                                | Pass — lockfile 변경 없이 already up to date                        |
| `pnpm audit --prod --audit-level high`                          | Pass — 알려진 production 취약점 0                                   |
| `pnpm audit --audit-level high`                                 | Pass — 알려진 전체 취약점 0                                         |
| `pnpm db:generate`                                              | Pass — Prisma Client 7.9.1 생성                                     |
| `pnpm exec prisma validate`                                     | Pass                                                                |
| `pnpm format:check`                                             | Pass                                                                |
| `pnpm lint`                                                     | Pass — ESLint + client/server env boundary                          |
| `pnpm typecheck`                                                | Pass — `tsc --noEmit`                                               |
| `pnpm test`                                                     | Pass — 39 files, 491 tests                                          |
| `pnpm test:env-startup`                                         | Pass — invalid field만 안전하게 보고                                |
| `.env.local`을 process env로 주입 후 `pnpm test:integration`    | Pass — 10 files, 84 tests, 파일별 fresh schema                      |
| `.env.local`을 process env로 주입 후 `pnpm test:e2e`            | Pass — 7 files, 39 passed, 17 intentional project/viewport skips    |
| `pnpm build`                                                    | Pass — Next 16.3 optimized build, static generation 35/35           |
| `pnpm check`                                                    | Pass — lint → typecheck → 491 unit tests → build 연속 실행          |
| production `next start -p 32145` + `GET /api/health`            | Pass — HTTP 200, `status=ok`; listener 종료 확인                    |
| actual local secret 값으로 `.next/static`·`.next/server` 역검색 | Pass — 노출 key 0                                                   |
| high-confidence source key/private-key pattern scan             | Pass — 0                                                            |
| TODO/FIXME/TS ignore/ESLint disable scan                        | Pass — source marker·ignore 0                                       |
| `pnpm outdated`                                                 | Informational exit 1 — ESLint 9→10, TypeScript 6→7 dev major만 존재 |
| `git rev-parse --verify HEAD`, `git log -1`                     | Expected fail — 아직 commit이 없음                                  |

### 감사 중 실패와 수정 이력

실패를 최종 성공으로 숨기지 않았다.

1. 첫 전체 integration은 새 PointDraw immutable trigger가 기존 대시보드 테스트의 직접 증거 변조를 거부해 1건 실패했다. 제품 보호가 맞으므로 테스트를 “변조 update 거부 + proof 유지” 계약으로 바꿨고 최종 84/84가 통과했다.
2. 첫 E2E는 2건이 로그인 화면에 남았다. seed가 `SEED_PASSWORD`를 사용하지만 4개 spec이 기본 비밀번호를 하드코딩한 것이 원인이었다. 모든 fixture login이 환경 계약을 따르게 수정했다.
3. 다음 E2E는 반응형 5건이 실패했다. compact KDA implicit grid, 768 표 leakage, 390 subpixel 경계, 동적 accessible-name locator를 각각 수정했다. 반응형 파일 최종 10/10 통과다.
4. visual baseline 2건은 승인된 UI 변화로 갱신했으나 desktop이 다시 달라져 UUID 동률 정렬 비결정성을 발견했다. normalized Riot ID tie-break와 단위 테스트를 추가한 뒤 update 없이 전체 E2E가 통과했다.
5. 초기 `format:check`는 19개 drift를 보고했다. 전체 `pnpm format` 후 최종 check가 통과했다.
6. 환경 변수 없는 production build 시도는 env validation에서 fail-closed됐다. 로컬 synthetic production 환경을 주입한 최종 build와 start smoke는 통과했다.

## Migration·bootstrap·rollback

### Fresh schema 증거

production DB 대신 DB 이름에 독립된 `test` 구간이 있는 로컬 DB에 무작위 `production_audit_*` schema를 만들었다.

1. `pnpm db:preflight:migrations`: 빈 DB 경로 Pass.
2. `pnpm db:migrate:deploy`: 8개 migration 순차 적용 Pass.
3. `pnpm exec prisma migrate status`: up to date.
4. `NODE_ENV=production pnpm db:bootstrap:missions`: verified 100, created 100.
5. 같은 bootstrap 재실행: verified 100, created 0.
6. 업무 데이터 검사: User 0, Season 0, Match 0, LegalDocument 0, MvpBaselineVersion 0.
7. post-migration preflight: Pass.
8. `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`: no difference.
9. 정확히 해당 임시 schema만 drop했다.

최신 migration은 `20260806030000_production_invariant_hardening`이며 production에서는 `migrate dev`, `db push`, `migrate reset`, `db:seed`를 사용하지 않는다.

### 배포 순서

```text
1. scheduler를 중지하고 SYNC_MODE=MANUAL을 확인
2. provider backup/snapshot과 restore 절차 확인
3. pnpm db:preflight:migrations
4. pnpm exec prisma migrate status
5. pnpm db:migrate:deploy
6. pnpm db:bootstrap:missions
7. pnpm exec prisma migrate status
8. staging에서 readiness·reconciliation·health·실 Riot read-only dry run
9. 수동 sync 1 batch → scoring → mission 순서 확인
10. 승인된 scheduler를 켜고 backlog/freshness 감시
```

### Rollback

- migration은 forward-only다. down migration으로 append-only 원장·draw·mission·audit 데이터를 지우거나 수정하지 않는다.
- 장애 시 scheduler를 먼저 중지하고 application rollback 호환성을 검토한 뒤 forward-fix를 우선한다.
- 데이터 손상이라면 배포 전 snapshot을 별도 DB에 복구하고 reconciliation 결과를 비교한다. production 원본에 즉시 destructive restore하지 않는다.
- 즉시 중지 기준: 점수 이중 반영, 권한 상승, PII/secret 노출, 광범위 미션 오판정, AuditLog 누락, migration 손상.

## 외부 launch blocker

아래가 모두 증빙되기 전 공개 운영은 NO-GO다.

- [ ] Riot Developer Portal production 제품 승인, production key, production domain 소유 확인
- [ ] `MOCK_RIOT_API=false` staging에서 실제 Riot ID 최소 3개로 Account/Match/League/Summoner 경계 검증
- [ ] 실제 참가자 최소 20명 roster, 동의, 승인, PUUID 연결 확인
- [ ] production 이용약관·개인정보·대회 규칙·비공식 제품 고지 게시와 LegalConsent version 확인
- [ ] chance-based 점수의 정책·국내 적용 검토; 미확정이면 `FIXED_20` 승인 기록
- [ ] production PostgreSQL provider, pooled/direct URL 권한 분리, backup/restore rehearsal
- [ ] 실제 domain/HTTPS/Origin/cookie/HSTS 확인
- [ ] GitHub Actions, Vercel Pro Cron 또는 worker plan 결정과 staging 실패·중복·수동 복구 실증
- [ ] 출처와 checksum이 검증된 non-demo MVP/ACE baseline 320행 dry-run·publish
- [ ] 환경별로 독립된 AUTH/CRON/POINT_DRAW/DB secret 주입과 rotation·비상 복구 책임자 지정
- [ ] 기준 commit, review, branch protection, 배포 artifact 식별자 확보

## `FIXED_20` 비상 전환과 sync 중지

1. GitHub workflow/Vercel Cron/worker를 중지하고 `SYNC_MODE=MANUAL`을 배포한다. scheduler route의 `409 SCHEDULER_DISABLED`를 확인한다.
2. 활성 JobLease와 최근 RUNNING SyncRun이 없고 pending outbox를 분류했는지 확인한다. 기존 draw·ledger를 삭제하거나 다시 생성하지 않는다.
3. 운영 결정·적용 시각·사유를 규칙 버전과 공지에 기록하고 관리자 `FEATURE_FLAG_UPDATE`로 `scoring.fixed20Fallback=true`를 적용한다.
4. 관리자 경로를 쓸 수 없는 비상 상황에만 `POINT_MODE=FIXED_20`으로 재배포한다.
5. `/rules`의 유효 모드, staging win `+20`/loss `-20`, `fixed-20-v1` proof, commitment/reveal, ledger 대사를 확인한다.
6. 전환 후 새로 정산되는 경기부터 20점을 적용한다. 이전 random draw·원장은 보존한다.
7. sync → scoring → missions 순서로 scheduler를 재개하고 backlog·freshness·reconciliation을 감시한다.

## 운영 첫날 체크리스트

- [ ] 배포 artifact/commit, migration 8개 status, backup snapshot ID 기록
- [ ] `/api/health` 200과 mode/config의 비밀 비노출 확인
- [ ] production `/rules`, 법적 문서 version, footer 비공식 고지 확인
- [ ] 첫 실제 참가자 3명의 Account/Match/League/Summoner routing과 PUUID 확인
- [ ] 첫 수동 sync에서 신규 경기 수, duplicate skip, 401/403/404/429/5xx와 `Retry-After` 확인
- [ ] 첫 인정 경기의 PointDraw, `MATCH_INITIAL`, ParticipantWeek 점수·승패·순위 대사
- [ ] reveal 반복 호출이 같은 결과이고 공개 전 nonce/value가 응답·로그에 없는지 확인
- [ ] MVP/ACE pending/completed, baseline version, entitlement와 1회 reroll 확인
- [ ] 미션 assignment 5개, snapshot, progress/completion/refill과 pending timeline 확인
- [ ] scheduler의 invocation key, lease, duration, oldest pending lag, 수동 재실행 확인
- [ ] 매시간 score/mission reconciliation dry-run과 공개 freshness 확인
- [ ] 종료 전 SEALED draw·RUNNING sync·pending outbox 0을 확인하고 finalize rehearsal
- [ ] 첫날 종료 backup과 운영 사건·수동 adjustment AuditLog 검토

## 주요 변경 파일

저장소에 HEAD가 없어 정확한 `git diff` 파일 목록은 만들 수 없다. 아래는 이번 감사에서 직접 수정·검증한 주요 범위다.

- DB: `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/seed-safety.ts`, `prisma/migrations/20260806030000_production_invariant_hardening/migration.sql`
- 정산·종료: `src/domain/scoring/*`, `src/server/scoring/*`, `src/server/admin/service.ts`, `src/server/sync/ingest.ts`, `src/server/sync/service.ts`
- MVP·미션: `src/domain/mvp/contract.ts`, `src/server/mvp/evaluation-service.ts`, `src/server/missions/*`, `src/features/admin/season-readiness.ts`
- 계정·보안: `src/server/account/*`, `src/app/api/account/*`, `src/server/rate-limit/database.ts`, auth/admin/scheduler route·job audit 파일
- 공개 UI: `/rules`, `/matches`, 계정 설정, point proof, `src/components/matches/match-table.tsx`, `src/styles/globals.css`, dashboard read/highlights
- 테스트: 39 unit 파일, 10 integration 파일, 7 E2E 파일과 Windows visual snapshots
- 문서: `README.md`, `docs/DECISIONS.md`, `docs/RUNBOOK.md`, `docs/RISK_REGISTER.md`, `RELEASE_CHECKLIST.md`, 이 보고서

## 최종 결론

코드와 로컬 격리 DB 기준으로는 배포 후보가 준비됐다. 공개 launch는 외부 blocker를 채운 뒤 위 배포 순서와 실제 계정 dry run을 다시 수행해야 한다. 가장 안전한 초기 운영 선택은 `SYNC_MODE=MANUAL`과, 정책 검토가 끝나지 않았다면 `FIXED_20`이다.
