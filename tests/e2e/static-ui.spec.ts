import { expect, test, type Page } from "@playwright/test";

const seedPassword = process.env.SEED_PASSWORD ?? "DeluxeSoloq-Dev-Only-2026!";

const publicRoutes: ReadonlyArray<readonly [string, string | RegExp]> = [
  ["/leaderboard", "전체 순위"],
  ["/missions", "주간 미션"],
  ["/matches", "경기 기록"],
  ["/history", "지난 주차 · 종료 시즌"],
  ["/rules", "대회 규칙"],
  ["/login", "로그인"],
  ["/signup", "회원가입"],
] as const;

async function login(page: Page, loginId: string) {
  await page.goto("/login");
  await page.getByLabel("로그인 ID").fill(loginId);
  await page.getByLabel("비밀번호").fill(seedPassword);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL(/\/me/u);
}

test("all public, participant, and authentication routes render without console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  for (const [route, heading] of publicRoutes) {
    await page.goto(route);
    await expect(
      page
        .getByRole("heading", {
          name: heading,
          exact: typeof heading === "string",
        })
        .first(),
    ).toBeVisible();
  }

  await page.goto("/leaderboard");
  const participantLink = page.locator('a[href^="/participants/"]').first();
  await expect(participantLink).toBeVisible();
  await participantLink.click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("#");

  expect(errors).toEqual([]);
});

test("signup consent links open the exact published legal sections", async ({
  page,
}) => {
  await page.goto("/signup");
  await expect(
    page.getByRole("link", { name: "이용약관 전문 보기", exact: true }),
  ).toHaveAttribute("href", "/rules#terms");
  await expect(
    page.getByRole("link", { name: "개인정보 정책 전문 보기", exact: true }),
  ).toHaveAttribute("href", "/rules#privacy");

  await page.goto("/rules");
  const terms = page.locator("#terms");
  const privacy = page.locator("#privacy");
  await expect(terms.getByRole("heading", { name: "이용약관" })).toBeVisible();
  await expect(terms.locator(".legal-document-title")).toBeVisible();
  await expect(terms.locator(".legal-document-meta")).toContainText(
    /문서 v\d+ · 시행/u,
  );
  await expect(privacy.locator(".legal-document-meta")).toContainText(
    /문서 v\d+ · 시행/u,
  );
  await expect(page.locator(".legal-document-missing")).toHaveCount(0);
});

test("leaderboard activates the sticky boundary only after horizontal scroll", async ({
  page,
  isMobile,
}) => {
  test.skip(
    Boolean(isMobile),
    "mobile uses row expansion instead of horizontal scroll",
  );
  await page.goto("/leaderboard");
  const frame = page.locator(".table-frame");
  await expect(frame).toHaveAttribute("data-hydrated", "true");
  await expect(frame).not.toHaveClass(/is-scrolled/u);
  await page.locator(".table-scroll").evaluate((element) => {
    element.scrollLeft = Math.max(
      10,
      element.scrollWidth - element.clientWidth,
    );
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect(frame).toHaveClass(/is-scrolled/u);
});

test("mobile leaderboard keeps core data and expands optional details", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "mobile-only responsive assertion");
  await page.goto("/leaderboard");
  await expect(page.locator(".table-frame")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  const rowButton = page.locator(".expand-cell button").first();
  await expect(rowButton).toHaveAttribute("aria-expanded", "false");
  await rowButton.click();
  await expect(rowButton).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".expanded-row")).toBeVisible();
  const bodyWidth = await page
    .locator("body")
    .evaluate((element) => element.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});

test("point result dialog supports keyboard close, focus restore, and mobile bounds", async ({
  page,
  isMobile,
}) => {
  await login(page, isMobile ? "player02" : "player01");
  const trigger = page.getByRole("button", {
    name: isMobile ? "결과 보기" : "결과 확인",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole("button", {
    name: "결과 대화상자 닫기",
    exact: true,
  });
  if (isMobile) {
    await expect(dialog.locator("[data-reveal-result]")).toBeFocused();
  } else {
    const start = dialog.getByRole("button", {
      name: "봉인 해제 시작",
      exact: true,
    });
    await expect(start).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(start).toBeFocused();
  }
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize();
  const dialogMetrics = await dialog.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      boxSizing: style.boxSizing,
      computedHeight: style.height,
      maxHeight: style.maxHeight,
      innerHeight: window.innerHeight,
      visualViewportHeight: window.visualViewport?.height ?? null,
    };
  });
  expect(bounds).not.toBeNull();
  if (bounds && viewport) {
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(
      bounds.y + bounds.height,
      `dialog metrics: ${JSON.stringify(dialogMetrics)}`,
    ).toBeLessThanOrEqual(viewport.height);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("admin navigation reaches real operation areas without exposing secrets", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "운영 대시보드" }),
  ).toBeVisible();
  const links = [
    "사용자",
    "참가 신청",
    "참가자",
    "시즌 · 주차",
    "점수 규칙",
    "경기 · 동기화",
    "포인트 추첨",
    "미션",
    "MVP/ACE 기준",
    "공지 · 법적 문서",
    "감사 · 내보내기",
    "시스템",
  ];
  for (const label of links)
    await expect(
      page.getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("href", /\/admin/u);
  await page.goto("/admin/system");
  await expect(page.getByRole("heading", { name: "시스템" })).toBeVisible();
  await expect(page.getByText("env.RIOT_API_KEY")).toBeVisible();
  await expect(
    page.getByText(
      "secret 원문, password hash, Riot key, nonce는 조회하거나 표시하지 않습니다.",
    ),
  ).toBeVisible();
  await expect(page.getByText("SAFE OPERATION").first()).toBeVisible();
  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
});

test("desktop dashboard visual baseline", async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), "desktop-only visual assertion");
  test.skip(
    process.platform !== "win32",
    "pixel baseline is maintained on the Windows release workstation",
  );
  await page.goto("/");
  await expect(page.getByText("동기화 정상", { exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard-desktop.png", {
    fullPage: true,
    animations: "disabled",
    caret: "initial",
    mask: [
      page.locator(".freshness-bar > span").nth(1),
      page.locator(".countdown"),
      page.locator(".countdown-note"),
      page.locator(".announcement-list time"),
      page.locator(".sync-notice > span"),
    ],
  });
});

test("dashboard keeps countdown, top five, and leaderboard link in the first viewport", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".countdown")).toBeVisible();
  await expect(page.getByText("현재 TOP 5", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /전체 순위표/u })).toBeVisible();
});

test("mobile leaderboard visual baseline", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only visual assertion");
  test.skip(
    process.platform !== "win32",
    "pixel baseline is maintained on the Windows release workstation",
  );
  await page.goto("/leaderboard");
  await expect(page.locator(".table-frame")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await expect(page.locator('a[href^="/participants/"]').first()).toBeVisible();
  await expect(page).toHaveScreenshot("leaderboard-mobile.png", {
    fullPage: true,
    animations: "disabled",
    caret: "initial",
    mask: [
      page.locator(".freshness-bar > span").nth(1),
      page.locator(".section-description"),
    ],
  });
});
