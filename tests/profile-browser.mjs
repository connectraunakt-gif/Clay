import { loadEnvFile } from "node:process";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { example } from "../js/model.js";
loadEnvFile(".env");
const base = "https://auzhsqhcajzarhtvxrke.supabase.co",
  live = process.env.CLAY_TEST_URL || "http://localhost:4173/";
const keys = await (
  await fetch(
    "https://api.supabase.com/v1/projects/auzhsqhcajzarhtvxrke/api-keys",
    {
      headers: { Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN },
      signal: AbortSignal.timeout(20000),
    },
  )
).json();
const service = keys.find((x) => x.name === "service_role").api_key;
async function call(
  path,
  { method = "POST", body, key = service, token = service, raw = false } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      apikey: key,
      Authorization: "Bearer " + token,
      ...(raw
        ? { "Content-Type": "image/jpeg", "x-upsert": "true" }
        : { "Content-Type": "application/json" }),
    },
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  const t = await r.text();
  return { status: r.status, data: t ? JSON.parse(t) : null };
}
const users = [];
let browser;
try {
  for (let i = 0; i < 2; i++) {
    const email = "clay-profile-" + crypto.randomUUID() + "@example.invalid",
      password = crypto.randomUUID() + "Aa9!";
    const u = await call("/auth/v1/admin/users", {
      body: { email, password, email_confirm: true },
    });
    assert.equal(u.status, 200);
    const auth = await call("/auth/v1/token?grant_type=password", {
      body: { email, password },
      key: process.env.CLAY_PUBLIC_KEY,
      token: process.env.CLAY_PUBLIC_KEY,
    });
    users.push({ ...u.data, token: auth.data.access_token });
  }
  await call("/rest/v1/websites", {
    body: { user_id: users[0].id, model: example() },
  });
  const link = await call("/auth/v1/admin/generate_link", {
    body: { type: "magiclink", email: users[0].email, redirect_to: live },
  });
  browser = await chromium.launch({ headless: true });
  const p = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(link.data.action_link);
  await p.locator(".overview-home").waitFor({ timeout: 45000 });
  assert.equal(await p.locator("iframe").count(), 0);
  await p.getByRole("button", { name: "Website", exact: true }).click();
  await p.locator("#canvas").waitFor();
  await p.reload();
  await p.locator("#canvas").waitFor();
  assert.equal(new URL(p.url()).hash, "#website");
  console.log("PASS Website opens saved site directly and survives reload");
  await p.getByRole("button", { name: "Home", exact: true }).click();
  assert.equal(await p.locator("iframe").count(), 0);
  await p.keyboard.press("Control+z");
  assert.equal(await p.locator("iframe").count(), 0);
  await p.getByRole("button", { name: "Profile", exact: true }).click();
  await p.getByLabel("Name", { exact: true }).fill("Clay Profile Test");
  await p.getByLabel("Business type", { exact: true }).selectOption("Retail");
  await p.getByLabel("Location", { exact: true }).fill("Delhi, India");
  await p.getByRole("button", { name: "Save", exact: true }).click();
  await p.getByText("Changes saved.", { exact: true }).waitFor();
  await p.reload();
  await p.getByLabel("Name", { exact: true }).waitFor();
  assert.equal(
    await p.getByLabel("Name", { exact: true }).inputValue(),
    "Clay Profile Test",
  );
  assert.equal(
    await p.getByLabel("Location", { exact: true }).inputValue(),
    "Delhi, India",
  );
  assert.equal(
    await p.getByLabel("Business type", { exact: true }).inputValue(),
    "Retail",
  );
  console.log("PASS profile fields persist");
  const photo = await p.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 80;
    const x = c.getContext("2d");
    x.fillStyle = "#344e68";
    x.fillRect(0, 0, 80, 80);
    return c.toDataURL("image/jpeg").split(",")[1];
  });
  const bytes = Buffer.from(photo, "base64");
  await writeFile(".playwright/profile-test.jpg", bytes);
  await p
    .locator("#profile-picture")
    .setInputFiles(".playwright/profile-test.jpg");
  await p
    .getByText("Profile picture saved.", { exact: true })
    .waitFor({ timeout: 30000 });
  await p.reload();
  await p.locator(".profile-photo-preview img").waitFor();
  await p.waitForFunction(
    () =>
      document.querySelector(".profile-photo-preview img")?.naturalWidth > 0,
  );
  console.log("PASS private profile picture persists and loads");
  const target = users[0].id + "/avatar.jpg";
  const denied = await call("/storage/v1/object/clay-avatars/" + target, {
    raw: true,
    body: bytes,
    key: process.env.CLAY_PUBLIC_KEY,
    token: users[1].token,
  });
  assert.ok(denied.status >= 400);
  const read = await call("/storage/v1/object/sign/clay-avatars/" + target, {
    body: { expiresIn: 60 },
    key: process.env.CLAY_PUBLIC_KEY,
    token: users[1].token,
  });
  assert.ok(read.status >= 400);
  console.log("PASS cross-account avatar read/write denial");
  await p
    .locator(".account-sidebar")
    .getByRole("button", { name: "Business info", exact: true })
    .click();
  await p.getByLabel("Business name", { exact: true }).fill("Updated studio");
  await p.getByRole("button", { name: "Save", exact: true }).click();
  await p.getByText("Changes saved.", { exact: true }).waitFor();
  assert.equal(await p.locator("iframe").count(), 0);
  assert.equal(new URL(p.url()).hash, "#profile");
  await p.getByRole("button", { name: "Home", exact: true }).click();
  await p
    .getByRole("heading", { name: "Updated studio", exact: true })
    .waitFor();
  console.log("PASS profile business saves do not open editor");
  await p.getByRole("button", { name: "Profile", exact: true }).click();
  await p.getByRole("button", { name: "Security", exact: true }).click();
  await p.getByRole("button", { name: "Sign out", exact: true }).click();
  await p
    .getByRole("button", { name: "Create my website", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS real-session navigation and profile have no JavaScript errors",
  );
  const google = await fetch(
    base +
      "/auth/v1/authorize?provider=google&redirect_to=" +
      encodeURIComponent("https://connectraunakt-gif.github.io/Clay/"),
    { redirect: "manual" },
  );
  assert.equal(google.status, 302);
  assert.equal(
    new URL(google.headers.get("location")).hostname,
    "accounts.google.com",
  );
  console.log("PASS Google OAuth redirects to Google");
} finally {
  if (browser) await browser.close();
  if (users[0])
    await call("/storage/v1/object/clay-avatars", {
      method: "DELETE",
      body: { prefixes: [users[0].id + "/avatar.jpg"] },
    });
  for (const u of users)
    await call("/auth/v1/admin/users/" + u.id, { method: "DELETE" });
  console.log("Temporary profile accounts and uploaded image removed.");
}
