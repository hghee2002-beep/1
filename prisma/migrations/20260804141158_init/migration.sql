-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REMOVED');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'FINALIZING', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScoringMode" AS ENUM ('RANDOM_17_23', 'FIXED_20');

-- CreateEnum
CREATE TYPE "WeekStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'FINALIZING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SeasonParticipantStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REMOVED');

-- CreateEnum
CREATE TYPE "StreakType" AS ENUM ('WIN', 'LOSS');

-- CreateEnum
CREATE TYPE "SnapshotSource" AS ENUM ('RIOT_API', 'MOCK', 'ADMIN_IMPORT');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('INGESTED', 'PROCESSING', 'PROCESSED', 'INVALID', 'ERROR');

-- CreateEnum
CREATE TYPE "DrawState" AS ENUM ('SEALED', 'REVEALED', 'REROLLED', 'AUTO_REVEALED', 'VOID');

-- CreateEnum
CREATE TYPE "ScoreLedgerType" AS ENUM ('MATCH_INITIAL', 'MATCH_REROLL_ADJUSTMENT', 'ADMIN_ADJUSTMENT', 'MATCH_INVALIDATION', 'MATCH_REINSTATEMENT', 'MIGRATION_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "BaselineStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED', 'RETIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TierBucket" AS ENUM ('PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER_PLUS');

-- CreateEnum
CREATE TYPE "MvpAward" AS ENUM ('NONE', 'MVP', 'ACE');

-- CreateEnum
CREATE TYPE "MissionCategory" AS ENUM ('RESULT', 'COMBAT', 'DAMAGE', 'PROTECTION', 'GROWTH', 'VISION', 'OBJECTIVE', 'SURVIVAL', 'MULTIKILL', 'SPEED', 'ENDURANCE', 'TIMELINE', 'BUILD', 'POSITION', 'RUNE', 'CHAMPION', 'CUMULATIVE');

-- CreateEnum
CREATE TYPE "MissionKind" AS ENUM ('SINGLE', 'CUMULATIVE');

-- CreateEnum
CREATE TYPE "MissionDifficulty" AS ENUM ('EASY', 'NORMAL', 'HARD', 'EPIC');

-- CreateEnum
CREATE TYPE "MissionSourceType" AS ENUM ('MATCH_INFO', 'MATCH_TIMELINE', 'DATA_DRAGON', 'DERIVED', 'INTERNAL');

-- CreateEnum
CREATE TYPE "MissionAssignmentState" AS ENUM ('ACTIVE', 'COMPLETED', 'REROLLED', 'DEFERRED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MissionProgressEventType" AS ENUM ('NORMAL', 'CORRECTION');

-- CreateEnum
CREATE TYPE "MissionLedgerType" AS ENUM ('COMPLETION', 'CORRECTION', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "MissionCandidateStatus" AS ENUM ('UNSEEN', 'ACTIVE', 'COMPLETED', 'DEFERRED', 'EXHAUSTED');

-- CreateEnum
CREATE TYPE "SyncTrigger" AS ENUM ('MANUAL', 'GITHUB_SCHEDULE', 'VERCEL_CRON', 'WORKER', 'OPPORTUNISTIC');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncRunItemStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('RULES', 'TERMS', 'PRIVACY', 'RIOT_DISCLAIMER');

-- CreateEnum
CREATE TYPE "LegalDocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ExportJobType" AS ENUM ('PARTICIPANTS', 'MATCHES', 'SCORE_LEDGER', 'MISSION_LEDGER', 'STANDINGS', 'FULL_ARCHIVE');

-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "loginId" VARCHAR(64) NOT NULL,
    "loginIdNormalized" VARCHAR(64) NOT NULL,
    "realName" VARCHAR(100) NOT NULL,
    "realNamePublic" BOOLEAN NOT NULL DEFAULT false,
    "realNamePublicConsentAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "termsAcceptedAt" TIMESTAMP(3),
    "privacyAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "jtiHash" VARCHAR(128) NOT NULL,
    "sessionVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalConsent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "legalDocumentId" UUID NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "source" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" UUID NOT NULL,
    "keyHash" VARCHAR(128) NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipationApplication" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "gameName" VARCHAR(128) NOT NULL,
    "tagLine" VARCHAR(32) NOT NULL,
    "riotIdNormalized" VARCHAR(192) NOT NULL,
    "puuid" VARCHAR(128),
    "summonerId" VARCHAR(128),
    "profileIconId" INTEGER,
    "soloTier" VARCHAR(32),
    "soloRank" VARCHAR(16),
    "soloLeaguePoints" INTEGER,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "verificationErrorCode" VARCHAR(64),
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipationApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "puuid" VARCHAR(128) NOT NULL,
    "summonerId" VARCHAR(128) NOT NULL,
    "gameName" VARCHAR(128) NOT NULL,
    "tagLine" VARCHAR(32) NOT NULL,
    "profileIconId" INTEGER,
    "primaryPosition" "Position",
    "secondaryPosition" "Position",
    "status" "ParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "approvedById" UUID NOT NULL,
    "lastIdentitySyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantIdentityHistory" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "gameName" VARCHAR(128) NOT NULL,
    "tagLine" VARCHAR(32) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "source" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipantIdentityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "status" "SeasonStatus" NOT NULL DEFAULT 'DRAFT',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "scoringMode" "ScoringMode" NOT NULL DEFAULT 'RANDOM_17_23',
    "minGameDurationSeconds" INTEGER NOT NULL DEFAULT 600,
    "autoRevealHours" INTEGER NOT NULL DEFAULT 12,
    "rulesVersion" VARCHAR(64) NOT NULL,
    "config" JSONB NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Week" (
    "id" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "status" "WeekStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "baselineVersionId" UUID,
    "missionCatalogVersion" VARCHAR(64) NOT NULL,
    "rulesSnapshot" JSONB NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Week_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonParticipant" (
    "id" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "status" "SeasonParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3),
    "exceptionReason" TEXT,
    "startingRankSnapshotId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantWeek" (
    "id" UUID NOT NULL,
    "weekId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "mainScoreCached" INTEGER NOT NULL DEFAULT 0,
    "missionScoreCached" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "currentStreakType" "StreakType",
    "currentStreakCount" INTEGER NOT NULL DEFAULT 0,
    "bestWinStreak" INTEGER NOT NULL DEFAULT 0,
    "mvpCount" INTEGER NOT NULL DEFAULT 0,
    "aceCount" INTEGER NOT NULL DEFAULT 0,
    "rankCached" INTEGER,
    "missionRankCached" INTEGER,
    "lastProcessedMatchAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekSnapshot" (
    "id" UUID NOT NULL,
    "weekId" UUID NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "rulesSnapshot" JSONB NOT NULL,
    "standings" JSONB NOT NULL,
    "missionStandings" JSONB NOT NULL,
    "highlights" JSONB NOT NULL,
    "checksum" VARCHAR(128) NOT NULL,
    "generatedById" UUID,

    CONSTRAINT "WeekSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalStandingSnapshot" (
    "id" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "rulesSnapshot" JSONB NOT NULL,
    "weekSnapshotRefs" JSONB NOT NULL,
    "standings" JSONB NOT NULL,
    "highlights" JSONB NOT NULL,
    "checksum" VARCHAR(128) NOT NULL,
    "generatedById" UUID,

    CONSTRAINT "FinalStandingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankSnapshot" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "seasonId" UUID,
    "weekId" UUID,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "queueType" VARCHAR(64) NOT NULL,
    "tier" VARCHAR(32),
    "rank" VARCHAR(16),
    "leaguePoints" INTEGER,
    "wins" INTEGER,
    "losses" INTEGER,
    "isUnranked" BOOLEAN NOT NULL DEFAULT false,
    "displayOrdinal" INTEGER,
    "source" "SnapshotSource" NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStandingSnapshot" (
    "id" UUID NOT NULL,
    "weekId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "localDate" DATE NOT NULL,
    "mainScore" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "tier" VARCHAR(32),
    "rankLabel" VARCHAR(16),
    "leaguePoints" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyStandingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" UUID NOT NULL,
    "riotMatchId" VARCHAR(128) NOT NULL,
    "regionalRoute" VARCHAR(32) NOT NULL,
    "queueId" INTEGER NOT NULL,
    "mapId" INTEGER NOT NULL,
    "gameMode" VARCHAR(64) NOT NULL,
    "gameType" VARCHAR(64) NOT NULL,
    "gameVersion" VARCHAR(64) NOT NULL,
    "gameStartAt" TIMESTAMP(3) NOT NULL,
    "gameEndAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "earlySurrender" BOOLEAN NOT NULL DEFAULT false,
    "status" "MatchStatus" NOT NULL DEFAULT 'INGESTED',
    "invalidReason" TEXT,
    "rawSummary" JSONB,
    "rawTimeline" JSONB,
    "timelineFetchedAt" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonMatch" (
    "id" UUID NOT NULL,
    "seasonId" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "weekId" UUID NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'INGESTED',
    "eligibilityReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchTeam" (
    "id" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "teamId" INTEGER NOT NULL,
    "win" BOOLEAN NOT NULL,
    "championKills" INTEGER NOT NULL DEFAULT 0,
    "towerKills" INTEGER NOT NULL DEFAULT 0,
    "inhibitorKills" INTEGER NOT NULL DEFAULT 0,
    "dragonKills" INTEGER NOT NULL DEFAULT 0,
    "baronKills" INTEGER NOT NULL DEFAULT 0,
    "heraldKills" INTEGER NOT NULL DEFAULT 0,
    "objectives" JSONB NOT NULL,

    CONSTRAINT "MatchTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchParticipantRaw" (
    "id" UUID NOT NULL,
    "matchId" UUID NOT NULL,
    "puuid" VARCHAR(128) NOT NULL,
    "teamId" INTEGER NOT NULL,
    "participantIndex" INTEGER NOT NULL,
    "position" "Position",
    "championId" INTEGER NOT NULL,
    "championName" VARCHAR(64) NOT NULL,
    "win" BOOLEAN NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "totalMinionsKilled" INTEGER NOT NULL,
    "neutralMinionsKilled" INTEGER NOT NULL,
    "goldEarned" INTEGER NOT NULL,
    "damageToChampions" INTEGER NOT NULL,
    "damageTaken" INTEGER NOT NULL,
    "damageMitigated" INTEGER NOT NULL,
    "damageToObjectives" INTEGER NOT NULL,
    "damageToTurrets" INTEGER NOT NULL,
    "visionScore" INTEGER NOT NULL,
    "wardsPlaced" INTEGER NOT NULL,
    "wardsKilled" INTEGER NOT NULL,
    "controlWardsPlaced" INTEGER NOT NULL,
    "timeCCingOthers" INTEGER NOT NULL,
    "healOnTeammates" INTEGER NOT NULL,
    "shieldOnTeammates" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "perks" JSONB NOT NULL,
    "summonerSpells" JSONB NOT NULL,
    "challenges" JSONB NOT NULL,
    "normalizedMetrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchParticipantRaw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantMatch" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "participantWeekId" UUID NOT NULL,
    "seasonMatchId" UUID NOT NULL,
    "matchParticipantRawId" UUID NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "eligibilityReason" TEXT,
    "win" BOOLEAN NOT NULL,
    "position" "Position",
    "championId" INTEGER NOT NULL,
    "championName" VARCHAR(64) NOT NULL,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "cs" INTEGER NOT NULL,
    "kda" DECIMAL(12,4) NOT NULL,
    "killParticipation" DECIMAL(8,6),
    "pointSignedCached" INTEGER,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointDraw" (
    "id" UUID NOT NULL,
    "participantMatchId" UUID NOT NULL,
    "state" "DrawState" NOT NULL DEFAULT 'SEALED',
    "resultSign" INTEGER NOT NULL,
    "firstValue" INTEGER NOT NULL,
    "firstNonceEncryptedOrProtected" TEXT NOT NULL,
    "firstCommitment" VARCHAR(128) NOT NULL,
    "firstRngVersion" VARCHAR(64) NOT NULL,
    "firstGeneratedAt" TIMESTAMP(3) NOT NULL,
    "revealedAt" TIMESTAMP(3),
    "autoRevealed" BOOLEAN NOT NULL DEFAULT false,
    "rerollEligible" BOOLEAN NOT NULL DEFAULT false,
    "rerollReason" TEXT,
    "secondValue" INTEGER,
    "secondNonceEncryptedOrProtected" TEXT,
    "secondCommitment" VARCHAR(128),
    "secondRngVersion" VARCHAR(64),
    "rerollUsedAt" TIMESTAMP(3),
    "finalValue" INTEGER NOT NULL,
    "finalSignedValue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointDraw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreLedger" (
    "id" UUID NOT NULL,
    "participantWeekId" UUID NOT NULL,
    "participantMatchId" UUID,
    "type" "ScoreLedgerType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "idempotencyKey" VARCHAR(192) NOT NULL,
    "reason" TEXT,
    "actorUserId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreReconciliation" (
    "id" UUID NOT NULL,
    "participantWeekId" UUID NOT NULL,
    "ledgerSum" INTEGER NOT NULL,
    "cachedValue" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "repairedAt" TIMESTAMP(3),
    "actorUserId" UUID,
    "details" JSONB NOT NULL,

    CONSTRAINT "ScoreReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MvpBaselineVersion" (
    "id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "status" "BaselineStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceDescription" TEXT NOT NULL,
    "patchFrom" VARCHAR(32) NOT NULL,
    "patchTo" VARCHAR(32) NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "sampleNotes" TEXT,
    "demoOnly" BOOLEAN NOT NULL DEFAULT true,
    "checksum" VARCHAR(128) NOT NULL,
    "uploadedById" UUID NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MvpBaselineVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MvpBaselineMetric" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "tierBucket" "TierBucket" NOT NULL,
    "position" "Position" NOT NULL,
    "metricKey" VARCHAR(100) NOT NULL,
    "mean" DECIMAL(18,6) NOT NULL,
    "stdDev" DECIMAL(18,6) NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "lowerBound" DECIMAL(18,6),
    "upperBound" DECIMAL(18,6),

    CONSTRAINT "MvpBaselineMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MvpEvaluation" (
    "id" UUID NOT NULL,
    "matchParticipantRawId" UUID NOT NULL,
    "participantMatchId" UUID,
    "baselineVersionId" UUID NOT NULL,
    "tierBucket" "TierBucket" NOT NULL,
    "position" "Position" NOT NULL,
    "visionObjectiveScore" DECIMAL(18,6) NOT NULL,
    "growthScore" DECIMAL(18,6) NOT NULL,
    "damageScore" DECIMAL(18,6) NOT NULL,
    "kdaParticipationScore" DECIMAL(18,6) NOT NULL,
    "totalScore" DECIMAL(18,6) NOT NULL,
    "teamRank" INTEGER NOT NULL,
    "award" "MvpAward" NOT NULL DEFAULT 'NONE',
    "evaluatorVersion" VARCHAR(64) NOT NULL,
    "metrics" JSONB NOT NULL,
    "tieBreak" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MvpEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionDefinition" (
    "id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "MissionCategory" NOT NULL,
    "kind" "MissionKind" NOT NULL,
    "difficulty" "MissionDifficulty" NOT NULL,
    "points" INTEGER NOT NULL,
    "evaluatorKey" VARCHAR(128) NOT NULL,
    "evaluatorConfig" JSONB NOT NULL,
    "sourceType" "MissionSourceType" NOT NULL,
    "target" DECIMAL(18,6) NOT NULL,
    "targetText" VARCHAR(64),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "minPatch" VARCHAR(32),
    "maxPatch" VARCHAR(32),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyMissionAssignment" (
    "id" UUID NOT NULL,
    "participantWeekId" UUID NOT NULL,
    "missionDefinitionId" UUID NOT NULL,
    "state" "MissionAssignmentState" NOT NULL DEFAULT 'ACTIVE',
    "generation" INTEGER NOT NULL DEFAULT 1,
    "selectionKey" VARCHAR(192) NOT NULL,
    "selectionSeedHash" VARCHAR(128) NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "activeFrom" TIMESTAMP(3) NOT NULL,
    "activeTo" TIMESTAMP(3),
    "progress" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "target" DECIMAL(18,6) NOT NULL,
    "unit" VARCHAR(32),
    "progressPayload" JSONB,
    "completedAt" TIMESTAMP(3),
    "completedByParticipantMatchId" UUID,
    "lastEvaluatedParticipantMatchId" UUID,
    "seenOrder" INTEGER NOT NULL,
    "deferredOrder" INTEGER,
    "evaluatorVersion" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyMissionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionProgressEvent" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "participantMatchId" UUID NOT NULL,
    "type" "MissionProgressEventType" NOT NULL DEFAULT 'NORMAL',
    "beforeValue" DECIMAL(18,6) NOT NULL,
    "deltaValue" DECIMAL(18,6) NOT NULL,
    "afterValue" DECIMAL(18,6) NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "evaluatorVersion" VARCHAR(64) NOT NULL,
    "facts" JSONB NOT NULL,
    "supersedesEventId" UUID,
    "correctionReason" TEXT,
    "correctedByUserId" UUID,
    "idempotencyKey" VARCHAR(192) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionProgressEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionCompletionLedger" (
    "id" UUID NOT NULL,
    "participantWeekId" UUID NOT NULL,
    "assignmentId" UUID,
    "type" "MissionLedgerType" NOT NULL,
    "points" INTEGER NOT NULL,
    "idempotencyKey" VARCHAR(192) NOT NULL,
    "actorUserId" UUID,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionCompletionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionRefillState" (
    "id" UUID NOT NULL,
    "participantWeekId" UUID NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "maxCredits" INTEGER NOT NULL DEFAULT 3,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 360,
    "anchorAt" TIMESTAMP(3) NOT NULL,
    "accountedThroughAt" TIMESTAMP(3) NOT NULL,
    "nextAccrualAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionRefillState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionRerollState" (
    "id" UUID NOT NULL,
    "participantWeekId" UUID NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "nextAvailableAt" TIMESTAMP(3),
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "totalUsed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionRerollState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionCandidateHistory" (
    "id" UUID NOT NULL,
    "participantWeekId" UUID NOT NULL,
    "missionDefinitionId" UUID NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "rerolledAt" TIMESTAMP(3),
    "timesAssigned" INTEGER NOT NULL DEFAULT 0,
    "status" "MissionCandidateStatus" NOT NULL DEFAULT 'UNSEEN',

    CONSTRAINT "MissionCandidateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCursor" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "lastRequestedStartAt" TIMESTAMP(3),
    "lastSuccessfulMatchStartAt" TIMESTAMP(3),
    "newestKnownMatchId" VARCHAR(128),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorCode" VARCHAR(64),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "nextEligibleAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" UUID NOT NULL,
    "invocationKey" VARCHAR(192) NOT NULL,
    "trigger" "SyncTrigger" NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "matchIdsFound" INTEGER NOT NULL DEFAULT 0,
    "matchesFetched" INTEGER NOT NULL DEFAULT 0,
    "matchesProcessed" INTEGER NOT NULL DEFAULT 0,
    "matchesSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "rateLimitSnapshot" JSONB,
    "requestedById" UUID,
    "metadata" JSONB,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRunItem" (
    "id" UUID NOT NULL,
    "syncRunId" UUID NOT NULL,
    "participantId" UUID,
    "riotMatchId" VARCHAR(128),
    "stage" VARCHAR(64) NOT NULL,
    "status" "SyncRunItemStatus" NOT NULL,
    "errorCode" VARCHAR(64),
    "messageSanitized" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobLease" (
    "key" VARCHAR(128) NOT NULL,
    "ownerToken" VARCHAR(128) NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "heartbeatAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobLease_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ProcessingOutbox" (
    "id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "aggregateId" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "dedupeKey" VARCHAR(192) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" UUID NOT NULL,
    "type" "LegalDocumentType" NOT NULL,
    "version" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "status" "LegalDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" UUID NOT NULL,
    "checksum" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" VARCHAR(128) NOT NULL,
    "targetType" VARCHAR(128) NOT NULL,
    "targetId" VARCHAR(128),
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "requestId" VARCHAR(128),
    "ipHash" VARCHAR(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "key" VARCHAR(128) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "description" TEXT NOT NULL,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" VARCHAR(128) NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" UUID NOT NULL,
    "type" "ExportJobType" NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "weekId" UUID,
    "requestedById" UUID NOT NULL,
    "objectPath" TEXT,
    "checksum" VARCHAR(128),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorCode" VARCHAR(64),

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "User_loginIdNormalized_key" ON "User"("loginIdNormalized");

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_jtiHash_key" ON "AuthSession"("jtiHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "LegalConsent_legalDocumentId_acceptedAt_idx" ON "LegalConsent"("legalDocumentId", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalConsent_userId_legalDocumentId_key" ON "LegalConsent"("userId", "legalDocumentId");

-- CreateIndex
CREATE INDEX "LoginAttempt_blockedUntil_idx" ON "LoginAttempt"("blockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "LoginAttempt_keyHash_windowStart_key" ON "LoginAttempt"("keyHash", "windowStart");

-- CreateIndex
CREATE INDEX "ParticipationApplication_riotIdNormalized_idx" ON "ParticipationApplication"("riotIdNormalized");

-- CreateIndex
CREATE INDEX "ParticipationApplication_status_submittedAt_idx" ON "ParticipationApplication"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "ParticipationApplication_userId_createdAt_idx" ON "ParticipationApplication"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_userId_key" ON "Participant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_puuid_key" ON "Participant"("puuid");

-- CreateIndex
CREATE INDEX "Participant_status_approvedAt_idx" ON "Participant"("status", "approvedAt");

-- CreateIndex
CREATE INDEX "Participant_gameName_tagLine_idx" ON "Participant"("gameName", "tagLine");

-- CreateIndex
CREATE INDEX "ParticipantIdentityHistory_participantId_validTo_idx" ON "ParticipantIdentityHistory"("participantId", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantIdentityHistory_participantId_validFrom_key" ON "ParticipantIdentityHistory"("participantId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Season_slug_key" ON "Season"("slug");

-- CreateIndex
CREATE INDEX "Season_status_startAt_endAt_idx" ON "Season"("status", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "Week_status_startAt_endAt_idx" ON "Week"("status", "startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "Week_seasonId_number_key" ON "Week"("seasonId", "number");

-- CreateIndex
CREATE INDEX "SeasonParticipant_seasonId_status_idx" ON "SeasonParticipant"("seasonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonParticipant_seasonId_participantId_key" ON "SeasonParticipant"("seasonId", "participantId");

-- CreateIndex
CREATE INDEX "ParticipantWeek_weekId_mainScoreCached_wins_losses_idx" ON "ParticipantWeek"("weekId", "mainScoreCached", "wins", "losses");

-- CreateIndex
CREATE INDEX "ParticipantWeek_weekId_missionScoreCached_idx" ON "ParticipantWeek"("weekId", "missionScoreCached");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantWeek_weekId_participantId_key" ON "ParticipantWeek"("weekId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "WeekSnapshot_weekId_key" ON "WeekSnapshot"("weekId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalStandingSnapshot_seasonId_key" ON "FinalStandingSnapshot"("seasonId");

-- CreateIndex
CREATE INDEX "RankSnapshot_participantId_capturedAt_idx" ON "RankSnapshot"("participantId", "capturedAt");

-- CreateIndex
CREATE INDEX "RankSnapshot_weekId_capturedAt_idx" ON "RankSnapshot"("weekId", "capturedAt");

-- CreateIndex
CREATE INDEX "RankSnapshot_seasonId_capturedAt_idx" ON "RankSnapshot"("seasonId", "capturedAt");

-- CreateIndex
CREATE INDEX "DailyStandingSnapshot_weekId_localDate_rank_idx" ON "DailyStandingSnapshot"("weekId", "localDate", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStandingSnapshot_weekId_participantId_localDate_key" ON "DailyStandingSnapshot"("weekId", "participantId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "Match_riotMatchId_key" ON "Match"("riotMatchId");

-- CreateIndex
CREATE INDEX "Match_gameStartAt_idx" ON "Match"("gameStartAt");

-- CreateIndex
CREATE INDEX "Match_queueId_gameStartAt_idx" ON "Match"("queueId", "gameStartAt");

-- CreateIndex
CREATE INDEX "Match_status_ingestedAt_idx" ON "Match"("status", "ingestedAt");

-- CreateIndex
CREATE INDEX "SeasonMatch_weekId_status_idx" ON "SeasonMatch"("weekId", "status");

-- CreateIndex
CREATE INDEX "SeasonMatch_seasonId_status_processedAt_idx" ON "SeasonMatch"("seasonId", "status", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonMatch_seasonId_matchId_key" ON "SeasonMatch"("seasonId", "matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchTeam_matchId_teamId_key" ON "MatchTeam"("matchId", "teamId");

-- CreateIndex
CREATE INDEX "MatchParticipantRaw_matchId_teamId_idx" ON "MatchParticipantRaw"("matchId", "teamId");

-- CreateIndex
CREATE INDEX "MatchParticipantRaw_puuid_matchId_idx" ON "MatchParticipantRaw"("puuid", "matchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchParticipantRaw_matchId_participantIndex_key" ON "MatchParticipantRaw"("matchId", "participantIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantMatch_matchParticipantRawId_key" ON "ParticipantMatch"("matchParticipantRawId");

-- CreateIndex
CREATE INDEX "ParticipantMatch_participantWeekId_createdAt_idx" ON "ParticipantMatch"("participantWeekId", "createdAt");

-- CreateIndex
CREATE INDEX "ParticipantMatch_participantWeekId_seasonMatchId_idx" ON "ParticipantMatch"("participantWeekId", "seasonMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantMatch_participantId_seasonMatchId_key" ON "ParticipantMatch"("participantId", "seasonMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "PointDraw_participantMatchId_key" ON "PointDraw"("participantMatchId");

-- CreateIndex
CREATE INDEX "PointDraw_state_firstGeneratedAt_idx" ON "PointDraw"("state", "firstGeneratedAt");

-- CreateIndex
CREATE INDEX "PointDraw_rerollEligible_rerollUsedAt_idx" ON "PointDraw"("rerollEligible", "rerollUsedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreLedger_idempotencyKey_key" ON "ScoreLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ScoreLedger_participantWeekId_createdAt_idx" ON "ScoreLedger"("participantWeekId", "createdAt");

-- CreateIndex
CREATE INDEX "ScoreLedger_participantMatchId_idx" ON "ScoreLedger"("participantMatchId");

-- CreateIndex
CREATE INDEX "ScoreLedger_type_createdAt_idx" ON "ScoreLedger"("type", "createdAt");

-- CreateIndex
CREATE INDEX "ScoreReconciliation_participantWeekId_checkedAt_idx" ON "ScoreReconciliation"("participantWeekId", "checkedAt");

-- CreateIndex
CREATE INDEX "ScoreReconciliation_difference_checkedAt_idx" ON "ScoreReconciliation"("difference", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MvpBaselineVersion_name_key" ON "MvpBaselineVersion"("name");

-- CreateIndex
CREATE INDEX "MvpBaselineVersion_status_publishedAt_idx" ON "MvpBaselineVersion"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MvpBaselineMetric_versionId_tierBucket_position_metricKey_key" ON "MvpBaselineMetric"("versionId", "tierBucket", "position", "metricKey");

-- CreateIndex
CREATE INDEX "MvpEvaluation_participantMatchId_award_idx" ON "MvpEvaluation"("participantMatchId", "award");

-- CreateIndex
CREATE UNIQUE INDEX "MvpEvaluation_matchParticipantRawId_baselineVersionId_key" ON "MvpEvaluation"("matchParticipantRawId", "baselineVersionId");

-- CreateIndex
CREATE INDEX "MissionDefinition_active_kind_difficulty_idx" ON "MissionDefinition"("active", "kind", "difficulty");

-- CreateIndex
CREATE INDEX "MissionDefinition_sourceType_active_idx" ON "MissionDefinition"("sourceType", "active");

-- CreateIndex
CREATE UNIQUE INDEX "MissionDefinition_code_version_key" ON "MissionDefinition"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMissionAssignment_selectionKey_key" ON "WeeklyMissionAssignment"("selectionKey");

-- CreateIndex
CREATE INDEX "WeeklyMissionAssignment_participantWeekId_state_idx" ON "WeeklyMissionAssignment"("participantWeekId", "state");

-- CreateIndex
CREATE INDEX "WeeklyMissionAssignment_participantWeekId_activeFrom_active_idx" ON "WeeklyMissionAssignment"("participantWeekId", "activeFrom", "activeTo");

-- CreateIndex
CREATE INDEX "WeeklyMissionAssignment_missionDefinitionId_state_idx" ON "WeeklyMissionAssignment"("missionDefinitionId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMissionAssignment_participantWeekId_missionDefinition_key" ON "WeeklyMissionAssignment"("participantWeekId", "missionDefinitionId", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "MissionProgressEvent_idempotencyKey_key" ON "MissionProgressEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MissionProgressEvent_assignmentId_createdAt_idx" ON "MissionProgressEvent"("assignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "MissionProgressEvent_participantMatchId_idx" ON "MissionProgressEvent"("participantMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionProgressEvent_assignmentId_participantMatchId_evalua_key" ON "MissionProgressEvent"("assignmentId", "participantMatchId", "evaluatorVersion");

-- CreateIndex
CREATE UNIQUE INDEX "MissionCompletionLedger_assignmentId_key" ON "MissionCompletionLedger"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionCompletionLedger_idempotencyKey_key" ON "MissionCompletionLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MissionCompletionLedger_participantWeekId_createdAt_idx" ON "MissionCompletionLedger"("participantWeekId", "createdAt");

-- CreateIndex
CREATE INDEX "MissionCompletionLedger_type_createdAt_idx" ON "MissionCompletionLedger"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MissionRefillState_participantWeekId_key" ON "MissionRefillState"("participantWeekId");

-- CreateIndex
CREATE INDEX "MissionRefillState_nextAccrualAt_idx" ON "MissionRefillState"("nextAccrualAt");

-- CreateIndex
CREATE UNIQUE INDEX "MissionRerollState_participantWeekId_key" ON "MissionRerollState"("participantWeekId");

-- CreateIndex
CREATE INDEX "MissionRerollState_nextAvailableAt_idx" ON "MissionRerollState"("nextAvailableAt");

-- CreateIndex
CREATE INDEX "MissionCandidateHistory_participantWeekId_status_firstSeenA_idx" ON "MissionCandidateHistory"("participantWeekId", "status", "firstSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "MissionCandidateHistory_participantWeekId_missionDefinition_key" ON "MissionCandidateHistory"("participantWeekId", "missionDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCursor_participantId_key" ON "SyncCursor"("participantId");

-- CreateIndex
CREATE INDEX "SyncCursor_nextEligibleAt_consecutiveFailures_idx" ON "SyncCursor"("nextEligibleAt", "consecutiveFailures");

-- CreateIndex
CREATE UNIQUE INDEX "SyncRun_invocationKey_key" ON "SyncRun"("invocationKey");

-- CreateIndex
CREATE INDEX "SyncRun_status_startedAt_idx" ON "SyncRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "SyncRun_trigger_startedAt_idx" ON "SyncRun"("trigger", "startedAt");

-- CreateIndex
CREATE INDEX "SyncRunItem_syncRunId_status_idx" ON "SyncRunItem"("syncRunId", "status");

-- CreateIndex
CREATE INDEX "SyncRunItem_participantId_createdAt_idx" ON "SyncRunItem"("participantId", "createdAt");

-- CreateIndex
CREATE INDEX "SyncRunItem_riotMatchId_idx" ON "SyncRunItem"("riotMatchId");

-- CreateIndex
CREATE INDEX "JobLease_expiresAt_idx" ON "JobLease"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessingOutbox_dedupeKey_key" ON "ProcessingOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "ProcessingOutbox_status_availableAt_idx" ON "ProcessingOutbox"("status", "availableAt");

-- CreateIndex
CREATE INDEX "Announcement_status_pinned_publishedAt_idx" ON "Announcement"("status", "pinned", "publishedAt");

-- CreateIndex
CREATE INDEX "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");

-- CreateIndex
CREATE INDEX "LegalDocument_status_effectiveAt_idx" ON "LegalDocument"("status", "effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_type_version_key" ON "LegalDocument"("type", "version");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx" ON "AuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ExportJob_status_createdAt_idx" ON "ExportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ExportJob_weekId_type_idx" ON "ExportJob"("weekId", "type");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalConsent" ADD CONSTRAINT "LegalConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalConsent" ADD CONSTRAINT "LegalConsent_legalDocumentId_fkey" FOREIGN KEY ("legalDocumentId") REFERENCES "LegalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationApplication" ADD CONSTRAINT "ParticipationApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipationApplication" ADD CONSTRAINT "ParticipationApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantIdentityHistory" ADD CONSTRAINT "ParticipantIdentityHistory_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Week" ADD CONSTRAINT "Week_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Week" ADD CONSTRAINT "Week_baselineVersionId_fkey" FOREIGN KEY ("baselineVersionId") REFERENCES "MvpBaselineVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipant" ADD CONSTRAINT "SeasonParticipant_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipant" ADD CONSTRAINT "SeasonParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipant" ADD CONSTRAINT "SeasonParticipant_startingRankSnapshotId_fkey" FOREIGN KEY ("startingRankSnapshotId") REFERENCES "RankSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantWeek" ADD CONSTRAINT "ParticipantWeek_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantWeek" ADD CONSTRAINT "ParticipantWeek_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekSnapshot" ADD CONSTRAINT "WeekSnapshot_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekSnapshot" ADD CONSTRAINT "WeekSnapshot_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalStandingSnapshot" ADD CONSTRAINT "FinalStandingSnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalStandingSnapshot" ADD CONSTRAINT "FinalStandingSnapshot_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankSnapshot" ADD CONSTRAINT "RankSnapshot_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankSnapshot" ADD CONSTRAINT "RankSnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankSnapshot" ADD CONSTRAINT "RankSnapshot_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStandingSnapshot" ADD CONSTRAINT "DailyStandingSnapshot_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStandingSnapshot" ADD CONSTRAINT "DailyStandingSnapshot_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMatch" ADD CONSTRAINT "SeasonMatch_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMatch" ADD CONSTRAINT "SeasonMatch_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMatch" ADD CONSTRAINT "SeasonMatch_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchTeam" ADD CONSTRAINT "MatchTeam_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchParticipantRaw" ADD CONSTRAINT "MatchParticipantRaw_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantMatch" ADD CONSTRAINT "ParticipantMatch_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantMatch" ADD CONSTRAINT "ParticipantMatch_participantWeekId_fkey" FOREIGN KEY ("participantWeekId") REFERENCES "ParticipantWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantMatch" ADD CONSTRAINT "ParticipantMatch_seasonMatchId_fkey" FOREIGN KEY ("seasonMatchId") REFERENCES "SeasonMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantMatch" ADD CONSTRAINT "ParticipantMatch_matchParticipantRawId_fkey" FOREIGN KEY ("matchParticipantRawId") REFERENCES "MatchParticipantRaw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointDraw" ADD CONSTRAINT "PointDraw_participantMatchId_fkey" FOREIGN KEY ("participantMatchId") REFERENCES "ParticipantMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreLedger" ADD CONSTRAINT "ScoreLedger_participantWeekId_fkey" FOREIGN KEY ("participantWeekId") REFERENCES "ParticipantWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreLedger" ADD CONSTRAINT "ScoreLedger_participantMatchId_fkey" FOREIGN KEY ("participantMatchId") REFERENCES "ParticipantMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreLedger" ADD CONSTRAINT "ScoreLedger_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreReconciliation" ADD CONSTRAINT "ScoreReconciliation_participantWeekId_fkey" FOREIGN KEY ("participantWeekId") REFERENCES "ParticipantWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreReconciliation" ADD CONSTRAINT "ScoreReconciliation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvpBaselineVersion" ADD CONSTRAINT "MvpBaselineVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvpBaselineMetric" ADD CONSTRAINT "MvpBaselineMetric_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "MvpBaselineVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvpEvaluation" ADD CONSTRAINT "MvpEvaluation_matchParticipantRawId_fkey" FOREIGN KEY ("matchParticipantRawId") REFERENCES "MatchParticipantRaw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvpEvaluation" ADD CONSTRAINT "MvpEvaluation_participantMatchId_fkey" FOREIGN KEY ("participantMatchId") REFERENCES "ParticipantMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MvpEvaluation" ADD CONSTRAINT "MvpEvaluation_baselineVersionId_fkey" FOREIGN KEY ("baselineVersionId") REFERENCES "MvpBaselineVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyMissionAssignment" ADD CONSTRAINT "WeeklyMissionAssignment_participantWeekId_fkey" FOREIGN KEY ("participantWeekId") REFERENCES "ParticipantWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyMissionAssignment" ADD CONSTRAINT "WeeklyMissionAssignment_missionDefinitionId_fkey" FOREIGN KEY ("missionDefinitionId") REFERENCES "MissionDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyMissionAssignment" ADD CONSTRAINT "WeeklyMissionAssignment_completedByParticipantMatchId_fkey" FOREIGN KEY ("completedByParticipantMatchId") REFERENCES "ParticipantMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionProgressEvent" ADD CONSTRAINT "MissionProgressEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WeeklyMissionAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionProgressEvent" ADD CONSTRAINT "MissionProgressEvent_participantMatchId_fkey" FOREIGN KEY ("participantMatchId") REFERENCES "ParticipantMatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionProgressEvent" ADD CONSTRAINT "MissionProgressEvent_supersedesEventId_fkey" FOREIGN KEY ("supersedesEventId") REFERENCES "MissionProgressEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionProgressEvent" ADD CONSTRAINT "MissionProgressEvent_correctedByUserId_fkey" FOREIGN KEY ("correctedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionCompletionLedger" ADD CONSTRAINT "MissionCompletionLedger_participantWeekId_fkey" FOREIGN KEY ("participantWeekId") REFERENCES "ParticipantWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionCompletionLedger" ADD CONSTRAINT "MissionCompletionLedger_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WeeklyMissionAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionCompletionLedger" ADD CONSTRAINT "MissionCompletionLedger_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionRefillState" ADD CONSTRAINT "MissionRefillState_participantWeekId_fkey" FOREIGN KEY ("participantWeekId") REFERENCES "ParticipantWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionRerollState" ADD CONSTRAINT "MissionRerollState_participantWeekId_fkey" FOREIGN KEY ("participantWeekId") REFERENCES "ParticipantWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionCandidateHistory" ADD CONSTRAINT "MissionCandidateHistory_participantWeekId_fkey" FOREIGN KEY ("participantWeekId") REFERENCES "ParticipantWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionCandidateHistory" ADD CONSTRAINT "MissionCandidateHistory_missionDefinitionId_fkey" FOREIGN KEY ("missionDefinitionId") REFERENCES "MissionDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncCursor" ADD CONSTRAINT "SyncCursor_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRunItem" ADD CONSTRAINT "SyncRunItem_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRunItem" ADD CONSTRAINT "SyncRunItem_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocument" ADD CONSTRAINT "LegalDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL invariants that Prisma schema syntax cannot express.
ALTER TABLE "User"
  ADD CONSTRAINT "User_loginIdNormalized_lowercase_check"
  CHECK ("loginIdNormalized" = lower("loginIdNormalized"));

CREATE UNIQUE INDEX "ParticipationApplication_one_pending_per_user"
  ON "ParticipationApplication" ("userId")
  WHERE "status" = 'PENDING';

ALTER TABLE "Season"
  ADD CONSTRAINT "Season_time_range_check" CHECK ("startAt" < "endAt"),
  ADD CONSTRAINT "Season_min_duration_check" CHECK ("minGameDurationSeconds" >= 600),
  ADD CONSTRAINT "Season_auto_reveal_hours_check" CHECK ("autoRevealHours" BETWEEN 1 AND 168);

ALTER TABLE "Week"
  ADD CONSTRAINT "Week_number_check" CHECK ("number" > 0),
  ADD CONSTRAINT "Week_time_range_check" CHECK ("startAt" < "endAt");

ALTER TABLE "ParticipantWeek"
  ADD CONSTRAINT "ParticipantWeek_nonnegative_counts_check"
  CHECK (
    "wins" >= 0 AND "losses" >= 0 AND "currentStreakCount" >= 0
    AND "bestWinStreak" >= 0 AND "mvpCount" >= 0 AND "aceCount" >= 0
  );

ALTER TABLE "Match"
  ADD CONSTRAINT "Match_time_range_check" CHECK ("gameStartAt" <= "gameEndAt"),
  ADD CONSTRAINT "Match_duration_check" CHECK ("durationSeconds" >= 0);

ALTER TABLE "MatchTeam"
  ADD CONSTRAINT "MatchTeam_team_id_check" CHECK ("teamId" IN (100, 200)),
  ADD CONSTRAINT "MatchTeam_nonnegative_stats_check"
  CHECK (
    "championKills" >= 0 AND "towerKills" >= 0 AND "inhibitorKills" >= 0
    AND "dragonKills" >= 0 AND "baronKills" >= 0 AND "heraldKills" >= 0
  );

ALTER TABLE "MatchParticipantRaw"
  ADD CONSTRAINT "MatchParticipantRaw_index_check" CHECK ("participantIndex" BETWEEN 1 AND 10),
  ADD CONSTRAINT "MatchParticipantRaw_team_id_check" CHECK ("teamId" IN (100, 200)),
  ADD CONSTRAINT "MatchParticipantRaw_nonnegative_stats_check"
  CHECK (
    "kills" >= 0 AND "deaths" >= 0 AND "assists" >= 0
    AND "totalMinionsKilled" >= 0 AND "neutralMinionsKilled" >= 0
    AND "goldEarned" >= 0 AND "damageToChampions" >= 0
    AND "damageTaken" >= 0 AND "damageMitigated" >= 0
    AND "damageToObjectives" >= 0 AND "damageToTurrets" >= 0
    AND "visionScore" >= 0 AND "wardsPlaced" >= 0 AND "wardsKilled" >= 0
    AND "controlWardsPlaced" >= 0 AND "timeCCingOthers" >= 0
    AND "healOnTeammates" >= 0 AND "shieldOnTeammates" >= 0
  );

ALTER TABLE "ParticipantMatch"
  ADD CONSTRAINT "ParticipantMatch_nonnegative_stats_check"
  CHECK ("kills" >= 0 AND "deaths" >= 0 AND "assists" >= 0 AND "cs" >= 0),
  ADD CONSTRAINT "ParticipantMatch_kda_check" CHECK ("kda" >= 0),
  ADD CONSTRAINT "ParticipantMatch_kill_participation_check"
  CHECK ("killParticipation" IS NULL OR "killParticipation" BETWEEN 0 AND 1);

ALTER TABLE "PointDraw"
  ADD CONSTRAINT "PointDraw_result_sign_check" CHECK ("resultSign" IN (-1, 1)),
  ADD CONSTRAINT "PointDraw_first_value_check" CHECK ("firstValue" BETWEEN 17 AND 23),
  ADD CONSTRAINT "PointDraw_second_value_check" CHECK ("secondValue" IS NULL OR "secondValue" BETWEEN 17 AND 23),
  ADD CONSTRAINT "PointDraw_final_value_check" CHECK ("finalValue" BETWEEN 17 AND 23),
  ADD CONSTRAINT "PointDraw_final_signed_value_check" CHECK ("finalSignedValue" = "resultSign" * "finalValue"),
  ADD CONSTRAINT "PointDraw_second_result_coherence_check"
  CHECK (
    ("secondValue" IS NULL AND "secondCommitment" IS NULL AND "secondRngVersion" IS NULL AND "rerollUsedAt" IS NULL)
    OR
    ("secondValue" IS NOT NULL AND "secondCommitment" IS NOT NULL AND "secondRngVersion" IS NOT NULL AND "rerollUsedAt" IS NOT NULL)
  );

ALTER TABLE "MvpBaselineMetric"
  ADD CONSTRAINT "MvpBaselineMetric_std_dev_check" CHECK ("stdDev" > 0),
  ADD CONSTRAINT "MvpBaselineMetric_sample_size_check" CHECK ("sampleSize" > 0),
  ADD CONSTRAINT "MvpBaselineMetric_bounds_check"
  CHECK ("lowerBound" IS NULL OR "upperBound" IS NULL OR "lowerBound" <= "upperBound");

ALTER TABLE "MvpEvaluation"
  ADD CONSTRAINT "MvpEvaluation_team_rank_check" CHECK ("teamRank" BETWEEN 1 AND 5);

ALTER TABLE "MissionDefinition"
  ADD CONSTRAINT "MissionDefinition_version_check" CHECK ("version" > 0),
  ADD CONSTRAINT "MissionDefinition_points_check" CHECK ("points" > 0),
  ADD CONSTRAINT "MissionDefinition_target_check" CHECK ("target" >= 0);

ALTER TABLE "WeeklyMissionAssignment"
  ADD CONSTRAINT "WeeklyMissionAssignment_generation_check" CHECK ("generation" > 0),
  ADD CONSTRAINT "WeeklyMissionAssignment_time_range_check" CHECK ("activeTo" IS NULL OR "activeFrom" <= "activeTo"),
  ADD CONSTRAINT "WeeklyMissionAssignment_progress_check" CHECK ("progress" >= 0 AND "target" >= 0),
  ADD CONSTRAINT "WeeklyMissionAssignment_completion_check"
  CHECK (
    ("state" = 'COMPLETED' AND "completedAt" IS NOT NULL)
    OR ("state" <> 'COMPLETED')
  );

CREATE UNIQUE INDEX "WeeklyMissionAssignment_one_active_definition"
  ON "WeeklyMissionAssignment" ("participantWeekId", "missionDefinitionId")
  WHERE "state" = 'ACTIVE';

ALTER TABLE "MissionProgressEvent"
  ADD CONSTRAINT "MissionProgressEvent_values_check"
  CHECK ("afterValue" = "beforeValue" + "deltaValue" AND "beforeValue" >= 0 AND "afterValue" >= 0),
  ADD CONSTRAINT "MissionProgressEvent_correction_check"
  CHECK (
    ("type" = 'NORMAL' AND "supersedesEventId" IS NULL AND "correctionReason" IS NULL)
    OR
    ("type" = 'CORRECTION' AND "supersedesEventId" IS NOT NULL AND "correctionReason" IS NOT NULL)
  );

ALTER TABLE "MissionRefillState"
  ADD CONSTRAINT "MissionRefillState_credit_check" CHECK ("credits" BETWEEN 0 AND "maxCredits"),
  ADD CONSTRAINT "MissionRefillState_max_credit_check" CHECK ("maxCredits" BETWEEN 0 AND 3),
  ADD CONSTRAINT "MissionRefillState_interval_check" CHECK ("intervalMinutes" > 0);

ALTER TABLE "MissionRerollState"
  ADD CONSTRAINT "MissionRerollState_cooldown_check" CHECK ("cooldownMinutes" > 0),
  ADD CONSTRAINT "MissionRerollState_total_used_check" CHECK ("totalUsed" >= 0);

ALTER TABLE "SyncCursor"
  ADD CONSTRAINT "SyncCursor_failures_check" CHECK ("consecutiveFailures" >= 0);

ALTER TABLE "SyncRun"
  ADD CONSTRAINT "SyncRun_counts_check"
  CHECK (
    "participantCount" >= 0 AND "matchIdsFound" >= 0 AND "matchesFetched" >= 0
    AND "matchesProcessed" >= 0 AND "matchesSkipped" >= 0 AND "errorCount" >= 0
  );

ALTER TABLE "JobLease"
  ADD CONSTRAINT "JobLease_time_range_check"
  CHECK ("acquiredAt" <= "heartbeatAt" AND "heartbeatAt" < "expiresAt");

ALTER TABLE "ProcessingOutbox"
  ADD CONSTRAINT "ProcessingOutbox_attempts_check" CHECK ("attempts" >= 0);

-- Cross-table consistency prevents a participant, week, or season from being
-- accidentally connected to a valid but unrelated row.
CREATE FUNCTION "assert_season_match_week"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Week"
    WHERE "id" = NEW."weekId" AND "seasonId" = NEW."seasonId"
  ) THEN
    RAISE EXCEPTION 'SeasonMatch week must belong to its season' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SeasonMatch_week_consistency"
  BEFORE INSERT OR UPDATE ON "SeasonMatch"
  FOR EACH ROW EXECUTE FUNCTION "assert_season_match_week"();

CREATE FUNCTION "assert_participant_match_scope"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "ParticipantWeek" pw
    JOIN "SeasonMatch" sm ON sm."weekId" = pw."weekId"
    WHERE pw."id" = NEW."participantWeekId"
      AND pw."participantId" = NEW."participantId"
      AND sm."id" = NEW."seasonMatchId"
  ) THEN
    RAISE EXCEPTION 'ParticipantMatch participant/week/season match scope mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ParticipantMatch_scope_consistency"
  BEFORE INSERT OR UPDATE ON "ParticipantMatch"
  FOR EACH ROW EXECUTE FUNCTION "assert_participant_match_scope"();

CREATE FUNCTION "assert_point_draw_sign"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "ParticipantMatch" pm
    WHERE pm."id" = NEW."participantMatchId"
      AND NEW."resultSign" = CASE WHEN pm."win" THEN 1 ELSE -1 END
  ) THEN
    RAISE EXCEPTION 'PointDraw sign must match ParticipantMatch result' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PointDraw_result_sign_consistency"
  BEFORE INSERT OR UPDATE ON "PointDraw"
  FOR EACH ROW EXECUTE FUNCTION "assert_point_draw_sign"();

CREATE FUNCTION "assert_score_ledger_scope"() RETURNS trigger AS $$
BEGIN
  IF NEW."participantMatchId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "ParticipantMatch" pm
    WHERE pm."id" = NEW."participantMatchId"
      AND pm."participantWeekId" = NEW."participantWeekId"
  ) THEN
    RAISE EXCEPTION 'ScoreLedger participant week must match ParticipantMatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ScoreLedger_scope_consistency"
  BEFORE INSERT ON "ScoreLedger"
  FOR EACH ROW EXECUTE FUNCTION "assert_score_ledger_scope"();

CREATE FUNCTION "assert_mission_event_scope"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "WeeklyMissionAssignment" assignment
    JOIN "ParticipantMatch" pm
      ON pm."participantWeekId" = assignment."participantWeekId"
    WHERE assignment."id" = NEW."assignmentId"
      AND pm."id" = NEW."participantMatchId"
  ) THEN
    RAISE EXCEPTION 'Mission event assignment and match must share participant week' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MissionProgressEvent_scope_consistency"
  BEFORE INSERT ON "MissionProgressEvent"
  FOR EACH ROW EXECUTE FUNCTION "assert_mission_event_scope"();

CREATE FUNCTION "assert_mission_completion_scope"() RETURNS trigger AS $$
BEGIN
  IF NEW."assignmentId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "WeeklyMissionAssignment" assignment
    WHERE assignment."id" = NEW."assignmentId"
      AND assignment."participantWeekId" = NEW."participantWeekId"
  ) THEN
    RAISE EXCEPTION 'Mission completion participant week must match assignment' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MissionCompletionLedger_scope_consistency"
  BEFORE INSERT ON "MissionCompletionLedger"
  FOR EACH ROW EXECUTE FUNCTION "assert_mission_completion_scope"();

-- These records are authoritative history. Corrections are represented by new
-- rows, never UPDATE or DELETE operations.
CREATE FUNCTION "prevent_append_only_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; add a correction/reversal row instead', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ScoreLedger_append_only"
  BEFORE UPDATE OR DELETE ON "ScoreLedger"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();

CREATE TRIGGER "MissionProgressEvent_append_only"
  BEFORE UPDATE OR DELETE ON "MissionProgressEvent"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();

CREATE TRIGGER "MissionCompletionLedger_append_only"
  BEFORE UPDATE OR DELETE ON "MissionCompletionLedger"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();

CREATE TRIGGER "LegalConsent_append_only"
  BEFORE UPDATE OR DELETE ON "LegalConsent"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();

CREATE TRIGGER "AuditLog_append_only"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();

CREATE TRIGGER "WeekSnapshot_immutable"
  BEFORE UPDATE OR DELETE ON "WeekSnapshot"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();

CREATE TRIGGER "FinalStandingSnapshot_immutable"
  BEFORE UPDATE OR DELETE ON "FinalStandingSnapshot"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
