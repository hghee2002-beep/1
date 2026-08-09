import {
  ArrowRight,
  CalendarClock,
  ChevronRight,
  Flame,
  Gamepad2,
  MoveUpRight,
  Radio,
} from "lucide-react";
import Link from "next/link";

import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { MatchTable } from "@/components/matches/match-table";
import { StatusBadge } from "@/components/system/status-badge";
import { DataState } from "@/components/ui/data-state";
import { RiotId } from "@/components/ui/riot-id";
import { SectionHeading } from "@/components/ui/section-heading";
import { getHomeDashboard } from "@/server/dashboard/read";
import {
  countdownParts,
  formatKstDateTime,
  formatRelativeKorean,
} from "@/server/dashboard/time";

export default async function HomePage() {
  const result = await getHomeDashboard();
  if (result.state !== "ready") {
    return (
      <div className="page-stack">
        <SectionHeading
          eyebrow="DELUXE SOLO QUEUE"
          title="대회 대시보드"
          level={1}
          action={
            <Link className="text-link" href="/leaderboard">
              전체 순위표 <ArrowRight aria-hidden="true" />
            </Link>
          }
        />
        <DataState
          state={result.state === "empty" ? "empty" : "error"}
          title={
            result.state === "empty"
              ? "진행 중인 대회가 없습니다."
              : "대회 데이터를 불러오지 못했습니다."
          }
          description="마지막 성공 데이터가 준비되면 이 화면에 카운트다운과 TOP 5가 표시됩니다."
        />
      </div>
    );
  }

  const data = result.data;
  const { season, week, freshness } = data.leaderboard;
  const now = new Date();
  const countdown = countdownParts(new Date(season.endAt), now);
  const leader = data.topFive[0];
  const lastSuccess = freshness.lastSuccessAt
    ? new Date(freshness.lastSuccessAt)
    : null;

  return (
    <>
      <section className="home-scoreboard" aria-labelledby="home-title">
        <div className="event-overview">
          <div className="event-status">
            <StatusBadge
              label={season.status}
              tone={week.finalized ? "neutral" : "ready"}
            />
            <span>WEEK {week.number}</span>
          </div>
          <p className="section-label">{season.name}</p>
          <h1 id="home-title">{season.eventName}</h1>
          <div
            className="countdown"
            aria-label={`대회 종료까지 ${Number(countdown.days)}일 ${Number(countdown.hours)}시간 ${Number(countdown.minutes)}분`}
          >
            <div>
              <strong>{countdown.days}</strong>
              <span>DAYS</span>
            </div>
            <i>:</i>
            <div>
              <strong>{countdown.hours}</strong>
              <span>HOURS</span>
            </div>
            <i>:</i>
            <div>
              <strong>{countdown.minutes}</strong>
              <span>MIN</span>
            </div>
          </div>
          <p className="countdown-note">
            <CalendarClock aria-hidden="true" />
            {formatKstDateTime(new Date(season.endAt))} 종료
          </p>
        </div>
        <div className="leader-signal">
          <span className="signal-rank">
            CURRENT LEADER ·{" "}
            {leader ? String(leader.rank).padStart(2, "0") : "—"}
          </span>
          {leader ? (
            <>
              <span className="leader-avatar" aria-hidden="true">
                {leader.gameName.slice(0, 1)}
              </span>
              <div>
                <RiotId gameName={leader.gameName} tagLine={leader.tagLine} />
                <span>
                  {leader.tier} {leader.division} · {leader.lp} LP
                </span>
              </div>
              <strong>
                {leader.score.toLocaleString("ko-KR")}
                <small>PTS</small>
              </strong>
              <span className="leader-streak">
                <Flame aria-hidden="true" />
                {leader.streak > 0
                  ? `${leader.streak}연승 진행 중`
                  : leader.streak < 0
                    ? `${Math.abs(leader.streak)}연패`
                    : "연속 기록 없음"}
              </span>
            </>
          ) : (
            <span>아직 집계된 참가자가 없습니다.</span>
          )}
        </div>
      </section>

      <section
        className="home-leaderboard section-block"
        aria-labelledby="top-five-title"
      >
        <SectionHeading
          eyebrow="LIVE STANDINGS"
          title="현재 TOP 5"
          action={
            <Link className="text-link" href="/leaderboard">
              전체 순위표 <ArrowRight aria-hidden="true" />
            </Link>
          }
        />
        <div id="top-five-title" className="sr-only">
          현재 TOP 5 순위
        </div>
        {data.topFive.length ? (
          <LeaderboardTable rows={data.topFive} compact />
        ) : (
          <DataState
            state="empty"
            title="집계된 순위가 없습니다."
            description="인정 경기가 반영되면 TOP 5가 표시됩니다."
          />
        )}
      </section>

      <section className="record-strip" aria-label="주요 기록">
        <article>
          <span>
            <MoveUpRight aria-hidden="true" />
            {data.highlights.lp.label}
          </span>
          {data.highlights.lp.participant ? (
            <RiotId
              gameName={data.highlights.lp.participant.gameName}
              tagLine={data.highlights.lp.participant.tagLine}
            />
          ) : (
            <strong>기록 없음</strong>
          )}
          <strong>
            {data.highlights.lp.value > 0 ? "+" : ""}
            {data.highlights.lp.value} LP
          </strong>
        </article>
        <article>
          <span>
            <Flame aria-hidden="true" />
            최다 연승
          </span>
          {data.highlights.streak.participant ? (
            <RiotId
              gameName={data.highlights.streak.participant.gameName}
              tagLine={data.highlights.streak.participant.tagLine}
            />
          ) : (
            <strong>기록 없음</strong>
          )}
          <strong>{data.highlights.streak.value}연승</strong>
        </article>
        <article>
          <span>
            <Gamepad2 aria-hidden="true" />
            {data.highlights.games.label}
          </span>
          {data.highlights.games.participant ? (
            <RiotId
              gameName={data.highlights.games.participant.gameName}
              tagLine={data.highlights.games.participant.tagLine}
            />
          ) : (
            <strong>기록 없음</strong>
          )}
          <strong>{data.highlights.games.value}게임</strong>
        </article>
      </section>

      <div className="home-columns section-block">
        <section aria-labelledby="recent-matches-title">
          <SectionHeading
            eyebrow="MATCH FEED"
            title="최근 반영 경기"
            action={
              <Link className="text-link" href="/matches">
                전체 기록 <ArrowRight aria-hidden="true" />
              </Link>
            }
          />
          <div id="recent-matches-title" className="sr-only">
            최근 반영 경기
          </div>
          {data.recentMatches.length ? (
            <MatchTable rows={data.recentMatches.slice(0, 4)} compact />
          ) : (
            <DataState
              state="empty"
              title="최근 인정 경기가 없습니다."
              description="동기화된 솔로 랭크 경기가 이곳에 표시됩니다."
            />
          )}
        </section>
        <aside className="mission-mini" aria-labelledby="mission-mini-title">
          <SectionHeading
            eyebrow="WEEKLY MISSION"
            title="미션 선두"
            action={
              <Link
                className="icon-link"
                href="/missions"
                aria-label="미션 순위 보기"
              >
                <ChevronRight aria-hidden="true" />
              </Link>
            }
          />
          <ol id="mission-mini-title">
            {data.missionLeaders.map((row) => (
              <li key={row.participantWeekId}>
                <span>{row.rank}</span>
                <RiotId gameName={row.gameName} tagLine={row.tagLine} />
                <strong>
                  {row.score}
                  <small>PTS</small>
                </strong>
              </li>
            ))}
          </ol>
          {data.missionLeaders.length === 0 ? (
            <p className="empty-inline">확정된 미션 원장 기록이 없습니다.</p>
          ) : null}
        </aside>
      </div>

      <section
        className="announcements section-block"
        aria-labelledby="announcements-title"
      >
        <SectionHeading eyebrow="NOTICE" title="운영 공지" />
        <div id="announcements-title" className="announcement-list">
          {data.announcements.map((item) => (
            <Link href="/rules" key={item.id}>
              <span>{item.pinned ? "중요" : "운영"}</span>
              <strong>{item.title}</strong>
              <time dateTime={item.publishedAt}>
                {formatKstDateTime(new Date(item.publishedAt))}
              </time>
              <ChevronRight aria-hidden="true" />
            </Link>
          ))}
        </div>
        <div className="sync-notice">
          <Radio aria-hidden="true" />
          <span>
            <strong>{freshness.stale ? "동기화 지연" : "동기화 정상"}</strong>
            {lastSuccess
              ? `마지막 성공 ${formatKstDateTime(lastSuccess)} · ${formatRelativeKorean(lastSuccess, now)}`
              : "성공 기록 없음"}
          </span>
          <StatusBadge
            label={freshness.stale ? "STALE" : "FRESH"}
            tone={freshness.stale ? "warning" : "ready"}
          />
        </div>
      </section>
    </>
  );
}
