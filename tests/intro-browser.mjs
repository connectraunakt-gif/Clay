import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
const p = await browser.newPage();
await p.goto("http://localhost:4173");
await p.locator(".video-intro video").waitFor();
await p.waitForFunction(
  () => document.querySelector(".video-intro video")?.currentTime > 0,
);
console.log("PASS Blender intro plays");
await p.getByRole("button", { name: "Skip intro" }).click();
assert.equal(await p.locator(".video-intro").count(), 0);
await p.getByRole("button", { name: "Flowers example" }).click();
await p.locator(".sample-nav b").filter({ hasText: "wildflower" }).waitFor();
await p.getByRole("button", { name: "Create my website", exact: true }).click();
await p.screenshot({ path: ".playwright/auth-desktop.png", fullPage: true });
await browser.close();
console.log("PASS intro skip, showcase controls and sign-in layout");
