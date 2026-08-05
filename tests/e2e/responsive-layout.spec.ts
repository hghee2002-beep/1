import { expect, test, type Locator, type Page } from "@playwright/test";

const exactViewports = [
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;

const keyRoutes = [
  "/",
  "/leaderboard",
  "/missions",
  "/matches",
  "/rules",
  "/login",
  "/signup",
] as const;

async function expectWithinViewport(
  locator: Locator,
  viewport: { width: number; height: number },
  label: string,
) {
  await expect(locator, `${label} should render`).toBeVisible();
  const bounds = await locator.boundingBox();
  expect(bounds, `${label} should have layout bounds`).not.toBeNull();
  if (!bounds) return;
  expect(bounds.x, `${label} left edge`).toBeGreaterThanOrEqual(0);
  expect(bounds.y, `${label} top edge`).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width, `${label} right edge`).toBeLessThanOrEqual(
    viewport.width,
  );
  expect(bounds.y + bounds.height, `${label} bottom edge`).toBeLessThanOrEqual(
    viewport.height,
  );
}

async function expectNoHorizontalOverflow(page: Page, route: string) {
  const widths = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(
    Math.max(widths.document, widths.body),
    `${route} overflow metrics: ${JSON.stringify(widths)}`,
  ).toBeLessThanOrEqual(widths.viewport);
}

async function matchRowLayoutViolations(page: Page) {
  return page.locator(".match-row").evaluateAll((rows) =>
    rows.slice(0, 12).flatMap((row, rowIndex) => {
      const rowRect = row.getBoundingClientRect();
      const style = getComputedStyle(row);
      const visibleChildren = [...row.children].filter((child) => {
        const childStyle = getComputedStyle(child);
        return (
          childStyle.display !== "none" && childStyle.visibility !== "hidden"
        );
      });
      const escapedChildren = visibleChildren
        .map((child) => ({ child, rect: child.getBoundingClientRect() }))
        .filter(
          ({ rect }) =>
            rect.left < rowRect.left - 1 ||
            rect.right > rowRect.right + 1 ||
            rect.top < rowRect.top - 1 ||
            rect.bottom > rowRect.bottom + 1,
        )
        .map(({ child }) =>
          child instanceof HTMLElement
            ? child.className || child.tagName
            : child.nodeName,
        );
      const rowTrackCount = style.gridTemplateRows
        .trim()
        .split(/\s+/u)
        .filter(Boolean).length;

      return escapedChildren.length || rowTrackCount !== 1
        ? [
            {
              rowIndex,
              escapedChildren,
              rowTrackCount,
              gridTemplateAreas: style.gridTemplateAreas,
            },
          ]
        : [];
    }),
  );
}

for (const viewport of exactViewports) {
  test.describe(`responsive layout ${viewport.name}`, () => {
    test.use({ viewport });

    test("key public routes stay inside the viewport with reduced motion", async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop-chromium",
        "the exact viewport matrix runs once on Chromium",
      );
      await page.emulateMedia({ reducedMotion: "reduce" });

      for (const route of keyRoutes) {
        await page.goto(route);
        await expect(
          page.locator("main h1").first(),
          `${route} heading`,
        ).toBeVisible();
        await expectNoHorizontalOverflow(page, route);
        const reducedMotion = await page.evaluate(() => ({
          matches: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches,
          scrollBehavior: getComputedStyle(document.documentElement)
            .scrollBehavior,
        }));
        expect(reducedMotion).toEqual({
          matches: true,
          scrollBehavior: "auto",
        });
      }
    });

    test("countdown, TOP 5, and leaderboard link fit the first viewport", async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop-chromium",
        "the exact viewport matrix runs once on Chromium",
      );
      await page.goto("/");

      await expectWithinViewport(
        page.locator(".countdown"),
        viewport,
        "countdown",
      );
      await expectWithinViewport(
        page.getByRole("heading", { name: "현재 TOP 5", exact: true }),
        viewport,
        "TOP 5 heading",
      );
      await expectWithinViewport(
        page.getByRole("link", { name: /전체 순위표/u }),
        viewport,
        "leaderboard link",
      );
    });

    test("full and compact match rows use one stable grid row", async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.project.name !== "desktop-chromium",
        "the exact viewport matrix runs once on Chromium",
      );

      for (const route of ["/matches", "/"] as const) {
        await page.goto(route);
        await expect(page.locator(".match-row").first()).toBeVisible();
        expect(
          await matchRowLayoutViolations(page),
          `${route} match row geometry at ${viewport.name}`,
        ).toEqual([]);
        await expectNoHorizontalOverflow(page, route);
        const firstGridAreas = await page
          .locator(".match-row")
          .first()
          .evaluate((row) => getComputedStyle(row).gridTemplateAreas);
        expect(firstGridAreas).toContain("point");
        expect(firstGridAreas).toContain("action");
      }
    });
  });
}

test.describe("match archive detail at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens by keyboard without horizontal overflow", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-chromium",
      "the mobile accessibility check runs once on Chromium",
    );
    await page.goto("/matches");
    const expand = page.locator(".match-expand-button").first();
    await expect(expand).toBeVisible();
    await expect(expand).toHaveAccessibleName(/경기 상세 펼치기/u);
    const detailId = await expand.getAttribute("aria-controls");
    expect(detailId).not.toBeNull();
    if (!detailId) return;
    await expand.focus();
    await page.keyboard.press("Enter");
    await expect(expand).toHaveAttribute("aria-expanded", "true");
    await expect(expand).toHaveAccessibleName(/경기 상세 접기/u);
    const detail = page.locator(`#${detailId}`);
    await expect(detail).toBeVisible();
    await expectNoHorizontalOverflow(page, "/matches expanded detail");
    expect(
      await detail.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(await matchRowLayoutViolations(page)).toEqual([]);
  });
});
