"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { isAuthApiErrorBody } from "@/features/auth/types";

export function AdminApplicationActions({
  applicationId,
  riotId,
  lateJoin,
  approveDisabled,
}: {
  applicationId: string;
  riotId: string;
  lateJoin: boolean;
  approveDisabled: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [acknowledgeLateJoin, setAcknowledgeLateJoin] = useState(false);
  const [pending, setPending] = useState<
    "approve" | "reject" | "verify" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);

  async function act(action: "approve" | "reject" | "verify") {
    if (pending || (action === "approve" && approveDisabled)) return;
    setPending(action);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/applications/${applicationId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "verify" ? { reason } : { reason, acknowledgeLateJoin },
          ),
        },
      );
      const payload: unknown = await response.json();
      if (!response.ok) {
        setMessage(
          isAuthApiErrorBody(payload)
            ? payload.error.message
            : "요청을 처리하지 못했습니다.",
        );
        return;
      }
      setMessage(
        action === "approve"
          ? "승인했습니다."
          : action === "reject"
            ? "거절했습니다."
            : "재검증했습니다.",
      );
      router.refresh();
    } catch {
      setMessage("네트워크 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="application-review-actions">
      <label className="admin-textarea" htmlFor={`reason-${applicationId}`}>
        <span>관리자 사유</span>
        <textarea
          id={`reason-${applicationId}`}
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="승인·거절·재검증 사유 (5자 이상)"
          disabled={Boolean(pending)}
        />
      </label>
      {lateJoin ? (
        <label className="check-label late-join-check">
          <input
            type="checkbox"
            checked={acknowledgeLateJoin}
            onChange={(event) => setAcknowledgeLateJoin(event.target.checked)}
          />
          <span>
            진행 중 시즌 중도 참가이며 신청 시점 랭크를 시작 snapshot으로
            사용함을 확인합니다.
          </span>
        </label>
      ) : null}
      {message ? (
        <p className="application-action-message" role="status">
          {message}
        </p>
      ) : null}
      <div className="application-action-buttons">
        <button
          aria-label={`${riotId} 재검증`}
          className="button-secondary"
          type="button"
          onClick={() => act("verify")}
          disabled={Boolean(pending)}
        >
          {pending === "verify" ? "재검증 중…" : "재검증"}
        </button>
        <button
          aria-label={`${riotId} 거절`}
          className="button-secondary destructive-button"
          type="button"
          onClick={() => act("reject")}
          disabled={Boolean(pending)}
        >
          {pending === "reject" ? "거절 중…" : "거절"}
        </button>
        <button
          aria-label={`${riotId} 승인`}
          className="button-primary"
          type="button"
          onClick={() => act("approve")}
          disabled={
            Boolean(pending) ||
            approveDisabled ||
            (lateJoin && !acknowledgeLateJoin)
          }
        >
          {pending === "approve" ? "승인 중…" : "승인"}
        </button>
      </div>
    </div>
  );
}
