import { loadEnvFile } from "node:process";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
loadEnvFile(".env");
const base = "https://auzhsqhcajzarhtvxrke.supabase.co",
  live = process.env.CLAY_TEST_URL || "http://localhost:4173/";
const keys = await (
  await fetch(
    "https://api.supabase.com/v1/projects/auzhsqhcajzarhtvxrke/api-keys",
    {
      headers: { Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN },
    },
  )
).json();
const service = keys.find((k) => k.name === "service_role").api_key;
async function admin(path, method = "POST", body) {
  const r = await fetch(base + path, {
    method,
    headers: {
      apikey: service,
      Authorization: "Bearer " + service,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  assert.ok(r.ok, "test setup " + r.status);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
let user, browser;
try {
  const email = "clay-cafe-ui-" + crypto.randomUUID() + "@example.invalid";
  user = await admin("/auth/v1/admin/users", "POST", {
    email,
    email_confirm: true,
  });
  const link = await admin("/auth/v1/admin/generate_link", "POST", {
    type: "magiclink",
    email,
    redirect_to: live,
  });
  browser = await chromium.launch({ headless: true });
  const p = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(link.action_link);
  await p.locator(".overview-home").waitFor({ timeout: 45000 });
  await p
    .getByRole("button", { name: "Create my website", exact: true })
    .click();
  await p
    .getByPlaceholder("I run a small business called…")
    .fill(
      "Brew & Bloom is a cozy, modern café serving handcrafted coffee, freshly baked pastries, and delicious breakfast options. We create the perfect space for friends, students, and remote workers to relax, connect, and enjoy great coffee.",
    );
  const started = Date.now();
  await p.getByRole("button", { name: "Start creating" }).click();
  await p.waitForFunction(
    () =>
      !!document.querySelector("#answer") ||
      !!document.querySelector("#generation-status") ||
      !!document.querySelector("#canvas"),
    {},
    { timeout: 120000 },
  );
  let questions = 0;
  while (await p.locator("#answer").count()) {
    questions++;
    assert.ok(questions <= 5);
    await p
      .locator("#answer")
      .fill(
        "Warm cream and sage green. We want exactly four sections: hero, our story, menu, contact. No testimonials. Let people email hello@example.com. Do not invent an address, prices or opening hours.",
      );
    await p.locator("#answer-form button.primary").click();
  }
  let dropped = 0;
  await p.route("**/functions/v1/clay", async (route) => {
    if (route.request().method() === "POST") {
      const b = route.request().postDataJSON();
      if (b.type === "generation_status" && b.jobId && dropped < 2) {
        dropped++;
        return route.fulfill({
          status: 503,
          headers: { "Access-Control-Allow-Origin": new URL(live).origin },
          json: { error: "Temporary connection failure" },
        });
      }
    }
    return route.continue();
  });
  await p.locator("#canvas").waitFor({ timeout: 160000 });
  await p.frameLocator("#canvas").locator("h1").first().waitFor();
  const seconds = Math.round((Date.now() - started) / 1000);
  const images = p.frameLocator("#canvas").locator("img");
  if (await images.count())
    await images.first().evaluate((image) => image.decode().catch(() => {}));
  await p
    .frameLocator("#canvas")
    .locator("body")
    .evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        document.getAnimations().map((a) => a.finished.catch(() => {})),
      );
    });
  await p.screenshot({
    path: ".playwright/cafe-generation-fixed.png",
    fullPage: true,
  });
  assert.equal(
    await p.getByRole("heading", { name: "Let’s pick up from here." }).count(),
    0,
  );
  const row = await admin(
    "/rest/v1/websites?select=id,model&user_id=eq." + user.id,
    "GET",
  );
  assert.equal(row.length, 1);
  assert.equal(row[0].model.pages.flatMap((x) => x.sections).length, 4);
  assert.ok(row[0].model.name.includes("Brew"));
  await p.reload();
  await p.locator("#canvas").waitFor();
  await p
    .frameLocator("#canvas")
    .locator(".brand")
    .filter({ hasText: "Brew" })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS real browser description → questions → generated editor → reload",
    {
      questions,
      seconds,
      transientPollFailures: dropped,
      photos: await images.count(),
    },
  );
} finally {
  if (browser) await browser.close();
  if (user?.id) await admin("/auth/v1/admin/users/" + user.id, "DELETE");
  console.log("Temporary cafe browser account removed.");
}
