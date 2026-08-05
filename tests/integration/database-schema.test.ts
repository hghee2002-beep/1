import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  ApplicationStatus,
  DrawState,
  MatchStatus,
  MissionProgressEventType,
  ScoreLedgerType,
  StreakType,
  UserRole,
  UserStatus,
  VerificationStatus,
  type Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import { bootstrapMissionCatalog } from "../../prisma/mission-catalog-bootstrap";

import { createDatabaseTestClient, withRollback } from "./database-test-client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseDescribe = testDatabaseUrl ? describe : describe.skip;

databaseDescribe("PostgreSQL schema and seed", () => {
  let client: PrismaClient | undefined;

  function db() {
    if (!client) throw new Error("Database test client was not initialized.");
    return client;
  }

  beforeAll(() => {
    if (testDatabaseUrl) client = createDatabaseTestClient(testDatabaseUrl);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("seeds the complete catalog and representative operating states", async () => {
    const [
      missions,
      participants,
      pendingApplications,
      matches,
      baseline,
      dailySnapshots,
      startingSnapshots,
    ] = await Promise.all([
      db().missionDefinition.count({ where: { version: 1 } }),
      db().participant.count({
        where: { puuid: { startsWith: "DEMO_ONLY_PUUID_" } },
      }),
      db().participationApplication.count({
        where: {
          status: ApplicationStatus.PENDING,
          user: { loginIdNormalized: "pending-user" },
        },
      }),
      db().match.findMany({
        where: { riotMatchId: { startsWith: "KR_DEMO_" } },
        select: {
          riotMatchId: true,
          queueId: true,
          status: true,
          earlySurrender: true,
          rawTimeline: true,
        },
      }),
      db().mvpBaselineVersion.findUnique({
        where: { name: "DEMO_ONLY-v1" },
        include: { _count: { select: { metrics: true } } },
      }),
      db().dailyStandingSnapshot.count(),
      db().seasonParticipant.count({
        where: { startingRankSnapshotId: { not: null } },
      }),
    ]);

    expect(missions).toBe(100);
    expect(participants).toBe(20);
    expect(pendingApplications).toBe(1);
    expect(matches).toHaveLength(5);
    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: MatchStatus.PROCESSED }),
        expect.objectContaining({ earlySurrender: true }),
        expect.objectContaining({ queueId: 430, status: MatchStatus.INVALID }),
        expect.objectContaining({ rawTimeline: expect.any(Object) }),
      ]),
    );
    expect(baseline).toMatchObject({
      demoOnly: true,
      status: "PUBLISHED",
      _count: { metrics: 320 },
    });
    expect(dailySnapshots).toBeGreaterThanOrEqual(60);
    expect(startingSnapshots).toBeGreaterThanOrEqual(20);
  });

  it("runs the production catalog bootstrap idempotently without demo writes", async () => {
    const before = await db().missionDefinition.count();
    const result = await bootstrapMissionCatalog(db());

    expect(result).toEqual({ created: 0, verified: 100 });
    await expect(db().missionDefinition.count()).resolves.toBe(before);
  });

  it("serves leaderboard, recent-match, and active-mission read queries", async () => {
    const activeWeek = await db().week.findFirstOrThrow({
      where: {
        number: 2,
        season: { slug: "development-active-season" },
      },
    });
    const [leaderboard, recentMatches, activeMissions] = await Promise.all([
      db().participantWeek.findMany({
        where: {
          weekId: activeWeek.id,
          participant: { puuid: { startsWith: "DEMO_ONLY_PUUID_" } },
        },
        orderBy: [
          { mainScoreCached: "desc" },
          { wins: "desc" },
          { losses: "asc" },
        ],
        include: {
          participant: { select: { gameName: true, tagLine: true } },
        },
      }),
      db().participantMatch.findMany({
        where: { participantWeek: { weekId: activeWeek.id } },
        orderBy: { createdAt: "desc" },
        include: { seasonMatch: { include: { match: true } }, pointDraw: true },
      }),
      db().weeklyMissionAssignment.findMany({
        where: {
          participantWeek: { weekId: activeWeek.id },
          state: "ACTIVE",
        },
        include: { missionDefinition: true },
      }),
    ]);

    expect(leaderboard).toHaveLength(20);
    expect(leaderboard[0]).toMatchObject({
      mainScoreCached: 120,
      rankCached: 1,
    });
    expect(leaderboard[1]).toMatchObject({
      mainScoreCached: 120,
      rankCached: 1,
    });
    expect(
      leaderboard.some(({ participant }) => participant.tagLine.length > 0),
    ).toBe(true);
    expect(recentMatches).toHaveLength(5);
    expect(recentMatches.filter(({ pointDraw }) => pointDraw)).toHaveLength(3);
    expect(activeMissions).toHaveLength(98);
  });

  it("keeps cached main scores reconcilable from the append-only ledger", async () => {
    const activeWeek = await db().week.findFirstOrThrow({
      where: {
        number: 2,
        season: { slug: "development-active-season" },
      },
    });
    const [participantWeeks, sums] = await Promise.all([
      db().participantWeek.findMany({ where: { weekId: activeWeek.id } }),
      db().scoreLedger.groupBy({
        by: ["participantWeekId"],
        where: { participantWeek: { weekId: activeWeek.id } },
        _sum: { amount: true },
      }),
    ]);
    const scoreByParticipantWeek = new Map(
      sums.map((row) => [row.participantWeekId, row._sum.amount ?? 0]),
    );

    for (const participantWeek of participantWeeks) {
      expect(scoreByParticipantWeek.get(participantWeek.id) ?? 0).toBe(
        participantWeek.mainScoreCached,
      );
    }
  });

  it("keeps cached mission scores reconcilable from the completion ledger", async () => {
    const activeWeek = await db().week.findFirstOrThrow({
      where: {
        number: 2,
        season: { slug: "development-active-season" },
      },
    });
    const [participantWeeks, sums] = await Promise.all([
      db().participantWeek.findMany({ where: { weekId: activeWeek.id } }),
      db().missionCompletionLedger.groupBy({
        by: ["participantWeekId"],
        where: { participantWeek: { weekId: activeWeek.id } },
        _sum: { points: true },
      }),
    ]);
    const scoreByParticipantWeek = new Map(
      sums.map((row) => [row.participantWeekId, row._sum.points ?? 0]),
    );

    for (const participantWeek of participantWeeks) {
      expect(scoreByParticipantWeek.get(participantWeek.id) ?? 0).toBe(
        participantWeek.missionScoreCached,
      );
    }
  });

  it("rejects duplicate identity, application, match, ledger, sync, and lease keys", async () => {
    const [
      admin,
      pendingUser,
      existingParticipant,
      seasonMatch,
      participantMatch,
      pointDraw,
      assignment,
      scoreLedger,
      syncCursor,
    ] = await Promise.all([
      db().user.findUniqueOrThrow({ where: { loginIdNormalized: "admin" } }),
      db().user.findUniqueOrThrow({
        where: { loginIdNormalized: "pending-user" },
      }),
      db().participant.findFirstOrThrow(),
      db().seasonMatch.findFirstOrThrow(),
      db().participantMatch.findFirstOrThrow(),
      db().pointDraw.findFirstOrThrow(),
      db().weeklyMissionAssignment.findFirstOrThrow(),
      db().scoreLedger.findFirstOrThrow(),
      db().syncCursor.findFirstOrThrow(),
    ]);

    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.user.create({
          data: {
            loginId: admin.loginId,
            loginIdNormalized: `duplicate-${crypto.randomUUID()}`,
            realName: "중복 로그인",
            passwordHash: "not-a-real-hash",
            role: UserRole.USER,
            status: UserStatus.ACTIVE,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });

      return "duplicate login rejected";
    });

    await withRollback(db(), async (transaction) => {
      const user = await transaction.user.create({
        data: {
          loginId: `puuid-${crypto.randomUUID()}`,
          loginIdNormalized: `puuid-${crypto.randomUUID()}`,
          realName: "PUUID Duplicate Test",
          passwordHash: "not-a-real-hash",
        },
      });
      await expect(
        transaction.participant.create({
          data: {
            userId: user.id,
            puuid: existingParticipant.puuid,
            summonerId: `duplicate-${crypto.randomUUID()}`,
            gameName: "DuplicatePuuid",
            tagLine: "TEST",
            approvedAt: new Date(),
            approvedById: admin.id,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      return "duplicate PUUID rejected";
    });

    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.participationApplication.create({
          data: {
            userId: pendingUser.id,
            gameName: "SecondPendingApplication",
            tagLine: "WAIT",
            riotIdNormalized: "secondpendingapplication#wait",
            status: ApplicationStatus.PENDING,
            verificationStatus: VerificationStatus.VERIFIED,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      return "pending application rejected";
    });

    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.seasonMatch.create({
          data: {
            seasonId: seasonMatch.seasonId,
            matchId: seasonMatch.matchId,
            weekId: seasonMatch.weekId,
            status: seasonMatch.status,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      return "season match rejected";
    });

    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.participantMatch.create({
          data: {
            participantId: participantMatch.participantId,
            participantWeekId: participantMatch.participantWeekId,
            seasonMatchId: participantMatch.seasonMatchId,
            matchParticipantRawId: participantMatch.matchParticipantRawId,
            eligible: participantMatch.eligible,
            win: participantMatch.win,
            championId: participantMatch.championId,
            championName: participantMatch.championName,
            kills: participantMatch.kills,
            deaths: participantMatch.deaths,
            assists: participantMatch.assists,
            cs: participantMatch.cs,
            kda: participantMatch.kda,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      return "participant match rejected";
    });

    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.pointDraw.create({
          data: {
            participantMatchId: pointDraw.participantMatchId,
            state: DrawState.SEALED,
            resultSign: pointDraw.resultSign,
            firstValue: 20,
            firstNonceEncryptedOrProtected: "DEMO_PROTECTED",
            firstCommitment: crypto.randomUUID(),
            firstRngVersion: "integration-v1",
            firstGeneratedAt: new Date(),
            finalValue: 20,
            finalSignedValue: pointDraw.resultSign * 20,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      return "point draw ownership rejected";
    });

    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.weeklyMissionAssignment.create({
          data: {
            participantWeekId: assignment.participantWeekId,
            missionDefinitionId: assignment.missionDefinitionId,
            state: "CANCELLED",
            generation: assignment.generation + 1,
            selectionKey: assignment.selectionKey,
            selectionSeedHash: crypto.randomUUID(),
            assignedAt: new Date(),
            activeFrom: new Date(),
            progress: 0,
            target: assignment.target,
            seenOrder: assignment.seenOrder + 1,
            evaluatorVersion: assignment.evaluatorVersion,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      return "mission selection key rejected";
    });

    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.scoreLedger.create({
          data: {
            participantWeekId: scoreLedger.participantWeekId,
            type: ScoreLedgerType.ADMIN_ADJUSTMENT,
            amount: 1,
            idempotencyKey: scoreLedger.idempotencyKey,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      return "ledger key rejected";
    });

    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.syncCursor.create({
          data: { participantId: syncCursor.participantId },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      return "sync cursor rejected";
    });

    await withRollback(db(), async (transaction) => {
      const leaseKey = `test:${crypto.randomUUID()}`;
      const acquiredAt = new Date();
      await transaction.jobLease.create({
        data: {
          key: leaseKey,
          ownerToken: "worker-a",
          acquiredAt,
          heartbeatAt: acquiredAt,
          expiresAt: new Date(acquiredAt.getTime() + 60_000),
        },
      });
      await expect(
        transaction.jobLease.create({
          data: {
            key: leaseKey,
            ownerToken: "worker-b",
            acquiredAt,
            heartbeatAt: acquiredAt,
            expiresAt: new Date(acquiredAt.getTime() + 60_000),
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      return "lease key rejected";
    });
  });

  it("enforces mission processing and completion idempotency", async () => {
    const snapshotEntry =
      await db().missionMatchSnapshotAssignment.findFirstOrThrow({
        where: {
          snapshot: {
            participantMatch: {
              eligible: true,
              participantWeek: {
                week: { status: "ACTIVE", season: { status: "ACTIVE" } },
              },
            },
          },
        },
        include: {
          assignment: true,
          snapshot: { include: { participantMatch: true } },
        },
      });
    const participantMatch = snapshotEntry.snapshot.participantMatch;
    const assignment = snapshotEntry.assignment;

    await withRollback(db(), async (transaction) => {
      const evaluatorVersion = snapshotEntry.evaluatorVersion;
      await transaction.missionProgressEvent.create({
        data: {
          assignmentId: assignment.id,
          participantMatchId: participantMatch.id,
          type: MissionProgressEventType.NORMAL,
          beforeValue: 0,
          deltaValue: 1,
          afterValue: 1,
          completed: false,
          evaluatorVersion,
          facts: { integration: true },
          idempotencyKey: `integration:${crypto.randomUUID()}`,
        },
      });
      await expect(
        transaction.missionProgressEvent.create({
          data: {
            assignmentId: assignment.id,
            participantMatchId: participantMatch.id,
            type: MissionProgressEventType.NORMAL,
            beforeValue: 0,
            deltaValue: 1,
            afterValue: 1,
            completed: false,
            evaluatorVersion,
            facts: { integration: true },
            idempotencyKey: `integration:${crypto.randomUUID()}`,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      return "mission event duplicate rejected";
    });

    const completedAssignment =
      await db().weeklyMissionAssignment.findFirstOrThrow({
        where: { completionLedger: { isNot: null } },
      });
    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.missionCompletionLedger.create({
          data: {
            participantWeekId: completedAssignment.participantWeekId,
            assignmentId: completedAssignment.id,
            type: "COMPLETION",
            points: 1,
            idempotencyKey: `integration:${crypto.randomUUID()}`,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      return "mission completion duplicate rejected";
    });
  });

  it("enforces cascade, restrict, cross-scope, draw range, and append-only policies", async () => {
    await withRollback(db(), async (transaction) => {
      const user = await transaction.user.create({
        data: {
          loginId: `cascade-${crypto.randomUUID()}`,
          loginIdNormalized: `cascade-${crypto.randomUUID()}`,
          realName: "Cascade Test",
          passwordHash: "not-a-real-hash",
        },
      });
      await transaction.authSession.create({
        data: {
          userId: user.id,
          jtiHash: crypto.randomUUID(),
          sessionVersion: 1,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await transaction.user.delete({ where: { id: user.id } });
      expect(
        await transaction.authSession.count({ where: { userId: user.id } }),
      ).toBe(0);
      return "session cascade verified";
    });

    const participant = await db().participant.findFirstOrThrow();
    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.participant.delete({ where: { id: participant.id } }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "participant restrict verified";
    });

    const ledger = await db().scoreLedger.findFirstOrThrow();
    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.scoreLedger.update({
          where: { id: ledger.id },
          data: { reason: "mutated" },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "append-only trigger verified";
    });

    const [completedSeason, activeWeek, match] = await Promise.all([
      db().season.findFirstOrThrow({
        where: { slug: "development-completed-season" },
      }),
      db().week.findFirstOrThrow({
        where: {
          number: 2,
          season: { slug: "development-active-season" },
        },
      }),
      db().match.findFirstOrThrow(),
    ]);
    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.seasonMatch.create({
          data: {
            seasonId: completedSeason.id,
            weekId: activeWeek.id,
            matchId: match.id,
            status: MatchStatus.INGESTED,
          },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "season/week scope verified";
    });

    const drawlessMatch = await db().participantMatch.findFirstOrThrow({
      where: { pointDraw: null, win: false },
    });
    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.pointDraw.create({
          data: {
            participantMatchId: drawlessMatch.id,
            state: DrawState.SEALED,
            resultSign: -1,
            firstValue: 16,
            firstNonceEncryptedOrProtected: "DEMO_PROTECTED",
            firstCommitment: crypto.randomUUID(),
            firstRngVersion: "integration-v1",
            firstGeneratedAt: new Date(),
            finalValue: 16,
            finalSignedValue: -16,
          },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "draw range verified";
    });

    const publishedBaseline = await db().mvpBaselineVersion.findFirstOrThrow({
      where: { status: "PUBLISHED" },
      select: { id: true },
    });
    const publishedMetric = await db().mvpBaselineMetric.findFirstOrThrow({
      where: { versionId: publishedBaseline.id },
      select: { id: true },
    });
    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.mvpBaselineMetric.update({
          where: { id: publishedMetric.id },
          data: { mean: 999 },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "published baseline metric immutable";
    });

    const evaluationScope = await db().seasonMatch.findFirstOrThrow({
      select: {
        id: true,
        match: {
          select: { rawParticipants: { take: 1, select: { id: true } } },
        },
      },
    });
    const rawParticipant = evaluationScope.match.rawParticipants[0];
    if (!rawParticipant) throw new Error("seed raw participant missing");
    await withRollback(db(), async (transaction) => {
      const evaluation = await transaction.mvpEvaluation.create({
        data: {
          evaluationKey: `integration:${crypto.randomUUID()}`,
          seasonMatchId: evaluationScope.id,
          matchParticipantRawId: rawParticipant.id,
          status: "PENDING_DATA",
          errorCode: "INTEGRATION_FIXTURE",
          evaluatorVersion: "integration-v1",
          metrics: { integration: true },
          tieBreak: { integration: true },
        },
      });
      await expect(
        transaction.mvpEvaluation.update({
          where: { id: evaluation.id },
          data: { errorCode: "MUTATED" },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "MVP evaluation append-only";
    });

    const weekSnapshot = await db().weekSnapshot.findFirstOrThrow();
    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.weekSnapshot.update({
          where: { id: weekSnapshot.id },
          data: { checksum: crypto.randomUUID() },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "week snapshot immutable";
    });
  });

  it("enforces production write fences and versioned snapshot inputs", async () => {
    const activeParticipantWeek = await db().participantWeek.findFirstOrThrow({
      where: { week: { status: "ACTIVE", season: { status: "ACTIVE" } } },
      select: { id: true, participantId: true },
    });
    const activePointDraw = await db().pointDraw.findFirstOrThrow({
      where: {
        participantMatch: {
          participantWeek: {
            week: { status: "ACTIVE", season: { status: "ACTIVE" } },
          },
        },
      },
      select: { id: true },
    });
    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.pointDraw.update({
          where: { id: activePointDraw.id },
          data: { firstCommitment: "b".repeat(64) },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "initial PointDraw evidence immutable";
    });
    const rerolledPointDraw = await db().pointDraw.findFirstOrThrow({
      where: {
        state: "REROLLED",
        participantMatch: {
          participantWeek: {
            week: { status: "ACTIVE", season: { status: "ACTIVE" } },
          },
        },
      },
      select: { id: true, finalValue: true },
    });
    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.pointDraw.update({
          where: { id: rerolledPointDraw.id },
          data: {
            finalValue: rerolledPointDraw.finalValue === 23 ? 22 : 23,
          },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "final PointDraw reroll evidence immutable";
    });
    const admin = await db().user.findFirstOrThrow({
      where: { role: UserRole.ADMIN },
      select: { id: true },
    });
    const closedScopeSuffix = crypto.randomUUID().slice(0, 8);
    const closedScopeStart = new Date(Date.now() - 2 * 60 * 60_000);
    const closedScopeEnd = new Date(Date.now() - 60 * 60_000);
    const closedSeason = await db().season.create({
      data: {
        name: `closed-write-fence-${closedScopeSuffix}`,
        slug: `closed-write-fence-${closedScopeSuffix}`,
        status: "ACTIVE",
        startAt: closedScopeStart,
        endAt: closedScopeEnd,
        rulesVersion: "integration-v1",
        config: { queueId: 420 },
        createdById: admin.id,
      },
    });
    const closedWeek = await db().week.create({
      data: {
        seasonId: closedSeason.id,
        number: 1,
        name: "closed write fence",
        status: "ACTIVE",
        startAt: closedScopeStart,
        endAt: closedScopeEnd,
        missionCatalogVersion: "v1",
        rulesSnapshot: { version: "integration-v1" },
      },
    });
    await db().seasonParticipant.create({
      data: {
        seasonId: closedSeason.id,
        participantId: activeParticipantWeek.participantId,
        joinedAt: closedScopeStart,
      },
    });
    const completedParticipantWeek = await db().participantWeek.create({
      data: {
        weekId: closedWeek.id,
        participantId: activeParticipantWeek.participantId,
      },
      select: { id: true },
    });
    await db().week.update({
      where: { id: closedWeek.id },
      data: { status: "COMPLETED", finalizedAt: new Date() },
    });
    await db().season.update({
      where: { id: closedSeason.id },
      data: { status: "COMPLETED" },
    });
    const anotherParticipant = await db().participant.findFirstOrThrow({
      where: { id: { not: activeParticipantWeek.participantId } },
      select: { id: true },
    });
    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.participantWeek.create({
          data: {
            weekId: closedWeek.id,
            participantId: anotherParticipant.id,
          },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "closed ParticipantWeek insert rejected";
    });
    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.participantWeek.delete({
          where: { id: completedParticipantWeek.id },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "closed ParticipantWeek delete rejected";
    });
    const closedProjectionMutations: ReadonlyArray<
      readonly [string, Prisma.ParticipantWeekUpdateInput]
    > = [
      ["mainScoreCached", { mainScoreCached: { increment: 1 } }],
      ["missionScoreCached", { missionScoreCached: { increment: 1 } }],
      ["wins", { wins: { increment: 1 } }],
      ["losses", { losses: { increment: 1 } }],
      ["currentStreakType", { currentStreakType: StreakType.WIN }],
      ["currentStreakCount", { currentStreakCount: { increment: 1 } }],
      ["bestWinStreak", { bestWinStreak: { increment: 1 } }],
      ["mvpCount", { mvpCount: { increment: 1 } }],
      ["aceCount", { aceCount: { increment: 1 } }],
      ["rankCached", { rankCached: 999 }],
      ["missionRankCached", { missionRankCached: 999 }],
      ["lastProcessedMatchAt", { lastProcessedMatchAt: new Date() }],
    ];
    for (const [field, data] of closedProjectionMutations) {
      await withRollback(db(), async (transaction) => {
        await expect(
          transaction.participantWeek.update({
            where: { id: completedParticipantWeek.id },
            data,
          }),
          `closed ParticipantWeek.${field}`,
        ).rejects.toMatchObject({ code: "P2039" });
        return `closed ParticipantWeek.${field} rejected`;
      });
    }

    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.missionCompletionLedger.create({
          data: {
            participantWeekId: activeParticipantWeek.id,
            type: "COMPLETION",
            points: 1,
            idempotencyKey: `integration:null-completion:${crypto.randomUUID()}`,
          },
        }),
      ).rejects.toBeDefined();
      return "null completion assignment rejected";
    });

    const publishedMetric = await db().mvpBaselineMetric.findFirstOrThrow({
      where: { version: { status: "PUBLISHED" } },
    });
    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.mvpBaselineMetric.create({
          data: {
            versionId: publishedMetric.versionId,
            tierBucket: publishedMetric.tierBucket,
            position: publishedMetric.position,
            metricKey: `integration-extra-${crypto.randomUUID()}`,
            mean: 0,
            stdDev: 1,
            sampleSize: 30,
          },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "published metric insert rejected";
    });

    const snapshotEntry =
      await db().missionMatchSnapshotAssignment.findFirstOrThrow({
        where: {
          snapshot: {
            participantMatch: {
              participantWeek: {
                week: { status: "ACTIVE", season: { status: "ACTIVE" } },
              },
            },
          },
        },
        include: {
          snapshot: {
            include: { participantMatch: true },
          },
        },
      });
    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.missionMatchSnapshotAssignment.create({
          data: {
            snapshotId: snapshotEntry.snapshotId,
            assignmentId: snapshotEntry.assignmentId,
            evaluatorVersion: `late-${crypto.randomUUID()}`,
          },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "sealed snapshot child insert rejected";
    });

    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.missionProgressEvent.create({
          data: {
            assignmentId: snapshotEntry.assignmentId,
            participantMatchId: snapshotEntry.snapshot.participantMatchId,
            beforeValue: 0,
            deltaValue: 0,
            afterValue: 0,
            evaluatorVersion: `wrong-${crypto.randomUUID()}`,
            facts: { integration: true },
            idempotencyKey: `integration:wrong-snapshot-version:${crypto.randomUUID()}`,
          },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "mission event snapshot version rejected";
    });

    const referencedDefinition = await db().missionDefinition.findFirstOrThrow({
      where: { assignments: { some: {} } },
      select: { id: true, points: true },
    });
    await withRollback(db(), async (transaction) => {
      await expect(
        transaction.missionDefinition.update({
          where: { id: referencedDefinition.id },
          data: { points: referencedDefinition.points + 1 },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      return "referenced mission definition mutation rejected";
    });
  });
});
