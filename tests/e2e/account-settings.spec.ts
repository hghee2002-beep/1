import { expect, test, type Page } from "@playwright/test";

const initialPassword = "browser account password 2026";
const replacementPassword = "browser replacement password 2026";

function uniqueLoginId(projectName: string) {
  const project = projectName.toLowerCase().replaceAll(/[^a-z0-9]/gu, "");
  return `acct-${project.slice(0, 8)}-${Date.now().toString(36)}`.slice(0, 32);
}

async function signup(page: Page, loginId: string) {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 150) + 20}`,
  });
  await page.goto("/signup");
  await page.getByLabel("로그인 ID").fill(loginId);
  await page.getByLabel("표시 이름").fill("계정 설정 브라우저 사용자");
  await page.getByLabel("비밀번호", { exact: true }).fill(initialPassword);
  await page.getByLabel("비밀번호 확인").fill(initialPassword);
  await page.getByLabel(/게시 중인 이용약관/u).check();
  await page.getByLabel(/게시 중인 개인정보/u).check();
  await page.getByRole("button", { name: "계정 만들기" }).click();
  await expect(page).toHaveURL(/\/login\?registered=1/u);
}

async function login(page: Page, loginId: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("로그인 ID").fill(loginId);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}

test("a member changes the password and every session is signed out", async ({
  page,
  context,
}, testInfo) => {
  const loginId = uniqueLoginId(testInfo.project.name);
  await signup(page, loginId);
  await login(page, loginId, initialPassword);
  await expect(page).toHaveURL(/\/me$/u);

  await page.getByRole("button", { name: /비밀번호 변경/u }).click();
  const form = page.locator("form.account-password-form");
  await form.getByLabel("현재 비밀번호").fill(initialPassword);
  await form
    .getByLabel("새 비밀번호", { exact: true })
    .fill(replacementPassword);
  await form.getByLabel("새 비밀번호 확인").fill(replacementPassword);
  await form.getByRole("button", { name: "비밀번호 변경" }).click();

  await expect(page).toHaveURL(/\/login\?passwordChanged=1/u);
  await expect(
    page.getByText(/모든 기기에서 로그아웃되었습니다/u),
  ).toBeVisible();
  expect(
    (await context.cookies()).some(
      (cookie) => cookie.name === "deluxe_session",
    ),
  ).toBe(false);
  expect((await page.request.get("/api/auth/session")).status()).toBe(401);

  await page.getByLabel("로그인 ID").fill(loginId);
  await page.getByLabel("비밀번호").fill(initialPassword);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByText("로그인 ID 또는 비밀번호가 올바르지 않습니다."),
  ).toBeVisible();

  await page.getByLabel("비밀번호").fill(replacementPassword);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/me$/u);
});

test("an approved participant refreshes Riot identity by PUUID in Mock mode", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name.toLowerCase().includes("mobile") ||
      testInfo.project.name.includes("390"),
    "the server-side PUUID refresh contract is project-independent",
  );
  await login(
    page,
    "player01",
    process.env.SEED_PASSWORD ?? "DeluxeSoloq-Dev-Only-2026!",
  );
  await expect(page).toHaveURL(/\/me$/u);
  await expect(page.getByRole("link", { name: /Riot ID 갱신/u })).toHaveCount(
    0,
  );

  await page.getByRole("button", { name: /Riot ID 갱신/u }).click();
  await expect(page.locator(".account-settings-status")).toContainText(
    "GraphiteCarry#KR001 · EMERALD I 88 LP로 갱신했습니다.",
  );
  await expect(page.getByText("참가 승인 계정")).toBeVisible();
});
