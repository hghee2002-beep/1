import type { Metadata } from "next";
import { Search } from "lucide-react";
import Link from "next/link";

import { MatchTable } from "@/components/matches/match-table";
import { DataState } from "@/components/ui/data-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { getRecentMatches } from "@/server/dashboard/read";
import type { MatchPosition } from "@/server/dashboard/types";

export const metadata: Metadata = { title: "경기 기록" };

type SearchParams = {
  q?: string | string[];
  result?: string | string[];
  champion?: string | string[];
  position?: string | string[];
  pointMin?: string | string[];
  pointMax?: string | string[];
  from?: string | string[];
  to?: string | string[];
  page?: string | string[];
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function dateValue(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : undefined;
}

const MATCH_POSITIONS: Array<{ value: MatchPosition; label: string }> = [
  { value: "TOP", label: "탑" },
  { value: "JUNGLE", label: "정글" },
  { value: "MIDDLE", label: "미드" },
  { value: "BOTTOM", label: "원거리" },
  { value: "UTILITY", label: "서포터" },
];

function positionValue(value: string | undefined): MatchPosition | undefined {
  return MATCH_POSITIONS.find((position) => position.value === value)?.value;
}

function pointValue(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= -23 && parsed <= 23
    ? parsed
    : undefined;
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = first(params.q)?.trim().slice(0, 128) ?? "";
  const champion = first(params.champion)?.trim().slice(0, 64) ?? "";
  const resultValue = first(params.result);
  const resultFilter =
    resultValue === "win" || resultValue === "loss" ? resultValue : undefined;
  const position = positionValue(first(params.position));
  const pointMin = pointValue(first(params.pointMin));
  const pointMax = pointValue(first(params.pointMax));
  const from = dateValue(first(params.from));
  const to = dateValue(first(params.to));
  const rawPage = Number(first(params.page) ?? "1");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const result = await getRecentMatches({
    ...(query ? { query } : {}),
    ...(champion ? { champion } : {}),
    ...(resultFilter ? { result: resultFilter } : {}),
    ...(position ? { position } : {}),
    ...(pointMin !== undefined ? { pointMin } : {}),
    ...(pointMax !== undefined ? { pointMax } : {}),
    ...(from ? { dateFrom: from } : {}),
    ...(to ? { dateTo: to } : {}),
    page,
    pageSize: 20,
    includeInvalid: true,
  });

  if (result.state !== "ready") {
    return (
      <div className="page-stack">
        <SectionHeading
          eyebrow="MATCH ARCHIVE"
          title="경기 기록"
          description="대회 처리 경기와 관리자 무효 표시를 함께 제공합니다."
          level={1}
        />
        <DataState
          state={result.state === "empty" ? "empty" : "error"}
          title={
            result.state === "empty"
              ? "표시할 대회가 없습니다."
              : "경기 기록을 불러오지 못했습니다."
          }
          description="마지막 성공 데이터와 데이터베이스 연결을 확인해 주세요."
        />
      </div>
    );
  }

  const data = result.data;
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  function pageHref(nextPage: number) {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (champion) next.set("champion", champion);
    if (resultFilter) next.set("result", resultFilter);
    if (position) next.set("position", position);
    if (pointMin !== undefined) next.set("pointMin", String(pointMin));
    if (pointMax !== undefined) next.set("pointMax", String(pointMax));
    if (from) next.set("from", from);
    if (to) next.set("to", to);
    next.set("page", String(nextPage));
    return `/matches?${next.toString()}`;
  }

  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow={`MATCH ARCHIVE · ${data.week.name}`}
        title="경기 기록"
        description="대회 처리 경기 · 관리자 무효 상태 표시 · Asia/Seoul 종료 시각 · 최신 경기 순"
        level={1}
      />
      <form
        className="toolbar match-toolbar"
        aria-label="경기 필터"
        method="get"
      >
        <label className="search-field">
          <Search aria-hidden="true" />
          <span className="sr-only">참가자 검색</span>
          <input
            name="q"
            type="search"
            placeholder="참가자 Riot ID"
            defaultValue={query}
          />
        </label>
        <label>
          <span className="sr-only">챔피언</span>
          <input
            name="champion"
            type="search"
            placeholder="챔피언"
            defaultValue={champion}
          />
        </label>
        <label>
          <span className="sr-only">포지션</span>
          <select name="position" defaultValue={position ?? "all"}>
            <option value="all">포지션 전체</option>
            {MATCH_POSITIONS.map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="match-point-filter">
          <span className="sr-only">최소 포인트</span>
          <input
            name="pointMin"
            type="number"
            min={-23}
            max={23}
            step={1}
            inputMode="numeric"
            placeholder="최소 PTS"
            defaultValue={pointMin ?? ""}
          />
        </label>
        <label className="match-point-filter">
          <span className="sr-only">최대 포인트</span>
          <input
            name="pointMax"
            type="number"
            min={-23}
            max={23}
            step={1}
            inputMode="numeric"
            placeholder="최대 PTS"
            defaultValue={pointMax ?? ""}
          />
        </label>
        <label>
          <span className="sr-only">승패</span>
          <select name="result" defaultValue={resultFilter ?? "all"}>
            <option value="all">승 · 패 전체</option>
            <option value="win">승리</option>
            <option value="loss">패배</option>
          </select>
        </label>
        <label>
          <span className="sr-only">시작 날짜</span>
          <input name="from" type="date" defaultValue={from} />
        </label>
        <label>
          <span className="sr-only">종료 날짜</span>
          <input name="to" type="date" defaultValue={to} />
        </label>
        <button type="submit">필터 적용</button>
        <span className="toolbar-result">총 {data.total}경기</span>
      </form>
      {data.rows.length ? (
        <MatchTable rows={data.rows} />
      ) : (
        <DataState
          state="empty"
          title="조건에 맞는 경기가 없습니다."
          description="참가자, 승패, 챔피언, 포지션, 포인트 또는 날짜 조건을 바꿔 보세요."
        />
      )}
      {pageCount > 1 ? (
        <nav className="pagination" aria-label="페이지 탐색">
          {data.page > 1 ? (
            <Link href={pageHref(data.page - 1)}>이전</Link>
          ) : (
            <span aria-disabled="true">이전</span>
          )}
          <span aria-current="page">
            {data.page} / {pageCount}
          </span>
          {data.page < pageCount ? (
            <Link href={pageHref(data.page + 1)}>다음</Link>
          ) : (
            <span aria-disabled="true">다음</span>
          )}
        </nav>
      ) : null}
      <p className="table-footnote">
        공개 화면에는 정규화한 경기 통계만 표시하며 Riot 원본 summary·timeline
        JSON은 제공하지 않습니다.
      </p>
    </div>
  );
}
