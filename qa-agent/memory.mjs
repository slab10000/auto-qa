// File-based product memory under .autoqa/ — the single source of truth the cockpit reads.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const AUTOQA = path.join(ROOT, ".autoqa");

export const paths = {
  autoqa: AUTOQA,
  mainDir: path.join(AUTOQA, "main"),
  mainBehaviors: path.join(AUTOQA, "main", "behaviors"),
  mainSkills: path.join(AUTOQA, "main", "skills"),
  mainScreens: path.join(AUTOQA, "main", "screens.json"),
  screenshots: (branch) => path.join(AUTOQA, "screenshots", branch),
  prDir: (pr) => path.join(AUTOQA, "prs", pr),
  prScreens: (pr) => path.join(AUTOQA, "prs", pr, "screenshots"),
  prReport: (pr) => path.join(AUTOQA, "prs", pr, "report.json"),
  prComparison: (pr) => path.join(AUTOQA, "prs", pr, "comparison.md"),
};

export async function ensureDir(d) {
  if (!existsSync(d)) await mkdir(d, { recursive: true });
}
export async function writeJSON(file, obj) {
  await ensureDir(path.dirname(file));
  await writeFile(file, JSON.stringify(obj, null, 2));
}
export async function readJSON(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}
export async function writeText(file, text) {
  await ensureDir(path.dirname(file));
  await writeFile(file, text);
}
export async function writePng(file, buf) {
  await ensureDir(path.dirname(file));
  await writeFile(file, buf);
}
