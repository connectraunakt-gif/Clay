import { loadEnvFile } from "node:process";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
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
const service = keys.find((k) => k.name === "service_role").api_key;
async function admin(path, method = "GET", body) {
  const r = await fetch(base + path, {
    method,
    headers: {
      apikey: service,
      Authorization: "Bearer " + service,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  assert.ok(r.ok, "Test setup " + r.status);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
let user, browser;
try {
  user = await admin("/auth/v1/admin/users", "POST", {
    email: "clay-dialog-" + crypto.randomUUID() + "@example.invalid",
    email_confirm: true,
  });
  const model = example();
  model.name = "Fernhouse Studio";
  const [site] = await admin("/rest/v1/websites", "POST", {
    user_id: user.id,
    model,
  });
  const link = await admin("/auth/v1/admin/generate_link", "POST", {
    type: "magiclink",
    email: user.email,
    redirect_to: live,
  });
  browser = await chromium.launch({ headless: true });
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  p.setDefaultTimeout(25000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  let edits = 0,
    pending;
  await p.route("**/functions/v1/clay", async (route) => {
    const body = route.request().postDataJSON();
    if (body?.type !== "edit") return route.continue();
    edits++;
    if (edits === 1) {
      assert.equal(body.clarification, false);
      pending = {
        request: body.prompt,
        question: "What should the heading say?",
        selected: body.selected,
        pageId: body.pageId,
        replies: [],
      };
      return route.fulfill({
        json: {
          question: pending.question,
          clarification: pending,
          baseRevision: site.revision,
        },
      });
    }
    if (edits === 2) {
      assert.equal(body.clarification.request, pending.request);
      assert.equal(body.prompt, "Small worlds, made together.");
      return route.fulfill({
        status: 503,
        json: {
          error: "The writing service is busy. Please try again shortly.",
        },
      });
    }
    if (edits === 3) {
      assert.equal(body.clarification.selected, "title");
      assert.equal(body.clarification.request, pending.request);
      assert.equal(body.prompt, "Small worlds, made together.");
      return route.fulfill({
        json: {
          operations: [
            { type: "edit_text", target: "title", value: body.prompt },
          ],
          summary: "Updated the heading.",
          baseRevision: site.revision,
        },
      });
    }
    assert.equal(
      body.clarification,
      false,
      "Finished clarification leaked into next edit",
    );
    const [current] = await admin(
      "/rest/v1/websites?id=eq." + site.id + "&select=revision",
    );
    return route.fulfill({
      json: {
        operations: [
          {
            type: "edit_text",
            target: "story-copy",
            value: "Crafted with care.",
          },
        ],
        summary: "Updated the story.",
        baseRevision: current.revision,
      },
    });
  });
  await p.goto(link.action_link);
  await p.locator(".overview-home").waitFor({ timeout: 45000 });
  await p.getByRole("button", { name: "Website", exact: true }).click();
  const frame = () => p.frameLocator("#canvas");
  await frame().locator("[data-clay-id=title]").click();
  await p.locator("#edit-prompt").fill("Change this heading");
  await p.locator("#edit-form button").click();
  await p.locator("#clarification-answer").waitFor();
  assert.equal(
    await p.locator("#clarification-question").textContent(),
    pending.question,
  );
  await p.screenshot({ path: ".playwright/clarification-dialog.png" });
  await p.setViewportSize({ width: 390, height: 844 });
  const dialog = await p.locator("#panel").boundingBox();
  assert.ok(dialog.x >= 0 && dialog.x + dialog.width <= 391);
  await p
    .getByRole("button", { name: "Apply my changes" })
    .scrollIntoViewIfNeeded();
  await p.screenshot({ path: ".playwright/clarification-mobile.png" });
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p.locator("#clarification-answer").fill("Small worlds, made together.");
  await p.getByRole("button", { name: "Apply my changes" }).click();
  await p
    .locator("#clarification-status")
    .filter({ hasText: "busy" })
    .waitFor();
  assert.equal(
    await p.locator("#clarification-answer").inputValue(),
    "Small worlds, made together.",
  );
  console.log(
    "PASS failed reply retains answer and displays recoverable inline error",
  );
  await p.getByRole("button", { name: "Close panel", exact: true }).click();
  await p.reload();
  await p.getByRole("button", { name: "Website", exact: true }).click();
  await p.locator("[data-action=resume-edit]").click();
  assert.equal(
    await p.locator("#clarification-answer").inputValue(),
    "Small worlds, made together.",
  );
  await p.getByRole("button", { name: "Apply my changes" }).click();
  await frame()
    .locator("[data-clay-id=title]")
    .filter({ hasText: "Small worlds, made together." })
    .waitFor();
  await p.locator("#clarification-form").waitFor({ state: "hidden" });
  assert.equal(await p.locator(".pending-edit").count(), 0);
  console.log(
    "PASS clarification survives reload, retries successfully and saves through real owner RPC",
  );
  await p
    .locator("#edit-prompt")
    .fill("Change the story copy to Crafted with care.");
  await p.locator("#edit-form button").click();
  await frame()
    .locator("[data-clay-id=story-copy]")
    .filter({ hasText: "Crafted with care." })
    .waitFor();
  await p.getByRole("button", { name: "Undo", exact: true }).click();
  await frame()
    .locator("[data-clay-id=story-copy]")
    .filter({ hasText: "Crafted with care." })
    .waitFor({ state: "hidden" });
  assert.match(
    await frame().locator("[data-clay-id=title]").textContent(),
    /Small worlds, made together/,
  );
  await p.getByRole("button", { name: "Redo", exact: true }).click();
  await frame()
    .locator("[data-clay-id=story-copy]")
    .filter({ hasText: "Crafted with care." })
    .waitFor();
  assert.equal(edits, 4);
  assert.deepEqual(errors, []);
  console.log(
    "PASS next edit starts fresh and undo/redo preserves earlier changes",
  );
  await p.screenshot({
    path: ".playwright/clarification-browser.png",
    fullPage: true,
  });
} finally {
  if (browser) await browser.close();
  if (user?.id) await admin("/auth/v1/admin/users/" + user.id, "DELETE");
}
