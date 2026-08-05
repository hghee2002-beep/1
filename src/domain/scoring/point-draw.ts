import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const POINT_MIN = 17;
export const POINT_MAX = 23;
export const DRAW_COMMITMENT_VERSION = "v1";
export const DRAW_RNG_VERSION = "crypto-rejection-u8-v1";
export const DRAW_FIXED_20_VERSION = "fixed-20-v1";
export const DRAW_NONCE_BYTES = 32;

const POINT_OUTCOME_COUNT = POINT_MAX - POINT_MIN + 1;
const BYTE_CARDINALITY = 256;
const REJECTION_LIMIT =
  BYTE_CARDINALITY - (BYTE_CARDINALITY % POINT_OUTCOME_COUNT);
const HEX_SHA256_PATTERN = /^[0-9a-f]{64}$/u;

export type PointMode = "RANDOM_17_23" | "FIXED_20";
export type RandomBytesSource = (length: number) => Uint8Array;

export type DrawCommitmentInput = {
  commitmentVersion: string;
  drawId: string;
  magnitude: number;
  nonce: string;
};

export const DRAW_COMMITMENT_EXPLANATION = Object.freeze({
  algorithm: "SHA-256",
  commitmentVersion: DRAW_COMMITMENT_VERSION,
  encoding: "uint32be-length-prefixed UTF-8 fields",
  fields: ["commitmentVersion", "drawId", "magnitude", "nonce"] as const,
  probability: "Each integer from 17 through 23 has probability 1/7.",
});

export const DRAW_FIXED_20_EXPLANATION = Object.freeze({
  algorithm: "SHA-256",
  commitmentVersion: DRAW_COMMITMENT_VERSION,
  encoding: "uint32be-length-prefixed UTF-8 fields",
  fields: ["commitmentVersion", "drawId", "magnitude", "nonce"] as const,
  probability: "The fixed value 20 has probability 100% in FIXED_20 mode.",
});

export type PointModeLedgerEntry = {
  type: string;
  metadata: unknown;
};

export function isPointMode(value: unknown): value is PointMode {
  return value === "RANDOM_17_23" || value === "FIXED_20";
}

export function pointModeFromLedgerMetadata(metadata: unknown) {
  if (typeof metadata !== "object" || metadata === null) return null;
  const pointMode = (metadata as { pointMode?: unknown }).pointMode;
  return isPointMode(pointMode) ? pointMode : null;
}

export function pointModeFromLedgerEntries(
  entries: readonly PointModeLedgerEntry[] | undefined,
  useSecond = false,
) {
  if (!entries) return null;
  const preferredType = useSecond ? "MATCH_REROLL_ADJUSTMENT" : "MATCH_INITIAL";
  const preferred = entries.find((entry) => entry.type === preferredType);
  const preferredMode = pointModeFromLedgerMetadata(preferred?.metadata);
  if (preferredMode) return preferredMode;
  const initial = entries.find((entry) => entry.type === "MATCH_INITIAL");
  return pointModeFromLedgerMetadata(initial?.metadata);
}

export function resolveDrawPointMode(input: {
  rngVersion: string;
  ledgerEntries?: readonly PointModeLedgerEntry[] | undefined;
  useSecond?: boolean;
}): PointMode {
  if (input.rngVersion === DRAW_FIXED_20_VERSION) return "FIXED_20";
  return (
    pointModeFromLedgerEntries(input.ledgerEntries, input.useSecond) ??
    "RANDOM_17_23"
  );
}

export function rngVersionForPointMode(mode: PointMode) {
  return mode === "FIXED_20" ? DRAW_FIXED_20_VERSION : DRAW_RNG_VERSION;
}

export function publicDrawRngVersion(rngVersion: string, mode: PointMode) {
  return mode === "FIXED_20" ? DRAW_FIXED_20_VERSION : rngVersion;
}

export function drawCommitmentExplanation(mode: PointMode) {
  return mode === "FIXED_20"
    ? DRAW_FIXED_20_EXPLANATION
    : DRAW_COMMITMENT_EXPLANATION;
}

function assertMagnitude(magnitude: number) {
  if (
    !Number.isInteger(magnitude) ||
    magnitude < POINT_MIN ||
    magnitude > POINT_MAX
  ) {
    throw new RangeError(
      `Point magnitude must be an integer from ${POINT_MIN} to ${POINT_MAX}.`,
    );
  }
}

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

export function encodeLengthPrefixedUtf8(fields: readonly string[]) {
  const encoded = fields.map(utf8);
  const byteLength = encoded.reduce(
    (total, field) => total + 4 + field.length,
    0,
  );
  const output = new Uint8Array(byteLength);
  const view = new DataView(
    output.buffer,
    output.byteOffset,
    output.byteLength,
  );
  let offset = 0;

  for (const field of encoded) {
    view.setUint32(offset, field.length, false);
    offset += 4;
    output.set(field, offset);
    offset += field.length;
  }
  return output;
}

export function canonicalDrawCommitmentBytes(input: DrawCommitmentInput) {
  assertMagnitude(input.magnitude);
  if (!input.commitmentVersion || !input.drawId || !input.nonce) {
    throw new TypeError("Commitment version, draw ID, and nonce are required.");
  }
  return encodeLengthPrefixedUtf8([
    input.commitmentVersion,
    input.drawId,
    String(input.magnitude),
    input.nonce,
  ]);
}

export function createDrawCommitment(input: DrawCommitmentInput) {
  return createHash("sha256")
    .update(canonicalDrawCommitmentBytes(input))
    .digest("hex");
}

export function verifyDrawCommitment(
  input: DrawCommitmentInput,
  expectedCommitment: string,
) {
  if (!HEX_SHA256_PATTERN.test(expectedCommitment)) return false;
  const actual = Buffer.from(createDrawCommitment(input), "hex");
  const expected = Buffer.from(expectedCommitment, "hex");
  return timingSafeEqual(actual, expected);
}

export function magnitudeFromUniformByte(byte: number) {
  if (!Number.isInteger(byte) || byte < 0 || byte >= BYTE_CARDINALITY) {
    throw new RangeError("Random byte must be an integer from 0 to 255.");
  }
  if (byte >= REJECTION_LIMIT) return null;
  return POINT_MIN + (byte % POINT_OUTCOME_COUNT);
}

export function drawPointMagnitude(
  mode: PointMode,
  randomSource: RandomBytesSource = randomBytes,
) {
  if (mode === "FIXED_20") return 20;

  for (;;) {
    const bytes = randomSource(1);
    if (bytes.length < 1) {
      throw new Error("Secure random source returned no bytes.");
    }
    const magnitude = magnitudeFromUniformByte(bytes[0]!);
    if (magnitude !== null) return magnitude;
  }
}

export function generateDrawNonce(
  randomSource: RandomBytesSource = randomBytes,
) {
  const bytes = randomSource(DRAW_NONCE_BYTES);
  if (bytes.length !== DRAW_NONCE_BYTES) {
    throw new Error(
      `Secure random source must return exactly ${DRAW_NONCE_BYTES} bytes.`,
    );
  }
  return Buffer.from(bytes).toString("base64url");
}

export function signedPointDelta(win: boolean, magnitude: number) {
  assertMagnitude(magnitude);
  return win ? magnitude : -magnitude;
}

export function rerollAdjustment(
  win: boolean,
  firstMagnitude: number,
  secondMagnitude: number,
) {
  return (
    signedPointDelta(win, secondMagnitude) -
    signedPointDelta(win, firstMagnitude)
  );
}

export function effectivePointMode(
  seasonMode: PointMode,
  configuredMode: PointMode,
): PointMode {
  return configuredMode === "FIXED_20" ? "FIXED_20" : seasonMode;
}
