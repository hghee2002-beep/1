import type { Metadata } from "next";
import { AlertCircle, Clock3 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AccountSettingsActions } from "@/components/account/account-settings-actions";
import { PointRevealCenter } from "@/components/draw/point-reveal-center";
import { MatchTable } from "@/components/matches/match-table";
import { MissionCard } from "@/components/missions/mission-card";
import { MissionCompletionNotice } from "@/components/missions/mission-completion-notice";
import { MissionRerollButton } from "@/components/missions/mission-reroll-button";
import { missionAssignmentToCard } from "@/components/missions/mission-view-model";
import { RiotId } from "@/components/ui/riot-id";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatStrip } from "@/components/ui/stat-strip";
import { StatusBadge } from "@/components/system/status-badge";
import { getLatestApplicationForUser } from "@/server/applications/read";
import { getCurrentAuthSession } from "@/server/auth/current-session";
import { getMyMissionDashboard } from "@/server/missions/read";
import { listMyPointDraws } from "@/server/scoring/read";
import { getParticipantProfile } from "@/server/dashboard/read";

export const metadata: Metadata = { title: "내 정보" };

const KST_DATE_TIME = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

const verificationMessage: Record<string, string> = {
  RIOT_ACCOUNT_NOT_FOUND: "Riot ID를 찾을 수 없어 관리자 재검증이 필요합니다.",
  RIOT_TEMPORARY_FAILURE:
    "Riot API가 일시적으로 응답하지 않아 재시도할 수 있습니다.",
  RIOT_RATE_LIMITED: "Riot API 요청 제한이 해제된 뒤 재검증할 수 있습니다.",
  RIOT_KEY_INVALID: "운영자가 Riot API 자격 증명을 확인해야 합니다.",
};

function durationLabel(seconds: number) {
  if (seconds <= 0) return "사용 가능";
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.ceil((seconds % 3_600) / 60);
  return hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
}

export default async function MePage() {
  const session = await getCurrentAuthSession();
  if (!session) redirect("/login?redirect=%2Fme");
  const participant = session.user.participant;
  const application = participant
    ? null
    : await getLatestApplicationForUser(session.user.id);

  if (!participant) {
    const isPending = application?.status === "PENDING";
    const isRejected = application?.status === "REJECTED";
    const verificationFailed = application?.verificationStatus === "FAILED";
    return (
      <div className="page-stack">
        <section className="me-header">
          <div>
            <p className="section-label">MY ACCOUNT</p>
            <h1>{session.user.displayName}</h1>
            <p>
              @{session.user.loginId} ·{" "}
              {isPending
                ? "참가 승인 대기"
                : isRejected
                  ? "신청 재제출 가능"
                  : "Riot ID 미연결"}
            </p>
          </div>
          <StatusBadge
            label={
              isPending ? "승인 대기" : isRejected ? "신청 거절" : "일반 회원"
            }
            tone={isPending ? "warning" : isRejected ? "loss" : "neutral"}
          />
        </section>
        {application ? (
          <section className="account-empty-state application-account-state">
            <p className="section-label">APPLICATION STATUS</p>
            <h2>
              {isPending
                ? verificationFailed
                  ? "Riot 계정 재검증이 필요합니다."
                  : "관리자 검토를 기다리고 있습니다."
                : isRejected
                  ? "이전 신청이 거절되었습니다."
                  : "신청 처리 상태를 확인하고 있습니다."}
            </h2>
            <p>
              <strong>
                {application.gameName}#{application.tagLine}
              </strong>{" "}
              ·{" "}
              {application.submittedAt
                ? KST_DATE_TIME.format(application.submittedAt)
                : "제출 시각 확인 중"}
            </p>
            {verificationFailed ? (
              <div className="application-inline-alert">
                <AlertCircle aria-hidden="true" />
                <span>
                  {verificationMessage[
                    application.verificationErrorCode ?? ""
                  ] ?? "계정 검증 결과를 다시 확인해야 합니다."}
                </span>
              </div>
            ) : null}
            {isRejected ? (
              <div className="application-inline-alert">
                <AlertCircle aria-hidden="true" />
                <span>
                  거절 사유:{" "}
                  {application.reviewReason ?? "관리자에게 문의해 주세요."}
                </span>
              </div>
            ) : null}
            <dl className="application-state-details">
              <div>
                <dt>신청 상태</dt>
                <dd>{application.status}</dd>
              </div>
              <div>
                <dt>검증 상태</dt>
                <dd>{application.verificationStatus}</dd>
              </div>
              <div>
                <dt>주 포지션</dt>
                <dd>{application.primaryPosition ?? "미선택"}</dd>
              </div>
            </dl>
            {isRejected ? (
              <Link className="button-primary" href="/apply">
                새 신청 제출
              </Link>
            ) : (
              <Link className="button-secondary" href="/apply">
                신청 화면 보기
              </Link>
            )}
          </section>
        ) : (
          <section className="account-empty-state">
            <p className="section-label">NEXT STEP</p>
            <h2>참가 신청을 시작하세요.</h2>
            <p>
              사이트 계정 인증이 완료되었습니다. Riot ID 검증과 참가 승인은 별도
              단계입니다.
            </p>
            <Link className="button-primary" href="/apply">
              Riot ID 참가 신청
            </Link>
          </section>
        )}
        <section className="account-settings">
          <SectionHeading eyebrow="ACCOUNT" title="계정 보안" />
          <AccountSettingsActions />
        </section>
      </div>
    );
  }

  const [pointDraws, missionDashboard, profileResult] = await Promise.all([
    listMyPointDraws(session.user.id),
    getMyMissionDashboard(session.user.id),
    getParticipantProfile(participant.id),
  ]);
  const profile = profileResult.state === "ready" ? profileResult.data : null;
  const latestDraw = pointDraws[0];
  const sealedCount = pointDraws.filter(
    (draw) => draw.state === "SEALED",
  ).length;
  const rerollCount = pointDraws.filter((draw) => draw.rerollEligible).length;

  return (
    <div className="page-stack">
      {missionDashboard ? (
        <MissionCompletionNotice
          weekId={missionDashboard.week.id}
          completions={missionDashboard.history
            .filter((assignment) => assignment.state === "COMPLETED")
            .map((assignment) => ({
              id: assignment.id,
              title: assignment.title,
              points: assignment.points,
            }))}
        />
      ) : null}
      <section className="me-header">
        <div>
          <p className="section-label">MY ACTION CENTER</p>
          <h1>
            <RiotId
              gameName={participant.gameName}
              tagLine={participant.tagLine}
            />
          </h1>
          <p>{session.user.displayName} · 참가 승인 계정</p>
        </div>
        <StatusBadge label="참가 승인" tone="ready" />
      </section>
      <StatStrip
        label="내 대회 상태"
        items={[
          {
            label: "현재 순위",
            value: profile?.standing.rank
              ? `${profile.standing.rank}위`
              : "집계 중",
            note: `${(profile?.standing.score ?? latestDraw?.currentScore ?? 0).toLocaleString("ko-KR")} PTS`,
          },
          {
            label: "공개 대기",
            value: `${sealedCount}건`,
            note: "점수 반영 완료",
          },
          {
            label: "재추첨 가능",
            value: `${rerollCount}건`,
            note: rerollCount ? "사용 기한 확인" : "사용 가능 결과 없음",
          },
          {
            label: "활성 미션",
            value: `${missionDashboard?.active.length ?? 0} / 5`,
            note: missionDashboard
              ? `완료 ${missionDashboard.history.filter((assignment) => assignment.state === "COMPLETED").length}`
              : "활성 주차 없음",
          },
        ]}
      />
      <PointRevealCenter initialDraws={pointDraws} />
      <section>
        <SectionHeading
          eyebrow="ACTIVE MISSIONS"
          title="내 미션 5개"
          action={
            <span className="inline-status">
              <Clock3 aria-hidden="true" />
              다음 보충{" "}
              {durationLabel(missionDashboard?.refill.remainingSeconds ?? 0)}
            </span>
          }
        />
        <div className="mission-grid">
          {missionDashboard?.active.map((assignment) => (
            <MissionCard
              key={assignment.id}
              mission={missionAssignmentToCard(assignment)}
              activeLabel={`활성 ${KST_DATE_TIME.format(new Date(assignment.activeFrom))}`}
              action={
                <MissionRerollButton
                  assignmentId={assignment.id}
                  cooldownSeconds={missionDashboard.reroll.remainingSeconds}
                />
              }
            />
          )) ?? null}
        </div>
      </section>
      <section>
        <SectionHeading eyebrow="RECENT MATCH" title="내 최근 경기" />
        {profile?.matches.length ? (
          <MatchTable rows={profile.matches} />
        ) : (
          <p className="empty-inline">최근 반영된 인정 경기가 없습니다.</p>
        )}
      </section>
      <section className="account-settings">
        <SectionHeading eyebrow="ACCOUNT" title="계정 · Riot ID" />
        <AccountSettingsActions
          participant={{
            gameName: participant.gameName,
            tagLine: participant.tagLine,
          }}
        />
      </section>
    </div>
  );
}
