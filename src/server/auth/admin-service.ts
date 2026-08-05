import "server-only";

import { UserRole, UserStatus } from "@/generated/prisma/client";

import { AuthServiceError } from "@/server/auth/errors";
import { db } from "@/server/db/client";

export async function changeUserRole(input: {
  actorUserId: string;
  targetUserId: string;
  role: UserRole;
  reason: string;
  requestId?: string;
}) {
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 500) {
    throw new Error("관리자 권한 변경 사유는 5~500자여야 합니다.");
  }

  return db.$transaction(async (transaction) => {
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

    const target = await transaction.user.findUnique({
      where: { id: input.targetUserId },
      select: { id: true, role: true, sessionVersion: true },
    });
    if (!target) throw new Error("대상 사용자를 찾을 수 없습니다.");
    if (target.role === input.role) return target;

    if (target.role === UserRole.ADMIN && input.role !== UserRole.ADMIN) {
      const activeAdminCount = await transaction.user.count({
        where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      });
      if (activeAdminCount <= 1) {
        throw new Error("마지막 활성 관리자의 권한은 해제할 수 없습니다.");
      }
    }

    const updated = await transaction.user.update({
      where: { id: target.id },
      data: {
        role: input.role,
        sessionVersion: { increment: 1 },
      },
      select: { id: true, role: true, sessionVersion: true },
    });
    await transaction.authSession.updateMany({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "ROLE_CHANGED" },
    });
    await transaction.auditLog.create({
      data: {
        actorUserId: actor.id,
        action: "USER_ROLE_CHANGED",
        targetType: "User",
        targetId: target.id,
        reason,
        before: { role: target.role, sessionVersion: target.sessionVersion },
        after: { role: updated.role, sessionVersion: updated.sessionVersion },
        ...(input.requestId ? { requestId: input.requestId } : {}),
      },
    });

    return updated;
  });
}
