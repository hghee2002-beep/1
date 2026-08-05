import type { Metadata } from "next";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileClock,
  Gauge,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminOperationPanel } from "@/components/admin/admin-operation-panel";
import { AdminBaselineActions } from "@/components/admin/admin-baseline-actions";
import { AdminSyncActions } from "@/components/admin/admin-sync-actions";
import { AdminTableView } from "@/components/admin/admin-table-view";
import {
  adminSections,
  type AdminSectionKey,
} from "@/components/admin/sections";
import { AdminApplicationActions } from "@/components/applications/admin-application-actions";
import { StatusBadge } from "@/components/system/status-badge";
import { DataState } from "@/components/ui/data-state";
import { RiotId } from "@/components/ui/riot-id";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatStrip } from "@/components/ui/stat-strip";
import {
  adminListQuerySchema,
  type AdminListQuery,
} from "@/features/admin/validation";
import {
  getAdminDashboardReadModel,
  getAdminMvpStatusSummary,
  getAdminTableData,
  type AdminTableData,
} from "@/server/admin/read";
import { getAdminApplicationList } from "@/server/applications/read";
import {
  getRecentMvpEvaluations,
  listMvpBaselines,
} from "@/server/mvp/baseline-service";
import { getAdminSyncOverview } from "@/server/sync/read";

type AdminPageProps = {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const KST_DATE_TIME = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

function searchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function parseListQuery(searchParams: AdminPageProps["searchParams"]) {
  const values = await searchParams;
  return adminListQuerySchema.parse({
    q: searchValue(values.q),
    status: searchValue(values.status),
    page: searchValue(values.page),
    pageSize: searchValue(values.pageSize),
  });
}

export async function generateMetadata({
  params,
}: AdminPageProps): Promise<Metadata> {
  const { section } = await params;
  const key = (section?.[0] ?? "dashboard") as AdminSectionKey;
  return { title: `${adminSections[key]?.title ?? "관리자"} · 관리자` };
}

async function Dashboard() {
  const data = await getAdminDashboardReadModel();
  const seasonProgress = data.season
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((data.observedAt.getTime() - data.season.startAt.getTime()) /
              (data.season.endAt.getTime() - data.season.startAt.getTime())) *
              100,
          ),
        ),
      )
    : 0;
  return (
    <>
      <SectionHeading
        eyebrow="OPERATIONS OVERVIEW"
        title="운영 대시보드"
        description="실제 데이터의 동기화·정산·미션·baseline 상태와 최근 관리자 작업입니다."
        level={1}
        action={
          data.season ? (
            <Link className="button-primary" href="/admin/matches">
              <RefreshCw aria-hidden="true" />
              수동 동기화
            </Link>
          ) : null
        }
      />
      <StatStrip
        label="운영 요약"
        items={[
          {
            label: "승인 참가자",
            value: String(data.counts.approvedParticipants),
            note: `활성 ${data.counts.activeParticipants}`,
          },
          {
            label: "최근 24시간 경기",
            value: String(data.counts.matchesLastDay),
            note: `처리 대기 ${data.counts.pendingMatches}`,
          },
          {
            label: "공개 대기",
            value: `${data.counts.sealedDraws}건`,
            note: `후속 실패 ${data.counts.failedOutbox}`,
          },
          {
            label: "동기화 오류",
            value: `${data.counts.failedSyncItems}건`,
            note: "최근 24시간",
            ...(data.counts.failedSyncItems
              ? { tone: "negative" as const }
              : {}),
          },
        ]}
      />
      <div className="admin-dashboard-grid">
        <section className="admin-panel admin-season">
          <header>
            <span className="section-label">CURRENT SEASON</span>
            <StatusBadge
              label={data.season?.status ?? "없음"}
              tone={data.season?.status === "ACTIVE" ? "ready" : "warning"}
            />
          </header>
          {data.season ? (
            <>
              <h2>{data.season.name}</h2>
              <p>
                {KST_DATE_TIME.format(data.season.startAt)} –{" "}
                {KST_DATE_TIME.format(data.season.endAt)} · 참가자{" "}
                {data.season._count.participants}명
              </p>
              <div
                className="admin-progress"
                role="progressbar"
                aria-label={`시즌 진행률 ${seasonProgress}%`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={seasonProgress}
              >
                <i style={{ width: `${seasonProgress}%` }} />
              </div>
              <footer>
                <span>진행률 {seasonProgress}%</span>
                <Link href="/admin/seasons">시즌 관리</Link>
              </footer>
            </>
          ) : (
            <DataState
              state="empty"
              title="진행 또는 예정 시즌이 없습니다."
              description="시즌·주차 화면에서 draft를 생성하고 필수 체크를 완료하세요."
              compact
            />
          )}
        </section>
        <section className="admin-panel">
          <header>
            <span className="section-label">SYNC HEALTH</span>
            <Activity aria-hidden="true" />
          </header>
          <h2>{data.latestSync?.status ?? "실행 전"}</h2>
          <p>
            {data.latestSync
              ? `${KST_DATE_TIME.format(data.latestSync.finishedAt ?? data.latestSync.startedAt)} · 신규 ${data.latestSync.matchesProcessed} · 오류 ${data.latestSync.errorCount}`
              : "저장된 SyncRun이 없습니다."}
          </p>
          <p>Scheduler: {data.schedulerMode}</p>
          <Link className="panel-link" href="/admin/matches">
            실행 로그와 복구
          </Link>
        </section>
        <section className="admin-panel">
          <header>
            <span className="section-label">MVP BASELINE</span>
            <Gauge aria-hidden="true" />
          </header>
          <h2>{data.baseline?.name ?? "게시 기준 없음"}</h2>
          <p>
            {data.baseline
              ? `${data.baseline.demoOnly ? "DEMO_ONLY" : "non-demo"} · ${data.baseline.publishedAt ? KST_DATE_TIME.format(data.baseline.publishedAt) : "게시 시각 없음"}`
              : "MVP/ACE entitlement가 PENDING_BASELINE으로 보류됩니다."}
          </p>
          <Link className="panel-link" href="/admin/mvp-baselines">
            기준 데이터 관리
          </Link>
        </section>
        <section className="admin-panel">
          <header>
            <span className="section-label">RECENT AUDIT</span>
            <FileClock aria-hidden="true" />
          </header>
          <ul className="action-queue">
            {data.recentAudit.length ? (
              data.recentAudit.map((audit) => (
                <li key={audit.id}>
                  <span className="queue-dot queue-neutral" />
                  <div>
                    <strong>{audit.action}</strong>
                    <small>
                      {audit.actor?.loginId ?? "SYSTEM"} ·{" "}
                      {KST_DATE_TIME.format(audit.createdAt)}
                    </small>
                  </div>
                </li>
              ))
            ) : (
              <li>관리자 작업 이력이 없습니다.</li>
            )}
          </ul>
          <Link className="panel-link" href="/admin/audit-exports">
            감사 상세
          </Link>
        </section>
      </div>
      <DataState
        state={data.mockRiot ? "stale" : "empty"}
        title={
          data.mockRiot
            ? "Mock Riot adapter가 활성화되어 있습니다."
            : "실 Riot adapter 모드입니다."
        }
        description={
          data.mockRiot
            ? "실 API 연동 완료로 표시하지 않습니다. production 운영 전 자격 증명과 정책 점검이 필요합니다."
            : "실 key 값은 이 화면과 로그에 표시하지 않습니다."
        }
        compact
      />
    </>
  );
}

function applicationVerification(status: string, code: string | null) {
  if (status === "VERIFIED") return "검증 완료";
  return code ?? status;
}

function lagLabel(seconds: number) {
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}분`;
  return `${Math.floor(seconds / 3_600)}시간 ${Math.floor((seconds % 3_600) / 60)}분`;
}

async function ApplicationsSection({ query }: { query: AdminListQuery }) {
  const data = await getAdminApplicationList(query);
  const paged = data.applications;
  const table: AdminTableData = {
    columns: ["Riot ID", "신청자", "상태", "검증", "접수"],
    rows: paged.map((application) => ({
      id: application.id,
      cells: [
        `${application.gameName}#${application.tagLine}`,
        `${application.user.realName} · @${application.user.loginId}`,
        application.status,
        applicationVerification(
          application.verificationStatus,
          application.verificationErrorCode,
        ),
        application.submittedAt
          ? KST_DATE_TIME.format(application.submittedAt)
          : "-",
      ],
      status: application.status,
      confirmation: `${application.gameName}#${application.tagLine}`,
    })),
    total: data.total,
    page: query.page,
    pageSize: query.pageSize,
    statusOptions: ["DRAFT", "PENDING", "APPROVED", "REJECTED", "WITHDRAWN"],
    note: "PUUID 원문은 표시하지 않고 서버에서 승인 중복만 비교합니다.",
  };
  const reviewDisabled = !data.reviewSeason || data.seasonAmbiguous;
  return (
    <>
      <SectionHeading
        eyebrow="APPLICATION REVIEW"
        title="참가 신청"
        description="Riot 검증·PUUID 중복·중도 참가 정책을 확인한 뒤 단건 처리합니다."
        level={1}
        action={
          <span className="inline-status">
            <Clock3 aria-hidden="true" />
            {data.pendingCount}건 대기
          </span>
        }
      />
      {data.seasonAmbiguous ? (
        <DataState
          state="error"
          title="ACTIVE 시즌이 여러 개입니다."
          description="승인 시즌이 모호하므로 신청 처리를 차단했습니다."
          compact
        />
      ) : data.reviewSeason ? (
        <DataState
          state={data.lateJoin ? "stale" : "empty"}
          title={`${data.reviewSeason.name} · ${data.reviewSeason.status}`}
          description={
            data.lateJoin
              ? "중도 참가 확인과 사유가 필요합니다."
              : "승인 시 참가자·시즌·주차 상태를 한 transaction에서 생성합니다."
          }
          compact
        />
      ) : (
        <DataState
          state="error"
          title="승인 가능한 시즌이 없습니다."
          description="ACTIVE 또는 SCHEDULED 시즌을 준비하세요."
          compact
        />
      )}
      <AdminTableView section="applications" data={table} query={query} />
      <div className="admin-application-list">
        {paged
          .filter((application) => application.status === "PENDING")
          .map((application) => {
            const riotId = `${application.gameName}#${application.tagLine}`;
            return (
              <article
                className="admin-panel admin-application-card"
                key={application.id}
              >
                <header>
                  <span className="section-label">PENDING</span>
                  <StatusBadge
                    label={application.verificationStatus}
                    tone={
                      application.verificationStatus === "VERIFIED"
                        ? "ready"
                        : "warning"
                    }
                  />
                </header>
                <h2>
                  <RiotId
                    gameName={application.gameName}
                    tagLine={application.tagLine}
                  />
                </h2>
                <p>
                  {application.user.realName} · @{application.user.loginId} ·{" "}
                  {application.soloTier ?? "UNRANKED"}{" "}
                  {application.soloRank ?? ""}
                </p>
                {application.duplicate.approvedByOtherUser ? (
                  <p className="duplicate-danger">
                    <AlertTriangle aria-hidden="true" />
                    다른 계정에 승인된 PUUID
                  </p>
                ) : application.duplicate.pendingApplicationCount > 1 ? (
                  <p className="duplicate-warning">
                    <AlertTriangle aria-hidden="true" />
                    같은 PUUID 대기{" "}
                    {application.duplicate.pendingApplicationCount}건
                  </p>
                ) : (
                  <p className="duplicate-clear">
                    <CheckCircle2 aria-hidden="true" />
                    승인 참가자 중복 없음
                  </p>
                )}
                <AdminApplicationActions
                  applicationId={application.id}
                  riotId={riotId}
                  lateJoin={data.lateJoin}
                  approveDisabled={
                    reviewDisabled || application.duplicate.approvedByOtherUser
                  }
                />
              </article>
            );
          })}
      </div>
    </>
  );
}

async function MatchesSection({ query }: { query: AdminListQuery }) {
  const data = await getAdminSyncOverview();
  if (!data.season) {
    return (
      <DataState
        state="empty"
        title="동기화할 시즌이 없습니다."
        description="ACTIVE 또는 SCHEDULED 시즌을 먼저 준비하세요."
      />
    );
  }
  const runRows = data.runs
    .filter((run) => !query.status || run.status === query.status)
    .filter(
      (run) => !query.q || run.id.toLowerCase().includes(query.q.toLowerCase()),
    );
  const table: AdminTableData = {
    columns: ["실행 ID", "상태", "대상", "신규 · 건너뜀", "오류"],
    rows: runRows.map((run) => ({
      id: run.id,
      cells: [
        run.id.slice(0, 12),
        run.status,
        `${run.participantCount}명 · ID ${run.matchIdsFound}`,
        `${run.matchesProcessed} · ${run.matchesSkipped}`,
        String(run.errorCount),
      ],
      status: run.status,
      confirmation: run.id,
    })),
    total: runRows.length,
    page: 1,
    pageSize: Math.max(20, runRows.length),
    statusOptions: ["RUNNING", "SUCCEEDED", "PARTIAL", "FAILED"],
    note: `scheduler ${data.schedulerMode} · 후속 처리 ${data.pendingOutbox} · 최근 실패 ${data.recentFailures}`,
  };
  const matchRows = data.recentSeasonMatches.map((item) => ({
    id: item.id,
    label: item.match.riotMatchId,
    status: item.status,
    confirmation: item.match.riotMatchId,
  }));
  return (
    <>
      <SectionHeading
        eyebrow="MATCH PIPELINE"
        title="경기 · 동기화"
        description={`${data.season.name} · ${data.season.status} · ${data.schedulerMode}`}
        level={1}
      />
      <DataState
        state={
          data.schedulerMode === "GITHUB_SCHEDULE" ||
          data.schedulerMode === "MANUAL"
            ? "stale"
            : "empty"
        }
        title={`Scheduler · ${data.schedulerMode}`}
        description={data.schedulerNotice}
        compact
      />
      <StatStrip
        label="동기화 상태"
        items={[
          {
            label: "정산 전 경기",
            value: `${data.pendingMatchCount}건`,
            note: "PROCESSING",
          },
          {
            label: "후속 처리",
            value: `${data.pendingOutbox}건`,
            note: "점수 · MVP · 미션",
          },
          {
            label: "최근 실패",
            value: `${data.recentFailures}건`,
            note: "24시간",
            ...(data.recentFailures ? { tone: "negative" as const } : {}),
          },
          {
            label: "자동 공개 지연",
            value: `${data.processingLag.draw.pending}건`,
            note: lagLabel(data.processingLag.draw.seconds),
            ...(data.processingLag.draw.pending
              ? { tone: "negative" as const }
              : {}),
          },
          {
            label: "MVP 처리 지연",
            value: `${data.processingLag.mvp.pending}건`,
            note: lagLabel(data.processingLag.mvp.seconds),
            ...(data.processingLag.mvp.pending
              ? { tone: "negative" as const }
              : {}),
          },
          {
            label: "미션 처리 지연",
            value: `${data.processingLag.missions.pending}건`,
            note: lagLabel(data.processingLag.missions.seconds),
            ...(data.processingLag.missions.pending
              ? { tone: "negative" as const }
              : {}),
          },
        ]}
      />
      <div className="admin-detail-grid">
        <AdminSyncActions
          seasonId={data.season.id}
          participants={data.participants}
        />
        <section className="admin-panel">
          <header>
            <span className="section-label">CURSOR HEALTH</span>
            <RefreshCw aria-hidden="true" />
          </header>
          <p>활성 참가자 {data.participants.length}명</p>
          <p>
            오류 cursor{" "}
            {
              data.participants.filter(
                (participant) =>
                  (participant.cursor?.consecutiveFailures ?? 0) > 0,
              ).length
            }
            명
          </p>
          <p>
            pagination 진행{" "}
            {
              data.participants.filter(
                (participant) => (participant.cursor?.paginationStart ?? 0) > 0,
              ).length
            }
            명
          </p>
          <p>복구 가능 stale lease {data.staleLeases}건</p>
        </section>
        <section className="admin-panel">
          <header>
            <span className="section-label">OBSERVABILITY</span>
            <Activity aria-hidden="true" />
          </header>
          <p>
            마지막 성공{" "}
            {data.lastSuccess
              ? KST_DATE_TIME.format(
                  data.lastSuccess.finishedAt ?? data.lastSuccess.startedAt,
                )
              : "기록 없음"}
          </p>
          <p>
            최근 run {data.apiMetrics.durationMs}ms · Riot API{" "}
            {data.apiMetrics.apiCalls}회 · 2xx {data.apiMetrics.status2xx} · 404{" "}
            {data.apiMetrics.status404} · 429 {data.apiMetrics.status429} · 5xx{" "}
            {data.apiMetrics.status5xx}
          </p>
          <p>
            재시도 {data.apiMetrics.retries}회 · 최대 Retry-After{" "}
            {data.apiMetrics.maxRetryAfterSeconds}초
          </p>
          {data.failureItems[0] ? (
            <p className="duplicate-danger">
              <AlertTriangle aria-hidden="true" />
              최근 실패 {data.failureItems[0].stage} ·{" "}
              {data.failureItems[0].errorCode ?? "UNKNOWN"} ·{" "}
              {data.failureItems[0].retryable ? "재시도 가능" : "수동 확인"}
            </p>
          ) : (
            <p>저장된 실패 원인이 없습니다.</p>
          )}
        </section>
      </div>
      <AdminTableView
        section="matches"
        data={table}
        query={{ ...query, page: 1, pageSize: table.pageSize }}
      />
      <AdminOperationPanel section="matches" rows={matchRows} />
    </>
  );
}

async function MvpBaselinesSection() {
  const [baselines, dashboard, summary] = await Promise.all([
    listMvpBaselines(),
    getAdminDashboardReadModel(),
    getAdminMvpStatusSummary(),
  ]);
  const evaluations = dashboard.season
    ? await getRecentMvpEvaluations(dashboard.season.id)
    : [];
  const operationRows = baselines.map((baseline) => ({
    id: baseline.id,
    label: baseline.name,
    status: baseline.status,
    confirmation: baseline.name,
  }));
  return (
    <>
      <SectionHeading
        eyebrow="STANDARDIZED EVALUATION"
        title="MVP/ACE 기준"
        description="320개 metric coverage를 dry-run한 뒤 immutable version으로 게시합니다."
        level={1}
      />
      <StatStrip
        label="평가 상태"
        items={[
          {
            label: "게시 baseline",
            value: String(summary.published),
            note: `DEMO 포함 ${summary.demo}`,
          },
          {
            label: "기준 대기",
            value: String(summary.pendingBaseline),
            note: "PENDING_BASELINE",
          },
          {
            label: "데이터 대기",
            value: String(summary.pendingData),
            note: "PENDING_DATA",
          },
        ]}
      />
      {baselines.some((baseline) => baseline.demoOnly) ? (
        <DataState
          state="stale"
          title="DEMO_ONLY baseline이 포함되어 있습니다."
          description="production entitlement 지급은 차단됩니다."
          compact
        />
      ) : null}
      <div className="simple-table-wrap admin-table-wrap" tabIndex={0}>
        <table className="data-table simple-table admin-table">
          <caption className="sr-only">MVP baseline 목록</caption>
          <thead>
            <tr>
              <th>Version</th>
              <th>상태</th>
              <th>패치</th>
              <th>Metric</th>
              <th>사용</th>
            </tr>
          </thead>
          <tbody>
            {baselines.map((baseline) => (
              <tr key={baseline.id}>
                <th scope="row">
                  {baseline.name}
                  {baseline.demoOnly ? " · DEMO_ONLY" : ""}
                </th>
                <td>
                  <StatusBadge
                    label={baseline.status}
                    tone={baseline.status === "PUBLISHED" ? "ready" : "neutral"}
                  />
                </td>
                <td>
                  {baseline.patchFrom}–{baseline.patchTo}
                </td>
                <td>{baseline._count.metrics}/320</td>
                <td>
                  {baseline._count.weeks}주 · {baseline._count.evaluations}평가
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="admin-operation-split">
        <AdminBaselineActions />
        <AdminOperationPanel section="mvp-baselines" rows={operationRows} />
      </div>
      <section className="admin-panel">
        <header>
          <span className="section-label">RECENT EVALUATIONS</span>
          <Gauge aria-hidden="true" />
        </header>
        <div className="simple-table-wrap" tabIndex={0}>
          <table className="data-table simple-table">
            <thead>
              <tr>
                <th>경기</th>
                <th>상태</th>
                <th>Award</th>
                <th>Total</th>
                <th>오류</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.length ? (
                evaluations.slice(0, 20).map((evaluation) => (
                  <tr key={evaluation.id}>
                    <th scope="row">
                      {evaluation.seasonMatch.match.riotMatchId}
                    </th>
                    <td>{evaluation.status}</td>
                    <td>{evaluation.award}</td>
                    <td>
                      {evaluation.totalScore === null
                        ? "—"
                        : Number(evaluation.totalScore).toFixed(3)}
                    </td>
                    <td>{evaluation.errorCode ?? "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>저장된 평가가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function operationRows(data: AdminTableData) {
  return data.rows.map((row) => ({
    id: row.id,
    label: row.cells[0] ?? row.id,
    status: row.status,
    confirmation: row.confirmation,
  }));
}

async function GenericSection({
  sectionKey,
  query,
}: {
  sectionKey: AdminSectionKey;
  query: AdminListQuery;
}) {
  const config = adminSections[sectionKey];
  const data = await getAdminTableData(sectionKey, query);
  const rows = operationRows(data);
  return (
    <>
      <SectionHeading
        eyebrow="ADMINISTRATION"
        title={config.title}
        description={config.description}
        level={1}
      />
      <AdminTableView section={sectionKey} data={data} query={query} />
      {sectionKey === "users" ? (
        <div className="admin-operation-split">
          <AdminOperationPanel section="users" rows={rows} />
          <AdminOperationPanel section="user-status" rows={rows} />
        </div>
      ) : null}
      {sectionKey === "participants" ? (
        <AdminOperationPanel section="participants" rows={rows} />
      ) : null}
      {sectionKey === "seasons" ? (
        <div className="admin-operation-split">
          <AdminOperationPanel section="season-create" rows={[]} />
          <AdminOperationPanel section="seasons" rows={rows} />
        </div>
      ) : null}
      {sectionKey === "scoring" ? (
        <AdminOperationPanel section="scoring" rows={rows} />
      ) : null}
      {sectionKey === "missions" ? (
        <AdminOperationPanel section="missions" rows={rows} />
      ) : null}
      {sectionKey === "content" ? (
        <div className="admin-operation-split">
          <AdminOperationPanel section="announcement" rows={[]} />
          <AdminOperationPanel section="legal" rows={[]} />
        </div>
      ) : null}
      {sectionKey === "audit-exports" ? (
        <AdminOperationPanel section="audit-exports" rows={[]} />
      ) : null}
      {sectionKey === "system" ? (
        <div className="admin-operation-split">
          <AdminOperationPanel section="feature-flag" rows={[]} />
          <AdminOperationPanel section="outbox" rows={[]} />
        </div>
      ) : null}
      {sectionKey === "draws" ? (
        <DataState
          state="empty"
          title="추첨 원본 변경 작업은 제공하지 않습니다."
          description="공개·재추첨은 참가자 service가 처리하며 관리자는 commitment와 원장 연결만 검증합니다."
          compact
        />
      ) : null}
    </>
  );
}

export default async function AdminPage({
  params,
  searchParams,
}: AdminPageProps) {
  const [{ section }, query] = await Promise.all([
    params,
    parseListQuery(searchParams),
  ]);
  if (section && section.length > 1) notFound();
  const sectionKey = (section?.[0] ?? "dashboard") as AdminSectionKey;
  if (!(sectionKey in adminSections)) notFound();
  return (
    <div className="admin-page-stack">
      {sectionKey === "dashboard" ? (
        <Dashboard />
      ) : sectionKey === "applications" ? (
        <ApplicationsSection query={query} />
      ) : sectionKey === "matches" ? (
        <MatchesSection query={query} />
      ) : sectionKey === "mvp-baselines" ? (
        <MvpBaselinesSection />
      ) : (
        <GenericSection sectionKey={sectionKey} query={query} />
      )}
    </div>
  );
}
