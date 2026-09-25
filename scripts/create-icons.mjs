import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const bytes = await readFile("assets/logo.png");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:#24272c;width:100vw;height:100vh;display:grid;place-items:center"><img style="width:100%;height:100%;object-fit:contain" src="data:image/png;base64,${bytes.toString("base64")}"></body></html>`,
  );
  await page.locator("img").evaluate((i) => i.decode());
  await page.screenshot({ path: "assets/icon-" + size + ".png" });
}
await browser.close();
const manifest = JSON.parse(await readFile("manifest.webmanifest", "utf8"));
manifest.icons = [192, 512].map((size) => ({
  src: "assets/icon-" + size + ".png",
  sizes: size + "x" + size,
  type: "image/png",
  purpose: "any",
}));
await writeFile("manifest.webmanifest", JSON.stringify(manifest, null, 2));
let sw = await readFile("sw.js", "utf8");
sw = sw.replace(
  "'assets/logo.png'",
  "'assets/logo.png','assets/icon-192.png','assets/icon-512.png'",
);
await writeFile("sw.js", sw);
