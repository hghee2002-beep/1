import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import type * as OperationsRouteModule from "@/app/api/admin/operations/route";
import type * as AdminServiceModule from "@/server/admin/service";
import type * as SessionStoreModule from "@/server/auth/session-store";
import type * as DatabaseModule from "@/server/db/client";
import type * as MvpBaselineServiceModule from "@/server/mvp/baseline-service";
import type * as ScoringReconciliationModule from "@/server/scoring/reconciliation";
import type * as ScoringServiceModule from "@/server/scoring/service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseDescribe = testDatabaseUrl ? describe : describe.skip;

databaseDescribe("admin console authorization and immutable operations", () => {
  let adminService: typeof AdminServiceModule;
  let database: typeof DatabaseModule;
  let operationsRoute: typeof OperationsRouteModule;
  let sessionStore: typeof SessionStoreModule;
  let mvpBaselineService: typeof MvpBaselineServiceModule;
  let scoringReconciliation: typeof ScoringReconciliationModule;
  let scoringService: typeof ScoringServiceModule;
  let client: PrismaClient;
  let admin: {
    id: string;
    role: "ADMIN";
    sessionVersion: number;
  };

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    Object.assign(process.env, {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      AUTH_SECRET: "admin-console-integration-auth-secret-32-chars",
      CRON_SECRET: "admin-console-integration-cron-secret-32-chars",
      POINT_DRAW_SECRET: "admin-console-draw-secret-with-32-characters",
      MOCK_RIOT_API: "true",
      POINT_MODE: "FIXED_20",
      APP_URL: "http://localhost:3000",
      APP_TIME_ZONE: "Asia/Seoul",
    });
    [
      adminService,
      database,
      operationsRoute,
      sessionStore,
      mvpBaselineService,
      scoringReconciliation,
      scoringService,
    ] = await Promise.all([
      import("@/server/admin/service"),
      import("@/server/db/client"),
      import("@/app/api/admin/operations/route"),
      import("@/server/auth/session-store"),
      import("@/server/mvp/baseline-service"),
      import("@/server/scoring/reconciliation"),
      import("@/server/scoring/service"),
    ]);
    client = database.db;
    const storedAdmin = await client.user.findUniqueOrThrow({
      where: { loginIdNormalized: "admin" },
      select: { id: true, role: true, sessionVersion: true },
    });
    if (storedAdmin.role !== "ADMIN") throw new Error("admin seed is required");
    admin = {
      id: storedAdmin.id,
      role: "ADMIN",
      sessionVersion: storedAdmin.sessionVersion,
    };
  });

  afterAll(async () => {
    await database?.db.$disconnect();
  });

  it("blocks a USER session before dispatching an admin operation", async () => {
    const suffix = randomUUID().slice(0, 8);
    const user = await client.user.create({
      data: {
        loginId: `admin-block-${suffix}`,
        loginIdNormalized: `admin-block-${suffix}`,
        realName: "관리자 차단 테스트",
        passwordHash: "integration-test-password-hash",
      },
      select: { id: true, role: true, sessionVersion: true },
    });
    const session = await sessionStore.createAuthSession(user, 3_600);
    const idempotencyKey = randomUUID();
    const request = new NextRequest(
      "http://localhost:3000/api/admin/operations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: `deluxe_session=${session.token}`,
        },
        body: JSON.stringify({
          action: "ANNOUNCEMENT_CREATE",
          title: "권한 없는 공지",
          body: "서버에서 차단되어야 하는 공지입니다.",
          pinned: false,
          publish: false,
          reason: "권한 차단 검증",
          idempotencyKey,
        }),
      },
    );

    const response = await operationsRoute.POST(request);
    expect(response.status).toBe(403);
    expect(
      await client.auditLog.count({
        where: { requestId: idempotencyKey },
      }),
    ).toBe(0);
  });

  it("returns field validation errors to an authenticated admin", async () => {
    const session = await sessionStore.createAuthSession(admin, 3_600);
    const response = await operationsRoute.POST(
      new NextRequest("http://localhost:3000/api/admin/operations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
          Cookie: `deluxe_session=${session.token}`,
        },
        body: JSON.stringify({
          action: "FEATURE_FLAG_UPDATE",
          key: "debug-mode",
          enabled: true,
          reason: "no",
          confirmation: "",
          idempotencyKey: "duplicate-click",
        }),
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { fields?: Record<string, string[]> };
    };
    expect(body.error.fields).toMatchObject({
      reason: expect.any(Array),
      confirmation: expect.any(Array),
      idempotencyKey: expect.any(Array),
    });
  });

  it("records one audit row and reuses the result for an idempotent request", async () => {
    const idempotencyKey = randomUUID();
    const operation = {
      action: "ANNOUNCEMENT_CREATE" as const,
      title: `멱등 공지 ${idempotencyKey.slice(0, 8)}`,
      body: "동일 요청은 공지를 두 번 만들지 않아야 합니다.",
      pinned: false,
      publish: false,
      reason: "관리자 멱등성 통합 검증",
      idempotencyKey,
    };
    const first = await adminService.executeAdminOperation({
      operation,
      actorUserId: admin.id,
      ipHash: "integration-ip-hash",
    });
    const second = await adminService.executeAdminOperation({
      operation,
      actorUserId: admin.id,
      ipHash: "integration-ip-hash",
    });

    expect(first).toMatchObject({ duplicate: false });
    expect(second).toMatchObject({ duplicate: true, id: first.id });
    await expect(
      client.auditLog.findMany({
        where: { action: "ANNOUNCEMENT_CREATED", requestId: idempotencyKey },
        select: { targetId: true, reason: true, ipHash: true },
      }),
    ).resolves.toEqual([
      {
        targetId: first.id,
        reason: operation.reason,
        ipHash: "integration-ip-hash",
      },
    ]);
  });

  it("starts only a ready season and finalizes immutable standings snapshots", async () => {
    const suffix = randomUUID().slice(0, 8);
    const previousActive = await client.season.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    let baselineId: string | undefined;
    try {
      await client.season.updateMany({
        where: { id: { in: previousActive.map((season) => season.id) } },
        data: { status: "COMPLETED" },
      });
      const sourceBaseline = await client.mvpBaselineVersion.findFirstOrThrow({
        where: { status: "PUBLISHED" },
        include: { metrics: true },
      });
      const baselineContent = {
        metadata: {
          name: `INTEGRATION-NON-DEMO-${suffix}`,
          sourceDescription: "Admin lifecycle integration fixture",
          patchFrom: sourceBaseline.patchFrom,
          patchTo: sourceBaseline.patchTo,
          collectedAt: new Date().toISOString(),
          sampleNotes: "Copied metric coverage for an integration fixture",
          demoOnly: false,
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
      const validation = mvpBaselineService.validateMvpBaseline({
        format: "JSON",
        content: baselineContent,
      });
      expect(validation.report).toMatchObject({ valid: true, rowCount: 320 });
      if (!validation.checksum) throw new Error("baseline checksum missing");
      const baseline = await mvpBaselineService.publishMvpBaseline({
        format: "JSON",
        content: baselineContent,
        expectedChecksum: validation.checksum,
        confirmationName: baselineContent.metadata.name,
        actorUserId: admin.id,
        requestId: randomUUID(),
      });
      baselineId = baseline.id;
      expect(baseline).toMatchObject({
        status: "PUBLISHED",
        demoOnly: false,
        _count: { metrics: 320 },
      });
      await expect(
        client.auditLog.findFirst({
          where: { action: "MVP_BASELINE_PUBLISHED", targetId: baseline.id },
        }),
      ).resolves.not.toBeNull();

      const now = Date.now();
      const startAt = new Date(now - 60 * 60_000);
      const endAt = new Date(now + 60 * 60_000);
      const created = await adminService.executeAdminOperation({
        operation: {
          action: "SEASON_CREATE_DRAFT",
          name: `관리자 생명주기 ${suffix}`,
          slug: `admin-lifecycle-${suffix}`,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          weekCount: 1,
          scoringMode: "FIXED_20",
          minGameDurationSeconds: 600,
          autoRevealHours: 12,
          rulesVersion: "integration-v1",
          reason: "시즌 생명주기 통합 검증",
          idempotencyKey: randomUUID(),
        },
        actorUserId: admin.id,
      });
      const participants = await client.participant.findMany({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { id: true },
      });
      expect(participants).toHaveLength(20);
      const snapshots = await Promise.all(
        participants.map((participant, index) =>
          client.rankSnapshot.create({
            data: {
              participantId: participant.id,
              seasonId: created.id,
              capturedAt: startAt,
              queueType: "RANKED_SOLO_5x5",
              isUnranked: true,
              displayOrdinal: index,
              source: "ADMIN_IMPORT",
              status: "UNRANKED",
            },
            select: { id: true, participantId: true },
          }),
        ),
      );
      await client.seasonParticipant.createMany({
        data: snapshots.map((snapshot) => ({
          seasonId: created.id,
          participantId: snapshot.participantId,
          joinedAt: startAt,
          startingRankSnapshotId: snapshot.id,
        })),
      });

      const started = await adminService.executeAdminOperation({
        operation: {
          action: "SEASON_START",
          targetId: created.id,
          dryRun: false,
          reason: "준비 완료 시즌 시작 통합 검증",
          confirmation: `admin-lifecycle-${suffix}`,
          idempotencyKey: randomUUID(),
        },
        actorUserId: admin.id,
      });
      expect(started).toMatchObject({ status: "ACTIVE" });
      const readiness = await adminService.getSeasonReadinessChecklist(
        created.id,
      );
      expect(
        readiness.checklist.every((item) => item.status !== "BLOCKER"),
      ).toBe(true);

      const pastEnd = new Date(now - 30 * 60_000);
      await client.season.update({
        where: { id: created.id },
        data: { endAt: pastEnd },
      });
      await client.week.updateMany({
        where: { seasonId: created.id },
        data: { endAt: pastEnd },
      });
      const driftedParticipantWeek =
        await client.participantWeek.findFirstOrThrow({
          where: { week: { seasonId: created.id } },
          select: { id: true, missionScoreCached: true },
        });
      await client.participantWeek.update({
        where: { id: driftedParticipantWeek.id },
        data: {
          missionScoreCached: driftedParticipantWeek.missionScoreCached + 1,
        },
      });
      await expect(
        adminService.executeAdminOperation({
          operation: {
            action: "SEASON_FINALIZE",
            targetId: created.id,
            dryRun: false,
            reason: "미션 원장 불일치 확정 차단 통합 검증",
            confirmation: `admin-lifecycle-${suffix}`,
            idempotencyKey: randomUUID(),
          },
          actorUserId: admin.id,
        }),
      ).rejects.toMatchObject({ code: "READINESS_BLOCKED" });
      await client.participantWeek.update({
        where: { id: driftedParticipantWeek.id },
        data: { missionScoreCached: driftedParticipantWeek.missionScoreCached },
      });

      const leaseNow = new Date();
      await client.jobLease.create({
        data: {
          key: `match-sync:${created.id}`,
          ownerToken: randomUUID(),
          acquiredAt: leaseNow,
          heartbeatAt: leaseNow,
          expiresAt: new Date(leaseNow.getTime() + 60 * 60_000),
        },
      });
      await expect(
        adminService.executeAdminOperation({
          operation: {
            action: "SEASON_FINALIZE",
            targetId: created.id,
            dryRun: false,
            reason: "활성 동기화 lease 확정 차단 통합 검증",
            confirmation: `admin-lifecycle-${suffix}`,
            idempotencyKey: randomUUID(),
          },
          actorUserId: admin.id,
        }),
      ).rejects.toMatchObject({ code: "READINESS_BLOCKED" });
      await client.jobLease.delete({
        where: { key: `match-sync:${created.id}` },
      });

      const runningSync = await client.syncRun.create({
        data: {
          invocationKey: `admin-finalize-running:${randomUUID()}`,
          trigger: "MANUAL",
          startedAt: new Date(),
          metadata: { seasonId: created.id },
        },
      });
      await expect(
        adminService.executeAdminOperation({
          operation: {
            action: "SEASON_FINALIZE",
            targetId: created.id,
            dryRun: false,
            reason: "실행 중 동기화 확정 차단 통합 검증",
            confirmation: `admin-lifecycle-${suffix}`,
            idempotencyKey: randomUUID(),
          },
          actorUserId: admin.id,
        }),
      ).rejects.toMatchObject({ code: "READINESS_BLOCKED" });
      await client.syncRun.update({
        where: { id: runningSync.id },
        data: { status: "SUCCEEDED", finishedAt: new Date() },
      });

      const drawParticipantWeek = await client.participantWeek.findFirstOrThrow(
        {
          where: { week: { seasonId: created.id } },
          include: { participant: true },
        },
      );
      const rawParticipant = await client.matchParticipantRaw.findFirstOrThrow({
        where: { puuid: drawParticipantWeek.participant.puuid },
      });
      const seasonMatch = await client.seasonMatch.create({
        data: {
          seasonId: created.id,
          weekId: drawParticipantWeek.weekId,
          matchId: rawParticipant.matchId,
          status: "PROCESSED",
          processedAt: new Date(),
        },
      });
      const signedValue = rawParticipant.win ? 20 : -20;
      const participantMatch = await client.participantMatch.create({
        data: {
          participantId: drawParticipantWeek.participantId,
          participantWeekId: drawParticipantWeek.id,
          seasonMatchId: seasonMatch.id,
          matchParticipantRawId: rawParticipant.id,
          eligible: true,
          win: rawParticipant.win,
          position: rawParticipant.position,
          championId: rawParticipant.championId,
          championName: rawParticipant.championName,
          kills: rawParticipant.kills,
          deaths: rawParticipant.deaths,
          assists: rawParticipant.assists,
          cs:
            rawParticipant.totalMinionsKilled +
            rawParticipant.neutralMinionsKilled,
          kda:
            (rawParticipant.kills + rawParticipant.assists) /
            Math.max(1, rawParticipant.deaths),
          pointSignedCached: signedValue,
          processedAt: new Date(),
        },
      });
      const sealedDraw = await client.pointDraw.create({
        data: {
          participantMatchId: participantMatch.id,
          state: "SEALED",
          resultSign: rawParticipant.win ? 1 : -1,
          firstValue: 20,
          firstNonceEncryptedOrProtected: "integration-protected-nonce",
          firstCommitment: "a".repeat(64),
          firstRngVersion: "fixed-20-v1",
          firstGeneratedAt: new Date(Date.now() - 13 * 60 * 60_000),
          finalValue: 20,
          finalSignedValue: signedValue,
        },
      });
      await client.scoreLedger.create({
        data: {
          participantWeekId: drawParticipantWeek.id,
          participantMatchId: participantMatch.id,
          type: "MATCH_INITIAL",
          amount: signedValue,
          idempotencyKey: `admin-finalize-initial:${participantMatch.id}`,
          metadata: { drawId: sealedDraw.id, pointMode: "FIXED_20" },
        },
      });
      await client.participantWeek.update({
        where: { id: drawParticipantWeek.id },
        data: {
          mainScoreCached: { increment: signedValue },
          ...(rawParticipant.win
            ? { wins: { increment: 1 } }
            : { losses: { increment: 1 } }),
          lastProcessedMatchAt: new Date(),
        },
      });
      await expect(
        adminService.executeAdminOperation({
          operation: {
            action: "SEASON_FINALIZE",
            targetId: created.id,
            dryRun: false,
            reason: "봉인 추첨 확정 차단 통합 검증",
            confirmation: `admin-lifecycle-${suffix}`,
            idempotencyKey: randomUUID(),
          },
          actorUserId: admin.id,
        }),
      ).rejects.toMatchObject({ code: "READINESS_BLOCKED" });
      await expect(
        scoringService.autoRevealPointDraws({
          seasonId: created.id,
          now: new Date(),
        }),
      ).resolves.toMatchObject({ revealed: 1 });

      await client.participantMatch.update({
        where: { id: participantMatch.id },
        data: { pointSignedCached: null },
      });
      await client.participantWeek.update({
        where: { id: drawParticipantWeek.id },
        data: rawParticipant.win
          ? { wins: { increment: 1 } }
          : { losses: { increment: 1 } },
      });
      await expect(
        adminService.executeAdminOperation({
          operation: {
            action: "SEASON_FINALIZE",
            targetId: created.id,
            dryRun: false,
            reason: "score projection mismatch blocks finalization",
            confirmation: `admin-lifecycle-${suffix}`,
            idempotencyKey: randomUUID(),
          },
          actorUserId: admin.id,
        }),
      ).rejects.toMatchObject({ code: "READINESS_BLOCKED" });
      await expect(
        scoringReconciliation.reconcileScoreCaches({
          weekId: drawParticipantWeek.weekId,
          repair: true,
          actorUserId: admin.id,
          reason: "recover score projection before finalization",
        }),
      ).resolves.toMatchObject({ repaired: 1, unresolved: [] });

      const finalized = await adminService.executeAdminOperation({
        operation: {
          action: "SEASON_FINALIZE",
          targetId: created.id,
          dryRun: false,
          reason: "종료 시즌 snapshot 확정 통합 검증",
          confirmation: `admin-lifecycle-${suffix}`,
          idempotencyKey: randomUUID(),
        },
        actorUserId: admin.id,
      });
      expect(finalized).toMatchObject({
        status: "COMPLETED",
        weekSnapshots: 1,
      });
      await expect(
        client.finalStandingSnapshot.findUnique({
          where: { seasonId: created.id },
          select: { checksum: true },
        }),
      ).resolves.toMatchObject({ checksum: expect.any(String) });
      await expect(
        client.weekSnapshot.count({
          where: { week: { seasonId: created.id } },
        }),
      ).resolves.toBe(1);
      await expect(
        client.scoreLedger.create({
          data: {
            participantWeekId: driftedParticipantWeek.id,
            type: "ADMIN_ADJUSTMENT",
            amount: 1,
            idempotencyKey: `post-finalize:${randomUUID()}`,
            reason: "finalized write fence integration probe",
          },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      await expect(
        client.participantWeek.update({
          where: { id: driftedParticipantWeek.id },
          data: { missionScoreCached: { increment: 1 } },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
      await expect(
        client.pointDraw.update({
          where: { id: sealedDraw.id },
          data: { autoRevealed: false },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
    } finally {
      if (baselineId) {
        await client.mvpBaselineVersion.update({
          where: { id: baselineId },
          data: { status: "RETIRED", retiredAt: new Date() },
        });
      }
      await client.season.updateMany({
        where: { id: { in: previousActive.map((season) => season.id) } },
        data: { status: "ACTIVE" },
      });
    }
  });

  it("clones a mission into a new inactive version without mutating the source", async () => {
    const source = await client.missionDefinition.findFirstOrThrow({
      where: { code: "M001" },
      orderBy: { version: "desc" },
    });
    const result = await adminService.executeAdminOperation({
      operation: {
        action: "MISSION_CLONE",
        targetId: source.id,
        reason: "미션 불변 버전 통합 검증",
        idempotencyKey: randomUUID(),
      },
      actorUserId: admin.id,
    });

    const [storedSource, clone] = await Promise.all([
      client.missionDefinition.findUniqueOrThrow({ where: { id: source.id } }),
      client.missionDefinition.findUniqueOrThrow({ where: { id: result.id } }),
    ]);
    expect(storedSource).toEqual(source);
    expect(clone).toMatchObject({
      code: source.code,
      version: source.version + 1,
      active: false,
      evaluatorKey: source.evaluatorKey,
    });
    await expect(
      client.auditLog.findFirst({
        where: { action: "MISSION_DEFINITION_CLONED", targetId: clone.id },
      }),
    ).resolves.toMatchObject({ actorUserId: admin.id });
  });

  it("corrects mission completion by append-only reversal and re-completion rows", async () => {
    const snapshotEntry =
      await client.missionMatchSnapshotAssignment.findFirstOrThrow({
        where: {
          assignment: {
            state: "ACTIVE",
            completionLedger: null,
            participantWeek: {
              week: { status: "ACTIVE", season: { status: "ACTIVE" } },
            },
          },
        },
        include: {
          assignment: {
            include: {
              missionDefinition: true,
              participantWeek: { select: { weekId: true } },
            },
          },
          snapshot: { include: { participantMatch: true } },
        },
      });
    const participantMatch = snapshotEntry.snapshot.participantMatch;
    const definition = snapshotEntry.assignment.missionDefinition;
    const assignment = snapshotEntry.assignment;
    const participantWeek = await client.participantWeek.findUniqueOrThrow({
      where: { id: participantMatch.participantWeekId },
      select: { missionScoreCached: true },
    });
    const sourceEvent = await client.missionProgressEvent.create({
      data: {
        assignmentId: assignment.id,
        participantMatchId: participantMatch.id,
        beforeValue: 0,
        deltaValue: 0,
        afterValue: 0,
        completed: false,
        evaluatorVersion: snapshotEntry.evaluatorVersion,
        facts: { fixture: true },
        idempotencyKey: `admin-correction-source:${randomUUID()}`,
      },
    });

    for (const [index, progress] of [
      Number(definition.target),
      0,
      Number(definition.target),
      0,
    ].entries()) {
      await adminService.executeAdminOperation({
        operation: {
          action: "MISSION_PROGRESS_CORRECT",
          targetId: sourceEvent.id,
          correctedProgress: progress,
          reason: `미션 완료 정정 통합 검증 ${index + 1}`,
          confirmation: definition.code,
          idempotencyKey: randomUUID(),
        },
        actorUserId: admin.id,
      });
    }

    const [
      storedAssignment,
      ledgerRows,
      storedParticipantWeek,
      correctionEvents,
    ] = await Promise.all([
      client.weeklyMissionAssignment.findUniqueOrThrow({
        where: { id: assignment.id },
        select: { state: true, progress: true },
      }),
      client.missionCompletionLedger.findMany({
        where: {
          OR: [
            { assignmentId: assignment.id },
            { metadata: { path: ["assignmentId"], equals: assignment.id } },
          ],
        },
        orderBy: { createdAt: "asc" },
        select: { type: true, points: true, assignmentId: true },
      }),
      client.participantWeek.findUniqueOrThrow({
        where: { id: participantMatch.participantWeekId },
        select: { missionScoreCached: true },
      }),
      client.missionProgressEvent.count({
        where: { supersedesEventId: sourceEvent.id, type: "CORRECTION" },
      }),
    ]);
    expect(storedAssignment.state).toBe("ACTIVE");
    expect(Number(storedAssignment.progress)).toBe(0);
    expect(ledgerRows).toHaveLength(4);
    expect(ledgerRows.map((row) => row.type)).toEqual([
      "COMPLETION",
      "CORRECTION",
      "CORRECTION",
      "CORRECTION",
    ]);
    expect(ledgerRows.map((row) => row.points)).toEqual([
      definition.points,
      -definition.points,
      definition.points,
      -definition.points,
    ]);
    expect(ledgerRows.filter((row) => row.assignmentId !== null)).toHaveLength(
      1,
    );
    expect(storedParticipantWeek.missionScoreCached).toBe(
      participantWeek.missionScoreCached,
    );
    expect(correctionEvents).toBe(4);

    await client.week.update({
      where: { id: assignment.participantWeek.weekId },
      data: { status: "COMPLETED" },
    });
    try {
      await expect(
        adminService.executeAdminOperation({
          operation: {
            action: "MISSION_PROGRESS_CORRECT",
            targetId: sourceEvent.id,
            correctedProgress: Number(definition.target),
            reason: "확정 이후 미션 교정 차단 검증",
            confirmation: definition.code,
            idempotencyKey: randomUUID(),
          },
          actorUserId: admin.id,
        }),
      ).rejects.toMatchObject({ code: "IMMUTABLE" });
    } finally {
      await client.week.update({
        where: { id: assignment.participantWeek.weekId },
        data: { status: "ACTIVE" },
      });
    }
  });
});
