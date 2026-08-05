"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function MissionRerollButton({
  assignmentId,
  cooldownSeconds,
}: {
  assignmentId: string;
  cooldownSeconds: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabled = pending || cooldownSeconds > 0;

  async function reroll() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/missions/${assignmentId}/reroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "object" &&
          body.error !== null &&
          "message" in body.error &&
          typeof body.error.message === "string"
            ? body.error.message
            : "미션을 리롤하지 못했습니다.";
        setError(message);
        return;
      }
      router.refresh();
    } catch {
      setError("네트워크 상태를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span>
      <button type="button" disabled={disabled} onClick={reroll}>
        <RotateCw aria-hidden="true" />
        {pending
          ? "교체 중"
          : cooldownSeconds > 0
            ? `리롤 · ${Math.ceil(cooldownSeconds / 60)}분 후`
            : "미션 리롤"}
      </button>
      {error ? <small role="alert">{error}</small> : null}
    </span>
  );
}
