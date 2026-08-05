import { expect, test } from "@playwright/test";

test("renders the live dashboard and exposes a safe health response", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "DEMO_ONLY 20인 대회 fixture" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "현재 TOP 5" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /전체 순위표/u }),
  ).toHaveAttribute("href", "/leaderboard");
  await expect(page.getByText(/Riot Games.*공식/u)).toBeVisible();

  const healthResponse = await page.request.get("/api/health");
  expect(healthResponse.ok()).toBe(true);
  expect(healthResponse.headers()["cache-control"]).toMatch(/no-store/u);
  expect(healthResponse.headers()["x-powered-by"]).toBeUndefined();
  expect(healthResponse.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(healthResponse.headers()["x-content-type-options"]).toBe("nosniff");
  expect(healthResponse.headers()["cross-origin-opener-policy"]).toBe(
    "same-origin",
  );

  const body = await healthResponse.json();
  expect(body).toMatchObject({
    status: "ok",
    service: "deluxe-soloq",
    mode: { riot: "mock", sync: "MANUAL" },
    config: { timeZone: "Asia/Seoul", pollIntervalMs: 20_000 },
  });
  expect(JSON.stringify(body)).not.toContain("secret");
});
