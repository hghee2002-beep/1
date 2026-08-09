"use client";

import {
  BadgeCheck,
  KeyRound,
  LockKeyhole,
  LogOut,
  RefreshCw,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormErrorSummary } from "@/components/auth/form-error-summary";
import { LogoutForm } from "@/components/auth/logout-form";
import {
  isAuthApiErrorBody,
  type AuthFieldErrors,
} from "@/features/auth/types";

type RefreshedIdentity = {
  gameName: string;
  tagLine: string;
  soloQueue: { tier: string; rank: string; leaguePoints: number } | null;
};

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

async function readPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function identityFromPayload(value: unknown): RefreshedIdentity | null {
  if (!value || typeof value !== "object" || !("identity" in value)) {
    return null;
  }
  const identity = value.identity;
  if (!identity || typeof identity !== "object") return null;
  const candidate = identity as Record<string, unknown>;
  if (
    typeof candidate.gameName !== "string" ||
    typeof candidate.tagLine !== "string"
  ) {
    return null;
  }
  const soloQueue = candidate.soloQueue;
  if (
    soloQueue !== null &&
    (!soloQueue ||
      typeof soloQueue !== "object" ||
      typeof (soloQueue as Record<string, unknown>).tier !== "string" ||
      typeof (soloQueue as Record<string, unknown>).rank !== "string" ||
      typeof (soloQueue as Record<string, unknown>).leaguePoints !== "number")
  ) {
    return null;
  }
  return candidate as RefreshedIdentity;
}

export function AccountSettingsActions({
  participant,
}: {
  participant?: { gameName: string; tagLine: string };
}) {
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordFields, setPasswordFields] = useState<AuthFieldErrors>({});
  const [identityPending, setIdentityPending] = useState(false);
  const [identityStatus, setIdentityStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  async function refreshIdentity() {
    if (!participant || identityPending) return;
    setIdentityPending(true);
    setIdentityStatus(null);
    try {
      const response = await fetch("/api/account/riot-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        setIdentityStatus({
          tone: "error",
          message: isAuthApiErrorBody(payload)
            ? payload.error.message
            : "Riot ID를 갱신하지 못했습니다.",
        });
        return;
      }
      const identity = identityFromPayload(payload);
      if (!identity) {
        setIdentityStatus({
          tone: "error",
          message: "Riot ID 갱신 응답을 확인하지 못했습니다.",
        });
        return;
      }
      const rank = identity.soloQueue
        ? ` · ${identity.soloQueue.tier} ${identity.soloQueue.rank} ${identity.soloQueue.leaguePoints} LP`
        : " · UNRANKED";
      setIdentityStatus({
        tone: "success",
        message: `${identity.gameName}#${identity.tagLine}${rank}로 갱신했습니다.`,
      });
      router.refresh();
    } catch {
      setIdentityStatus({
        tone: "error",
        message: "네트워크 연결을 확인하고 다시 시도해 주세요.",
      });
    } finally {
      setIdentityPending(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordPending) return;
    setPasswordPending(true);
    setPasswordMessage(null);
    setPasswordFields({});
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: formData.get("currentPassword"),
          newPassword: formData.get("newPassword"),
          newPasswordConfirm: formData.get("newPasswordConfirm"),
        }),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        if (isAuthApiErrorBody(payload)) {
          setPasswordMessage(payload.error.message);
          setPasswordFields(payload.error.fields ?? {});
        } else {
          setPasswordMessage("비밀번호를 변경하지 못했습니다.");
        }
        return;
      }
      form.reset();
      router.replace("/login?passwordChanged=1");
    } catch {
      setPasswordMessage("네트워크 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setPasswordPending(false);
    }
  }

  return (
    <>
      <div
        className={`settings-grid${participant ? "" : " settings-grid-compact"}`}
      >
        {participant ? (
          <button
            type="button"
            onClick={refreshIdentity}
            disabled={identityPending}
          >
            <RefreshCw aria-hidden="true" />
            <span>
              <strong>Riot ID 갱신</strong>
              <small>
                {identityPending
                  ? "PUUID로 최신 정보를 확인 중입니다…"
                  : `${participant.gameName}#${participant.tagLine} 최신 정보 확인`}
              </small>
            </span>
          </button>
        ) : null}
        <button
          type="button"
          aria-expanded={passwordOpen}
          aria-controls="password-change-panel"
          onClick={() => {
            setPasswordOpen((open) => !open);
            setPasswordMessage(null);
            setPasswordFields({});
          }}
        >
          <KeyRound aria-hidden="true" />
          <span>
            <strong>비밀번호 변경</strong>
            <small>변경하면 모든 기기에서 다시 로그인합니다.</small>
          </span>
        </button>
        <LogoutForm>
          <LogOut aria-hidden="true" />
          <strong>로그아웃</strong>
        </LogoutForm>
        <Link href="/rules#privacy">
          <BadgeCheck aria-hidden="true" />
          <strong>개인정보 설정</strong>
        </Link>
      </div>
      {identityStatus ? (
        <p
          className={`account-settings-status is-${identityStatus.tone}`}
          role={identityStatus.tone === "error" ? "alert" : "status"}
        >
          {identityStatus.message}
        </p>
      ) : null}
      {passwordOpen ? (
        <section
          id="password-change-panel"
          className="account-settings-panel"
          aria-labelledby="password-change-title"
        >
          <header>
            <div>
              <p className="section-label">SECURITY</p>
              <h3 id="password-change-title">비밀번호 변경</h3>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="비밀번호 변경 닫기"
              onClick={() => setPasswordOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
          </header>
          <form
            className="auth-form account-password-form"
            onSubmit={changePassword}
            noValidate
          >
            <FormErrorSummary
              message={passwordMessage}
              fields={passwordFields}
            />
            <label htmlFor="currentPassword">
              <span>현재 비밀번호</span>
              <span className="input-shell">
                <LockKeyhole aria-hidden="true" />
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={
                    passwordFields.currentPassword?.length ? true : undefined
                  }
                  aria-describedby={
                    passwordFields.currentPassword?.length
                      ? "currentPassword-error"
                      : undefined
                  }
                  required
                />
              </span>
              <FieldErrors name="currentPassword" fields={passwordFields} />
            </label>
            <label htmlFor="newPassword">
              <span>새 비밀번호</span>
              <span className="input-shell">
                <KeyRound aria-hidden="true" />
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  aria-invalid={
                    passwordFields.newPassword?.length ? true : undefined
                  }
                  aria-describedby={
                    passwordFields.newPassword?.length
                      ? "newPassword-error"
                      : undefined
                  }
                  required
                />
              </span>
              <FieldErrors name="newPassword" fields={passwordFields} />
            </label>
            <label htmlFor="newPasswordConfirm">
              <span>새 비밀번호 확인</span>
              <span className="input-shell">
                <KeyRound aria-hidden="true" />
                <input
                  id="newPasswordConfirm"
                  name="newPasswordConfirm"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={
                    passwordFields.newPasswordConfirm?.length ? true : undefined
                  }
                  aria-describedby={
                    passwordFields.newPasswordConfirm?.length
                      ? "newPasswordConfirm-error"
                      : undefined
                  }
                  required
                />
              </span>
              <FieldErrors name="newPasswordConfirm" fields={passwordFields} />
            </label>
            <button
              className="button-primary button-full"
              type="submit"
              disabled={passwordPending}
            >
              {passwordPending ? "안전하게 변경 중…" : "비밀번호 변경"}
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}
