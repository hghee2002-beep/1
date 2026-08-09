"use client";

import { BadgeCheck, LockKeyhole, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormErrorSummary } from "@/components/auth/form-error-summary";
import {
  isAuthApiErrorBody,
  type AuthFieldErrors,
} from "@/features/auth/types";

function describedBy(fields: AuthFieldErrors, name: string) {
  const ids = [fields[name]?.length ? `${name}-error` : undefined].filter(
    (value): value is string => Boolean(value),
  );
  return ids.length ? ids.join(" ") : undefined;
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

export function SignupForm() {
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
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: formData.get("loginId"),
          displayName: formData.get("displayName"),
          password: formData.get("password"),
          passwordConfirm: formData.get("passwordConfirm"),
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        if (isAuthApiErrorBody(payload)) {
          setMessage(payload.error.message);
          setFields(payload.error.fields ?? {});
        } else {
          setMessage("계정을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
        return;
      }

      router.replace("/login?registered=1");
    } catch {
      setMessage("네트워크 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form auth-form-grid" onSubmit={submit} noValidate>
      <FormErrorSummary message={message} fields={fields} />
      <label className="field-wide" htmlFor="loginId">
        <span>로그인 ID</span>
        <span className="input-shell">
          <UserRound aria-hidden="true" />
          <input
            id="loginId"
            name="loginId"
            autoComplete="username"
            placeholder="영문 소문자·숫자 4–32자"
            aria-invalid={fields.loginId?.length ? true : undefined}
            aria-describedby={describedBy(fields, "loginId")}
            required
          />
        </span>
        <FieldErrors name="loginId" fields={fields} />
      </label>
      <label className="field-wide" htmlFor="displayName">
        <span>표시 이름</span>
        <span className="input-shell">
          <BadgeCheck aria-hidden="true" />
          <input
            id="displayName"
            name="displayName"
            autoComplete="name"
            placeholder="대회 운영에서 사용할 이름"
            aria-invalid={fields.displayName?.length ? true : undefined}
            aria-describedby={describedBy(fields, "displayName")}
            required
          />
        </span>
        <FieldErrors name="displayName" fields={fields} />
      </label>
      <label htmlFor="password">
        <span>비밀번호</span>
        <span className="input-shell">
          <LockKeyhole aria-hidden="true" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={4}
            maxLength={128}
            placeholder="4자 이상"
            aria-invalid={fields.password?.length ? true : undefined}
            aria-describedby={describedBy(fields, "password")}
            required
          />
        </span>
        <FieldErrors name="password" fields={fields} />
      </label>
      <label htmlFor="passwordConfirm">
        <span>비밀번호 확인</span>
        <span className="input-shell">
          <LockKeyhole aria-hidden="true" />
          <input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            minLength={4}
            maxLength={128}
            placeholder="한 번 더 입력"
            aria-invalid={fields.passwordConfirm?.length ? true : undefined}
            aria-describedby={describedBy(fields, "passwordConfirm")}
            required
          />
        </span>
        <FieldErrors name="passwordConfirm" fields={fields} />
      </label>
      <button
        className="button-primary button-full field-wide"
        type="submit"
        disabled={pending}
      >
        {pending ? "계정 생성 중…" : "계정 만들기"}
      </button>
    </form>
  );
}
