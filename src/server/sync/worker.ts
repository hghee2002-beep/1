import "server-only";

import { randomUUID } from "node:crypto";

import type { SyncRequestInput } from "@/features/sync/validation";
import { runMatchSync } from "@/server/sync/service";

export function runWorkerSync(
  input: Omit<SyncRequestInput, "invocationKey"> & {
    invocationKey?: string;
    requestId?: string;
  },
) {
  return runMatchSync({
    ...input,
    invocationKey: input.invocationKey ?? `worker:${randomUUID()}`,
    trigger: "WORKER",
    ...(input.requestId ? { requestId: input.requestId } : {}),
  });
}
