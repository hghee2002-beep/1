import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

import type { RandomBytesSource } from "@/domain/scoring/point-draw";

const ENVELOPE_VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export type ProtectedDrawPhase = "FIRST" | "SECOND";

function deriveKey(secret: string) {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Nonce protection secret must be at least 32 bytes.");
  }
  return Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(secret, "utf8"),
      Buffer.from("deluxe-soloq/point-draw-nonce/v1", "utf8"),
      Buffer.from("aes-256-gcm", "utf8"),
      KEY_BYTES,
    ),
  );
}

function associatedData(drawId: string, phase: ProtectedDrawPhase) {
  return Buffer.from(`${ENVELOPE_VERSION}:${drawId}:${phase}`, "utf8");
}

function assertNonce(nonce: string) {
  if (!NONCE_PATTERN.test(nonce)) {
    throw new Error("Draw nonce is not a canonical 32-byte base64url value.");
  }
}

export function protectDrawNonce(input: {
  nonce: string;
  drawId: string;
  phase: ProtectedDrawPhase;
  secret: string;
  randomSource?: RandomBytesSource;
}) {
  assertNonce(input.nonce);
  const randomSource = input.randomSource ?? randomBytes;
  const ivBytes = randomSource(IV_BYTES);
  if (ivBytes.length !== IV_BYTES) {
    throw new Error(`Nonce protection requires exactly ${IV_BYTES} IV bytes.`);
  }
  const iv = Buffer.from(ivBytes);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(input.secret), iv, {
    authTagLength: TAG_BYTES,
  });
  cipher.setAAD(associatedData(input.drawId, input.phase));
  const ciphertext = Buffer.concat([
    cipher.update(input.nonce, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

export function revealProtectedDrawNonce(input: {
  protectedNonce: string;
  drawId: string;
  phase: ProtectedDrawPhase;
  secret: string;
}) {
  const [version, encodedIv, encodedCiphertext, encodedTag, extra] =
    input.protectedNonce.split(".");
  if (
    version !== ENVELOPE_VERSION ||
    !encodedIv ||
    !encodedCiphertext ||
    !encodedTag ||
    extra !== undefined
  ) {
    throw new Error("Protected draw nonce envelope is invalid.");
  }
  const iv = Buffer.from(encodedIv, "base64url");
  const ciphertext = Buffer.from(encodedCiphertext, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error("Protected draw nonce envelope has invalid lengths.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(input.secret),
    iv,
    { authTagLength: TAG_BYTES },
  );
  decipher.setAAD(associatedData(input.drawId, input.phase));
  decipher.setAuthTag(tag);
  const nonce = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
  assertNonce(nonce);
  return nonce;
}
