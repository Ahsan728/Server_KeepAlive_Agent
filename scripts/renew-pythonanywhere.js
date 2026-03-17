const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const LOGIN_URL = "https://www.pythonanywhere.com/login/";
const RENEW_BUTTON_TEXT = /Run until 1 month from today/i;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function isVisible(locator) {
  try {
    return await locator.isVisible();
  } catch {
    return false;
  }
}

async function dismissCookieBanner(page) {
  const closeButton = page.locator(
    "#id_cookie_warning_marker_for_response_middleware .close",
  );

  if (await isVisible(closeButton)) {
    await closeButton.click();
  }
}

async function capture(page, artifactDir, name) {
  const filePath = path.join(artifactDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
}

async function readDisableMessage(page) {
  const locator = page.locator("text=/This site will be disabled on/i").first();
  if (!(await isVisible(locator))) {
    return null;
  }

  const rawText = await locator.textContent();
  return rawText ? rawText.trim().replace(/\s+/g, " ") : null;
}

async function goToWebTab(page, webAppLabel) {
  await page.getByRole("link", { name: /^Web$/ }).click();
  await page.waitForURL(/\/webapps\//, { timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});

  if (!webAppLabel) {
    return;
  }

  const webAppTab = page.getByRole("link", {
    name: new RegExp(escapeRegex(webAppLabel), "i"),
  });

  if (await webAppTab.count()) {
    await webAppTab.first().click();
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  }
}

async function renew(page, artifactDir) {
  const button = page.getByRole("button", { name: RENEW_BUTTON_TEXT }).first();
  await button.waitFor({ state: "visible", timeout: 30_000 });

  const beforeMessage = await readDisableMessage(page);
  await capture(page, artifactDir, "before-renew");

  const postBackPromise = page
    .waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/webapps/"),
      { timeout: 15_000 },
    )
    .catch(() => null);

  await button.click();
  const postBack = await postBackPromise;
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2_000);

  const afterMessage = await readDisableMessage(page);
  await capture(page, artifactDir, "after-renew");

  return { beforeMessage, afterMessage, postBackObserved: Boolean(postBack) };
}

async function main() {
  const login = getRequiredEnv("PYTHONANYWHERE_LOGIN");
  const password = getRequiredEnv("PYTHONANYWHERE_PASSWORD");
  const webAppLabel = process.env.PYTHONANYWHERE_WEBAPP_LABEL?.trim();
  const artifactDir = path.resolve(process.env.ARTIFACT_DIR || "artifacts");

  await fs.mkdir(artifactDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("Opening PythonAnywhere login page");
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await dismissCookieBanner(page);

    console.log("Submitting login form");
    await page.fill("#id_auth-username", login);
    await page.fill("#id_auth-password", password);

    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 60_000 }),
      page.locator("#id_next").click(),
    ]);

    if (page.url().includes("/login")) {
      const errorText = (await page.locator("body").textContent()) || "Unknown login error";
      throw new Error(`Login did not complete successfully. ${errorText.trim().slice(0, 400)}`);
    }

    console.log("Navigating to the Web tab");
    await dismissCookieBanner(page);
    await goToWebTab(page, webAppLabel);

    if (!page.url().includes("/webapps/")) {
      throw new Error(`Expected to reach the Web page, but current URL is ${page.url()}`);
    }

    console.log("Renewing the web app");
    const { beforeMessage, afterMessage, postBackObserved } = await renew(page, artifactDir);

    console.log(`Before: ${beforeMessage || "not found"}`);
    console.log(`After: ${afterMessage || "not found"}`);
    console.log(`Renew POST observed: ${postBackObserved ? "yes" : "no"}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
