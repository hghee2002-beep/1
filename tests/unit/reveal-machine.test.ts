import { webcrypto } from "node:crypto";

import {
  createBrowserDrawCommitment,
  verifyBrowserDrawCommitment,
} from "@/features/scoring/commitment-client";
import {
  POINT_REVEAL_TIMING,
  revealStateAt,
} from "@/features/scoring/reveal-machine";
import { describe, expect, it } from "vitest";

const canonicalInput = {
  commitmentVersion: "v1",
  drawId: "00000000-0000-4000-8000-000000000001",
  magnitude: 23,
  nonce: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
};

describe("point reveal state machine", () => {
  it("maps the normal 4.8 second sequence to explicit states", () => {
    expect(revealStateAt(0, false)).toBe("sealLocked");
    expect(revealStateAt(POINT_REVEAL_TIMING.sealLockedUntilMs, false)).toBe(
      "signalScan",
    );
    expect(revealStateAt(POINT_REVEAL_TIMING.signalScanUntilMs, false)).toBe(
      "instability",
    );
    expect(revealStateAt(POINT_REVEAL_TIMING.instabilityUntilMs, false)).toBe(
      "finalApproach",
    );
    expect(
      revealStateAt(POINT_REVEAL_TIMING.finalApproachUntilMs - 1, false),
    ).toBe("finalApproach");
    expect(revealStateAt(POINT_REVEAL_TIMING.finalApproachUntilMs, false)).toBe(
      "revealed",
    );
  });

  it("uses the reduced-motion 0.4 second path", () => {
    expect(revealStateAt(0, true)).toBe("reducedMotionReveal");
    expect(revealStateAt(399, true)).toBe("reducedMotionReveal");
    expect(revealStateAt(400, true)).toBe("revealed");
  });
});

describe("browser commitment verifier", () => {
  it("matches the server canonical vector and rejects a changed value", async () => {
    const subtle = webcrypto.subtle as SubtleCrypto;
    const expected =
      "df4ee661da58a1e94368cb4a3c72f74f20e72d020ac3d09e55fbe9dcebc238ef";
    await expect(
      createBrowserDrawCommitment(canonicalInput, subtle),
    ).resolves.toBe(expected);
    await expect(
      verifyBrowserDrawCommitment(canonicalInput, expected, subtle),
    ).resolves.toBe(true);
    await expect(
      verifyBrowserDrawCommitment(
        { ...canonicalInput, magnitude: 22 },
        expected,
        subtle,
      ),
    ).resolves.toBe(false);
  });
});
