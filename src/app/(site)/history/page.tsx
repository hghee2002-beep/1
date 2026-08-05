import type { Metadata } from "next";
import { Archive, CheckCircle2 } from "lucide-react";

import { DataState } from "@/components/ui/data-state";
import { RiotId } from "@/components/ui/riot-id";
import { SectionHeading } from "@/components/ui/section-heading";
import { getHistory } from "@/server/dashboard/read";
import { formatKstDateTime } from "@/server/dashboard/time";

export const metadata: Metadata = { title: "지난 주차" };

const KST_DATE = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "medium",
});

export default async function HistoryPage() {
  const result = await getHistory();
  return (
    <div className="page-stack">
      <SectionHeading
        eyebrow="IMMUTABLE ARCHIVE"
        title="지난 주차 · 종료 시즌"
        description="종료 당시 저장한 WeekSnapshot과 FinalStandingSnapshot만 표시하며 현재 데이터로 다시 계산하지 않습니다."
        level={1}
      />
      {result.state === "unavailable" ? (
        <DataState
          state="error"
          title="확정 기록을 불러오지 못했습니다."
          description="snapshot 원본은 변경하지 않았습니다. 데이터베이스 연결을 확인해 주세요."
        />
      ) : null}
      {result.state === "empty" ? (
        <DataState
          state="empty"
          title="확정 snapshot이 없습니다."
          description="주차 또는 시즌을 finalize하면 immutable 기록이 이곳에 추가됩니다."
        />
      ) : null}
      {result.state === "ready" ? (
        <div className="history-grid">
          {result.data.map((snapshot) => {
            const winner =
              snapshot.standings.find((row) => row.rank === 1) ??
              snapshot.standings[0];
            const missionWinner =
              snapshot.missionStandings.find((row) => row.rank === 1) ??
              snapshot.missionStandings[0];
            return (
              <article className="history-card" key={snapshot.id}>
                <header>
                  <span>
                    <Archive aria-hidden="true" />
                    {snapshot.seasonName} · {snapshot.label}
                  </span>
                  <span className="status-badge status-badge-ready">
                    <CheckCircle2 aria-hidden="true" />
                    {snapshot.kind === "FINAL" ? "시즌 확정" : "주차 확정"}
                  </span>
                </header>
                <p>
                  {KST_DATE.format(new Date(snapshot.startAt))} –{" "}
                  {KST_DATE.format(new Date(snapshot.endAt))}
                </p>
                <div>
                  <span>메인 최종 1위</span>
                  <strong>
                    {winner ? (
                      <RiotId
                        gameName={winner.gameName}
                        tagLine={winner.tagLine}
                      />
                    ) : (
                      "기록 없음"
                    )}
                  </strong>
                </div>
                <div>
                  <span>확정 메인 점수</span>
                  <strong>{winner?.score ?? 0} PTS</strong>
                </div>
                {snapshot.kind === "WEEK" ? (
                  <div>
                    <span>미션 최종 1위</span>
                    <strong>
                      {missionWinner ? (
                        <RiotId
                          gameName={missionWinner.gameName}
                          tagLine={missionWinner.tagLine}
                        />
                      ) : (
                        "기록 없음"
                      )}
                    </strong>
                  </div>
                ) : null}
                {snapshot.standings.length ? (
                  <details>
                    <summary>확정 순위 전체 보기</summary>
                    <div className="simple-table-wrap" tabIndex={0}>
                      <table className="data-table simple-table">
                        <caption className="sr-only">
                          {snapshot.label} 확정 메인 순위
                        </caption>
                        <thead>
                          <tr>
                            <th>순위</th>
                            <th>Riot ID</th>
                            <th>점수</th>
                            <th>승 · 패</th>
                          </tr>
                        </thead>
                        <tbody>
                          {snapshot.standings.map((row, index) => (
                            <tr
                              key={`${row.participantId ?? row.gameName}-${index}`}
                            >
                              <td>{row.rank}</td>
                              <th scope="row">
                                <RiotId
                                  gameName={row.gameName}
                                  tagLine={row.tagLine}
                                />
                              </th>
                              <td>{row.score} PTS</td>
                              <td>
                                {row.wins}승 {row.losses}패
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ) : (
                  <p className="empty-inline">
                    snapshot에 저장된 순위 행이 없습니다.
                  </p>
                )}
                <footer>
                  <span>
                    rules {snapshot.rulesVersion} · snapshot{" "}
                    {snapshot.checksum.slice(0, 10)}
                  </span>
                  <time dateTime={snapshot.generatedAt}>
                    {formatKstDateTime(new Date(snapshot.generatedAt))}
                  </time>
                </footer>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
