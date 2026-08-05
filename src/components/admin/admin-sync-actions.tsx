"use client";

import { Play, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SyncApiResponse =
  | {
      ok: true;
      result: {
        runId: string;
        status: string;
        matchesProcessed: number;
        errorCount: number;
        hasMore: boolean;
      };
    }
  | { ok: false; error: { message: string } };

export function AdminSyncActions({
  seasonId,
  participants,
}: {
  seasonId: string;
  participants: readonly { id: string; riotId: string }[];
}) {
  const router = useRouter();
  const [participantId, setParticipantId] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function execute() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seasonId,
          ...(participantId ? { participantId } : {}),
          dryRun,
          force: true,
          invocationKey: `admin:${crypto.randomUUID()}`,
        }),
      });
      const body = (await response.json()) as SyncApiResponse;
      if (!response.ok || !body.ok) {
        setMessage(
          body.ok ? "동기화를 실행하지 못했습니다." : body.error.message,
        );
        return;
      }
      setMessage(
        `${body.result.status} · 신규 ${body.result.matchesProcessed}건 · 오류 ${body.result.errorCount}건${body.result.hasMore ? " · 다음 batch 필요" : ""}`,
      );
      router.refresh();
    } catch {
      setMessage("동기화 응답을 확인하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="admin-panel" aria-labelledby="manual-sync-title">
      <header>
        <span className="section-label" id="manual-sync-title">
          MANUAL SYNC
        </span>
        <RefreshCw aria-hidden="true" />
      </header>
      <label className="admin-textarea">
        <span>대상 참가자</span>
        <select
          value={participantId}
          onChange={(event) => setParticipantId(event.target.value)}
          disabled={pending}
        >
          <option value="">전체 · 제한 batch</option>
          {participants.map((participant) => (
            <option key={participant.id} value={participant.id}>
              {participant.riotId}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-status">
        <input
          type="checkbox"
          checked={dryRun}
          onChange={(event) => setDryRun(event.target.checked)}
          disabled={pending}
        />
        저장 없이 조회만 실행
      </label>
      <button
        className="button-primary"
        type="button"
        onClick={execute}
        disabled={pending}
      >
        <Play aria-hidden="true" />
        {pending
          ? "동기화 중…"
          : participantId
            ? "개별 동기화"
            : "제한 batch 동기화"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
