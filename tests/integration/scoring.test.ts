import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  DrawState,
  MatchStatus,
  MvpAward,
  MvpEvaluationStatus,
  ScoringMode,
  ScoreLedgerType,
  SeasonStatus,
  WeekStatus,
  type PrismaClient,
} from "@/generated/prisma/client";
import {
  DRAW_FIXED_20_VERSION,
  type RandomBytesSource,
} from "@/domain/scoring/point-draw";
import { MockRiotClient } from "@/features/riot/mock-client";
import type { NormalizedMatch } from "@/features/riot/types";

import type * as DatabaseModule from "@/server/db/client";
import type * as ScoringReadModule from "@/server/scoring/read";
import type * as ScoringReconciliationModule from "@/server/scoring/reconciliation";
import type * as ScoringServiceModule from "@/server/scoring/service";
import type * as IngestModule from "@/server/sync/ingest";

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

databaseDescribe("scoring ledger, reveal, reroll, and reconciliation", () => {
  let database: typeof DatabaseModule;
  let scoring: typeof ScoringServiceModule;
  let scoringRead: typeof ScoringReadModule;
  let reconciliation: typeof ScoringReconciliationModule;
  let ingest: typeof IngestModule;
  let client: PrismaClient;
  let adminId: string;

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    Object.assign(process.env, {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      AUTH_SECRET: "scoring-integration-auth-secret-32-characters",
      CRON_SECRET: "scoring-integration-cron-secret-32-characters",
      POINT_DRAW_SECRET: "scoring-integration-draw-secret-32-characters",
      MOCK_RIOT_API: "true",
      POINT_MODE: "RANDOM_17_23",
      ALLOW_DEMO_MVP_REWARDS: "true",
      APP_URL: "http://localhost:3000",
      APP_TIME_ZONE: "Asia/Seoul",
    });
    [database, scoring, scoringRead, reconciliation, ingest] =
      await Promise.all([
        import("@/server/db/client"),
        import("@/server/scoring/service"),
        import("@/server/scoring/read"),
        import("@/server/scoring/reconciliation"),
        import("@/server/sync/ingest"),
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

  async function setupScorableMatch(
    input: {
      win?: boolean;
      scoringMode?: ScoringMode;
      withMissionAssignment?: boolean;
    } = {},
  ) {
    const suffix = randomUUID().slice(0, 8);
    const season = await client.season.create({
      data: {
        name: `scoring-${suffix}`,
        slug: `scoring-${suffix}`,
        status: SeasonStatus.ACTIVE,
        timezone: "Asia/Seoul",
        startAt: new Date(fixedNow.getTime() - 24 * 60 * 60_000),
        endAt: new Date(fixedNow.getTime() + 24 * 60 * 60_000),
        scoringMode: input.scoringMode ?? ScoringMode.RANDOM_17_23,
        minGameDurationSeconds: 600,
        autoRevealHours: 12,
        rulesVersion: "scoring-integration-v1",
        config: { queueId: 420 },
        createdById: adminId,
      },
    });
    const week = await client.week.create({
      data: {
        seasonId: season.id,
        number: 1,
        name: "정산 통합 주차",
        status: "ACTIVE",
        startAt: season.startAt,
        endAt: season.endAt,
        missionCatalogVersion: "v1",
        rulesSnapshot: { version: "scoring-integration-v1" },
      },
    });
    const user = await client.user.create({
      data: {
        loginId: `score-${suffix}`,
        loginIdNormalized: `score-${suffix}`,
        realName: `정산 ${suffix}`,
        passwordHash: "integration-password-hash",
      },
    });
    const participant = await client.participant.create({
      data: {
        userId: user.id,
        puuid: `SCORING_PUUID_${suffix}`,
        summonerId: `SCORING_SUMMONER_${suffix}`,
        gameName: `Score${suffix}`,
        tagLine: "TEST",
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
    const participantWeek = await client.participantWeek.create({
      data: { weekId: week.id, participantId: participant.id },
    });
    const missionAssignment = input.withMissionAssignment
      ? await (async () => {
          const definition = await client.missionDefinition.findFirstOrThrow({
            where: { active: true },
            orderBy: [{ code: "asc" }, { version: "desc" }],
          });
          return client.weeklyMissionAssignment.create({
            data: {
              participantWeekId: participantWeek.id,
              missionDefinitionId: definition.id,
              selectionKey: `invalidation-guard:${randomUUID()}`,
              selectionSeedHash: "invalidation-guard-seed",
              assignedAt: week.startAt,
              activeFrom: week.startAt,
              target: definition.target,
              seenOrder: 1,
              evaluatorVersion: "invalidation-guard-v1",
            },
          });
        })()
      : null;
    const mock = new MockRiotClient(fixedNow);
    const template = await mock.getMatch(
      input.win === false ? "KR_MOCK_LOSS_001" : "KR_MOCK_WIN_001",
    );
    const match: NormalizedMatch = structuredClone(template);
    match.matchId = `KR_SCORING_${suffix}`;
    const tracked = match.participants[0]!;
    tracked.puuid = participant.puuid;
    const trackedTeam = match.teams.find(
      (team) => team.teamId === tracked.teamId,
    );
    if (trackedTeam) {
      trackedTeam.championKills = Math.max(
        trackedTeam.championKills,
        tracked.kills + tracked.assists,
      );
    }
    const ingested = await ingest.ingestNormalizedMatch({
      season: {
        id: season.id,
        startAt: season.startAt,
        endAt: season.endAt,
        minGameDurationSeconds: season.minGameDurationSeconds,
        weeks: [{ id: week.id, startAt: week.startAt, endAt: week.endAt }],
      },
      match,
      now: fixedNow,
      dryRun: false,
    });
    if (!ingested.seasonMatchId)
      throw new Error("fixture season match missing");
    const participantMatch = await client.participantMatch.findFirstOrThrow({
      where: {
        seasonMatchId: ingested.seasonMatchId,
        participantId: participant.id,
      },
    });
    return {
      season,
      week,
      user,
      participant,
      participantWeek,
      participantMatch,
      missionAssignment,
      seasonMatchId: ingested.seasonMatchId,
      riotMatchId: match.matchId,
      win: tracked.win,
    };
  }

  async function scoreRevealAndEntitle(
    firstByte: number,
    input: { win?: boolean } = {},
  ) {
    const fixture = await setupScorableMatch(input);
    await scoring.scoreSeasonMatch(fixture.seasonMatchId, {
      now: () => fixedNow,
      randomSource: drawRandomSource(firstByte),
    });
    const draw = await client.pointDraw.findUniqueOrThrow({
      where: { participantMatchId: fixture.participantMatch.id },
    });
    await scoring.revealPointDraw({
      drawId: draw.id,
      userId: fixture.user.id,
      now: fixedNow,
    });
    await scoring.grantRerollEntitlement({
      entitlementKey: `integration:reroll:${draw.id}`,
      participantMatchId: fixture.participantMatch.id,
      source: "DEMO_ONLY",
      grantedAt: fixedNow,
      expiresAt: new Date(fixedNow.getTime() + 12 * 60 * 60_000),
      reason: "DEMO_ONLY_MVP_ACE",
      demoOnly: true,
    });
    return { ...fixture, draw };
  }

  it("settles once, keeps sealed DTOs private, and reveals idempotently", async () => {
    const fixture = await setupScorableMatch();
    const first = await scoring.scoreSeasonMatch(fixture.seasonMatchId, {
      now: () => fixedNow,
      randomSource: drawRandomSource(0),
    });
    const second = await scoring.scoreSeasonMatch(fixture.seasonMatchId, {
      now: () => fixedNow,
      randomSource: drawRandomSource(6),
    });
    expect(first.createdDraws).toBe(1);
    expect(second.createdDraws).toBe(0);

    const stored = await client.participantMatch.findUniqueOrThrow({
      where: { id: fixture.participantMatch.id },
      include: { pointDraw: true, scoreLedger: true, participantWeek: true },
    });
    expect(stored.pointDraw).toMatchObject({
      state: DrawState.SEALED,
      firstValue: 17,
      finalSignedValue: fixture.win ? 17 : -17,
      firstCommitmentVersion: "v1",
    });
    expect(stored.scoreLedger).toHaveLength(1);
    expect(stored.scoreLedger[0]).toMatchObject({
      type: ScoreLedgerType.MATCH_INITIAL,
      amount: fixture.win ? 17 : -17,
    });
    expect(stored.participantWeek.mainScoreCached).toBe(fixture.win ? 17 : -17);

    const sealed = await scoringRead.listMyPointDraws(fixture.user.id);
    expect(sealed).toHaveLength(1);
    expect(sealed[0]).toMatchObject({
      displayMagnitude: null,
      signedDelta: null,
    });
    expect(sealed[0]).not.toHaveProperty("nonce");

    const rankBefore = stored.participantWeek.rankCached;
    const revealed = await scoring.revealPointDraw({
      drawId: stored.pointDraw!.id,
      userId: fixture.user.id,
      now: fixedNow,
    });
    const repeated = await scoring.revealPointDraw({
      drawId: stored.pointDraw!.id,
      userId: fixture.user.id,
      now: new Date(fixedNow.getTime() + 5_000),
    });
    expect(repeated).toEqual(revealed);
    expect(revealed.displayMagnitude).toBe(17);

    await client.participantMatch.update({
      where: { id: fixture.participantMatch.id },
      data: { eligible: false },
    });
    await client.week.update({
      where: { id: fixture.week.id },
      data: { status: WeekStatus.FINALIZING },
    });
    await client.season.update({
      where: { id: fixture.season.id },
      data: { status: SeasonStatus.FINALIZING },
    });
    const repeatedAfterClose = await scoring.revealPointDraw({
      drawId: stored.pointDraw!.id,
      userId: fixture.user.id,
      now: new Date(fixedNow.getTime() + 10_000),
    });
    expect(repeatedAfterClose).toEqual(revealed);
    await expect(
      client.auditLog.count({
        where: {
          action: "POINT_DRAW_REVEALED",
          targetId: stored.pointDraw!.id,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      client.processingOutbox.count({
        where: {
          type: "POINT_DRAW_REVEALED",
          aggregateId: stored.pointDraw!.id,
        },
      }),
    ).resolves.toBe(1);
    expect(
      await client.scoreLedger.count({
        where: { participantMatchId: fixture.participantMatch.id },
      }),
    ).toBe(1);
    expect(
      await client.participantWeek.findUniqueOrThrow({
        where: { id: fixture.participantWeek.id },
        select: { rankCached: true },
      }),
    ).toEqual({ rankCached: rankBefore });
  });

  it("rejects a first reveal unless the participant, match, week, and season remain active", async () => {
    const fixture = await setupScorableMatch();
    await scoring.scoreSeasonMatch(fixture.seasonMatchId, {
      now: () => fixedNow,
      randomSource: drawRandomSource(1),
    });
    const draw = await client.pointDraw.findUniqueOrThrow({
      where: { participantMatchId: fixture.participantMatch.id },
      select: { id: true },
    });
    const reveal = () =>
      scoring.revealPointDraw({
        drawId: draw.id,
        userId: fixture.user.id,
        now: fixedNow,
      });

    await client.participantMatch.update({
      where: { id: fixture.participantMatch.id },
      data: { eligible: false },
    });
    await expect(reveal()).rejects.toMatchObject({
      code: "MATCH_NOT_SCORABLE",
    });
    await client.participantMatch.update({
      where: { id: fixture.participantMatch.id },
      data: { eligible: true },
    });

    await client.seasonMatch.update({
      where: { id: fixture.seasonMatchId },
      data: { status: MatchStatus.ERROR },
    });
    await expect(reveal()).rejects.toMatchObject({
      code: "MATCH_NOT_SCORABLE",
    });
    await client.seasonMatch.update({
      where: { id: fixture.seasonMatchId },
      data: { status: MatchStatus.PROCESSED },
    });

    await client.week.update({
      where: { id: fixture.week.id },
      data: { status: WeekStatus.FINALIZING },
    });
    await expect(reveal()).rejects.toMatchObject({
      code: "MATCH_NOT_SCORABLE",
    });
    await client.week.update({
      where: { id: fixture.week.id },
      data: { status: WeekStatus.ACTIVE },
    });

    await client.season.update({
      where: { id: fixture.season.id },
      data: { status: SeasonStatus.FINALIZING },
    });
    await expect(reveal()).rejects.toMatchObject({
      code: "MATCH_NOT_SCORABLE",
    });
    await expect(
      client.pointDraw.findUniqueOrThrow({
        where: { id: draw.id },
        select: { state: true },
      }),
    ).resolves.toEqual({ state: DrawState.SEALED });
    await expect(
      client.auditLog.count({
        where: { action: "POINT_DRAW_REVEALED", targetId: draw.id },
      }),
    ).resolves.toBe(0);
  });

  it("settles a concurrently requested match exactly once", async () => {
    const fixture = await setupScorableMatch();
    const requests = await Promise.allSettled([
      scoring.scoreSeasonMatch(fixture.seasonMatchId, {
        now: () => fixedNow,
        randomSource: drawRandomSource(0),
      }),
      scoring.scoreSeasonMatch(fixture.seasonMatchId, {
        now: () => fixedNow,
        randomSource: drawRandomSource(6),
      }),
    ]);

    expect(requests.every((request) => request.status === "fulfilled")).toBe(
      true,
    );
    await expect(
      client.pointDraw.count({
        where: { participantMatchId: fixture.participantMatch.id },
      }),
    ).resolves.toBe(1);
    await expect(
      client.scoreLedger.count({
        where: {
          participantMatchId: fixture.participantMatch.id,
          type: ScoreLedgerType.MATCH_INITIAL,
        },
      }),
    ).resolves.toBe(1);
    const participantWeek = await client.participantWeek.findUniqueOrThrow({
      where: { id: fixture.participantWeek.id },
      select: { mainScoreCached: true },
    });
    const ledger = await client.scoreLedger.findFirstOrThrow({
      where: {
        participantMatchId: fixture.participantMatch.id,
        type: ScoreLedgerType.MATCH_INITIAL,
      },
      select: { amount: true },
    });
    expect(participantWeek.mainScoreCached).toBe(ledger.amount);
  });

  it("stores FIXED_20 explicitly and exposes accurate proof metadata", async () => {
    const fixture = await setupScorableMatch({
      win: false,
      scoringMode: ScoringMode.FIXED_20,
    });
    const scored = await scoring.scoreSeasonMatch(fixture.seasonMatchId, {
      now: () => fixedNow,
      randomSource: drawRandomSource(6),
    });
    expect(scored.mode).toBe(ScoringMode.FIXED_20);
    const stored = await client.participantMatch.findUniqueOrThrow({
      where: { id: fixture.participantMatch.id },
      select: {
        pointDraw: {
          select: {
            id: true,
            firstValue: true,
            finalSignedValue: true,
            firstRngVersion: true,
          },
        },
        scoreLedger: {
          where: { type: ScoreLedgerType.MATCH_INITIAL },
          select: { metadata: true },
        },
      },
    });
    expect(stored.pointDraw).toEqual(
      expect.objectContaining({
        firstValue: 20,
        finalSignedValue: -20,
        firstRngVersion: DRAW_FIXED_20_VERSION,
      }),
    );
    expect(stored.scoreLedger[0]?.metadata).toEqual(
      expect.objectContaining({
        pointMode: ScoringMode.FIXED_20,
        rngVersion: DRAW_FIXED_20_VERSION,
      }),
    );

    const fixedList = await scoringRead.listMyPointDraws(
      fixture.user.id,
      fixedNow,
    );
    expect(fixedList[0]).toMatchObject({
      pointMode: "FIXED_20",
      rngVersion: DRAW_FIXED_20_VERSION,
    });
    const revealed = await scoring.revealPointDraw({
      drawId: stored.pointDraw!.id,
      userId: fixture.user.id,
      now: fixedNow,
    });
    expect(revealed).toMatchObject({
      pointMode: "FIXED_20",
      rngVersion: DRAW_FIXED_20_VERSION,
      verifier: {
        probability:
          "The fixed value 20 has probability 100% in FIXED_20 mode.",
      },
    });
  });

  it("returns the persisted initial-ledger mode from the P2002 idempotent fallback", async () => {
    const fixture = await setupScorableMatch({
      scoringMode: ScoringMode.FIXED_20,
    });
    await scoring.scoreSeasonMatch(fixture.seasonMatchId, {
      now: () => fixedNow,
      randomSource: drawRandomSource(0),
    });

    const retry = await scoring.scoreSeasonMatch(fixture.seasonMatchId, {
      now: () => new Date(fixedNow.getTime() + 1_000),
      afterLedgerWrite: async () => {
        await client.scoreLedger.create({
          data: {
            participantWeekId: fixture.participantWeek.id,
            participantMatchId: fixture.participantMatch.id,
            type: ScoreLedgerType.MATCH_INITIAL,
            amount: 20,
            idempotencyKey: `score:match-initial:${fixture.participantMatch.id}`,
            metadata: { pointMode: "RANDOM_17_23" },
          },
        });
      },
    });

    expect(retry).toMatchObject({
      seasonMatchId: fixture.seasonMatchId,
      createdDraws: 0,
      mode: ScoringMode.FIXED_20,
    });
  });

  it("activates FIXED_20 immediately through the operational fallback flag", async () => {
    const fixture = await setupScorableMatch({
      scoringMode: ScoringMode.RANDOM_17_23,
    });
    await client.featureFlag.upsert({
      where: { key: "scoring.fixed20Fallback" },
      update: { enabled: true },
      create: {
        key: "scoring.fixed20Fallback",
        enabled: true,
        config: {},
        description: "integration fallback switch",
      },
    });
    try {
      await scoring.scoreSeasonMatch(fixture.seasonMatchId, {
        now: () => fixedNow,
        randomSource: drawRandomSource(6),
      });
      await expect(
        client.pointDraw.findUniqueOrThrow({
          where: { participantMatchId: fixture.participantMatch.id },
          select: { firstValue: true },
        }),
      ).resolves.toEqual({ firstValue: 20 });
    } finally {
      await client.featureFlag.update({
        where: { key: "scoring.fixed20Fallback" },
        data: { enabled: false },
      });
    }
  });

  it.each([
    { label: "better", firstByte: 0, secondByte: 6, adjustment: 6 },
    { label: "worse", firstByte: 6, secondByte: 0, adjustment: -6 },
    { label: "same", firstByte: 3, secondByte: 3, adjustment: 0 },
  ])("persists a $label reroll as one adjustment row", async (caseInput) => {
    const fixture = await scoreRevealAndEntitle(caseInput.firstByte);
    const result = await scoring.rerollPointDraw({
      drawId: fixture.draw.id,
      userId: fixture.user.id,
      confirmed: true,
      now: new Date(fixedNow.getTime() + 60_000),
      randomSource: drawRandomSource(caseInput.secondByte),
    });
    expect(result.state).toBe(DrawState.REROLLED);
    const ledgers = await client.scoreLedger.findMany({
      where: { participantMatchId: fixture.participantMatch.id },
      orderBy: { createdAt: "asc" },
    });
    expect(ledgers).toHaveLength(2);
    expect(ledgers[0]?.type).toBe(ScoreLedgerType.MATCH_INITIAL);
    expect(ledgers[1]).toMatchObject({
      type: ScoreLedgerType.MATCH_REROLL_ADJUSTMENT,
      amount: caseInput.adjustment,
    });
  });

  it("allows only one concurrent reroll consumer", async () => {
    const fixture = await scoreRevealAndEntitle(0);
    const requests = await Promise.allSettled([
      scoring.rerollPointDraw({
        drawId: fixture.draw.id,
        userId: fixture.user.id,
        confirmed: true,
        now: new Date(fixedNow.getTime() + 60_000),
        randomSource: drawRandomSource(6),
      }),
      scoring.rerollPointDraw({
        drawId: fixture.draw.id,
        userId: fixture.user.id,
        confirmed: true,
        now: new Date(fixedNow.getTime() + 60_000),
        randomSource: drawRandomSource(1),
      }),
    ]);
    expect(
      requests.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      requests.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(
      await client.scoreLedger.count({
        where: {
          participantMatchId: fixture.participantMatch.id,
          type: ScoreLedgerType.MATCH_REROLL_ADJUSTMENT,
        },
      }),
    ).toBe(1);
    expect(
      await client.auditLog.count({
        where: { action: "POINT_DRAW_REROLLED", targetId: fixture.draw.id },
      }),
    ).toBe(1);
  });

  it("auto-reveals after the season setting without changing the ledger", async () => {
    const fixture = await setupScorableMatch();
    await scoring.scoreSeasonMatch(fixture.seasonMatchId, {
      now: () => fixedNow,
      randomSource: drawRandomSource(2),
    });
    const result = await scoring.autoRevealPointDraws({
      seasonId: fixture.season.id,
      now: new Date(fixedNow.getTime() + 12 * 60 * 60_000),
    });
    expect(result.revealed).toBe(1);
    await expect(
      client.pointDraw.findUniqueOrThrow({
        where: { participantMatchId: fixture.participantMatch.id },
        select: { state: true, autoRevealed: true },
      }),
    ).resolves.toEqual({ state: DrawState.AUTO_REVEALED, autoRevealed: true });
    expect(
      await client.scoreLedger.count({
        where: { participantMatchId: fixture.participantMatch.id },
      }),
    ).toBe(1);
  });

  it("excludes ineligible, unprocessed, and closed candidates from auto reveal", async () => {
    const fixture = await setupScorableMatch();
    await scoring.scoreSeasonMatch(fixture.seasonMatchId, {
      now: () => fixedNow,
      randomSource: drawRandomSource(2),
    });
    const autoReveal = () =>
      scoring.autoRevealPointDraws({
        seasonId: fixture.season.id,
        now: new Date(fixedNow.getTime() + 12 * 60 * 60_000),
      });

    await client.participantMatch.update({
      where: { id: fixture.participantMatch.id },
      data: { eligible: false },
    });
    await expect(autoReveal()).resolves.toEqual({ examined: 0, revealed: 0 });
    await client.participantMatch.update({
      where: { id: fixture.participantMatch.id },
      data: { eligible: true },
    });

    await client.seasonMatch.update({
      where: { id: fixture.seasonMatchId },
      data: { status: MatchStatus.ERROR },
    });
    await expect(autoReveal()).resolves.toEqual({ examined: 0, revealed: 0 });
    await client.seasonMatch.update({
      where: { id: fixture.seasonMatchId },
      data: { status: MatchStatus.PROCESSED },
    });

    await client.week.update({
      where: { id: fixture.week.id },
      data: { status: WeekStatus.FINALIZING },
    });
    await expect(autoReveal()).resolves.toEqual({ examined: 0, revealed: 0 });
    await client.week.update({
      where: { id: fixture.week.id },
      data: { status: WeekStatus.ACTIVE },
    });

    await client.season.update({
      where: { id: fixture.season.id },
      data: { status: SeasonStatus.FINALIZING },
    });
    await expect(autoReveal()).resolves.toEqual({ examined: 0, revealed: 0 });
    await expect(
      client.pointDraw.findUniqueOrThrow({
        where: { participantMatchId: fixture.participantMatch.id },
        select: { state: true },
      }),
    ).resolves.toEqual({ state: DrawState.SEALED });
  });

  it("reports reroll eligibility false at the exact server-side expiry", async () => {
    const fixture = await scoreRevealAndEntitle(0);
    const expiresAt = new Date(fixedNow.getTime() + 12 * 60 * 60_000);
    const beforeExpiry = await scoringRead.listMyPointDraws(
      fixture.user.id,
      new Date(expiresAt.getTime() - 1),
    );
    const atExpiry = await scoringRead.listMyPointDraws(
      fixture.user.id,
      expiresAt,
    );

    expect(beforeExpiry[0]?.rerollEligible).toBe(true);
    expect(atExpiry[0]?.rerollEligible).toBe(false);
  });

  it("rolls back draw, ledger, and cache together and backfills safely", async () => {
    const fixture = await setupScorableMatch();
    await expect(
      scoring.scoreSeasonMatch(fixture.seasonMatchId, {
        now: () => fixedNow,
        randomSource: drawRandomSource(4),
        afterLedgerWrite: async () => {
          throw new Error("fixture rollback");
        },
      }),
    ).rejects.toThrow("fixture rollback");
    const afterFailure = await client.participantMatch.findUniqueOrThrow({
      where: { id: fixture.participantMatch.id },
      include: { pointDraw: true, scoreLedger: true, participantWeek: true },
    });
    expect(afterFailure.pointDraw).toBeNull();
    expect(afterFailure.scoreLedger).toHaveLength(0);
    expect(afterFailure.participantWeek.mainScoreCached).toBe(0);
    expect(
      await client.seasonMatch.findUniqueOrThrow({
        where: { id: fixture.seasonMatchId },
        select: { status: true },
      }),
    ).toEqual({ status: MatchStatus.PROCESSING });

    const backfill = await scoring.backfillUnscoredMatches({
      seasonId: fixture.season.id,
      limit: 10,
    });
    expect(backfill).toMatchObject({ examined: 1, processed: 1, failed: 0 });
    expect(
      await client.scoreLedger.count({
        where: { participantMatchId: fixture.participantMatch.id },
      }),
    ).toBe(1);
  });

  it("reuses an identical admin adjustment retry and rejects key reuse with another payload", async () => {
    const fixture = await setupScorableMatch();
    const idempotencyKey = `integration-adjustment-retry:${randomUUID()}`;
    const input = {
      participantWeekId: fixture.participantWeek.id,
      amount: 7,
      reason: "integration idempotent adjustment",
      actorUserId: adminId,
      idempotencyKey,
      now: fixedNow,
    };

    const first = await scoring.addAdminScoreAdjustment(input);
    const retry = await scoring.addAdminScoreAdjustment(input);

    expect(retry.id).toBe(first.id);
    await expect(
      client.scoreLedger.count({ where: { idempotencyKey } }),
    ).resolves.toBe(1);
    await expect(
      client.auditLog.count({
        where: {
          action: "SCORE_ADMIN_ADJUSTED",
          targetId: fixture.participantWeek.id,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      client.participantWeek.findUniqueOrThrow({
        where: { id: fixture.participantWeek.id },
        select: { mainScoreCached: true },
      }),
    ).resolves.toEqual({ mainScoreCached: 7 });

    await expect(
      scoring.addAdminScoreAdjustment({ ...input, amount: 8 }),
    ).rejects.toMatchObject({ code: "SCORING_CONFLICT" });
  });

  it("rejects invalidation before scoring and refuses to reinstate a non-admin invalid match", async () => {
    const fixture = await setupScorableMatch();
    await client.participantWeek.update({
      where: { id: fixture.participantWeek.id },
      data: { wins: 3 },
    });

    await expect(
      scoring.invalidateSeasonMatch({
        seasonMatchId: fixture.seasonMatchId,
        actorUserId: adminId,
        reason: "정산 전 무효화 차단 검증",
        confirmation: fixture.riotMatchId,
      }),
    ).rejects.toMatchObject({ code: "MATCH_NOT_SCORABLE" });
    await expect(
      client.participantWeek.findUniqueOrThrow({
        where: { id: fixture.participantWeek.id },
        select: { wins: true },
      }),
    ).resolves.toEqual({ wins: 3 });
    await expect(
      client.scoreLedger.count({
        where: {
          participantMatchId: fixture.participantMatch.id,
          type: ScoreLedgerType.MATCH_INVALIDATION,
        },
      }),
    ).resolves.toBe(0);

    await client.seasonMatch.update({
      where: { id: fixture.seasonMatchId },
      data: {
        status: MatchStatus.INVALID,
        eligibilityReason: "QUEUE_NOT_ALLOWED",
      },
    });
    await expect(
      scoring.reinstateSeasonMatch({
        seasonMatchId: fixture.seasonMatchId,
        actorUserId: adminId,
        reason: "관리자 무효가 아닌 경기 복구 차단",
        confirmation: fixture.riotMatchId,
      }),
    ).rejects.toMatchObject({ code: "SCORING_CONFLICT" });
  });

  it("audits adjustment, repairs drift, and invalidates/reinstates with append-only ledgers", async () => {
    const fixture = await setupScorableMatch();
    await scoring.scoreSeasonMatch(fixture.seasonMatchId, {
      now: () => fixedNow,
      randomSource: drawRandomSource(0),
    });
    const awardedDraw = await client.pointDraw.findUniqueOrThrow({
      where: { participantMatchId: fixture.participantMatch.id },
      select: { id: true },
    });
    await scoring.grantRerollEntitlement({
      entitlementKey: `integration:invalidation-award:${awardedDraw.id}`,
      participantMatchId: fixture.participantMatch.id,
      source: "DEMO_ONLY",
      grantedAt: fixedNow,
      expiresAt: new Date(fixedNow.getTime() + 12 * 60 * 60_000),
      reason: "invalidation award restoration fixture",
      demoOnly: true,
    });
    await client.mvpEvaluation.create({
      data: {
        evaluationKey: `integration:invalidation-award:${randomUUID()}`,
        seasonMatchId: fixture.seasonMatchId,
        matchParticipantRawId: fixture.participantMatch.matchParticipantRawId,
        participantMatchId: fixture.participantMatch.id,
        status: MvpEvaluationStatus.COMPLETED,
        award: MvpAward.MVP,
        evaluatorVersion: "integration-invalidation-v1",
        metrics: { source: "integration-test" },
        tieBreak: { source: "integration-test" },
        createdAt: fixedNow,
      },
    });
    await client.participantWeek.update({
      where: { id: fixture.participantWeek.id },
      data: { mvpCount: { increment: 1 } },
    });
    await scoring.addAdminScoreAdjustment({
      participantWeekId: fixture.participantWeek.id,
      amount: 5,
      reason: "통합 테스트 운영 조정",
      actorUserId: adminId,
      idempotencyKey: `integration-adjustment:${randomUUID()}`,
      now: fixedNow,
    });
    await client.participantWeek.update({
      where: { id: fixture.participantWeek.id },
      data: {
        mainScoreCached: { increment: 9 },
        wins: { increment: 2 },
      },
    });
    await client.participantMatch.update({
      where: { id: fixture.participantMatch.id },
      data: { pointSignedCached: null },
    });
    const report = await reconciliation.inspectScoreReconciliation(
      fixture.week.id,
    );
    const driftedRow = report.find(
      (row) => row.participantWeekId === fixture.participantWeek.id,
    );
    expect(driftedRow).toMatchObject({
      difference: -9,
      winDifference: -2,
      consistent: false,
    });
    expect(driftedRow?.matchIssues.map((issue) => issue.code)).toContain(
      "PARTICIPANT_MATCH_CACHE_MISMATCH",
    );
    const repaired = await reconciliation.reconcileScoreCaches({
      weekId: fixture.week.id,
      repair: true,
      actorUserId: adminId,
      now: fixedNow,
    });
    expect(repaired.repaired).toBeGreaterThanOrEqual(1);
    expect(repaired.unresolved).toEqual([]);
    const [repairedParticipantWeek, repairedParticipantMatch, repairedDraw] =
      await Promise.all([
        client.participantWeek.findUniqueOrThrow({
          where: { id: fixture.participantWeek.id },
          select: { wins: true, losses: true },
        }),
        client.participantMatch.findUniqueOrThrow({
          where: { id: fixture.participantMatch.id },
          select: { pointSignedCached: true },
        }),
        client.pointDraw.findUniqueOrThrow({
          where: { participantMatchId: fixture.participantMatch.id },
          select: { finalSignedValue: true },
        }),
      ]);
    expect(repairedParticipantWeek).toEqual({ wins: 1, losses: 0 });
    expect(repairedParticipantMatch.pointSignedCached).toBe(
      repairedDraw.finalSignedValue,
    );

    const invalidated = await scoring.invalidateSeasonMatch({
      seasonMatchId: fixture.seasonMatchId,
      actorUserId: adminId,
      reason: "통합 테스트 경기 무효화",
      confirmation: fixture.riotMatchId,
      now: new Date(fixedNow.getTime() + 60_000),
    });
    expect(invalidated).toMatchObject({ reversed: 1, alreadyInvalid: false });
    const ledger = await client.scoreLedger.findMany({
      where: { participantWeekId: fixture.participantWeek.id },
      orderBy: { createdAt: "asc" },
    });
    expect(ledger.map((row) => row.type).sort()).toEqual(
      [
        ScoreLedgerType.MATCH_INITIAL,
        ScoreLedgerType.ADMIN_ADJUSTMENT,
        ScoreLedgerType.MATCH_INVALIDATION,
      ].sort(),
    );
    expect(ledger.reduce((sum, row) => sum + row.amount, 0)).toBe(5);
    await expect(
      client.participantWeek.findUniqueOrThrow({
        where: { id: fixture.participantWeek.id },
        select: { mainScoreCached: true, mvpCount: true },
      }),
    ).resolves.toEqual({ mainScoreCached: 5, mvpCount: 0 });
    await expect(
      client.pointDraw.findUniqueOrThrow({
        where: { id: awardedDraw.id },
        select: { rerollEligible: true },
      }),
    ).resolves.toEqual({ rerollEligible: false });
    await expect(
      scoring.grantRerollEntitlement({
        entitlementKey: `integration:invalid-grant:${awardedDraw.id}`,
        participantMatchId: fixture.participantMatch.id,
        source: "DEMO_ONLY",
        grantedAt: fixedNow,
        expiresAt: new Date(fixedNow.getTime() + 12 * 60 * 60_000),
        reason: "invalid match must reject entitlement",
        demoOnly: true,
      }),
    ).rejects.toMatchObject({ code: "REROLL_NOT_ELIGIBLE" });

    const reinstated = await scoring.reinstateSeasonMatch({
      seasonMatchId: fixture.seasonMatchId,
      actorUserId: adminId,
      reason: "통합 테스트 경기 복구",
      confirmation: fixture.riotMatchId,
      now: new Date(fixedNow.getTime() + 120_000),
    });
    expect(reinstated).toMatchObject({ reinstated: 1 });
    const restored = await client.participantMatch.findUniqueOrThrow({
      where: { id: fixture.participantMatch.id },
      include: { participantWeek: true, pointDraw: true, scoreLedger: true },
    });
    expect(restored.eligible).toBe(true);
    expect(restored.participantWeek.mainScoreCached).toBe(22);
    expect(restored.participantWeek.mvpCount).toBe(1);
    expect(restored.scoreLedger.map((row) => row.type)).toContain(
      ScoreLedgerType.MATCH_REINSTATEMENT,
    );
    expect(restored.scoreLedger.reduce((sum, row) => sum + row.amount, 0)).toBe(
      17,
    );
    expect(restored.pointDraw?.state).toBe(DrawState.SEALED);
    expect(restored.pointDraw?.rerollEligible).toBe(true);
    await expect(
      client.seasonMatch.findUniqueOrThrow({
        where: { id: fixture.seasonMatchId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: MatchStatus.PROCESSED });
    await expect(
      client.auditLog.findFirst({
        where: {
          action: "SEASON_MATCH_REINSTATED",
          targetId: fixture.seasonMatchId,
        },
      }),
    ).resolves.not.toBeNull();
    await expect(
      scoring.reinstateSeasonMatch({
        seasonMatchId: fixture.seasonMatchId,
        actorUserId: adminId,
        reason: "반복 복구",
        confirmation: fixture.riotMatchId,
      }),
    ).rejects.toMatchObject({ code: "SCORING_CONFLICT" });

    const secondInvalidation = await scoring.invalidateSeasonMatch({
      seasonMatchId: fixture.seasonMatchId,
      actorUserId: adminId,
      reason: "second invalidation cycle",
      confirmation: fixture.riotMatchId,
      requestId: `second-invalidation:${randomUUID()}`,
      now: new Date(fixedNow.getTime() + 180_000),
    });
    expect(secondInvalidation).toMatchObject({
      reversed: 1,
      alreadyInvalid: false,
    });
    await expect(
      scoring.reinstateSeasonMatch({
        seasonMatchId: fixture.seasonMatchId,
        actorUserId: adminId,
        reason: "second reinstatement cycle",
        confirmation: fixture.riotMatchId,
        now: new Date(fixedNow.getTime() + 240_000),
      }),
    ).resolves.toMatchObject({ reinstated: 1 });
    await expect(
      client.scoreLedger.groupBy({
        by: ["type"],
        where: {
          participantMatchId: fixture.participantMatch.id,
          type: {
            in: [
              ScoreLedgerType.MATCH_INVALIDATION,
              ScoreLedgerType.MATCH_REINSTATEMENT,
            ],
          },
        },
        _count: { _all: true },
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: ScoreLedgerType.MATCH_INVALIDATION,
          _count: { _all: 2 },
        }),
        expect.objectContaining({
          type: ScoreLedgerType.MATCH_REINSTATEMENT,
          _count: { _all: 2 },
        }),
      ]),
    );
    const cycleReconciliation = await reconciliation.inspectScoreReconciliation(
      fixture.week.id,
    );
    expect(
      cycleReconciliation.find(
        (row) => row.participantWeekId === fixture.participantWeek.id,
      ),
    ).toMatchObject({ consistent: true, matchIssues: [] });
    await expect(
      client.participantWeek.findUniqueOrThrow({
        where: { id: fixture.participantWeek.id },
        select: { mainScoreCached: true, mvpCount: true },
      }),
    ).resolves.toEqual({ mainScoreCached: 22, mvpCount: 1 });
  });

  it("keeps missing draw and initial settlement defects unresolved", async () => {
    const fixture = await setupScorableMatch();
    await client.seasonMatch.update({
      where: { id: fixture.seasonMatchId },
      data: { status: MatchStatus.PROCESSED, processedAt: fixedNow },
    });
    await client.participantMatch.update({
      where: { id: fixture.participantMatch.id },
      data: { processedAt: fixedNow },
    });

    const before = await reconciliation.inspectScoreReconciliation(
      fixture.week.id,
    );
    const beforeRow = before.find(
      (row) => row.participantWeekId === fixture.participantWeek.id,
    );
    expect(beforeRow?.matchIssues.map((issue) => issue.code)).toEqual([
      "MISSING_POINT_DRAW",
      "INITIAL_LEDGER_COUNT_MISMATCH",
    ]);

    const recovery = await reconciliation.reconcileScoreCaches({
      weekId: fixture.week.id,
      repair: true,
      actorUserId: adminId,
      now: fixedNow,
    });
    const unresolvedRow = recovery.unresolved.find(
      (row) => row.participantWeekId === fixture.participantWeek.id,
    );
    expect(unresolvedRow?.winDifference).toBe(0);
    expect(unresolvedRow?.matchIssues.map((issue) => issue.code)).toEqual([
      "MISSING_POINT_DRAW",
      "INITIAL_LEDGER_COUNT_MISMATCH",
    ]);
  });

  it("blocks match invalidation after mission progress was recorded", async () => {
    const fixture = await setupScorableMatch({ withMissionAssignment: true });
    await scoring.scoreSeasonMatch(fixture.seasonMatchId, {
      now: () => fixedNow,
      randomSource: drawRandomSource(0),
    });
    const assignment = fixture.missionAssignment;
    if (!assignment) throw new Error("mission assignment fixture missing");
    await client.missionProgressEvent.create({
      data: {
        assignmentId: assignment.id,
        participantMatchId: fixture.participantMatch.id,
        beforeValue: 0,
        deltaValue: 1,
        afterValue: 1,
        evaluatorVersion: assignment.evaluatorVersion,
        facts: { source: "integration-test" },
        idempotencyKey: `invalidation-guard:${randomUUID()}`,
      },
    });

    await expect(
      scoring.invalidateSeasonMatch({
        seasonMatchId: fixture.seasonMatchId,
        actorUserId: adminId,
        reason: "미션 반영 경기 무효화 차단 검증",
        confirmation: fixture.riotMatchId,
      }),
    ).rejects.toMatchObject({ code: "SCORING_CONFLICT" });
    await expect(
      client.seasonMatch.findUniqueOrThrow({
        where: { id: fixture.seasonMatchId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: MatchStatus.PROCESSED });
    await expect(
      client.scoreLedger.count({
        where: {
          participantMatchId: fixture.participantMatch.id,
          type: ScoreLedgerType.MATCH_INVALIDATION,
        },
      }),
    ).resolves.toBe(0);
  });
});
