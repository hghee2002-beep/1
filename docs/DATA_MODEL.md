# 데이터 모델 명세

이 문서는 Prisma 스키마 구현의 기준이다. 실제 필드명은 일관성을 위해 영어 camelCase를 사용한다. 모든 시간은 DB에 UTC로 저장한다.

## 1. 공통 원칙

- 기본 ID: UUID 또는 CUID2 중 하나를 프로젝트 전체에서 통일
- 외부 Riot match ID, PUUID, summoner ID는 별도 unique/key 필드
- 금액이 아닌 점수는 정수
- 상태는 Prisma enum
- 외부 원본은 JSONB로 보관 가능하나 핵심 조회 필드는 정규화
- 관리자 삭제 대신 상태 전환과 감사 로그
- mutable cache와 append-only 원장을 구분
- 모든 idempotent mutation에는 고유 key
- 개인정보와 운영 원본의 접근 범위 분리

## 2. 인증·사용자

## User

| 필드 | 타입 | 규칙 |
|---|---|---|
| id | ID | PK |
| loginId | String | unique, case-normalized |
| loginIdNormalized | String | unique |
| realName | String | 참가 표시에 사용 |
| realNamePublic | Boolean | default false, 공개 실명 동의 |
| realNamePublicConsentAt | DateTime? | |
| passwordHash | String | Argon2id |
| role | UserRole | USER, ADMIN |
| status | UserStatus | ACTIVE, LOCKED, DISABLED |
| sessionVersion | Int | 권한/비밀번호 변경 시 증가 |
| termsAcceptedAt | DateTime? | |
| privacyAcceptedAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |
| lastLoginAt | DateTime? | |

관계:

- AuthSession[]
- LegalConsent[]
- ParticipationApplication[]
- Participant?
- AuditLog actor

## AuthSession

| 필드 | 타입 | 규칙 |
|---|---|---|
| id | ID | PK |
| userId | ID | FK |
| jtiHash | String | unique, 원문 jti 저장 금지 |
| sessionVersion | Int | 발급 당시 |
| expiresAt | DateTime | index |
| revokedAt | DateTime? | |
| revokeReason | String? | |
| lastSeenAt | DateTime? | |
| createdAt | DateTime | |

선택적 개인정보인 IP와 user-agent는 운영 필요성을 검토한 뒤 해시/축약 형태로만 저장한다.

## LegalConsent

게시된 법적 문서에 대한 동의를 append-only로 보존한다.

| 필드 | 타입 | 규칙 |
|---|---|---|
| id | ID | PK |
| userId | ID | User FK |
| legalDocumentId | ID | LegalDocument FK |
| acceptedAt | DateTime | |
| source | String | SIGNUP, RECONSENT 등 |
| createdAt | DateTime | |

unique(userId, legalDocumentId)

User의 `termsAcceptedAt`과 `privacyAcceptedAt`은 최신 상태 조회용 cache로만 사용할 수 있으며, 권위 있는 동의 버전은 LegalConsent 이력이다.

## LoginAttempt

분산 rate limiter를 DB로 구현할 경우 사용한다.

- keyHash
- windowStart
- count
- blockedUntil
- updatedAt

향후 Redis로 교체 가능하게 인터페이스로 감싼다.

## 3. 참가 신청·참가자

## ParticipationApplication

| 필드 | 타입 | 규칙 |
|---|---|---|
| id | ID | PK |
| userId | ID | FK |
| gameName | String | 원문 |
| tagLine | String | 원문 |
| riotIdNormalized | String | index |
| puuid | String? | 검증 성공 시 |
| summonerId | String? | |
| profileIconId | Int? | |
| soloTier | String? | |
| soloRank | String? | |
| soloLeaguePoints | Int? | |
| primaryPosition | Position? | 신청 시 선택한 주 포지션 |
| secondaryPosition | Position? | 신청 시 선택한 부 포지션 |
| status | ApplicationStatus | DRAFT, PENDING, APPROVED, REJECTED, WITHDRAWN |
| verificationStatus | VerificationStatus | |
| verificationErrorCode | String? | |
| submittedAt | DateTime? | |
| reviewedAt | DateTime? | |
| reviewedById | ID? | User FK |
| reviewReason | String? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

규칙:

- 사용자당 활성 PENDING 신청 최대 1
- 거절 후 재신청은 기존 행을 수정하지 않고 새 행 생성
- 승인된 PUUID는 Participant에서 unique
- 승인 transaction에서 Participant 생성과 status 변경을 함께 수행

## Participant

| 필드 | 타입 | 규칙 |
|---|---|---|
| id | ID | PK |
| userId | ID | unique FK |
| puuid | String | unique |
| summonerId | String | unique 가능 |
| gameName | String | 최신 |
| tagLine | String | 최신 |
| profileIconId | Int? | |
| primaryPosition | Position? | |
| secondaryPosition | Position? | |
| status | ParticipantStatus | ACTIVE, PAUSED, REMOVED |
| approvedAt | DateTime | |
| approvedById | ID | |
| lastIdentitySyncAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

## ParticipantIdentityHistory

- participantId
- gameName
- tagLine
- validFrom
- validTo
- source
- unique(participantId, validFrom)

Riot ID 변경 이력을 보존한다.

## 4. 시즌·주차

## Season

| 필드 | 타입 |
|---|---|
| id | ID |
| name | String |
| slug | String unique |
| description | String? |
| status | SeasonStatus |
| timezone | String default Asia/Seoul |
| startAt | DateTime |
| endAt | DateTime |
| scoringMode | ScoringMode |
| minGameDurationSeconds | Int |
| autoRevealHours | Int |
| rulesVersion | String |
| config | Json |
| createdById | ID |
| createdAt | DateTime |
| updatedAt | DateTime |

상태:

- DRAFT
- SCHEDULED
- ACTIVE
- FINALIZING
- COMPLETED
- ARCHIVED

## Week

| 필드 | 타입 |
|---|---|
| id | ID |
| seasonId | ID |
| number | Int |
| name | String |
| status | WeekStatus |
| startAt | DateTime |
| endAt | DateTime |
| baselineVersionId | ID? |
| missionCatalogVersion | String |
| rulesSnapshot | Json |
| finalizedAt | DateTime? |
| createdAt | DateTime |
| updatedAt | DateTime |

unique(seasonId, number)

## SeasonParticipant

참가자가 시즌에 포함되는 관계.

- id
- seasonId
- participantId
- status
- joinedAt
- leftAt
- exceptionReason
- startingRankSnapshotId?
- unique(seasonId, participantId)

## ParticipantWeek

주차별 집계와 캐시.

| 필드 | 타입 |
|---|---|
| id | ID |
| weekId | ID |
| participantId | ID |
| mainScoreCached | Int default 0 |
| missionScoreCached | Int default 0 |
| wins | Int default 0 |
| losses | Int default 0 |
| currentStreakType | StreakType? |
| currentStreakCount | Int default 0 |
| bestWinStreak | Int default 0 |
| mvpCount | Int default 0 |
| aceCount | Int default 0 |
| rankCached | Int? |
| missionRankCached | Int? |
| lastProcessedMatchAt | DateTime? |
| createdAt | DateTime |
| updatedAt | DateTime |

unique(weekId, participantId)

권위 있는 점수는 원장 합계다. cache reconciliation command가 있어야 한다.

## WeekSnapshot

- id
- weekId unique
- generatedAt
- rulesSnapshot
- standings Json
- missionStandings Json
- highlights Json
- checksum
- generatedById?
- immutable

## FinalStandingSnapshot

시즌 전체의 최종 결과를 보존한다.

- id
- seasonId unique
- generatedAt
- rulesSnapshot
- weekSnapshotRefs Json
- standings Json
- highlights Json
- checksum
- generatedById?
- immutable

한 주 시즌도 WeekSnapshot과 FinalStandingSnapshot을 각각 생성한다.

## 5. 공식 랭크 스냅샷

## RankSnapshot

| 필드 | 타입 |
|---|---|
| id | ID |
| participantId | ID |
| seasonId | ID? |
| weekId | ID? |
| capturedAt | DateTime |
| queueType | String |
| tier | String? |
| rank | String? |
| leaguePoints | Int? |
| wins | Int? |
| losses | Int? |
| isUnranked | Boolean |
| displayOrdinal | Int? |
| source | SnapshotSource |
| status | RankSnapshotStatus | CAPTURED, UNRANKED, UNCHANGED, API_ERROR |
| errorCode | String? | API 실패 시 안전한 오류 코드 |
| raw | Json? |

index(participantId, capturedAt)
index(weekId, capturedAt)

`displayOrdinal`은 그래프 표시용이며 공식 MMR로 표현하지 않는다.

## DailyStandingSnapshot

- weekId
- participantId
- localDate
- mainScore
- rank
- wins
- losses
- tier/rank/lp
- unique(weekId, participantId, localDate)

어제 대비 순위와 오늘 기록 계산에 사용한다.

## 6. 경기

## Match

| 필드 | 타입 |
|---|---|
| id | ID |
| riotMatchId | String unique |
| regionalRoute | String |
| queueId | Int |
| mapId | Int |
| gameMode | String |
| gameType | String |
| gameVersion | String |
| gameStartAt | DateTime |
| gameEndAt | DateTime |
| durationSeconds | Int |
| earlySurrender | Boolean |
| status | MatchStatus |
| invalidReason | String? |
| rawSummary | Json? |
| rawTimeline | Json? |
| timelineFetchedAt | DateTime? |
| ingestedAt | DateTime |
| processedAt | DateTime? |
| createdAt | DateTime |
| updatedAt | DateTime |

status:

- INGESTED
- PROCESSING
- PROCESSED
- INVALID
- ERROR

indexes:

- gameStartAt
- queueId, gameStartAt
- status, ingestedAt

## SeasonMatch

전역 Match 원본을 시즌별 처리 상태에 연결한다.

| 필드 | 타입 | 규칙 |
|---|---|---|
| id | ID | PK |
| seasonId | ID | Season FK |
| matchId | ID | Match FK |
| weekId | ID | 경기 시작 시각이 속한 Week FK |
| status | MatchStatus | 시즌별 처리 상태 |
| eligibilityReason | String? | |
| processedAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

unique(seasonId, matchId)
index(weekId, status)

## MatchTeam

- id
- matchId
- teamId
- win
- championKills
- towerKills
- inhibitorKills
- dragonKills
- baronKills
- heraldKills
- objectives Json
- unique(matchId, teamId)

## MatchParticipantRaw

10명 전체의 MVP 평가를 위해 대회 참가자가 아니어도 정규화한 통계를 저장한다.

| 필드 | 타입 |
|---|---|
| id | ID |
| matchId | ID |
| puuid | String |
| teamId | Int |
| participantIndex | Int |
| position | Position? |
| startingTier | String? |
| tierBucket | TierBucket? |
| championId | Int |
| championName | String |
| win | Boolean |
| kills/deaths/assists | Int |
| totalMinionsKilled | Int |
| neutralMinionsKilled | Int |
| goldEarned | Int |
| damageToChampions | Int |
| damageTaken | Int |
| damageMitigated | Int |
| damageToObjectives | Int |
| damageToTurrets | Int |
| visionScore | Int |
| wardsPlaced | Int |
| wardsKilled | Int |
| controlWardsPlaced | Int |
| timeCCingOthers | Int |
| healOnTeammates | Int |
| shieldOnTeammates | Int |
| items | Json |
| perks | Json |
| summonerSpells | Json |
| challenges | Json |
| normalizedMetrics | Json |
| createdAt | DateTime |

unique(matchId, participantIndex)
index(matchId, teamId)

## ParticipantMatch

대회 참가자와 경기의 관계.

| 필드 | 타입 |
|---|---|
| id | ID |
| participantId | ID |
| participantWeekId | ID |
| seasonMatchId | ID |
| matchParticipantRawId | ID |
| eligible | Boolean |
| eligibilityReason | String? |
| win | Boolean |
| position | Position? |
| championId | Int |
| championName | String |
| kills | Int |
| deaths | Int |
| assists | Int |
| cs | Int |
| kda | Decimal |
| killParticipation | Decimal? |
| pointSignedCached | Int? |
| processedAt | DateTime? |
| createdAt | DateTime |
| updatedAt | DateTime |

unique(participantId, seasonMatchId)
index(participantWeekId, seasonMatchId)

동일 전역 raw 참가자 행은 겹치는 시즌의 `ParticipantMatch` 여러 건에서 참조할 수 있고, 시즌별 유일성은 `(participantId, seasonMatchId)`가 보장한다.

## 7. 포인트 추첨·원장

## PointDraw

| 필드 | 타입 |
|---|---|
| id | ID |
| participantMatchId | ID unique |
| state | DrawState |
| resultSign | Int |
| firstValue | Int |
| firstNonceEncryptedOrProtected | String |
| firstCommitment | String |
| firstCommitmentVersion | String |
| firstRngVersion | String |
| firstGeneratedAt | DateTime |
| revealedAt | DateTime? |
| autoRevealed | Boolean |
| rerollEligible | Boolean |
| rerollReason | String? |
| rerollEntitlementKey | String? unique |
| rerollEntitlementSource | String? |
| rerollGrantedAt | DateTime? |
| rerollExpiresAt | DateTime? |
| rerollDemoOnly | Boolean |
| secondValue | Int? |
| secondNonceEncryptedOrProtected | String? |
| secondCommitment | String? |
| secondCommitmentVersion | String? |
| secondRngVersion | String? |
| rerollUsedAt | DateTime? |
| finalValue | Int |
| finalSignedValue | Int |
| createdAt | DateTime |
| updatedAt | DateTime |

state:

- SEALED
- REVEALED
- REROLLED
- AUTO_REVEALED
- VOID

제약:

- value는 17~23
- resultSign은 win=1, loss=-1
- finalSignedValue = resultSign * finalValue
- 사용자용 select에서 비공개 값 제외
- FIRST/SECOND nonce envelope는 draw ID와 phase에 암호학적으로 결합
- commitment version과 RNG version은 독립적으로 저장

nonce 보호 방식은 위협 모델에 맞게 결정한다. 최소한 일반 read API와 로그에 노출되지 않아야 한다.

## ScoreLedger

| 필드 | 타입 |
|---|---|
| id | ID |
| participantWeekId | ID |
| participantMatchId | ID? |
| type | ScoreLedgerType |
| amount | Int |
| idempotencyKey | String unique |
| reason | String? |
| actorUserId | ID? |
| metadata | Json? |
| createdAt | DateTime |

index(participantWeekId, createdAt)
index(participantMatchId)

원장 행 update/delete 금지. 잘못된 행은 반전 행 추가.

## ScoreReconciliation

- id
- participantWeekId
- ledgerSum
- cachedValue
- difference
- checkedAt
- repairedAt?
- actor?
- details

## 8. MVP/ACE

## MvpBaselineVersion

| 필드 | 타입 |
|---|---|
| id | ID |
| name | String unique |
| status | BaselineStatus |
| sourceDescription | String |
| patchFrom | String |
| patchTo | String |
| collectedAt | DateTime |
| sampleNotes | String? |
| demoOnly | Boolean |
| checksum | String |
| uploadedById | ID |
| publishedAt | DateTime? |
| retiredAt | DateTime? |
| createdAt | DateTime |

status: DRAFT, VALIDATED, PUBLISHED, RETIRED, REJECTED

## MvpBaselineMetric

| 필드 | 타입 |
|---|---|
| id | ID |
| versionId | ID |
| tierBucket | TierBucket |
| position | Position |
| metricKey | String |
| mean | Decimal |
| stdDev | Decimal |
| sampleSize | Int |
| lowerBound | Decimal? |
| upperBound | Decimal? |

unique(versionId, tierBucket, position, metricKey)

stdDev는 0보다 커야 한다.

## MvpEvaluation

| 필드 | 타입 |
|---|---|
| id | ID |
| evaluationKey | String unique |
| seasonMatchId | ID |
| matchParticipantRawId | ID |
| participantMatchId | ID? |
| baselineVersionId | ID? |
| status | MvpEvaluationStatus |
| errorCode | String? |
| tierBucket | TierBucket? |
| position | Position? |
| visionObjectiveScore | Decimal? |
| growthScore | Decimal? |
| damageScore | Decimal? |
| kdaParticipationScore | Decimal? |
| totalScore | Decimal? |
| teamRank | Int? |
| award | MvpAward |
| evaluatorVersion | String |
| metrics | Json |
| tieBreak | Json |
| supersedesEvaluationId | ID? |
| createdAt | DateTime |

`evaluationKey` unique. `(seasonMatchId, matchParticipantRawId, evaluatorVersion)` index.
award: NONE, MVP, ACE

status: COMPLETED, PENDING_BASELINE, PENDING_DATA, INVALID_MATCH. 기존 행은 수정하지 않고 재평가가 새 행으로 이전 평가를 참조한다.

## 9. 미션

## MissionDefinition

| 필드 | 타입 |
|---|---|
| id | ID |
| code | String |
| version | Int |
| title | String |
| description | String |
| category | MissionCategory |
| kind | MissionKind |
| difficulty | MissionDifficulty |
| points | Int |
| evaluatorKey | String |
| evaluatorConfig | Json |
| sourceType | MissionSourceType |
| target | Decimal |
| active | Boolean |
| minPatch | String? |
| maxPatch | String? |
| createdAt | DateTime |
| updatedAt | DateTime |

DB config는 데이터이며 실행 코드를 담지 않는다.

unique(code, version)

## WeeklyMissionAssignment

| 필드 | 타입 |
|---|---|
| id | ID |
| participantWeekId | ID |
| missionDefinitionId | ID |
| state | MissionAssignmentState |
| assignedAt | DateTime |
| activeFrom | DateTime |
| activeTo | DateTime? |
| progress | Decimal |
| target | Decimal |
| completedAt | DateTime? |
| completedByParticipantMatchId | ID? |
| seenOrder | Int |
| deferredOrder | Int? |
| evaluatorVersion | String |
| selectionSeedHash | String (원본 entropy가 아닌 SHA-256 hash) |
| selectionMetadata | Json (후보 definition ID/version, pool, selector version, 후보 hash) |
| createdAt | DateTime |
| updatedAt | DateTime |

state:

- ACTIVE
- COMPLETED
- REROLLED
- DEFERRED
- EXPIRED
- CANCELLED

index(participantWeekId, state)
index(participantWeekId, activeFrom, activeTo)

같은 주차에서 동일 definition의 재배정 규칙은 DECISIONS에 따른다. 이력을 위해 단순 unique(participantWeek, definition)를 강제하지 않을 수 있으며 generation 번호를 둔다.

## MissionMatchSnapshot

경기 ingest 시점이 늦어도 `gameStartAt`의 assignment 집합을 한 번만 고정한다. 부모 행이 존재하므로 활성 미션이 0개인 빈 집합도 재처리 시 다시 계산하지 않는다.

- id
- participantMatchId unique
- matchStartAt
- createdAt

## MissionMatchSnapshotAssignment

- snapshotId
- assignmentId
- evaluatorVersion
- primary key(snapshotId, assignmentId)

snapshot entry는 같은 ParticipantWeek에 속하고 `activeFrom <= matchStartAt < activeTo` 구간에 포함되어야 한다. 부모와 entry는 append-only이며 evaluator 실행은 snapshot 생성과 별도 outbox 단계에서 수행한다.

## MissionProgressEvent

| 필드 | 타입 |
|---|---|
| id | ID |
| assignmentId | ID |
| participantMatchId | ID |
| type | MissionProgressEventType | NORMAL, CORRECTION |
| beforeValue | Decimal |
| deltaValue | Decimal |
| afterValue | Decimal |
| completed | Boolean |
| evaluatorVersion | String |
| facts | Json |
| supersedesEventId | ID? | correction일 때 기존 이벤트 참조 |
| correctionReason | String? | correction일 때 필수 |
| correctedByUserId | ID? | 관리자 User FK |
| idempotencyKey | String unique |
| createdAt | DateTime |

unique(assignmentId, participantMatchId, evaluatorVersion)

다른 evaluator version으로 재평가할 때는 NORMAL delta를 다시 더하지 않는다. 명시적 correction event가 기존 결과와 새 결과의 차이만 반영하고 AuditLog를 생성한다.

## MissionCompletionLedger

| 필드 | 타입 |
|---|---|
| id | ID |
| participantWeekId | ID |
| assignmentId | ID? |
| type | MissionLedgerType |
| points | Int |
| idempotencyKey | String unique |
| actorUserId | ID? |
| reason | String? |
| metadata | Json? |
| createdAt | DateTime |

## MissionRefillState

- id
- participantWeekId unique
- credits Int default 0
- maxCredits Int default 3
- intervalMinutes Int default 360
- anchorAt DateTime
- accountedThroughAt DateTime
- nextAccrualAt DateTime
- updatedAt

tick을 행 추가로 쌓기보다 현재 시각에서 누적 가능한 수를 계산해 반영한다.

## MissionRerollState

- id
- participantWeekId unique
- lastUsedAt DateTime?
- nextAvailableAt DateTime?
- cooldownMinutes Int default 60
- totalUsed Int default 0
- updatedAt

## MissionCandidateHistory

- participantWeekId
- missionDefinitionId
- firstSeenAt
- completedAt?
- rerolledAt?
- timesAssigned
- status
- unique(participantWeekId, missionDefinitionId)

unseen/deferred 후보 선택에 사용한다.

## 10. 동기화·작업

## SyncCursor

| 필드 | 타입 |
|---|---|
| id | ID |
| participantId | ID unique |
| seasonId | ID? | 현재 pagination scope, 시즌 전환 시 reset |
| lastRequestedStartAt | DateTime? |
| lastSuccessfulMatchStartAt | DateTime? |
| newestKnownMatchId | String? |
| paginationStart | Int | 완료되지 않은 고정 window의 다음 offset |
| paginationWindowStartAt | DateTime? | pagination 중 고정 |
| paginationWindowEndAt | DateTime? | 새 경기 삽입으로 offset이 밀리지 않도록 고정 |
| lastSuccessAt | DateTime? |
| lastErrorAt | DateTime? |
| lastErrorCode | String? |
| consecutiveFailures | Int |
| nextEligibleAt | DateTime? |
| updatedAt | DateTime |

## SyncRun

| 필드 | 타입 |
|---|---|
| id | ID |
| invocationKey | String unique |
| trigger | SyncTrigger |
| status | SyncRunStatus |
| startedAt | DateTime |
| finishedAt | DateTime? |
| participantCount | Int |
| matchIdsFound | Int |
| matchesFetched | Int |
| matchesProcessed | Int |
| matchesSkipped | Int |
| errorCount | Int |
| rateLimitSnapshot | Json? |
| requestedById | ID? |
| metadata | Json? |

## SyncRunItem

- syncRunId
- participantId?
- riotMatchId?
- stage
- status
- errorCode?
- messageSanitized?
- retryable
- durationMs
- createdAt

## JobLease

| 필드 | 타입 |
|---|---|
| key | String PK |
| ownerToken | String |
| acquiredAt | DateTime |
| expiresAt | DateTime |
| heartbeatAt | DateTime |

조건부 acquire/update로 중복 worker를 제어한다.

## ProcessingOutbox (선택 권장)

- id
- type
- aggregateId
- payload
- status
- attempts
- availableAt
- lockedAt
- processedAt
- lastError
- unique dedupe key

초기 버전에서는 같은 request 안에서 처리할 수 있으나, 함수 시간 제한 문제가 생기면 outbox/worker로 전환한다.

## 11. 콘텐츠·감사·운영

## Announcement

- id
- title
- body
- status
- pinned
- publishedAt
- expiresAt?
- createdById
- updatedById
- createdAt
- updatedAt

## LegalDocument

- id
- type (RULES, TERMS, PRIVACY, RIOT_DISCLAIMER)
- version
- title
- body
- effectiveAt
- publishedAt?
- status
- createdById
- checksum
- unique(type, version)

## AuditLog

| 필드 | 타입 |
|---|---|
| id | ID |
| actorUserId | ID? |
| action | String |
| targetType | String |
| targetId | String? |
| reason | String? |
| before | Json? |
| after | Json? |
| requestId | String? |
| ipHash | String? |
| createdAt | DateTime |

index(actorUserId, createdAt)
index(targetType, targetId, createdAt)
index(action, createdAt)

비밀번호 hash, JWT, Riot key, nonce 원문 등은 before/after에 넣지 않는다.

## FeatureFlag

- key PK
- enabled
- config Json
- description
- updatedById
- updatedAt

예:

- scoring.fixed20Fallback
- mvp.rewardsEnabled
- sync.opportunisticEnabled
- history.searchEnabled
- maintenance.enabled

## SystemSetting

민감하지 않은 운영 설정만 저장한다. 비밀은 환경 변수/secret manager.

- key
- value Json
- version
- updatedById
- updatedAt

## ExportJob

- id
- type
- status
- weekId?
- requestedById
- objectPath?
- checksum?
- expiresAt?
- createdAt
- finishedAt?
- errorCode?

## 12. 주요 관계

```text
User 1 ─ 0..1 Participant
User 1 ─ * ParticipationApplication
User 1 ─ * LegalConsent
Participant * ─ * Season through SeasonParticipant
Participant 1 ─ * ParticipantWeek
Week 1 ─ * ParticipantWeek
Season 1 ─ * SeasonMatch
Match 1 ─ * SeasonMatch
Season 1 ─ 0..1 FinalStandingSnapshot
Week 1 ─ 0..1 WeekSnapshot
Match 1 ─ 10 MatchParticipantRaw
Participant 1 ─ * ParticipantMatch
SeasonMatch 1 ─ * ParticipantMatch
ParticipantMatch 1 ─ 1 PointDraw
ParticipantWeek 1 ─ * ScoreLedger
MatchParticipantRaw 1 ─ * MvpEvaluation(versioned)
ParticipantWeek 1 ─ * WeeklyMissionAssignment
ParticipantMatch 1 ─ 1 MissionMatchSnapshot
MissionMatchSnapshot 1 ─ * MissionMatchSnapshotAssignment
WeeklyMissionAssignment 1 ─ * MissionProgressEvent
ParticipantWeek 1 ─ * MissionCompletionLedger
```

## 13. 인덱스 체크리스트

구현 후 실제 explain을 확인한다.

- User.loginIdNormalized unique
- Participant.puuid unique
- ParticipationApplication(status, submittedAt)
- ParticipationApplication(userId) where status=PENDING unique
- ParticipationApplication(puuid, status)
- Season(status, startAt, endAt)
- Week(seasonId, number) unique
- WeekSnapshot.weekId unique
- FinalStandingSnapshot.seasonId unique
- ParticipantWeek(weekId, participantId) unique
- RankSnapshot(participantId, capturedAt desc)
- Match.riotMatchId unique
- Match(gameStartAt desc)
- SeasonMatch(seasonId, matchId) unique
- SeasonMatch(weekId, status)
- ParticipantMatch(participantId, seasonMatchId) unique
- ParticipantMatch(participantWeekId, createdAt desc)
- ScoreLedger.idempotencyKey unique
- ScoreLedger(participantWeekId, createdAt)
- PointDraw.participantMatchId unique
- WeeklyMissionAssignment(participantWeekId, state)
- MissionMatchSnapshot.participantMatchId unique
- MissionMatchSnapshotAssignment(snapshotId, assignmentId) unique
- MissionDefinition(code, version) unique
- MissionProgressEvent(assignmentId, participantMatchId, evaluatorVersion) unique
- MissionProgressEvent.idempotencyKey unique
- SyncRun.invocationKey unique
- SyncRun(status, startedAt desc)
- AuditLog(createdAt desc)
- AuditLog(targetType, targetId)

## 14. 삭제·보존

- User: 계정 삭제 요청 시 법적/운영 요구 범위에서 pseudonymize
- Match raw payload: 운영 필요 기간 후 축소 또는 삭제 가능
- 정규화 경기·원장·snapshot: 대회 기록 보존 정책에 따름
- Session/LoginAttempt: 짧은 보존 기간
- AuditLog: 대회 종료 후 정한 기간
- Export file: 자동 만료
- 삭제 작업 자체를 AuditLog에 기록
