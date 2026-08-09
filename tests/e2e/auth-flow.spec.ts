import { expect, test, type Page } from "@playwright/test";

const seedPassword = process.env.SEED_PASSWORD ?? "DeluxeSoloq-Dev-Only-2026!";

const password = "browser auth password 2026";

function uniqueLoginId(projectName: string, suffix = "flow") {
  const project = projectName.startsWith("mobile") ? "mob" : "desk";
  return `${suffix}-${project}-${Date.now().toString(36)}`.slice(0, 32);
}

async function signup(page: Page, loginId: string, displayName: string) {
  const octet =
    (Array.from(loginId).reduce(
      (sum, character) => sum + character.charCodeAt(0),
      0,
    ) %
      200) +
    20;
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `203.0.113.${octet}`,
  });
  await page.goto("/signup");
  await page.getByLabel("로그인 ID").fill(loginId);
  await page.getByLabel("표시 이름").fill(displayName);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByLabel("비밀번호 확인").fill(password);
  await page.getByRole("button", { name: "계정 만들기" }).click();
  await expect(page).toHaveURL(/\/login\?registered=1/u);
  await expect(page.getByText(/계정이 생성되었습니다/u)).toBeVisible();
}

async function login(
  page: Page,
  loginId: string,
  redirect = "/me",
  loginPassword = password,
) {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
  await page.getByLabel("로그인 ID").fill(loginId);
  await page.getByLabel("비밀번호").fill(loginPassword);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}

async function logoutByApi(page: Page) {
  await page.evaluate(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
  });
}

test("signup, login, refresh, protected page, and logout stay consistent", async ({
  page,
  context,
}, testInfo) => {
  const loginId = uniqueLoginId(testInfo.project.name);
  const displayName = `브라우저 ${testInfo.project.name}`;

  await signup(page, loginId, displayName);
  await login(page, loginId, "https://evil.example/steal");
  await expect(page).toHaveURL(/\/me$/u);
  await expect(page.getByRole("heading", { name: displayName })).toBeVisible();

  const sessionResponse = await page.request.get("/api/auth/session");
  expect(sessionResponse.status()).toBe(200);
  const sessionBody = await sessionResponse.json();
  expect(sessionBody).toMatchObject({
    ok: true,
    session: { user: { loginId, displayName, role: "USER" } },
  });

  const cookie = (await context.cookies()).find(
    (item) => item.name === "deluxe_session",
  );
  expect(cookie).toMatchObject({
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  });

  await page.reload();
  await expect(page.getByRole("heading", { name: displayName })).toBeVisible();

  const adminApi = await page.request.get("/api/admin/auth-check");
  expect(adminApi.status()).toBe(403);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/me\?error=admin_required/u);

  await page.locator(".settings-grid form button").click();
  await expect(page).toHaveURL(/\/login\?loggedOut=1/u);
  await expect(page.getByText("안전하게 로그아웃되었습니다.")).toBeVisible();
  expect(
    (await context.cookies()).some((item) => item.name === "deluxe_session"),
  ).toBe(false);
  expect((await page.request.get("/api/auth/session")).status()).toBe(401);
});

test("login errors are generic, rate limited, and mutations reject missing Origin", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "security HTTP boundary is project-independent",
  );
  const loginId = uniqueLoginId(testInfo.project.name, "limit");
  await signup(page, loginId, "로그인 제한 사용자");

  const missingOrigin = await page.request.post("/api/auth/login", {
    data: { loginId, password },
  });
  expect(missingOrigin.status()).toBe(403);

  await page.goto("/login");
  const statuses = await page.evaluate(
    async ({ loginId: id }) => {
      const results: number[] = [];
      for (let index = 0; index < 6; index += 1) {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            loginId: id,
            password: "definitely wrong password",
            rememberMe: false,
          }),
        });
        results.push(response.status);
      }
      return results;
    },
    { loginId },
  );
  expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
  expect(statuses[5]).toBe(429);
});

test("member application, admin approval, and participant transition work end to end", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const loginId = uniqueLoginId(testInfo.project.name, "apply");
  const displayName = `신청 ${testInfo.project.name}`;
  const gameName = `E2E-${loginId}`;
  const riotId = `${gameName}#TEST`;

  await signup(page, loginId, displayName);
  await login(page, loginId, "/apply");
  await expect(page).toHaveURL(/\/apply$/u);
  await page.getByLabel("게임 이름").fill(gameName);
  await page.getByLabel("태그라인").fill("TEST");
  await page.getByRole("button", { name: "Riot 계정 검증" }).click();
  await expect(page.getByText("검증 완료")).toBeVisible();
  await page.getByLabel(/주 포지션/u).selectOption("MIDDLE");
  await page.getByLabel(/부 포지션/u).selectOption("JUNGLE");
  await page.getByLabel(/공개 순위와 프로필/u).check();
  await page.getByRole("button", { name: "참가 신청 제출" }).click();
  await expect(page).toHaveURL(/\/me\?application=submitted/u);
  await expect(
    page.getByText("관리자 검토를 기다리고 있습니다."),
  ).toBeVisible();

  await logoutByApi(page);
  await login(page, "admin", "/admin/applications", seedPassword);
  await expect(page).toHaveURL(/\/admin\/applications$/u);
  const adminLayout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    scrollX: window.scrollX,
  }));
  expect(
    adminLayout.documentWidth,
    JSON.stringify(adminLayout),
  ).toBeLessThanOrEqual(adminLayout.viewport);
  const applicationCard = page
    .locator("article.admin-application-card")
    .filter({ hasText: riotId });
  await expect(applicationCard).toBeVisible();
  await applicationCard.getByLabel("관리자 사유").fill("E2E 참가 승인 검증");
  const lateJoin = applicationCard.getByLabel(/진행 중 시즌 중도 참가/u);
  if (await lateJoin.isVisible()) {
    await lateJoin.focus();
    await lateJoin.press("Space");
    await expect(lateJoin).toBeChecked();
  }
  const approveButton = applicationCard.getByRole("button", {
    name: `${riotId} 승인`,
  });
  await approveButton.focus();
  await approveButton.press("Enter");
  const approvedRow = page.getByRole("row").filter({
    has: page.getByRole("rowheader", { name: riotId, exact: true }),
  });
  await expect(approvedRow).toContainText("APPROVED");

  await logoutByApi(page);
  await login(page, loginId);
  await expect(page).toHaveURL(/\/me$/u);
  await expect(
    page.getByRole("heading", {
      name: new RegExp(`${gameName}\\s+#TEST`, "u"),
    }),
  ).toBeVisible();
  await expect(page.getByText("참가 승인 계정")).toBeVisible();
});
