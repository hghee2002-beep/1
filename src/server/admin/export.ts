import "server-only";

import { createHash } from "node:crypto";

import type { ExportJobType } from "@/generated/prisma/client";
import { encodeCsv } from "@/features/admin/export";
import { db } from "@/server/db/client";

type ExportFormat = "CSV" | "JSON";

type ExportTable = {
  headers: string[];
  rows: Array<Array<string | number | boolean | Date | null>>;
};

async function participantsExport(): Promise<ExportTable> {
  const rows = await db.participant.findMany({
    orderBy: { approvedAt: "asc" },
    select: {
      id: true,
      gameName: true,
      tagLine: true,
      status: true,
      primaryPosition: true,
      secondaryPosition: true,
      approvedAt: true,
      user: {
        select: { loginId: true, realName: true, realNamePublic: true },
      },
    },
  });
  return {
    headers: [
      "participantId",
      "loginId",
      "realName",
      "realNamePublic",
      "riotId",
      "status",
      "primaryPosition",
      "secondaryPosition",
      "approvedAt",
    ],
    rows: rows.map((row) => [
      row.id,
      row.user.loginId,
      row.user.realName,
      row.user.realNamePublic,
      `${row.gameName}#${row.tagLine}`,
      row.status,
      row.primaryPosition,
      row.secondaryPosition,
      row.approvedAt,
    ]),
  };
}

async function matchesExport(weekId?: string): Promise<ExportTable> {
  const rows = await db.seasonMatch.findMany({
    ...(weekId ? { where: { weekId } } : {}),
    orderBy: { match: { gameStartAt: "asc" } },
    select: {
      id: true,
      seasonId: true,
      weekId: true,
      status: true,
      eligibilityReason: true,
      processedAt: true,
      match: {
        select: {
          riotMatchId: true,
          queueId: true,
          gameStartAt: true,
          gameEndAt: true,
          durationSeconds: true,
          gameVersion: true,
        },
      },
    },
  });
  return {
    headers: [
      "seasonMatchId",
      "seasonId",
      "weekId",
      "riotMatchId",
      "status",
      "eligibilityReason",
      "queueId",
      "gameStartAt",
      "gameEndAt",
      "durationSeconds",
      "gameVersion",
      "processedAt",
    ],
    rows: rows.map((row) => [
      row.id,
      row.seasonId,
      row.weekId,
      row.match.riotMatchId,
      row.status,
      row.eligibilityReason,
      row.match.queueId,
      row.match.gameStartAt,
      row.match.gameEndAt,
      row.match.durationSeconds,
      row.match.gameVersion,
      row.processedAt,
    ]),
  };
}

async function scoreLedgerExport(weekId?: string): Promise<ExportTable> {
  const rows = await db.scoreLedger.findMany({
    ...(weekId ? { where: { participantWeek: { weekId } } } : {}),
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      participantWeekId: true,
      participantMatchId: true,
      type: true,
      amount: true,
      idempotencyKey: true,
      reason: true,
      actorUserId: true,
      createdAt: true,
    },
  });
  return {
    headers: [
      "ledgerId",
      "participantWeekId",
      "participantMatchId",
      "type",
      "amount",
      "idempotencyKey",
      "reason",
      "actorUserId",
      "createdAt",
    ],
    rows: rows.map((row) => [
      row.id,
      row.participantWeekId,
      row.participantMatchId,
      row.type,
      row.amount,
      row.idempotencyKey,
      row.reason,
      row.actorUserId,
      row.createdAt,
    ]),
  };
}

async function missionLedgerExport(weekId?: string): Promise<ExportTable> {
  const rows = await db.missionCompletionLedger.findMany({
    ...(weekId ? { where: { participantWeek: { weekId } } } : {}),
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      participantWeekId: true,
      assignmentId: true,
      type: true,
      points: true,
      idempotencyKey: true,
      reason: true,
      actorUserId: true,
      createdAt: true,
    },
  });
  return {
    headers: [
      "ledgerId",
      "participantWeekId",
      "assignmentId",
      "type",
      "points",
      "idempotencyKey",
      "reason",
      "actorUserId",
      "createdAt",
    ],
    rows: rows.map((row) => [
      row.id,
      row.participantWeekId,
      row.assignmentId,
      row.type,
      row.points,
      row.idempotencyKey,
      row.reason,
      row.actorUserId,
      row.createdAt,
    ]),
  };
}

async function standingsExport(weekId?: string): Promise<ExportTable> {
  const rows = await db.participantWeek.findMany({
    ...(weekId ? { where: { weekId } } : {}),
    orderBy: [{ week: { startAt: "asc" } }, { rankCached: "asc" }],
    select: {
      id: true,
      weekId: true,
      mainScoreCached: true,
      missionScoreCached: true,
      wins: true,
      losses: true,
      rankCached: true,
      missionRankCached: true,
      participant: { select: { id: true, gameName: true, tagLine: true } },
    },
  });
  return {
    headers: [
      "participantWeekId",
      "weekId",
      "participantId",
      "riotId",
      "mainScore",
      "missionScore",
      "wins",
      "losses",
      "rank",
      "missionRank",
    ],
    rows: rows.map((row) => [
      row.id,
      row.weekId,
      row.participant.id,
      `${row.participant.gameName}#${row.participant.tagLine}`,
      row.mainScoreCached,
      row.missionScoreCached,
      row.wins,
      row.losses,
      row.rankCached,
      row.missionRankCached,
    ]),
  };
}

export async function buildAdminExport(input: {
  type: ExportJobType;
  format: ExportFormat;
  weekId?: string;
}) {
  const table =
    input.type === "PARTICIPANTS"
      ? await participantsExport()
      : input.type === "MATCHES"
        ? await matchesExport(input.weekId)
        : input.type === "SCORE_LEDGER"
          ? await scoreLedgerExport(input.weekId)
          : input.type === "MISSION_LEDGER"
            ? await missionLedgerExport(input.weekId)
            : input.type === "STANDINGS"
              ? await standingsExport(input.weekId)
              : null;

  let content: string;
  if (input.type === "FULL_ARCHIVE") {
    const [participants, matches, scores, missions, standings] =
      await Promise.all([
        participantsExport(),
        matchesExport(input.weekId),
        scoreLedgerExport(input.weekId),
        missionLedgerExport(input.weekId),
        standingsExport(input.weekId),
      ]);
    content = JSON.stringify(
      {
        participants,
        matches,
        scoreLedger: scores,
        missionLedger: missions,
        standings,
      },
      null,
      2,
    );
  } else if (!table) {
    throw new Error("지원하지 않는 export 유형입니다.");
  } else if (input.format === "CSV") {
    content = encodeCsv([table.headers, ...table.rows]);
  } else {
    content = JSON.stringify(
      table.rows.map((row) =>
        Object.fromEntries(
          table.headers.map((header, index) => [header, row[index]]),
        ),
      ),
      null,
      2,
    );
  }

  return {
    content,
    checksum: createHash("sha256").update(content).digest("hex"),
    contentType:
      input.format === "CSV"
        ? "text/csv; charset=utf-8"
        : "application/json; charset=utf-8",
  };
}
