import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { ExportJobStatus } from "@/generated/prisma/client";
import type { ExportJobType } from "@/generated/prisma/client";
import { exportFileName } from "@/features/admin/export";
import { buildAdminExport } from "@/server/admin/export";
import { AuthServiceError } from "@/server/auth/errors";
import { requireApiAdmin } from "@/server/auth/guards";
import { authErrorResponse } from "@/server/auth/http";
import { db } from "@/server/db/client";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

function sameChecksum(left: string, right: string) {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const session = await requireApiAdmin(request);
    const { id } = await context.params;
    const job = await db.exportJob.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
        weekId: true,
        objectPath: true,
        checksum: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    if (!job) {
      return authErrorResponse({
        code: "NOT_FOUND",
        message: "내보내기 작업을 찾을 수 없습니다.",
        status: 404,
      });
    }
    if (
      job.status !== ExportJobStatus.COMPLETED ||
      !job.checksum ||
      !job.objectPath
    ) {
      return authErrorResponse({
        code: "EXPORT_NOT_READY",
        message: "내보내기 파일이 아직 준비되지 않았습니다.",
        status: 409,
      });
    }
    if (job.expiresAt && job.expiresAt <= new Date()) {
      await db.exportJob.update({
        where: { id: job.id },
        data: { status: ExportJobStatus.EXPIRED },
      });
      return authErrorResponse({
        code: "EXPORT_EXPIRED",
        message: "내보내기 파일이 만료되었습니다. 새 작업을 생성해 주세요.",
        status: 410,
      });
    }
    const format = job.objectPath === "generated:CSV" ? "CSV" : "JSON";
    const artifact = await buildAdminExport({
      type: job.type as ExportJobType,
      format,
      ...(job.weekId ? { weekId: job.weekId } : {}),
    });
    if (!sameChecksum(artifact.checksum, job.checksum)) {
      return authErrorResponse({
        code: "EXPORT_CHECKSUM_MISMATCH",
        message:
          "내보내기 내용이 생성 시점과 달라졌습니다. 새 작업을 생성해 주세요.",
        status: 409,
      });
    }
    await db.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "EXPORT_DOWNLOADED",
        targetType: "ExportJob",
        targetId: job.id,
        reason: "관리자 콘솔 export 다운로드",
        after: { type: job.type, format, checksum: job.checksum },
        requestId: request.headers.get("x-request-id"),
      },
    });
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": artifact.contentType,
      "Content-Disposition": `attachment; filename="${exportFileName({
        type: job.type,
        format,
        createdAt: job.createdAt,
      })}"`,
      "X-Content-Type-Options": "nosniff",
    });
    return new Response(
      format === "CSV" ? `\uFEFF${artifact.content}` : artifact.content,
      {
        status: 200,
        headers,
      },
    );
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return authErrorResponse({
        code: error.code,
        message: error.message,
        status: error.code === "AUTH_REQUIRED" ? 401 : 403,
      });
    }
    console.error("admin.export.download.failed");
    return authErrorResponse({
      code: "INTERNAL_ERROR",
      message: "내보내기 파일을 생성하지 못했습니다.",
      status: 500,
    });
  }
}
