"use client";

import { Gamepad2, Hash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FormErrorSummary } from "@/components/auth/form-error-summary";
import {
  RiotProfileIcon,
  RiotRankEmblem,
} from "@/components/riot/riot-asset-image";
import { RiotId } from "@/components/ui/riot-id";
import { StatusBadge } from "@/components/system/status-badge";
import {
  isAuthApiErrorBody,
  type AuthFieldErrors,
} from "@/features/auth/types";

type VerifiedAccount = {
  gameName: string;
  tagLine: string;
  profileIconId: number | null;
  summonerLevel: number | null;
  soloQueue: { tier: string; rank: string; leaguePoints: number } | null;
  source: "MOCK" | "RIOT_API";
};

type ApplicationDefaults = {
  gameName?: string | undefined;
  tagLine?: string | undefined;
  primaryPosition?: string | null | undefined;
  secondaryPosition?: string | null | undefined;
};

function isVerifiedAccount(value: unknown): value is VerifiedAccount {
  if (!value || typeof value !== "object") return false;
  const account = value as Record<string, unknown>;
  const soloQueue = account.soloQueue;
  const validSoloQueue =
    soloQueue === null ||
    (Boolean(soloQueue) &&
      typeof soloQueue === "object" &&
      typeof (soloQueue as Record<string, unknown>).tier === "string" &&
      typeof (soloQueue as Record<string, unknown>).rank === "string" &&
      typeof (soloQueue as Record<string, unknown>).leaguePoints === "number");
  return Boolean(
    typeof account.gameName === "string" &&
    typeof account.tagLine === "string" &&
    (typeof account.profileIconId === "number" ||
      account.profileIconId === null) &&
    (typeof account.summonerLevel === "number" ||
      account.summonerLevel === null) &&
    (account.source === "MOCK" || account.source === "RIOT_API") &&
    validSoloQueue,
  );
}

const positionOptions = [
  ["", "선택 안 함"],
  ["TOP", "탑"],
  ["JUNGLE", "정글"],
  ["MIDDLE", "미드"],
  ["BOTTOM", "바텀"],
  ["UTILITY", "서포터"],
] as const;

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

export function ApplicationForm({
  defaults,
}: {
  defaults: ApplicationDefaults;
}) {
  const router = useRouter();
  const [gameName, setGameName] = useState(defaults.gameName ?? "");
  const [tagLine, setTagLine] = useState(defaults.tagLine ?? "");
  const [verified, setVerified] = useState<VerifiedAccount | null>(null);
  const [verifiedInput, setVerifiedInput] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "verify" | "submit" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<AuthFieldErrors>({});

  const currentIdentity = `${gameName.trim()}#${tagLine.trim()}`;
  const verificationCurrent = Boolean(
    verified && verifiedInput === currentIdentity,
  );

  function resetFeedback() {
    setMessage(null);
    setFields({});
  }

  function applyError(payload: unknown, fallback: string) {
    if (isAuthApiErrorBody(payload)) {
      setMessage(payload.error.message);
      setFields(payload.error.fields ?? {});
    } else {
      setMessage(fallback);
    }
  }

  async function verify() {
    if (pendingAction) return;
    setPendingAction("verify");
    resetFeedback();
    try {
      const response = await fetch("/api/applications/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameName, tagLine }),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        setVerified(null);
        applyError(payload, "Riot 계정을 확인하지 못했습니다.");
        return;
      }
      if (payload && typeof payload === "object" && "account" in payload) {
        const account = payload.account;
        if (!isVerifiedAccount(account)) {
          setMessage("계정 확인 응답 형식이 올바르지 않습니다.");
          return;
        }
        setVerified(account);
        setVerifiedInput(currentIdentity);
        setGameName(account.gameName);
        setTagLine(account.tagLine);
        setVerifiedInput(`${account.gameName}#${account.tagLine}`);
      }
    } catch {
      setMessage("네트워크 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setPendingAction(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction || !verificationCurrent) return;
    setPendingAction("submit");
    resetFeedback();
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameName,
          tagLine,
          primaryPosition: formData.get("primaryPosition"),
          secondaryPosition: formData.get("secondaryPosition"),
        }),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        applyError(payload, "참가 신청을 저장하지 못했습니다.");
        return;
      }
      router.replace("/me?application=submitted");
      router.refresh();
    } catch {
      setMessage("네트워크 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <form className="application-form" onSubmit={submit} noValidate>
      <div className="application-step">
        <span>01</span>
        <div>
          <strong>Riot ID 입력</strong>
        </div>
      </div>
      <FormErrorSummary message={message} fields={fields} />
      <div className="riot-inputs">
        <label htmlFor="gameName">
          <span>게임 이름</span>
          <span className="input-shell">
            <Gamepad2 aria-hidden="true" />
            <input
              id="gameName"
              name="gameName"
              value={gameName}
              onChange={(event) => {
                setGameName(event.target.value);
                setVerified(null);
              }}
              aria-invalid={fields.gameName?.length ? true : undefined}
              required
            />
          </span>
          <FieldErrors name="gameName" fields={fields} />
        </label>
        <i>#</i>
        <label htmlFor="tagLine">
          <span>태그라인</span>
          <span className="input-shell">
            <Hash aria-hidden="true" />
            <input
              id="tagLine"
              name="tagLine"
              value={tagLine}
              onChange={(event) => {
                setTagLine(event.target.value);
                setVerified(null);
              }}
              aria-invalid={fields.tagLine?.length ? true : undefined}
              required
            />
          </span>
          <FieldErrors name="tagLine" fields={fields} />
        </label>
      </div>
      <button
        className="button-secondary button-full"
        type="button"
        onClick={verify}
        disabled={Boolean(pendingAction)}
      >
        {pendingAction === "verify" ? "계정 확인 중…" : "Riot 계정 검증"}
      </button>
      {verified ? (
        <div className="identity-preview" aria-live="polite">
          <header>
            <RiotProfileIcon
              profileIconId={verified.profileIconId}
              gameName={verified.gameName}
            />
            <div>
              <RiotId gameName={verified.gameName} tagLine={verified.tagLine} />
            </div>
            <StatusBadge label="검증 완료" tone="ready" />
          </header>
          <div className="identity-preview-body">
            <RiotRankEmblem tier={verified.soloQueue?.tier} />
            <dl>
              <div>
                <dt>솔로 랭크</dt>
                <dd>
                  {verified.soloQueue
                    ? `${verified.soloQueue.tier} ${verified.soloQueue.rank} · ${verified.soloQueue.leaguePoints} LP`
                    : "배치 전"}
                </dd>
              </div>
              <div>
                <dt>소환사 레벨</dt>
                <dd>{verified.summonerLevel ?? "-"}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
      <div className="application-options">
        <label htmlFor="primaryPosition">
          <span>주 포지션</span>
          <select
            id="primaryPosition"
            name="primaryPosition"
            defaultValue={defaults.primaryPosition ?? ""}
          >
            {positionOptions.map(([value, label]) => (
              <option key={value || "none"} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldErrors name="primaryPosition" fields={fields} />
        </label>
        <label htmlFor="secondaryPosition">
          <span>부 포지션</span>
          <select
            id="secondaryPosition"
            name="secondaryPosition"
            defaultValue={defaults.secondaryPosition ?? ""}
          >
            {positionOptions.map(([value, label]) => (
              <option key={value || "none"} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldErrors name="secondaryPosition" fields={fields} />
        </label>
      </div>
      <button
        className="button-primary button-full"
        type="submit"
        disabled={Boolean(pendingAction) || !verificationCurrent}
      >
        {pendingAction === "submit" ? "신청 저장 중…" : "참가 신청 제출"}
      </button>
      {!verificationCurrent ? (
        <small className="submit-requirement">
          제출 전에 현재 입력한 Riot ID를 검증해 주세요.
        </small>
      ) : null}
    </form>
  );
}
