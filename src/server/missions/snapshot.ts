import "server-only";

import type { Prisma } from "@/generated/prisma/client";

export async function captureMissionMatchSnapshot(input: {
  transaction: Prisma.TransactionClient;
  participantMatchId: string;
  participantWeekId: string;
  matchStartAt: Date;
}) {
  const existing = await input.transaction.missionMatchSnapshot.findUnique({
    where: { participantMatchId: input.participantMatchId },
    include: { assignments: true },
  });
  if (existing) {
    if (!existing.sealedAt) {
      throw new Error("MISSION_MATCH_SNAPSHOT_NOT_SEALED");
    }
    return {
      snapshotId: existing.id,
      assignmentIds: existing.assignments.map((entry) => entry.assignmentId),
      created: false,
    };
  }

  const activeAtStart =
    await input.transaction.weeklyMissionAssignment.findMany({
      where: {
        participantWeekId: input.participantWeekId,
        activeFrom: { lte: input.matchStartAt },
        OR: [{ activeTo: null }, { activeTo: { gt: input.matchStartAt } }],
      },
      orderBy: { seenOrder: "asc" },
      select: { id: true, evaluatorVersion: true },
    });
  const snapshot = await input.transaction.missionMatchSnapshot.create({
    data: {
      participantMatchId: input.participantMatchId,
      matchStartAt: input.matchStartAt,
      assignments: {
        create: activeAtStart.map((assignment) => ({
          assignmentId: assignment.id,
          evaluatorVersion: assignment.evaluatorVersion,
        })),
      },
    },
    select: { id: true },
  });
  await input.transaction.missionMatchSnapshot.update({
    where: { id: snapshot.id },
    data: { sealedAt: new Date() },
  });
  return {
    snapshotId: snapshot.id,
    assignmentIds: activeAtStart.map((assignment) => assignment.id),
    created: true,
  };
}
