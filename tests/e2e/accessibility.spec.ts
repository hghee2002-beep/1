import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const seedPassword = process.env.SEED_PASSWORD ?? "DeluxeSoloq-Dev-Only-2026!";

async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const violations = results.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );
  expect(
    violations.map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      targets: nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

test("public and authentication surfaces have no serious axe violations", async ({
  page,
}) => {
  for (const route of ["/", "/leaderboard", "/missions", "/login", "/signup"]) {
    await page.goto(route);
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page);
  }
});

test("participant and admin surfaces have no serious axe violations", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("로그인 ID").fill("admin");
  await page.getByLabel("비밀번호").fill(seedPassword);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL(/\/me/u);

  for (const route of ["/me", "/admin", "/admin/system"]) {
    await page.goto(route);
    await expect(page.locator("#main-content")).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page);
  }
});
