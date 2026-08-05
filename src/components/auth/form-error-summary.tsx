"use client";

import { useEffect, useRef } from "react";

import type { AuthFieldErrors } from "@/features/auth/types";

export function FormErrorSummary({
  message,
  fields,
}: {
  message: string | null;
  fields: AuthFieldErrors;
}) {
  const summaryRef = useRef<HTMLDivElement>(null);
  const messages = [...new Set(Object.values(fields).flat())];
  const visible = Boolean(message || messages.length > 0);

  useEffect(() => {
    if (visible) summaryRef.current?.focus();
  }, [visible, message, fields]);

  if (!visible) return null;

  return (
    <div
      ref={summaryRef}
      className="form-error-summary field-wide"
      role="alert"
      tabIndex={-1}
    >
      <strong>{message ?? "입력한 내용을 확인해 주세요."}</strong>
      {messages.length > 0 ? (
        <ul>
          {messages.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
