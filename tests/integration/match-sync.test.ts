import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  MatchStatus,
  RankSnapshotStatus,
  SeasonStatus,
  type PrismaClient,
} from "@/generated/prisma/client";
import type { RandomBytesSource } from "@/domain/scoring/point-draw";
import { MockRiotClient } from "@/features/riot/mock-client";
import type {
  MatchListInput,
  NormalizedMatch,
  RankedSoloSnapshot,
} from "@/features/riot/types";

import type * as DatabaseModule from "@/server/db/client";
import type * as IngestModule from "@/server/sync/ingest";
import type * as LeaseModule from "@/server/sync/lease";
import type * as SyncServiceModule from "@/server/sync/service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseDescribe = testDatabaseUrl ? describe : describe.skip;
const fixedNow = new Date("2026-08-05T03:00:00.000Z");

function drawRandomSource(byte: number): RandomBytesSource {
  let fill = 1;
  return (length) => {
    if (length === 1) return Uint8Array.of(byte);
    const bytes = new Uint8Array(length).fill(fill);
    fill += 1;
    return bytes;
  };
}

class FixtureRiotClient extends MockRiotClient {
  private failuresRemaining: number;

  constructor(
    private readonly fixtureMatches: readonly NormalizedMatch[],
    failures = 0,
  ) {
    super(fixedNow);
    this.failuresRemaining = failures;
  }

  override async listMatchIds(input: MatchListInput) {
    const start = input.start ?? 0;
    const count = input.count ?? 20;
    return this.fixtureMatches
      .filter((match) =>
        match.participants.some(
          (participant) => participant.puuid === input.puuid,
        ),
      )
      .filter(
        (match) => !input.startTime || match.gameStartAt >= input.startTime,
      )
      .filter((match) => !input.endTime || match.gameStartAt <= input.endTime)
      .sort(
        (left, right) =>
          right.gameStartAt.getTime() - left.gameStartAt.getTime(),
      )
      .slice(start, start + count)
      .map((match) => match.matchId);
  }

  override async getMatch(matchId: string) {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error("fixture transient match failure");
    }
    const match = this.fixtureMatches.find(
      (candidate) => candidate.matchId === matchId,
    );
    if (!match) throw new Error("fixture match missing");
    return structuredClone(match);
  }

  override async getSoloQueueSnapshot(): Promise<RankedSoloSnapshot> {
    return {
      queueType: "RANKED_SOLO_5x5",
      tier: "EMERALD",
      rank: "II",
      leaguePoints: 42,
      wins: 20,
      losses: 15,
      hotStreak: false,
      veteran: false,
      freshBlood: false,
      inactive: false,
    };
  }
}

databaseDescribe("match sync and rank snapshots", () => {
  let database: typeof DatabaseModule;
  let ingest: typeof IngestModule;
  let syncService: typeof SyncServiceModule;
  let lease: typeof LeaseModule;
  let client: PrismaClient;
  let adminId: string;
  let baselineId: string;
  let template: NormalizedMatch;

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    Object.assign(process.env, {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      AUTH_SECRET: "match-sync-integration-auth-secret-32-characters",
      CRON_SECRET: "match-sync-integration-cron-secret-32-characters",
      MOCK_RIOT_API: "true",
      SYNC_BATCH_SIZE: "5",
      SYNC_MATCH_PAGE_SIZE: "2",
      SYNC_TIME_BUDGET_MS: "60000",
      SYNC_PARTICIPANT_COOLDOWN_SECONDS: "0",
      APP_URL: "http://localhost:3000",
      APP_TIME_ZONE: "Asia/Seoul",
      ALLOW_DEMO_MVP_REWARDS: "true",
    });
    [database, ingest, syncService, lease] = await Promise.all([
      import("@/server/db/client"),
      import("@/server/sync/ingest"),
      import("@/server/sync/service"),
      import("@/server/sync/lease"),
    ]);
    client = database.db;
    adminId = (
      await client.user.findUniqueOrThrow({
        where: { loginIdNormalized: "admin" },
        select: { id: true },
      })
    ).id;
    baselineId = (
      await client.mvpBaselineVersion.findUniqueOrThrow({
        where: { name: "DEMO_ONLY-v1" },
        select: { id: true },
      })
    ).id;
    template = await new MockRiotClient(fixedNow).getMatch("KR_MOCK_WIN_001");
  });

  afterAll(async () => {
    await database?.db.$disconnect();
  });

  async function setupSeason(participantCount: number) {
    const suffix = randomUUID().slice(0, 8);
    const season = await client.season.create({
      data: {
        name: `sync-${suffix}`,
        slug: `sync-${suffix}`,
        status: SeasonStatus.ACTIVE,
        timezone: "Asia/Seoul",
        startAt: new Date(fixedNow.getTime() - 24 * 60 * 60 * 1_000),
        endAt: new Date(fixedNow.getTime() + 24 * 60 * 60 * 1_000),
        minGameDurationSeconds: 600,
        rulesVersion: "integration-v1",
        config: { queueId: 420 },
        createdById: adminId,
      },
    });
    const week = await client.week.create({
      data: {
        seasonId: season.id,
        number: 1,
        name: "통합 주차",
        status: "ACTIVE",
        startAt: season.startAt,
        endAt: season.endAt,
        baselineVersionId: baselineId,
        missionCatalogVersion: "v1",
        rulesSnapshot: { version: "integration-v1" },
      },
    });
    const participants = [];
    for (let index = 0; index < participantCount; index += 1) {
      const user = await client.user.create({
        data: {
          loginId: `sync-${suffix}-${index}`,
          loginIdNormalized: `sync-${suffix}-${index}`,
          realName: `동기화 ${index}`,
          passwordHash: "integration-password-hash",
        },
      });
      const participant = await client.participant.create({
        data: {
          userId: user.id,
          puuid: `SYNC_PUUID_${suffix}_${index}`,
          summonerId: `SYNC_SUMMONER_${suffix}_${index}`,
          gameName: `SyncPlayer${index}`,
          tagLine: suffix,
          approvedAt: season.startAt,
          approvedById: adminId,
        },
      });
      await client.seasonParticipant.create({
        data: {
          seasonId: season.id,
          participantId: participant.id,
          joinedAt: season.startAt,
        },
      });
      await client.participantWeek.create({
        data: { weekId: week.id, participantId: participant.id },
      });
      participants.push(participant);
    }
    return { season, week, participants, suffix };
  }

  function fixtureMatch(input: {
    matchId: string;
    puuids: readonly string[];
    championName?: string;
    minutesAgo?: number;
  }): NormalizedMatch {
    const gameStartAt = new Date(
      fixedNow.getTime() - (input.minutesAgo ?? 30) * 60_000,
    );
    return {
      ...structuredClone(template),
      matchId: input.matchId,
      gameStartAt,
      gameEndAt: new Date(
        gameStartAt.getTime() + template.durationSeconds * 1_000,
      ),
      participants: template.participants.map((participant, index) => ({
        ...participant,
        puuid: input.puuids[index] ?? `UNTRACKED_${input.matchId}_${index}`,
        ...(index === 0 && input.championName
          ? { championName: input.championName }
          : {}),
      })),
    };
  }

  it("ingests one shared match once, links every tracked participant, and queues processing once", async () => {
    const setup = await setupSeason(2);
    const match = fixtureMatch({
      matchId: `KR_INT_SHARED_${setup.suffix}`,
      puuids: setup.participants.map((participant) => participant.puuid),
    });
    const riotClient = new FixtureRiotClient([match]);
    const invocationKey = `integration:shared:${randomUUID()}`;
    const first = await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        trigger: "MANUAL",
        requestedById: adminId,
        invocationKey,
        force: true,
        dryRun: false,
      },
      { riotClient, now: () => fixedNow },
    );
    expect(first).toMatchObject({
      status: "SUCCEEDED",
      participantCount: 2,
      matchesProcessed: 1,
      errorCount: 0,
    });
    const storedSeasonMatch = await client.seasonMatch.findFirstOrThrow({
      where: {
        seasonId: setup.season.id,
        match: { riotMatchId: match.matchId },
      },
      select: { id: true },
    });
    const [storedMatch, seasonMatches, participantMatches, outbox] =
      await Promise.all([
        client.match.count({ where: { riotMatchId: match.matchId } }),
        client.seasonMatch.count({
          where: {
            seasonId: setup.season.id,
            match: { riotMatchId: match.matchId },
          },
        }),
        client.participantMatch.count({
          where: {
            seasonMatch: {
              seasonId: setup.season.id,
              match: { riotMatchId: match.matchId },
            },
          },
        }),
        client.processingOutbox.count({
          where: {
            type: "PROCESS_SEASON_MATCH",
            aggregateId: storedSeasonMatch.id,
          },
        }),
      ]);
    expect(storedMatch).toBe(1);
    expect(seasonMatches).toBe(1);
    expect(participantMatches).toBe(2);
    expect(outbox).toBe(1);

    const repeatedInvocation = await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        trigger: "MANUAL",
        requestedById: adminId,
        invocationKey,
        force: true,
        dryRun: false,
      },
      { riotClient, now: () => fixedNow },
    );
    expect(repeatedInvocation).toEqual(first);
    expect(await client.syncRun.count({ where: { invocationKey } })).toBe(1);

    const second = await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        trigger: "MANUAL",
        requestedById: adminId,
        invocationKey: `integration:repeat:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      { riotClient, now: () => fixedNow },
    );
    expect(second.matchesProcessed).toBe(0);
    expect(
      await client.participantMatch.count({
        where: {
          seasonMatch: {
            seasonId: setup.season.id,
            match: { riotMatchId: match.matchId },
          },
        },
      }),
    ).toBe(2);
    const rankStatuses = await client.rankSnapshot.findMany({
      where: { seasonId: setup.season.id },
      orderBy: { capturedAt: "asc" },
      select: { status: true },
    });
    expect(
      rankStatuses.filter(
        ({ status }) => status === RankSnapshotStatus.CAPTURED,
      ),
    ).toHaveLength(2);
    expect(
      rankStatuses.filter(
        ({ status }) => status === RankSnapshotStatus.UNCHANGED,
      ),
    ).toHaveLength(2);
    expect(
      await client.dailyStandingSnapshot.count({
        where: { weekId: setup.week.id },
      }),
    ).toBe(2);
  });

  it("paginates a fixed window and finds a late-arriving match on the overlap scan", async () => {
    const setup = await setupSeason(1);
    const participant = setup.participants[0]!;
    const initialMatches = [10, 20, 30].map((minutesAgo, index) =>
      fixtureMatch({
        matchId: `KR_INT_PAGE_${setup.suffix}_${index}`,
        puuids: [participant.puuid],
        minutesAgo,
      }),
    );
    const first = await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        participantId: participant.id,
        trigger: "MANUAL",
        invocationKey: `integration:page:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      {
        riotClient: new FixtureRiotClient(initialMatches),
        now: () => fixedNow,
      },
    );
    expect(first.matchesProcessed).toBe(3);
    await expect(
      client.syncCursor.findUniqueOrThrow({
        where: { participantId: participant.id },
        select: { paginationStart: true, paginationWindowStartAt: true },
      }),
    ).resolves.toEqual({
      paginationStart: 0,
      paginationWindowStartAt: null,
    });

    const lateMatch = fixtureMatch({
      matchId: `KR_INT_LATE_${setup.suffix}`,
      puuids: [participant.puuid],
      minutesAgo: 25,
    });
    const second = await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        participantId: participant.id,
        trigger: "MANUAL",
        invocationKey: `integration:late:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      {
        riotClient: new FixtureRiotClient([...initialMatches, lateMatch]),
        now: () => fixedNow,
      },
    );
    expect(second.matchesProcessed).toBe(1);
    expect(
      await client.match.count({ where: { riotMatchId: lateMatch.matchId } }),
    ).toBe(1);
  });

  it("reuses one global match and raw participant across overlapping seasons", async () => {
    const firstSetup = await setupSeason(1);
    const participant = firstSetup.participants[0]!;
    const match = fixtureMatch({
      matchId: `KR_INT_OVERLAP_${firstSetup.suffix}`,
      puuids: [participant.puuid],
    });
    const riotClient = new FixtureRiotClient([match]);
    await syncService.runMatchSync(
      {
        seasonId: firstSetup.season.id,
        participantId: participant.id,
        trigger: "MANUAL",
        invocationKey: `integration:overlap-a:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      { riotClient, now: () => fixedNow },
    );

    const secondSetup = await setupSeason(0);
    await client.seasonParticipant.create({
      data: {
        seasonId: secondSetup.season.id,
        participantId: participant.id,
        joinedAt: secondSetup.season.startAt,
      },
    });
    await client.participantWeek.create({
      data: {
        weekId: secondSetup.week.id,
        participantId: participant.id,
      },
    });
    await syncService.runMatchSync(
      {
        seasonId: secondSetup.season.id,
        participantId: participant.id,
        trigger: "MANUAL",
        invocationKey: `integration:overlap-b:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      { riotClient, now: () => fixedNow },
    );

    const stored = await client.match.findUniqueOrThrow({
      where: { riotMatchId: match.matchId },
      select: {
        _count: { select: { rawParticipants: true, seasonMatches: true } },
        rawParticipants: {
          where: { puuid: participant.puuid },
          select: { _count: { select: { participantMatches: true } } },
        },
      },
    });
    expect(stored._count).toEqual({ rawParticipants: 10, seasonMatches: 2 });
    expect(stored.rawParticipants[0]?._count.participantMatches).toBe(2);
  });

  it("rotates a limited participant batch and reports continuation", async () => {
    const setup = await setupSeason(4);
    const riotClient = new FixtureRiotClient([]);
    const first = await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        trigger: "MANUAL",
        invocationKey: `integration:batch-a:${randomUUID()}`,
        force: true,
        dryRun: false,
        limit: 2,
      },
      { riotClient, now: () => fixedNow },
    );
    expect(first).toMatchObject({ participantCount: 2, hasMore: true });
    const second = await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        trigger: "MANUAL",
        invocationKey: `integration:batch-b:${randomUUID()}`,
        force: true,
        dryRun: false,
        limit: 2,
      },
      { riotClient, now: () => fixedNow },
    );
    expect(second.participantCount).toBe(2);
    expect(
      await client.rankSnapshot.count({ where: { seasonId: setup.season.id } }),
    ).toBe(4);
  });

  it("stops at the soft time budget and persists a safe continuation", async () => {
    const setup = await setupSeason(2);
    let elapsed = 0;
    const result = await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        trigger: "WORKER",
        invocationKey: `integration:timeout:${randomUUID()}`,
        force: true,
        dryRun: false,
        timeBudgetMs: 1_000,
      },
      {
        riotClient: new FixtureRiotClient([]),
        now: () => fixedNow,
        elapsedMs: () => {
          elapsed += 600;
          return elapsed;
        },
      },
    );

    expect(result).toMatchObject({
      status: "SUCCEEDED",
      matchesProcessed: 0,
      hasMore: true,
    });
    const stored = await client.syncRun.findUniqueOrThrow({
      where: { id: result.runId },
      select: { metadata: true },
    });
    expect(stored.metadata).toMatchObject({
      hasMore: true,
      metrics: { pending: 1 },
    });
  });

  it("keeps a failed page retryable and succeeds without duplicates on the next run", async () => {
    const setup = await setupSeason(1);
    const participant = setup.participants[0]!;
    const match = fixtureMatch({
      matchId: `KR_INT_RETRY_${setup.suffix}`,
      puuids: [participant.puuid],
    });
    const riotClient = new FixtureRiotClient([match], 1);
    const failed = await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        participantId: participant.id,
        trigger: "MANUAL",
        invocationKey: `integration:fail:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      { riotClient, now: () => fixedNow },
    );
    expect(failed.status).toBe("FAILED");
    expect(failed.errorCount).toBe(1);
    expect(
      await client.match.count({ where: { riotMatchId: match.matchId } }),
    ).toBe(0);

    const recovered = await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        participantId: participant.id,
        trigger: "MANUAL",
        invocationKey: `integration:recover:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      { riotClient, now: () => fixedNow },
    );
    expect(recovered).toMatchObject({
      status: "SUCCEEDED",
      matchesProcessed: 1,
      errorCount: 0,
    });
  });

  it("rolls back the entire match transaction when a normalized row violates the DB contract", async () => {
    const setup = await setupSeason(1);
    const participant = setup.participants[0]!;
    const match = fixtureMatch({
      matchId: `KR_INT_ROLLBACK_${setup.suffix}`,
      puuids: [participant.puuid],
      championName: "X".repeat(80),
    });
    const result = await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        participantId: participant.id,
        trigger: "MANUAL",
        invocationKey: `integration:rollback:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      { riotClient: new FixtureRiotClient([match]), now: () => fixedNow },
    );
    expect(result.status).toBe("FAILED");
    expect(
      await client.match.findUnique({ where: { riotMatchId: match.matchId } }),
    ).toBeNull();
    expect(
      await client.seasonMatch.count({ where: { seasonId: setup.season.id } }),
    ).toBe(0);
  });

  it("rejects a stale ingest snapshot after its season has been finalized", async () => {
    const setup = await setupSeason(1);
    const participant = setup.participants[0]!;
    const match = fixtureMatch({
      matchId: `KR_INT_STALE_FINALIZED_${setup.suffix}`,
      puuids: [participant.puuid],
    });
    const staleSeasonWindow = {
      id: setup.season.id,
      startAt: setup.season.startAt,
      endAt: setup.season.endAt,
      minGameDurationSeconds: setup.season.minGameDurationSeconds,
      weeks: [
        {
          id: setup.week.id,
          startAt: setup.week.startAt,
          endAt: setup.week.endAt,
        },
      ],
    };
    await client.week.update({
      where: { id: setup.week.id },
      data: { status: "COMPLETED" },
    });
    await client.season.update({
      where: { id: setup.season.id },
      data: { status: SeasonStatus.COMPLETED },
    });

    await expect(
      ingest.ingestNormalizedMatch({
        season: staleSeasonWindow,
        match,
        now: fixedNow,
        dryRun: false,
      }),
    ).rejects.toMatchObject({ code: "SYNC_SEASON_CLOSED" });
    await expect(
      client.match.count({ where: { riotMatchId: match.matchId } }),
    ).resolves.toBe(0);
  });

  it("grants one owner for a competing lease and allows recovery after expiry", async () => {
    const key = `integration:lease:${randomUUID()}`;
    const now = fixedNow;
    const [first, second] = await Promise.all([
      lease.acquireJobLease({ key, now, durationMs: 30_000 }),
      lease.acquireJobLease({ key, now, durationMs: 30_000 }),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    const withinSafetyWindow = await lease.acquireJobLease({
      key,
      now: new Date(now.getTime() + 30_001),
      durationMs: 30_000,
      recoveryGraceMs: 30_000,
    });
    expect(withinSafetyWindow).toBeNull();
    const recovered = await lease.acquireJobLease({
      key,
      now: new Date(now.getTime() + 60_001),
      durationMs: 30_000,
      recoveryGraceMs: 30_000,
    });
    expect(recovered).toBeTruthy();
    if (recovered) await lease.releaseJobLease(key, recovered);
  });

  it("settles eligible matches before reporting sync success", async () => {
    const setup = await setupSeason(1);
    const participant = setup.participants[0]!;
    const match = fixtureMatch({
      matchId: `KR_INT_PENDING_${setup.suffix}`,
      puuids: [participant.puuid],
    });
    await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        participantId: participant.id,
        trigger: "MANUAL",
        invocationKey: `integration:pending:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      { riotClient: new FixtureRiotClient([match]), now: () => fixedNow },
    );
    await expect(
      client.seasonMatch.findFirstOrThrow({
        where: {
          seasonId: setup.season.id,
          match: { riotMatchId: match.matchId },
        },
        select: {
          status: true,
          processedAt: true,
          participantMatches: {
            select: {
              processedAt: true,
              pointDraw: { select: { id: true } },
              scoreLedger: { select: { type: true } },
            },
          },
        },
      }),
    ).resolves.toMatchObject({
      status: MatchStatus.PROCESSED,
      processedAt: expect.any(Date),
      participantMatches: [
        {
          processedAt: expect.any(Date),
          pointDraw: { id: expect.any(String) },
          scoreLedger: [{ type: "MATCH_INITIAL" }],
        },
      ],
    });
  });

  it("evaluates all ten players, grants only the tracked team winner, and stays idempotent", async () => {
    const setup = await setupSeason(1);
    const participant = setup.participants[0]!;
    const puuids = Array.from(
      { length: 10 },
      (_, index) => `UNTRACKED_MVP_${setup.suffix}_${index}`,
    );
    puuids[0] = participant.puuid;
    const match = fixtureMatch({
      matchId: `KR_INT_MVP_${setup.suffix}`,
      puuids,
    });
    await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        participantId: participant.id,
        trigger: "MANUAL",
        invocationKey: `integration:mvp:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      { riotClient: new FixtureRiotClient([match]), now: () => fixedNow },
    );
    const stored = await client.seasonMatch.findFirstOrThrow({
      where: {
        seasonId: setup.season.id,
        match: { riotMatchId: match.matchId },
      },
      select: {
        id: true,
        mvpEvaluations: {
          select: {
            status: true,
            award: true,
            baselineVersionId: true,
            participantMatchId: true,
            matchParticipantRaw: {
              select: { startingTier: true, tierBucket: true },
            },
          },
        },
        participantMatches: {
          select: {
            participantWeek: { select: { mvpCount: true, aceCount: true } },
            pointDraw: {
              select: {
                rerollEligible: true,
                rerollEntitlementKey: true,
                rerollEntitlementSource: true,
              },
            },
          },
        },
      },
    });
    expect(stored.mvpEvaluations).toHaveLength(10);
    expect(
      stored.mvpEvaluations.every(
        (evaluation) =>
          evaluation.status === "COMPLETED" &&
          evaluation.baselineVersionId === baselineId &&
          evaluation.matchParticipantRaw.startingTier === "EMERALD" &&
          evaluation.matchParticipantRaw.tierBucket === "EMERALD",
      ),
    ).toBe(true);
    expect(
      stored.mvpEvaluations.filter((evaluation) => evaluation.award === "MVP"),
    ).toHaveLength(1);
    expect(
      stored.mvpEvaluations.filter((evaluation) => evaluation.award === "ACE"),
    ).toHaveLength(1);
    const trackedEvaluation = stored.mvpEvaluations.find(
      (evaluation) => evaluation.participantMatchId !== null,
    );
    expect(trackedEvaluation?.award).toBe("MVP");
    expect(stored.participantMatches[0]).toMatchObject({
      participantWeek: { mvpCount: 1, aceCount: 0 },
      pointDraw: {
        rerollEligible: true,
        rerollEntitlementKey: expect.any(String),
        rerollEntitlementSource: "DEMO_ONLY",
      },
    });

    const { evaluateSeasonMatchMvpAce } =
      await import("@/server/mvp/evaluation-service");
    const repeated = await evaluateSeasonMatchMvpAce(stored.id, fixedNow);
    expect(repeated.entitlementsGranted).toBe(0);
    expect(
      await client.mvpEvaluation.count({ where: { seasonMatchId: stored.id } }),
    ).toBe(10);
    expect(
      await client.participantWeek.findFirstOrThrow({
        where: { weekId: setup.week.id, participantId: participant.id },
        select: { mvpCount: true },
      }),
    ).toEqual({ mvpCount: 1 });

    await client.week.update({
      where: { id: setup.week.id },
      data: { status: "COMPLETED" },
    });
    await expect(
      evaluateSeasonMatchMvpAce(stored.id, fixedNow),
    ).rejects.toThrow("MVP_EVALUATION_COMPETITION_CLOSED");
    await expect(
      client.mvpEvaluation.count({ where: { seasonMatchId: stored.id } }),
    ).resolves.toBe(10);
  });

  it("records the original MVP scheduler failure without masking it", async () => {
    const setup = await setupSeason(1);
    const participant = setup.participants[0]!;
    const match = fixtureMatch({
      matchId: `KR_INT_MVP_FAILURE_${setup.suffix}`,
      puuids: [participant.puuid],
    });
    await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        participantId: participant.id,
        trigger: "MANUAL",
        invocationKey: `integration:mvp-failure:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      { riotClient: new FixtureRiotClient([match]), now: () => fixedNow },
    );
    const seasonMatch = await client.seasonMatch.findFirstOrThrow({
      where: {
        seasonId: setup.season.id,
        match: { riotMatchId: match.matchId },
      },
      select: { id: true },
    });
    const dedupeKey = `season-match:${seasonMatch.id}:mvp-evaluate:v1`;
    const failureNow = new Date(fixedNow.getTime() + 60 * 60_000);
    await Promise.all([
      client.week.update({
        where: { id: setup.week.id },
        data: { status: "COMPLETED" },
      }),
      client.processingOutbox.update({
        where: { dedupeKey },
        data: {
          status: "PENDING",
          attempts: 2,
          availableAt: failureNow,
          processedAt: null,
          lockedAt: failureNow,
          lastError: null,
        },
      }),
    ]);

    const { backfillMvpEvaluations } =
      await import("@/server/mvp/evaluation-service");
    await expect(
      backfillMvpEvaluations({
        seasonId: setup.season.id,
        limit: 10,
        now: failureNow,
      }),
    ).resolves.toMatchObject({
      examined: 1,
      processed: 0,
      pending: 0,
      failed: 1,
    });
    await expect(
      client.processingOutbox.findUniqueOrThrow({
        where: { dedupeKey },
        select: {
          status: true,
          attempts: true,
          availableAt: true,
          lockedAt: true,
          lastError: true,
        },
      }),
    ).resolves.toEqual({
      status: "FAILED",
      attempts: 3,
      availableAt: new Date(failureNow.getTime() + 5 * 60_000),
      lockedAt: null,
      lastError: "MVP_EVALUATION_COMPETITION_CLOSED",
    });
  });

  it("keeps pending MVP work retryable and recovers after its baseline appears", async () => {
    const setup = await setupSeason(1);
    await client.week.update({
      where: { id: setup.week.id },
      data: { baselineVersionId: null },
    });
    const participant = setup.participants[0]!;
    const match = fixtureMatch({
      matchId: `KR_INT_MVP_PENDING_${setup.suffix}`,
      puuids: [participant.puuid],
    });
    await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        participantId: participant.id,
        trigger: "MANUAL",
        invocationKey: `integration:mvp-pending:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      { riotClient: new FixtureRiotClient([match]), now: () => fixedNow },
    );
    const seasonMatch = await client.seasonMatch.findFirstOrThrow({
      where: {
        seasonId: setup.season.id,
        match: { riotMatchId: match.matchId },
      },
      select: { id: true },
    });
    const dedupeKey = `season-match:${seasonMatch.id}:mvp-evaluate:v1`;
    await expect(
      client.processingOutbox.findUniqueOrThrow({
        where: { dedupeKey },
        select: {
          status: true,
          availableAt: true,
          processedAt: true,
          lastError: true,
        },
      }),
    ).resolves.toEqual({
      status: "PENDING",
      availableAt: new Date(fixedNow.getTime() + 5 * 60_000),
      processedAt: null,
      lastError: "MVP_DATA_PENDING",
    });
    await expect(
      client.mvpEvaluation.count({
        where: {
          seasonMatchId: seasonMatch.id,
          status: "PENDING_BASELINE",
        },
      }),
    ).resolves.toBe(10);

    await client.week.update({
      where: { id: setup.week.id },
      data: { baselineVersionId: baselineId },
    });
    const retryNow = new Date(fixedNow.getTime() + 5 * 60_000 + 1);
    const { backfillMvpEvaluations } =
      await import("@/server/mvp/evaluation-service");
    await expect(
      backfillMvpEvaluations({
        seasonId: setup.season.id,
        limit: 10,
        now: retryNow,
      }),
    ).resolves.toMatchObject({
      examined: 1,
      processed: 1,
      pending: 0,
      failed: 0,
    });
    await expect(
      client.mvpEvaluation.count({
        where: { seasonMatchId: seasonMatch.id, status: "COMPLETED" },
      }),
    ).resolves.toBe(10);
    await expect(
      client.mvpEvaluation.count({ where: { seasonMatchId: seasonMatch.id } }),
    ).resolves.toBe(20);
    await expect(
      client.processingOutbox.findUniqueOrThrow({
        where: { dedupeKey },
        select: { status: true, processedAt: true, lastError: true },
      }),
    ).resolves.toEqual({
      status: "PROCESSED",
      processedAt: retryNow,
      lastError: null,
    });
  });

  it("recovers pending participant data and appends the newly ranked team outcome", async () => {
    const setup = await setupSeason(10);
    const match = fixtureMatch({
      matchId: `KR_INT_MVP_DATA_RECOVERY_${setup.suffix}`,
      puuids: setup.participants.map((participant) => participant.puuid),
    });
    const pendingParticipant = match.participants[0];
    if (!pendingParticipant?.position) {
      throw new Error("fixture participant position missing");
    }
    const recoveredPosition = pendingParticipant.position;
    match.participants[0] = { ...pendingParticipant, position: null };

    await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        participantId: setup.participants[0]!.id,
        trigger: "MANUAL",
        invocationKey: `integration:mvp-data-recovery:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      { riotClient: new FixtureRiotClient([match]), now: () => fixedNow },
    );
    const seasonMatch = await client.seasonMatch.findFirstOrThrow({
      where: {
        seasonId: setup.season.id,
        match: { riotMatchId: match.matchId },
      },
      select: { id: true, matchId: true },
    });
    const dedupeKey = `season-match:${seasonMatch.id}:mvp-evaluate:v1`;
    await expect(
      client.mvpEvaluation.groupBy({
        by: ["status"],
        where: { seasonMatchId: seasonMatch.id },
        _count: true,
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "COMPLETED", _count: 9 }),
        expect.objectContaining({ status: "PENDING_DATA", _count: 1 }),
      ]),
    );
    await expect(
      client.processingOutbox.findUniqueOrThrow({
        where: { dedupeKey },
        select: { status: true, availableAt: true, lastError: true },
      }),
    ).resolves.toEqual({
      status: "PENDING",
      availableAt: new Date(fixedNow.getTime() + 5 * 60_000),
      lastError: "MVP_DATA_PENDING",
    });

    await client.matchParticipantRaw.update({
      where: {
        matchId_participantIndex: {
          matchId: seasonMatch.matchId,
          participantIndex: pendingParticipant.participantId,
        },
      },
      data: { position: recoveredPosition },
    });
    const retryNow = new Date(fixedNow.getTime() + 5 * 60_000 + 1);
    const { backfillMvpEvaluations } =
      await import("@/server/mvp/evaluation-service");
    await expect(
      backfillMvpEvaluations({
        seasonId: setup.season.id,
        limit: 10,
        now: retryNow,
      }),
    ).resolves.toMatchObject({
      examined: 1,
      processed: 1,
      pending: 0,
      failed: 0,
    });

    const effective = await client.mvpEvaluation.findMany({
      where: {
        seasonMatchId: seasonMatch.id,
        corrections: { none: {} },
      },
      select: {
        status: true,
        award: true,
        supersedesEvaluationId: true,
      },
    });
    expect(effective).toHaveLength(10);
    expect(
      effective.every((evaluation) => evaluation.status === "COMPLETED"),
    ).toBe(true);
    expect(
      effective.filter((evaluation) => evaluation.award !== "NONE"),
    ).toHaveLength(2);
    expect(
      effective.filter((evaluation) => evaluation.supersedesEvaluationId),
    ).toHaveLength(5);
    await expect(
      client.mvpEvaluation.count({ where: { seasonMatchId: seasonMatch.id } }),
    ).resolves.toBe(15);
    await expect(
      client.participantWeek.aggregate({
        where: { weekId: setup.week.id },
        _sum: { mvpCount: true, aceCount: true },
      }),
    ).resolves.toMatchObject({
      _sum: { mvpCount: 1, aceCount: 1 },
    });
    await expect(
      client.processingOutbox.findUniqueOrThrow({
        where: { dedupeKey },
        select: { status: true, processedAt: true, lastError: true },
      }),
    ).resolves.toEqual({
      status: "PROCESSED",
      processedAt: retryNow,
      lastError: null,
    });
  });

  it("supersedes the latest effective version and reconciles award caches and unused entitlements", async () => {
    const setup = await setupSeason(10);
    const match = fixtureMatch({
      matchId: `KR_INT_MVP_VERSION_${setup.suffix}`,
      puuids: setup.participants.map((participant) => participant.puuid),
    });
    await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        participantId: setup.participants[0]!.id,
        trigger: "MANUAL",
        invocationKey: `integration:mvp-version:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      { riotClient: new FixtureRiotClient([match]), now: () => fixedNow },
    );
    const seasonMatch = await client.seasonMatch.findFirstOrThrow({
      where: {
        seasonId: setup.season.id,
        match: { riotMatchId: match.matchId },
      },
      select: {
        id: true,
        mvpEvaluations: {
          where: { corrections: { none: {} } },
          select: {
            id: true,
            evaluationKey: true,
            matchParticipantRawId: true,
            participantMatchId: true,
            baselineVersionId: true,
            status: true,
            errorCode: true,
            tierBucket: true,
            position: true,
            visionObjectiveScore: true,
            growthScore: true,
            damageScore: true,
            kdaParticipationScore: true,
            totalScore: true,
            teamRank: true,
            award: true,
            metrics: true,
            tieBreak: true,
            participantMatch: {
              select: {
                participantWeekId: true,
                participantWeek: {
                  select: { mvpCount: true, aceCount: true },
                },
                pointDraw: {
                  select: {
                    id: true,
                    rerollEligible: true,
                    rerollEntitlementKey: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    const priorMvp = seasonMatch.mvpEvaluations.find(
      (evaluation) => evaluation.award === "MVP" && evaluation.participantMatch,
    );
    const priorNone = seasonMatch.mvpEvaluations.find(
      (evaluation) =>
        evaluation.award === "NONE" && evaluation.participantMatch,
    );
    expect(priorMvp).toBeDefined();
    expect(priorNone).toBeDefined();
    if (!priorMvp?.participantMatch || !priorNone?.participantMatch) return;
    const fakeMvpKey = `mvp:test-correction:${randomUUID()}`;
    const fakeMvp = await client.mvpEvaluation.create({
      data: {
        evaluationKey: fakeMvpKey,
        seasonMatchId: seasonMatch.id,
        matchParticipantRawId: priorNone.matchParticipantRawId,
        participantMatchId: priorNone.participantMatchId,
        baselineVersionId: priorNone.baselineVersionId,
        status: priorNone.status,
        errorCode: priorNone.errorCode,
        tierBucket: priorNone.tierBucket,
        position: priorNone.position,
        visionObjectiveScore: priorNone.visionObjectiveScore,
        growthScore: priorNone.growthScore,
        damageScore: priorNone.damageScore,
        kdaParticipationScore: priorNone.kdaParticipationScore,
        totalScore: priorNone.totalScore,
        teamRank: priorNone.teamRank,
        award: "MVP",
        evaluatorVersion: "mvp-ace-v1-hotfix",
        metrics: JSON.parse(JSON.stringify(priorNone.metrics)),
        tieBreak: JSON.parse(JSON.stringify(priorNone.tieBreak)),
        supersedesEvaluationId: priorNone.id,
        createdAt: new Date(fixedNow.getTime() + 1),
      },
      select: { id: true },
    });
    await client.participantWeek.update({
      where: { id: priorNone.participantMatch.participantWeekId },
      data: { mvpCount: { increment: 1 } },
    });
    const { grantRerollEntitlement } = await import("@/server/scoring/service");
    await grantRerollEntitlement({
      entitlementKey: fakeMvpKey,
      participantMatchId: priorNone.participantMatchId!,
      source: "DEMO_ONLY",
      grantedAt: fixedNow,
      expiresAt: setup.week.endAt,
      reason: "MVP_VERSION_CORRECTION_FIXTURE",
      demoOnly: true,
    });

    const correctionNow = new Date(fixedNow.getTime() + 10 * 60_000);
    const dedupeKey = `season-match:${seasonMatch.id}:mvp-evaluate:v1`;
    await client.processingOutbox.update({
      where: { dedupeKey },
      data: {
        status: "PENDING",
        availableAt: correctionNow,
        processedAt: null,
      },
    });
    const { evaluateSeasonMatchMvpAce } =
      await import("@/server/mvp/evaluation-service");
    await expect(
      evaluateSeasonMatchMvpAce(seasonMatch.id, correctionNow, {
        evaluatorVersion: "mvp-ace-v2",
      }),
    ).resolves.toMatchObject({
      evaluatorVersion: "mvp-ace-v2",
      completed: 10,
      pending: 0,
      awards: 2,
      entitlementsGranted: 0,
    });

    const [correctedNone, correctedMvp] = await Promise.all([
      client.mvpEvaluation.findFirstOrThrow({
        where: {
          seasonMatchId: seasonMatch.id,
          matchParticipantRawId: priorNone.matchParticipantRawId,
          evaluatorVersion: "mvp-ace-v2",
        },
        select: {
          id: true,
          award: true,
          supersedesEvaluationId: true,
          participantMatch: {
            select: {
              participantWeek: { select: { mvpCount: true } },
              pointDraw: {
                select: {
                  rerollEligible: true,
                  rerollEntitlementKey: true,
                },
              },
            },
          },
        },
      }),
      client.mvpEvaluation.findFirstOrThrow({
        where: {
          seasonMatchId: seasonMatch.id,
          matchParticipantRawId: priorMvp.matchParticipantRawId,
          evaluatorVersion: "mvp-ace-v2",
        },
        select: {
          evaluationKey: true,
          award: true,
          supersedesEvaluationId: true,
          participantMatch: {
            select: {
              participantWeek: { select: { mvpCount: true } },
              pointDraw: { select: { rerollEntitlementKey: true } },
            },
          },
        },
      }),
    ]);
    expect(correctedNone).toMatchObject({
      award: "NONE",
      supersedesEvaluationId: fakeMvp.id,
      participantMatch: {
        participantWeek: { mvpCount: 0 },
        pointDraw: {
          rerollEligible: false,
          rerollEntitlementKey: null,
        },
      },
    });
    expect(correctedMvp).toMatchObject({
      award: "MVP",
      supersedesEvaluationId: priorMvp.id,
      participantMatch: {
        participantWeek: { mvpCount: 1 },
        pointDraw: { rerollEntitlementKey: correctedMvp.evaluationKey },
      },
    });
    await expect(
      client.auditLog.count({
        where: {
          action: {
            in: ["MVP_ENTITLEMENT_REPLACED", "MVP_ENTITLEMENT_REVOKED"],
          },
          requestId: { startsWith: "mvp:" },
        },
      }),
    ).resolves.toBeGreaterThanOrEqual(3);
  });

  it("preserves a consumed entitlement while committing a later evaluator correction", async () => {
    const setup = await setupSeason(10);
    const match = fixtureMatch({
      matchId: `KR_INT_MVP_USED_CORRECTION_${setup.suffix}`,
      puuids: setup.participants.map((participant) => participant.puuid),
    });
    await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        participantId: setup.participants[0]!.id,
        trigger: "MANUAL",
        invocationKey: `integration:mvp-used-correction:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      { riotClient: new FixtureRiotClient([match]), now: () => fixedNow },
    );
    const seasonMatch = await client.seasonMatch.findFirstOrThrow({
      where: {
        seasonId: setup.season.id,
        match: { riotMatchId: match.matchId },
      },
      select: {
        id: true,
        mvpEvaluations: {
          where: { award: "NONE", corrections: { none: {} } },
          take: 1,
          select: {
            id: true,
            matchParticipantRawId: true,
            participantMatchId: true,
            baselineVersionId: true,
            status: true,
            errorCode: true,
            tierBucket: true,
            position: true,
            visionObjectiveScore: true,
            growthScore: true,
            damageScore: true,
            kdaParticipationScore: true,
            totalScore: true,
            teamRank: true,
            metrics: true,
            tieBreak: true,
            participantMatch: {
              select: {
                participantWeekId: true,
                participant: { select: { userId: true } },
                pointDraw: { select: { id: true } },
              },
            },
          },
        },
      },
    });
    const priorNone = seasonMatch.mvpEvaluations[0];
    if (
      !priorNone?.participantMatch?.pointDraw ||
      !priorNone.participantMatchId
    ) {
      throw new Error("eligible NONE evaluation fixture missing");
    }
    const consumedEntitlementKey = `mvp:test-used-correction:${randomUUID()}`;
    const fakeMvp = await client.mvpEvaluation.create({
      data: {
        evaluationKey: consumedEntitlementKey,
        seasonMatchId: seasonMatch.id,
        matchParticipantRawId: priorNone.matchParticipantRawId,
        participantMatchId: priorNone.participantMatchId,
        baselineVersionId: priorNone.baselineVersionId,
        status: priorNone.status,
        errorCode: priorNone.errorCode,
        tierBucket: priorNone.tierBucket,
        position: priorNone.position,
        visionObjectiveScore: priorNone.visionObjectiveScore,
        growthScore: priorNone.growthScore,
        damageScore: priorNone.damageScore,
        kdaParticipationScore: priorNone.kdaParticipationScore,
        totalScore: priorNone.totalScore,
        teamRank: priorNone.teamRank,
        award: "MVP",
        evaluatorVersion: "mvp-ace-v1-used-hotfix",
        metrics: JSON.parse(JSON.stringify(priorNone.metrics)),
        tieBreak: JSON.parse(JSON.stringify(priorNone.tieBreak)),
        supersedesEvaluationId: priorNone.id,
        createdAt: new Date(fixedNow.getTime() + 1),
      },
      select: { id: true },
    });
    await client.participantWeek.update({
      where: { id: priorNone.participantMatch.participantWeekId },
      data: { mvpCount: { increment: 1 } },
    });
    const scoring = await import("@/server/scoring/service");
    await scoring.grantRerollEntitlement({
      entitlementKey: consumedEntitlementKey,
      participantMatchId: priorNone.participantMatchId,
      source: "DEMO_ONLY",
      grantedAt: fixedNow,
      expiresAt: setup.week.endAt,
      reason: "MVP_USED_VERSION_CORRECTION_FIXTURE",
      demoOnly: true,
    });
    await scoring.revealPointDraw({
      drawId: priorNone.participantMatch.pointDraw.id,
      userId: priorNone.participantMatch.participant.userId,
      now: new Date(fixedNow.getTime() + 60_000),
    });
    const rerollUsedAt = new Date(fixedNow.getTime() + 2 * 60_000);
    await scoring.rerollPointDraw({
      drawId: priorNone.participantMatch.pointDraw.id,
      userId: priorNone.participantMatch.participant.userId,
      confirmed: true,
      now: rerollUsedAt,
      randomSource: drawRandomSource(2),
    });

    const correctionNow = new Date(fixedNow.getTime() + 10 * 60_000);
    const dedupeKey = `season-match:${seasonMatch.id}:mvp-evaluate:v1`;
    await client.processingOutbox.update({
      where: { dedupeKey },
      data: {
        status: "PENDING",
        availableAt: correctionNow,
        processedAt: null,
      },
    });
    const { evaluateSeasonMatchMvpAce } =
      await import("@/server/mvp/evaluation-service");
    await expect(
      evaluateSeasonMatchMvpAce(seasonMatch.id, correctionNow, {
        evaluatorVersion: "mvp-ace-v2-used-correction",
      }),
    ).resolves.toMatchObject({
      completed: 10,
      pending: 0,
      awards: 2,
    });

    await expect(
      client.mvpEvaluation.findFirstOrThrow({
        where: {
          seasonMatchId: seasonMatch.id,
          matchParticipantRawId: priorNone.matchParticipantRawId,
          evaluatorVersion: "mvp-ace-v2-used-correction",
        },
        select: {
          award: true,
          supersedesEvaluationId: true,
          participantMatch: {
            select: {
              participantWeek: { select: { mvpCount: true } },
              pointDraw: {
                select: {
                  state: true,
                  rerollEntitlementKey: true,
                  rerollUsedAt: true,
                },
              },
            },
          },
        },
      }),
    ).resolves.toMatchObject({
      award: "NONE",
      supersedesEvaluationId: fakeMvp.id,
      participantMatch: {
        participantWeek: { mvpCount: 0 },
        pointDraw: {
          state: "REROLLED",
          rerollEntitlementKey: consumedEntitlementKey,
          rerollUsedAt,
        },
      },
    });
    await expect(
      client.auditLog.findFirstOrThrow({
        where: {
          action: "MVP_USED_ENTITLEMENT_PRESERVED",
          targetId: priorNone.participantMatch.pointDraw.id,
        },
        select: { reason: true, requestId: true, before: true, after: true },
      }),
    ).resolves.toMatchObject({
      reason: "MVP_EVALUATOR_CORRECTION_mvp-ace-v2-used-correction",
      requestId: expect.stringMatching(/^mvp:/u),
      before: {
        award: "MVP",
        entitlementKey: consumedEntitlementKey,
      },
      after: {
        award: "NONE",
        preservedEntitlementKey: consumedEntitlementKey,
      },
    });
  });

  it("keeps a retired Week baseline snapshot valid after a newer baseline is published", async () => {
    const setup = await setupSeason(1);
    const sourceBaseline = await client.mvpBaselineVersion.findUniqueOrThrow({
      where: { id: baselineId },
      include: { metrics: true },
    });
    const baselineContent = {
      metadata: {
        name: `MVP-LIFECYCLE-${setup.suffix}`,
        sourceDescription: "Retired baseline snapshot integration fixture",
        patchFrom: sourceBaseline.patchFrom,
        patchTo: sourceBaseline.patchTo,
        collectedAt: fixedNow.toISOString(),
        sampleNotes: "Publishes v2 while the test Week retains v1",
        demoOnly: true,
      },
      metrics: sourceBaseline.metrics.map((metric) => ({
        tierBucket: metric.tierBucket,
        position: metric.position,
        metricKey: metric.metricKey,
        mean: Number(metric.mean),
        stdDev: Number(metric.stdDev),
        sampleSize: metric.sampleSize,
        lowerBound:
          metric.lowerBound === null ? null : Number(metric.lowerBound),
        upperBound:
          metric.upperBound === null ? null : Number(metric.upperBound),
      })),
    };
    const mvpBaselineService = await import("@/server/mvp/baseline-service");
    const validation = mvpBaselineService.validateMvpBaseline({
      format: "JSON",
      content: baselineContent,
    });
    expect(validation.report).toMatchObject({ valid: true, rowCount: 320 });
    if (!validation.checksum) throw new Error("baseline checksum missing");
    const publishedV2 = await mvpBaselineService.publishMvpBaseline({
      format: "JSON",
      content: baselineContent,
      expectedChecksum: validation.checksum,
      confirmationName: baselineContent.metadata.name,
      actorUserId: adminId,
      requestId: randomUUID(),
      now: new Date(fixedNow.getTime() + 1),
    });
    expect(publishedV2.status).toBe("PUBLISHED");
    await expect(
      client.mvpBaselineVersion.findUniqueOrThrow({
        where: { id: baselineId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "RETIRED" });
    await expect(
      client.week.findUniqueOrThrow({
        where: { id: setup.week.id },
        select: { baselineVersionId: true },
      }),
    ).resolves.toEqual({ baselineVersionId: baselineId });

    const participant = setup.participants[0]!;
    const match = fixtureMatch({
      matchId: `KR_INT_MVP_RETIRED_${setup.suffix}`,
      puuids: [participant.puuid],
    });
    await syncService.runMatchSync(
      {
        seasonId: setup.season.id,
        participantId: participant.id,
        trigger: "MANUAL",
        invocationKey: `integration:mvp-retired:${randomUUID()}`,
        force: true,
        dryRun: false,
      },
      { riotClient: new FixtureRiotClient([match]), now: () => fixedNow },
    );
    const evaluated = await client.seasonMatch.findFirstOrThrow({
      where: {
        seasonId: setup.season.id,
        match: { riotMatchId: match.matchId },
      },
      select: {
        mvpEvaluations: {
          select: { status: true, baselineVersionId: true },
        },
        participantMatches: {
          select: {
            participantWeek: { select: { mvpCount: true } },
            pointDraw: {
              select: {
                rerollEligible: true,
                rerollEntitlementSource: true,
              },
            },
          },
        },
      },
    });
    expect(evaluated.mvpEvaluations).toHaveLength(10);
    expect(
      evaluated.mvpEvaluations.every(
        (evaluation) =>
          evaluation.status === "COMPLETED" &&
          evaluation.baselineVersionId === baselineId,
      ),
    ).toBe(true);
    expect(evaluated.participantMatches[0]).toMatchObject({
      participantWeek: { mvpCount: 1 },
      pointDraw: {
        rerollEligible: true,
        rerollEntitlementSource: "DEMO_ONLY",
      },
    });

    const adminService = await import("@/server/admin/service");
    const readiness = await adminService.getSeasonReadinessChecklist(
      setup.season.id,
    );
    expect(
      readiness.checklist.find((item) => item.key === "baselines")?.detail,
    ).toContain("상태 오류 0주 · coverage 오류 0주");
  });
});
