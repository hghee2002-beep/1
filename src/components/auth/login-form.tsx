"use client";

import { LockKeyhole, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormErrorSummary } from "@/components/auth/form-error-summary";
import {
  isAuthApiErrorBody,
  type AuthFieldErrors,
} from "@/features/auth/types";

function fieldDescription(
  fields: AuthFieldErrors,
  name: string,
  fallbackId?: string,
) {
  if (fields[name]?.length) return `${name}-error`;
  return fallbackId;
}

function FieldErrors({
  name,
  fields,
}: {
  name: string;
  fields: AuthFieldErrors;
}) {
  const errors = fields[name];
  if (!errors?.length) return null;
  return (
    <span id={`${name}-error`} className="field-error-list">
      {errors.map((error) => (
        <small className="field-error" key={error}>
          {error}
        </small>
      ))}
    </span>
  );
}

export function LoginForm({
  redirectTo,
  registered,
  loggedOut,
  passwordChanged,
}: {
  redirectTo: string;
  registered: boolean;
  loggedOut: boolean;
  passwordChanged: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<AuthFieldErrors>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(null);
    setFields({});

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: formData.get("loginId"),
          password: formData.get("password"),
          rememberMe: formData.get("rememberMe") === "on",
          redirectTo,
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        if (isAuthApiErrorBody(payload)) {
          setMessage(payload.error.message);
          setFields(payload.error.fields ?? {});
        } else {
          setMessage("로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
        return;
      }

      if (
        payload &&
        typeof payload === "object" &&
        "redirectTo" in payload &&
        typeof payload.redirectTo === "string"
      ) {
        router.push(payload.redirectTo);
        return;
      }
      setMessage("로그인 응답을 확인하지 못했습니다.");
    } catch {
      setMessage("네트워크 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      {registered ? (
        <p className="form-success" role="status">
          계정이 생성되었습니다. 새 자격 증명으로 로그인해 주세요.
        </p>
      ) : null}
      {loggedOut ? (
        <p className="form-success" role="status">
          안전하게 로그아웃되었습니다.
        </p>
      ) : null}
      {passwordChanged ? (
        <p className="form-success" role="status">
          비밀번호가 변경되어 모든 기기에서 로그아웃되었습니다. 새 비밀번호로
          다시 로그인해 주세요.
        </p>
      ) : null}
      <FormErrorSummary message={message} fields={fields} />
      <label htmlFor="loginId">
        <span>로그인 ID</span>
        <span className="input-shell">
          <UserRound aria-hidden="true" />
          <input
            id="loginId"
            name="loginId"
            autoComplete="username"
            placeholder="deluxe.player"
            aria-invalid={fields.loginId?.length ? true : undefined}
            aria-describedby={fieldDescription(fields, "loginId")}
            required
          />
        </span>
        <FieldErrors name="loginId" fields={fields} />
      </label>
      <label htmlFor="password">
        <span>비밀번호</span>
        <span className="input-shell">
          <LockKeyhole aria-hidden="true" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="비밀번호 입력"
            aria-invalid={fields.password?.length ? true : undefined}
            aria-describedby={fieldDescription(fields, "password")}
            required
          />
        </span>
        <FieldErrors name="password" fields={fields} />
      </label>
      <div className="form-row">
        <label className="check-label">
          <input name="rememberMe" type="checkbox" />
          30일 동안 로그인 유지
        </label>
        <span>과도한 시도는 잠시 제한됩니다.</span>
      </div>
      <button
        className="button-primary button-full"
        type="submit"
        disabled={pending}
      >
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
