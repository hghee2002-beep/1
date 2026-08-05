import { Flame, ShieldAlert } from "lucide-react";

export function ResultChip({ result }: { result: "승" | "패" }) {
  return (
    <span className={`result-chip result-${result === "승" ? "win" : "loss"}`}>
      {result}
    </span>
  );
}

export function Streak({ value }: { value: number }) {
  const win = value > 0;
  return (
    <span className={`streak ${win ? "streak-win" : "streak-loss"}`}>
      {win ? <Flame aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
      {Math.abs(value)}
      {win ? "연승" : "연패"}
    </span>
  );
}

export function TierBadge({
  tier,
  division,
  lp,
}: {
  tier: string;
  division?: string;
  lp: number;
}) {
  return (
    <span className="tier-badge">
      <strong>
        {tier} {division}
      </strong>
      <span>{lp} LP</span>
    </span>
  );
}

export function ChampionMark({ champion }: { champion: string }) {
  return (
    <span
      className="champion-mark"
      role="img"
      aria-label={`${champion} 초상화 대체 이미지`}
    >
      <span aria-hidden="true">{champion.slice(0, 1)}</span>
    </span>
  );
}
