"use client";

import {
  ChevronDown,
  ChevronUp,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { Streak, TierBadge } from "@/components/ui/game-bits";
import { RiotId } from "@/components/ui/riot-id";
import type { StandingRow } from "@/server/dashboard/types";

function TrendIcon({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  if (current < previous)
    return (
      <span className="rank-change rank-up">
        <TrendingUp aria-hidden="true" />
        {previous - current}
      </span>
    );
  if (current > previous)
    return (
      <span className="rank-change rank-down">
        <TrendingDown aria-hidden="true" />
        {current - previous}
      </span>
    );
  return (
    <span className="rank-change rank-same">
      <Minus aria-hidden="true" />
      <span className="sr-only">변동 없음</span>
    </span>
  );
}

function RecentForm({ results }: { results: Array<"W" | "L"> }) {
  return (
    <span
      className="recent-form"
      role="img"
      aria-label={`최근 경기 ${results.map((item) => (item === "W" ? "승" : "패")).join(", ")}`}
    >
      {results.map((item, index) => (
        <i
          key={`${item}-${index}`}
          className={item === "W" ? "form-win" : "form-loss"}
        >
          {item === "W" ? "승" : "패"}
        </i>
      ))}
    </span>
  );
}

export function LeaderboardTable({
  rows,
  compact = false,
}: {
  rows: StandingRow[];
  compact?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const toggle = (id: string) =>
    setExpanded((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

  return (
    <div
      className={`table-frame${scrolled ? " is-scrolled" : ""}`}
      data-hydrated={hydrated ? "true" : undefined}
    >
      <div
        className="table-scroll"
        onScroll={(event) => setScrolled(event.currentTarget.scrollLeft > 2)}
      >
        <table
          className={`data-table leaderboard-table${compact ? " leaderboard-compact" : ""}`}
        >
          <caption className="sr-only">
            2026 서머 주차 메인 순위. 순위, Riot ID, 점수 순으로 제공됩니다.
          </caption>
          <thead>
            <tr>
              <th className="sticky-rank" scope="col">
                순위
              </th>
              <th className="sticky-player" scope="col">
                Riot ID
              </th>
              <th className="align-right" scope="col">
                점수
              </th>
              <th className="align-center" scope="col">
                승패 차
              </th>
              <th className="optional-col" scope="col">
                승 / 패
              </th>
              <th className="optional-col" scope="col">
                승률
              </th>
              <th className="optional-col" scope="col">
                현재 랭크
              </th>
              <th className="optional-col" scope="col">
                시작 대비 LP
              </th>
              <th className="optional-col" scope="col">
                최근 흐름
              </th>
              <th className="optional-col" scope="col">
                연속 기록
              </th>
              <th className="optional-col" scope="col">
                어제 대비
              </th>
              <th className="optional-col" scope="col">
                미공개
              </th>
              <th className="expand-heading" scope="col">
                <span className="sr-only">상세 정보</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const open = expanded.includes(row.id);
              const games = row.wins + row.losses;
              const winRate =
                games === 0 ? 0 : Math.round((row.wins / games) * 100);
              return [
                <tr
                  key={row.id}
                  className={row.rank <= 3 ? "podium-row" : undefined}
                >
                  <td className="sticky-rank">
                    <span className={`rank-number rank-${row.rank}`}>
                      {row.rank}
                    </span>
                  </td>
                  <th className="sticky-player" scope="row">
                    <Link
                      className="player-cell"
                      href={`/participants/${row.id}`}
                    >
                      <span className="profile-disc" aria-hidden="true">
                        {row.gameName.slice(0, 1)}
                      </span>
                      <span>
                        <RiotId gameName={row.gameName} tagLine={row.tagLine} />
                        {row.realName ? (
                          <small>{row.realName}</small>
                        ) : (
                          <small>실명 비공개</small>
                        )}
                      </span>
                    </Link>
                  </th>
                  <td className="score-cell align-right">
                    {row.score.toLocaleString("ko-KR")}
                    <small>PTS</small>
                  </td>
                  <td
                    className={`align-center diff-cell ${row.wins - row.losses >= 0 ? "metric-positive" : "metric-negative"}`}
                  >
                    {row.wins - row.losses > 0 ? "+" : ""}
                    {row.wins - row.losses}
                  </td>
                  <td className="optional-col">
                    <span className="record-pair">
                      <b>{row.wins}승</b>
                      <span>{row.losses}패</span>
                    </span>
                  </td>
                  <td className="optional-col">{winRate}%</td>
                  <td className="optional-col">
                    <TierBadge
                      tier={row.tier}
                      division={row.division}
                      lp={row.lp}
                    />
                  </td>
                  <td
                    className={`optional-col ${row.startLpDelta >= 0 ? "metric-positive" : "metric-negative"}`}
                  >
                    {row.startLpDelta >= 0 ? "+" : ""}
                    {row.startLpDelta} LP
                  </td>
                  <td className="optional-col">
                    <RecentForm results={row.recent} />
                  </td>
                  <td className="optional-col">
                    <Streak value={row.streak} />
                  </td>
                  <td className="optional-col">
                    <TrendIcon current={row.rank} previous={row.previousRank} />
                  </td>
                  <td className="optional-col">
                    {row.sealed ? (
                      <span className="sealed-count">{row.sealed}건</span>
                    ) : (
                      <span className="muted-value">—</span>
                    )}
                  </td>
                  <td className="expand-cell">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`row-detail-${row.id}`}
                      onClick={() => toggle(row.id)}
                    >
                      {open ? (
                        <ChevronUp aria-hidden="true" />
                      ) : (
                        <ChevronDown aria-hidden="true" />
                      )}
                      <span className="sr-only">
                        {row.gameName} 부가 정보 {open ? "접기" : "펼치기"}
                      </span>
                    </button>
                  </td>
                </tr>,
                open ? (
                  <tr
                    className="expanded-row"
                    key={`${row.id}-expanded`}
                    id={`row-detail-${row.id}`}
                  >
                    <td colSpan={13}>
                      <dl>
                        <div>
                          <dt>승 / 패</dt>
                          <dd>
                            {row.wins}승 {row.losses}패 · 승률 {winRate}%
                          </dd>
                        </div>
                        <div>
                          <dt>현재 랭크</dt>
                          <dd>
                            {row.tier} {row.division} · {row.lp} LP
                          </dd>
                        </div>
                        <div>
                          <dt>최근 흐름</dt>
                          <dd>
                            <RecentForm results={row.recent} />
                          </dd>
                        </div>
                        <div>
                          <dt>연속 기록</dt>
                          <dd>
                            <Streak value={row.streak} />
                          </dd>
                        </div>
                      </dl>
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
