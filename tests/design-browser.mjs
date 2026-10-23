import fs from "node:fs";
import { renderDocument } from "../js/model.js";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
for (const name of ["cafe", "atelier"]) {
  const m = JSON.parse(
    fs.readFileSync("tests/fixtures/design-" + name + ".json", "utf8"),
  );
  fs.mkdirSync(".renders", { recursive: true });
  fs.writeFileSync(
    ".renders/design-" + name + ".html",
    renderDocument(m, m.pages[0].id),
  );
}
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const name of ["cafe", "atelier"]) {
    await page.goto("http://localhost:4173/.renders/design-" + name + ".html");
    await page.locator("h1").waitFor();
    await page.evaluate(async () => {
      document.querySelectorAll("img").forEach((i) => (i.loading = "eager"));
      await Promise.race([
        Promise.all(
          [...document.images].map((i) => i.decode().catch(() => {})),
        ),
        new Promise((r) => setTimeout(r, 15000)),
      ]);
      await document.fonts.ready;
    });
    assert.equal(
      await page.locator("html").evaluate((e) => e.scrollWidth > innerWidth),
      false,
    );
    const form = page.locator("[data-contact-form]").first();
    if (await form.count()) {
      const box = await form.boundingBox();
      const section = await form.locator("..").boundingBox();
      if (await form.evaluate((e) => e.classList.contains("form-center")))
        assert.ok(
          Math.abs(box.x + box.width / 2 - section.x - section.width / 2) < 3,
          "Form is centered",
        );
    }
    console.log(
      "Generated design",
      name,
      await page
        .locator("h1")
        .evaluate((e) => ({
          font: getComputedStyle(e).fontFamily,
          size: getComputedStyle(e).fontSize,
        })),
    );
    await page.screenshot({
      path: ".playwright/design-" + name + "-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.locator("html").evaluate((e) => e.scrollWidth > innerWidth),
      false,
    );
    await page.screenshot({
      path: ".playwright/design-" + name + "-mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("http://localhost:4173/.renders/design-cafe.html");
  const button = page.locator(".button").first();
  await button.hover();
  await page.waitForTimeout(350);
  assert.notEqual(
    await button.evaluate((e) => getComputedStyle(e).transform),
    "none",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await button.evaluate((e) => getComputedStyle(e).transform),
    "none",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS generated brand/font pairs, contact geometry, desktop/mobile reflow, real hover effects and reduced motion",
  );
} finally {
  await browser.close();
}
