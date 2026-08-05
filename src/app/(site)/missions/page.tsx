import type { Metadata } from "next";
import { Clock3, Info, RotateCw, Zap } from "lucide-react";

import { MissionCard } from "@/components/missions/mission-card";
import { MissionCompletionNotice } from "@/components/missions/mission-completion-notice";
import { MissionRerollButton } from "@/components/missions/mission-reroll-button";
import {
  missionAssignmentToCard,
  type MissionCardView,
} from "@/components/missions/mission-view-model";
import { RiotId } from "@/components/ui/riot-id";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatStrip } from "@/components/ui/stat-strip";
import { DataState } from "@/components/ui/data-state";
import { getCurrentAuthSession } from "@/server/auth/current-session";
import {
  getMissionLeaderboard,
  getMyMissionDashboard,
} from "@/server/missions/read";

export const metadata: Metadata = { title: "주간 미션" };

function durationLabel(seconds: number) {
  if (seconds <= 0) return "사용 가능";
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.ceil((seconds % 3_600) / 60);
  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

export default async function MissionsPage() {
  const session = await getCurrentAuthSession();
  const [dashboard, leaderboard] = await Promise.all([
    session
      ? getMyMissionDashboard(session.user.id).catch(() => null)
      : Promise.resolve(null),
    getMissionLeaderboard().catch(() => null),
  ]);
  const missions: MissionCardView[] = dashboard
    ? dashboard.active.map(missionAssignmentToCard)
    : [];
  const standings = leaderboard?.standings ?? [];
  const nextCreditSeconds = dashboard?.refill.remainingSeconds ?? 0;
  return (
    <div className="page-stack">
      {dashboard ? (
        <MissionCompletionNotice
          weekId={dashboard.week.id}
          completions={dashboard.history
            .filter((assignment) => assignment.state === "COMPLETED")
            .map((assignment) => ({
              id: assignment.id,
              title: assignment.title,
              points: assignment.points,
            }))}
        />
      ) : null}
      <SectionHeading
        eyebrow={`WEEKLY OBJECTIVES · ${dashboard?.week.name ?? leaderboard?.week.name ?? "주차 없음"}`}
        title="주간 미션"
        description="경기 시작 시점에 활성인 미션만 평가하며 모든 진행도를 정확한 수치로 표시합니다."
        level={1}
      />
      <StatStrip
        label="내 미션 상태"
        items={[
          {
            label: "내 미션 순위",
            value: dashboard?.missionRank
              ? `${dashboard.missionRank}위`
              : "로그인 필요",
            note: `${dashboard?.missionScore ?? 0} PTS`,
          },
          {
            label: "활성 슬롯",
            value: `${dashboard?.active.length ?? 0} / 5`,
            note: dashboard
              ? `빈 슬롯 ${dashboard.vacancy}`
              : "본인만 조회 가능",
          },
          {
            label: "보충 크레딧",
            value: `${dashboard?.refill.credits ?? 0} / ${dashboard?.refill.maxCredits ?? 3}`,
            note: `다음 +1 · ${dashboard ? durationLabel(nextCreditSeconds) : "로그인 필요"}`,
          },
          {
            label: "리롤",
            value: dashboard
              ? durationLabel(dashboard.reroll.remainingSeconds)
              : "로그인 필요",
            note: dashboard?.reroll.remainingSeconds
              ? "후 사용 가능"
              : "지금 사용 가능",
          },
        ]}
      />
      <section aria-labelledby="active-missions-title">
        <SectionHeading
          eyebrow="MY ACTIVE 5"
          title="내 활성 미션"
          action={
            <span className="inline-status">
              <Zap aria-hidden="true" />
              보충 크레딧 {dashboard?.refill.credits ?? 0}개
            </span>
          }
        />
        <div id="active-missions-title" className="mission-grid">
          {missions.map((mission, index) => {
            const assignment = dashboard?.active[index];
            return (
              <MissionCard
                key={assignment?.id ?? mission.code}
                mission={mission}
                showAction={!assignment}
                activeLabel={
                  assignment
                    ? `활성 ${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(assignment.activeFrom))}`
                    : undefined
                }
                action={
                  assignment ? (
                    <MissionRerollButton
                      assignmentId={assignment.id}
                      cooldownSeconds={dashboard.reroll.remainingSeconds}
                    />
                  ) : undefined
                }
              />
            );
          })}
          {missions.length === 0 ? (
            <DataState
              state="empty"
              title="활성 미션은 본인만 볼 수 있습니다."
              description="로그인한 승인 참가자는 자신의 assignment와 정확한 진행도를 확인할 수 있습니다."
            />
          ) : null}
        </div>
      </section>
      <section aria-labelledby="mission-rank-title">
        <SectionHeading
          eyebrow="MISSION STANDINGS"
          title="주간 미션 순위"
          description="미션 완료 원장 점수 합계 · 공동 순위는 1, 1, 3 방식"
        />
        <div className="simple-table-wrap" tabIndex={0}>
          <table className="data-table simple-table">
            <caption className="sr-only">주간 미션 순위</caption>
            <thead>
              <tr>
                <th scope="col">순위</th>
                <th scope="col">Riot ID</th>
                <th scope="col">미션 점수</th>
                <th scope="col">완료</th>
                <th scope="col">진행 중</th>
                <th scope="col">최근 완료</th>
                <th scope="col">지난 주 대비</th>
              </tr>
            </thead>
            <tbody id="mission-rank-title">
              {standings.map((row) => (
                <tr key={row.participantWeekId}>
                  <td>
                    <span className="rank-number">{row.rank}</span>
                  </td>
                  <th scope="row">
                    <RiotId gameName={row.gameName} tagLine={row.tagLine} />
                    {row.realName ? <small>{row.realName}</small> : null}
                  </th>
                  <td className="score-cell">
                    {row.score}
                    <small>PTS</small>
                  </td>
                  <td>{row.completed}개</td>
                  <td>{row.active}개</td>
                  <td>{row.latestCompletion?.title ?? "—"}</td>
                  <td
                    className={
                      (row.rankDelta ?? 0) > 0
                        ? "metric-positive"
                        : (row.rankDelta ?? 0) < 0
                          ? "metric-negative"
                          : undefined
                    }
                  >
                    {row.rankDelta === null
                      ? "신규"
                      : row.rankDelta > 0
                        ? `▲ ${row.rankDelta}`
                        : row.rankDelta < 0
                          ? `▼ ${Math.abs(row.rankDelta)}`
                          : "—"}
                  </td>
                </tr>
              ))}
              {standings.length === 0 ? (
                <tr>
                  <td colSpan={7}>확정된 미션 원장 기록이 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <aside className="rule-callout">
        <Info aria-hidden="true" />
        <div>
          <strong>보충과 리롤은 다르게 작동합니다.</strong>
          <p>
            보충 크레딧은 6시간마다 최대 3개까지 쌓이고 빈 슬롯을 채웁니다.
            리롤은 1시간 쿨타임이며 크레딧을 쓰지 않습니다.
          </p>
        </div>
        <span>
          <Clock3 aria-hidden="true" />
          다음 보충{" "}
          {dashboard ? durationLabel(nextCreditSeconds) : "로그인 필요"}
        </span>
        <span>
          <RotateCw aria-hidden="true" />
          리롤{" "}
          {dashboard
            ? durationLabel(dashboard.reroll.remainingSeconds)
            : "로그인 필요"}
        </span>
      </aside>
    </div>
  );
}
