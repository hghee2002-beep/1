import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  MissionAssignmentState,
  MissionCandidateStatus,
  MissionCategory,
  MissionDifficulty,
  MissionKind,
  MissionLedgerType,
  MissionSourceType,
  SeasonStatus,
  WeekStatus,
  type PrismaClient,
} from "@/generated/prisma/client";
import type { MissionIndexSelector } from "@/domain/missions/selection";

import type * as DatabaseModule from "@/server/db/client";
import type * as MissionEvaluationServiceModule from "@/server/missions/evaluation-service";
import type * as MissionReadModule from "@/server/missions/read";
import type * as MissionServiceModule from "@/server/missions/service";
import type * as MissionSnapshotModule from "@/server/missions/snapshot";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseDescribe = testDatabaseUrl ? describe : describe.skip;
const fixedNow = new Date("2026-08-05T03:00:00.000Z");

class FirstCandidateSelector implements MissionIndexSelector {
  private sequence = 0;

  choose() {
    this.sequence += 1;
    return {
      index: 0,
      entropyHash: `integration-seed-${this.sequence}`,
      algorithm: "integration-first-v1",
    };
  }
}

databaseDescribe("weekly mission assignment lifecycle", () => {
  let database: typeof DatabaseModule;
  let missionEvaluations: typeof MissionEvaluationServiceModule;
  let missionReads: typeof MissionReadModule;
  let missions: typeof MissionServiceModule;
  let snapshots: typeof MissionSnapshotModule;
  let client: PrismaClient;
  let adminId: string;

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    Object.assign(process.env, {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      AUTH_SECRET: "mission-integration-auth-secret-32-characters",
      CRON_SECRET: "mission-integration-cron-secret-32-characters",
      POINT_DRAW_SECRET: "mission-integration-draw-secret-32-characters",
      MOCK_RIOT_API: "true",
      APP_URL: "http://localhost:3000",
      APP_TIME_ZONE: "Asia/Seoul",
    });
    [database, missionEvaluations, missionReads, missions, snapshots] =
      await Promise.all([
        import("@/server/db/client"),
        import("@/server/missions/evaluation-service"),
        import("@/server/missions/read"),
        import("@/server/missions/service"),
        import("@/server/missions/snapshot"),
      ]);
    client = database.db;
    adminId = (
      await client.user.findUniqueOrThrow({
        where: { loginIdNormalized: "admin" },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await database?.db.$disconnect();
  });

  async function setupParticipantWeek() {
    const suffix = randomUUID().slice(0, 8);
    const definitionVersion =
      (Number.parseInt(randomUUID().slice(0, 6), 16) % 1_000_000) + 1_000;
    const weekStart = new Date(fixedNow.getTime() - 60_000);
    const weekEnd = new Date(fixedNow.getTime() + 7 * 24 * 60 * 60_000);
    const season = await client.season.create({
      data: {
        name: `mission-${suffix}`,
        slug: `mission-${suffix}`,
        status: SeasonStatus.ACTIVE,
        timezone: "Asia/Seoul",
        startAt: weekStart,
        endAt: weekEnd,
        minGameDurationSeconds: 600,
        autoRevealHours: 12,
        rulesVersion: "mission-integration-v1",
        config: { queueId: 420 },
        createdById: adminId,
      },
    });
    const week = await client.week.create({
      data: {
        seasonId: season.id,
        number: 1,
        name: "미션 통합 주차",
        status: WeekStatus.ACTIVE,
        startAt: weekStart,
        endAt: weekEnd,
        missionCatalogVersion: `v${definitionVersion}`,
        rulesSnapshot: { missionTimelineAvailable: true },
      },
    });
    const user = await client.user.create({
      data: {
        loginId: `mission-${suffix}`,
        loginIdNormalized: `mission-${suffix}`,
        realName: `미션 ${suffix}`,
        passwordHash: "integration-password-hash",
      },
    });
    const participant = await client.participant.create({
      data: {
        userId: user.id,
        puuid: `MISSION_PUUID_${suffix}`,
        summonerId: `MISSION_SUMMONER_${suffix}`,
        gameName: `Mission${suffix}`,
        tagLine: "TEST",
        primaryPosition: "TOP",
        approvedAt: weekStart,
        approvedById: adminId,
      },
    });
    await client.seasonParticipant.create({
      data: {
        seasonId: season.id,
        participantId: participant.id,
        joinedAt: weekStart,
      },
    });
    const participantWeek = await client.participantWeek.create({
      data: { weekId: week.id, participantId: participant.id },
    });

    const definitions = [
      {
        code: "X001",
        points: 2,
        kind: MissionKind.SINGLE,
        source: MissionSourceType.MATCH_INFO,
      },
      {
        code: "X002",
        points: 5,
        kind: MissionKind.SINGLE,
        source: MissionSourceType.MATCH_INFO,
      },
      {
        code: "X003",
        points: 5,
        kind: MissionKind.SINGLE,
        source: MissionSourceType.MATCH_INFO,
      },
      {
        code: "X004",
        points: 3,
        kind: MissionKind.SINGLE,
        source: MissionSourceType.MATCH_TIMELINE,
      },
      {
        code: "X005",
        points: 3,
        kind: MissionKind.SINGLE,
        source: MissionSourceType.MATCH_TIMELINE,
      },
      {
        code: "X006",
        points: 3,
        kind: MissionKind.SINGLE,
        source: MissionSourceType.MATCH_TIMELINE,
      },
      {
        code: "X007",
        points: 2,
        kind: MissionKind.CUMULATIVE,
        source: MissionSourceType.DERIVED,
      },
      {
        code: "X008",
        points: 3,
        kind: MissionKind.CUMULATIVE,
        source: MissionSourceType.DERIVED,
      },
      {
        code: "X009",
        points: 3,
        kind: MissionKind.CUMULATIVE,
        source: MissionSourceType.DERIVED,
      },
      {
        code: "X010",
        points: 3,
        kind: MissionKind.SINGLE,
        source: MissionSourceType.MATCH_INFO,
      },
      {
        code: "X011",
        points: 3,
        kind: MissionKind.SINGLE,
        source: MissionSourceType.MATCH_INFO,
      },
      {
        code: "X012",
        points: 3,
        kind: MissionKind.SINGLE,
        source: MissionSourceType.MATCH_INFO,
      },
    ];
    await client.missionDefinition.createMany({
      data: definitions.map((definition) => ({
        code: definition.code,
        version: definitionVersion,
        title: definition.code,
        description: `${definition.code} integration definition`,
        category:
          definition.kind === MissionKind.CUMULATIVE
            ? MissionCategory.CUMULATIVE
            : MissionCategory.RESULT,
        kind: definition.kind,
        difficulty:
          definition.points >= 5
            ? MissionDifficulty.EPIC
            : MissionDifficulty.NORMAL,
        points: definition.points,
        evaluatorKey:
          definition.kind === MissionKind.CUMULATIVE
            ? "cumulative.games"
            : "match.win",
        evaluatorConfig: { target: "1", evaluatorVersion: "v1" },
        sourceType: definition.source,
        target: 1,
      })),
    });
    return {
      season,
      week,
      user,
      participant,
      participantWeek,
      weekStart,
      weekEnd,
    };
  }

  async function createParticipantMatch(
    fixture: Awaited<ReturnType<typeof setupParticipantWeek>>,
    matchStartAt: Date,
    options: {
      win?: boolean;
      championId?: number;
      position?: "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";
      kills?: number;
    } = {},
  ) {
    const suffix = randomUUID().slice(0, 8);
    const match = await client.match.create({
      data: {
        riotMatchId: `KR_MISSION_${suffix}`,
        regionalRoute: "ASIA",
        queueId: 420,
        mapId: 11,
        gameMode: "CLASSIC",
        gameType: "MATCHED_GAME",
        gameVersion: "26.15.1",
        gameStartAt: matchStartAt,
        gameEndAt: new Date(matchStartAt.getTime() + 30 * 60_000),
        durationSeconds: 1_800,
        earlySurrender: false,
        status: "PROCESSED",
        ingestedAt: fixedNow,
      },
    });
    const seasonMatch = await client.seasonMatch.create({
      data: {
        seasonId: fixture.season.id,
        matchId: match.id,
        weekId: fixture.week.id,
        status: "PROCESSED",
      },
    });
    const raw = await client.matchParticipantRaw.create({
      data: {
        matchId: match.id,
        puuid: fixture.participant.puuid,
        teamId: 100,
        participantIndex: 1,
        position: options.position ?? "TOP",
        championId: options.championId ?? 1,
        championName: "Annie",
        win: options.win ?? true,
        kills: options.kills ?? 1,
        deaths: 0,
        assists: 1,
        totalMinionsKilled: 100,
        neutralMinionsKilled: 0,
        goldEarned: 10_000,
        damageToChampions: 10_000,
        damageTaken: 5_000,
        damageMitigated: 5_000,
        damageToObjectives: 2_000,
        damageToTurrets: 1_000,
        visionScore: 20,
        wardsPlaced: 5,
        wardsKilled: 1,
        controlWardsPlaced: 1,
        timeCCingOthers: 10,
        healOnTeammates: 0,
        shieldOnTeammates: 0,
        items: [],
        perks: [],
        summonerSpells: [],
        challenges: {},
        normalizedMetrics: {},
      },
    });
    const participantMatch = await client.participantMatch.create({
      data: {
        participantId: fixture.participant.id,
        participantWeekId: fixture.participantWeek.id,
        seasonMatchId: seasonMatch.id,
        matchParticipantRawId: raw.id,
        eligible: true,
        win: options.win ?? true,
        position: options.position ?? "TOP",
        championId: options.championId ?? 1,
        championName: "Annie",
        kills: options.kills ?? 1,
        deaths: 0,
        assists: 1,
        cs: 100,
        kda: 2,
        killParticipation: 0.5,
      },
    });
    await client.$transaction((transaction) =>
      snapshots.captureMissionMatchSnapshot({
        transaction,
        participantMatchId: participantMatch.id,
        participantWeekId: fixture.participantWeek.id,
        matchStartAt,
      }),
    );
    return participantMatch;
  }

  async function createCumulativeAssignment(input: {
    fixture: Awaited<ReturnType<typeof setupParticipantWeek>>;
    code: "M086" | "M090" | "M096";
    evaluatorKey:
      | "cumulative.games"
      | "cumulative.winStreak"
      | "cumulative.distinctChampions";
    target: number;
  }) {
    const version =
      (Number.parseInt(randomUUID().slice(0, 6), 16) % 1_000_000) + 2_000;
    const definition = await client.missionDefinition.create({
      data: {
        code: input.code,
        version,
        title: `${input.code} integration`,
        description: "cumulative integration definition",
        category: MissionCategory.CUMULATIVE,
        kind: MissionKind.CUMULATIVE,
        difficulty: MissionDifficulty.NORMAL,
        points: 4,
        evaluatorKey: input.evaluatorKey,
        evaluatorConfig: {
          target: String(input.target),
          evaluatorVersion: "v1",
        },
        sourceType: MissionSourceType.DERIVED,
        target: input.target,
      },
    });
    const assignment = await client.weeklyMissionAssignment.create({
      data: {
        participantWeekId: input.fixture.participantWeek.id,
        missionDefinitionId: definition.id,
        selectionKey: `cumulative:${randomUUID()}`,
        selectionSeedHash: `seed:${randomUUID()}`,
        selectionMetadata: { reason: "INTEGRATION" },
        assignedAt: fixedNow,
        activeFrom: fixedNow,
        target: input.target,
        unit: "count",
        seenOrder: 1,
        evaluatorVersion: "v1",
      },
    });
    await client.missionRefillState.create({
      data: {
        participantWeekId: input.fixture.participantWeek.id,
        credits: 0,
        maxCredits: 3,
        intervalMinutes: 360,
        anchorAt: fixedNow,
        accountedThroughAt: fixedNow,
        nextAccrualAt: new Date(fixedNow.getTime() + 6 * 60 * 60_000),
      },
    });
    await client.missionCandidateHistory.create({
      data: {
        participantWeekId: input.fixture.participantWeek.id,
        missionDefinitionId: definition.id,
        firstSeenAt: fixedNow,
        timesAssigned: 1,
        status: MissionCandidateStatus.ACTIVE,
      },
    });
    return assignment;
  }

  it("initializes five guarded assignments once and records auditable selection metadata", async () => {
    const fixture = await setupParticipantWeek();
    const selector = new FirstCandidateSelector();
    const first = await missions.initializeParticipantWeekMissions({
      participantWeekId: fixture.participantWeek.id,
      now: fixedNow,
      selector,
    });
    const second = await missions.initializeParticipantWeekMissions({
      participantWeekId: fixture.participantWeek.id,
      now: fixedNow,
      selector,
    });
    expect(first).toMatchObject({ created: 5, active: 5, vacancies: 0 });
    expect(second).toMatchObject({ created: 0, active: 5, vacancies: 0 });

    const assignments = await client.weeklyMissionAssignment.findMany({
      where: {
        participantWeekId: fixture.participantWeek.id,
        state: MissionAssignmentState.ACTIVE,
      },
      include: { missionDefinition: true },
    });
    expect(assignments).toHaveLength(5);
    expect(
      assignments.filter(
        (assignment) => assignment.missionDefinition.points >= 5,
      ),
    ).toHaveLength(1);
    expect(
      assignments.filter(
        (assignment) =>
          assignment.missionDefinition.sourceType ===
          MissionSourceType.MATCH_TIMELINE,
      ),
    ).toHaveLength(2);
    expect(
      assignments.filter(
        (assignment) =>
          assignment.missionDefinition.kind === MissionKind.CUMULATIVE,
      ).length,
    ).toBeLessThanOrEqual(2);
    expect(
      assignments.every((assignment) => assignment.selectionSeedHash),
    ).toBe(true);
    expect(
      assignments.every(
        (assignment) =>
          typeof assignment.selectionMetadata === "object" &&
          assignment.selectionMetadata !== null,
      ),
    ).toBe(true);
  });

  it("serializes concurrent rerolls, enforces cooldown, and keeps the game-start snapshot", async () => {
    const fixture = await setupParticipantWeek();
    const selector = new FirstCandidateSelector();
    await missions.initializeParticipantWeekMissions({
      participantWeekId: fixture.participantWeek.id,
      now: fixedNow,
      selector,
    });
    const target = await client.weeklyMissionAssignment.findFirstOrThrow({
      where: {
        participantWeekId: fixture.participantWeek.id,
        state: MissionAssignmentState.ACTIVE,
      },
      orderBy: { seenOrder: "asc" },
    });
    const participantMatch = await createParticipantMatch(
      fixture,
      new Date(fixedNow.getTime() + 60_000),
    );
    const rerollAt = new Date(fixedNow.getTime() + 5 * 60_000);
    const requests = await Promise.allSettled([
      missions.rerollMissionAssignment({
        assignmentId: target.id,
        userId: fixture.user.id,
        idempotencyKey: randomUUID(),
        now: rerollAt,
        selector,
      }),
      missions.rerollMissionAssignment({
        assignmentId: target.id,
        userId: fixture.user.id,
        idempotencyKey: randomUUID(),
        now: rerollAt,
        selector,
      }),
    ]);
    expect(
      requests.filter((request) => request.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      requests.filter((request) => request.status === "rejected"),
    ).toHaveLength(1);

    const snapshot = await client.missionMatchSnapshot.findUniqueOrThrow({
      where: { participantMatchId: participantMatch.id },
      include: { assignments: true },
    });
    expect(snapshot.assignments.map((entry) => entry.assignmentId)).toContain(
      target.id,
    );
    const targetAfter = await client.weeklyMissionAssignment.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(targetAfter.state).toBe(MissionAssignmentState.REROLLED);
    expect(
      await client.missionCandidateHistory.findUniqueOrThrow({
        where: {
          participantWeekId_missionDefinitionId: {
            participantWeekId: fixture.participantWeek.id,
            missionDefinitionId: target.missionDefinitionId,
          },
        },
      }),
    ).toMatchObject({ status: MissionCandidateStatus.DEFERRED });

    await expect(
      missions.rerollMissionAssignment({
        assignmentId: (
          await client.weeklyMissionAssignment.findFirstOrThrow({
            where: {
              participantWeekId: fixture.participantWeek.id,
              state: MissionAssignmentState.ACTIVE,
            },
            orderBy: { seenOrder: "desc" },
          })
        ).id,
        userId: fixture.user.id,
        idempotencyKey: randomUUID(),
        now: new Date(rerollAt.getTime() + 59 * 60_000),
        selector,
      }),
    ).rejects.toMatchObject({ code: "MISSION_REROLL_COOLDOWN" });

    await expect(
      missions.completeMissionAssignment({
        assignmentId: target.id,
        participantMatchId: participantMatch.id,
        now: new Date(rerollAt.getTime() + 65 * 60_000),
        selector,
      }),
    ).resolves.toMatchObject({ completed: true, filled: 0 });
  });

  it("checks mission ownership before returning an idempotent reroll replay", async () => {
    const fixture = await setupParticipantWeek();
    const selector = new FirstCandidateSelector();
    await missions.initializeParticipantWeekMissions({
      participantWeekId: fixture.participantWeek.id,
      now: fixedNow,
      selector,
    });
    const target = await client.weeklyMissionAssignment.findFirstOrThrow({
      where: {
        participantWeekId: fixture.participantWeek.id,
        state: MissionAssignmentState.ACTIVE,
      },
      orderBy: { seenOrder: "asc" },
    });
    const idempotencyKey = randomUUID();
    await missions.rerollMissionAssignment({
      assignmentId: target.id,
      userId: fixture.user.id,
      idempotencyKey,
      now: new Date(fixedNow.getTime() + 5 * 60_000),
      selector,
    });

    await expect(
      missions.rerollMissionAssignment({
        assignmentId: target.id,
        userId: randomUUID(),
        idempotencyKey,
        now: new Date(fixedNow.getTime() + 6 * 60_000),
        selector,
      }),
    ).rejects.toMatchObject({ code: "MISSION_ASSIGNMENT_FORBIDDEN" });
  });

  it("catches up credits to cap three, immediately fills a completed vacancy, and expires at week end", async () => {
    const fixture = await setupParticipantWeek();
    const selector = new FirstCandidateSelector();
    await missions.initializeParticipantWeekMissions({
      participantWeekId: fixture.participantWeek.id,
      now: fixedNow,
      selector,
    });
    const catchUpAt = new Date(fixture.weekStart.getTime() + 30 * 60 * 60_000);
    const refillRequests = await Promise.all([
      missions.refillParticipantWeekMissions({
        participantWeekId: fixture.participantWeek.id,
        now: catchUpAt,
        selector,
      }),
      missions.refillParticipantWeekMissions({
        participantWeekId: fixture.participantWeek.id,
        now: catchUpAt,
        selector,
      }),
    ]);
    expect(refillRequests.some((result) => result.accrued === 5)).toBe(true);
    expect(
      await client.missionRefillState.findUniqueOrThrow({
        where: { participantWeekId: fixture.participantWeek.id },
      }),
    ).toMatchObject({ credits: 3 });

    const target = await client.weeklyMissionAssignment.findFirstOrThrow({
      where: {
        participantWeekId: fixture.participantWeek.id,
        state: MissionAssignmentState.ACTIVE,
      },
      orderBy: { seenOrder: "asc" },
    });
    const participantMatch = await createParticipantMatch(
      fixture,
      new Date(fixedNow.getTime() + 60_000),
    );
    const completed = await missions.completeMissionAssignment({
      assignmentId: target.id,
      participantMatchId: participantMatch.id,
      now: catchUpAt,
      selector,
    });
    expect(completed).toMatchObject({ completed: true, filled: 1 });
    expect(
      await client.weeklyMissionAssignment.count({
        where: {
          participantWeekId: fixture.participantWeek.id,
          state: MissionAssignmentState.ACTIVE,
        },
      }),
    ).toBe(5);
    expect(
      await client.missionRefillState.findUniqueOrThrow({
        where: { participantWeekId: fixture.participantWeek.id },
      }),
    ).toMatchObject({ credits: 2 });

    expect(
      await missions.expireParticipantWeekMissions({
        participantWeekId: fixture.participantWeek.id,
        now: fixture.weekEnd,
      }),
    ).toBe(5);
    expect(
      await client.weeklyMissionAssignment.count({
        where: {
          participantWeekId: fixture.participantWeek.id,
          state: MissionAssignmentState.ACTIVE,
        },
      }),
    ).toBe(0);

    const secondWeekEnd = new Date(
      fixture.weekEnd.getTime() + 7 * 24 * 60 * 60_000,
    );
    await client.season.update({
      where: { id: fixture.season.id },
      data: { endAt: secondWeekEnd },
    });
    const secondWeek = await client.week.create({
      data: {
        seasonId: fixture.season.id,
        number: 2,
        name: "미션 통합 2주차",
        status: WeekStatus.ACTIVE,
        startAt: fixture.weekEnd,
        endAt: secondWeekEnd,
        missionCatalogVersion: fixture.week.missionCatalogVersion,
        rulesSnapshot: { missionTimelineAvailable: true },
      },
    });
    const secondParticipantWeek = await client.participantWeek.create({
      data: {
        weekId: secondWeek.id,
        participantId: fixture.participant.id,
      },
    });
    await expect(
      missions.initializeParticipantWeekMissions({
        participantWeekId: secondParticipantWeek.id,
        now: fixture.weekEnd,
        selector,
      }),
    ).resolves.toMatchObject({ created: 5, active: 5 });
    expect(
      await client.missionCandidateHistory.count({
        where: { participantWeekId: secondParticipantWeek.id },
      }),
    ).toBe(5);
  });

  it("completes multiple snapshot missions once and makes same-match reprocessing a no-op", async () => {
    const fixture = await setupParticipantWeek();
    const selector = new FirstCandidateSelector();
    await missions.initializeParticipantWeekMissions({
      participantWeekId: fixture.participantWeek.id,
      now: fixedNow,
      selector,
    });
    const participantMatch = await createParticipantMatch(
      fixture,
      new Date(fixedNow.getTime() + 60_000),
    );

    const first = await missionEvaluations.evaluateSeasonMatchMissions(
      participantMatch.seasonMatchId,
      new Date(fixedNow.getTime() + 35 * 60_000),
    );
    expect(first).toMatchObject({
      evaluated: 5,
      completed: 5,
      pending: 0,
      duplicates: 0,
    });
    const second = await missionEvaluations.evaluateSeasonMatchMissions(
      participantMatch.seasonMatchId,
      new Date(fixedNow.getTime() + 36 * 60_000),
    );
    expect(second).toMatchObject({
      evaluated: 5,
      completed: 5,
      pending: 0,
      duplicates: 5,
    });

    expect(
      await client.missionCompletionLedger.count({
        where: { participantWeekId: fixture.participantWeek.id },
      }),
    ).toBe(5);
    expect(
      await client.missionProgressEvent.count({
        where: { participantMatchId: participantMatch.id },
      }),
    ).toBe(5);
    const points = await client.missionCompletionLedger.aggregate({
      where: { participantWeekId: fixture.participantWeek.id },
      _sum: { points: true },
    });
    const participantWeek = await client.participantWeek.findUniqueOrThrow({
      where: { id: fixture.participantWeek.id },
    });
    expect(participantWeek.missionScoreCached).toBe(points._sum.points);
  });

  it("rebuilds cumulative game progress from append-only deltas and pays once", async () => {
    const fixture = await setupParticipantWeek();
    const assignment = await createCumulativeAssignment({
      fixture,
      code: "M086",
      evaluatorKey: "cumulative.games",
      target: 3,
    });
    const matches = [];
    for (let index = 1; index <= 3; index += 1) {
      const participantMatch = await createParticipantMatch(
        fixture,
        new Date(fixedNow.getTime() + index * 60_000),
      );
      matches.push(participantMatch);
      await missionEvaluations.evaluateSeasonMatchMissions(
        participantMatch.seasonMatchId,
        new Date(fixedNow.getTime() + (index + 40) * 60_000),
      );
    }
    await missionEvaluations.evaluateSeasonMatchMissions(
      matches[1]!.seasonMatchId,
      new Date(fixedNow.getTime() + 50 * 60_000),
    );

    const events = await client.missionProgressEvent.findMany({
      where: { assignmentId: assignment.id },
      orderBy: { createdAt: "asc" },
    });
    expect(events).toHaveLength(3);
    expect(events.map((event) => Number(event.deltaValue))).toEqual([1, 1, 1]);
    expect(
      events.reduce((sum, event) => sum + Number(event.deltaValue), 0),
    ).toBe(3);
    expect(
      await client.missionCompletionLedger.count({
        where: { assignmentId: assignment.id },
      }),
    ).toBe(1);
    expect(
      await client.weeklyMissionAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
      }),
    ).toMatchObject({ state: MissionAssignmentState.COMPLETED });
  });

  it("rejects delayed mission evaluation after the week is finalized", async () => {
    const fixture = await setupParticipantWeek();
    await missions.initializeParticipantWeekMissions({
      participantWeekId: fixture.participantWeek.id,
      now: fixedNow,
      selector: new FirstCandidateSelector(),
    });
    const participantMatch = await createParticipantMatch(fixture, fixedNow);
    await client.week.update({
      where: { id: fixture.week.id },
      data: { status: WeekStatus.COMPLETED },
    });

    await expect(
      missionEvaluations.evaluateSeasonMatchMissions(
        participantMatch.seasonMatchId,
        fixedNow,
      ),
    ).rejects.toMatchObject({ code: "WEEK_CLOSED" });
    await expect(
      client.missionProgressEvent.count({
        where: { participantMatchId: participantMatch.id },
      }),
    ).resolves.toBe(0);
  });

  it("uses set semantics for distinct champions across duplicate values", async () => {
    const fixture = await setupParticipantWeek();
    const assignment = await createCumulativeAssignment({
      fixture,
      code: "M096",
      evaluatorKey: "cumulative.distinctChampions",
      target: 2,
    });
    for (const [index, championId] of [1, 1, 2].entries()) {
      const participantMatch = await createParticipantMatch(
        fixture,
        new Date(fixedNow.getTime() + (index + 1) * 60_000),
        { championId },
      );
      await missionEvaluations.evaluateSeasonMatchMissions(
        participantMatch.seasonMatchId,
        new Date(fixedNow.getTime() + (index + 40) * 60_000),
      );
    }
    const events = await client.missionProgressEvent.findMany({
      where: { assignmentId: assignment.id },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((event) => Number(event.deltaValue))).toEqual([1, 0, 1]);
    expect(
      await client.weeklyMissionAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
      }),
    ).toMatchObject({ state: MissionAssignmentState.COMPLETED });
  });

  it("resets a win streak on loss before completing a later streak", async () => {
    const fixture = await setupParticipantWeek();
    const assignment = await createCumulativeAssignment({
      fixture,
      code: "M090",
      evaluatorKey: "cumulative.winStreak",
      target: 3,
    });
    for (const [index, win] of [true, false, true, true, true].entries()) {
      const participantMatch = await createParticipantMatch(
        fixture,
        new Date(fixedNow.getTime() + (index + 1) * 60_000),
        { win },
      );
      await missionEvaluations.evaluateSeasonMatchMissions(
        participantMatch.seasonMatchId,
        new Date(fixedNow.getTime() + (index + 40) * 60_000),
      );
    }
    const events = await client.missionProgressEvent.findMany({
      where: { assignmentId: assignment.id },
      orderBy: { createdAt: "asc" },
    });
    expect(events.map((event) => Number(event.afterValue))).toEqual([
      1, 0, 1, 2, 3,
    ]);
    expect(events.map((event) => Number(event.deltaValue))).toEqual([
      1, -1, 1, 1, 1,
    ]);
    expect(
      await client.missionCompletionLedger.count({
        where: { assignmentId: assignment.id },
      }),
    ).toBe(1);
  });

  it("derives streak progress from match time when ingestion is out of order", async () => {
    const fixture = await setupParticipantWeek();
    const assignment = await createCumulativeAssignment({
      fixture,
      code: "M090",
      evaluatorKey: "cumulative.winStreak",
      target: 3,
    });
    const matches = [];
    for (const [index, win] of [true, false, true, true].entries()) {
      matches.push(
        await createParticipantMatch(
          fixture,
          new Date(fixedNow.getTime() + (index + 1) * 60_000),
          { win },
        ),
      );
    }
    for (const [index, participantMatch] of [...matches].reverse().entries()) {
      await missionEvaluations.evaluateSeasonMatchMissions(
        participantMatch.seasonMatchId,
        new Date(fixedNow.getTime() + (index + 40) * 60_000),
      );
    }

    expect(
      await client.weeklyMissionAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
      }),
    ).toMatchObject({
      state: MissionAssignmentState.ACTIVE,
      progress: expect.objectContaining({}),
    });
    expect(
      Number(
        (
          await client.weeklyMissionAssignment.findUniqueOrThrow({
            where: { id: assignment.id },
          })
        ).progress,
      ),
    ).toBe(2);

    const completingMatch = await createParticipantMatch(
      fixture,
      new Date(fixedNow.getTime() + 5 * 60_000),
      { win: true },
    );
    await missionEvaluations.evaluateSeasonMatchMissions(
      completingMatch.seasonMatchId,
      new Date(fixedNow.getTime() + 50 * 60_000),
    );
    expect(
      await client.weeklyMissionAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
      }),
    ).toMatchObject({
      state: MissionAssignmentState.COMPLETED,
      completedByParticipantMatchId: completingMatch.id,
    });
  });

  it("uses authoritative ledger scores, competition ties, and always shows names", async () => {
    const fixture = await setupParticipantWeek();
    const suffix = randomUUID().slice(0, 8);
    await client.user.update({
      where: { id: fixture.user.id },
      data: { realNamePublic: true, realNamePublicConsentAt: fixedNow },
    });
    const secondUser = await client.user.create({
      data: {
        loginId: `mission-rank-${suffix}`,
        loginIdNormalized: `mission-rank-${suffix}`,
        realName: `private-${suffix}`,
        passwordHash: "integration-password-hash",
      },
    });
    const secondParticipant = await client.participant.create({
      data: {
        userId: secondUser.id,
        puuid: `MISSION_RANK_PUUID_${suffix}`,
        summonerId: `MISSION_RANK_SUMMONER_${suffix}`,
        gameName: `Rank${suffix}`,
        tagLine: "TEST",
        primaryPosition: "TOP",
        approvedAt: fixture.weekStart,
        approvedById: adminId,
      },
    });
    await client.seasonParticipant.create({
      data: {
        seasonId: fixture.season.id,
        participantId: secondParticipant.id,
        joinedAt: fixture.weekStart,
      },
    });
    const secondParticipantWeek = await client.participantWeek.create({
      data: {
        weekId: fixture.week.id,
        participantId: secondParticipant.id,
      },
    });
    await client.missionCompletionLedger.createMany({
      data: [fixture.participantWeek.id, secondParticipantWeek.id].map(
        (participantWeekId) => ({
          participantWeekId,
          type: MissionLedgerType.ADMIN_ADJUSTMENT,
          points: 7,
          idempotencyKey: `mission-rank:${participantWeekId}`,
        }),
      ),
    });

    const leaderboard = await missionReads.getMissionLeaderboard({
      weekId: fixture.week.id,
      now: fixedNow,
    });
    expect(leaderboard?.standings.map((row) => row.rank)).toEqual([1, 1]);
    expect(
      leaderboard?.standings.find(
        (row) => row.participantId === fixture.participant.id,
      )?.realName,
    ).toBe(fixture.user.realName);
    expect(
      leaderboard?.standings.find(
        (row) => row.participantId === secondParticipant.id,
      )?.realName,
    ).toBe(secondUser.realName);
  });

  it("reads completed-week history only from the immutable snapshot", async () => {
    const fixture = await setupParticipantWeek();
    const storedStandings = [
      {
        rank: 1,
        gameName: fixture.participant.gameName,
        tagLine: fixture.participant.tagLine,
        realName: null,
        score: 13,
        completed: 4,
      },
    ];
    await client.week.update({
      where: { id: fixture.week.id },
      data: { status: WeekStatus.COMPLETED },
    });
    await client.weekSnapshot.create({
      data: {
        weekId: fixture.week.id,
        generatedAt: fixture.weekEnd,
        rulesSnapshot: { version: "mission-history-v1" },
        standings: [],
        missionStandings: storedStandings,
        highlights: {},
        checksum: `mission-history-${randomUUID()}`,
      },
    });
    await client.participant.update({
      where: { id: fixture.participant.id },
      data: { gameName: `Changed${randomUUID().slice(0, 6)}` },
    });
    await expect(
      client.participantWeek.update({
        where: { id: fixture.participantWeek.id },
        data: { missionScoreCached: 999 },
      }),
    ).rejects.toMatchObject({ code: "P2039" });

    const history = await missionReads.getMissionHistory();
    expect(
      history.find((week) => week.id === fixture.week.id)?.standings,
    ).toEqual(storedStandings);
  });
});
