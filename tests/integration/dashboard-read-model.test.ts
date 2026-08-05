import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DrawState } from "@/generated/prisma/client";
import type * as DashboardReadModule from "@/server/dashboard/read";
import type * as DatabaseModule from "@/server/db/client";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseDescribe = testDatabaseUrl ? describe : describe.skip;
const drawSecret =
  process.env.POINT_DRAW_SECRET ??
  process.env.AUTH_SECRET ??
  "DEMO_ONLY_DRAW_PROTECTION_SECRET_32_BYTES";

databaseDescribe("public dashboard read model", () => {
  let dashboard: typeof DashboardReadModule;
  let database: typeof DatabaseModule;
  let seedWeekId: string;

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    Object.assign(process.env, {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      AUTH_SECRET: "dashboard-integration-auth-secret-32-characters",
      CRON_SECRET: "dashboard-integration-cron-secret-32-characters",
      POINT_DRAW_SECRET: drawSecret,
      MOCK_RIOT_API: "true",
      APP_URL: "http://localhost:3000",
      APP_TIME_ZONE: "Asia/Seoul",
    });
    [dashboard, database] = await Promise.all([
      import("@/server/dashboard/read"),
      import("@/server/db/client"),
    ]);
    seedWeekId = (
      await database.db.week.findFirstOrThrow({
        where: {
          number: 2,
          season: { slug: "development-active-season" },
        },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    await database?.db.$disconnect();
  });

  it("reads authoritative ledger scores with joint ranking", async () => {
    const result = await dashboard.queryLeaderboard(seedWeekId);
    expect(result.state).toBe("ready");
    if (result.state !== "ready") return;

    const seedParticipantIds = new Set(
      (
        await database.db.participant.findMany({
          where: { puuid: { startsWith: "DEMO_ONLY_PUUID_" } },
          select: { id: true },
        })
      ).map((row) => row.id),
    );
    const seedStandings = result.data.standings.filter((row) =>
      seedParticipantIds.has(row.id),
    );
    expect(seedStandings).toHaveLength(20);
    expect(seedStandings.slice(0, 3).map((row) => row.rank)).toEqual([1, 1, 3]);
    for (const row of result.data.standings) {
      const sum = await database.db.scoreLedger.aggregate({
        where: { participantWeekId: row.participantWeekId },
        _sum: { amount: true },
      });
      expect(row.score).toBe(sum._sum.amount ?? 0);
    }
  });

  it("returns only normalized matches and never exposes protected storage fields", async () => {
    const result = await dashboard.queryRecentMatches({
      weekId: seedWeekId,
      pageSize: 20,
    });
    expect(result.state).toBe("ready");
    if (result.state !== "ready") return;

    expect(result.data.total).toBe(3);
    expect(result.data.rows.some((row) => row.point === null)).toBe(true);
    const serialized = JSON.stringify(result.data.rows);
    expect(serialized).not.toContain("rawSummary");
    expect(serialized).not.toContain("rawTimeline");
    expect(serialized).not.toContain("EncryptedOrProtected");
    expect(serialized).not.toContain("firstValue");
    expect(serialized).not.toContain("finalSignedValue");
    expect(serialized).not.toContain("metrics");
    expect(serialized).not.toContain("facts");
    expect(serialized).not.toContain("puuid");
    for (const row of result.data.rows.filter(
      (match) => match.details.point.state === "SEALED",
    )) {
      expect(row.details.point.nonce).toBeNull();
      expect(row.details.point.magnitude).toBeNull();
      expect(row.details.point.signedPoint).toBeNull();
      expect(row.details.point.verification).toBe("PENDING");
    }
  });

  it("verifies public proofs, filters signed points, and rejects evidence tampering", async () => {
    const draw = await database.db.pointDraw.findFirstOrThrow({
      where: {
        state: DrawState.REVEALED,
        participantMatch: {
          participantWeek: { weekId: seedWeekId },
          eligible: true,
        },
      },
      select: {
        id: true,
        participantMatchId: true,
        state: true,
        resultSign: true,
        firstValue: true,
        firstNonceEncryptedOrProtected: true,
        firstCommitment: true,
        firstCommitmentVersion: true,
        firstRngVersion: true,
        revealedAt: true,
        finalValue: true,
        finalSignedValue: true,
        participantMatch: {
          select: { participantId: true, win: true, position: true },
        },
      },
    });
    expect(draw.finalSignedValue).not.toBeNull();
    if (draw.finalSignedValue === null) return;

    const verified = await dashboard.queryRecentMatches({
      weekId: seedWeekId,
      participantId: draw.participantMatch.participantId,
      ...(draw.participantMatch.position
        ? { position: draw.participantMatch.position }
        : {}),
      pointMin: draw.finalSignedValue,
      pointMax: draw.finalSignedValue,
    });
    expect(verified.state).toBe("ready");
    if (verified.state !== "ready") return;
    expect(verified.data.total).toBe(1);
    expect(verified.data.rows[0]?.details.point).toMatchObject({
      verification: "VERIFIED",
      drawId: draw.id,
      phase: "FIRST",
      magnitude: draw.firstValue,
      nonce: expect.any(String),
      commitment: draw.firstCommitment,
      signedPoint: draw.finalSignedValue,
    });

    await expect(
      database.db.pointDraw.update({
        where: { id: draw.id },
        data: { firstCommitment: "0".repeat(64) },
      }),
    ).rejects.toThrow("PointDraw initial sealed evidence is immutable");

    const unchanged = await dashboard.queryRecentMatches({
      weekId: seedWeekId,
      participantId: draw.participantMatch.participantId,
    });
    expect(unchanged.state).toBe("ready");
    if (unchanged.state !== "ready") return;
    expect(unchanged.data.rows[0]?.details.point).toMatchObject({
      verification: "VERIFIED",
      drawId: draw.id,
      commitment: draw.firstCommitment,
      signedPoint: draw.finalSignedValue,
    });
  });

  it("uses stored daily/start snapshots and immutable archive JSON", async () => {
    const leaderboard = await dashboard.queryLeaderboard(seedWeekId);
    expect(leaderboard.state).toBe("ready");
    if (leaderboard.state !== "ready") return;
    const participant = leaderboard.data.standings[0];
    expect(participant).toBeDefined();
    if (!participant) return;

    const [profile, history] = await Promise.all([
      dashboard.queryParticipantProfile(participant.id, seedWeekId),
      dashboard.queryHistory(),
    ]);
    expect(profile.state).toBe("ready");
    if (profile.state === "ready") {
      expect(profile.data.scoreSeries).toHaveLength(3);
      expect(profile.data.startRank).not.toBeNull();
      expect(
        profile.data.ledger.reduce((sum, row) => sum + row.amount, 0),
      ).toBe(profile.data.standing.score);
    }
    expect(history.state).toBe("ready");
    if (history.state === "ready") {
      expect(history.data.some((entry) => entry.standings.length > 0)).toBe(
        true,
      );
    }
  });
});
