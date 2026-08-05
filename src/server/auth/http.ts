import "server-only";

import { NextResponse } from "next/server";

import type { AuthApiErrorBody, AuthFieldErrors } from "@/features/auth/types";

export const MAX_JSON_BODY_BYTES = 1024 * 1024;

export function noStoreJson(
  body: object,
  init?: { status?: number; headers?: HeadersInit },
) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(body, {
    ...(init?.status !== undefined ? { status: init.status } : {}),
    headers,
  });
}

export function authErrorResponse(input: {
  code: string;
  message: string;
  status: number;
  fields?: AuthFieldErrors;
  retryAfterSeconds?: number;
}) {
  const body: AuthApiErrorBody = {
    ok: false,
    error: {
      code: input.code,
      message: input.message,
      ...(input.fields ? { fields: input.fields } : {}),
    },
  };
  const headers = new Headers();
  if (input.retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(input.retryAfterSeconds));
  }
  return noStoreJson(body, { status: input.status, headers });
}

export function validationErrorResponse(fields: AuthFieldErrors) {
  return authErrorResponse({
    code: "VALIDATION_ERROR",
    message: "입력한 내용을 다시 확인해 주세요.",
    status: 400,
    fields,
  });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return null;
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    return null;
  }
  if (!request.body) return null;

  try {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_JSON_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const body = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return null;
  }
}
