import { describe, expect, it } from "vitest";

import { buildSecurityHeaders } from "../../next.config";

describe("global response security headers", () => {
  it("locks down production framing, content sources, and transport", () => {
    const headers = new Map(
      buildSecurityHeaders(true).map(({ key, value }) => [key, value]),
    );

    expect(headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers.get("Content-Security-Policy")).toContain(
      "object-src 'none'",
    );
    expect(headers.get("Content-Security-Policy")).toContain(
      "upgrade-insecure-requests",
    );
    expect(headers.get("Strict-Transport-Security")).toContain(
      "max-age=31536000",
    );
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("keeps local development websocket and source-map support", () => {
    const headers = new Map(
      buildSecurityHeaders(false).map(({ key, value }) => [key, value]),
    );

    expect(headers.get("Content-Security-Policy")).toContain("'unsafe-eval'");
    expect(headers.get("Content-Security-Policy")).toContain("ws: wss:");
    expect(headers.has("Strict-Transport-Security")).toBe(false);
  });
});
