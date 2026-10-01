import { loadEnvFile } from "node:process";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { example } from "../js/model.js";
loadEnvFile(".env");
const url = "https://auzhsqhcajzarhtvxrke.supabase.co",
  live =
    process.env.CLAY_TEST_URL || "https://connectraunakt-gif.github.io/Clay/";
const keys = await (
  await fetch(
    "https://api.supabase.com/v1/projects/auzhsqhcajhtvxrke/api-keys".replace(
      "auzhsqhcajhtvxrke",
      "auzhsqhcajzarhtvxrke",
    ),
    {
      headers: { Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN },
    },
  )
).json();
const service = keys.find((k) => k.name === "service_role").api_key;
async function admin(path, method = "POST", body) {
  const r = await fetch(url + path, {
    method,
    headers: {
      apikey: service,
      Authorization: "Bearer " + service,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(r.ok, "Admin test setup " + r.status);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}
let user, browser;
try {
  const email = "clay-browser-" + crypto.randomUUID() + "@example.invalid";
  user = await admin("/auth/v1/admin/users", "POST", {
    email,
    email_confirm: true,
  });
  await admin("/rest/v1/websites", "POST", {
    user_id: user.id,
    model: example(),
  });
  const link = await admin("/auth/v1/admin/generate_link", "POST", {
    type: "magiclink",
    email,
    redirect_to: live,
  });
  assert.ok(link.action_link);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(link.action_link);
  await page
    .getByRole("heading", { name: "Tell us about your business." })
    .waitFor({ timeout: 45000 });
  console.log("PASS real magic-link sign-in");
  await page.reload();
  await page
    .getByRole("heading", { name: "Tell us about your business." })
    .waitFor();
  console.log("PASS session persistence after reload");
  await page.screenshot({
    path: ".playwright/home-authenticated.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Forma.*Open website/ }).click();
  const heading = page
    .frameLocator("#canvas")
    .getByRole("heading", { name: /Made slowly/ });
  await heading.waitFor();
  await heading.dblclick();
  await heading.fill("Handmade for your home.");
  await page
    .getByRole("button", { name: "Website tools", exact: true })
    .click();
  await page.waitForTimeout(1800);
  if (await page.locator("#panel").isVisible())
    await page.getByRole("button", { name: "Close panel" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Forma.*Open website/ }).click();
  await page
    .frameLocator("#canvas")
    .getByRole("heading", { name: "Handmade for your home." })
    .waitFor();
  console.log("PASS visual edit persists in real database");
  await page.screenshot({
    path: ".playwright/live-editor.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .locator("#panel")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create my website", exact: true })
    .waitFor();
  console.log("PASS sign-out");
  assert.deepEqual(errors, []);
  console.log("PASS live browser has no JavaScript errors");
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (user?.id) await admin("/auth/v1/admin/users/" + user.id, "DELETE");
  console.log("Temporary browser test account removed.");
}
