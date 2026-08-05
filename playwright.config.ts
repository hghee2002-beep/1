import { defineConfig, devices } from "@playwright/test";

const foundationEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL:
    process.env.E2E_DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/deluxe_soloq_test",
  DIRECT_URL: "",
  AUTH_SECRET: "e2e-auth-secret-with-at-least-32-characters",
  POINT_DRAW_SECRET: "e2e-point-draw-secret-with-at-least-32-characters",
  CRON_SECRET: "e2e-cron-secret-with-at-least-32-characters",
  MOCK_RIOT_API: "true",
  ALLOW_DEMO_MVP_REWARDS: "true",
  APP_URL: "http://localhost:3000",
  APP_TIME_ZONE: "Asia/Seoul",
  NEXT_PUBLIC_POLL_INTERVAL_MS: "20000",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI || process.env.E2E_ISOLATED_RUN ? { workers: 1 } : {}),
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "pnpm db:migrate:deploy && pnpm db:seed && pnpm dev",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI && !process.env.E2E_ISOLATED_RUN,
    timeout: 120_000,
    env: foundationEnvironment,
  },
});
