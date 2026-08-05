"use client";

import { CheckCircle2, X } from "lucide-react";
import { useCallback, useMemo, useSyncExternalStore } from "react";

type Completion = { id: string; title: string; points: number };
const COMPLETION_STORAGE_EVENT = "deluxe-soloq:mission-completions-changed";

function parseAcknowledged(value: string) {
  try {
    const stored: unknown = JSON.parse(value);
    return new Set(
      Array.isArray(stored)
        ? stored.filter(
            (candidate): candidate is string => typeof candidate === "string",
          )
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

export function MissionCompletionNotice({
  weekId,
  completions,
}: {
  weekId: string;
  completions: readonly Completion[];
}) {
  const storageKey = `deluxe-soloq:mission-completions:${weekId}`;
  const subscribe = useCallback(
    (notify: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === storageKey) notify();
      };
      const onLocalChange = (event: Event) => {
        if (event instanceof CustomEvent && event.detail === storageKey) {
          notify();
        }
      };
      window.addEventListener("storage", onStorage);
      window.addEventListener(COMPLETION_STORAGE_EVENT, onLocalChange);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(COMPLETION_STORAGE_EVENT, onLocalChange);
      };
    },
    [storageKey],
  );
  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(storageKey) ?? "[]";
    } catch {
      return "[]";
    }
  }, [storageKey]);
  const serverSnapshot = useMemo(
    () => JSON.stringify(completions.map((completion) => completion.id)),
    [completions],
  );
  const getServerSnapshot = useCallback(() => serverSnapshot, [serverSnapshot]);
  const storedAcknowledged = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const acknowledged = useMemo(
    () => parseAcknowledged(storedAcknowledged),
    [storedAcknowledged],
  );
  const unseen = useMemo(
    () => completions.filter((completion) => !acknowledged.has(completion.id)),
    [acknowledged, completions],
  );
  if (unseen.length === 0) return null;
  const points = unseen.reduce(
    (total, completion) => total + completion.points,
    0,
  );
  const dismiss = () => {
    const next = new Set(acknowledged);
    for (const completion of completions) next.add(completion.id);
    localStorage.setItem(storageKey, JSON.stringify([...next]));
    window.dispatchEvent(
      new CustomEvent(COMPLETION_STORAGE_EVENT, { detail: storageKey }),
    );
  };
  return (
    <aside className="mission-completion-notice" role="status">
      <CheckCircle2 aria-hidden="true" />
      <div>
        <strong>
          {unseen.length}개 미션 완료 · +{points} PTS
        </strong>
        <p>{unseen.map((completion) => completion.title).join(" · ")}</p>
      </div>
      <button type="button" onClick={dismiss} aria-label="미션 완료 알림 확인">
        <X aria-hidden="true" />
      </button>
    </aside>
  );
}
