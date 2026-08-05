// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  RiotHttpClient,
  parseRetryAfterSeconds,
} from "@/server/riot/http-client";

describe("Riot HTTP transport", () => {
  it("sets the API key only in the server request header and records safe rate metadata", async () => {
    const observations: Parameters<
      NonNullable<ConstructorParameters<typeof RiotHttpClient>[0]["logger"]>
    >[0][] = [];
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("x-riot-token")).toBe("RGAPI-secret-test-value");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-App-Rate-Limit": "20:1",
          "X-App-Rate-Limit-Count": "1:1",
        },
      });
    });
    const client = new RiotHttpClient({
      apiKey: "RGAPI-secret-test-value",
      fetch: fetchMock,
      logger: (observation) => observations.push(observation),
    });

    await expect(
      client.requestJson({
        host: "asia.api.riotgames.com",
        path: "/riot/account/v1/accounts/by-puuid/redacted",
        operation: "account.by-puuid",
        correlationId: "request-123",
      }),
    ).resolves.toEqual({ ok: true });

    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      operation: "account.by-puuid",
      correlationId: "request-123",
      result: "SUCCESS",
      rateLimit: { appLimit: "20:1", appCount: "1:1" },
    });
    expect(JSON.stringify(observations)).not.toContain(
      "RGAPI-secret-test-value",
    );
    expect(JSON.stringify(observations)).not.toContain("redacted");
  });

  it("honors Retry-After before retrying a 429 response", async () => {
    const sleeps: number[] = [];
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("{}", { status: 429, headers: { "Retry-After": "2" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(["KR_1"]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = new RiotHttpClient({
      apiKey: "test-key",
      fetch: fetchMock,
      sleep: (milliseconds) => {
        sleeps.push(milliseconds);
        return Promise.resolve();
      },
      random: () => 0,
    });

    await expect(
      client.requestJson({
        host: "asia.api.riotgames.com",
        path: "/lol/match/v5/matches/by-puuid/test/ids",
        operation: "match.ids-by-puuid",
      }),
    ).resolves.toEqual(["KR_1"]);
    expect(sleeps).toEqual([2_000]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry earlier than an oversized Retry-After window", async () => {
    const sleep = vi.fn<(milliseconds: number) => Promise<void>>();
    const fetchMock = vi.fn<typeof fetch>(
      async () =>
        new Response("{}", { status: 429, headers: { "Retry-After": "300" } }),
    );
    const client = new RiotHttpClient({
      apiKey: "test-key",
      fetch: fetchMock,
      sleep,
      maxRetryDelayMs: 10_000,
    });

    await expect(
      client.requestJson({
        host: "asia.api.riotgames.com",
        path: "/rate-limited",
        operation: "test.rate-limit",
      }),
    ).rejects.toMatchObject({
      code: "RIOT_RATE_LIMITED",
      retryAfterSeconds: 300,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each([
    [401, "RIOT_KEY_INVALID", false],
    [403, "RIOT_KEY_INVALID", false],
    [404, "RIOT_RESOURCE_NOT_FOUND", false],
    [500, "RIOT_TEMPORARY_FAILURE", true],
  ])("maps HTTP %i to %s", async (status, code, retryable) => {
    const client = new RiotHttpClient({
      apiKey: "test-key",
      maxRetries: 0,
      fetch: vi.fn<typeof fetch>(async () => new Response("{}", { status })),
    });
    await expect(
      client.requestJson({
        host: "kr.api.riotgames.com",
        path: "/test",
        operation: "test.status",
      }),
    ).rejects.toMatchObject({ code, retryable, status });
  });

  it("uses bounded exponential backoff for 5xx and network failures", async () => {
    const sleeps: number[] = [];
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("socket closed"))
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ recovered: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const client = new RiotHttpClient({
      apiKey: "test-key",
      fetch: fetchMock,
      maxRetries: 2,
      baseRetryDelayMs: 100,
      maxRetryDelayMs: 250,
      random: () => 0,
      sleep: (milliseconds) => {
        sleeps.push(milliseconds);
        return Promise.resolve();
      },
    });
    await expect(
      client.requestJson({
        host: "kr.api.riotgames.com",
        path: "/recover",
        operation: "test.recover",
      }),
    ).resolves.toEqual({ recovered: true });
    expect(sleeps).toEqual([100, 200]);
  });

  it("aborts a timed-out request and returns a typed error", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const client = new RiotHttpClient({
      apiKey: "test-key",
      fetch: fetchMock,
      timeoutMs: 1,
      maxRetries: 0,
    });
    await expect(
      client.requestJson({
        host: "kr.api.riotgames.com",
        path: "/slow",
        operation: "test.timeout",
      }),
    ).rejects.toMatchObject({ code: "RIOT_TIMEOUT", retryable: true });
  });

  it("rejects malformed JSON without exposing the body", async () => {
    const client = new RiotHttpClient({
      apiKey: "test-key",
      fetch: vi.fn<typeof fetch>(
        async () =>
          new Response("not-json-RGAPI-secret", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    });
    const error = await client
      .requestJson({
        host: "kr.api.riotgames.com",
        path: "/malformed",
        operation: "test.malformed",
      })
      .catch((reason: unknown) => reason);
    expect(error).toMatchObject({ code: "RIOT_MALFORMED_RESPONSE" });
    expect(String(error)).not.toContain("RGAPI-secret");
  });

  it("parses both delta-seconds and HTTP-date Retry-After values", () => {
    expect(parseRetryAfterSeconds("1.2", 0)).toBe(2);
    expect(parseRetryAfterSeconds("Thu, 01 Jan 1970 00:00:10 GMT", 4_100)).toBe(
      6,
    );
    expect(parseRetryAfterSeconds("invalid", 0)).toBeUndefined();
  });
});
