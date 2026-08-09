import type { Metadata } from "next";
import {
  AlertTriangle,
  Check,
  CircleHelp,
  Dice5,
  LockKeyhole,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Target,
} from "lucide-react";

import { SectionHeading } from "@/components/ui/section-heading";
import { DataState } from "@/components/ui/data-state";
import { PublishedLegalDocument } from "@/components/legal/published-legal-document";
import { getPublishedRules } from "@/server/dashboard/read";
import { formatKstDateTime } from "@/server/dashboard/time";

export const metadata: Metadata = { title: "대회 규칙" };

export default async function RulesPage() {
  const result = await getPublishedRules();
  if (result.state !== "ready") {
    return (
      <article className="page-stack rules-page">
        <SectionHeading eyebrow="PUBLISHED RULES" title="대회 규칙" level={1} />
        <DataState
          state={result.state === "empty" ? "empty" : "error"}
          title={
            result.state === "empty"
              ? "게시된 대회 규칙이 없습니다."
              : "규칙을 불러오지 못했습니다."
          }
          description="운영 설정과 게시 문서는 변경 없이 유지됩니다."
        />
      </article>
    );
  }
  const { season, effectiveScoringMode, documents } = result.data;
  const probabilities =
    effectiveScoringMode === "FIXED_20" ? [20] : [17, 18, 19, 20, 21, 22, 23];
  const termsDocument = documents.find((document) => document.type === "TERMS");
  const privacyDocument = documents.find(
    (document) => document.type === "PRIVACY",
  );
  const disclaimerDocument = documents.find(
    (document) => document.type === "RIOT_DISCLAIMER",
  );
  return (
    <article className="page-stack rules-page">
      <SectionHeading
        eyebrow={`RULESET ${season.rulesVersion} · ${effectiveScoringMode}`}
        title="대회 규칙"
        level={1}
      />
      <nav className="rule-index" aria-label="규칙 목차">
        <a href="#scoring">점수</a>
        <a href="#reroll">재추첨</a>
        <a href="#missions">미션</a>
        <a href="#match">인정 경기</a>
        <a href="#terms">이용약관</a>
        <a href="#privacy">개인정보</a>
        <a href="#notice">비공식 고지</a>
      </nav>
      <section id="scoring" className="rule-section">
        <header>
          <Dice5 aria-hidden="true" />
          <div>
            <span className="section-label">01 · SCORING</span>
            <h2>승패 포인트와 공개</h2>
          </div>
        </header>
        <p>
          인정 경기마다 승리 시 양수, 패배 시 음수로{" "}
          {effectiveScoringMode === "FIXED_20" ? "20점" : "17~23점 중 하나"}가
          적용됩니다. 결과는 경기 처리 시 서버에서 확정되어 공개 전에도 순위에
          반영됩니다.
        </p>
        <div className="probability-grid">
          {probabilities.map((value) => (
            <div key={value}>
              <strong>{value}</strong>
              <span>POINTS</span>
              <small>
                {effectiveScoringMode === "FIXED_20"
                  ? "고정 모드 · 100%"
                  : "1 / 7 · 14.29%"}
              </small>
            </div>
          ))}
        </div>
        <div className="rule-note">
          <LockKeyhole aria-hidden="true" />
          <span>
            <strong>공개는 재추첨이 아닙니다.</strong>commitment와 nonce를 통해
            처음 정해진 결과를 검증할 수 있습니다. 자동 공개 기준은 경기 반영 후{" "}
            {season.autoRevealHours}시간입니다.
          </span>
        </div>
        {effectiveScoringMode !== season.scoringMode ? (
          <div className="rule-note rule-warning">
            <AlertTriangle aria-hidden="true" />
            <span>
              <strong>안전 fallback 적용 중</strong>
              운영 안전 설정에 따라 새 포인트 결과에는 FIXED_20 모드가
              적용됩니다. 기존 draw와 원장 결과는 변경하지 않습니다.
            </span>
          </div>
        ) : null}
      </section>
      <section id="reroll" className="rule-section">
        <header>
          <RotateCcw aria-hidden="true" />
          <div>
            <span className="section-label">02 · REROLL</span>
            <h2>MVP / ACE 재추첨</h2>
          </div>
        </header>
        <p>
          팀 내 대회 내부 평가 1위 참가자에게 선택권이 주어집니다. 재추첨은 한
          번만 가능하고 두 번째 값이 반드시 최종이며, 첫 값과 같거나 더 낮을 수
          있습니다.
        </p>
        <ul className="rule-list">
          <li>
            <Check aria-hidden="true" />
            기존 점수 원장 행은 수정하지 않고 차이값 조정 행을 추가합니다.
          </li>
          <li>
            <Check aria-hidden="true" />
            사용 기한은 해당 주차 종료 전까지입니다.
          </li>
          <li>
            <Check aria-hidden="true" />
            현금, 유료 재추첨, 환전 또는 베팅 요소가 없습니다.
          </li>
        </ul>
      </section>
      <section id="missions" className="rule-section">
        <header>
          <Target aria-hidden="true" />
          <div>
            <span className="section-label">03 · MISSIONS</span>
            <h2>주간 미션</h2>
          </div>
        </header>
        <p>
          개인별 활성 미션은 5개입니다. 경기 시작 시 활성 상태였던 assignment만
          그 경기에 적용하며, 진행도는 정확한 수치로 누적합니다.
        </p>
        <div className="rule-columns">
          <div>
            <strong>보충</strong>
            <p>
              6시간마다 1크레딧, 최대 3개. 빈 슬롯이 있을 때 즉시 사용합니다.
            </p>
          </div>
          <div>
            <strong>리롤</strong>
            <p>
              1시간 쿨타임. 보충 크레딧을 사용하지 않고 새 미션으로 교체합니다.
            </p>
          </div>
          <div>
            <strong>중복 방지</strong>
            <p>같은 주차에서 완료한 미션은 다시 등장하지 않습니다.</p>
          </div>
        </div>
      </section>
      <section id="match" className="rule-section">
        <header>
          <ShieldCheck aria-hidden="true" />
          <div>
            <span className="section-label">04 · MATCH ELIGIBILITY</span>
            <h2>인정 경기와 공동 순위</h2>
          </div>
        </header>
        <ul className="rule-list">
          <li>
            <Check aria-hidden="true" />
            대회 기간 안에 시작된 솔로/듀오 랭크 경기
          </li>
          <li>
            <Check aria-hidden="true" />
            기본 {Math.round(season.minGameDurationSeconds / 60)}분 이상이며
            관리자가 무효화하지 않은 경기
          </li>
          <li>
            <Check aria-hidden="true" />
            순위는 점수 → 승패 차 → 승리 수, 완전 동률은 1·1·3 공동 순위
          </li>
        </ul>
        <div className="rule-note rule-warning">
          <AlertTriangle aria-hidden="true" />
          <span>
            <strong>관리자 조정</strong>원본 삭제 대신 사유가 있는
            correction/adjustment 원장과 AuditLog를 생성합니다.
          </span>
        </div>
      </section>
      <section id="terms" className="rule-section">
        <header>
          <ScrollText aria-hidden="true" />
          <div>
            <span className="section-label">05 · TERMS</span>
            <h2>이용약관</h2>
          </div>
        </header>
        <PublishedLegalDocument
          label="이용약관"
          document={
            termsDocument
              ? {
                  ...termsDocument,
                  effectiveAtLabel: formatKstDateTime(
                    new Date(termsDocument.effectiveAt),
                  ),
                }
              : null
          }
        />
      </section>
      <section id="privacy" className="rule-section">
        <header>
          <CircleHelp aria-hidden="true" />
          <div>
            <span className="section-label">06 · PRIVACY</span>
            <h2>개인정보와 Riot 데이터</h2>
          </div>
        </header>
        <PublishedLegalDocument
          label="개인정보 처리방침"
          document={
            privacyDocument
              ? {
                  ...privacyDocument,
                  effectiveAtLabel: formatKstDateTime(
                    new Date(privacyDocument.effectiveAt),
                  ),
                }
              : null
          }
        />
      </section>
      <section id="notice" className="legal-notice">
        <PublishedLegalDocument
          label="Riot 비공식 제품 고지"
          variant="notice"
          suffix={`규칙 버전 ${season.rulesVersion}`}
          document={
            disclaimerDocument
              ? {
                  ...disclaimerDocument,
                  effectiveAtLabel: formatKstDateTime(
                    new Date(disclaimerDocument.effectiveAt),
                  ),
                }
              : null
          }
        />
      </section>
    </article>
  );
}
