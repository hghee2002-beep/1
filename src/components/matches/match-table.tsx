"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ChampionMark, ResultChip, Streak } from "@/components/ui/game-bits";
import { RiotId } from "@/components/ui/riot-id";
import type { MatchPointDetail, MatchSummary } from "@/server/dashboard/types";

const pointStateLabels: Record<MatchPointDetail["state"], string> = {
  MISSING: "결과 없음",
  SEALED: "봉인",
  REVEALED: "공개",
  REROLLED: "재추첨 공개",
  AUTO_REVEALED: "자동 공개",
  VOID: "무효",
};

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function kstDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function PointDetail({ point }: { point: MatchPointDetail }) {
  const verificationLabel = {
    UNAVAILABLE: "검증 정보 없음",
    PENDING: "공개 후 검증 가능",
    VERIFIED: "commitment 검증 완료",
    FAILED: "commitment 검증 실패",
    VOID: "무효 처리",
  }[point.verification];

  return (
    <section className="match-detail-section">
      <div className="match-detail-title">
        {point.verification === "VERIFIED" ? (
          <ShieldCheck aria-hidden="true" />
        ) : point.verification === "FAILED" ? (
          <AlertTriangle aria-hidden="true" />
        ) : (
          <LockKeyhole aria-hidden="true" />
        )}
        <h3>포인트 · commitment</h3>
      </div>
      <dl className="match-detail-dl">
        <div>
          <dt>상태</dt>
          <dd>{pointStateLabels[point.state]}</dd>
        </div>
        <div>
          <dt>검증</dt>
          <dd
            className={
              point.verification === "FAILED" ? "metric-negative" : undefined
            }
          >
            {verificationLabel}
          </dd>
        </div>
        <div>
          <dt>최종 포인트</dt>
          <dd>
            {point.signedPoint === null
              ? "비공개"
              : `${signed(point.signedPoint)} PTS`}
          </dd>
        </div>
        <div>
          <dt>단계</dt>
          <dd>{point.phase ?? "—"}</dd>
        </div>
        <div>
          <dt>생성</dt>
          <dd>{kstDateTime(point.generatedAt)}</dd>
        </div>
        <div>
          <dt>공개</dt>
          <dd>{kstDateTime(point.revealedAt)}</dd>
        </div>
      </dl>
      {point.verification === "FAILED" ? (
        <p className="match-integrity-warning" role="alert">
          저장 결과의 무결성을 확인하지 못해 숫자와 공개 검증 nonce를
          숨겼습니다.
        </p>
      ) : null}
      {point.commitment ? (
        <dl className="match-proof-values">
          <div>
            <dt>Commitment</dt>
            <dd>
              <code>{point.commitment}</code>
            </dd>
          </div>
          {point.drawId ? (
            <div>
              <dt>Draw ID</dt>
              <dd>
                <code>{point.drawId}</code>
              </dd>
            </div>
          ) : null}
          {point.nonce ? (
            <div>
              <dt>공개 검증 nonce</dt>
              <dd>
                <code>{point.nonce}</code>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <p className="match-proof-meta">
        {point.commitmentVersion ?? "version —"} · {point.rngVersion ?? "RNG —"}
        {point.pointMode ? ` · ${point.pointMode}` : ""}
        {point.verifier
          ? ` · ${point.verifier.algorithm} · ${point.verifier.encoding}`
          : ""}
        {point.pointMode === "FIXED_20"
          ? " · 20점 확률 100%"
          : point.pointMode === "RANDOM_17_23"
            ? " · 17~23 각 값 확률 1/7"
            : ""}
      </p>
    </section>
  );
}

function MatchDetail({ match, id }: { match: MatchSummary; id: string }) {
  return (
    <div
      className="match-detail"
      id={id}
      role="region"
      aria-label={`${match.gameName} 경기 상세`}
    >
      <div className="match-detail-header">
        <div>
          <span>RIOT MATCH ID</span>
          <code>{match.riotMatchId}</code>
        </div>
        {match.invalid ? (
          <strong className="match-invalid-status">
            <AlertTriangle aria-hidden="true" /> 관리자 무효 처리
          </strong>
        ) : null}
      </div>
      <div className="match-detail-grid">
        <PointDetail point={match.details.point} />
        <section className="match-detail-section">
          <div className="match-detail-title">
            <h3>MVP · ACE 내부 평가</h3>
          </div>
          {match.details.mvp ? (
            <>
              <dl className="match-detail-dl">
                <div>
                  <dt>수상</dt>
                  <dd>{match.details.mvp.award ?? "해당 없음"}</dd>
                </div>
                <div>
                  <dt>종합 점수</dt>
                  <dd>{match.details.mvp.totalScore ?? "—"}</dd>
                </div>
                <div>
                  <dt>팀 내 순위</dt>
                  <dd>{match.details.mvp.teamRank ?? "—"}</dd>
                </div>
                <div>
                  <dt>평가 버전</dt>
                  <dd>{match.details.mvp.evaluatorVersion}</dd>
                </div>
              </dl>
              <ul
                className="match-score-groups"
                aria-label="MVP 평가 그룹 점수"
              >
                {match.details.mvp.groups.map((group) => (
                  <li key={group.key}>
                    <span>{group.label}</span>
                    <strong>{group.score ?? "—"}</strong>
                    <small>
                      {group.weight === null
                        ? "가중치 정보 없음"
                        : `가중치 ${Math.round(group.weight * 100)}%`}
                    </small>
                  </li>
                ))}
              </ul>
              {match.details.mvp.baseline ? (
                <p className="match-proof-meta">
                  {match.details.mvp.baseline.name} · 패치{" "}
                  {match.details.mvp.baseline.patchFrom}–
                  {match.details.mvp.baseline.patchTo}
                  {match.details.mvp.baseline.demoOnly ? " · DEMO_ONLY" : ""}
                </p>
              ) : null}
            </>
          ) : (
            <p className="match-detail-empty">평가 결과가 없습니다.</p>
          )}
          <p className="match-proof-meta">
            Riot 공식 지표가 아닌 대회 내부 평가입니다.
          </p>
        </section>
        <section className="match-detail-section match-mission-detail">
          <div className="match-detail-title">
            <h3>미션 진행</h3>
          </div>
          {match.details.missions.length ? (
            <ul className="match-mission-list">
              {match.details.missions.map((mission) => (
                <li key={`${mission.assignmentId}-${mission.evaluatorVersion}`}>
                  <div>
                    <strong>{mission.title}</strong>
                    <code>{mission.code}</code>
                  </div>
                  <span>
                    {mission.after} / {mission.target} {mission.unit ?? ""}
                  </span>
                  <small>
                    {signed(mission.delta)} ·{" "}
                    {mission.completed ? "완료" : "진행 중"}
                    {mission.correction ? " · 정정" : ""}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="match-detail-empty">
              이 경기에서 반영된 미션 진행이 없습니다.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

export function MatchTable({
  rows,
  compact = false,
}: {
  rows: MatchSummary[];
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);

  function toggle(id: string) {
    setExpanded((current) =>
      current.includes(id)
        ? current.filter((matchId) => matchId !== id)
        : [...current, id],
    );
  }

  return (
    <div className="match-list" role="list" aria-label="최근 경기">
      {rows.map((match) => {
        const isExpanded = expanded.includes(match.id);
        const detailId = `match-detail-${match.id}`;
        return (
          <article className="match-entry" key={match.id} role="listitem">
            <div
              className={`match-row${compact ? " match-row--compact" : ""}${match.invalid ? " match-row--invalid" : ""}`}
            >
              <div
                className={`match-result-edge ${match.result === "승" ? "edge-win" : "edge-loss"}`}
                aria-hidden="true"
              />
              <ResultChip result={match.result} />
              <ChampionMark champion={match.champion} />
              <div className="match-player">
                <Link href={`/participants/${match.participantId}`}>
                  <RiotId gameName={match.gameName} tagLine={match.tagLine} />
                </Link>
                <span>
                  {match.champion} · {match.role}
                </span>
              </div>
              {!compact ? (
                <div className="match-kda">
                  <strong>{match.kda}</strong>
                  <span>
                    {match.cs} CS · {match.duration}
                  </span>
                </div>
              ) : null}
              {!compact ? (
                <div className="match-meta">
                  <span>{match.endedAt}</span>
                  <code>{match.riotMatchId}</code>
                </div>
              ) : null}
              <div className="match-signal">
                {!compact && match.streak !== 0 ? (
                  <Streak value={match.streak} />
                ) : null}
                {match.award ? (
                  <span className="award-badge">
                    {match.award}
                    <small>대회 내부 평가</small>
                  </span>
                ) : null}
              </div>
              <div className="match-point">
                {match.invalid || match.details.point.state === "VOID" ? (
                  <span className="point-void">무효</span>
                ) : match.details.point.verification === "FAILED" ? (
                  <span className="point-failed">검증 실패</span>
                ) : match.point === null ? (
                  <span className="point-sealed">
                    <LockKeyhole aria-hidden="true" />
                    봉인
                  </span>
                ) : (
                  <strong
                    className={
                      match.point > 0 ? "metric-positive" : "metric-negative"
                    }
                  >
                    {signed(match.point)}
                    <small>PTS</small>
                  </strong>
                )}
              </div>
              {compact ? (
                <Link
                  className="icon-link"
                  href={`/participants/${match.participantId}`}
                  aria-label={`${match.gameName} 상세 보기`}
                >
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              ) : (
                <button
                  className="icon-link match-expand-button"
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={detailId}
                  aria-label={`${match.gameName} 경기 상세 ${isExpanded ? "접기" : "펼치기"}`}
                  onClick={() => toggle(match.id)}
                >
                  <ChevronDown aria-hidden="true" />
                </button>
              )}
            </div>
            {!compact && isExpanded ? (
              <MatchDetail match={match} id={detailId} />
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
