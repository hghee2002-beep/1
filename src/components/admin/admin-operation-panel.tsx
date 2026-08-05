"use client";

import { FileCheck2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export type AdminOperationRow = {
  id: string;
  label: string;
  status: string;
  confirmation: string;
};

type ApiBody =
  | { ok: true; result: Record<string, unknown> }
  | {
      ok: false;
      error: { message: string; fields?: Record<string, string[]> };
    };

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function checked(form: FormData, name: string) {
  return form.get(name) === "on";
}

function numberField(form: FormData, name: string) {
  return Number(field(form, name));
}

function TargetSelect({ rows }: { rows: readonly AdminOperationRow[] }) {
  return (
    <label className="admin-field">
      <span>대상</span>
      <select name="targetId" required defaultValue="">
        <option value="" disabled>
          대상을 선택하세요
        </option>
        {rows.map((row) => (
          <option value={row.id} key={row.id}>
            {row.label} · {row.status}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReasonAndConfirmation({
  confirmationLabel = "확인 문구",
  confirmationRequired = true,
}: {
  confirmationLabel?: string;
  confirmationRequired?: boolean;
}) {
  return (
    <>
      <label className="admin-field admin-field-wide">
        <span>관리자 사유</span>
        <textarea
          name="reason"
          minLength={5}
          maxLength={500}
          rows={3}
          required
        />
      </label>
      <label className="admin-field">
        <span>{confirmationLabel}</span>
        <input name="confirmation" required={confirmationRequired} />
      </label>
    </>
  );
}

export function AdminOperationPanel({
  section,
  rows,
}: {
  section: string;
  rows: readonly AdminOperationRow[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const intent = field(form, "intent");
    const idempotencyKey = crypto.randomUUID();
    let path = "/api/admin/operations";
    let payload: Record<string, unknown>;

    if (intent === "user-role") {
      payload = {
        action: "USER_ROLE_UPDATE",
        targetId: field(form, "targetId"),
        role: field(form, "role"),
        reason: field(form, "reason"),
        confirmation: field(form, "confirmation"),
        idempotencyKey,
      };
    } else if (intent === "user-status") {
      payload = {
        action: "USER_STATUS_UPDATE",
        targetId: field(form, "targetId"),
        status: field(form, "status"),
        reason: field(form, "reason"),
        confirmation: field(form, "confirmation"),
        idempotencyKey,
      };
    } else if (intent === "participant-status") {
      payload = {
        action: "PARTICIPANT_STATUS_UPDATE",
        targetId: field(form, "targetId"),
        status: field(form, "status"),
        reason: field(form, "reason"),
        confirmation: field(form, "confirmation"),
        idempotencyKey,
      };
    } else if (intent === "season-create") {
      payload = {
        action: "SEASON_CREATE_DRAFT",
        name: field(form, "name"),
        slug: field(form, "slug"),
        startAt: field(form, "startAt"),
        endAt: field(form, "endAt"),
        weekCount: numberField(form, "weekCount"),
        scoringMode: field(form, "scoringMode"),
        minGameDurationSeconds: numberField(form, "minGameDurationSeconds"),
        autoRevealHours: numberField(form, "autoRevealHours"),
        rulesVersion: field(form, "rulesVersion"),
        reason: field(form, "reason"),
        idempotencyKey,
      };
    } else if (intent === "season-lifecycle") {
      payload = {
        action: field(form, "seasonAction"),
        targetId: field(form, "targetId"),
        dryRun: checked(form, "dryRun"),
        reason: field(form, "reason"),
        confirmation: field(form, "confirmation"),
        idempotencyKey,
      };
    } else if (intent === "score-adjustment") {
      path = "/api/admin/scoring/adjustments";
      payload = {
        participantWeekId: field(form, "targetId"),
        amount: numberField(form, "amount"),
        reason: field(form, "reason"),
        idempotencyKey,
      };
    } else if (intent === "score-reconcile") {
      path = "/api/admin/scoring/reconcile";
      const repair = checked(form, "repair");
      payload = {
        repair,
        ...(repair
          ? {
              reason: field(form, "reason"),
              confirmation: field(form, "confirmation"),
            }
          : {}),
      };
    } else if (intent === "match-state") {
      const targetId = field(form, "targetId");
      const next = field(form, "matchAction");
      path = `/api/admin/scoring/matches/${targetId}/${next}`;
      payload = {
        reason: field(form, "reason"),
        confirmation: field(form, "confirmation"),
      };
    } else if (intent === "mission-clone") {
      payload = {
        action: "MISSION_CLONE",
        targetId: field(form, "targetId"),
        reason: field(form, "reason"),
        idempotencyKey,
      };
    } else if (intent === "mission-active") {
      payload = {
        action: "MISSION_ACTIVE_UPDATE",
        targetId: field(form, "targetId"),
        active: field(form, "active") === "true",
        reason: field(form, "reason"),
        confirmation: field(form, "confirmation"),
        idempotencyKey,
      };
    } else if (intent === "mission-correct") {
      payload = {
        action: "MISSION_PROGRESS_CORRECT",
        targetId: field(form, "eventId"),
        correctedProgress: numberField(form, "correctedProgress"),
        reason: field(form, "reason"),
        confirmation: field(form, "confirmation"),
        idempotencyKey,
      };
    } else if (intent === "baseline-archive") {
      payload = {
        action: "BASELINE_ARCHIVE",
        targetId: field(form, "targetId"),
        reason: field(form, "reason"),
        confirmation: field(form, "confirmation"),
        idempotencyKey,
      };
    } else if (intent === "announcement") {
      payload = {
        action: "ANNOUNCEMENT_CREATE",
        title: field(form, "title"),
        body: field(form, "body"),
        pinned: checked(form, "pinned"),
        publish: checked(form, "publish"),
        reason: field(form, "reason"),
        idempotencyKey,
      };
    } else if (intent === "legal") {
      payload = {
        action: "LEGAL_PUBLISH",
        type: field(form, "legalType"),
        title: field(form, "title"),
        body: field(form, "body"),
        effectiveAt: field(form, "effectiveAt"),
        reason: field(form, "reason"),
        confirmation: field(form, "confirmation"),
        idempotencyKey,
      };
    } else if (intent === "export") {
      payload = {
        action: "EXPORT_CREATE",
        type: field(form, "exportType"),
        format: field(form, "format"),
        ...(field(form, "weekId") ? { weekId: field(form, "weekId") } : {}),
        reason: field(form, "reason"),
        idempotencyKey,
      };
    } else if (intent === "feature-flag") {
      payload = {
        action: "FEATURE_FLAG_UPDATE",
        key: field(form, "key"),
        enabled: field(form, "enabled") === "true",
        reason: field(form, "reason"),
        confirmation: field(form, "confirmation"),
        idempotencyKey,
      };
    } else if (intent === "outbox-retry") {
      payload = {
        action: "OUTBOX_RETRY",
        targetId: field(form, "jobId"),
        reason: field(form, "reason"),
        idempotencyKey,
      };
    } else {
      setMessage("지원하지 않는 관리자 작업입니다.");
      return;
    }

    setPending(true);
    setMessage(null);
    setDownloadId(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as ApiBody;
      if (!response.ok || !body.ok) {
        const fieldMessage =
          !body.ok && body.error.fields
            ? Object.entries(body.error.fields)
                .map(([name, messages]) => `${name}: ${messages.join(", ")}`)
                .join(" · ")
            : null;
        setMessage(
          body.ok
            ? "작업을 완료하지 못했습니다."
            : (fieldMessage ?? body.error.message),
        );
        return;
      }
      if (intent === "export" && typeof body.result.id === "string") {
        setDownloadId(body.result.id);
      }
      const duplicate =
        body.result.duplicate === true ? " · 중복 요청 재사용" : "";
      setMessage(`작업이 서버에 반영되었습니다${duplicate}.`);
      router.refresh();
    } catch {
      setMessage("관리자 작업 응답을 확인하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  let form: React.ReactNode = null;
  if (section === "users") {
    form = (
      <form className="admin-operation-form" onSubmit={submit}>
        <input type="hidden" name="intent" value="user-role" />
        <TargetSelect rows={rows} />
        <label className="admin-field">
          <span>새 권한</span>
          <select name="role">
            <option>USER</option>
            <option>ADMIN</option>
          </select>
        </label>
        <ReasonAndConfirmation confirmationLabel="대상 loginId 입력" />
        <button className="button-primary" disabled={pending}>
          권한 변경 · 세션 폐기
        </button>
      </form>
    );
  } else if (section === "user-status") {
    form = (
      <form className="admin-operation-form" onSubmit={submit}>
        <input type="hidden" name="intent" value="user-status" />
        <TargetSelect rows={rows} />
        <label className="admin-field">
          <span>새 상태</span>
          <select name="status">
            <option>ACTIVE</option>
            <option>LOCKED</option>
            <option>DISABLED</option>
          </select>
        </label>
        <ReasonAndConfirmation confirmationLabel="대상 loginId 입력" />
        <button className="button-primary" disabled={pending}>
          상태 변경 · 세션 폐기
        </button>
      </form>
    );
  } else if (section === "participants") {
    form = (
      <form className="admin-operation-form" onSubmit={submit}>
        <input type="hidden" name="intent" value="participant-status" />
        <TargetSelect rows={rows} />
        <label className="admin-field">
          <span>새 상태</span>
          <select name="status">
            <option>ACTIVE</option>
            <option>PAUSED</option>
            <option>REMOVED</option>
          </select>
        </label>
        <ReasonAndConfirmation confirmationLabel="Riot ID 전체 입력" />
        <button className="button-primary" disabled={pending}>
          참가 상태 변경
        </button>
      </form>
    );
  } else if (section === "season-create") {
    form = (
      <form className="admin-operation-form" onSubmit={submit}>
        <input type="hidden" name="intent" value="season-create" />
        <label className="admin-field">
          <span>시즌 이름</span>
          <input name="name" required />
        </label>
        <label className="admin-field">
          <span>slug</span>
          <input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
        </label>
        <label className="admin-field">
          <span>시작 ISO 8601 (+09:00)</span>
          <input
            name="startAt"
            placeholder="2026-08-10T00:00:00+09:00"
            required
          />
        </label>
        <label className="admin-field">
          <span>종료 ISO 8601 (+09:00)</span>
          <input
            name="endAt"
            placeholder="2026-08-17T00:00:00+09:00"
            required
          />
        </label>
        <label className="admin-field">
          <span>주차 수</span>
          <select name="weekCount">
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        <label className="admin-field">
          <span>점수 모드</span>
          <select name="scoringMode">
            <option>RANDOM_17_23</option>
            <option>FIXED_20</option>
          </select>
        </label>
        <label className="admin-field">
          <span>최소 경기 초</span>
          <input
            name="minGameDurationSeconds"
            type="number"
            defaultValue="600"
            min="300"
            max="3600"
            required
          />
        </label>
        <label className="admin-field">
          <span>자동 공개 시간</span>
          <input
            name="autoRevealHours"
            type="number"
            defaultValue="12"
            min="1"
            max="168"
            required
          />
        </label>
        <label className="admin-field">
          <span>규칙 version</span>
          <input name="rulesVersion" defaultValue="v1" required />
        </label>
        <label className="admin-field admin-field-wide">
          <span>생성 사유</span>
          <textarea name="reason" minLength={5} required />
        </label>
        <button className="button-primary" disabled={pending}>
          draft와 주차 생성
        </button>
      </form>
    );
  } else if (section === "seasons") {
    form = (
      <form className="admin-operation-form" onSubmit={submit}>
        <input type="hidden" name="intent" value="season-lifecycle" />
        <TargetSelect rows={rows} />
        <label className="admin-field">
          <span>작업</span>
          <select name="seasonAction">
            <option value="SEASON_VALIDATE">체크리스트 검증</option>
            <option value="SEASON_START">시작</option>
            <option value="SEASON_FINALIZE">최종 확정</option>
          </select>
        </label>
        <label className="check-label">
          <input type="checkbox" name="dryRun" defaultChecked /> 먼저 dry-run만
          실행
        </label>
        <ReasonAndConfirmation confirmationLabel="시즌 slug 입력" />
        <button className="button-primary" disabled={pending}>
          검증 후 실행
        </button>
      </form>
    );
  } else if (section === "scoring") {
    form = (
      <div className="admin-operation-split">
        <form className="admin-operation-form" onSubmit={submit}>
          <input type="hidden" name="intent" value="score-adjustment" />
          <TargetSelect rows={rows} />
          <label className="admin-field">
            <span>조정 점수</span>
            <input
              name="amount"
              type="number"
              min="-1000000"
              max="1000000"
              required
            />
          </label>
          <label className="admin-field admin-field-wide">
            <span>조정 사유</span>
            <textarea name="reason" minLength={3} required />
          </label>
          <button className="button-primary" disabled={pending}>
            ADMIN_ADJUSTMENT 추가
          </button>
        </form>
        <form className="admin-operation-form" onSubmit={submit}>
          <input type="hidden" name="intent" value="score-reconcile" />
          <label className="check-label">
            <input type="checkbox" name="repair" /> 불일치 cache 복구
          </label>
          <ReasonAndConfirmation
            confirmationLabel="복구 시 REPAIR 입력"
            confirmationRequired={false}
          />
          <button className="button-primary" disabled={pending}>
            원장 대사 실행
          </button>
        </form>
      </div>
    );
  } else if (section === "matches") {
    form = (
      <form className="admin-operation-form" onSubmit={submit}>
        <input type="hidden" name="intent" value="match-state" />
        <TargetSelect rows={rows} />
        <label className="admin-field">
          <span>작업</span>
          <select name="matchAction">
            <option value="invalidate">무효화 · reversal</option>
            <option value="reinstate">복구 · reinstatement</option>
          </select>
        </label>
        <ReasonAndConfirmation confirmationLabel="Riot Match ID 입력" />
        <button className="button-primary" disabled={pending}>
          원장 event로 상태 변경
        </button>
      </form>
    );
  } else if (section === "missions") {
    form = (
      <div className="admin-operation-split">
        <form className="admin-operation-form" onSubmit={submit}>
          <input type="hidden" name="intent" value="mission-clone" />
          <TargetSelect rows={rows} />
          <label className="admin-field admin-field-wide">
            <span>복제 사유</span>
            <textarea name="reason" minLength={5} required />
          </label>
          <button className="button-primary" disabled={pending}>
            새 inactive version 복제
          </button>
        </form>
        <form className="admin-operation-form" onSubmit={submit}>
          <input type="hidden" name="intent" value="mission-active" />
          <TargetSelect rows={rows} />
          <label className="admin-field">
            <span>게시 상태</span>
            <select name="active">
              <option value="true">ACTIVE</option>
              <option value="false">INACTIVE</option>
            </select>
          </label>
          <ReasonAndConfirmation confirmationLabel="M000 vN 입력" />
          <button className="button-primary" disabled={pending}>
            향후 배정 상태 변경
          </button>
        </form>
        <form className="admin-operation-form" onSubmit={submit}>
          <input type="hidden" name="intent" value="mission-correct" />
          <label className="admin-field">
            <span>원 판정 event UUID</span>
            <input name="eventId" required />
          </label>
          <label className="admin-field">
            <span>정정 진행도</span>
            <input
              type="number"
              step="0.000001"
              min="0"
              name="correctedProgress"
              required
            />
          </label>
          <ReasonAndConfirmation confirmationLabel="미션 코드 입력 (예: M001)" />
          <button className="button-primary" disabled={pending}>
            append-only correction 추가
          </button>
        </form>
      </div>
    );
  } else if (section === "mvp-baselines") {
    form = (
      <form className="admin-operation-form" onSubmit={submit}>
        <input type="hidden" name="intent" value="baseline-archive" />
        <TargetSelect rows={rows} />
        <ReasonAndConfirmation confirmationLabel="baseline 이름 입력" />
        <button className="button-primary" disabled={pending}>
          사용 종료 baseline 보관
        </button>
      </form>
    );
  } else if (section === "announcement") {
    form = (
      <form className="admin-operation-form" onSubmit={submit}>
        <input type="hidden" name="intent" value="announcement" />
        <label className="admin-field">
          <span>제목</span>
          <input name="title" required />
        </label>
        <label className="admin-field admin-field-wide">
          <span>본문</span>
          <textarea name="body" minLength={5} rows={6} required />
        </label>
        <label className="check-label">
          <input type="checkbox" name="pinned" /> 상단 고정
        </label>
        <label className="check-label">
          <input type="checkbox" name="publish" /> 즉시 게시
        </label>
        <label className="admin-field admin-field-wide">
          <span>작성·게시 사유</span>
          <textarea name="reason" minLength={5} required />
        </label>
        <button className="button-primary" disabled={pending}>
          공지 version 저장
        </button>
      </form>
    );
  } else if (section === "legal") {
    form = (
      <form className="admin-operation-form" onSubmit={submit}>
        <input type="hidden" name="intent" value="legal" />
        <label className="admin-field">
          <span>문서 유형</span>
          <select name="legalType">
            <option>RULES</option>
            <option>TERMS</option>
            <option>PRIVACY</option>
            <option>RIOT_DISCLAIMER</option>
          </select>
        </label>
        <label className="admin-field">
          <span>제목</span>
          <input name="title" required />
        </label>
        <label className="admin-field admin-field-wide">
          <span>본문</span>
          <textarea name="body" minLength={20} rows={8} required />
        </label>
        <label className="admin-field">
          <span>시행 ISO 8601</span>
          <input
            name="effectiveAt"
            placeholder="2026-08-10T00:00:00+09:00"
            required
          />
        </label>
        <ReasonAndConfirmation confirmationLabel="문서 유형 입력" />
        <button className="button-primary" disabled={pending}>
          새 immutable version 게시
        </button>
      </form>
    );
  } else if (section === "audit-exports") {
    form = (
      <form className="admin-operation-form" onSubmit={submit}>
        <input type="hidden" name="intent" value="export" />
        <label className="admin-field">
          <span>데이터</span>
          <select name="exportType">
            <option>PARTICIPANTS</option>
            <option>MATCHES</option>
            <option>SCORE_LEDGER</option>
            <option>MISSION_LEDGER</option>
            <option>STANDINGS</option>
            <option>FULL_ARCHIVE</option>
          </select>
        </label>
        <label className="admin-field">
          <span>형식</span>
          <select name="format">
            <option>CSV</option>
            <option>JSON</option>
          </select>
        </label>
        <label className="admin-field">
          <span>주차 UUID (선택)</span>
          <input name="weekId" />
        </label>
        <label className="admin-field admin-field-wide">
          <span>내보내기 사유</span>
          <textarea name="reason" minLength={5} required />
        </label>
        <button className="button-primary" disabled={pending}>
          안전한 export 생성
        </button>
        {downloadId ? (
          <a
            className="button-secondary"
            href={`/api/admin/exports/${downloadId}`}
          >
            생성 결과 다운로드
          </a>
        ) : null}
      </form>
    );
  } else if (section === "feature-flag") {
    form = (
      <form className="admin-operation-form" onSubmit={submit}>
        <input type="hidden" name="intent" value="feature-flag" />
        <label className="admin-field">
          <span>flag key</span>
          <input name="key" required />
        </label>
        <label className="admin-field">
          <span>상태</span>
          <select name="enabled">
            <option value="true">ENABLED</option>
            <option value="false">DISABLED</option>
          </select>
        </label>
        <ReasonAndConfirmation confirmationLabel="flag key 재입력" />
        <button className="button-primary" disabled={pending}>
          feature flag 변경
        </button>
      </form>
    );
  } else if (section === "outbox") {
    form = (
      <form className="admin-operation-form" onSubmit={submit}>
        <input type="hidden" name="intent" value="outbox-retry" />
        <label className="admin-field">
          <span>FAILED outbox UUID</span>
          <input name="jobId" required />
        </label>
        <label className="admin-field admin-field-wide">
          <span>재시도 사유</span>
          <textarea name="reason" minLength={5} required />
        </label>
        <button className="button-primary" disabled={pending}>
          PENDING으로 재등록
        </button>
      </form>
    );
  }

  if (!form) return null;
  return (
    <section
      className="admin-panel admin-operations"
      aria-labelledby={`operations-${section}`}
    >
      <header>
        <span className="section-label" id={`operations-${section}`}>
          SAFE OPERATION
        </span>
        <ShieldAlert aria-hidden="true" />
      </header>
      <p>
        서버가 권한·현재 상태·확인 문구를 다시 검증합니다. 성공 응답 전에는 표를
        바꾸지 않습니다.
      </p>
      {form}
      {message ? (
        <p className="admin-operation-message" role="status">
          <FileCheck2 aria-hidden="true" />
          {message}
        </p>
      ) : null}
    </section>
  );
}
