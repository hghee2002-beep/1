import { describe, expect, it } from "vitest";

import {
  normalizedRiotId,
  parseRiotId,
  parseRiotIdParts,
  RiotIdentityError,
} from "@/features/riot/identity";
import { MockRiotIdentityResolver } from "@/features/riot/mock-identity-resolver";
import { submitApplicationInputSchema } from "@/features/applications/validation";

describe("Riot identity application contracts", () => {
  it("keeps display text separate from normalized lookup text", () => {
    expect(parseRiotId("  Cloud Tempo#0217  ")).toEqual({
      gameName: "Cloud Tempo",
      tagLine: "0217",
      display: "Cloud Tempo#0217",
      normalized: "cloud tempo#0217",
    });
    expect(normalizedRiotId("Ｃｌｏｕｄ", "ＫＲ１")).toBe("cloud#kr1");
  });

  it.each(["missing-separator", "too#many#separators", "#KR1", "GameName#"])(
    "rejects malformed Riot ID %s",
    (value) => {
      expect(() => parseRiotId(value)).toThrowError(RiotIdentityError);
    },
  );

  it("rejects separators embedded in split fields", () => {
    expect(() =>
      parseRiotIdParts({ gameName: "Cloud#Tempo", tagLine: "KR1" }),
    ).toThrowError(expect.objectContaining({ code: "RIOT_ID_INVALID" }));
  });

  it("distinguishes not found, temporary failure, and rate limit", async () => {
    const resolver = new MockRiotIdentityResolver();
    await expect(
      resolver.resolve(parseRiotId("NotFound#KR1")),
    ).rejects.toMatchObject({
      code: "RIOT_ACCOUNT_NOT_FOUND",
      retryable: false,
    });
    await expect(
      resolver.resolve(parseRiotId("TemporaryFailure#KR1")),
    ).rejects.toMatchObject({
      code: "RIOT_TEMPORARY_FAILURE",
      retryable: true,
    });
    await expect(
      resolver.resolve(parseRiotId("RateLimited#KR1")),
    ).rejects.toMatchObject({
      code: "RIOT_RATE_LIMITED",
      retryable: true,
      retryAfterSeconds: 60,
    });
  });

  it("resolves fixed and deterministic E2E mock accounts", async () => {
    const resolver = new MockRiotIdentityResolver();
    await expect(
      resolver.resolve(parseRiotId("cloud tempo#0217")),
    ).resolves.toMatchObject({
      gameName: "Cloud Tempo",
      tagLine: "0217",
      puuid: "MOCK_PUUID_CLOUD_TEMPO_0217",
      source: "MOCK",
    });
    const generated = parseRiotId("E2E-repeatable-user#TEST");
    const first = await resolver.resolve(generated);
    const second = await resolver.resolve(generated);
    expect(first.puuid).toBe(second.puuid);
  });

  it("requires distinct optional positions", () => {
    expect(
      submitApplicationInputSchema.safeParse({
        gameName: "Cloud Tempo",
        tagLine: "0217",
        primaryPosition: "MIDDLE",
        secondaryPosition: "MIDDLE",
      }).success,
    ).toBe(false);
    expect(
      submitApplicationInputSchema.safeParse({
        gameName: "Cloud Tempo",
        tagLine: "0217",
        primaryPosition: "MIDDLE",
        secondaryPosition: "JUNGLE",
      }).success,
    ).toBe(true);
  });
});
