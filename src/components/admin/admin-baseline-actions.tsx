"use client";

import { FileCheck2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ValidationResponse =
  | {
      ok: true;
      checksum: string | null;
      metadata: { name: string; demoOnly: boolean } | null;
      report: {
        valid: boolean;
        errorCount: number;
        warningCount: number;
        rowCount: number;
        requiredRowCount: number;
        issues: Array<{
          severity: "ERROR" | "WARNING";
          code: string;
          path: string;
          message: string;
        }>;
      };
    }
  | { ok: false; error: { message: string } };

export function AdminBaselineActions() {
  const router = useRouter();
  const [format, setFormat] = useState<"CSV" | "JSON">("JSON");
  const [content, setContent] = useState("");
  const [confirmationName, setConfirmationName] = useState("");
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [pending, setPending] = useState<"validate" | "publish" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function readFile(file: File | undefined) {
    if (!file) return;
    const nextFormat = file.name.toLowerCase().endsWith(".csv")
      ? "CSV"
      : "JSON";
    setFormat(nextFormat);
    setContent(await file.text());
    setValidation(null);
    setConfirmationName("");
    setMessage(null);
  }

  async function validate() {
    setPending("validate");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/mvp-baselines/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, content }),
      });
      const body = (await response.json()) as ValidationResponse;
      setValidation(body);
      if (!response.ok || !body.ok) {
        setMessage(body.ok ? "dry-run에 실패했습니다." : body.error.message);
      }
    } catch {
      setMessage("baseline dry-run 응답을 확인하지 못했습니다.");
    } finally {
      setPending(null);
    }
  }

  async function publish() {
    if (!validation?.ok || !validation.checksum || !validation.metadata) return;
    setPending("publish");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/mvp-baselines/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          content,
          expectedChecksum: validation.checksum,
          confirmationName,
        }),
      });
      const body = (await response.json()) as
        | { ok: true; baseline: { name: string } }
        | { ok: false; error: { message: string } };
      if (!response.ok || !body.ok) {
        setMessage(body.ok ? "게시하지 못했습니다." : body.error.message);
        return;
      }
      setMessage(`${body.baseline.name} baseline을 게시했습니다.`);
      setContent("");
      setConfirmationName("");
      setValidation(null);
      router.refresh();
    } catch {
      setMessage("baseline 게시 응답을 확인하지 못했습니다.");
    } finally {
      setPending(null);
    }
  }

  const valid = validation?.ok && validation.report.valid;
  return (
    <section className="admin-panel" aria-labelledby="baseline-import-title">
      <header>
        <span className="section-label" id="baseline-import-title">
          BASELINE IMPORT
        </span>
        <Upload aria-hidden="true" />
      </header>
      <p>
        CSV/JSON을 먼저 dry-run합니다. 게시 단계에서 같은 payload의 checksum과
        이름을 다시 확인합니다.
      </p>
      <label className="admin-textarea">
        <span>CSV 또는 JSON 파일</span>
        <input
          type="file"
          accept=".csv,.json,text/csv,application/json"
          onChange={(event) => void readFile(event.target.files?.[0])}
          disabled={pending !== null}
        />
      </label>
      <label className="admin-textarea">
        <span>형식</span>
        <select
          value={format}
          onChange={(event) => {
            setFormat(event.target.value === "CSV" ? "CSV" : "JSON");
            setValidation(null);
          }}
          disabled={pending !== null}
        >
          <option value="JSON">JSON</option>
          <option value="CSV">CSV</option>
        </select>
      </label>
      <label className="admin-textarea">
        <span>입력 내용</span>
        <textarea
          rows={8}
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            setValidation(null);
          }}
          placeholder="baseline payload"
          disabled={pending !== null}
        />
      </label>
      <button
        className="button-primary"
        type="button"
        onClick={() => void validate()}
        disabled={pending !== null || content.trim().length < 2}
      >
        <FileCheck2 aria-hidden="true" />
        {pending === "validate" ? "검증 중" : "dry-run 검증"}
      </button>
      {validation?.ok ? (
        <div className="baseline-validation" role="status">
          <strong>
            {validation.report.valid ? "게시 가능" : "게시 차단"} · 오류{" "}
            {validation.report.errorCount} · 경고{" "}
            {validation.report.warningCount}
          </strong>
          <small>
            {validation.report.rowCount} / {validation.report.requiredRowCount}{" "}
            rows
            {validation.metadata?.demoOnly ? " · DEMO_ONLY" : ""}
          </small>
          {validation.report.issues.length ? (
            <ul className="guardrail-list">
              {validation.report.issues.slice(0, 12).map((issue, index) => (
                <li key={`${issue.code}-${issue.path}-${index}`}>
                  {issue.severity} · {issue.code} · {issue.path}:{" "}
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {valid && validation.metadata ? (
        <>
          <label className="admin-textarea">
            <span>
              게시 확인 · <strong>{validation.metadata.name}</strong> 입력
            </span>
            <input
              value={confirmationName}
              onChange={(event) => setConfirmationName(event.target.value)}
              disabled={pending !== null}
            />
          </label>
          <button
            className="button-primary"
            type="button"
            onClick={() => void publish()}
            disabled={
              pending !== null || confirmationName !== validation.metadata.name
            }
          >
            <Upload aria-hidden="true" />
            {pending === "publish" ? "게시 중" : "immutable version 게시"}
          </button>
        </>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
