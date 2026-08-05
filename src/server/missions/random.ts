import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type {
  MissionIndexSelector,
  MissionSelectionProof,
} from "@/domain/missions/selection";

export type MissionRandomBytesSource = (length: number) => Uint8Array;

const ENTROPY_BYTES = 32;
const ENTROPY_CARDINALITY = 1n << BigInt(ENTROPY_BYTES * 8);

function bytesToBigInt(bytes: Uint8Array) {
  let result = 0n;
  for (const byte of bytes) result = (result << 8n) | BigInt(byte);
  return result;
}

export class CryptoMissionIndexSelector implements MissionIndexSelector {
  constructor(
    private readonly randomSource: MissionRandomBytesSource = randomBytes,
  ) {}

  choose(upperExclusive: number): MissionSelectionProof {
    if (!Number.isSafeInteger(upperExclusive) || upperExclusive <= 0) {
      throw new RangeError(
        "Mission candidate count must be a positive integer.",
      );
    }
    const upper = BigInt(upperExclusive);
    const rejectionLimit = ENTROPY_CARDINALITY - (ENTROPY_CARDINALITY % upper);

    for (;;) {
      const entropy = this.randomSource(ENTROPY_BYTES);
      if (entropy.length !== ENTROPY_BYTES) {
        throw new Error(
          `Mission random source must return exactly ${ENTROPY_BYTES} bytes.`,
        );
      }
      const sample = bytesToBigInt(entropy);
      if (sample >= rejectionLimit) continue;
      return {
        index: Number(sample % upper),
        entropyHash: createHash("sha256").update(entropy).digest("hex"),
        algorithm: "crypto-rejection-u256-v1",
      };
    }
  }
}

export const cryptoMissionIndexSelector = new CryptoMissionIndexSelector();
