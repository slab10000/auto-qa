// Server-side reader over the .autoqa file memory. Cockpit pages call these.
import fs from "node:fs/promises";
import path from "node:path";

export const AUTOQA = path.join(process.cwd(), ".autoqa");

export function evidence(rel: string): string {
  return `/api/evidence/${rel}`;
}

async function readJSONFile<T>(abs: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(abs, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export type Screen = { id: string; name: string; url: string; purpose: string; screenshot: string };
export type Behavior = {
  id: string; screen: string; action: string;
  expected_result: { type: string; url_changed: boolean; destination_url: string | null; visual_anchor: string };
  confidence: number; learned_from: string;
};

export async function getMainMemory() {
  const screensData = await readJSONFile<{ screens: Screen[]; learned_at?: string }>(
    path.join(AUTOQA, "main", "screens.json"),
    { screens: [] }
  );

  const behaviors: Behavior[] = [];
  try {
    const files = await fs.readdir(path.join(AUTOQA, "main", "behaviors"));
    for (const f of files.filter((f) => f.endsWith(".json"))) {
      const b = await readJSONFile<Behavior | null>(path.join(AUTOQA, "main", "behaviors", f), null);
      if (b) behaviors.push(b);
    }
  } catch {}

  const skills: { name: string; body: string }[] = [];
  try {
    const files = await fs.readdir(path.join(AUTOQA, "main", "skills"));
    for (const f of files.filter((f) => f.endsWith(".md"))) {
      skills.push({ name: f, body: await fs.readFile(path.join(AUTOQA, "main", "skills", f), "utf8") });
    }
  } catch {}

  return { screens: screensData.screens, behaviors, skills, learnedAt: screensData.learned_at };
}

export async function listPRReports(): Promise<any[]> {
  let dirs: string[] = [];
  try {
    dirs = await fs.readdir(path.join(AUTOQA, "prs"));
  } catch {
    return [];
  }
  const reports: any[] = [];
  for (const d of dirs) {
    const r = await readJSONFile<any>(path.join(AUTOQA, "prs", d, "report.json"), null);
    if (r) reports.push(r);
  }
  return reports;
}

export async function getPRReport(id: string): Promise<any | null> {
  return readJSONFile<any>(path.join(AUTOQA, "prs", id, "report.json"), null);
}

// Learned navigation routes — cached Computer Use action sequences replayed on later passes.
export async function getRoutes(): Promise<{ goal: string; actions: any[]; expected_url?: string }[]> {
  const dir = path.join(AUTOQA, "main", "routes");
  let files: string[] = [];
  try { files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")); } catch { return []; }
  const out: any[] = [];
  for (const f of files) {
    const r = await readJSONFile<any>(path.join(dir, f), null);
    if (r) out.push(r);
  }
  return out;
}

// Visual changelog: one folder of screens per merged branch (excluding the live "main").
export async function getScreenshotHistory(): Promise<{ branch: string; shots: string[] }[]> {
  const dir = path.join(AUTOQA, "screenshots");
  let entries: { name: string; dir: boolean }[] = [];
  try {
    entries = (await fs.readdir(dir, { withFileTypes: true })).map((d) => ({ name: d.name, dir: d.isDirectory() }));
  } catch {
    return [];
  }
  const out: { branch: string; shots: string[] }[] = [];
  for (const e of entries) {
    if (!e.dir || e.name === "main") continue;
    let shots: string[] = [];
    try {
      shots = (await fs.readdir(path.join(dir, e.name))).filter((f) => f.endsWith(".png"));
    } catch {}
    out.push({ branch: e.name, shots: shots.map((s) => `screenshots/${e.name}/${s}`) });
  }
  return out;
}
