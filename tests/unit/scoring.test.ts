import { DrawState } from "@/generated/prisma/client";
import {
  createDrawCommitment,
  DRAW_FIXED_20_VERSION,
  DRAW_COMMITMENT_VERSION,
  DRAW_RNG_VERSION,
  drawCommitmentExplanation,
  drawPointMagnitude,
  generateDrawNonce,
  magnitudeFromUniformByte,
  rerollAdjustment,
  resolveDrawPointMode,
  rngVersionForPointMode,
  signedPointDelta,
  verifyDrawCommitment,
  type RandomBytesSource,
} from "@/domain/scoring/point-draw";
import {
  protectDrawNonce,
  revealProtectedDrawNonce,
} from "@/domain/scoring/nonce-protection";
import { toSafeDrawListItem } from "@/features/scoring/dto";
import { adminAdjustmentInputSchema } from "@/features/scoring/validation";
import { describe, expect, it, vi } from "vitest";

const canonicalInput = {
  commitmentVersion: DRAW_COMMITMENT_VERSION,
  drawId: "00000000-0000-4000-8000-000000000001",
  magnitude: 23,
  nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
};

function queuedRandom(chunks: readonly Uint8Array[]): RandomBytesSource {
  const queue = [...chunks];
  return (length) => {
    const next = queue.shift();
    if (!next) throw new Error("random fixture exhausted");
    expect(next).toHaveLength(length);
    return next;
  };
}

describe("point draw domain", () => {
  it("requires an idempotency key for admin score adjustments", () => {
    const adjustment = {
      participantWeekId: "00000000-0000-4000-8000-000000000001",
      amount: 5,
      reason: "manual correction",
    };
    expect(adminAdjustmentInputSchema.safeParse(adjustment).success).toBe(
      false,
    );
    expect(
      adminAdjustmentInputSchema.safeParse({
        ...adjustment,
        idempotencyKey: "admin-adjustment-retry-key",
      }).success,
    ).toBe(true);
  });

  it("maps all seven branches and rejects the modulo-bias tail", () => {
    expect(
      Array.from({ length: 7 }, (_, byte) => magnitudeFromUniformByte(byte)),
    ).toEqual([17, 18, 19, 20, 21, 22, 23]);
    expect([252, 253, 254, 255].map(magnitudeFromUniformByte)).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(
      drawPointMagnitude(
        "RANDOM_17_23",
        queuedRandom([Uint8Array.of(255), Uint8Array.of(6)]),
      ),
    ).toBe(23);
  });

  it("uses the fixed mode without consuming randomness", () => {
    const source = vi.fn<RandomBytesSource>();
    expect(drawPointMagnitude("FIXED_20", source)).toBe(20);
    expect(source).not.toHaveBeenCalled();
  });

  it("distinguishes fixed proof evidence from uniform random draws", () => {
    expect(rngVersionForPointMode("FIXED_20")).toBe(DRAW_FIXED_20_VERSION);
    expect(rngVersionForPointMode("RANDOM_17_23")).toBe(DRAW_RNG_VERSION);
    expect(
      resolveDrawPointMode({
        rngVersion: DRAW_RNG_VERSION,
        ledgerEntries: [
          {
            type: "MATCH_INITIAL",
            metadata: { pointMode: "FIXED_20" },
          },
        ],
      }),
    ).toBe("FIXED_20");
    expect(drawCommitmentExplanation("FIXED_20").probability).toContain("100%");
    expect(drawCommitmentExplanation("RANDOM_17_23").probability).toContain(
      "1/7",
    );
  });

  it("applies win/loss signs and reroll differences including equal values", () => {
    expect(signedPointDelta(true, 17)).toBe(17);
    expect(signedPointDelta(false, 23)).toBe(-23);
    expect(rerollAdjustment(true, 17, 23)).toBe(6);
    expect(rerollAdjustment(true, 23, 17)).toBe(-6);
    expect(rerollAdjustment(false, 17, 23)).toBe(-6);
    expect(rerollAdjustment(false, 23, 17)).toBe(6);
    expect(rerollAdjustment(true, 20, 20)).toBe(0);
  });

  it("keeps a canonical commitment vector and rejects tampering", () => {
    const commitment = createDrawCommitment(canonicalInput);
    expect(commitment).toBe(
      "df4ee661da58a1e94368cb4a3c72f74f20e72d020ac3d09e55fbe9dcebc238ef",
    );
    expect(verifyDrawCommitment(canonicalInput, commitment)).toBe(true);
    expect(
      verifyDrawCommitment({ ...canonicalInput, magnitude: 22 }, commitment),
    ).toBe(false);
    expect(
      verifyDrawCommitment(
        { ...canonicalInput, nonce: `${canonicalInput.nonce}x` },
        commitment,
      ),
    ).toBe(false);
  });

  it("generates a canonical 32-byte nonce", () => {
    expect(generateDrawNonce(() => new Uint8Array(32).fill(0xab))).toMatch(
      /^[A-Za-z0-9_-]{43}$/u,
    );
  });

  it("protects nonces with authenticated draw and phase binding", () => {
    const secret = "unit-test-draw-protection-secret-32-bytes";
    const protectedNonce = protectDrawNonce({
      nonce: canonicalInput.nonce,
      drawId: canonicalInput.drawId,
      phase: "FIRST",
      secret,
      randomSource: () => new Uint8Array(12).fill(7),
    });
    expect(protectedNonce).not.toContain(canonicalInput.nonce);
    expect(
      revealProtectedDrawNonce({
        protectedNonce,
        drawId: canonicalInput.drawId,
        phase: "FIRST",
        secret,
      }),
    ).toBe(canonicalInput.nonce);
    expect(() =>
      revealProtectedDrawNonce({
        protectedNonce,
        drawId: canonicalInput.drawId,
        phase: "SECOND",
        secret,
      }),
    ).toThrow();
  });

  it("does not expose sealed values or any nonce in list DTOs", () => {
    const input = {
      id: canonicalInput.drawId,
      participantMatchId: "00000000-0000-4000-8000-000000000002",
      state: DrawState.SEALED,
      resultSign: -1,
      firstValue: 23,
      firstCommitment: "a".repeat(64),
      firstCommitmentVersion: "v1",
      firstRngVersion: "rng-v1",
      firstGeneratedAt: new Date("2026-08-05T00:00:00Z"),
      revealedAt: null,
      autoRevealed: false,
      rerollEligible: true,
      rerollReason: "MVP",
      rerollEntitlementSource: "MVP",
      rerollGrantedAt: new Date("2026-08-05T00:00:00Z"),
      rerollExpiresAt: new Date("2026-08-06T00:00:00Z"),
      rerollUsedAt: null,
      secondValue: null,
      secondCommitment: null,
      secondCommitmentVersion: null,
      secondRngVersion: null,
      finalValue: 23,
      finalSignedValue: -23,
      participantMatch: {
        win: false,
        championName: "Taliyah",
        position: null,
        scoreLedger: [
          {
            type: "MATCH_INITIAL",
            metadata: { pointMode: "RANDOM_17_23" },
          },
        ],
        participantWeek: {
          mainScoreCached: -23,
          rankCached: 2,
          week: {
            endAt: new Date("2026-08-06T00:00:00Z"),
            season: { autoRevealHours: 12 },
          },
        },
        seasonMatch: {
          match: {
            riotMatchId: "KR_123",
            gameStartAt: new Date("2026-08-05T00:00:00Z"),
            gameEndAt: new Date("2026-08-05T00:30:00Z"),
          },
        },
      },
    };
    const dto = toSafeDrawListItem(input, new Date("2026-08-05T23:59:59.999Z"));
    expect(dto.displayMagnitude).toBeNull();
    expect(dto.signedDelta).toBeNull();
    expect(dto.rerollEligible).toBe(true);
    expect(dto).not.toHaveProperty("nonce");
    expect(dto).not.toHaveProperty("firstValue");

    expect(
      toSafeDrawListItem(input, new Date("2026-08-06T00:00:00.000Z"))
        .rerollEligible,
    ).toBe(false);
    expect(
      toSafeDrawListItem(
        {
          ...input,
          rerollExpiresAt: new Date("2026-08-07T00:00:00.000Z"),
        },
        new Date("2026-08-06T00:00:00.000Z"),
      ).rerollEligible,
    ).toBe(false);
  });
});
