# 디럭스 솔랭 릴리스 체크리스트

기준일: 2026-08-05 (Asia/Seoul)  
범위: 보안·데이터 무결성·접근성·성능·migration·운영 준비 감사

## 1. 릴리스 판정

| 판정                   | 상태                       | 근거                                                                                                                                                                |
| ---------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 코드 release candidate | 조건부 GO                  | 열린 Critical/High 보안·데이터 무결성 결함은 없다. 최종 자동 게이트 결과는 아래에 기록한다.                                                                         |
| 실제 운영 공개         | **NO-GO / LAUNCH BLOCKED** | Riot production 제품 등록·키, 실제 20명 roster, 게시된 non-demo MVP/ACE baseline, production 법적 문서·비공식 고지, staging/backup/스케줄러 증빙이 제공되지 않았다. |

Mock·`DEMO_ONLY` seed 성공은 실제 Riot 연동이나 production 운영 승인을 의미하지 않는다. 아래 launch blocker를 모두 증빙하기 전에는 공개 배포하지 않는다.

### 필수 launch blocker

- [ ] Riot Developer Portal에서 이 제품을 등록하고 운영 범위에 맞는 production key와 도메인 소유권 검증을 완료했다.
- [ ] `MOCK_RIOT_API=false`와 production key로 Account-V1, Match-V5, League/Summoner 경계를 staging에서 확인했다.
- [ ] 실제 참가자 최소 20명과 최소 3개 실제 Riot ID로 routing·동의·승인 흐름을 검증했다.
- [ ] 320행 coverage와 표본 조건을 충족한 **non-demo** MVP/ACE baseline을 dry-run 후 게시했다.
- [ ] 이용약관·개인정보·대회 규칙·Riot 비공식 제품 고지를 production 문서로 교체했다.
- [ ] production DB backup/restore, connection pooling과 migration 권한 분리를 확인했다.
- [ ] 실제 scheduler 방식과 plan 한도, 중복 호출, 실패 복구, 수동 재실행 증빙을 남겼다.
- [ ] `AUTH_SECRET`, `CRON_SECRET`, `POINT_DRAW_SECRET`, DB 자격 증명을 서로 독립된 production secret으로 주입했다.
- [ ] chance-based 점수의 정책·국내 적용 검토를 기록했다. 불명확하면 `FIXED_20` 절차를 적용했다.

## 2. 감사 발견 사항

Severity는 악용 가능성뿐 아니라 점수·스냅샷을 잘못 확정할 수 있는 운영 영향도 포함한다.

| Severity | 발견 사항과 exploit/failure path                                                                                             | 조치                                                                                                  | 상태                          |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------- |
| High     | production에서 `pnpm db:seed`를 실행하면 문서화된 개발 계정·DEMO_ONLY 데이터가 운영 DB에 들어갈 수 있었다.                   | production은 override 없이 항상 거부하는 독립 seed guard와 단위 테스트를 추가했다.                    | Fixed                         |
| High     | `MissionCompletionLedger` 합과 `missionScoreCached`가 달라도 시즌 finalize가 스냅샷을 확정할 수 있었다.                      | finalize transaction이 메인·미션 원장 합을 모두 대사하고 불일치 시 mutation 전에 차단한다.            | Fixed                         |
| High     | 봉인 draw 또는 활성 sync lease/run이 남아 있거나 종료와 ingest가 경합해도 시즌 finalize가 진행될 수 있었다.                  | 시즌 행 잠금, sync 재검증, SEALED/lease/run blocker와 종료 범위 DB write fence를 추가했다.            | Fixed                         |
| High     | 주차 총점 합만 맞으면 경기별 draw·initial·reroll·무효화/복구 원장 결함을 finalize가 놓칠 수 있었다.                          | 경기별 권위 데이터 reconciliation과 cache-only repair를 구현하고 unresolved 결함은 차단한다.          | Fixed                         |
| High     | PointDraw의 최초 봉인 증거와 reroll 최종 증거를 직접 수정하거나 종료 시즌 파생 데이터를 변경할 DB 경계가 불완전했다.         | 증거 immutable trigger, 원본/주차 membership 검증, 종료 범위 INSERT/UPDATE/DELETE fence를 추가했다.   | Fixed                         |
| High     | MVP/ACE pending 평가가 남아도 outbox가 성공 처리되거나 재평가 version·baseline 교체 시 entitlement가 잘못 유지될 수 있었다.  | 실제 attempts 복구, pending outbox 유지, 결과 fingerprint·supersede·entitlement 교체 규칙을 고정했다. | Fixed                         |
| High     | 미션 진행을 만든 경기를 일반 무효화하면 메인 점수만 reversal되고 mission event/completion이 남을 수 있었다.                  | `MissionProgressEvent`가 있으면 `SCORING_CONFLICT`로 fail-closed한다.                                 | Fixed; 운영 제한은 D-032 참고 |
| High     | PostgreSQL 18 + Prisma adapter에서 `pg_advisory_xact_lock()`의 `void` 결과 역직렬화가 관리자 operation을 실패시킬 수 있었다. | advisory lock query가 직렬화 가능한 integer를 반환하도록 변경했다.                                    | Fixed                         |
| Medium   | JSON request body가 무제한으로 메모리에 적재되어 인증·관리자 endpoint에 memory DoS가 가능했다.                               | content-length와 실제 stream을 모두 1 MiB로 제한하고 malformed/non-JSON을 거부한다.                   | Fixed                         |
| Medium   | 전역 CSP·frame·MIME·referrer·permissions·HSTS 방어 헤더가 없었다.                                                            | Next 전역 security headers와 production HSTS, E2E header 검증을 추가했다.                             | Fixed                         |
| Medium   | CSV 셀 앞의 공백·개행·BOM 뒤에 `=`, `+`, `-`, `@`를 두면 spreadsheet formula로 해석될 수 있었다.                             | leading invisible/whitespace를 포함해 formula prefix를 중화하고 테스트했다.                           | Fixed                         |
| Medium   | 통합/E2E spec이 공용 test schema를 변형해 순서 의존·스냅샷 오염·재실행 실패를 만들었다.                                      | spec별 임시 schema에서 migration+seed+test 후 해당 schema만 삭제한다.                                 | Fixed                         |
| Low      | 완전 공동 순위 표시가 random UUID에 의존해 새 DB마다 TOP 5·미션 동률 행 순서가 달랐다.                                       | competition rank는 유지하고 normalized Riot ID로 표시 순서를 안정화했다.                              | Fixed                         |
| Low      | 키보드/스크린리더에서 최근 전적·챔피언 표식, 정의 목록, progressbar, 스크롤 표 semantics가 불완전했다.                       | accessible name/role, 올바른 `dl`, progressbar 값, focusable scroll region, axe 검사를 추가했다.      | Fixed                         |

열린 Critical: **0**  
열린 High: **0**

### 보안 제어 확인

- Argon2id: `memoryCost=19456`, `timeCost=2`, `parallelism=1`, 32-byte hash.
- JWT: HS256 allowlist, `sub/role/jti/iat/exp` 최소 claim, DB의 jti hash·revocation·expiry·role·sessionVersion 재검증.
- Cookie: HttpOnly, SameSite=Lax, production Secure, 일반 12시간/기억 30일.
- RBAC: admin layout 표시가 아니라 각 mutation route/service에서 server-side 재검증.
- CSRF: 상태 변경 요청은 `APP_URL`과 정확히 같은 Origin만 허용.
- Brute force: login IP+ID 및 ID window, signup/application/admin/sync/draw/mission rate limit.
- Redirect: 내부 상대 경로 allowlist만 허용.
- Secret/PII: server-only env, client-boundary 검사, 구조화 로그 key redaction, nonce·PUUID·실명·Riot ID·payload 비기록.
- 파일 입력: baseline은 브라우저 파일 경로를 서버에 전달하지 않고 bounded JSON payload로 보내며 MIME 선택, schema, checksum, 확인명을 다시 검증.
- Raw SQL: advisory lock 등 필요한 구문만 parameterized template로 사용하고 unsafe raw API는 사용하지 않는다.
- Production seed: 차단. 개발 seed의 기본 암호는 production 자격 증명이 아니다.

## 3. 데이터 무결성·동시성 확인

- [x] `(seasonId, matchId)` unique로 시즌 내 Riot match 중복 정산 차단.
- [x] 경기 initial/reroll/reversal 원장은 partial unique와 Serializable transaction으로 단일 반영.
- [x] reveal은 표시 상태만 바꾸며 점수 원장을 생성하지 않고 반복 호출은 같은 결과.
- [x] reroll entitlement 소비, second draw, adjustment ledger가 하나의 transaction이며 최대 한 번.
- [x] assignment·participantMatch·evaluatorVersion unique로 미션 중복 평가 차단.
- [x] 미션 snapshot은 경기 시작 시점 assignment를 고정.
- [x] sync invocation/lease/outbox가 bounded, 잠금 및 idempotency key를 사용.
- [x] 외부 Riot/Data Dragon 호출을 DB transaction 밖에서 수행.
- [x] DB UTC 저장, 주차·날짜 표시와 경계 계산은 `Asia/Seoul` 명시.
- [x] season finalization은 pending match/outbox, SEALED draw, 활성 sync lease/run, 경기별 원장·cache drift와 mission drift를 모두 차단.
- [x] main·mission snapshot은 대상당 unique이며 finalize 재호출로 중복 생성하지 않음.
- [x] 종료 시즌의 경기·draw·원장·미션·MVP·ParticipantWeek 파생 쓰기는 DB trigger로도 차단.
- [x] PointDraw FIRST 증거와 완료된 reroll SECOND/final 증거는 application 밖의 직접 update도 차단.
- [x] 주차에 고정된 PUBLISHED/RETIRED immutable baseline은 복구에 사용하고 새 주차에는 PUBLISHED만 선택.
- [x] 잘못된 경기의 mission effect가 있으면 범용 rebuild 전까지 무효화를 fail-closed.

## 4. 접근성·반응형 결과

- axe serious/critical scan: `/`, `/leaderboard`, `/missions`, `/login`, `/signup`, `/me`, `/admin`, `/admin/system`을 desktop/mobile에서 검사.
- 키보드: skip link, 메뉴, 순위표 filter, 포인트 dialog focus trap, Escape 닫기, trigger focus 복귀를 검사.
- dialog: 393px visual viewport에서 가로·세로 경계 내 scroll, 공개 결과의 초기 focus 확인.
- 표: desktop caption/header/rowheader/sticky 경계와 실제 scroll shadow, mobile 행 확장과 핵심 정보 유지를 검사.
- 상태 표현: 승패·증감은 색상 외 텍스트/기호를 함께 사용하고 최근 form/champion 대체 표식에 accessible name을 제공.
- motion: `prefers-reduced-motion`에서 draw 연출 skip/focus 흐름을 검사.
- 시각 회귀: Windows release workstation에서 desktop dashboard와 393px mobile leaderboard baseline 유지. Linux CI는 font rasterization 차이 때문에 pixel assertion만 명시적으로 skip하고 기능·overflow·axe는 계속 실행한다.

수동 in-app browser 점검에서 메인 TOP 5/카운트다운/전체 순위 링크, leaderboard table semantics, 공동 순위와 `gameName#tagLine` 표시를 확인했다.

## 5. 성능 검토

- public page는 server component가 read model을 만들고 상호작용이 필요한 header/table/dialog/form/chart만 client boundary다. `server-only` 유입 검사가 통과한다.
- home에서 mission read는 server-side dynamic import이며 전체 M001~M100 catalog를 브라우저 JS로 보내지 않는다.
- leaderboard는 참가자 주차를 한 번 읽은 뒤 ledger group, rank/daily snapshot, processed match, season entry, freshness를 병렬 조회한다. 행별 Prisma query가 없어 N+1이 없다.
- `ParticipantWeek(weekId, mainScoreCached, wins, losses)`, ledger, processed match, snapshot, sync 상태 인덱스가 존재한다. 현재 약 20명 규모에서는 bounded in-memory competition ranking이 의도된 구조다.
- public read는 20초 cache와 tag/path revalidation을 함께 사용하고 마지막 성공 시각·stale 상태를 보존한다.
- admin list query는 page/pageSize(10~100)와 filter를 server에서 검증한다. 병합형 운영 표도 각 source 최대 100행으로 제한한다.
- sync는 참가자 batch 1~~20, Match-V5 page 1~~100, 기본 20초 time budget, lease/continuation cursor를 사용한다. sync route `maxDuration=60`보다 budget이 짧다.
- scoring/mission scheduler body limit은 1~100이며 중복 invocation에 안전한 service를 호출한다.
- Data Dragon은 patch별 in-memory snapshot, version TTL, last-success/bundled fallback을 사용한다.
- `public/og.png`는 약 1.7 MiB이나 social metadata 요청에만 사용되어 초기 페이지 bundle에는 포함되지 않는다. 배포 CDN 전송량 최적화 후보로 남긴다.

## 6. 출시 전 12단계 시나리오 매핑

| 단계                                | 검증                                                         | 결과/조건                                                        |
| ----------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| 1. 테스트 시즌·주차 생성            | admin operation integration                                  | 자동 검증                                                        |
| 2. 관리자·참가자·일반 회원          | seed + auth integration/E2E                                  | 자동 검증                                                        |
| 3. 실제 Riot ID 3개                 | ASIA Account-V1 단일 read-only 404와 Mock 계약 검증          | key/routing 최소 확인; 실계정 3개·production 승인 launch blocker |
| 4. 종료 fixture ingest              | match sync/scoring integration                               | 자동 검증                                                        |
| 5. 점수와 ledger 대사               | scoring/reconciliation/finalize integration                  | 자동 검증                                                        |
| 6. reveal·commitment 검증           | unit + draw E2E                                              | 자동 검증                                                        |
| 7. MVP/ACE reroll                   | scoring integration + draw E2E                               | 자동 검증; non-demo baseline 실증은 외부 조건                    |
| 8. 미션 완료·reroll·refill·snapshot | mission unit/integration/E2E 화면                            | 자동 검증                                                        |
| 9. 동일 sync 재호출                 | sync idempotency integration                                 | 자동 검증                                                        |
| 10. 경기 무효화                     | no-mission reversal + mission-effect fail-closed integration | 자동 검증; 범용 mission rebuild는 known limitation               |
| 11. 모바일 주요 흐름                | 393px Playwright + axe + 수동 desktop 확인                   | 자동 검증                                                        |
| 12. 종료·final snapshot·read-only   | admin lifecycle integration                                  | 자동 검증                                                        |

## 7. 환경 변수 matrix

값은 이 문서·Git·로그에 기록하지 않는다. `R`=필수, `O`=선택, `F`=금지/미사용.

| 변수                                | dev | staging | production | 주의                                                                   |
| ----------------------------------- | :-: | :-----: | :--------: | ---------------------------------------------------------------------- |
| `DATABASE_URL`                      |  R  |    R    |     R      | runtime pooled URL 가능; test DB와 절대 공유 금지                      |
| `DIRECT_URL`                        |  O  |    R    |     R      | migration용 direct URL; runtime 권한과 분리 권장                       |
| `AUTH_SECRET`                       |  R  |    R    |     R      | 32자 이상, 환경별 독립                                                 |
| `CRON_SECRET`                       |  R  |    R    |     R      | 32자 이상, scheduler Bearer와 일치                                     |
| `POINT_DRAW_SECRET`                 |  O  |    R    |     R      | production 필수, AUTH/CRON과 독립; 미공개 nonce key rotation 절차 필요 |
| `RIOT_API_KEY`                      |  O  |    R    |     R      | `MOCK_RIOT_API=false`일 때 필수, 서버 전용                             |
| `RIOT_PLATFORM_REGION`              |  R  |    R    |     R      | `KR`                                                                   |
| `RIOT_REGIONAL_ROUTE`               |  R  |    R    |     R      | `ASIA`                                                                 |
| `MOCK_RIOT_API`                     |  O  |    R    |     R      | dev 기본 true; staging 실연동/production은 false                       |
| `SYNC_MODE`                         |  R  |    R    |     R      | MANUAL/GITHUB_SCHEDULE/VERCEL_CRON/WORKER                              |
| `SYNC_BATCH_SIZE`                   |  O  |    R    |     R      | 1~20                                                                   |
| `SYNC_OVERLAP_MINUTES`              |  O  |    R    |     R      | pagination overlap                                                     |
| `SYNC_TIME_BUDGET_MS`               |  O  |    R    |     R      | 함수 timeout보다 짧게                                                  |
| `SYNC_MATCH_PAGE_SIZE`              |  O  |    R    |     R      | 1~100                                                                  |
| `SYNC_PARTICIPANT_COOLDOWN_SECONDS` |  O  |    R    |     R      | 기회성 중복 호출 억제                                                  |
| `SYNC_LEASE_SECONDS`                |  O  |    R    |     R      | 30~600                                                                 |
| `SYNC_LEASE_RECOVERY_GRACE_SECONDS` |  O  |    R    |     R      | 늦은 heartbeat 경합 방지                                               |
| `POINT_MODE`                        |  O  |    R    |     R      | 정책 불명확 시 FIXED_20                                                |
| `AUTO_REVEAL_HOURS`                 |  O  |    R    |     R      | 1~168, 시즌 규칙과 일치                                                |
| `ALLOW_DEMO_MVP_REWARDS`            |  O  |    F    |     F      | production parser가 true를 거부                                        |
| `APP_URL`                           |  R  |    R    |     R      | 정확한 Origin/redirect 기준, HTTPS production URL                      |
| `APP_TIME_ZONE`                     |  R  |    R    |     R      | `Asia/Seoul` 고정                                                      |
| `NEXT_PUBLIC_POLL_INTERVAL_MS`      |  O  |    O    |     O      | 5~60초, 공개 가능 값                                                   |
| `TEST_DATABASE_URL`                 |  R  |    R    |     F      | 로컬/CI 전용 test DB                                                   |
| `E2E_DATABASE_URL`                  |  O  |    O    |     F      | TEST URL과 별도 지정 가능                                              |
| `SEED_PASSWORD`                     |  O  |    F    |     F      | 개발 seed 전용; production seed 자체가 차단됨                          |

## 8. Riot·scheduler 정책 체크

2026-08-05에 공식 문서를 다시 확인했다.

- Riot Developer Portal: public consumption은 development/personal key로 운영할 수 없고 production product/key가 필요하다. key는 code·browser·로그에 포함하지 않는다. 429는 `Retry-After` 동안 호출을 중단해야 한다. <https://developer.riotgames.com/docs/portal>
- League of Legends policy: running tournaments는 승인 가능한 use case지만 도박 기능은 금지되고, 제품 등록·보안·게임 무결성·눈에 잘 띄는 비공식 고지가 필요하다. <https://developer.riotgames.com/docs/lol>
- General policy disclaimer 원문과 상표 고지를 production legal document와 footer에서 운영자/법률 검토 후 반영한다. <https://developer.riotgames.com/policies/general>
- Vercel Cron은 UTC이며 실패 자동 재시도가 없고 중복·동시 invocation이 가능하므로 DB lock+idempotency와 운영 재호출이 필요하다. Hobby는 일 1회/지정 시간 내 지연 가능성이 있어 경기 sync SLA에 사용하지 않는다. <https://vercel.com/docs/cron-jobs/manage-cron-jobs>
- Vercel Cron duration은 Function 한도와 같다. 실제 plan의 max duration보다 `SYNC_TIME_BUDGET_MS`를 짧게 두고 backlog는 continuation으로 처리한다. <https://vercel.com/docs/functions/configuring-functions/duration>

### `FIXED_20` 전환

1. GitHub workflow/Vercel Cron/worker 중 실제 scheduler를 먼저 중지한다. 안전 정지가 필요하면 `SYNC_MODE=MANUAL`로 배포해 scheduler route가 `409 SCHEDULER_DISABLED`를 반환하는지 확인한다.
2. 실행 중인 `SyncRun` lease와 scoring/mission 작업이 끝났고 실패·대기 outbox를 분류했는지 확인한다. 기존 draw·ledger를 삭제하거나 다시 생성하지 않는다.
3. 운영 결정과 사유를 새 규칙 버전·공지에 기록하고, 관리자 `FEATURE_FLAG_UPDATE` operation으로 `scoring.fixed20Fallback=true`를 적용한다. 이 operation은 AuditLog를 남기고 공개 규칙 cache를 무효화한다.
4. 관리자 콘솔을 사용할 수 없는 비상 상황에만 `POINT_MODE=FIXED_20`을 설정해 재배포한다. feature flag가 활성화되면 시즌의 저장된 mode나 환경변수보다 `FIXED_20`이 우선한다.
5. `/rules`가 유효 모드를 20점 고정으로 표시하는지 확인하고, staging fixture 한 경기를 처리해 win `+20`, loss `-20`, commitment/reveal, ledger 대사가 같은 transaction pipeline을 쓰는지 확인한다.
6. 전환 전에 이미 생성된 draw·ledger는 그대로 유지한다. 전환 후 처음 정산되는 경기부터 새 유효 모드가 적용된다.
7. scheduler를 재개하고 sync→scoring→missions 순서와 backlog 감소를 확인한다. RANDOM으로 되돌릴 때도 flag 비활성화, 규칙 버전·공지·감사, staging 확인 절차를 거치며 기존 결과를 rewrite하지 않는다.

시즌 `scoringMode`는 기본 규칙이고 `scoring.fixed20Fallback`/`POINT_MODE`는 운영 fallback이다. `/rules`는 저장값이 아니라 실제 유효 모드를 표시해야 한다.

## 9. Migration·staging dry-run·rollback

### Forward migration

- 이 감사에서는 `20260806030000_production_invariant_hardening` migration을 추가했다.
- 저장소의 8개 migration을 빈 임시 PostgreSQL schema에 순서대로 `prisma migrate deploy`하고 production-safe mission catalog bootstrap을 두 번 실행해 멱등성을 확인한다.
- 기존 staging dry-run은 production snapshot 복제본에서 `DATABASE_URL`과 다른 URL로 수행한다. 실제 staging 자격 증명이 없어 로컬 test DB로만 구조를 검증했다.
- production에서는 `prisma migrate dev`, `db push`, `migrate reset`, `db:seed`를 실행하지 않는다. 배포 순서는 `db:preflight:migrations` → backup 확인 → `db:migrate:deploy` → `db:bootstrap:missions`이다.

재현 명령:

```powershell
$env:DIRECT_URL='<staging-direct-postgres-url>'
$env:DATABASE_URL='<staging-runtime-postgres-url>'
pnpm db:preflight:migrations
pnpm exec prisma migrate status
pnpm db:migrate:deploy
pnpm db:bootstrap:missions
pnpm exec prisma migrate status
```

### Rollback

- 신규 migration은 forward-only다. 문제 시 sync/scoring/mission scheduler를 먼저 중지하고 destructive down migration 대신 forward-fix를 우선한다.
- migration 이후 구 application artifact로 단독 rollback하면 구 코드가 생성하는 미봉인 mission snapshot을 새 DB trigger가 거부할 수 있다. application rollback이 꼭 필요하면 scheduler를 정지한 상태로 유지하고 snapshot 생성 경로의 호환성을 별도 검증한다.
- append-only ledger·draw·mission·audit 행을 code rollback 과정에서 delete/update하지 않는다.
- migration이 포함된 후속 release는 배포 직전 provider snapshot을 만들고, destructive down migration 대신 forward-fix를 우선한다. 데이터 손상이 확인되면 scheduler를 차단한 뒤 검증된 snapshot을 별도 DB에 복구해 대사한다.
- 즉시 rollback 기준: 점수 이중 반영, 권한 상승/PII/secret 노출, 광범위한 잘못된 미션 완료, AuditLog 누락, migration 데이터 손상.

## 10. 검증 명령 결과

최종 release gate 실행 결과로 갱신한다.

| 명령                                      | 결과                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`          | Pass — lockfile 변경 없이 already up to date                                                                 |
| `pnpm audit --prod --audit-level high`    | Pass — 알려진 production 취약점 0                                                                            |
| `pnpm lint`                               | Pass — ESLint와 client/server environment boundary                                                           |
| `pnpm typecheck`                          | Pass — `tsc --noEmit`                                                                                        |
| `pnpm test`                               | Pass — 39 files, 491 tests                                                                                   |
| `pnpm test:integration`                   | Pass — 10 files, 84 tests; spec별 migration+seed 격리                                                        |
| `pnpm test:e2e`                           | Pass — 7 files, 39 passed, 17 intentional viewport/project skips                                             |
| `pnpm test:env-startup`                   | Pass — invalid env field만 안전하게 보고                                                                     |
| `pnpm build`                              | Pass — Next 16.3 optimized production build, 35 static page generation jobs 완료                             |
| `pnpm check`                              | Pass — lint → typecheck → 491 unit tests → production build 연속 실행                                        |
| production artifact smoke                 | Pass — `next start` 후 `/api/health` 200/`ok`, 확인 뒤 listener 종료                                         |
| migration status/empty schema deploy      | Pass — 8 migrations, 빈 임시 schema 적용, status up to date, drift 없음                                      |
| mission bootstrap / production seed guard | Pass — production-safe catalog 100개, 2회째 created 0, 업무 fixture 0; production seed write 전 거부         |
| Riot read-only dry run                    | Pass (제한적) — 설정된 형식 키로 ASIA Account-V1 예상 404; production 제품 승인 증빙은 아님                  |
| source/client secret scan                 | Pass — high-confidence key/private-key pattern 0, 실제 local secret 값이 `.next/static`/server bundle에 없음 |
| leaderboard `EXPLAIN (ANALYZE, BUFFERS)`  | Pass at seed scale — 20행 정렬 포함 0.042 ms; 작은 표라 planner가 seq scan 선택                              |
| `pnpm format:check`                       | Pass — 전체 저장소 Prettier 일치                                                                             |

`pnpm outdated`는 production dependency drift를 보고하지 않았고 dev major로 ESLint 10, TypeScript 7만 표시했다. Next/toolchain 호환성을 검증하는 별도 upgrade change에서 다루며 이 감사에서 lint/type 보호를 약화하거나 major upgrade를 섞지 않았다.

## 11. 알려진 제한과 후속 작업

- 로컬에 설정된 형식 키로 ASIA Account-V1 단일 read-only 요청이 예상 404를 반환해 최소 인증·routing은 확인했다. production 제품 승인, 실제 Riot ID, Match-V5·League/Summoner와 rate-limit 운영은 아직 확인하지 못했다.
- mission effect가 있는 경기 무효화는 안전한 범용 correction/rebuild workflow가 구현될 때까지 차단된다.
- CSP는 Next inline bootstrap과 현재 global styles 때문에 `script-src 'unsafe-inline'`, `style-src 'unsafe-inline'`을 포함한다. nonce/hash 기반 CSP로 좁히는 작업은 별도 hardening 항목이다.
- Windows와 Linux의 font rasterization이 달라 pixel snapshot은 Windows release workstation에서 유지한다. CI는 axe·overflow·semantics·기능 검사를 계속한다.
- GitHub scheduled workflow는 지연·누락 가능성이 있고 공개 저장소 장기 비활성 시 중단될 수 있다. 정확한 SLA가 필요하면 Pro Cron/worker를 사용한다.
- production legal text, 개인정보 보존 기간, 국내 chance-based 점수 검토는 코드가 대신 확정할 수 없다.
- `public/og.png` 전송 최적화와 실제 배포 Web Vitals/bundle telemetry는 staging URL이 준비된 뒤 측정한다.
- 로컬 release 감사용 test DB는 production과 무관하다. runner가 만든 임시 schema는 삭제했지만 base test database의 public schema에는 과거 shared-run 행이 남아 있다. 운영자 명시 승인 없이 삭제하지 않았으므로 수동 QA는 새 schema/DB를 사용해야 한다.
- 현재 Git 상태에서 저장소 전체가 untracked로 표시되어 기존 commit과의 변경 diff를 만들 수 없다. 첫 기준 commit/remote 보호 규칙을 확정한 뒤 릴리스 PR을 만들어야 한다.
- PostgreSQL 통합 실행에서 `pg` 9가 제거할 예정인 concurrent `client.query()` 사용 경고가 두 번 관찰되었다. 현재 고정된 `pg` 8.22에서는 통과하지만 pg 9/Prisma adapter upgrade 전에 재검증한다.
