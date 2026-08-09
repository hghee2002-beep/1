import type { Metadata } from "next";
import { Download, Search } from "lucide-react";

import { LeaderboardTable } from "@/components/leaderboard/leaderboard-table";
import { StatusBadge } from "@/components/system/status-badge";
import { DataState } from "@/components/ui/data-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatStrip } from "@/components/ui/stat-strip";
import { getLeaderboard } from "@/server/dashboard/read";
import {
  formatKstDateTime,
  formatRelativeKorean,
} from "@/server/dashboard/time";

export const metadata: Metadata = { title: "전체 순위" };

type Props = {
  searchParams: Promise<{ week?: string | string[]; q?: string | string[] }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LeaderboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const weekId = first(params.week);
  const query = first(params.q)?.trim().slice(0, 128) ?? "";
  const result = await getLeaderboard(weekId);

  if (result.state !== "ready") {
    return (
      <div className="page-stack">
        <SectionHeading eyebrow="LIVE STANDINGS" title="전체 순위" level={1} />
        <DataState
          state={result.state === "empty" ? "empty" : "error"}
          title={
            result.state === "empty"
              ? "표시할 주차가 없습니다."
              : "순위 데이터를 불러오지 못했습니다."
          }
          description="데이터베이스 연결과 마지막 동기화 상태를 확인해 주세요."
        />
      </div>
    );
  }

  const data = result.data;
  const now = new Date();
  const lastSuccess = data.freshness.lastSuccessAt
    ? new Date(data.freshness.lastSuccessAt)
    : null;
  const normalizedQuery = query.toLocaleLowerCase("ko-KR");
  const rows = query
    ? data.standings.filter((row) =>
        `${row.gameName}#${row.tagLine}`
          .toLocaleLowerCase("ko-KR")
          .includes(normalizedQuery),
      )
    : data.standings;

  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow={`LIVE STANDINGS · WEEK ${data.week.number}`}
        title="전체 순위"
        description={
          lastSuccess
            ? `마지막 동기화 ${formatKstDateTime(lastSuccess)} · ${formatRelativeKorean(lastSuccess, now)}`
            : "성공한 동기화 기록 없음"
        }
        level={1}
        action={
          <>
            <StatusBadge
              label={
                data.week.finalized
                  ? "FINALIZED"
                  : data.freshness.stale
                    ? "STALE"
                    : "LIVE"
              }
              tone={
                data.week.finalized
                  ? "neutral"
                  : data.freshness.stale
                    ? "stale"
                    : "ready"
              }
            />
            <button className="button-secondary" type="button" disabled>
              <Download aria-hidden="true" />
              CSV · 준비 중
            </button>
          </>
        }
      />
      <StatStrip
        label="순위 요약"
        items={[
          {
            label: "참가자",
            value: `${data.summary.participants}명`,
            note: "승인 참가자",
          },
          {
            label: "반영 경기",
            value: `${data.summary.matches}`,
            note: data.week.name,
          },
          {
            label: "미공개 결과",
            value: `${data.summary.sealed}건`,
            note: "점수 반영 완료",
          },
          {
            label: "평균 승률",
            value: `${data.summary.averageWinRate}%`,
            note: "선택 주차",
          },
        ]}
      />
      <form className="toolbar" aria-label="순위표 필터" method="get">
        <label className="search-field">
          <Search aria-hidden="true" />
          <span className="sr-only">Riot ID 검색</span>
          <input
            name="q"
            type="search"
            placeholder="Riot ID 검색"
            defaultValue={query}
          />
        </label>
        <label>
          <span className="sr-only">주차</span>
          <select name="week" defaultValue={data.week.id}>
            {data.weeks.map((week) => (
              <option key={week.id} value={week.id}>
                {week.name}
                {week.id === data.week.id ? " · 선택" : ""}
                {week.finalized ? " · 확정" : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">조회</button>
      </form>
      {rows.length ? (
        <LeaderboardTable rows={rows} />
      ) : (
        <DataState
          state="empty"
          title="검색 결과가 없습니다."
          description="Riot ID의 gameName 또는 tagLine을 확인해 주세요."
        />
      )}
    </div>
  );
}
