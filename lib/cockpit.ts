// Cockpit-level aggregation: real metrics + reconstructing a step-by-step agent
// "run trace" (the design's run inspector) from a real .autoqa report.json.
import {
  evidence,
  getMainMemory,
  getRoutes,
  getPRSkills,
  listPRReports,
  listGhReviews,
} from "./memory";

export const REPO_LABEL = "slab10000/test-app";

export const PIPELINE_LABELS = ["Clone", "Diff", "Drive", "Compare", "Scope", "Code", "Verdict"];

export type Metrics = {
  screens: number;
  contracts: number;
  skills: number;
  routes: number;
  prsReviewed: number;
  regressionsCaught: number;
  routeMs: number | null;
  routeCached: boolean;
  routeLlmCalls: number | null;
};

export async function getMetrics(): Promise<Metrics> {
  const mem = await getMainMemory();
  const routes = await getRoutes();
  const reports = await listPRReports();
  const gh = await listGhReviews();

  // Dedup GitHub reviews already covered by a local report (same repo + PR).
  const seen = new Set(reports.map((r) => `${r.github?.repo ?? ""}#${r.pr?.number ?? ""}`));
  const ghUnique = gh.filter((g) => !seen.has(`${g.repo}#${g.pr.replace(/^pr-/, "")}`));

  const flagged = (v: string) => ["FAIL", "WARN"].includes((v || "").toUpperCase());
  const regressions =
    reports.filter((r) => flagged(r.verdict)).length + ghUnique.filter((g) => flagged(g.verdict)).length;

  const rm = reports.find((r) => r.route_metrics)?.route_metrics;

  return {
    screens: mem.screens.length,
    contracts: mem.behaviors.length,
    skills: mem.skills.length,
    routes: routes.length,
    prsReviewed: reports.length + ghUnique.length,
    regressionsCaught: regressions,
    routeMs: rm?.ms ?? null,
    routeCached: rm?.cached ?? false,
    routeLlmCalls: rm?.llmCalls ?? null,
  };
}

/* ---------- featured review (landing "what it caught") ---------- */

export type Featured = {
  source: "local" | "github";
  repo: string;
  prId: string;
  prNumber: string;
  title: string;
  verdict: string;
  url: string | null;
  headline: string; // the out-of-scope change, one line
  before: string | null; // evidence() url
  after: string | null; // evidence() url
};

// Picks the most demo-worthy review to feature on the landing: a local cockpit
// report if one exists, otherwise the real GitHub review captured under .autoqa/gh.
export async function getFeaturedReview(): Promise<Featured | null> {
  const reports = await listPRReports();
  if (reports.length) {
    const r = reports[0];
    // feature the highest-severity changed screen (out-of-scope story)
    const sev = (s: string) => ({ high: 3, medium: 2, low: 1, none: 0 } as any)[(s || "").toLowerCase()] ?? 0;
    const changed = (r.visual_comparisons ?? []).filter((c: any) => c.changed).sort((a: any, b: any) => sev(b.severity) - sev(a.severity));
    const top = changed[0];
    const id = (top?.screen || "").toLowerCase();
    return {
      source: "local",
      repo: r.github?.repo ?? "",
      prId: r.pr.id,
      prNumber: String(r.pr.number),
      title: r.pr.title,
      verdict: r.verdict,
      url: r.github?.url ?? null,
      headline: r.scope_analysis?.out_of_scope?.[0] ?? top?.summary ?? r.scope_analysis?.reasoning ?? "",
      before: r.evidence?.main?.[id] ? evidence(r.evidence.main[id]) : null,
      after: r.evidence?.pr?.[id] ? evidence(r.evidence.pr[id]) : null,
    };
  }

  const gh = await listGhReviews();
  if (!gh.length) return null;
  const g = gh[0];
  const num = g.pr.replace(/^pr-/, "");
  const statedScope = g.comment.match(/Stated scope:\s*_([^_]+)_/)?.[1] ?? "Pull request";
  const homeLine =
    g.comment.match(/\*\*Home\*\*\s*[—-]\s*changed[^\n:]*:\s*([^\n]+)/i)?.[1] ??
    g.comment.match(/out of scope[\s\S]*?\n-\s*([^\n]+)/i)?.[1] ??
    "";
  const before = g.base.find((s) => s.screen === "index");
  const after = g.head.find((s) => s.screen === "index");
  return {
    source: "github",
    repo: g.repo,
    prId: g.pr,
    prNumber: num,
    title: statedScope,
    verdict: g.verdict,
    url: `https://github.com/${g.repo}/pull/${num}`,
    headline: homeLine,
    before: before ? evidence(before.rel) : null,
    after: after ? evidence(after.rel) : null,
  };
}

/* ---------- analyses (Overview list) ---------- */

export type Comparison = {
  screen: string;
  changed: boolean;
  severity: string;
  summary: string;
  before?: string | null; // evidence() url (main baseline)
  after?: string | null; // evidence() url (this PR)
};
export type Analysis = {
  key: string;
  source: "local" | "github";
  repo: string;
  prNumber: string;
  prId: string;
  title: string;
  branch: string;
  base: string;
  verdict: string;
  classification: string;
  description: string;
  tookMs: number | null;
  generatedAt: string | null;
  changedFiles: string[];
  comparisons: Comparison[];
  scopeIn: string[];
  scopeOut: string[];
  codeReview: { scopeMatch: string; risk: string; summary: string; concerns: string[] } | null;
  skills: { name: string }[];
  href: string | null; // in-cockpit /pr/<id>
  githubUrl: string | null;
  navigation: { usedSkills: boolean; cachedPages: number; exploredPages: number } | null;
  reusedSession: boolean;
  // What this branch contributes to main when merged (and whether it already did).
  onMerge: {
    merged: boolean;
    mergedAt: string | null;
    baselineUpdates: { screen: string; before: string | null; after: string | null }[];
  } | null;
};

// Parse the markdown comment auto-qa posts (our own stable format) into structured fields.
function parseGhComment(c: string) {
  const head = c.match(/auto-qa review\s*[—-]\s*\*\*(\w+)\*\*\s*·\s*([\w_]+)/i);
  const verdict = (head?.[1] || "WARN").toUpperCase();
  const classification = head?.[2] || "needs_review";
  const title = c.match(/Stated scope:\s*_([^_]+)_/)?.[1] || "Pull request";
  const afterQuote = c.split(/Stated scope:[^\n]*\n/)[1] ?? c;
  const description = (afterQuote.split(/\n#{2,3} /)[0] || "").trim();

  const visBlock = c.match(/#{2,3}[^\n]*Visual behavior[\s\S]*?(?=\n#{2,3} |$)/)?.[0] || "";
  const comparisons: Comparison[] = [...visBlock.matchAll(/^- \*\*(.+?)\*\*\s*[—-]\s*(.+)$/gm)].map((m) => {
    const screen = m[1];
    const rest = m[2];
    const changed = !/no change/i.test(rest);
    const severity = rest.match(/changed \((\w+)\)/)?.[1] || (changed ? "low" : "none");
    const summary = rest.replace(/^changed \(\w+\):\s*/, "").trim();
    return { screen, changed, severity, summary };
  });

  const codeBlock = c.match(/#{2,3}[^\n]*Code-side review[\s\S]*?(?=\n#{2,3} |$)/)?.[0] || "";
  const cm = codeBlock.match(/\*\*scope:\*\*\s*([\w_]+)\s*·\s*\*\*risk:\*\*\s*(\w+)/);
  const codeAfter = cm ? codeBlock.slice(codeBlock.indexOf(cm[0]) + cm[0].length) : "";
  const codeSummary = (codeAfter.split(/\n- /)[0] || "").trim();
  const concerns = [...codeAfter.matchAll(/\n- (.+)/g)].map((m) => m[1].trim());
  const codeReview = cm ? { scopeMatch: cm[1], risk: cm[2], summary: codeSummary, concerns } : null;

  const bullets = (b: string) => [...b.matchAll(/- (.+)/g)].map((m) => m[1].trim()).filter((x) => x && x !== "—");
  const scopeIn = bullets(c.match(/\*\*In scope\*\*\n([\s\S]*?)(?=\n\*\*Out of scope\*\*|\n#{2,3} |$)/)?.[1] || "");
  const scopeOut = bullets(c.match(/\*\*Out of scope\*\*\n([\s\S]*?)(?=\n#{2,3} |$)/)?.[1] || "");
  const changedFiles = [...(c.match(/#{2,3} Changed files\n([\s\S]*?)(?=\n<sub|\n#{2,3} |$)/)?.[1] || "").matchAll(/`([^`]+)`/g)].map((m) => m[1]);

  return { verdict, classification, title, description, comparisons, codeReview, scopeIn, scopeOut, changedFiles };
}

// All analyses (PR reviews) for the Overview list: rich local reports first, then any
// GitHub-only reviews not already covered by a local report. Newest first.
export async function getAnalyses(): Promise<Analysis[]> {
  const reports = await listPRReports();
  const gh = await listGhReviews();
  const out: Analysis[] = [];
  const seen = new Set<string>();

  for (const r of reports) {
    const repo = r.github?.repo ?? "";
    const prNumber = String(r.pr?.number ?? "");
    const key = `${repo}#${prNumber}`;
    seen.add(key);
    out.push({
      key,
      source: "local",
      repo,
      prNumber,
      prId: r.pr?.id ?? `pr-${prNumber}`,
      title: r.pr?.title ?? "",
      branch: r.pr?.branch ?? "",
      base: r.pr?.base ?? "main",
      verdict: r.verdict,
      classification: r.scope_analysis?.classification ?? "",
      description: r.pr?.description ?? "",
      tookMs: r.took_ms ?? null,
      generatedAt: r.generated_at ?? null,
      changedFiles: r.changed_files ?? [],
      comparisons: (r.visual_comparisons ?? []).map((c: any) => {
        const id = (c.screen || "").toLowerCase();
        return {
          screen: c.screen,
          changed: !!c.changed,
          severity: c.severity,
          summary: c.summary,
          before: r.evidence?.main?.[id] ? evidence(r.evidence.main[id]) : null,
          after: r.evidence?.pr?.[id] ? evidence(r.evidence.pr[id]) : null,
        };
      }),
      scopeIn: r.scope_analysis?.in_scope ?? [],
      scopeOut: r.scope_analysis?.out_of_scope ?? [],
      codeReview: r.code_review
        ? {
            scopeMatch: r.code_review.scope_match,
            risk: r.code_review.risk,
            summary: r.code_review.summary,
            concerns: r.code_review.concerns ?? [],
          }
        : null,
      skills: await getPRSkills(r.pr?.id ?? `pr-${prNumber}`),
      href: `/pr/${r.pr?.id ?? `pr-${prNumber}`}`,
      githubUrl: r.github?.url ?? (repo ? `https://github.com/${repo}/pull/${prNumber}` : null),
      navigation: r.route_metrics
        ? {
            usedSkills: !!r.route_metrics.used_skills,
            cachedPages: r.route_metrics.cached_pages ?? 0,
            exploredPages: r.route_metrics.explored_pages ?? 0,
          }
        : null,
      reusedSession: !!r.code_review?.reused_session,
      onMerge: {
        merged: !!r.merged,
        mergedAt: r.merged_at ?? null,
        baselineUpdates: (r.visual_comparisons ?? [])
          .filter((c: any) => c.changed)
          .map((c: any) => {
            const id = (c.screen || "").toLowerCase();
            return {
              screen: c.screen,
              before: r.evidence?.main?.[id] ? evidence(r.evidence.main[id]) : null,
              after: r.evidence?.pr?.[id] ? evidence(r.evidence.pr[id]) : null,
            };
          }),
      },
    });
  }

  for (const g of gh) {
    const prNumber = g.pr.replace(/^pr-/, "");
    const key = `${g.repo}#${prNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = parseGhComment(g.comment);
    out.push({
      key,
      source: "github",
      repo: g.repo,
      prNumber,
      prId: g.pr,
      title: p.title,
      branch: "",
      base: "main",
      verdict: p.verdict,
      classification: p.classification,
      description: p.description,
      tookMs: null,
      generatedAt: null,
      changedFiles: p.changedFiles,
      comparisons: p.comparisons,
      scopeIn: p.scopeIn,
      scopeOut: p.scopeOut,
      codeReview: p.codeReview,
      skills: [],
      href: null,
      githubUrl: `https://github.com/${g.repo}/pull/${prNumber}`,
      navigation: null,
      reusedSession: false,
      onMerge: {
        merged: false,
        mergedAt: null,
        baselineUpdates: p.comparisons
          .filter((c) => c.changed)
          .map((c) => {
            const file = g.base.find((s) => s.screen === c.screen.toLowerCase())?.rel;
            const head = g.head.find((s) => s.screen === c.screen.toLowerCase())?.rel;
            return {
              screen: c.screen,
              before: file ? evidence(file) : null,
              after: head ? evidence(head) : null,
            };
          }),
      },
    });
  }

  return out;
}

/* ---------- run-trace reconstruction ---------- */

export type Shot = { src: string; url: string } | null;

export type TraceEntry = {
  stage: number; // index into PIPELINE_LABELS
  kind: "action" | "route" | "contract" | "compare" | "scope" | "code" | "skill" | "verdict";
  kindLabel: string;
  action?: string;
  thought: string;
  shot?: Shot;
  contract?: { expected: string; observed: string; match: boolean };
  compare?: { screen: string; changed: boolean; severity: string; summary: string };
  route?: { cached: boolean; ms: number; llmCalls: number };
  scope?: { classification: string; inScope: string[]; outScope: string[] };
  code?: { scopeMatch: string; risk: string; summary: string; concerns: string[] };
  skill?: { name: string; body: string };
  verdict?: string;
};

export type RunView = {
  id: string;
  num: number;
  title: string;
  branch: string;
  base: string;
  description: string;
  files: string[];
  live: boolean;
  current: number;
  verdict: string;
  reviewMs: number | null;
  trace: TraceEntry[];
  lastShot: Shot;
  artifacts: { skills: number; shots: number; contracts: number };
  skillsWritten: { name: string }[];
};

const fmtExpected = (e: any) =>
  e ? `${e.type}${e.destination_url ? ` → ${e.destination_url}` : ""}` : "—";
const fmtObserved = (o: any) =>
  o ? `${o.type}${o.destination_url ? ` → ${o.destination_url}` : o.url_changed === false ? " · URL unchanged" : ""}` : "—";

const KIND_LABELS: Record<TraceEntry["kind"], string> = {
  action: "ACTION",
  route: "NAVIGATION ROUTE",
  contract: "CONTRACT REPLAY",
  compare: "VISUAL COMPARE",
  scope: "SCOPE ANALYSIS",
  code: "CODE-SIDE REVIEW",
  skill: "WROTE SKILL",
  verdict: "VERDICT",
};

// Map a real report.json (+ the skills that run wrote) into an ordered, narrated trace.
export function buildRunView(report: any, prSkills: { name: string; body: string }[]): RunView {
  const branch = report.pr?.branch ?? "branch";
  const files: string[] = report.changed_files ?? [];
  const prSrc = (screen: string): Shot => {
    const rel = report.evidence?.pr?.[screen];
    return rel ? { src: evidence(rel), url: `${REPO_LABEL}/${screen}` } : null;
  };

  const trace: TraceEntry[] = [];
  const push = (e: Omit<TraceEntry, "kindLabel">) => trace.push({ ...e, kindLabel: KIND_LABELS[e.kind] });

  // 0 · clone
  push({
    stage: 0,
    kind: "action",
    action: `git clone · checkout ${branch}`,
    thought: "Cloning the branch into a fresh sandbox and serving it locally for a real browser to drive.",
  });

  // 1 · diff
  push({
    stage: 1,
    kind: "action",
    action: `read diff — ${files.length} file${files.length === 1 ? "" : "s"}`,
    thought:
      `Changed: ${files.join(", ") || "—"}. The PR says “${report.pr?.description ?? report.pr?.title ?? ""}”` +
      (files.length > 1 ? " — more files moved than the description implies, so I'll re-verify every contract they touch." : "."),
  });

  // 2 · route cache (how it reached the screen)
  const rm = report.route_metrics;
  if (rm) {
    push({
      stage: 2,
      kind: "route",
      thought: rm.cached
        ? `Reached the screen by replaying a cached Computer Use route — ${rm.ms}ms, 0 model calls. The element signature still matched, so no fresh exploration needed.`
        : `Explored the route fresh with Computer Use (${rm.llmCalls} model calls, ${rm.ms}ms) and cached it for next time.`,
      route: { cached: !!rm.cached, ms: rm.ms, llmCalls: rm.llmCalls ?? 0 },
    });
  }

  // 2 · drive + contract replay
  for (const bc of report.behavior_checks ?? []) {
    push({
      stage: 2,
      kind: "contract",
      action: bc.action,
      thought:
        `My baseline says “${bc.action}” on ${bc.screen} should ${fmtExpected(bc.expected)}. Replaying that exact action and watching what actually happens.`,
      contract: { expected: fmtExpected(bc.expected), observed: fmtObserved(bc.observed), match: !!bc.match },
      shot: prSrc((bc.screen || "").toLowerCase()),
    });
  }

  // 3 · visual compares
  for (const c of report.visual_comparisons ?? []) {
    push({
      stage: 3,
      kind: "compare",
      thought: c.summary,
      compare: { screen: c.screen, changed: !!c.changed, severity: c.severity, summary: c.summary },
      shot: c.changed ? prSrc((c.screen || "").toLowerCase()) : null,
    });
  }

  // 4 · scope
  const sa = report.scope_analysis;
  if (sa) {
    push({
      stage: 4,
      kind: "scope",
      thought: sa.reasoning,
      scope: {
        classification: sa.classification,
        inScope: sa.in_scope ?? [],
        outScope: sa.out_of_scope ?? [],
      },
    });
  }

  // 5 · code-side review
  const cr = report.code_review;
  if (cr) {
    push({
      stage: 5,
      kind: "code",
      thought: cr.summary,
      code: {
        scopeMatch: cr.scope_match,
        risk: cr.risk,
        summary: cr.summary,
        concerns: cr.concerns ?? [],
      },
    });
  }

  // 5 · skills written this run
  for (const sk of prSkills) {
    push({
      stage: 5,
      kind: "skill",
      thought: "Writing this down as a skill so future runs assert it directly instead of re-deriving it.",
      skill: sk,
    });
  }

  // 6 · verdict
  push({
    stage: 6,
    kind: "verdict",
    thought:
      report.verdict === "PASS"
        ? "Drafting the report. Leaning PASS — the change is exactly what was described and nothing else moved."
        : `Verdict: ${report.verdict}. ${sa?.classification ? `Classification: ${sa.classification}.` : ""} Sending it back with the evidence attached.`,
    verdict: report.verdict,
  });

  // last shot = most recent entry that carried one
  let lastShot: Shot = null;
  for (let i = trace.length - 1; i >= 0; i--) {
    if (trace[i].shot) { lastShot = trace[i].shot!; break; }
  }

  const shots = trace.filter((e) => e.shot).length;
  const contracts = trace.filter((e) => e.kind === "contract").length;

  return {
    id: report.pr?.id ?? "pr",
    num: report.pr?.number ?? 0,
    title: report.pr?.title ?? "",
    branch,
    base: report.pr?.base ?? "main",
    description: report.pr?.description ?? "",
    files,
    live: false,
    current: PIPELINE_LABELS.length, // complete
    verdict: report.verdict,
    reviewMs: rm?.ms ?? null,
    trace,
    lastShot,
    artifacts: { skills: prSkills.length, shots, contracts },
    skillsWritten: prSkills.map((s) => ({ name: s.name })),
  };
}
