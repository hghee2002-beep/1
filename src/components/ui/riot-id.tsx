import { cn } from "@/lib/utils";

type RiotIdProps = {
  gameName: string;
  tagLine: string;
  className?: string;
};

export function RiotId({ gameName, tagLine, className }: RiotIdProps) {
  const isLong = `${gameName}#${tagLine}`.length > 22;

  return (
    <span className={cn("riot-id", isLong && "riot-id-long", className)}>
      <span className="riot-game-name">{gameName}</span>
      <span className="riot-tag">#{tagLine}</span>
    </span>
  );
}
