import "dotenv/config";

import { createHash } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  ApplicationStatus,
  BaselineStatus,
  DrawState,
  LegalDocumentStatus,
  LegalDocumentType,
  MatchStatus,
  MissionAssignmentState,
  MissionCandidateStatus,
  MissionLedgerType,
  ParticipantStatus,
  Position,
  Prisma,
  PrismaClient,
  ScoringMode,
  ScoreLedgerType,
  SeasonParticipantStatus,
  SeasonStatus,
  SnapshotSource,
  StreakType,
  SyncRunStatus,
  SyncTrigger,
  TierBucket,
  UserRole,
  UserStatus,
  VerificationStatus,
  WeekStatus,
} from "../src/generated/prisma/client";
import { hashPassword } from "../src/features/auth/password";
import {
  createDrawCommitment,
  DRAW_COMMITMENT_VERSION,
  DRAW_RNG_VERSION,
} from "../src/domain/scoring/point-draw";
import { protectDrawNonce } from "../src/domain/scoring/nonce-protection";
import { MVP_METRIC_KEYS } from "../src/domain/mvp/contract";
import { prismaPgAdapterConfig } from "../src/lib/database-url";
import { readMissionCatalog } from "./mission-catalog";
import { assertDevelopmentSeedAllowed } from "./seed-safety";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the development database.");
}

const defaultSeedPassword = "DeluxeSoloq-Dev-Only-2026!";
const seedPassword = process.env.SEED_PASSWORD ?? defaultSeedPassword;
const pointDrawProtectionSecret =
  process.env.POINT_DRAW_SECRET ??
  process.env.AUTH_SECRET ??
  "DEMO_ONLY_DRAW_PROTECTION_SECRET_32_BYTES";

assertDevelopmentSeedAllowed(process.env.NODE_ENV);

const adapterConfig = prismaPgAdapterConfig(databaseUrl);
const adapter = new PrismaPg(
  adapterConfig.poolConfig,
  adapterConfig.adapterOptions,
);
const prisma = new PrismaClient({ adapter });

const DAY_MS = 24 * 60 * 60 * 1_000;
const HOUR_MS = 60 * 60 * 1_000;
const SEED_IDENTITY_VALID_FROM = new Date("2026-01-01T00:00:00.000Z");

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

function offset(base: Date, milliseconds: number) {
  return new Date(base.getTime() + milliseconds);
}

function kstDateOnly(base: Date, dayOffset: number) {
  const shifted = new Date(base.getTime() + 9 * HOUR_MS + dayOffset * DAY_MS);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ),
  );
}

function jsonObject(entries: Prisma.InputJsonObject): Prisma.InputJsonObject {
  return entries;
}

function requiredAt<T>(items: readonly T[], index: number, label: string): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Missing ${label} at index ${index}.`);
  }
  return item;
}

function participantIdentity(index: number) {
  const gameNames = [
    "GraphiteCarry",
    "한글로아주긴소환사이름",
    "NeverSurrenderTwentyThree",
    "LaneKing",
    "정글은내운명",
    "MidnightOperator",
    "BottomDiffArchive",
    "UtilityFirst",
    "BaronBeforeBedtime",
    "VisionScoreCollector",
    "TopSideOnly",
    "DragonStacker",
    "NoFlashExperiment",
    "CSPerMinuteTester",
    "CommitmentVerifier",
    "ReducedMotionPlayer",
    "TimelineDependent",
    "EmeraldClimber",
    "LongRiotIdentifierExample",
    "NoRecordedGamesYet",
  ];

  const gameName = requiredAt(gameNames, index, "participant game name");

  return {
    loginId: `player${String(index + 1).padStart(2, "0")}`,
    gameName,
    tagLine:
      index % 4 === 0 ? `KR${String(index + 1).padStart(3, "0")}` : "KR1",
    puuid: `DEMO_ONLY_PUUID_${String(index + 1).padStart(3, "0")}`,
    summonerId: `DEMO_ONLY_SUMMONER_${String(index + 1).padStart(3, "0")}`,
  };
}

async function upsertApplication(input: {
  userId: string;
  gameName: string;
  tagLine: string;
  puuid?: string;
  status: ApplicationStatus;
  verificationStatus: VerificationStatus;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedById?: string;
  primaryPosition?: Position;
  secondaryPosition?: Position;
}) {
  const existing = await prisma.participationApplication.findFirst({
    where: { userId: input.userId, status: input.status },
  });
  const data = {
    gameName: input.gameName,
    tagLine: input.tagLine,
    riotIdNormalized: `${input.gameName}#${input.tagLine}`.toLocaleLowerCase(
      "en-US",
    ),
    puuid: input.puuid ?? null,
    summonerId: input.puuid?.replace("PUUID", "SUMMONER") ?? null,
    profileIconId: 29,
    soloTier: "EMERALD",
    soloRank: "II",
    soloLeaguePoints: 42,
    primaryPosition: input.primaryPosition ?? Position.MIDDLE,
    secondaryPosition: input.secondaryPosition ?? Position.JUNGLE,
    status: input.status,
    verificationStatus: input.verificationStatus,
    submittedAt: input.submittedAt,
    reviewedAt: input.reviewedAt ?? null,
    reviewedById: input.reviewedById ?? null,
    reviewReason:
      input.status === ApplicationStatus.APPROVED
        ? "Deterministic development fixture"
        : null,
  };

  if (existing) {
    return prisma.participationApplication.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.participationApplication.create({
    data: { userId: input.userId, ...data },
  });
}

function rawParticipantData(
  matchId: string,
  participantIndex: number,
  win: boolean,
) {
  const teamId = participantIndex <= 5 ? 100 : 200;
  const didWin = teamId === 100 ? win : !win;
  const position = requiredAt(
    [
      Position.TOP,
      Position.JUNGLE,
      Position.MIDDLE,
      Position.BOTTOM,
      Position.UTILITY,
    ],
    (participantIndex - 1) % 5,
    "match participant position",
  );
  return {
    matchId,
    puuid: `DEMO_MATCH_PUUID_${participantIndex}`,
    teamId,
    participantIndex,
    position,
    startingTier: "PLATINUM",
    tierBucket: TierBucket.PLATINUM,
    championId: 10 + participantIndex,
    championName: `FixtureChampion${participantIndex}`,
    win: didWin,
    kills: didWin ? participantIndex + 2 : participantIndex % 4,
    deaths: didWin ? participantIndex % 3 : 5,
    assists: didWin ? 12 - participantIndex : participantIndex + 1,
    totalMinionsKilled: 120 + participantIndex * 9,
    neutralMinionsKilled: participantIndex % 5 === 2 ? 90 : 8,
    goldEarned: 10_000 + participantIndex * 700,
    damageToChampions: 14_000 + participantIndex * 1_800,
    damageTaken: 12_000 + participantIndex * 1_500,
    damageMitigated: 8_000 + participantIndex * 1_200,
    damageToObjectives: 4_000 + participantIndex * 900,
    damageToTurrets: 1_000 + participantIndex * 400,
    visionScore: 18 + participantIndex * 4,
    wardsPlaced: 5 + participantIndex,
    wardsKilled: participantIndex % 6,
    controlWardsPlaced: participantIndex % 4,
    timeCCingOthers: participantIndex * 3,
    healOnTeammates: participantIndex === 5 ? 8_000 : 0,
    shieldOnTeammates: participantIndex === 5 ? 6_000 : 0,
    items: jsonObject({ ids: [1001, 2003, 3078] }),
    perks: jsonObject({ primaryStyle: 8000 }),
    summonerSpells: jsonObject({ spell1: 4, spell2: 14 }),
    challenges: jsonObject({ soloKills: participantIndex % 4 }),
    normalizedMetrics: jsonObject({ fixture: true, championLevel: 18 }),
  };
}

async function main() {
  const now = new Date();
  const passwordHash = await hashPassword(seedPassword);

  const admin = await prisma.user.upsert({
    where: { loginIdNormalized: "admin" },
    update: {
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      loginId: "admin",
      loginIdNormalized: "admin",
      realName: "개발 관리자",
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
    },
  });

  const pendingUser = await prisma.user.upsert({
    where: { loginIdNormalized: "pending-user" },
    update: { passwordHash, status: UserStatus.ACTIVE },
    create: {
      loginId: "pending-user",
      loginIdNormalized: "pending-user",
      realName: "승인 대기 회원",
      passwordHash,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
    },
  });

  await upsertApplication({
    userId: pendingUser.id,
    gameName: "ApprovalPendingPlayer",
    tagLine: "WAIT",
    puuid: "MOCK_PUUID_APPROVAL_PENDING_WAIT",
    status: ApplicationStatus.PENDING,
    verificationStatus: VerificationStatus.VERIFIED,
    submittedAt: offset(now, -2 * HOUR_MS),
  });

  const legalDocuments = [];
  for (const [type, title] of [
    [LegalDocumentType.TERMS, "개발용 이용약관"],
    [LegalDocumentType.PRIVACY, "개발용 개인정보 처리방침"],
    [LegalDocumentType.RULES, "디럭스 솔랭 대회 규칙"],
    [LegalDocumentType.RIOT_DISCLAIMER, "Riot 비공식 대회 고지"],
  ] as const) {
    legalDocuments.push(
      await prisma.legalDocument.upsert({
        where: { type_version: { type, version: 1 } },
        update: {
          title,
          body: `${title}의 DEMO_ONLY 개발 fixture입니다. 운영 전에 게시 버전으로 교체해야 합니다.`,
          effectiveAt: offset(now, -30 * DAY_MS),
          publishedAt: offset(now, -30 * DAY_MS),
          status: LegalDocumentStatus.PUBLISHED,
          checksum: sha256(`${type}:v1`),
        },
        create: {
          type,
          version: 1,
          title,
          body: `${title}의 DEMO_ONLY 개발 fixture입니다. 운영 전에 게시 버전으로 교체해야 합니다.`,
          effectiveAt: offset(now, -30 * DAY_MS),
          publishedAt: offset(now, -30 * DAY_MS),
          status: LegalDocumentStatus.PUBLISHED,
          createdById: admin.id,
          checksum: sha256(`${type}:v1`),
        },
      }),
    );
  }

  for (const user of [admin, pendingUser]) {
    await prisma.legalConsent.createMany({
      data: legalDocuments.slice(0, 2).map((document) => ({
        userId: user.id,
        legalDocumentId: document.id,
        acceptedAt: now,
        source: "SEED_SIGNUP",
      })),
      skipDuplicates: true,
    });
  }

  const baseline = await prisma.mvpBaselineVersion.upsert({
    where: { name: "DEMO_ONLY-v1" },
    update: {},
    create: {
      name: "DEMO_ONLY-v1",
      status: BaselineStatus.VALIDATED,
      sourceDescription: "DEMO_ONLY synthetic MVP/ACE baseline",
      patchFrom: "DEMO",
      patchTo: "DEMO",
      collectedAt: now,
      sampleNotes: "Synthetic metrics. Production rewards are forbidden.",
      demoOnly: true,
      checksum: sha256("DEMO_ONLY-v1"),
      uploadedById: admin.id,
    },
  });

  if (
    baseline.status !== BaselineStatus.PUBLISHED &&
    baseline.status !== BaselineStatus.RETIRED
  ) {
    await prisma.mvpBaselineMetric.deleteMany({
      where: {
        versionId: baseline.id,
        metricKey: { notIn: [...MVP_METRIC_KEYS] },
      },
    });
    for (const tierBucket of Object.values(TierBucket)) {
      for (const position of Object.values(Position)) {
        for (const [metricIndex, metricKey] of MVP_METRIC_KEYS.entries()) {
          await prisma.mvpBaselineMetric.upsert({
            where: {
              versionId_tierBucket_position_metricKey: {
                versionId: baseline.id,
                tierBucket,
                position,
                metricKey,
              },
            },
            update: {
              mean: 1 + metricIndex * 0.25,
              stdDev: 1 + metricIndex * 0.05,
              sampleSize: 100,
              lowerBound: 0,
              upperBound: 1_000,
            },
            create: {
              versionId: baseline.id,
              tierBucket,
              position,
              metricKey,
              mean: 1 + metricIndex * 0.25,
              stdDev: 1 + metricIndex * 0.05,
              sampleSize: 100,
              lowerBound: 0,
              upperBound: 1_000,
            },
          });
        }
      }
    }
    await prisma.mvpBaselineVersion.update({
      where: { id: baseline.id },
      data: { status: BaselineStatus.PUBLISHED, publishedAt: now },
    });
  }

  const activeSeason = await prisma.season.upsert({
    where: { slug: "development-active-season" },
    update: {
      status: SeasonStatus.ACTIVE,
      startAt: offset(now, -10 * DAY_MS),
      endAt: offset(now, 4 * DAY_MS),
    },
    create: {
      name: "개발 진행 시즌",
      slug: "development-active-season",
      description: "DEMO_ONLY 20인 대회 fixture",
      status: SeasonStatus.ACTIVE,
      timezone: "Asia/Seoul",
      startAt: offset(now, -10 * DAY_MS),
      endAt: offset(now, 4 * DAY_MS),
      scoringMode: ScoringMode.RANDOM_17_23,
      minGameDurationSeconds: 600,
      autoRevealHours: 12,
      rulesVersion: "development-v1",
      config: jsonObject({ demoOnly: true, queueId: 420 }),
      createdById: admin.id,
    },
  });

  await prisma.week.upsert({
    where: { seasonId_number: { seasonId: activeSeason.id, number: 1 } },
    update: {
      status: WeekStatus.COMPLETED,
      startAt: offset(now, -10 * DAY_MS),
      endAt: offset(now, -3 * DAY_MS),
      finalizedAt: offset(now, -3 * DAY_MS),
    },
    create: {
      seasonId: activeSeason.id,
      number: 1,
      name: "1주차",
      status: WeekStatus.COMPLETED,
      startAt: offset(now, -10 * DAY_MS),
      endAt: offset(now, -3 * DAY_MS),
      baselineVersionId: baseline.id,
      missionCatalogVersion: "v1",
      rulesSnapshot: jsonObject({ version: "development-v1" }),
      finalizedAt: offset(now, -3 * DAY_MS),
    },
  });

  const activeWeek = await prisma.week.upsert({
    where: { seasonId_number: { seasonId: activeSeason.id, number: 2 } },
    update: {
      status: WeekStatus.ACTIVE,
      startAt: offset(now, -3 * DAY_MS),
      endAt: offset(now, 4 * DAY_MS),
      finalizedAt: null,
    },
    create: {
      seasonId: activeSeason.id,
      number: 2,
      name: "2주차",
      status: WeekStatus.ACTIVE,
      startAt: offset(now, -3 * DAY_MS),
      endAt: offset(now, 4 * DAY_MS),
      baselineVersionId: baseline.id,
      missionCatalogVersion: "v1",
      rulesSnapshot: jsonObject({ version: "development-v1" }),
    },
  });

  const completedSeason = await prisma.season.upsert({
    where: { slug: "development-completed-season" },
    update: { status: SeasonStatus.COMPLETED },
    create: {
      name: "개발 종료 시즌",
      slug: "development-completed-season",
      description: "Final snapshot 검증용 DEMO_ONLY 시즌",
      status: SeasonStatus.COMPLETED,
      timezone: "Asia/Seoul",
      startAt: offset(now, -42 * DAY_MS),
      endAt: offset(now, -28 * DAY_MS),
      scoringMode: ScoringMode.FIXED_20,
      minGameDurationSeconds: 600,
      autoRevealHours: 12,
      rulesVersion: "development-archive-v1",
      config: jsonObject({ demoOnly: true, finalized: true }),
      createdById: admin.id,
    },
  });

  const completedWeek = await prisma.week.upsert({
    where: { seasonId_number: { seasonId: completedSeason.id, number: 1 } },
    update: { status: WeekStatus.COMPLETED },
    create: {
      seasonId: completedSeason.id,
      number: 1,
      name: "종료 주차",
      status: WeekStatus.COMPLETED,
      startAt: offset(now, -42 * DAY_MS),
      endAt: offset(now, -35 * DAY_MS),
      baselineVersionId: baseline.id,
      missionCatalogVersion: "v1",
      rulesSnapshot: jsonObject({ version: "development-archive-v1" }),
      finalizedAt: offset(now, -35 * DAY_MS),
    },
  });

  const archivedStandings = [0, 1, 2, 3, 4].map((index) => {
    const identity = participantIdentity(index);
    return {
      rank: index + 1,
      participantId: null,
      gameName: identity.gameName,
      tagLine: identity.tagLine,
      realName: null,
      score: 280 - index * 31,
      wins: 12 - index,
      losses: 4 + index,
      completed: 0,
    };
  });
  const archivedMissionStandings = [1, 0, 3, 2, 4].map(
    (identityIndex, index) => {
      const identity = participantIdentity(identityIndex);
      return {
        rank: index + 1,
        participantId: null,
        gameName: identity.gameName,
        tagLine: identity.tagLine,
        realName: null,
        score: 15 - index * 2,
        wins: 0,
        losses: 0,
        completed: 5 - index,
      };
    },
  );

  if (
    !(await prisma.weekSnapshot.findUnique({
      where: { weekId: completedWeek.id },
    }))
  ) {
    await prisma.weekSnapshot.create({
      data: {
        weekId: completedWeek.id,
        generatedAt: offset(now, -35 * DAY_MS),
        rulesSnapshot: jsonObject({ version: "development-archive-v1" }),
        standings: archivedStandings,
        missionStandings: archivedMissionStandings,
        highlights: jsonObject({ demoOnly: true }),
        checksum: sha256("completed-week-snapshot"),
        generatedById: admin.id,
      },
    });
  }

  if (
    !(await prisma.finalStandingSnapshot.findUnique({
      where: { seasonId: completedSeason.id },
    }))
  ) {
    await prisma.finalStandingSnapshot.create({
      data: {
        seasonId: completedSeason.id,
        generatedAt: offset(now, -28 * DAY_MS),
        rulesSnapshot: jsonObject({ version: "development-archive-v1" }),
        weekSnapshotRefs: [completedWeek.id],
        standings: archivedStandings,
        highlights: jsonObject({ demoOnly: true }),
        checksum: sha256("completed-season-snapshot"),
        generatedById: admin.id,
      },
    });
  }

  const missionDefinitions = [];
  for (const definition of await readMissionCatalog()) {
    missionDefinitions.push(
      await prisma.missionDefinition.upsert({
        where: { code_version: { code: definition.code, version: 1 } },
        update: definition,
        create: definition,
      }),
    );
  }

  const leaderboardScores = [
    120, 120, 98, 74, 53, 41, 28, 17, 8, 0, -4, -13, -25, -38, -51, -64, -78,
    -92, -110, 0,
  ];
  const participants = [];
  const participantWeeks = [];

  for (let index = 0; index < 20; index += 1) {
    const identity = participantIdentity(index);
    const positions = Object.values(Position);
    const primaryPosition = requiredAt(
      positions,
      index % positions.length,
      "primary position",
    );
    const secondaryPosition = requiredAt(
      positions,
      (index + 1) % positions.length,
      "secondary position",
    );
    const leaderboardScore = requiredAt(
      leaderboardScores,
      index,
      "leaderboard score",
    );
    const missionScore = index === 0 ? 2 : index === 1 ? 3 : 0;
    const missionRank = index === 1 ? 1 : index === 0 ? 2 : 3;
    const user = await prisma.user.upsert({
      where: { loginIdNormalized: identity.loginId },
      update: { passwordHash, status: UserStatus.ACTIVE },
      create: {
        loginId: identity.loginId,
        loginIdNormalized: identity.loginId,
        realName: `개발 참가자 ${String(index + 1).padStart(2, "0")}`,
        passwordHash,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        termsAcceptedAt: offset(now, -14 * DAY_MS),
        privacyAcceptedAt: offset(now, -14 * DAY_MS),
      },
    });

    await prisma.legalConsent.createMany({
      data: legalDocuments.slice(0, 2).map((document) => ({
        userId: user.id,
        legalDocumentId: document.id,
        acceptedAt: offset(now, -14 * DAY_MS),
        source: "SEED_SIGNUP",
      })),
      skipDuplicates: true,
    });

    await upsertApplication({
      userId: user.id,
      gameName: identity.gameName,
      tagLine: identity.tagLine,
      puuid: identity.puuid,
      status: ApplicationStatus.APPROVED,
      verificationStatus: VerificationStatus.VERIFIED,
      submittedAt: offset(now, -13 * DAY_MS),
      reviewedAt: offset(now, -12 * DAY_MS),
      reviewedById: admin.id,
    });

    const participant = await prisma.participant.upsert({
      where: { puuid: identity.puuid },
      update: {
        gameName: identity.gameName,
        tagLine: identity.tagLine,
        status: ParticipantStatus.ACTIVE,
      },
      create: {
        userId: user.id,
        puuid: identity.puuid,
        summonerId: identity.summonerId,
        gameName: identity.gameName,
        tagLine: identity.tagLine,
        profileIconId: 100 + index,
        primaryPosition,
        secondaryPosition,
        status: ParticipantStatus.ACTIVE,
        approvedAt: offset(now, -12 * DAY_MS),
        approvedById: admin.id,
        lastIdentitySyncAt: offset(now, -HOUR_MS),
      },
    });
    participants.push(participant);

    await prisma.participantIdentityHistory.upsert({
      where: {
        participantId_validFrom: {
          participantId: participant.id,
          validFrom: SEED_IDENTITY_VALID_FROM,
        },
      },
      update: { gameName: identity.gameName, tagLine: identity.tagLine },
      create: {
        participantId: participant.id,
        gameName: identity.gameName,
        tagLine: identity.tagLine,
        validFrom: SEED_IDENTITY_VALID_FROM,
        source: "SEED_APPROVAL",
      },
    });

    const currentLp = (index * 7) % 100;
    const currentOrdinal = 4_000 - index * 50;
    const startingLp = Math.max(0, currentLp - 20);
    const startingOrdinal = currentOrdinal - 20;
    const startingRankHash = sha256(`rank-start:${participant.id}`);
    const startingRankId =
      startingRankHash.slice(0, 8) +
      "-0000-4000-8000-" +
      startingRankHash.slice(8, 20);
    await prisma.rankSnapshot.upsert({
      where: { id: startingRankId },
      update: {
        capturedAt: activeSeason.startAt,
        leaguePoints: startingLp,
        displayOrdinal: startingOrdinal,
      },
      create: {
        id: startingRankId,
        participantId: participant.id,
        seasonId: activeSeason.id,
        capturedAt: activeSeason.startAt,
        queueType: "RANKED_SOLO_5x5",
        tier: index < 4 ? "DIAMOND" : index < 12 ? "EMERALD" : "PLATINUM",
        rank: requiredAt(
          ["I", "II", "III", "IV"],
          index % 4,
          "starting rank label",
        ),
        leaguePoints: startingLp,
        wins: 31 + index,
        losses: 29 + index,
        isUnranked: false,
        displayOrdinal: startingOrdinal,
        source: SnapshotSource.MOCK,
        raw: jsonObject({ demoOnly: true, snapshot: "SEASON_START" }),
      },
    });

    await prisma.seasonParticipant.upsert({
      where: {
        seasonId_participantId: {
          seasonId: activeSeason.id,
          participantId: participant.id,
        },
      },
      update: {
        status: SeasonParticipantStatus.ACTIVE,
        startingRankSnapshotId: startingRankId,
      },
      create: {
        seasonId: activeSeason.id,
        participantId: participant.id,
        status: SeasonParticipantStatus.ACTIVE,
        joinedAt: activeSeason.startAt,
        startingRankSnapshotId: startingRankId,
      },
    });

    const hasNoRecords = index === 19;
    const isWinningStreak = index < 2;
    const wins = hasNoRecords
      ? 0
      : isWinningStreak
        ? 9
        : Math.max(0, 7 - (index % 8));
    const losses = hasNoRecords
      ? 0
      : isWinningStreak
        ? 1
        : index === 18
          ? 11
          : index % 6;
    const participantWeek = await prisma.participantWeek.upsert({
      where: {
        weekId_participantId: {
          weekId: activeWeek.id,
          participantId: participant.id,
        },
      },
      update: {
        mainScoreCached: leaderboardScore,
        missionScoreCached: missionScore,
        wins,
        losses,
        currentStreakType: hasNoRecords
          ? null
          : index === 18
            ? StreakType.LOSS
            : StreakType.WIN,
        currentStreakCount: hasNoRecords
          ? 0
          : index === 18
            ? 8
            : index < 2
              ? 7
              : 1,
        bestWinStreak: hasNoRecords ? 0 : index < 2 ? 7 : 2,
        rankCached: index < 2 ? 1 : index + 1,
        missionRankCached: missionRank,
      },
      create: {
        weekId: activeWeek.id,
        participantId: participant.id,
        mainScoreCached: leaderboardScore,
        missionScoreCached: missionScore,
        wins,
        losses,
        currentStreakType: hasNoRecords
          ? null
          : index === 18
            ? StreakType.LOSS
            : StreakType.WIN,
        currentStreakCount: hasNoRecords
          ? 0
          : index === 18
            ? 8
            : index < 2
              ? 7
              : 1,
        bestWinStreak: hasNoRecords ? 0 : index < 2 ? 7 : 2,
        rankCached: index < 2 ? 1 : index + 1,
        missionRankCached: missionRank,
      },
    });
    participantWeeks.push(participantWeek);

    await prisma.rankSnapshot.upsert({
      where: {
        id:
          sha256(`rank:${participant.id}`).slice(0, 8) +
          "-0000-4000-8000-" +
          sha256(`rank:${participant.id}`).slice(8, 20),
      },
      update: {
        capturedAt: offset(now, -HOUR_MS),
        tier: index < 4 ? "DIAMOND" : index < 12 ? "EMERALD" : "PLATINUM",
        leaguePoints: currentLp,
        displayOrdinal: currentOrdinal,
      },
      create: {
        id:
          sha256(`rank:${participant.id}`).slice(0, 8) +
          "-0000-4000-8000-" +
          sha256(`rank:${participant.id}`).slice(8, 20),
        participantId: participant.id,
        seasonId: activeSeason.id,
        weekId: activeWeek.id,
        capturedAt: offset(now, -HOUR_MS),
        queueType: "RANKED_SOLO_5x5",
        tier: index < 4 ? "DIAMOND" : index < 12 ? "EMERALD" : "PLATINUM",
        rank: requiredAt(["I", "II", "III", "IV"], index % 4, "rank label"),
        leaguePoints: currentLp,
        wins: 40 + index,
        losses: 35 + index,
        isUnranked: false,
        displayOrdinal: currentOrdinal,
        source: SnapshotSource.MOCK,
        raw: jsonObject({ demoOnly: true }),
      },
    });

    const previousRankHash = sha256(`rank-previous:${participant.id}`);
    const previousRankId =
      previousRankHash.slice(0, 8) +
      "-0000-4000-8000-" +
      previousRankHash.slice(8, 20);
    await prisma.rankSnapshot.upsert({
      where: { id: previousRankId },
      update: {
        capturedAt: offset(kstDateOnly(now, -1), 12 * HOUR_MS),
        leaguePoints: Math.max(0, currentLp - 7),
        displayOrdinal: currentOrdinal - 7,
      },
      create: {
        id: previousRankId,
        participantId: participant.id,
        seasonId: activeSeason.id,
        weekId: activeWeek.id,
        capturedAt: offset(kstDateOnly(now, -1), 12 * HOUR_MS),
        queueType: "RANKED_SOLO_5x5",
        tier: index < 4 ? "DIAMOND" : index < 12 ? "EMERALD" : "PLATINUM",
        rank: requiredAt(
          ["I", "II", "III", "IV"],
          index % 4,
          "previous rank label",
        ),
        leaguePoints: Math.max(0, currentLp - 7),
        wins: 39 + index,
        losses: 35 + index,
        isUnranked: false,
        displayOrdinal: currentOrdinal - 7,
        source: SnapshotSource.MOCK,
        raw: jsonObject({ demoOnly: true, snapshot: "PREVIOUS_DAY" }),
      },
    });

    for (const dayOffset of [-2, -1, 0]) {
      const progress = dayOffset === -2 ? 0.45 : dayOffset === -1 ? 0.72 : 1;
      const localDate = kstDateOnly(now, dayOffset);
      const snapshotRank =
        dayOffset === -1 && index === 0
          ? 2
          : dayOffset === -1 && index === 1
            ? 1
            : index < 2
              ? 1
              : index + 1;
      await prisma.dailyStandingSnapshot.upsert({
        where: {
          weekId_participantId_localDate: {
            weekId: activeWeek.id,
            participantId: participant.id,
            localDate,
          },
        },
        update: {
          mainScore: Math.round(leaderboardScore * progress),
          rank: snapshotRank,
          wins: Math.round(wins * progress),
          losses: Math.round(losses * progress),
          leaguePoints:
            dayOffset === 0
              ? currentLp
              : Math.max(0, currentLp - (dayOffset === -1 ? 7 : 12)),
        },
        create: {
          weekId: activeWeek.id,
          participantId: participant.id,
          localDate,
          mainScore: Math.round(leaderboardScore * progress),
          rank: snapshotRank,
          wins: Math.round(wins * progress),
          losses: Math.round(losses * progress),
          tier: index < 4 ? "DIAMOND" : index < 12 ? "EMERALD" : "PLATINUM",
          rankLabel: requiredAt(
            ["I", "II", "III", "IV"],
            index % 4,
            "daily rank label",
          ),
          leaguePoints:
            dayOffset === 0
              ? currentLp
              : Math.max(0, currentLp - (dayOffset === -1 ? 7 : 12)),
        },
      });
    }

    await prisma.syncCursor.upsert({
      where: { participantId: participant.id },
      update: {
        seasonId: activeSeason.id,
        nextEligibleAt: offset(now, index * 60_000),
      },
      create: {
        participantId: participant.id,
        seasonId: activeSeason.id,
        lastRequestedStartAt: offset(now, -2 * DAY_MS),
        lastSuccessfulMatchStartAt: offset(now, -3 * HOUR_MS),
        newestKnownMatchId: `KR_DEMO_CURSOR_${index + 1}`,
        lastSuccessAt: offset(now, -HOUR_MS),
        consecutiveFailures: index === 18 ? 2 : 0,
        nextEligibleAt: offset(now, index * 60_000),
      },
    });

    await prisma.missionRefillState.upsert({
      where: { participantWeekId: participantWeek.id },
      update: { credits: index % 4 },
      create: {
        participantWeekId: participantWeek.id,
        credits: index % 4,
        maxCredits: 3,
        intervalMinutes: 360,
        anchorAt: activeWeek.startAt,
        accountedThroughAt: now,
        nextAccrualAt: offset(now, 6 * HOUR_MS),
      },
    });

    await prisma.missionRerollState.upsert({
      where: { participantWeekId: participantWeek.id },
      update: {},
      create: {
        participantWeekId: participantWeek.id,
        cooldownMinutes: 60,
        totalUsed: 0,
      },
    });

    for (let slot = 0; slot < 5; slot += 1) {
      const definition = requiredAt(
        missionDefinitions,
        (index * 5 + slot) % 100,
        "mission definition",
      );
      const completed = index < 2 && slot === 0;
      const assignment = await prisma.weeklyMissionAssignment.upsert({
        where: {
          selectionKey: `seed:${activeWeek.id}:${participant.id}:${slot}`,
        },
        update: {
          state: completed
            ? MissionAssignmentState.COMPLETED
            : MissionAssignmentState.ACTIVE,
          progress: completed ? definition.target : 0,
          completedAt: completed ? offset(now, -30 * 60_000) : null,
        },
        create: {
          participantWeekId: participantWeek.id,
          missionDefinitionId: definition.id,
          state: completed
            ? MissionAssignmentState.COMPLETED
            : MissionAssignmentState.ACTIVE,
          generation: 1,
          selectionKey: `seed:${activeWeek.id}:${participant.id}:${slot}`,
          selectionSeedHash: sha256(
            `seed:${activeWeek.id}:${participant.id}:${slot}`,
          ),
          selectionMetadata: jsonObject({
            reason: "INITIAL",
            pool: "UNSEEN",
            selectorAlgorithm: "DEMO_ONLY_DETERMINISTIC",
          }),
          assignedAt: activeWeek.startAt,
          activeFrom: activeWeek.startAt,
          activeTo: completed ? offset(now, -30 * 60_000) : null,
          progress: completed ? definition.target : 0,
          target: definition.target,
          unit: "count",
          progressPayload: jsonObject({ demoOnly: true }),
          completedAt: completed ? offset(now, -30 * 60_000) : null,
          seenOrder: slot + 1,
          evaluatorVersion: "mission-evaluator-v1",
        },
      });

      await prisma.missionCandidateHistory.upsert({
        where: {
          participantWeekId_missionDefinitionId: {
            participantWeekId: participantWeek.id,
            missionDefinitionId: definition.id,
          },
        },
        update: {
          status: completed
            ? MissionCandidateStatus.COMPLETED
            : MissionCandidateStatus.ACTIVE,
        },
        create: {
          participantWeekId: participantWeek.id,
          missionDefinitionId: definition.id,
          firstSeenAt: activeWeek.startAt,
          completedAt: completed ? offset(now, -30 * 60_000) : null,
          timesAssigned: 1,
          status: completed
            ? MissionCandidateStatus.COMPLETED
            : MissionCandidateStatus.ACTIVE,
        },
      });

      if (completed) {
        await prisma.missionCompletionLedger.createMany({
          data: [
            {
              participantWeekId: participantWeek.id,
              assignmentId: assignment.id,
              type: MissionLedgerType.COMPLETION,
              points: definition.points,
              idempotencyKey: `seed:mission-completion:${assignment.id}`,
              metadata: jsonObject({ demoOnly: true }),
              createdAt: offset(now, -30 * 60_000),
            },
          ],
          skipDuplicates: true,
        });
      }
    }
  }

  const fixtureMatches = [
    {
      riotMatchId: "KR_DEMO_WIN_001",
      queueId: 420,
      durationSeconds: 1_860,
      earlySurrender: false,
      status: MatchStatus.PROCESSED,
      invalidReason: null,
      win: true,
      hasTimeline: false,
    },
    {
      riotMatchId: "KR_DEMO_LOSS_001",
      queueId: 420,
      durationSeconds: 2_140,
      earlySurrender: false,
      status: MatchStatus.PROCESSED,
      invalidReason: null,
      win: false,
      hasTimeline: false,
    },
    {
      riotMatchId: "KR_DEMO_REMAKE_001",
      queueId: 420,
      durationSeconds: 260,
      earlySurrender: true,
      status: MatchStatus.INVALID,
      invalidReason: "REMAKE_OR_TOO_SHORT",
      win: false,
      hasTimeline: false,
    },
    {
      riotMatchId: "KR_DEMO_INVALID_QUEUE_001",
      queueId: 430,
      durationSeconds: 1_700,
      earlySurrender: false,
      status: MatchStatus.INVALID,
      invalidReason: "UNSUPPORTED_QUEUE",
      win: true,
      hasTimeline: false,
    },
    {
      riotMatchId: "KR_DEMO_TIMELINE_001",
      queueId: 420,
      durationSeconds: 1_920,
      earlySurrender: false,
      status: MatchStatus.PROCESSED,
      invalidReason: null,
      win: true,
      hasTimeline: true,
    },
  ];
  const participantMatches = [];

  for (const [matchIndex, fixture] of fixtureMatches.entries()) {
    const trackedParticipant = requiredAt(
      participants,
      matchIndex,
      "tracked participant",
    );
    const trackedParticipantWeek = requiredAt(
      participantWeeks,
      matchIndex,
      "tracked participant week",
    );
    const gameEndAt = offset(now, -(matchIndex + 1) * HOUR_MS);
    const gameStartAt = offset(gameEndAt, -fixture.durationSeconds * 1_000);
    const match = await prisma.match.upsert({
      where: { riotMatchId: fixture.riotMatchId },
      update: {
        status: fixture.status,
        invalidReason: fixture.invalidReason,
        rawTimeline: fixture.hasTimeline
          ? jsonObject({ frames: [{ timestamp: 600_000 }], demoOnly: true })
          : Prisma.DbNull,
      },
      create: {
        riotMatchId: fixture.riotMatchId,
        regionalRoute: "ASIA",
        queueId: fixture.queueId,
        mapId: 11,
        gameMode: "CLASSIC",
        gameType: "MATCHED_GAME",
        gameVersion: "DEMO.1",
        gameStartAt,
        gameEndAt,
        durationSeconds: fixture.durationSeconds,
        earlySurrender: fixture.earlySurrender,
        status: fixture.status,
        invalidReason: fixture.invalidReason,
        rawSummary: jsonObject({
          fixture: fixture.riotMatchId,
          demoOnly: true,
        }),
        rawTimeline: fixture.hasTimeline
          ? jsonObject({ frames: [{ timestamp: 600_000 }], demoOnly: true })
          : Prisma.DbNull,
        timelineFetchedAt: fixture.hasTimeline ? now : null,
        ingestedAt: offset(gameEndAt, 5 * 60_000),
        processedAt:
          fixture.status === MatchStatus.PROCESSED
            ? offset(gameEndAt, 6 * 60_000)
            : null,
      },
    });

    for (const teamId of [100, 200]) {
      const teamWon = teamId === 100 ? fixture.win : !fixture.win;
      await prisma.matchTeam.upsert({
        where: { matchId_teamId: { matchId: match.id, teamId } },
        update: { win: teamWon },
        create: {
          matchId: match.id,
          teamId,
          win: teamWon,
          championKills: teamWon ? 28 : 16,
          towerKills: teamWon ? 9 : 4,
          inhibitorKills: teamWon ? 2 : 0,
          dragonKills: teamWon ? 3 : 1,
          baronKills: teamWon ? 1 : 0,
          heraldKills: 1,
          objectives: jsonObject({ demoOnly: true }),
        },
      });
    }

    let trackedRawParticipant;
    for (
      let participantIndex = 1;
      participantIndex <= 10;
      participantIndex += 1
    ) {
      const rawData = rawParticipantData(
        match.id,
        participantIndex,
        fixture.win,
      );
      if (participantIndex === 1) {
        rawData.puuid = trackedParticipant.puuid;
      }
      const rawParticipant = await prisma.matchParticipantRaw.upsert({
        where: {
          matchId_participantIndex: { matchId: match.id, participantIndex },
        },
        update: rawData,
        create: rawData,
      });
      if (participantIndex === 1) trackedRawParticipant = rawParticipant;
    }

    const seasonMatch = await prisma.seasonMatch.upsert({
      where: {
        seasonId_matchId: { seasonId: activeSeason.id, matchId: match.id },
      },
      update: {
        status: fixture.status,
        eligibilityReason: fixture.invalidReason,
      },
      create: {
        seasonId: activeSeason.id,
        matchId: match.id,
        weekId: activeWeek.id,
        status: fixture.status,
        eligibilityReason: fixture.invalidReason,
        processedAt:
          fixture.status === MatchStatus.PROCESSED
            ? offset(gameEndAt, 6 * 60_000)
            : null,
      },
    });

    if (!trackedRawParticipant) {
      throw new Error(
        `Tracked raw participant missing for ${fixture.riotMatchId}.`,
      );
    }

    const eligible =
      fixture.status === MatchStatus.PROCESSED && fixture.queueId === 420;
    const participantMatch = await prisma.participantMatch.upsert({
      where: {
        participantId_seasonMatchId: {
          participantId: trackedParticipant.id,
          seasonMatchId: seasonMatch.id,
        },
      },
      update: {
        eligible,
        eligibilityReason: fixture.invalidReason,
      },
      create: {
        participantId: trackedParticipant.id,
        participantWeekId: trackedParticipantWeek.id,
        seasonMatchId: seasonMatch.id,
        matchParticipantRawId: trackedRawParticipant.id,
        eligible,
        eligibilityReason: fixture.invalidReason,
        win: trackedRawParticipant.win,
        position: trackedRawParticipant.position,
        championId: trackedRawParticipant.championId,
        championName: trackedRawParticipant.championName,
        kills: trackedRawParticipant.kills,
        deaths: trackedRawParticipant.deaths,
        assists: trackedRawParticipant.assists,
        cs:
          trackedRawParticipant.totalMinionsKilled +
          trackedRawParticipant.neutralMinionsKilled,
        kda:
          (trackedRawParticipant.kills + trackedRawParticipant.assists) /
          Math.max(1, trackedRawParticipant.deaths),
        killParticipation: 0.65,
        processedAt: eligible ? offset(gameEndAt, 6 * 60_000) : null,
      },
    });
    const existingMissionSnapshot =
      await prisma.missionMatchSnapshot.findUnique({
        where: { participantMatchId: participantMatch.id },
        select: { id: true },
      });
    if (!existingMissionSnapshot) {
      const activeAtStart = await prisma.weeklyMissionAssignment.findMany({
        where: {
          participantWeekId: trackedParticipantWeek.id,
          activeFrom: { lte: gameStartAt },
          OR: [{ activeTo: null }, { activeTo: { gt: gameStartAt } }],
        },
        select: { id: true, evaluatorVersion: true },
      });
      const missionSnapshot = await prisma.missionMatchSnapshot.create({
        data: {
          participantMatchId: participantMatch.id,
          matchStartAt: gameStartAt,
          assignments: {
            create: activeAtStart.map((assignment) => ({
              assignmentId: assignment.id,
              evaluatorVersion: assignment.evaluatorVersion,
            })),
          },
        },
        select: { id: true },
      });
      await prisma.missionMatchSnapshot.update({
        where: { id: missionSnapshot.id },
        data: { sealedAt: now },
      });
    }
    participantMatches.push(participantMatch);
  }

  const drawFixtures = [
    {
      participantMatch: requiredAt(participantMatches, 0, "sealed draw match"),
      state: DrawState.SEALED,
      resultSign: 1,
      firstValue: 22,
      finalValue: 22,
      rerollEligible: true,
    },
    {
      participantMatch: requiredAt(
        participantMatches,
        1,
        "revealed draw match",
      ),
      state: DrawState.REVEALED,
      resultSign: -1,
      firstValue: 19,
      finalValue: 19,
      rerollEligible: false,
      revealedAt: offset(now, -30 * 60_000),
    },
    {
      participantMatch: requiredAt(
        participantMatches,
        4,
        "rerolled draw match",
      ),
      state: DrawState.REROLLED,
      resultSign: 1,
      firstValue: 18,
      finalValue: 23,
      rerollEligible: true,
      revealedAt: offset(now, -20 * 60_000),
      secondValue: 23,
      rerollUsedAt: offset(now, -15 * 60_000),
    },
  ];

  for (const fixture of drawFixtures) {
    const drawIdHash = sha256(`point-draw:${fixture.participantMatch.id}`);
    const drawId = `${drawIdHash.slice(0, 8)}-${drawIdHash.slice(8, 12)}-${drawIdHash.slice(12, 16)}-${drawIdHash.slice(16, 20)}-${drawIdHash.slice(20, 32)}`;
    const firstNonce = Buffer.from(
      sha256(`first-nonce:${fixture.participantMatch.id}`),
      "hex",
    ).toString("base64url");
    const secondNonce = fixture.secondValue
      ? Buffer.from(
          sha256(`second-nonce:${fixture.participantMatch.id}`),
          "hex",
        ).toString("base64url")
      : null;
    const firstCommitment = createDrawCommitment({
      commitmentVersion: DRAW_COMMITMENT_VERSION,
      drawId,
      magnitude: fixture.firstValue,
      nonce: firstNonce,
    });
    const secondCommitment =
      fixture.secondValue && secondNonce
        ? createDrawCommitment({
            commitmentVersion: DRAW_COMMITMENT_VERSION,
            drawId,
            magnitude: fixture.secondValue,
            nonce: secondNonce,
          })
        : null;
    const protectedFirstNonce = protectDrawNonce({
      nonce: firstNonce,
      drawId,
      phase: "FIRST",
      secret: pointDrawProtectionSecret,
    });
    const protectedSecondNonce = secondNonce
      ? protectDrawNonce({
          nonce: secondNonce,
          drawId,
          phase: "SECOND",
          secret: pointDrawProtectionSecret,
        })
      : null;
    const rerollEntitlementKey = fixture.rerollEligible
      ? `seed:reroll-entitlement:${fixture.participantMatch.id}`
      : null;
    const rerollGrantedAt = fixture.rerollEligible
      ? offset(now, -HOUR_MS)
      : null;
    const rerollExpiresAt = fixture.rerollEligible
      ? offset(now, 24 * HOUR_MS)
      : null;
    await prisma.pointDraw.upsert({
      where: { participantMatchId: fixture.participantMatch.id },
      update: {
        state: fixture.state,
        resultSign: fixture.resultSign,
        firstValue: fixture.firstValue,
        firstNonceEncryptedOrProtected: protectedFirstNonce,
        firstCommitment,
        firstCommitmentVersion: DRAW_COMMITMENT_VERSION,
        firstRngVersion: DRAW_RNG_VERSION,
        revealedAt: fixture.revealedAt ?? null,
        rerollEligible: fixture.rerollEligible,
        rerollReason: fixture.rerollEligible ? "DEMO_ONLY_MVP_ACE" : null,
        rerollEntitlementKey,
        rerollEntitlementSource: fixture.rerollEligible ? "DEMO_ONLY" : null,
        rerollGrantedAt,
        rerollExpiresAt,
        rerollDemoOnly: fixture.rerollEligible,
        secondValue: fixture.secondValue ?? null,
        secondNonceEncryptedOrProtected: protectedSecondNonce,
        secondCommitment,
        secondCommitmentVersion: fixture.secondValue
          ? DRAW_COMMITMENT_VERSION
          : null,
        secondRngVersion: fixture.secondValue ? DRAW_RNG_VERSION : null,
        rerollUsedAt: fixture.rerollUsedAt ?? null,
        finalValue: fixture.finalValue,
        finalSignedValue: fixture.resultSign * fixture.finalValue,
      },
      create: {
        id: drawId,
        participantMatchId: fixture.participantMatch.id,
        state: fixture.state,
        resultSign: fixture.resultSign,
        firstValue: fixture.firstValue,
        firstNonceEncryptedOrProtected: protectedFirstNonce,
        firstCommitment,
        firstCommitmentVersion: DRAW_COMMITMENT_VERSION,
        firstRngVersion: DRAW_RNG_VERSION,
        firstGeneratedAt: offset(now, -HOUR_MS),
        revealedAt: fixture.revealedAt ?? null,
        autoRevealed: false,
        rerollEligible: fixture.rerollEligible,
        rerollReason: fixture.rerollEligible ? "DEMO_ONLY_MVP_ACE" : null,
        rerollEntitlementKey,
        rerollEntitlementSource: fixture.rerollEligible ? "DEMO_ONLY" : null,
        rerollGrantedAt,
        rerollExpiresAt,
        rerollDemoOnly: fixture.rerollEligible,
        secondValue: fixture.secondValue ?? null,
        secondNonceEncryptedOrProtected: protectedSecondNonce,
        secondCommitment,
        secondCommitmentVersion: fixture.secondValue
          ? DRAW_COMMITMENT_VERSION
          : null,
        secondRngVersion: fixture.secondValue ? DRAW_RNG_VERSION : null,
        rerollUsedAt: fixture.rerollUsedAt ?? null,
        finalValue: fixture.finalValue,
        finalSignedValue: fixture.resultSign * fixture.finalValue,
      },
    });
  }

  for (const [index, participantWeek] of participantWeeks.entries()) {
    const linkedDraw =
      index === 0
        ? requiredAt(drawFixtures, 0, "sealed draw fixture")
        : index === 1
          ? requiredAt(drawFixtures, 1, "revealed draw fixture")
          : index === 4
            ? requiredAt(drawFixtures, 2, "rerolled draw fixture")
            : undefined;
    const initialAmount = linkedDraw
      ? linkedDraw.resultSign * linkedDraw.firstValue
      : undefined;
    if (linkedDraw && initialAmount !== undefined) {
      await prisma.scoreLedger.createMany({
        data: [
          {
            participantWeekId: participantWeek.id,
            participantMatchId: linkedDraw.participantMatch.id,
            type: ScoreLedgerType.MATCH_INITIAL,
            amount: initialAmount,
            idempotencyKey: `seed:match-initial:${linkedDraw.participantMatch.id}`,
            metadata: jsonObject({ demoOnly: true }),
          },
          ...(linkedDraw.secondValue === undefined
            ? []
            : [
                {
                  participantWeekId: participantWeek.id,
                  participantMatchId: linkedDraw.participantMatch.id,
                  type: ScoreLedgerType.MATCH_REROLL_ADJUSTMENT,
                  amount:
                    linkedDraw.resultSign *
                    (linkedDraw.secondValue - linkedDraw.firstValue),
                  idempotencyKey: `seed:match-reroll:${linkedDraw.participantMatch.id}`,
                  metadata: jsonObject({ demoOnly: true }),
                },
              ]),
        ],
        skipDuplicates: true,
      });
    }

    const settledMatchAmount = linkedDraw
      ? linkedDraw.resultSign * linkedDraw.finalValue
      : 0;
    const adjustment =
      requiredAt(leaderboardScores, index, "leaderboard score") -
      settledMatchAmount;
    if (adjustment !== 0) {
      await prisma.scoreLedger.createMany({
        data: [
          {
            participantWeekId: participantWeek.id,
            type: ScoreLedgerType.ADMIN_ADJUSTMENT,
            amount: adjustment,
            idempotencyKey: `seed:leaderboard-balance:${participantWeek.id}`,
            reason: "DEMO_ONLY leaderboard fixture balance",
            actorUserId: admin.id,
            metadata: jsonObject({ demoOnly: true }),
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  await prisma.syncRun.upsert({
    where: { invocationKey: "seed:successful-sync-run" },
    update: { status: SyncRunStatus.SUCCEEDED, finishedAt: now },
    create: {
      invocationKey: "seed:successful-sync-run",
      trigger: SyncTrigger.MANUAL,
      status: SyncRunStatus.SUCCEEDED,
      startedAt: offset(now, -10 * 60_000),
      finishedAt: offset(now, -8 * 60_000),
      participantCount: 20,
      matchIdsFound: 5,
      matchesFetched: 5,
      matchesProcessed: 3,
      matchesSkipped: 2,
      errorCount: 0,
      requestedById: admin.id,
      metadata: jsonObject({ demoOnly: true }),
    },
  });

  await prisma.announcement.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: { publishedAt: now },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      title: "개발 시즌이 진행 중입니다",
      body: "이 공지는 DEMO_ONLY seed 데이터입니다.",
      status: "PUBLISHED",
      pinned: true,
      publishedAt: now,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  for (const [key, enabled, description] of [
    [
      "scoring.fixed20Fallback",
      false,
      "Switch scoring to deterministic 20-point mode",
    ],
    [
      "mvp.rewardsEnabled",
      false,
      "Disabled because seed baseline is DEMO_ONLY",
    ],
    ["sync.opportunisticEnabled", true, "Allow bounded stale-data refresh"],
    ["maintenance.enabled", false, "Maintenance mode"],
  ] as const) {
    await prisma.featureFlag.upsert({
      where: { key },
      update: { enabled, description, updatedById: admin.id },
      create: {
        key,
        enabled,
        config: jsonObject({ demoOnly: true }),
        description,
        updatedById: admin.id,
      },
    });
  }

  await prisma.systemSetting.upsert({
    where: { key: "seed.metadata" },
    update: { value: jsonObject({ demoOnly: true, catalogVersion: "v1" }) },
    create: {
      key: "seed.metadata",
      value: jsonObject({ demoOnly: true, catalogVersion: "v1" }),
      version: 1,
      updatedById: admin.id,
    },
  });

  console.info(
    [
      "Seed completed:",
      "- 1 admin, 20 approved participants, 1 pending applicant",
      "- 1 active two-week season and 1 completed season",
      "- 100 versioned mission definitions",
      "- win/loss/remake/invalid-queue/timeline match fixtures",
      "- sealed/revealed/rerolled point draw fixtures",
      `- development login password source: ${process.env.SEED_PASSWORD ? "SEED_PASSWORD" : "documented default"}`,
    ].join("\n"),
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
