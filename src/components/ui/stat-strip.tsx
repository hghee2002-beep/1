import type { ReactNode } from "react";

export type StatItem = {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: "positive" | "negative" | "neutral";
};

export function StatStrip({
  items,
  label,
}: {
  items: StatItem[];
  label: string;
}) {
  return (
    <dl className="stat-strip" aria-label={label}>
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd className={item.tone ? `metric-${item.tone}` : undefined}>
            <strong>{item.value}</strong>
            {item.note ? <span>{item.note}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
