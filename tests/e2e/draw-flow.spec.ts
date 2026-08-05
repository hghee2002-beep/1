import { expect, test, type Page } from "@playwright/test";

const seedPassword = process.env.SEED_PASSWORD ?? "DeluxeSoloq-Dev-Only-2026!";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("로그인 ID").fill("player01");
  await page.getByLabel("비밀번호").fill(seedPassword);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL(/\/me/u);
}

async function finishRevealAnimation(page: Page) {
  const skip = page.getByRole("button", {
    name: "연출 건너뛰기",
    exact: true,
  });
  const result = page.locator("[data-reveal-result]");
  await expect
    .poll(async () => {
      if ((await result.count()) > 0) return true;
      return (await skip.count()) > 0 && (await skip.isEnabled());
    })
    .toBe(true);
  if ((await skip.count()) > 0 && (await skip.isVisible())) {
    await skip.click();
  }
  await expect(result).toBeVisible();
}

test("sealed draw reveal verifies commitment and consumes the one-time reroll", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "one-time mutation is project-independent; mobile dialog bounds are covered separately",
  );
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page);
  await page.getByRole("button", { name: "결과 확인", exact: true }).click();
  await page
    .getByRole("button", { name: "봉인 해제 시작", exact: true })
    .click();
  await finishRevealAnimation(page);
  await expect(page.locator("[data-reveal-result]")).toContainText("+22");
  await expect(page.getByText("브라우저 commitment 일치")).toBeVisible();

  await page
    .getByRole("button", { name: "DEMO 재추첨 규칙 확인", exact: true })
    .click();
  const confirmation = page.getByLabel(
    "두 번째 결과가 최종이며 취소할 수 없음을 확인했습니다.",
  );
  await confirmation.focus();
  await confirmation.press("Space");
  await expect(confirmation).toBeChecked();
  await page
    .getByRole("button", { name: "SECOND 결과 확정", exact: true })
    .click();
  await finishRevealAnimation(page);
  await expect(page.locator('dl[aria-label="재추첨 결과 비교"]')).toBeVisible();
  await expect(page.getByText("재추첨 확정", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "DEMO 재추첨 규칙 확인",
      exact: true,
    }),
  ).toHaveCount(0);
});
