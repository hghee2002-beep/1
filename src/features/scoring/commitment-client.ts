export type BrowserDrawCommitmentInput = {
  commitmentVersion: string;
  drawId: string;
  magnitude: number;
  nonce: string;
};

function encodeLengthPrefixedUtf8(fields: readonly string[]) {
  const encoder = new TextEncoder();
  const encoded = fields.map((field) => encoder.encode(field));
  const byteLength = encoded.reduce(
    (total, field) => total + 4 + field.byteLength,
    0,
  );
  const output = new Uint8Array(byteLength);
  const view = new DataView(output.buffer);
  let offset = 0;

  for (const field of encoded) {
    view.setUint32(offset, field.byteLength, false);
    offset += 4;
    output.set(field, offset);
    offset += field.byteLength;
  }
  return output;
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function createBrowserDrawCommitment(
  input: BrowserDrawCommitmentInput,
  subtle: SubtleCrypto = globalThis.crypto.subtle,
) {
  const payload = encodeLengthPrefixedUtf8([
    input.commitmentVersion,
    input.drawId,
    String(input.magnitude),
    input.nonce,
  ]);
  return toHex(await subtle.digest("SHA-256", payload));
}

export async function verifyBrowserDrawCommitment(
  input: BrowserDrawCommitmentInput,
  expectedCommitment: string,
  subtle: SubtleCrypto = globalThis.crypto.subtle,
) {
  if (!/^[0-9a-f]{64}$/u.test(expectedCommitment)) return false;
  return (
    (await createBrowserDrawCommitment(input, subtle)) === expectedCommitment
  );
}
