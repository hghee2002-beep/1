import type { Metadata } from "next";
import { AlertCircle, ArrowRight, Check, Clock3 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ApplicationForm } from "@/components/applications/application-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatusBadge } from "@/components/system/status-badge";
import { getApplicationPageData } from "@/server/applications/read";
import { getCurrentAuthSession } from "@/server/auth/current-session";

export const metadata: Metadata = { title: "참가 신청" };

export default async function ApplyPage() {
  const session = await getCurrentAuthSession();
  if (!session) redirect("/login?redirect=%2Fapply");
  const data = await getApplicationPageData(session.user.id);
  if (!data) redirect("/login?redirect=%2Fapply");
  if (data.participantId) redirect("/me?application=approved");

  const latest = data.latestApplication;
  const pending = latest?.status === "PENDING";

  return (
    <div className="page-stack apply-page">
      <SectionHeading
        eyebrow="PARTICIPATION"
        title="Riot ID 참가 신청"
        description="게임 이름과 태그라인을 분리 입력하면 서버에서 계정과 솔로 랭크를 검증합니다."
        level={1}
      />
      {latest?.status === "REJECTED" ? (
        <div className="application-warning application-rejected">
          <AlertCircle aria-hidden="true" />
          <p>
            <strong>이전 신청이 거절되었습니다.</strong>{" "}
            {latest.reviewReason ?? "관리자 사유를 확인해 주세요."} 새 신청은
            이전 이력을 보존한 채 별도 기록으로 생성됩니다.
          </p>
        </div>
      ) : null}
      <div className="application-layout">
        {pending ? (
          <section className="application-form application-locked-state">
            <p className="section-label">APPLICATION PENDING</p>
            <h2>관리자 검토를 기다리고 있습니다.</h2>
            <p>
              <strong>
                {latest.gameName}#{latest.tagLine}
              </strong>{" "}
              신청은{" "}
              {latest.verificationStatus === "VERIFIED"
                ? "Riot 계정 검증을 완료했습니다."
                : "재검증이 필요합니다."}
            </p>
            <StatusBadge
              label={
                latest.verificationStatus === "VERIFIED"
                  ? "승인 대기"
                  : "검증 확인 필요"
              }
              tone={
                latest.verificationStatus === "VERIFIED" ? "warning" : "loss"
              }
            />
            <Link className="button-primary" href="/me">
              내 신청 상태 보기
            </Link>
          </section>
        ) : (
          <ApplicationForm
            defaults={{
              gameName: latest?.gameName,
              tagLine: latest?.tagLine,
              primaryPosition: latest?.primaryPosition,
              secondaryPosition: latest?.secondaryPosition,
              realNamePublic: data.realNamePublic,
            }}
          />
        )}
        <aside className="application-status">
          <p className="section-label">APPLICATION STATUS</p>
          <h2>승인 흐름</h2>
          <ol>
            <li className="is-done">
              <span>
                <Check aria-hidden="true" />
              </span>
              <div>
                <strong>사이트 계정 인증</strong>
                <small>로그인 완료</small>
              </div>
            </li>
            <li className={pending ? "is-done" : "is-current"}>
              <span>
                {pending ? (
                  <Check aria-hidden="true" />
                ) : (
                  <Clock3 aria-hidden="true" />
                )}
              </span>
              <div>
                <strong>Riot ID 검증</strong>
                <small>PUUID와 솔로 랭크 확인</small>
              </div>
            </li>
            <li className={pending ? "is-current" : undefined}>
              <span>03</span>
              <div>
                <strong>관리자 검토</strong>
                <small>PUUID 중복과 현재 랭크 확인</small>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <strong>참가 승인</strong>
                <small>시즌 참가자와 주차 상태 생성</small>
              </div>
            </li>
          </ol>
          <div className="application-warning">
            <AlertCircle aria-hidden="true" />
            <p>
              일시 장애와 존재하지 않는 계정을 구분합니다. 입력 내용은 오류
              뒤에도 화면에 유지됩니다.
            </p>
          </div>
          <Link className="text-link" href="/me">
            내 신청 상태 보기 <ArrowRight aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
