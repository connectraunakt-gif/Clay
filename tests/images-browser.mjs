import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
await page.goto("http://localhost:4173");
await page.getByRole("button", { name: /Explore the editor/ }).click();
await page.frameLocator("#canvas").locator("img").waitFor();
await page.waitForTimeout(2500);
console.log(
  await page
    .frameLocator("#canvas")
    .locator("img")
    .evaluateAll((imgs) =>
      imgs.map((i) => ({
        src: i.getAttribute("src"),
        loaded: i.complete && i.naturalWidth > 0,
      })),
    ),
);
await page.screenshot({ path: ".playwright/editor-loaded.png" });
await browser.close();
