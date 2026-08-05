import "server-only";

import { createHash } from "node:crypto";

import {
  MissionAssignmentState,
  MissionCandidateStatus,
  MissionLedgerType,
  MissionKind,
  MissionProgressEventType,
  Prisma,
  WeekStatus,
  type MissionDefinition,
} from "@/generated/prisma/client";
import { isMvpSnapshotBaselineStatus } from "@/domain/mvp/contract";
import {
  calculateMissionRefillAccrual,
  MISSION_REFILL_INTERVAL_MINUTES,
  MISSION_REFILL_MAX_CREDITS,
  MISSION_REROLL_COOLDOWN_MINUTES,
  missionRerollNextAvailableAt,
} from "@/domain/missions/lifecycle";
import {
  MISSION_EVALUATOR_KEYS_M001_M100,
  missionEvaluatorRegistry,
  type MissionEvaluation,
} from "@/domain/missions/evaluator";
import {
  MAX_ACTIVE_MISSIONS,
  selectMissionCandidate,
  type ActiveMissionGuard,
  type MissionDefinitionCandidate,
  type MissionIndexSelector,
  type MissionPosition,
  type SelectedMission,
} from "@/domain/missions/selection";
import { MissionServiceError } from "@/features/missions/errors";
import {
  isCompetitionWriteClosed,
  lockParticipantWeekCompetitionScope,
} from "@/server/competition/write-fence";
import { db } from "@/server/db/client";
import { cryptoMissionIndexSelector } from "@/server/missions/random";

type Transaction = Prisma.TransactionClient;
type AssignmentReason = "INITIAL" | "REFILL" | "REROLL";
type ParticipantWeekContext = Awaited<
  ReturnType<typeof loadParticipantWeekContext>
>;

const SERIALIZABLE_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
} as const;

function errorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  return typeof error.code === "string" ? error.code : null;
}

async function runSerializable<T>(
  operation: (transaction: Transaction) => Promise<T>,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(operation, SERIALIZABLE_OPTIONS);
    } catch (error) {
      if (errorCode(error) === "P2034" && attempt < 2) continue;
      if (error instanceof MissionServiceError) throw error;
      if (errorCode(error) === "P2002" || errorCode(error) === "P2034") {
        throw new MissionServiceError(
          "MISSION_CONFLICT",
          "다른 미션 요청이 먼저 처리되었습니다. 상태를 새로고침해 주세요.",
        );
      }
      throw error;
    }
  }
  throw new MissionServiceError(
    "MISSION_CONFLICT",
    "미션 상태를 동시에 변경할 수 없습니다.",
  );
}

async function lockParticipantWeek(
  transaction: Transaction,
  participantWeekId: string,
) {
  const rows = await transaction.$queryRaw<readonly { id: string }[]>`
    SELECT "id"
    FROM "ParticipantWeek"
    WHERE "id" = ${participantWeekId}::uuid
    FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new MissionServiceError(
      "MISSION_ASSIGNMENT_NOT_FOUND",
      "참가자 주차 미션 상태를 찾을 수 없습니다.",
    );
  }
}

function jsonRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(Object.entries(value));
}

function configString(definition: MissionDefinition, key: string) {
  const value = jsonRecord(definition.evaluatorConfig)?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function definitionCandidate(
  definition: MissionDefinition,
): MissionDefinitionCandidate {
  return {
    id: definition.id,
    code: definition.code,
    version: definition.version,
    points: definition.points,
    kind: definition.kind,
    sourceType: definition.sourceType,
    evaluatorKey: definition.evaluatorKey,
    evaluatorConfig: definition.evaluatorConfig,
    active: definition.active,
  };
}

function definitionGuard(definition: MissionDefinition): ActiveMissionGuard {
  return definitionCandidate(definition);
}

function catalogVersion(value: string) {
  const matched = /^v(\d+)$/u.exec(value.trim());
  return matched?.[1] ? Number(matched[1]) : null;
}

function rulesTimelineAvailable(rulesSnapshot: Prisma.JsonValue) {
  return jsonRecord(rulesSnapshot)?.missionTimelineAvailable !== false;
}

async function loadParticipantWeekContext(
  transaction: Transaction,
  participantWeekId: string,
) {
  const participantWeek = await transaction.participantWeek.findUnique({
    where: { id: participantWeekId },
    include: {
      participant: { select: { primaryPosition: true, userId: true } },
      week: {
        include: {
          baselineVersion: {
            select: { status: true, demoOnly: true },
          },
        },
      },
    },
  });
  if (!participantWeek) {
    throw new MissionServiceError(
      "MISSION_ASSIGNMENT_NOT_FOUND",
      "참가자 주차 미션 상태를 찾을 수 없습니다.",
    );
  }
  return participantWeek;
}

function assertWeekOpen(context: ParticipantWeekContext, now: Date) {
  if (
    context.week.status !== WeekStatus.ACTIVE ||
    now.getTime() < context.week.startAt.getTime() ||
    now.getTime() >= context.week.endAt.getTime()
  ) {
    throw new MissionServiceError(
      "WEEK_CLOSED",
      "현재 주차에서는 미션을 변경할 수 없습니다.",
    );
  }
}

async function assertMissionCompetitionWriteOpen(
  transaction: Transaction,
  participantWeekId: string,
) {
  const scope = await lockParticipantWeekCompetitionScope(
    transaction,
    participantWeekId,
  );
  if (!scope) {
    throw new MissionServiceError(
      "MISSION_ASSIGNMENT_NOT_FOUND",
      "참가자 주차 미션 상태를 찾을 수 없습니다.",
    );
  }
  if (isCompetitionWriteClosed(scope)) {
    throw new MissionServiceError(
      "WEEK_CLOSED",
      "확정된 주차 또는 시즌의 미션 결과는 변경할 수 없습니다.",
    );
  }
}

async function loadCatalogDefinitions(
  transaction: Transaction,
  context: ParticipantWeekContext,
) {
  const version = catalogVersion(context.week.missionCatalogVersion);
  if (version === null) return [];
  const definitions = await transaction.missionDefinition.findMany({
    where: {
      active: true,
      version,
    },
    orderBy: [{ code: "asc" }, { version: "desc" }],
  });
  return definitions.filter((definition) => {
    const catalogDefinition = /^M\d{3}$/u.test(definition.code);
    const implementedCatalogCode =
      definition.code in MISSION_EVALUATOR_KEYS_M001_M100;
    return (
      missionEvaluatorRegistry.has(definition.evaluatorKey) &&
      (!catalogDefinition || implementedCatalogCode)
    );
  });
}

async function activeMissionGuards(
  transaction: Transaction,
  participantWeekId: string,
) {
  const active = await transaction.weeklyMissionAssignment.findMany({
    where: { participantWeekId, state: MissionAssignmentState.ACTIVE },
    include: { missionDefinition: true },
    orderBy: { seenOrder: "asc" },
  });
  return active.map((assignment) =>
    definitionGuard(assignment.missionDefinition),
  );
}

function selectionMetadata(input: {
  selected: SelectedMission;
  definitions: readonly MissionDefinition[];
  reason: AssignmentReason;
  selectedAt: Date;
}): Prisma.InputJsonObject {
  const byId = new Map(
    input.definitions.map((definition) => [definition.id, definition]),
  );
  const candidates = input.selected.candidateDefinitionIds.map((id) => {
    const definition = byId.get(id);
    return {
      id,
      code: definition?.code ?? "UNKNOWN",
      version: definition?.version ?? 0,
    };
  });
  const candidateHash = createHash("sha256")
    .update(JSON.stringify(candidates))
    .digest("hex");
  return {
    reason: input.reason,
    pool: input.selected.pool,
    selectedAt: input.selectedAt.toISOString(),
    selectorAlgorithm: input.selected.proof.algorithm,
    candidateHash,
    candidates,
    selected: {
      id: input.selected.definition.id,
      code: input.selected.definition.code,
      version: input.selected.definition.version,
    },
  };
}

async function nextSeenOrder(
  transaction: Transaction,
  participantWeekId: string,
) {
  const aggregate = await transaction.weeklyMissionAssignment.aggregate({
    where: { participantWeekId },
    _max: { seenOrder: true },
  });
  return (aggregate._max.seenOrder ?? 0) + 1;
}

async function createSelectedAssignment(input: {
  transaction: Transaction;
  context: ParticipantWeekContext;
  definitions: readonly MissionDefinition[];
  selected: SelectedMission;
  reason: AssignmentReason;
  selectionKey: string;
  activeFrom: Date;
  assignedAt: Date;
  seenOrder: number;
}) {
  const definition = input.definitions.find(
    (candidate) => candidate.id === input.selected.definition.id,
  );
  if (!definition) {
    throw new MissionServiceError(
      "MISSION_POOL_EXHAUSTED",
      "선택된 미션 정의를 더 이상 사용할 수 없습니다.",
    );
  }
  const history = await input.transaction.missionCandidateHistory.findUnique({
    where: {
      participantWeekId_missionDefinitionId: {
        participantWeekId: input.context.id,
        missionDefinitionId: definition.id,
      },
    },
  });
  const generation = (history?.timesAssigned ?? 0) + 1;
  const evaluatorVersion =
    configString(definition, "evaluatorVersion") ??
    missionEvaluatorRegistry.get(definition.evaluatorKey)?.version ??
    `v${definition.version}`;
  const assignment = await input.transaction.weeklyMissionAssignment.create({
    data: {
      participantWeekId: input.context.id,
      missionDefinitionId: definition.id,
      state: MissionAssignmentState.ACTIVE,
      generation,
      selectionKey: input.selectionKey,
      selectionSeedHash: input.selected.proof.entropyHash,
      selectionMetadata: selectionMetadata({
        selected: input.selected,
        definitions: input.definitions,
        reason: input.reason,
        selectedAt: input.assignedAt,
      }),
      assignedAt: input.assignedAt,
      activeFrom: input.activeFrom,
      target: definition.target,
      unit: configString(definition, "unit") ?? "count",
      seenOrder: input.seenOrder,
      evaluatorVersion,
    },
    include: { missionDefinition: true },
  });
  await input.transaction.missionCandidateHistory.upsert({
    where: {
      participantWeekId_missionDefinitionId: {
        participantWeekId: input.context.id,
        missionDefinitionId: definition.id,
      },
    },
    update: {
      timesAssigned: { increment: 1 },
      status: MissionCandidateStatus.ACTIVE,
    },
    create: {
      participantWeekId: input.context.id,
      missionDefinitionId: definition.id,
      firstSeenAt: input.assignedAt,
      timesAssigned: 1,
      status: MissionCandidateStatus.ACTIVE,
    },
  });
  return assignment;
}

async function selectAndCreateAssignment(input: {
  transaction: Transaction;
  context: ParticipantWeekContext;
  definitions: readonly MissionDefinition[];
  selector: MissionIndexSelector;
  reason: AssignmentReason;
  selectionKey: string;
  activeFrom: Date;
  assignedAt: Date;
  seenOrder: number;
  requireLowPointMission?: boolean;
  excludedDefinitionIds?: readonly string[];
}) {
  const [active, history] = await Promise.all([
    activeMissionGuards(input.transaction, input.context.id),
    input.transaction.missionCandidateHistory.findMany({
      where: { participantWeekId: input.context.id },
      select: { missionDefinitionId: true, status: true },
    }),
  ]);
  const selected = selectMissionCandidate({
    definitions: input.definitions
      .filter(
        (definition) => !input.excludedDefinitionIds?.includes(definition.id),
      )
      .map(definitionCandidate),
    history,
    active,
    participantPrimaryPosition: input.context.participant
      .primaryPosition as MissionPosition | null,
    timelineAvailable: rulesTimelineAvailable(input.context.week.rulesSnapshot),
    hasPublishedMvpBaseline:
      isMvpSnapshotBaselineStatus(input.context.week.baselineVersion?.status) &&
      input.context.week.baselineVersion.demoOnly === false,
    ...(input.requireLowPointMission === undefined
      ? {}
      : { requireLowPointMission: input.requireLowPointMission }),
    selector: input.selector,
  });
  if (!selected) return null;
  return createSelectedAssignment({ ...input, selected });
}

export type MissionAssignmentSummary = {
  id: string;
  code: string;
  title: string;
  state: string;
  activeFrom: Date;
  progress: string;
  target: string;
};

function assignmentSummary(assignment: {
  id: string;
  state: string;
  activeFrom: Date;
  progress: { toString(): string };
  target: { toString(): string };
  missionDefinition: { code: string; title: string };
}): MissionAssignmentSummary {
  return {
    id: assignment.id,
    code: assignment.missionDefinition.code,
    title: assignment.missionDefinition.title,
    state: assignment.state,
    activeFrom: assignment.activeFrom,
    progress: assignment.progress.toString(),
    target: assignment.target.toString(),
  };
}

export async function initializeParticipantWeekMissions(input: {
  participantWeekId: string;
  now: Date;
  selector?: MissionIndexSelector;
}) {
  return runSerializable(async (transaction) => {
    await lockParticipantWeek(transaction, input.participantWeekId);
    const context = await loadParticipantWeekContext(
      transaction,
      input.participantWeekId,
    );
    assertWeekOpen(context, input.now);
    const existingState = await transaction.missionRefillState.findUnique({
      where: { participantWeekId: context.id },
    });
    if (existingState) {
      const active = await transaction.weeklyMissionAssignment.count({
        where: {
          participantWeekId: context.id,
          state: MissionAssignmentState.ACTIVE,
        },
      });
      return { created: 0, active, vacancies: MAX_ACTIVE_MISSIONS - active };
    }

    const firstAccrualAt = new Date(
      context.week.startAt.getTime() + MISSION_REFILL_INTERVAL_MINUTES * 60_000,
    );
    await Promise.all([
      transaction.missionRefillState.create({
        data: {
          participantWeekId: context.id,
          credits: 0,
          maxCredits: MISSION_REFILL_MAX_CREDITS,
          intervalMinutes: MISSION_REFILL_INTERVAL_MINUTES,
          anchorAt: context.week.startAt,
          accountedThroughAt: context.week.startAt,
          nextAccrualAt: firstAccrualAt,
        },
      }),
      transaction.missionRerollState.create({
        data: {
          participantWeekId: context.id,
          cooldownMinutes: MISSION_REROLL_COOLDOWN_MINUTES,
        },
      }),
    ]);

    const definitions = await loadCatalogDefinitions(transaction, context);
    let created = 0;
    for (let slot = 1; slot <= MAX_ACTIVE_MISSIONS; slot += 1) {
      const assignment = await selectAndCreateAssignment({
        transaction,
        context,
        definitions,
        selector: input.selector ?? cryptoMissionIndexSelector,
        reason: "INITIAL",
        selectionKey: `mission-initial:${context.id}:${slot}`,
        activeFrom: context.week.startAt,
        assignedAt: input.now,
        seenOrder: slot,
        requireLowPointMission: slot === 1,
      });
      if (!assignment) break;
      created += 1;
    }
    return {
      created,
      active: created,
      vacancies: MAX_ACTIVE_MISSIONS - created,
    };
  });
}

async function applyRefillWithinTransaction(input: {
  transaction: Transaction;
  context: ParticipantWeekContext;
  now: Date;
  selector: MissionIndexSelector;
}) {
  assertWeekOpen(input.context, input.now);
  const refill = await input.transaction.missionRefillState.findUniqueOrThrow({
    where: { participantWeekId: input.context.id },
  });
  const accrued = calculateMissionRefillAccrual({
    anchorAt: refill.anchorAt,
    accountedThroughAt: refill.accountedThroughAt,
    now: input.now,
    credits: refill.credits,
    maxCredits: refill.maxCredits,
    intervalMinutes: refill.intervalMinutes,
  });
  let credits = accrued.credits;
  let filled = 0;
  const definitions = await loadCatalogDefinitions(
    input.transaction,
    input.context,
  );

  while (credits > 0) {
    const active = await input.transaction.weeklyMissionAssignment.count({
      where: {
        participantWeekId: input.context.id,
        state: MissionAssignmentState.ACTIVE,
      },
    });
    if (active >= MAX_ACTIVE_MISSIONS) break;
    const seenOrder = await nextSeenOrder(input.transaction, input.context.id);
    const assignment = await selectAndCreateAssignment({
      transaction: input.transaction,
      context: input.context,
      definitions,
      selector: input.selector,
      reason: "REFILL",
      selectionKey: `mission-refill:${input.context.id}:${seenOrder}`,
      activeFrom: input.now,
      assignedAt: input.now,
      seenOrder,
    });
    if (!assignment) break;
    credits -= 1;
    filled += 1;
  }

  await input.transaction.missionRefillState.update({
    where: { participantWeekId: input.context.id },
    data: {
      credits,
      accountedThroughAt: accrued.accountedThroughAt,
      nextAccrualAt: accrued.nextAccrualAt,
    },
  });
  const active = await input.transaction.weeklyMissionAssignment.count({
    where: {
      participantWeekId: input.context.id,
      state: MissionAssignmentState.ACTIVE,
    },
  });
  return {
    accrued: accrued.accrued,
    filled,
    credits,
    active,
    vacancies: MAX_ACTIVE_MISSIONS - active,
    nextAccrualAt: accrued.nextAccrualAt,
  };
}

export async function refillParticipantWeekMissions(input: {
  participantWeekId: string;
  now: Date;
  selector?: MissionIndexSelector;
}) {
  await initializeParticipantWeekMissions(input);
  return runSerializable(async (transaction) => {
    await lockParticipantWeek(transaction, input.participantWeekId);
    const context = await loadParticipantWeekContext(
      transaction,
      input.participantWeekId,
    );
    return applyRefillWithinTransaction({
      transaction,
      context,
      now: input.now,
      selector: input.selector ?? cryptoMissionIndexSelector,
    });
  });
}

export async function rerollMissionAssignment(input: {
  assignmentId: string;
  userId: string;
  idempotencyKey: string;
  now: Date;
  selector?: MissionIndexSelector;
}) {
  const target = await db.weeklyMissionAssignment.findUnique({
    where: { id: input.assignmentId },
    select: {
      participantWeekId: true,
      participantWeek: {
        select: { participant: { select: { userId: true } } },
      },
    },
  });
  if (!target) {
    throw new MissionServiceError(
      "MISSION_ASSIGNMENT_NOT_FOUND",
      "리롤할 미션을 찾을 수 없습니다.",
    );
  }
  if (target.participantWeek.participant.userId !== input.userId) {
    throw new MissionServiceError(
      "MISSION_ASSIGNMENT_FORBIDDEN",
      "본인의 미션만 리롤할 수 있습니다.",
    );
  }
  const selectionKey = `mission-reroll:${target.participantWeekId}:${input.idempotencyKey}`;
  return runSerializable(async (transaction) => {
    await lockParticipantWeek(transaction, target.participantWeekId);
    const repeated = await transaction.weeklyMissionAssignment.findUnique({
      where: { selectionKey },
      include: { missionDefinition: true },
    });
    if (repeated) return assignmentSummary(repeated);

    const assignment = await transaction.weeklyMissionAssignment.findUnique({
      where: { id: input.assignmentId },
      include: {
        missionDefinition: true,
        participantWeek: {
          include: {
            participant: { select: { userId: true, primaryPosition: true } },
            week: {
              include: {
                baselineVersion: {
                  select: { status: true, demoOnly: true },
                },
              },
            },
          },
        },
      },
    });
    if (!assignment) {
      throw new MissionServiceError(
        "MISSION_ASSIGNMENT_NOT_FOUND",
        "리롤할 미션을 찾을 수 없습니다.",
      );
    }
    const context = assignment.participantWeek;
    if (context.participant.userId !== input.userId) {
      throw new MissionServiceError(
        "MISSION_ASSIGNMENT_FORBIDDEN",
        "본인의 미션만 리롤할 수 있습니다.",
      );
    }
    assertWeekOpen(context, input.now);
    if (assignment.state !== MissionAssignmentState.ACTIVE) {
      throw new MissionServiceError(
        "MISSION_ASSIGNMENT_NOT_ACTIVE",
        "활성 상태인 미션만 리롤할 수 있습니다.",
      );
    }
    const reroll = await transaction.missionRerollState.findUniqueOrThrow({
      where: { participantWeekId: context.id },
    });
    if (
      reroll.nextAvailableAt &&
      input.now.getTime() < reroll.nextAvailableAt.getTime()
    ) {
      throw new MissionServiceError(
        "MISSION_REROLL_COOLDOWN",
        "아직 미션 리롤 쿨타임이 남아 있습니다.",
        { nextAvailableAt: reroll.nextAvailableAt.toISOString() },
      );
    }

    const definitions = await loadCatalogDefinitions(transaction, context);
    const seenOrder = await nextSeenOrder(transaction, context.id);
    const deferredOrder = await transaction.missionCandidateHistory.count({
      where: {
        participantWeekId: context.id,
        status: MissionCandidateStatus.DEFERRED,
      },
    });
    await Promise.all([
      transaction.weeklyMissionAssignment.update({
        where: { id: assignment.id },
        data: {
          state: MissionAssignmentState.REROLLED,
          activeTo: input.now,
          deferredOrder: deferredOrder + 1,
        },
      }),
      transaction.missionCandidateHistory.update({
        where: {
          participantWeekId_missionDefinitionId: {
            participantWeekId: context.id,
            missionDefinitionId: assignment.missionDefinitionId,
          },
        },
        data: {
          status: MissionCandidateStatus.DEFERRED,
          rerolledAt: input.now,
        },
      }),
    ]);
    const selected = await selectAndCreateAssignment({
      transaction,
      context,
      definitions,
      selector: input.selector ?? cryptoMissionIndexSelector,
      reason: "REROLL",
      selectionKey,
      activeFrom: input.now,
      assignedAt: input.now,
      seenOrder,
      excludedDefinitionIds: [assignment.missionDefinitionId],
    });
    if (!selected) {
      throw new MissionServiceError(
        "MISSION_POOL_EXHAUSTED",
        "현재 교체 가능한 미션 후보가 없습니다.",
      );
    }
    await transaction.missionRerollState.update({
      where: { participantWeekId: context.id },
      data: {
        lastUsedAt: input.now,
        nextAvailableAt: missionRerollNextAvailableAt(
          input.now,
          reroll.cooldownMinutes,
        ),
        totalUsed: { increment: 1 },
      },
    });
    return assignmentSummary(selected);
  });
}

export async function completeMissionAssignment(input: {
  assignmentId: string;
  participantMatchId: string;
  now: Date;
  selector?: MissionIndexSelector;
}) {
  const target = await db.weeklyMissionAssignment.findUnique({
    where: { id: input.assignmentId },
    select: { participantWeekId: true },
  });
  if (!target) {
    throw new MissionServiceError(
      "MISSION_ASSIGNMENT_NOT_FOUND",
      "완료할 미션을 찾을 수 없습니다.",
    );
  }
  return runSerializable(async (transaction) => {
    await lockParticipantWeek(transaction, target.participantWeekId);
    await assertMissionCompetitionWriteOpen(
      transaction,
      target.participantWeekId,
    );
    const assignment =
      await transaction.weeklyMissionAssignment.findUniqueOrThrow({
        where: { id: input.assignmentId },
        include: { missionDefinition: true },
      });
    const existingLedger = await transaction.missionCompletionLedger.findUnique(
      {
        where: { assignmentId: assignment.id },
      },
    );
    if (existingLedger) {
      return { completed: false, filled: 0, ledgerId: existingLedger.id };
    }
    const snapshotEntry =
      await transaction.missionMatchSnapshotAssignment.findFirst({
        where: {
          assignmentId: assignment.id,
          snapshot: { participantMatchId: input.participantMatchId },
        },
        include: {
          snapshot: {
            include: {
              participantMatch: {
                include: {
                  seasonMatch: { include: { match: true } },
                },
              },
            },
          },
        },
      });
    if (!snapshotEntry) {
      throw new MissionServiceError(
        "MISSION_SNAPSHOT_MISSING",
        "경기 시작 시점 미션 스냅샷에 포함되지 않은 미션입니다.",
      );
    }
    const wasActive = assignment.state === MissionAssignmentState.ACTIVE;
    if (!wasActive && assignment.state !== MissionAssignmentState.REROLLED) {
      throw new MissionServiceError(
        "MISSION_ASSIGNMENT_NOT_ACTIVE",
        "진행 중인 미션만 완료할 수 있습니다.",
      );
    }
    const completedAt =
      snapshotEntry.snapshot.participantMatch.seasonMatch.match.gameEndAt;
    const before = assignment.progress;
    const delta = assignment.target.minus(before);
    const progressEvent = await transaction.missionProgressEvent.create({
      data: {
        assignmentId: assignment.id,
        participantMatchId: input.participantMatchId,
        type: MissionProgressEventType.NORMAL,
        beforeValue: before,
        deltaValue: delta,
        afterValue: assignment.target,
        completed: true,
        evaluatorVersion: snapshotEntry.evaluatorVersion,
        facts: {
          lifecycle: "assignment-engine-v1",
          snapshotId: snapshotEntry.snapshotId,
        },
        idempotencyKey: `mission-progress:${assignment.id}:${input.participantMatchId}:${snapshotEntry.evaluatorVersion}`,
      },
    });
    const ledger = await transaction.missionCompletionLedger.create({
      data: {
        participantWeekId: assignment.participantWeekId,
        assignmentId: assignment.id,
        type: MissionLedgerType.COMPLETION,
        points: assignment.missionDefinition.points,
        idempotencyKey: `mission-completion:${assignment.id}`,
        metadata: {
          participantMatchId: input.participantMatchId,
          progressEventId: progressEvent.id,
        },
      },
    });
    await Promise.all([
      transaction.weeklyMissionAssignment.update({
        where: { id: assignment.id },
        data: {
          state: MissionAssignmentState.COMPLETED,
          progress: assignment.target,
          completedAt,
          activeTo: assignment.activeTo ?? completedAt,
          completedByParticipantMatchId: input.participantMatchId,
          lastEvaluatedParticipantMatchId: input.participantMatchId,
        },
      }),
      transaction.missionCandidateHistory.update({
        where: {
          participantWeekId_missionDefinitionId: {
            participantWeekId: assignment.participantWeekId,
            missionDefinitionId: assignment.missionDefinitionId,
          },
        },
        data: {
          status: MissionCandidateStatus.COMPLETED,
          completedAt,
        },
      }),
      transaction.participantWeek.update({
        where: { id: assignment.participantWeekId },
        data: {
          missionScoreCached: {
            increment: assignment.missionDefinition.points,
          },
        },
      }),
    ]);
    let filled = 0;
    if (wasActive) {
      const context = await loadParticipantWeekContext(
        transaction,
        assignment.participantWeekId,
      );
      if (
        context.week.status === WeekStatus.ACTIVE &&
        input.now.getTime() < context.week.endAt.getTime()
      ) {
        filled = (
          await applyRefillWithinTransaction({
            transaction,
            context,
            now: input.now,
            selector: input.selector ?? cryptoMissionIndexSelector,
          })
        ).filled;
      }
    }
    return { completed: true, filled, ledgerId: ledger.id };
  });
}

function evaluationPayload(input: {
  evaluation: MissionEvaluation;
  participantMatchId: string;
  evaluatedAt: Date;
}): Prisma.InputJsonObject {
  return {
    status: input.evaluation.status,
    currentValue: input.evaluation.currentValue,
    targetValue: input.evaluation.targetValue,
    progressValue: input.evaluation.progressValue,
    progressMode: input.evaluation.progressMode,
    ...(input.evaluation.progressKey === undefined
      ? {}
      : { progressKey: input.evaluation.progressKey }),
    ...(input.evaluation.completionReached === undefined
      ? {}
      : { completionReached: input.evaluation.completionReached }),
    ...(input.evaluation.completionParticipantMatchId === undefined
      ? {}
      : {
          completionParticipantMatchId:
            input.evaluation.completionParticipantMatchId,
        }),
    unit: input.evaluation.unit,
    reason: input.evaluation.reason,
    evidence: { ...input.evaluation.evidence },
    evaluatorVersion: input.evaluation.evaluatorVersion,
    participantMatchId: input.participantMatchId,
    evaluatedAt: input.evaluatedAt.toISOString(),
  };
}

export async function recordMissionEvaluation(input: {
  assignmentId: string;
  participantMatchId: string;
  evaluation: MissionEvaluation;
  now: Date;
  selector?: MissionIndexSelector;
}) {
  const target = await db.weeklyMissionAssignment.findUnique({
    where: { id: input.assignmentId },
    select: { participantWeekId: true },
  });
  if (!target) {
    throw new MissionServiceError(
      "MISSION_ASSIGNMENT_NOT_FOUND",
      "판정할 미션을 찾을 수 없습니다.",
    );
  }

  return runSerializable(async (transaction) => {
    await lockParticipantWeek(transaction, target.participantWeekId);
    await assertMissionCompetitionWriteOpen(
      transaction,
      target.participantWeekId,
    );
    const assignment =
      await transaction.weeklyMissionAssignment.findUniqueOrThrow({
        where: { id: input.assignmentId },
        include: { missionDefinition: true },
      });
    const snapshotEntry =
      await transaction.missionMatchSnapshotAssignment.findFirst({
        where: {
          assignmentId: assignment.id,
          evaluatorVersion: input.evaluation.evaluatorVersion,
          snapshot: { participantMatchId: input.participantMatchId },
        },
        include: {
          snapshot: {
            include: {
              participantMatch: {
                include: {
                  seasonMatch: { include: { match: true } },
                },
              },
            },
          },
        },
      });
    if (!snapshotEntry) {
      throw new MissionServiceError(
        "MISSION_SNAPSHOT_MISSING",
        "경기 시작 시점 미션 스냅샷과 evaluator 버전이 일치하지 않습니다.",
      );
    }
    const payload = evaluationPayload({
      evaluation: input.evaluation,
      participantMatchId: input.participantMatchId,
      evaluatedAt: input.now,
    });

    if (input.evaluation.status === "PENDING_DATA") {
      if (assignment.state !== MissionAssignmentState.COMPLETED) {
        await transaction.weeklyMissionAssignment.update({
          where: { id: assignment.id },
          data: { progressPayload: payload },
        });
      }
      return {
        recorded: false,
        completed: false,
        pending: true,
        filled: 0,
      };
    }

    const existingEvent = await transaction.missionProgressEvent.findUnique({
      where: {
        assignmentId_participantMatchId_evaluatorVersion: {
          assignmentId: assignment.id,
          participantMatchId: input.participantMatchId,
          evaluatorVersion: input.evaluation.evaluatorVersion,
        },
      },
      select: { id: true, completed: true },
    });
    if (existingEvent) {
      return {
        recorded: false,
        completed: existingEvent.completed,
        pending: false,
        filled: 0,
      };
    }

    const wasActive = assignment.state === MissionAssignmentState.ACTIVE;
    const canApplyProgress =
      input.evaluation.status !== "NOT_APPLICABLE" &&
      (wasActive ||
        assignment.state === MissionAssignmentState.REROLLED ||
        assignment.state === MissionAssignmentState.EXPIRED);
    const existingLedger = await transaction.missionCompletionLedger.findUnique(
      {
        where: { assignmentId: assignment.id },
        select: { id: true },
      },
    );
    const before = assignment.progress;
    let proposed = before;
    if (canApplyProgress && !existingLedger) {
      if (input.evaluation.progressMode === "ADD") {
        proposed = new Prisma.Decimal(
          Math.min(
            Number(assignment.target),
            Number(before) + input.evaluation.progressValue,
          ),
        );
      } else if (input.evaluation.progressMode === "SET") {
        proposed = new Prisma.Decimal(
          Math.min(Number(assignment.target), input.evaluation.progressValue),
        );
      } else if (input.evaluation.progressMode === "DISTINCT") {
        const priorEvents = await transaction.missionProgressEvent.findMany({
          where: {
            assignmentId: assignment.id,
            type: MissionProgressEventType.NORMAL,
          },
          select: { facts: true },
        });
        const priorKeys = new Set(
          priorEvents.flatMap((event) => {
            const facts = jsonRecord(event.facts);
            const evaluation = jsonRecord(facts?.evaluation);
            const key = evaluation?.progressKey;
            return typeof key === "string" ? [key] : [];
          }),
        );
        const key = input.evaluation.progressKey;
        proposed = new Prisma.Decimal(
          Math.min(
            Number(assignment.target),
            Number(before) + (key && !priorKeys.has(key) ? 1 : 0),
          ),
        );
      } else {
        proposed = new Prisma.Decimal(
          Math.min(
            Number(assignment.target),
            Math.max(Number(before), input.evaluation.progressValue),
          ),
        );
      }
    }
    const completesNow =
      canApplyProgress &&
      existingLedger === null &&
      (assignment.missionDefinition.kind === MissionKind.SINGLE
        ? input.evaluation.status === "PASS"
        : input.evaluation.completionReached === true ||
          Number(proposed) >= Number(assignment.target));
    const after = completesNow ? assignment.target : proposed;
    const progressEvent = await transaction.missionProgressEvent.create({
      data: {
        assignmentId: assignment.id,
        participantMatchId: input.participantMatchId,
        type: MissionProgressEventType.NORMAL,
        beforeValue: before,
        deltaValue: after.minus(before),
        afterValue: after,
        completed: completesNow,
        evaluatorVersion: input.evaluation.evaluatorVersion,
        facts: {
          lifecycle: "mission-evaluation-v1",
          snapshotId: snapshotEntry.snapshotId,
          evaluation: payload,
          alreadyCompleted: existingLedger !== null,
        },
        idempotencyKey: `mission-progress:${assignment.id}:${input.participantMatchId}:${input.evaluation.evaluatorVersion}`,
      },
    });

    if (!completesNow) {
      if (assignment.state !== MissionAssignmentState.COMPLETED) {
        await transaction.weeklyMissionAssignment.update({
          where: { id: assignment.id },
          data: {
            progress: after,
            progressPayload: payload,
            lastEvaluatedParticipantMatchId: input.participantMatchId,
          },
        });
      }
      return {
        recorded: true,
        completed: false,
        pending: false,
        filled: 0,
      };
    }

    const canonicalCompletionEntry = input.evaluation
      .completionParticipantMatchId
      ? await transaction.missionMatchSnapshotAssignment.findFirst({
          where: {
            assignmentId: assignment.id,
            evaluatorVersion: input.evaluation.evaluatorVersion,
            snapshot: {
              participantMatchId: input.evaluation.completionParticipantMatchId,
            },
          },
          include: {
            snapshot: {
              include: {
                participantMatch: {
                  include: {
                    seasonMatch: { include: { match: true } },
                  },
                },
              },
            },
          },
        })
      : null;
    const completionParticipantMatch =
      canonicalCompletionEntry?.snapshot.participantMatch ??
      snapshotEntry.snapshot.participantMatch;
    const completedAt = completionParticipantMatch.seasonMatch.match.gameEndAt;
    const ledger = await transaction.missionCompletionLedger.create({
      data: {
        participantWeekId: assignment.participantWeekId,
        assignmentId: assignment.id,
        type: MissionLedgerType.COMPLETION,
        points: assignment.missionDefinition.points,
        idempotencyKey: `mission-completion:${assignment.id}`,
        metadata: {
          participantMatchId: completionParticipantMatch.id,
          evaluationParticipantMatchId: input.participantMatchId,
          progressEventId: progressEvent.id,
          evaluatorVersion: input.evaluation.evaluatorVersion,
        },
      },
    });
    await Promise.all([
      transaction.weeklyMissionAssignment.update({
        where: { id: assignment.id },
        data: {
          state: MissionAssignmentState.COMPLETED,
          progress: assignment.target,
          progressPayload: payload,
          completedAt,
          activeTo: assignment.activeTo ?? completedAt,
          completedByParticipantMatchId: completionParticipantMatch.id,
          lastEvaluatedParticipantMatchId: input.participantMatchId,
        },
      }),
      transaction.missionCandidateHistory.update({
        where: {
          participantWeekId_missionDefinitionId: {
            participantWeekId: assignment.participantWeekId,
            missionDefinitionId: assignment.missionDefinitionId,
          },
        },
        data: {
          status: MissionCandidateStatus.COMPLETED,
          completedAt,
        },
      }),
      transaction.participantWeek.update({
        where: { id: assignment.participantWeekId },
        data: {
          missionScoreCached: {
            increment: assignment.missionDefinition.points,
          },
        },
      }),
    ]);
    let filled = 0;
    if (wasActive) {
      const context = await loadParticipantWeekContext(
        transaction,
        assignment.participantWeekId,
      );
      if (
        context.week.status === WeekStatus.ACTIVE &&
        input.now.getTime() < context.week.endAt.getTime()
      ) {
        filled = (
          await applyRefillWithinTransaction({
            transaction,
            context,
            now: input.now,
            selector: input.selector ?? cryptoMissionIndexSelector,
          })
        ).filled;
      }
    }
    return {
      recorded: true,
      completed: true,
      pending: false,
      filled,
      ledgerId: ledger.id,
    };
  });
}

export async function expireParticipantWeekMissions(input: {
  participantWeekId: string;
  now: Date;
}) {
  return runSerializable(async (transaction) => {
    await lockParticipantWeek(transaction, input.participantWeekId);
    const context = await loadParticipantWeekContext(
      transaction,
      input.participantWeekId,
    );
    const scope = await lockParticipantWeekCompetitionScope(
      transaction,
      input.participantWeekId,
    );
    if (!scope || isCompetitionWriteClosed(scope)) return 0;
    if (input.now.getTime() < context.week.endAt.getTime()) return 0;
    const active = await transaction.weeklyMissionAssignment.findMany({
      where: {
        participantWeekId: context.id,
        state: MissionAssignmentState.ACTIVE,
      },
      select: { id: true, missionDefinitionId: true },
    });
    if (active.length === 0) return 0;
    await transaction.weeklyMissionAssignment.updateMany({
      where: { id: { in: active.map((assignment) => assignment.id) } },
      data: {
        state: MissionAssignmentState.EXPIRED,
        activeTo: context.week.endAt,
      },
    });
    await transaction.missionCandidateHistory.updateMany({
      where: {
        participantWeekId: context.id,
        missionDefinitionId: {
          in: active.map((assignment) => assignment.missionDefinitionId),
        },
        status: MissionCandidateStatus.ACTIVE,
      },
      data: { status: MissionCandidateStatus.EXHAUSTED },
    });
    return active.length;
  });
}

export async function runMissionLifecycleBatch(input: {
  now: Date;
  limit: number;
  selector?: MissionIndexSelector;
}) {
  const [open, ended] = await Promise.all([
    db.$queryRaw<readonly { id: string }[]>`
      SELECT participant_week."id"
      FROM "ParticipantWeek" participant_week
      JOIN "Week" week ON week."id" = participant_week."weekId"
      JOIN "Season" season ON season."id" = week."seasonId"
      LEFT JOIN "MissionRefillState" refill
        ON refill."participantWeekId" = participant_week."id"
      WHERE week."status" = 'ACTIVE'
        AND season."status" NOT IN ('FINALIZING', 'COMPLETED', 'ARCHIVED')
        AND week."startAt" <= ${input.now}
        AND ${input.now} < week."endAt"
        AND (
          refill."id" IS NULL
          OR refill."nextAccrualAt" <= ${input.now}
          OR (
            refill."credits" > 0
            AND (
              SELECT COUNT(*)
              FROM "WeeklyMissionAssignment" assignment
              WHERE assignment."participantWeekId" = participant_week."id"
                AND assignment."state" = 'ACTIVE'
            ) < ${MAX_ACTIVE_MISSIONS}
          )
        )
      ORDER BY COALESCE(refill."nextAccrualAt", week."startAt"), participant_week."createdAt"
      LIMIT ${input.limit}
    `,
    db.weeklyMissionAssignment.findMany({
      where: {
        state: MissionAssignmentState.ACTIVE,
        participantWeek: {
          week: {
            endAt: { lte: input.now },
            status: { notIn: [WeekStatus.FINALIZING, WeekStatus.COMPLETED] },
            season: {
              status: {
                notIn: ["FINALIZING", "COMPLETED", "ARCHIVED"],
              },
            },
          },
        },
      },
      distinct: ["participantWeekId"],
      take: input.limit,
      select: { participantWeekId: true },
    }),
  ]);
  let initialized = 0;
  let filled = 0;
  let accrued = 0;
  for (const participantWeek of open) {
    const initial = await initializeParticipantWeekMissions({
      participantWeekId: participantWeek.id,
      now: input.now,
      ...(input.selector ? { selector: input.selector } : {}),
    });
    initialized += initial.created;
    const refill = await refillParticipantWeekMissions({
      participantWeekId: participantWeek.id,
      now: input.now,
      ...(input.selector ? { selector: input.selector } : {}),
    });
    filled += refill.filled;
    accrued += refill.accrued;
  }
  let expired = 0;
  for (const participantWeek of ended) {
    expired += await expireParticipantWeekMissions({
      participantWeekId: participantWeek.participantWeekId,
      now: input.now,
    });
  }
  return {
    participantWeeks: open.length,
    initialized,
    accrued,
    filled,
    expired,
  };
}
