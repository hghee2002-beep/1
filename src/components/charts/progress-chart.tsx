"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ProgressPoint } from "@/server/dashboard/types";

export function ProgressChart({ data }: { data: ProgressPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="empty-inline">표시할 일별 점수·LP snapshot이 없습니다.</p>
    );
  }
  const first = data[0];
  const last = data.at(-1);
  return (
    <div className="chart-wrap">
      <div className="chart-legend" aria-hidden="true">
        <span className="legend-score">대회 점수</span>
        <span className="legend-lp">공식 LP 변화</span>
      </div>
      <div className="chart-canvas" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 16, right: 8, left: -24, bottom: 0 }}
            accessibilityLayer
          >
            <defs>
              <linearGradient id="score-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffbf47" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ffbf47" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="lp-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#63e6c3" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#63e6c3" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#26313d"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "#7f8b99", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#7f8b99", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#111820",
                border: "1px solid #344251",
                borderRadius: 0,
              }}
              labelStyle={{ color: "#f3f6f8" }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#ffbf47"
              strokeWidth={2}
              fill="url(#score-fill)"
              name="대회 점수"
              isAnimationActive={false}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="lp"
              stroke="#63e6c3"
              strokeWidth={2}
              fill="url(#lp-fill)"
              name="LP 변화"
              isAnimationActive={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">
        {first && last
          ? `${first.date} 대회 점수 ${first.score ?? "기록 없음"}점, LP ${first.lp ?? "기록 없음"}에서 ${last.date} 대회 점수 ${last.score ?? "기록 없음"}점, LP ${last.lp ?? "기록 없음"}까지의 추이입니다.`
          : "점수·LP 추이 데이터가 없습니다."}
      </p>
      <table className="sr-only">
        <caption>대회 점수와 공식 LP 일별 데이터</caption>
        <thead>
          <tr>
            <th>날짜</th>
            <th>대회 점수</th>
            <th>공식 LP</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.date}>
              <th scope="row">{point.date}</th>
              <td>{point.score ?? "—"}</td>
              <td>{point.lp ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
