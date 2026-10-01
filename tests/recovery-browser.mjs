import { loadEnvFile } from "node:process";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
loadEnvFile(".env");
const url = "https://auzhsqhcajzarhtvxrke.supabase.co";
const keys = await (
  await fetch(
    "https://api.supabase.com/v1/projects/auzhsqhcajzarhtvxrke/api-keys",
    {
      headers: { Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN },
    },
  )
).json();
const key = keys.find((k) => k.name === "service_role").api_key;
async function admin(path, method, body) {
  const r = await fetch(url + path, {
    method,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(r.ok, "setup " + r.status);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
let user, browser, p;
try {
  const email = "clay-recovery-" + crypto.randomUUID() + "@example.invalid";
  user = await admin("/auth/v1/admin/users", "POST", {
    email,
    email_confirm: true,
  });
  const link = await admin("/auth/v1/admin/generate_link", "POST", {
    type: "magiclink",
    email,
    redirect_to: "http://localhost:4173/",
  });
  browser = await chromium.launch({ headless: true });
  p = await browser.newPage({
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  await p.goto(link.action_link);
  await p
    .getByRole("heading", { name: "Tell us about your business." })
    .waitFor();
  await p.route("**/functions/v1/clay", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const b = route.request().postDataJSON();
    if (b.type === "questions")
      return route.fulfill({ json: { questions: [] } });
    if (b.type === "generation_start")
      return route.fulfill({
        status: 503,
        json: { error: "The writing service is temporarily busy." },
      });
    return route.continue();
  });
  await p
    .getByPlaceholder("I run a small business called…")
    .fill("I run a pottery studio called Test Clay.");
  await p.getByRole("button", { name: "Start creating" }).click();
  await p.getByRole("heading", { name: "Let’s pick up from here." }).waitFor();
  assert.ok(
    await p
      .getByText("The writing service is temporarily busy.", { exact: true })
      .isVisible(),
  );
  assert.ok(
    await p.evaluate(() =>
      Object.values(sessionStorage).some((v) => v.includes("pottery studio")),
    ),
  );
  console.log(
    "PASS simulated upstream failure preserves brief and displays safe server message",
  );
  await p.getByRole("button", { name: "Start with a blank website" }).click();
  await p
    .frameLocator("#canvas")
    .getByRole("heading", { name: "A home for your business." })
    .waitFor();
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await p.reload();
  await p.locator(".site-row").filter({ hasText: "My business" }).waitFor();
  console.log("PASS real blank website saves and survives reload");
  await p.getByRole("button", { name: "Profile", exact: true }).click();
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  console.log("PASS mobile Home, editor and Profile fit viewport");
} catch (e) {
  await p?.screenshot({
    path: ".playwright/recovery-failure.png",
    fullPage: true,
  });
  console.log("Page after failure:", await p?.locator("body").innerText());
  throw e;
} finally {
  if (browser) await browser.close();
  if (user?.id) await admin("/auth/v1/admin/users/" + user.id, "DELETE");
  console.log("Recovery test account removed.");
}
