import { chromium } from "playwright";
const out = process.argv[2] || "/tmp";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1300, height: 1000 });
for (const [name, url] of [["overview", "http://localhost:3000"], ["pr", "http://localhost:3000/pr/pr-1"]]) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/cockpit-${name}.png`, fullPage: true });
  console.log("saved", `${out}/cockpit-${name}.png`);
}
await browser.close();
