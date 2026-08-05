import { Check, Clock3, DatabaseZap, RotateCw } from "lucide-react";
import type { ReactNode } from "react";

import type { MissionCardView } from "@/components/missions/mission-view-model";

export function MissionCard({
  mission,
  showAction = false,
  action,
  activeLabel = "활성 8. 4. 00:00",
}: {
  mission: MissionCardView;
  showAction?: boolean;
  action?: ReactNode;
  activeLabel?: string | undefined;
}) {
  const ratio =
    mission.target <= 0
      ? mission.state === "완료"
        ? 100
        : 0
      : Math.min(100, Math.round((mission.progress / mission.target) * 100));
  return (
    <article
      className={`mission-card mission-${mission.state.replace(" ", "-")}`}
    >
      <header>
        <span className="mission-code">{mission.code}</span>
        <span className={`difficulty difficulty-${mission.difficulty}`}>
          {mission.difficulty}
        </span>
        <strong>+{mission.points} MISSION PTS</strong>
      </header>
      <div className="mission-body">
        <h3>{mission.title}</h3>
        <p>{mission.description}</p>
        {mission.evidence ? <p>최근 판정 · {mission.evidence}</p> : null}
      </div>
      <div className="mission-progress-label">
        <span>
          {mission.state === "완료" ? (
            <>
              <Check aria-hidden="true" />
              완료
            </>
          ) : mission.state === "판정 대기" ? (
            <>
              <Clock3 aria-hidden="true" />
              판정 대기
            </>
          ) : (
            "진행도"
          )}
        </span>
        <strong>
          {mission.progress.toLocaleString("ko-KR")} /{" "}
          {mission.target.toLocaleString("ko-KR")} {mission.unit}
        </strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={`${mission.title} 진행도`}
        aria-valuemin={0}
        aria-valuemax={mission.target}
        aria-valuenow={mission.progress}
      >
        <i style={{ width: `${ratio}%` }} />
      </div>
      <footer>
        <span>
          <DatabaseZap aria-hidden="true" />
          {mission.source}
        </span>
        <span>{activeLabel}</span>
        {action ??
          (showAction ? (
            <button type="button" disabled>
              <RotateCw aria-hidden="true" />
              리롤 · 37분 후
            </button>
          ) : null)}
      </footer>
    </article>
  );
}
