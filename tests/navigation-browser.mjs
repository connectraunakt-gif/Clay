import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir(".playwright", { recursive: true });
const browser = await chromium.launch({ headless: true });
const p = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://localhost:4173");
assert.equal(await p.locator(".splash,video").count(), 0);
await p.getByRole("button", { name: /Explore the editor/ }).click();
await p.locator("#canvas").waitFor();
await p.getByRole("button", { name: "Home", exact: true }).click();
assert.equal(await p.locator("iframe").count(), 0);
assert.equal(await p.locator(".home-sidebar").count(), 0);
await p.getByRole("heading", { name: "Your website", exact: true }).waitFor();
await p.screenshot({
  path: ".playwright/oct23-home-desktop.png",
  fullPage: true,
});
await p.getByRole("button", { name: "Website", exact: true }).click();
await p.locator("#canvas").waitFor();
await p.screenshot({
  path: ".playwright/oct23-website-desktop.png",
  fullPage: true,
});
await p.getByRole("button", { name: "Profile", exact: true }).click();
await p.getByRole("heading", { name: "Your profile", exact: true }).waitFor();
await p.screenshot({
  path: ".playwright/oct23-profile-desktop.png",
  fullPage: true,
});
for (const label of ["Name", "Email", "Business type", "Location"])
  await p.getByLabel(label, { exact: true }).waitFor();
await p.getByRole("button", { name: "Preferences", exact: true }).click();
await p.getByLabel("Dark mode", { exact: true }).check();
await p.getByRole("button", { name: "Profile", exact: true }).last().click();
await p.screenshot({
  path: ".playwright/oct23-profile-dark.png",
  fullPage: true,
});
await p.getByRole("button", { name: "Preferences", exact: true }).click();
await p.getByLabel("Light mode", { exact: true }).check();
for (const width of [390, 768]) {
  await p.setViewportSize({ width, height: 844 });
  for (const name of ["Home", "Website", "Profile"]) {
    await p
      .locator(".app-header")
      .getByRole("button", { name, exact: true })
      .click();
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      name + " overflow " + width,
    );
    if (width === 390 && name === "Website") {
      const rect = await p.locator("#edit-prompt").boundingBox();
      assert.ok(
        rect && rect.y >= 0 && rect.y + rect.height <= 844,
        "AI input stays within mobile viewport",
      );
    }
    if (width === 390)
      await p.screenshot({
        path: ".playwright/oct23-" + name.toLowerCase() + "-mobile.png",
        fullPage: true,
      });
  }
}
assert.deepEqual(errors, []);
console.log(
  "PASS splash removal, isolated Home/Website, profile fields, theme and mobile navigation",
);
await browser.close();
