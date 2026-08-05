import { CircleAlert, Database, RefreshCw, WifiOff } from "lucide-react";

type DataStateProps = {
  state: "empty" | "error" | "stale";
  title: string;
  description: string;
  compact?: boolean;
};

const stateIcon = {
  empty: Database,
  error: CircleAlert,
  stale: WifiOff,
};

export function DataState({
  state,
  title,
  description,
  compact = false,
}: DataStateProps) {
  const Icon = stateIcon[state];
  return (
    <div
      className={`data-state data-state-${state}${compact ? " data-state-compact" : ""}`}
      role={state === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {state !== "empty" ? (
        <RefreshCw aria-hidden="true" className="data-state-tail" />
      ) : null}
    </div>
  );
}
