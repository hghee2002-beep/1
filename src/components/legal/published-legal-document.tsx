import { AlertTriangle } from "lucide-react";

type PublishedLegalDocumentData = {
  title: string;
  body: string;
  version: number;
  effectiveAtLabel: string;
};

export function PublishedLegalDocument({
  label,
  document,
  variant = "section",
  suffix,
}: {
  label: string;
  document: PublishedLegalDocumentData | null;
  variant?: "section" | "notice";
  suffix?: string;
}) {
  if (!document) {
    return (
      <div className="rule-note rule-warning legal-document-missing">
        <AlertTriangle aria-hidden="true" />
        <span>
          <strong>{label} 미게시</strong>
          운영자가 효력이 있는 문서를 게시하기 전에는 해당 문서를 동의 가능한
          정책으로 안내하지 않습니다.
        </span>
      </div>
    );
  }

  return (
    <>
      <strong
        className={variant === "section" ? "legal-document-title" : undefined}
      >
        {document.title}
      </strong>
      <p className="legal-document-body">{document.body}</p>
      <span
        className={variant === "section" ? "legal-document-meta" : undefined}
      >
        문서 v{document.version} · 시행 {document.effectiveAtLabel}
        {suffix ? ` · ${suffix}` : ""}
      </span>
    </>
  );
}
