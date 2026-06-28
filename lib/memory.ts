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

// Visual changelog: one folder of screens per branch. `includeMain` keeps the live
// baseline (the Gallery shows it as "main · current baseline").
export async function getScreenshotHistory(includeMain = false): Promise<{ branch: string; shots: string[] }[]> {
  const dir = path.join(AUTOQA, "screenshots");
  let entries: { name: string; dir: boolean }[] = [];
  try {
    entries = (await fs.readdir(dir, { withFileTypes: true })).map((d) => ({ name: d.name, dir: d.isDirectory() }));
  } catch {
    return [];
  }
  // main first when included, then the rest
  entries.sort((a, b) => (a.name === "main" ? -1 : b.name === "main" ? 1 : a.name.localeCompare(b.name)));
  const out: { branch: string; shots: string[] }[] = [];
  for (const e of entries) {
    if (!e.dir) continue;
    if (e.name === "main" && !includeMain) continue;
    let shots: string[] = [];
    try {
      shots = (await fs.readdir(path.join(dir, e.name))).filter((f) => f.endsWith(".png"));
    } catch {}
    out.push({ branch: e.name, shots: shots.map((s) => `screenshots/${e.name}/${s}`) });
  }
  return out;
}

// Skills a PR run wrote for itself (pending graduation into main on merge).
export async function getPRSkills(id: string): Promise<{ name: string; body: string }[]> {
  const skills: { name: string; body: string }[] = [];
  try {
    const dir = path.join(AUTOQA, "prs", id, "skills");
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
    for (const f of files) skills.push({ name: f, body: await fs.readFile(path.join(dir, f), "utf8") });
  } catch {}
  return skills;
}

export type GhReview = {
  repo: string; // owner/name
  pr: string; // "pr-1"
  verdict: string; // PASS | WARN | FAIL
  comment: string; // raw comment.md
  base: { screen: string; rel: string }[];
  head: { screen: string; rel: string }[];
};

// Real GitHub reviews posted by qa-agent/github-review.mjs (base vs head + posted comment).
export async function listGhReviews(): Promise<GhReview[]> {
  const root = path.join(AUTOQA, "gh");
  const out: GhReview[] = [];
  let repos: string[] = [];
  try { repos = await fs.readdir(root); } catch { return []; }
  for (const repoDir of repos) {
    const repo = repoDir.replace(/__/g, "/");
    let prs: string[] = [];
    try { prs = await fs.readdir(path.join(root, repoDir)); } catch { continue; }
    for (const pr of prs) {
      const prDir = path.join(root, repoDir, pr);
      let comment = "";
      try { comment = await fs.readFile(path.join(prDir, "comment.md"), "utf8"); } catch { continue; }
      const m = comment.match(/auto-qa review\s*—\s*\*\*(\w+)\*\*/i);
      const verdict = (m?.[1] || "WARN").toUpperCase();
      const shots = async (side: "base" | "head") => {
        try {
          const files = (await fs.readdir(path.join(prDir, side))).filter((f) => f.endsWith(".png"));
          return files.map((f) => ({ screen: f.replace(/\.html\.png$|\.png$/, ""), rel: `gh/${repoDir}/${pr}/${side}/${f}` }));
        } catch { return []; }
      };
      out.push({ repo, pr, verdict, comment, base: await shots("base"), head: await shots("head") });
    }
  }
  return out;
}
