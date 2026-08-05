import type { Metadata } from "next";
import { Award, Crosshair, Eye, Swords } from "lucide-react";
import { notFound } from "next/navigation";

import { ProgressChart } from "@/components/charts/progress-chart";
import { MatchTable } from "@/components/matches/match-table";
import { DataState } from "@/components/ui/data-state";
import { Streak, TierBadge } from "@/components/ui/game-bits";
import { RiotId } from "@/components/ui/riot-id";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatStrip } from "@/components/ui/stat-strip";
import { getParticipantProfile } from "@/server/dashboard/read";
import {
  formatKstDateTime,
  formatRelativeKorean,
} from "@/server/dashboard/time";

type ParticipantPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: ParticipantPageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await getParticipantProfile(id);
  return {
    title:
      result.state === "ready"
        ? `${result.data.standing.gameName}#${result.data.standing.tagLine}`
        : "참가자",
  };
}

export default async function ParticipantPage({
  params,
}: ParticipantPageProps) {
  const { id } = await params;
  const result = await getParticipantProfile(id);
  if (result.state === "empty") notFound();
  if (result.state === "unavailable") {
    return (
      <div className="page-stack">
        <SectionHeading
          eyebrow="PARTICIPANT"
          title="참가자 기록"
          description="공개 가능한 참가자 통계를 불러옵니다."
          level={1}
        />
        <DataState
          state="error"
          title="참가자 기록을 불러오지 못했습니다."
          description="데이터베이스 연결 또는 마지막 동기화 상태를 확인해 주세요."
        />
      </div>
    );
  }

  const profile = result.data;
  const participant = profile.standing;
  const games = participant.wins + participant.losses;
  const winRate =
    games === 0 ? 0 : Math.round((participant.wins / games) * 100);
  const now = new Date();
  const lastSyncedAt = profile.lastSyncedAt
    ? new Date(profile.lastSyncedAt)
    : null;

  return (
    <div className="page-stack">
      <section className="profile-hero">
        <span className="profile-emblem" aria-hidden="true">
          {participant.gameName.slice(0, 1)}
        </span>
        <div className="profile-identity">
          <p className="section-label">
            PARTICIPANT · #{participant.rank.toString().padStart(2, "0")}
          </p>
          <h1>
            <RiotId
              gameName={participant.gameName}
              tagLine={participant.tagLine}
            />
          </h1>
          <p>
            {participant.realName ?? "실명 비공개"} ·{" "}
            {lastSyncedAt
              ? `최근 동기화 ${formatKstDateTime(lastSyncedAt)} · ${formatRelativeKorean(lastSyncedAt, now)}`
              : "동기화 시각 없음"}
          </p>
        </div>
        <div className="profile-tier">
          <span>현재 솔로 랭크</span>
          <TierBadge
            tier={participant.tier}
            division={participant.division}
            lp={participant.lp}
          />
          <small>
            시작 대비{" "}
            <b>
              {participant.startLpDelta >= 0 ? "+" : ""}
              {participant.startLpDelta} LP 지표
            </b>
          </small>
          {profile.startRank ? (
            <small>
              시작 {profile.startRank.tier} {profile.startRank.division} ·{" "}
              {profile.startRank.lp} LP
            </small>
          ) : (
            <small>시작 snapshot 없음</small>
          )}
        </div>
      </section>
      <StatStrip
        label="참가자 대회 기록"
        items={[
          {
            label: "메인 점수",
            value: `${participant.score.toLocaleString("ko-KR")} PTS`,
            note: `전체 ${participant.rank}위`,
          },
          {
            label: "승 · 패",
            value: `${participant.wins}승 ${participant.losses}패`,
            note: `승률 ${winRate}%`,
          },
          {
            label: "승패 차",
            value: `${participant.wins - participant.losses > 0 ? "+" : ""}${participant.wins - participant.losses}`,
            note: `${games}경기`,
            tone:
              participant.wins - participant.losses >= 0
                ? "positive"
                : "negative",
          },
          {
            label: "현재 흐름",
            value: <Streak value={participant.streak} />,
            note: "인정 경기 기준",
          },
        ]}
      />
      <section className="profile-chart-panel" aria-labelledby="progress-title">
        <SectionHeading
          eyebrow="TOURNAMENT TRAJECTORY"
          title="대회 추이"
          description="일별 snapshot의 대회 점수와 공식 LP를 함께 표시합니다."
        />
        <div id="progress-title">
          <ProgressChart data={profile.scoreSeries} />
        </div>
      </section>
      <div className="profile-columns">
        <section aria-labelledby="profile-match-title">
          <SectionHeading eyebrow="RECENT MATCH" title="최근 경기" />
          <div id="profile-match-title">
            {profile.matches.length ? (
              <MatchTable rows={profile.matches} />
            ) : (
              <p className="empty-inline">최근 반영된 인정 경기가 없습니다.</p>
            )}
          </div>
        </section>
        <aside className="profile-stats" aria-labelledby="champion-title">
          <SectionHeading eyebrow="PLAY STYLE" title="챔피언 · 포지션" />
          <div id="champion-title" className="champion-stats">
            {profile.champions.map((champion) => (
              <div key={champion.champion}>
                <span className="profile-disc">
                  {champion.champion.slice(0, 1)}
                </span>
                <span>
                  <strong>{champion.champion}</strong>
                  <small>
                    {champion.games}경기 · {champion.wins}승
                  </small>
                </span>
                <b>{champion.averageKda} KDA</b>
              </div>
            ))}
            {profile.champions.length === 0 ? (
              <p className="empty-inline">챔피언 통계가 없습니다.</p>
            ) : null}
          </div>
          <dl className="position-bars">
            {profile.positions.map((position) => (
              <div key={position.position}>
                <dt>{position.position}</dt>
                <dd>
                  <i style={{ width: `${position.percentage}%` }} />
                </dd>
                <span>{position.percentage}%</span>
              </div>
            ))}
          </dl>
        </aside>
      </div>
      <section>
        <SectionHeading eyebrow="AWARDS & MISSIONS" title="대회 요약" />
        <div className="summary-grid">
          <article>
            <Award aria-hidden="true" />
            <span>MVP</span>
            <strong>{profile.awards.mvp}회</strong>
            <small>대회 내부 평가</small>
          </article>
          <article>
            <Eye aria-hidden="true" />
            <span>ACE</span>
            <strong>{profile.awards.ace}회</strong>
            <small>대회 내부 평가</small>
          </article>
          <article>
            <Crosshair aria-hidden="true" />
            <span>완료 미션</span>
            <strong>{profile.completedMissions.length}개</strong>
            <small>{profile.week.name}</small>
          </article>
          <article>
            <Swords aria-hidden="true" />
            <span>점수 원장</span>
            <strong>{profile.ledger.length}건</strong>
            <small>append-only</small>
          </article>
        </div>
      </section>
      <div className="profile-columns">
        <section>
          <SectionHeading eyebrow="MISSION HISTORY" title="완료 미션" />
          {profile.completedMissions.length ? (
            <div className="simple-table-wrap" tabIndex={0}>
              <table className="data-table simple-table">
                <caption className="sr-only">완료 미션 기록</caption>
                <thead>
                  <tr>
                    <th>코드</th>
                    <th>미션</th>
                    <th>점수</th>
                    <th>완료 시각</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.completedMissions.map((mission) => (
                    <tr key={mission.id}>
                      <td>{mission.code}</td>
                      <th scope="row">{mission.title}</th>
                      <td>+{mission.points} PTS</td>
                      <td>
                        {mission.completedAt
                          ? formatKstDateTime(new Date(mission.completedAt))
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <DataState
              state="empty"
              title="완료한 미션이 없습니다."
              description="활성 미션 내용은 본인 화면에서만 확인할 수 있습니다."
              compact
            />
          )}
        </section>
        <section>
          <SectionHeading
            eyebrow="SCORE LEDGER"
            title="점수 원장"
            description="현재 점수는 아래 append-only 원장 합계입니다."
          />
          {profile.ledger.length ? (
            <div className="simple-table-wrap" tabIndex={0}>
              <table className="data-table simple-table">
                <caption className="sr-only">점수 변경 원장</caption>
                <thead>
                  <tr>
                    <th>유형</th>
                    <th>증감</th>
                    <th>시각</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.ledger.map((entry) => (
                    <tr key={entry.id}>
                      <th scope="row">{entry.type}</th>
                      <td
                        className={
                          entry.amount >= 0
                            ? "metric-positive"
                            : "metric-negative"
                        }
                      >
                        {entry.amount > 0 ? "+" : ""}
                        {entry.amount} PTS
                      </td>
                      <td>{formatKstDateTime(new Date(entry.createdAt))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <DataState
              state="empty"
              title="점수 원장이 없습니다."
              description="인정 경기 또는 관리자 조정이 반영되면 이곳에 표시됩니다."
              compact
            />
          )}
        </section>
      </div>
    </div>
  );
}
