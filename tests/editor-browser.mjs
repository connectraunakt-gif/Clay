import { loadEnvFile } from "node:process";
import assert from "node:assert/strict";
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { example } from "../js/model.js";
loadEnvFile(".env");
console.log("Starting editor verification");
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
console.log("Connected to backend");
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
    signal: AbortSignal.timeout(20000),
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(r.ok, "Setup/request " + r.status);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
let user, browser;
try {
  user = await admin("/auth/v1/admin/users", "POST", {
    email: "clay-edit-" + crypto.randomUUID() + "@example.invalid",
    email_confirm: true,
  });
  const model = example();
  model.name = "Harbor Kitchen";
  model.pages[0].sections = [
    {
      id: "menu-section",
      type: "products",
      layout: "list",
      elements: [
        { id: "menu-title", type: "heading", text: "Seasonal menu" },
        {
          id: "tomato-item",
          type: "item",
          text: "Tomato soup",
          description: "Fresh basil",
          price: "₹250",
        },
        {
          id: "salad-item",
          type: "item",
          text: "Garden salad",
          description: "Seasonal greens",
          price: "₹300",
        },
      ],
    },
    {
      id: "story",
      type: "text",
      layout: "stack",
      elements: [
        { id: "story-title", type: "heading", text: "Our kitchen" },
        { id: "story-text", type: "text", text: "Cooked with care." },
      ],
    },
  ];
  model.content = [
    {
      id: "bread-content",
      name: "Sourdough bread",
      description: "Freshly baked",
      price: "₹180",
    },
    {
      id: "tea-content",
      name: "Herbal tea",
      description: "A warm cup",
      price: "₹100",
    },
  ];
  console.log("Created temporary account");
  const [site] = await admin("/rest/v1/websites", "POST", {
    user_id: user.id,
    model,
  });
  async function saved(check) {
    for (let i = 0; i < 35; i++) {
      let rows;
      try {
        rows = await admin(
          "/rest/v1/websites?id=eq." + site.id + "&select=model,revision",
        );
      } catch (error) {
        if (error.name === "TimeoutError" || error.name === "TypeError")
          continue;
        throw error;
      }
      const [s] = rows;
      if (check(s.model)) {
        await p
          .locator(`#canvas[data-revision="${s.revision}"][data-ready="true"]`)
          .waitFor();
        return s;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    await p.screenshot({
      path: ".playwright/item-drag-debug.png",
      fullPage: true,
    });
    console.log(
      "FAILED MESSAGES",
      await p.evaluate(() => window.canvasMessages),
    );
    console.log(
      "BAR",
      await p
        .frameLocator("#canvas")
        .locator(".clay-toolbar")
        .evaluate((e) => e.outerHTML),
    );
    throw Error("Saved model did not reflect edit");
  }
  const link = await admin("/auth/v1/admin/generate_link", "POST", {
    type: "magiclink",
    email: user.email,
    redirect_to: live,
  });
  browser = await chromium.launch({ headless: true });
  const p = await browser.newPage({
    viewport: { width: 1500, height: 1050 },
    reducedMotion: "reduce",
  });
  await p.addInitScript(() => {
    window.canvasMessages = [];
    addEventListener("message", (e) => {
      if (e.data?.type?.startsWith("clay-")) window.canvasMessages.push(e.data);
    });
  });
  p.setDefaultTimeout(20000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  console.log("Opening test browser");
  await p.goto(link.action_link);
  await p.locator(".overview-home").waitFor({ timeout: 45000 });
  await p.getByRole("button", { name: "Website", exact: true }).click();
  console.log("Opened website");
  const frame = () => p.frameLocator("#canvas");
  await frame().locator("[data-clay-id=menu-title]").hover();
  await frame().getByRole("button", { name: "Style", exact: true }).click();
  await p.locator("#element-style-form [name=color]").fill("#713e35");
  await p.getByRole("button", { name: "Apply to selection" }).click();
  await saved(
    (m) => m.pages[0].sections[0].elements[0].style?.color === "#713e35",
  );
  await p.locator("#element-style-form").waitFor({ state: "hidden" });
  console.log("PASS saved local style");
  // Real native HTML drag from the on-canvas handle, not a synthetic parent message.
  await frame().locator("[data-clay-id=tomato-item]").hover();
  await frame()
    .getByRole("button", { name: "Drag to rearrange" })
    .dragTo(frame().locator("[data-clay-id=salad-item]"), {
      targetPosition: { x: 50, y: 130 },
    });
  await saved((m) => m.pages[0].sections[0].itemOrder?.[1] === "tomato-item");
  console.log("PASS saved native element drag");
  await p.getByRole("button", { name: "Undo", exact: true }).click();
  await saved((m) => !m.pages[0].sections[0].itemOrder);
  await p.getByRole("button", { name: "Redo", exact: true }).click();
  await saved((m) => m.pages[0].sections[0].itemOrder?.[1] === "tomato-item");
  await frame().locator("[data-clay-id=bread-content] h3").dblclick();
  await frame()
    .locator("[data-clay-id=bread-content] h3")
    .fill("Country bread");
  await frame().locator("[data-clay-id=menu-title]").click();
  await saved((m) => m.content[0].name === "Country bread");
  console.log("PASS inline item edit");
  await frame().locator("[data-clay-id=bread-content]").hover();
  await frame()
    .getByRole("button", { name: "Drag to rearrange" })
    .dragTo(frame().locator("[data-clay-id=tea-content]"), {
      targetPosition: { x: 50, y: 130 },
    });
  await saved(
    (m) => m.pages[0].sections[0].itemOrder?.at(-1) === "bread-content",
  );
  console.log("PASS saved native catalogue drag");
  await frame().locator("[data-clay-id=bread-content]").hover();
  await frame()
    .getByRole("button", { name: "Drag to rearrange" })
    .dragTo(frame().locator("[data-clay-id=tomato-item]"), {
      targetPosition: { x: 50, y: 20 },
    });
  await saved((m) => m.pages[0].sections[0].itemOrder?.[1] === "bread-content");
  console.log("PASS mixed menu/catalogue rearranging");
  // Move across sections through the touch/keyboard-accessible position controls.
  await frame().locator("[data-clay-id=menu-title]").hover();
  await frame().getByRole("button", { name: "Move", exact: true }).click();
  await p.locator("#move-form [name=sectionId]").selectOption("story");
  await p.locator("#move-form [name=position]").fill("2");
  await p.getByRole("button", { name: "Move here" }).click();
  await saved((m) => m.pages[0].sections[1].elements[1].id === "menu-title");
  await p.reload();
  await frame()
    .locator("[data-clay-id=menu-title]")
    .waitFor({ timeout: 45000 });
  assert.equal(
    await frame()
      .locator("[data-clay-id=menu-title]")
      .evaluate((e) => e.closest("section").id),
    "story",
  );
  // Item edit panel has manual image controls; adding an image must save and render.
  await frame().locator("[data-clay-id=tea-content]").hover();
  await frame().getByRole("button", { name: "Edit", exact: true }).click();
  await p
    .locator("#content-form [name=src]")
    .fill(
      "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80",
    );
  await p.getByRole("button", { name: "Save item" }).click();
  await saved((m) => !!m.content.find((c) => c.id === "tea-content").src);
  await frame().locator("[data-clay-id=tea-content] img").waitFor();
  await p.screenshot({
    path: ".playwright/editor-controls-fixed.png",
    fullPage: true,
  });
  await p.getByRole("button", { name: "Mobile preview" }).click();
  assert.equal(
    await frame()
      .locator("html")
      .evaluate((e) => e.scrollWidth > innerWidth),
    false,
  );
  await p.screenshot({
    path: ".playwright/editor-controls-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS hover edit/style/move, native element & item dragging, inline item text, undo/redo, cross-section move, saved reload, item photo, mobile overflow",
  );
} finally {
  if (browser) await browser.close();
  if (user?.id) await admin("/auth/v1/admin/users/" + user.id, "DELETE");
}
