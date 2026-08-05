import "server-only";

import { createHash } from "node:crypto";

import {
  BaselineStatus,
  Prisma,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client";
import {
  canonicalBaselinePayload,
  validateBaselineImport,
  type BaselineImportFormat,
  type BaselineValidationReport,
  type ValidatedBaselinePayload,
} from "@/domain/mvp/baseline";
import { MvpServiceError } from "@/features/mvp/errors";
import { AuthServiceError } from "@/server/auth/errors";
import { db } from "@/server/db/client";

function jsonInput(value: unknown): Prisma.InputJsonValue {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("MVP_JSON_ENCODING_FAILED");
  return JSON.parse(encoded) as Prisma.InputJsonValue;
}

export function checksumBaselinePayload(payload: ValidatedBaselinePayload) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalBaselinePayload(payload)))
    .digest("hex");
}

function publicReport(report: BaselineValidationReport) {
  return {
    valid: report.valid,
    errorCount: report.errorCount,
    warningCount: report.warningCount,
    rowCount: report.rowCount,
    requiredRowCount: report.requiredRowCount,
    issues: report.issues,
    coverage: report.coverage,
  };
}

export function validateMvpBaseline(input: {
  format: BaselineImportFormat;
  content: unknown;
}) {
  const report = validateBaselineImport(input);
  return {
    report: publicReport(report),
    checksum: report.payload ? checksumBaselinePayload(report.payload) : null,
    metadata: report.payload?.metadata ?? null,
  };
}

export async function publishMvpBaseline(input: {
  format: BaselineImportFormat;
  content: unknown;
  expectedChecksum: string;
  confirmationName: string;
  actorUserId: string;
  requestId?: string;
  now?: Date;
}) {
  const report = validateBaselineImport({
    format: input.format,
    content: input.content,
  });
  if (!report.valid || !report.payload) {
    throw new MvpServiceError(
      "BASELINE_INVALID",
      "검증 오류가 있는 baseline은 게시할 수 없습니다.",
    );
  }
  const payload = report.payload;
  const checksum = checksumBaselinePayload(payload);
  if (checksum !== input.expectedChecksum) {
    throw new MvpServiceError(
      "BASELINE_CHECKSUM_MISMATCH",
      "dry-run 이후 입력 내용이 변경되었습니다. 다시 검증해 주세요.",
    );
  }
  if (input.confirmationName.trim() !== payload.metadata.name) {
    throw new MvpServiceError(
      "BASELINE_CONFIRMATION_REQUIRED",
      "게시할 baseline 이름을 정확히 입력해 확인해 주세요.",
    );
  }
  const now = input.now ?? new Date();
  try {
    return await db.$transaction(
      async (transaction) => {
        const actor = await transaction.user.findUnique({
          where: { id: input.actorUserId },
          select: { id: true, role: true, status: true },
        });
        if (
          !actor ||
          actor.role !== UserRole.ADMIN ||
          actor.status !== UserStatus.ACTIVE
        ) {
          throw new AuthServiceError("FORBIDDEN", "접근 권한이 없습니다.");
        }
        const existing = await transaction.mvpBaselineVersion.findUnique({
          where: { name: payload.metadata.name },
          select: { id: true },
        });
        if (existing) {
          throw new MvpServiceError(
            "BASELINE_NAME_CONFLICT",
            "같은 이름의 baseline version이 이미 있습니다.",
          );
        }
        const retired = await transaction.mvpBaselineVersion.findMany({
          where: { status: BaselineStatus.PUBLISHED },
          select: { id: true, name: true },
        });
        await transaction.mvpBaselineVersion.updateMany({
          where: { status: BaselineStatus.PUBLISHED },
          data: { status: BaselineStatus.RETIRED, retiredAt: now },
        });
        const stagedBaseline = await transaction.mvpBaselineVersion.create({
          data: {
            name: payload.metadata.name,
            status: BaselineStatus.VALIDATED,
            sourceDescription: payload.metadata.sourceDescription,
            patchFrom: payload.metadata.patchFrom,
            patchTo: payload.metadata.patchTo,
            collectedAt: new Date(payload.metadata.collectedAt),
            sampleNotes: payload.metadata.sampleNotes ?? null,
            demoOnly: payload.metadata.demoOnly,
            checksum,
            validationReport: jsonInput(publicReport(report)),
            uploadedById: actor.id,
            metrics: {
              createMany: {
                data: payload.metrics.map((metric) => ({
                  tierBucket: metric.tierBucket,
                  position: metric.position,
                  metricKey: metric.metricKey,
                  mean: metric.mean,
                  stdDev: metric.stdDev,
                  sampleSize: metric.sampleSize,
                  lowerBound: metric.lowerBound,
                  upperBound: metric.upperBound,
                })),
              },
            },
          },
          select: { id: true },
        });
        const baseline = await transaction.mvpBaselineVersion.update({
          where: { id: stagedBaseline.id },
          data: { status: BaselineStatus.PUBLISHED, publishedAt: now },
          select: {
            id: true,
            name: true,
            status: true,
            demoOnly: true,
            checksum: true,
            publishedAt: true,
            _count: { select: { metrics: true } },
          },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: actor.id,
            action: "MVP_BASELINE_PUBLISHED",
            targetType: "MvpBaselineVersion",
            targetId: baseline.id,
            before: { retiredPublishedVersions: retired },
            after: {
              name: baseline.name,
              checksum: baseline.checksum,
              demoOnly: baseline.demoOnly,
              metricCount: baseline._count.metrics,
            },
            requestId: input.requestId ?? null,
          },
        });
        return baseline;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new MvpServiceError(
        "BASELINE_NAME_CONFLICT",
        "같은 이름의 baseline version이 이미 있습니다.",
      );
    }
    throw error;
  }
}

export async function listMvpBaselines() {
  return db.mvpBaselineVersion.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      name: true,
      status: true,
      sourceDescription: true,
      patchFrom: true,
      patchTo: true,
      collectedAt: true,
      sampleNotes: true,
      demoOnly: true,
      checksum: true,
      publishedAt: true,
      retiredAt: true,
      createdAt: true,
      _count: { select: { metrics: true, evaluations: true, weeks: true } },
      metrics: {
        orderBy: { sampleSize: "asc" },
        take: 1,
        select: { sampleSize: true },
      },
    },
  });
}

export async function getMvpBaselineDetail(id: string) {
  const baseline = await db.mvpBaselineVersion.findUnique({
    where: { id },
    include: {
      metrics: {
        orderBy: [
          { tierBucket: "asc" },
          { position: "asc" },
          { metricKey: "asc" },
        ],
      },
      uploadedBy: { select: { realName: true, loginId: true } },
      _count: { select: { evaluations: true, weeks: true } },
    },
  });
  if (!baseline) {
    throw new MvpServiceError(
      "BASELINE_NOT_FOUND",
      "baseline version을 찾을 수 없습니다.",
    );
  }
  return baseline;
}

export async function getMvpEvaluationBreakdown(seasonMatchId: string) {
  const seasonMatch = await db.seasonMatch.findUnique({
    where: { id: seasonMatchId },
    select: {
      id: true,
      status: true,
      match: { select: { riotMatchId: true, gameStartAt: true } },
      mvpEvaluations: {
        orderBy: [
          { createdAt: "desc" },
          { matchParticipantRaw: { participantIndex: "asc" } },
        ],
        select: {
          id: true,
          evaluationKey: true,
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
          evaluatorVersion: true,
          metrics: true,
          tieBreak: true,
          createdAt: true,
          baselineVersion: {
            select: {
              id: true,
              name: true,
              patchFrom: true,
              patchTo: true,
              demoOnly: true,
            },
          },
          matchParticipantRaw: {
            select: {
              puuid: true,
              teamId: true,
              championName: true,
              win: true,
            },
          },
          participantMatch: {
            select: {
              participant: { select: { gameName: true, tagLine: true } },
            },
          },
        },
      },
    },
  });
  if (!seasonMatch) throw new Error("MVP_SEASON_MATCH_NOT_FOUND");
  return seasonMatch;
}

export async function getRecentMvpEvaluations(seasonId: string) {
  return db.mvpEvaluation.findMany({
    where: { seasonMatch: { seasonId } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      errorCode: true,
      award: true,
      evaluatorVersion: true,
      visionObjectiveScore: true,
      growthScore: true,
      damageScore: true,
      kdaParticipationScore: true,
      totalScore: true,
      teamRank: true,
      createdAt: true,
      baselineVersion: { select: { name: true, demoOnly: true } },
      seasonMatch: {
        select: { match: { select: { riotMatchId: true } } },
      },
      matchParticipantRaw: {
        select: { puuid: true, championName: true, teamId: true },
      },
      participantMatch: {
        select: {
          participant: { select: { gameName: true, tagLine: true } },
        },
      },
    },
  });
}
