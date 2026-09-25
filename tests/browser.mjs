import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1050 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir(".playwright", { recursive: true });
await page.goto("http://localhost:4173");
await page.getByRole("button", { name: "Create my website" }).waitFor();
await page.screenshot({ path: ".playwright/landing.png", fullPage: true });
await page.getByRole("button", { name: /Explore the editor/ }).click();
await page
  .frameLocator("#canvas")
  .getByRole("heading", { name: /Made slowly/ })
  .waitFor();
await page.screenshot({ path: ".playwright/editor.png", fullPage: true });
await page.getByRole("button", { name: "Website tools", exact: true }).click();
await page.getByRole("button", { name: /Look & feel/ }).click();
await page.locator("[name=accent]").fill("#513f69");
await page.getByRole("button", { name: "Apply style" }).click();
await page.getByRole("button", { name: "Undo", exact: true }).click();
await page.getByRole("button", { name: "Redo", exact: true }).click();
await page.getByRole("button", { name: "Pages", exact: true }).click();
await page.getByPlaceholder("About us").fill("About");
await page.getByRole("button", { name: "Add page" }).click();
await page.locator("#page-name").filter({ hasText: "About" }).waitFor();
await page.getByRole("button", { name: "Arrange sections" }).click();
await page.locator("[name=type]").selectOption("contact");
await page.getByRole("button", { name: "Add section" }).click();
await page.getByRole("button", { name: "Close panel" }).click();
await page
  .getByRole("button", { name: "Previous versions", exact: true })
  .click();
await page.getByRole("heading", { name: "Previous versions" }).waitFor();
await page.getByRole("button", { name: "Close panel" }).click();
await page.getByRole("button", { name: "Profile", exact: true }).click();
await page.getByRole("heading", { name: "A little perspective" }).waitFor();
await page.getByRole("button", { name: "Settings", exact: true }).click();
await page.getByRole("button", { name: "Switch light / dark mode" }).click();
await page.getByRole("button", { name: "Close panel" }).click();
await page.screenshot({ path: ".playwright/profile-dark.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Website", exact: true }).click();
await page.screenshot({
  path: ".playwright/mobile-editor.png",
  fullPage: true,
});
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > innerWidth,
);
if (overflow) throw Error("Mobile horizontal overflow");
await page.getByRole("link", { name: "Clay home" }).click();
await page.screenshot({
  path: ".playwright/mobile-landing.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Create my website" }).click();
await page.getByRole("button", { name: "Continue with Google" }).waitFor();
await page.screenshot({ path: ".playwright/mobile-auth.png", fullPage: true });
console.log(
  JSON.stringify({
    errors,
    mobileOverflow: overflow,
    checks:
      "landing, editor, style, undo, redo, pages, sections, history, profile, dark mode, mobile, auth",
  }),
);
await browser.close();
if (errors.length) process.exitCode = 1;
