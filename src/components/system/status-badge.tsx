import { Activity, CircleAlert, LockKeyhole } from "lucide-react";

import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  label: string;
  tone?: "ready" | "neutral" | "win" | "loss" | "warning" | "stale" | "sealed";
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  const Icon =
    tone === "sealed"
      ? LockKeyhole
      : tone === "warning" || tone === "stale"
        ? CircleAlert
        : Activity;

  return (
    <span className={cn("status-badge", `status-badge-${tone}`)}>
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </span>
  );
}
