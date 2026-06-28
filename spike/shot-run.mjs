import { chromium } from "playwright";
const out = process.argv[2] || "/tmp";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1300, height: 1100 });
await page.goto("http://localhost:3000/run", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Review pr-1/ }).click();
console.log("clicked Review — waiting for it to finish…");
// mid-run shot
await page.waitForTimeout(9000);
await page.screenshot({ path: `${out}/run-midway.png`, fullPage: true });
// wait for completion
await page.getByText("open full report").waitFor({ timeout: 200000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/run-done.png`, fullPage: true });
console.log("saved run-midway.png and run-done.png");
await browser.close();
