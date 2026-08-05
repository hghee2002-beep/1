"use client";

import { BadgeCheck, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormErrorSummary } from "@/components/auth/form-error-summary";
import {
  isAuthApiErrorBody,
  type AuthFieldErrors,
} from "@/features/auth/types";

function describedBy(fields: AuthFieldErrors, name: string, helpId?: string) {
  const ids = [
    helpId,
    fields[name]?.length ? `${name}-error` : undefined,
  ].filter((value): value is string => Boolean(value));
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
          termsAccepted: formData.get("termsAccepted") === "on",
          privacyAccepted: formData.get("privacyAccepted") === "on",
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
            aria-describedby={describedBy(fields, "loginId", "loginId-help")}
            required
          />
        </span>
        <small id="loginId-help">점·밑줄·하이픈을 사용할 수 있습니다.</small>
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
            aria-describedby={describedBy(
              fields,
              "displayName",
              "displayName-help",
            )}
            required
          />
        </span>
        <small id="displayName-help">
          공개 여부는 참가 신청에서 별도 선택합니다.
        </small>
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
            placeholder="12자 이상"
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
            placeholder="한 번 더 입력"
            aria-invalid={fields.passwordConfirm?.length ? true : undefined}
            aria-describedby={describedBy(fields, "passwordConfirm")}
            required
          />
        </span>
        <FieldErrors name="passwordConfirm" fields={fields} />
      </label>
      <fieldset className="consent-box field-wide">
        <legend>필수 동의</legend>
        <div className="consent-row">
          <label className="check-label" htmlFor="termsAccepted">
            <input
              id="termsAccepted"
              name="termsAccepted"
              type="checkbox"
              aria-invalid={fields.termsAccepted?.length ? true : undefined}
              aria-describedby={describedBy(fields, "termsAccepted")}
              required
            />
            게시 중인 이용약관에 동의합니다.
          </label>
          <Link className="consent-link" href="/rules#terms">
            이용약관 전문 보기
          </Link>
        </div>
        <FieldErrors name="termsAccepted" fields={fields} />
        <div className="consent-row">
          <label className="check-label" htmlFor="privacyAccepted">
            <input
              id="privacyAccepted"
              name="privacyAccepted"
              type="checkbox"
              aria-invalid={fields.privacyAccepted?.length ? true : undefined}
              aria-describedby={describedBy(fields, "privacyAccepted")}
              required
            />
            게시 중인 개인정보 수집·이용 정책에 동의합니다.
          </label>
          <Link className="consent-link" href="/rules#privacy">
            개인정보 정책 전문 보기
          </Link>
        </div>
        <FieldErrors name="privacyAccepted" fields={fields} />
        <small>
          동의한 문서의 정확한 게시 버전과 시각이 계정에 보존됩니다.
        </small>
      </fieldset>
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
