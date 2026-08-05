import { describe, expect, it } from "vitest";

import { MAX_JSON_BODY_BYTES, readJsonBody } from "@/server/auth/http";

describe("JSON request body reader", () => {
  it("parses valid JSON bodies", async () => {
    const request = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    });

    await expect(readJsonBody(request)).resolves.toEqual({ ok: true });
  });

  it("rejects declared and streamed bodies larger than the limit", async () => {
    const declared = new Request("http://localhost/api/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(MAX_JSON_BODY_BYTES + 1),
      },
      body: "{}",
    });
    await expect(readJsonBody(declared)).resolves.toBeNull();

    const streamed = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(MAX_JSON_BODY_BYTES) }),
    });
    await expect(readJsonBody(streamed)).resolves.toBeNull();
  });

  it("rejects non-JSON and malformed JSON bodies", async () => {
    await expect(
      readJsonBody(
        new Request("http://localhost/api/test", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: "{}",
        }),
      ),
    ).resolves.toBeNull();
    await expect(
      readJsonBody(
        new Request("http://localhost/api/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        }),
      ),
    ).resolves.toBeNull();
  });
});
