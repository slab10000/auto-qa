import { createServer } from "node:http";
import { readFile, writeFile, mkdir, readdir, stat, rm, cp } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public");
const STORE_DIR = path.join(ROOT, ".autoqa");
const LOCAL_CONFIG_FILE = path.join(STORE_DIR, "config.local.json");
const DEFAULT_INTERACTIONS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

function loadDotEnv() {
  const file = path.join(ROOT, ".env");
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

let runtimeConfig = {
  mode: process.env.AUTOQA_AGENT_MODE || "demo",
  agent: process.env.AUTOQA_AGENT || "antigravity-preview-05-2026",
  repoUrl: process.env.AUTOQA_REPO_URL || "",
  mainBranch: process.env.AUTOQA_MAIN_BRANCH || "main",
  prNumber: "1",
  prBranch: "",
  prTitle: "",
  prScope: "",
  interactionsEndpoint: process.env.AUTOQA_INTERACTIONS_ENDPOINT || DEFAULT_INTERACTIONS_ENDPOINT,
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  githubPat: process.env.AUTOQA_GITHUB_PAT || process.env.GITHUB_PAT || ""
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

function nowIso() {
  return new Date().toISOString();
}

function runId(prefix) {
  const clean = nowIso().replaceAll(":", "-").replaceAll(".", "-");
  return `${prefix}-${clean}`;
}

function safeJoin(base, requested) {
  const resolved = path.resolve(base, requested);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error("Path escapes base directory");
  }
  return resolved;
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(file, data) {
  await ensureDir(path.dirname(file));
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function writeText(file, data) {
  await ensureDir(path.dirname(file));
  await writeFile(file, data, "utf8");
}

function publicConfig() {
  return {
    mode: runtimeConfig.mode,
    agent: runtimeConfig.agent,
    repoUrl: runtimeConfig.repoUrl,
    mainBranch: runtimeConfig.mainBranch,
    prNumber: runtimeConfig.prNumber,
    prBranch: runtimeConfig.prBranch,
    prTitle: runtimeConfig.prTitle,
    prScope: runtimeConfig.prScope,
    interactionsEndpoint: runtimeConfig.interactionsEndpoint,
    hasGeminiKey: Boolean(runtimeConfig.geminiApiKey),
    hasGithubPat: Boolean(runtimeConfig.githubPat)
  };
}

async function loadLocalConfig() {
  const local = await readJson(LOCAL_CONFIG_FILE, null);
  if (local) {
    runtimeConfig = {
      ...runtimeConfig,
      ...Object.fromEntries(Object.entries(local).filter(([, value]) => value !== undefined))
    };
  }
}

async function saveLocalConfig(updates) {
  const allowed = [
    "mode",
    "agent",
    "repoUrl",
    "mainBranch",
    "prNumber",
    "prBranch",
    "prTitle",
    "prScope",
    "interactionsEndpoint",
    "geminiApiKey",
    "githubPat"
  ];
  for (const key of allowed) {
    if (Object.hasOwn(updates, key)) {
      runtimeConfig[key] = String(updates[key] ?? "").trim();
    }
  }
  if (!runtimeConfig.interactionsEndpoint) {
    runtimeConfig.interactionsEndpoint = DEFAULT_INTERACTIONS_ENDPOINT;
  }
  if (!runtimeConfig.mainBranch) {
    runtimeConfig.mainBranch = "main";
  }
  if (!runtimeConfig.prNumber) {
    runtimeConfig.prNumber = "1";
  }
  if (!runtimeConfig.agent) {
    runtimeConfig.agent = "antigravity-preview-05-2026";
  }
  if (!["demo", "google"].includes(runtimeConfig.mode)) {
    runtimeConfig.mode = "demo";
  }
  await writeJson(LOCAL_CONFIG_FILE, runtimeConfig);
  await appendEvent("config", "Local coordinator configuration saved", {
    mode: runtimeConfig.mode,
    repoUrl: runtimeConfig.repoUrl,
    mainBranch: runtimeConfig.mainBranch,
    hasGeminiKey: Boolean(runtimeConfig.geminiApiKey),
    hasGithubPat: Boolean(runtimeConfig.githubPat)
  });
}

async function appendEvent(type, message, details = {}) {
  const file = path.join(STORE_DIR, "event-log.json");
  const events = await readJson(file, []);
  events.unshift({
    id: runId("event"),
    type,
    message,
    details,
    created_at: nowIso()
  });
  await writeJson(file, events.slice(0, 80));
}

async function listFiles(dir, extensions = null) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => !extensions || extensions.includes(path.extname(name)))
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function listDirs(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function artifactUrl(...parts) {
  return `/artifacts/${parts.map(encodeURIComponent).join("/")}`;
}

function screenshotSvg({ title, subtitle, mode, variant }) {
  const colors = {
    main: {
      bg: "#f7f4ef",
      panel: "#ffffff",
      accent: "#256f8f",
      accent2: "#cc5a43",
      ink: "#172026",
      muted: "#61707a"
    },
    pr: {
      bg: "#f3f7f4",
      panel: "#ffffff",
      accent: "#4d7c3f",
      accent2: "#b24b6b",
      ink: "#172026",
      muted: "#61707a"
    }
  };
  const c = colors[mode] || colors.main;
  const modal = variant === "modal";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">
  <rect width="960" height="600" fill="${c.bg}"/>
  <rect x="48" y="40" width="864" height="72" rx="8" fill="${c.panel}" stroke="#d8dee4"/>
  <circle cx="88" cy="76" r="18" fill="${c.accent}"/>
  <text x="124" y="83" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="${c.ink}">Acme App</text>
  <rect x="732" y="56" width="132" height="40" rx="8" fill="${c.accent}"/>
  <text x="798" y="82" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="700" fill="#ffffff">Settings</text>
  <rect x="48" y="144" width="248" height="392" rx="8" fill="${c.panel}" stroke="#d8dee4"/>
  <text x="80" y="190" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" fill="${c.ink}">Navigation</text>
  <text x="80" y="234" font-family="Inter, Arial, sans-serif" font-size="15" fill="${c.muted}">Dashboard</text>
  <text x="80" y="272" font-family="Inter, Arial, sans-serif" font-size="15" fill="${c.muted}">Billing</text>
  <text x="80" y="310" font-family="Inter, Arial, sans-serif" font-size="15" fill="${c.muted}">Projects</text>
  <rect x="328" y="144" width="584" height="392" rx="8" fill="${c.panel}" stroke="#d8dee4"/>
  <text x="368" y="204" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" fill="${c.ink}">${title}</text>
  <text x="368" y="242" font-family="Inter, Arial, sans-serif" font-size="17" fill="${c.muted}">${subtitle}</text>
  <rect x="368" y="286" width="210" height="98" rx="8" fill="#f9fbfc" stroke="#d8dee4"/>
  <text x="392" y="326" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="700" fill="${c.ink}">Active projects</text>
  <text x="392" y="358" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="800" fill="${c.accent}">12</text>
  <rect x="608" y="286" width="226" height="98" rx="8" fill="#f9fbfc" stroke="#d8dee4"/>
  <text x="632" y="326" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="700" fill="${c.ink}">Open invoices</text>
  <text x="632" y="358" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="800" fill="${c.accent2}">3</text>
  ${modal ? `<rect x="0" y="0" width="960" height="600" fill="#172026" opacity="0.32"/>
  <rect x="282" y="142" width="396" height="316" rx="10" fill="#ffffff" stroke="#aab4bd"/>
  <text x="322" y="206" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="800" fill="${c.ink}">Settings Modal</text>
  <text x="322" y="246" font-family="Inter, Arial, sans-serif" font-size="16" fill="${c.muted}">Unexpected branch behavior</text>
  <rect x="322" y="294" width="276" height="44" rx="8" fill="#f4f7f8" stroke="#d8dee4"/>
  <text x="344" y="322" font-family="Inter, Arial, sans-serif" font-size="15" fill="${c.ink}">Account settings</text>
  <rect x="322" y="358" width="124" height="42" rx="8" fill="${c.accent}"/>
  <text x="384" y="385" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="700" fill="#ffffff">Save</text>` : ""}
</svg>`;
}

async function seedMainArtifacts() {
  const base = path.join(STORE_DIR, "main");
  const run = runId("main-learning");
  await ensureDir(base);

  const state = {
    branch: runtimeConfig.mainBranch,
    title: "Main product memory",
    status: "learned",
    last_run_id: run,
    last_verified_at: nowIso(),
    summary: "Canonical behavior for the demo app. Settings navigation is currently a page transition."
  };

  const graph = {
    nodes: [
      { id: "dashboard", label: "Dashboard", type: "screen" },
      { id: "settings-page", label: "Settings Page", type: "screen" },
      { id: "billing", label: "Billing", type: "screen" }
    ],
    edges: [
      {
        id: "settings-navigation",
        from: "dashboard",
        to: "settings-page",
        action: "click settings button",
        expected: "navigates to /settings"
      },
      {
        id: "billing-navigation",
        from: "dashboard",
        to: "billing",
        action: "click billing nav item",
        expected: "navigates to /billing"
      }
    ]
  };

  const behavior = {
    id: "settings-navigation",
    screen: "Dashboard",
    action: "click settings button",
    expected_result: {
      type: "navigation",
      destination: "Settings page",
      url_change: "/settings",
      visual_anchor: "Settings heading visible"
    },
    confidence: 0.93,
    learned_from: "main",
    last_verified_at: nowIso(),
    evidence: {
      before_screenshot: "screenshots/dashboard-before-settings.svg",
      after_screenshot: "screenshots/settings-page-after-click.svg"
    }
  };

  const runData = {
    id: run,
    mode: runtimeConfig.mode,
    status: "completed",
    started_at: nowIso(),
    completed_at: nowIso(),
    steps: [
      "Mounted repository source",
      "Started main branch app",
      "Explored dashboard and settings workflow",
      "Captured baseline screenshots",
      "Created settings-navigation behavior contract"
    ]
  };

  await writeJson(path.join(base, "state.json"), state);
  await writeJson(path.join(base, "behavior-graph.json"), graph);
  await writeJson(path.join(base, "behaviors", "settings-navigation.json"), behavior);
  await writeJson(path.join(base, "runs", `${run}.json`), runData);
  await writeText(path.join(base, "skills", "verify-settings-navigation.md"), `# Verify Settings Navigation

Context:
The Settings button appears in the top-right dashboard toolbar.

Steps:
1. Open the dashboard.
2. Click the Settings button.
3. Expect navigation to /settings.
4. Confirm the Settings heading appears.
5. Capture before and after screenshots.

Known risks:
- If a modal opens instead, compare against PR scope before flagging.
`);
  await writeText(path.join(base, "reports", `${run}.md`), `# Main Learning Run

Status: completed

The agent learned the baseline dashboard and settings workflow.

Key contract:

- Dashboard -> click Settings -> Settings page at /settings
`);
  await writeText(
    path.join(base, "screenshots", "dashboard-before-settings.svg"),
    screenshotSvg({
      title: "Dashboard",
      subtitle: "Baseline before clicking Settings",
      mode: "main"
    })
  );
  await writeText(
    path.join(base, "screenshots", "settings-page-after-click.svg"),
    screenshotSvg({
      title: "Settings",
      subtitle: "Expected page navigation after clicking Settings",
      mode: "main"
    })
  );

  await appendEvent("main-learning", "Main branch product memory refreshed", { run_id: run });
  return runData;
}

async function seedPrArtifacts(prNumber = "1") {
  if (!existsSync(path.join(STORE_DIR, "main", "state.json"))) {
    await seedMainArtifacts();
  }
  const prId = `pr-${prNumber}`;
  const base = path.join(STORE_DIR, "prs", prId);
  const run = runId(`${prId}-analysis`);

  const metadata = {
    pr_number: Number(prNumber),
    id: prId,
    branch: runtimeConfig.prBranch || "feature/billing-copy",
    title: runtimeConfig.prTitle || "Update billing page copy",
    status: "open",
    inherited_from: "main",
    agent_environment_id: `demo-env-${prId}`,
    previous_interaction_id: `demo-interaction-${run}`,
    created_at: nowIso(),
    updated_at: nowIso()
  };

  const scope = {
    summary: runtimeConfig.prScope || "The PR appears to update billing copy and supporting labels.",
    in_scope: ["Billing page copy", "Invoice empty state labels"],
    out_of_scope_examples: ["Global navigation behavior", "Settings entry point behavior"],
    sources: ["PR title", "Changed files", "Commit summary"]
  };

  const diff = {
    id: "settings-navigation",
    severity: "suspicious",
    verdict: "Unexpected behavior change outside PR scope",
    confidence: 0.88,
    contract: "settings-navigation",
    action: "click settings button on Dashboard",
    main_behavior: {
      type: "navigation",
      description: "Navigates to Settings page at /settings"
    },
    pr_behavior: {
      type: "modal",
      description: "Opens a Settings modal without changing URL"
    },
    scope_match: false,
    rationale: "The PR scope is about billing copy. Settings navigation changed from a page transition to a modal, and no PR metadata explains that behavior change.",
    evidence: [
      "screenshots/main-after-settings.svg",
      "screenshots/pr-after-settings.svg"
    ]
  };

  const runData = {
    id: run,
    mode: runtimeConfig.mode,
    status: "completed",
    started_at: nowIso(),
    completed_at: nowIso(),
    steps: [
      "Resumed PR managed-agent session",
      "Checked out feature/billing-copy",
      "Ran app tests",
      "Replayed settings-navigation behavior contract",
      "Observed modal instead of page navigation",
      "Compared change against PR scope",
      "Flagged suspicious behavior mismatch"
    ],
    tests: {
      command: "npm test",
      status: "passed",
      summary: "Unit tests passed, but behavior replay found one suspicious change."
    }
  };

  await writeJson(path.join(base, "metadata.json"), metadata);
  await writeJson(path.join(base, "scope.json"), scope);
  await writeJson(path.join(base, "behavior-diff.json"), diff);
  await writeJson(path.join(base, "runs", `${run}.json`), runData);
  await writeText(path.join(base, "reports", "latest.md"), `# PR ${prNumber} QA Report

Verdict: FAIL

Unexpected behavior change outside PR scope.

## Mismatch

Action: click Settings button on Dashboard

Main behavior:

- Navigates to Settings page at /settings

PR behavior:

- Opens a Settings modal without changing URL

## Scope Analysis

The PR appears to update billing copy. No settings navigation change is mentioned.

## Evidence

- Main after screenshot: screenshots/main-after-settings.svg
- PR after screenshot: screenshots/pr-after-settings.svg
`);
  await writeText(path.join(base, "skills", "review-billing-copy.md"), `# Review Billing Copy

Context:
This PR touches billing copy. Verify that billing labels changed without altering global navigation.

Steps:
1. Open Dashboard.
2. Navigate to Billing.
3. Confirm invoice copy updates are visible.
4. Re-run Settings navigation as a guardrail.
`);
  await writeText(
    path.join(base, "screenshots", "main-before-settings.svg"),
    screenshotSvg({
      title: "Dashboard",
      subtitle: "Main baseline before Settings action",
      mode: "main"
    })
  );
  await writeText(
    path.join(base, "screenshots", "main-after-settings.svg"),
    screenshotSvg({
      title: "Settings",
      subtitle: "Main expected result: page navigation",
      mode: "main"
    })
  );
  await writeText(
    path.join(base, "screenshots", "pr-before-settings.svg"),
    screenshotSvg({
      title: "Dashboard",
      subtitle: "PR branch before Settings action",
      mode: "pr"
    })
  );
  await writeText(
    path.join(base, "screenshots", "pr-after-settings.svg"),
    screenshotSvg({
      title: "Dashboard",
      subtitle: "PR observed result: modal opens",
      mode: "pr",
      variant: "modal"
    })
  );

  await appendEvent("pr-analysis", `PR ${prNumber} analyzed with one suspicious mismatch`, {
    pr: prId,
    run_id: run
  });
  return runData;
}

async function promotePr(prNumber = "1") {
  const prId = `pr-${prNumber}`;
  const prBase = path.join(STORE_DIR, "prs", prId);
  const metadata = await readJson(path.join(prBase, "metadata.json"), null);
  if (!metadata) {
    throw new Error(`PR ${prNumber} has not been analyzed yet`);
  }

  const promotionId = runId(`${prId}-promotion`);
  const mainBase = path.join(STORE_DIR, "main");
  const promotion = {
    id: promotionId,
    pr: prId,
    status: "completed",
    created_at: nowIso(),
    promoted: [
      "skills/review-billing-copy.md"
    ],
    not_promoted: [
      {
        artifact: "behavior-diff.json",
        reason: "Settings navigation mismatch was suspicious and needs human approval before becoming canonical."
      }
    ]
  };

  await ensureDir(path.join(mainBase, "skills"));
  if (existsSync(path.join(prBase, "skills", "review-billing-copy.md"))) {
    await cp(
      path.join(prBase, "skills", "review-billing-copy.md"),
      path.join(mainBase, "skills", `from-${prId}-review-billing-copy.md`)
    );
  }
  metadata.status = "merged";
  metadata.merged_at = nowIso();
  await writeJson(path.join(prBase, "metadata.json"), metadata);
  await writeJson(path.join(prBase, "promotion-report.json"), promotion);
  await writeText(path.join(mainBase, "reports", `${promotionId}.md`), `# Knowledge Promotion ${prId}

Status: completed

Promoted:

- Billing-copy review skill

Not promoted:

- Settings navigation modal behavior, because it was flagged as suspicious and should not become main knowledge without approval.
`);

  await appendEvent("knowledge-promotion", `Promoted accepted knowledge from ${prId}`, {
    pr: prId,
    promotion_id: promotionId
  });
  return promotion;
}

function githubAuthHeader() {
  const pat = runtimeConfig.githubPat || "";
  if (!pat) return null;
  return `Basic ${Buffer.from(`x-oauth-basic:${pat}`).toString("base64")}`;
}

function googleEnvironmentConfig() {
  const environment = {
    type: "remote",
    sources: [
      {
        type: "repository",
        source: runtimeConfig.repoUrl,
        target: "/workspace/repo"
      }
    ]
  };
  const auth = githubAuthHeader();
  if (auth) {
    environment.network = {
      allowlist: [
        { domain: "github.com", transform: { Authorization: auth } },
        { domain: "api.github.com", transform: { Authorization: auth } },
        { domain: "*" }
      ]
    };
  }
  return environment;
}

function interactionId(interaction) {
  return interaction.id || interaction.name || interaction.interaction_id || interaction.interactionId || "";
}

function environmentId(interaction) {
  return interaction.environment_id || interaction.environmentId || interaction.environment?.id || interaction.environment?.name || "";
}

function interactionText(interaction) {
  const direct = [
    interaction.output_text,
    interaction.outputText,
    interaction.text,
    interaction.response,
    interaction.final_response,
    interaction.finalResponse
  ].filter(Boolean);
  if (direct.length) return direct.map(String).join("\n");

  const parts = [];
  const visit = (value) => {
    if (!value || parts.length > 100) return;
    if (typeof value === "string") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === "object") {
      if (typeof value.text === "string") parts.push(value.text);
      if (typeof value.content === "string") parts.push(value.content);
      Object.values(value).forEach(visit);
    }
  };
  visit(interaction);
  return [...new Set(parts)].join("\n");
}

async function callGoogleManagedAgent({ prompt, environment, previousInteractionId, previousEnvironmentId }) {
  if (!runtimeConfig.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is required for google mode");
  }
  const body = {
    agent: runtimeConfig.agent,
    input: [{ type: "text", text: prompt }],
    environment: previousEnvironmentId || environment
  };
  if (previousInteractionId) {
    body.previous_interaction_id = previousInteractionId;
  }

  const response = await fetch(runtimeConfig.interactionsEndpoint || DEFAULT_INTERACTIONS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": runtimeConfig.geminiApiKey
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini interaction failed: ${response.status} ${text}`);
  }
  return JSON.parse(text);
}

function extractMarkedJson(text) {
  if (!text) return null;
  const match = text.match(/AUTOQA_RESULT_JSON_START\s*([\s\S]*?)\s*AUTOQA_RESULT_JSON_END/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function findDirectoryByName(root, wanted) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const file = path.join(root, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name === wanted) return file;
    const nested = await findDirectoryByName(file, wanted).catch(() => null);
    if (nested) return nested;
  }
  return null;
}

async function downloadEnvironmentSnapshot(envId, run) {
  if (!envId) {
    throw new Error("Google response did not include an environment id");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/files/environment-${encodeURIComponent(envId)}:download?alt=media`;
  const response = await fetch(url, {
    headers: {
      "x-goog-api-key": runtimeConfig.geminiApiKey
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Environment snapshot download failed: ${response.status} ${text}`);
  }
  const tarPath = path.join("/tmp", `autoqa-${run}.tar`);
  const extractDir = path.join("/tmp", `autoqa-${run}-extract`);
  await rm(tarPath, { force: true });
  await rm(extractDir, { recursive: true, force: true });
  await ensureDir(extractDir);
  await writeFile(tarPath, Buffer.from(await response.arrayBuffer()));
  await execFileAsync("tar", ["-xf", tarPath, "-C", extractDir], { timeout: 120000 });
  return { tarPath, extractDir };
}

async function copyIfExists(source, target) {
  if (!existsSync(source)) return false;
  await ensureDir(path.dirname(target));
  await cp(source, target, { recursive: true, force: true });
  return true;
}

async function importSnapshotArtifacts({ envId, run, target, prId }) {
  const { tarPath, extractDir } = await downloadEnvironmentSnapshot(envId, run);
  try {
    const outputDir = await findDirectoryByName(extractDir, "autoqa-output");
    if (!outputDir) {
      throw new Error("No /workspace/autoqa-output directory found in environment snapshot");
    }
    const source = target === "main"
      ? path.join(outputDir, "main")
      : path.join(outputDir, "prs", prId);
    const targetDir = target === "main"
      ? path.join(STORE_DIR, "main")
      : path.join(STORE_DIR, "prs", prId);
    const copied = await copyIfExists(source, targetDir);
    if (!copied) {
      await copyIfExists(outputDir, targetDir);
    }
    return {
      ok: true,
      outputDir,
      copiedFrom: copied ? source : outputDir,
      copiedTo: targetDir
    };
  } finally {
    await rm(tarPath, { force: true });
    await rm(extractDir, { recursive: true, force: true });
  }
}

async function writeGoogleFallbackArtifacts({ target, prId, run, interaction, error, resultJson }) {
  const base = target === "main" ? path.join(STORE_DIR, "main") : path.join(STORE_DIR, "prs", prId);
  const text = interactionText(interaction);
  const envId = environmentId(interaction);
  const intId = interactionId(interaction);
  const timestamp = nowIso();

  if (target === "main") {
    await writeJson(path.join(base, "state.json"), {
      branch: runtimeConfig.mainBranch,
      title: "Main product memory",
      status: error ? "remote-agent-artifact-download-failed" : "remote-agent-complete",
      last_run_id: run,
      last_verified_at: timestamp,
      agent_environment_id: envId,
      previous_interaction_id: intId,
      summary: resultJson?.summary || "Remote Gemini managed agent completed. Output is stored in the run file."
    });
  } else {
    await writeJson(path.join(base, "metadata.json"), {
      pr_number: Number(runtimeConfig.prNumber || prId.replace(/^pr-/, "")),
      id: prId,
      branch: runtimeConfig.prBranch,
      title: runtimeConfig.prTitle || `PR ${runtimeConfig.prNumber || prId}`,
      status: "open",
      inherited_from: "main",
      agent_environment_id: envId,
      previous_interaction_id: intId,
      updated_at: timestamp
    });
    await writeJson(path.join(base, "scope.json"), {
      summary: runtimeConfig.prScope || resultJson?.scope_summary || "Scope was inferred by the remote agent.",
      sources: ["manual config", "remote agent"]
    });
  }

  await writeJson(path.join(base, "runs", `${run}.json`), {
    id: run,
    mode: "google",
    status: error ? "artifact-download-failed" : "completed",
    started_at: timestamp,
    completed_at: nowIso(),
    environment_id: envId,
    interaction_id: intId,
    artifact_error: error?.message || null,
    result_json: resultJson || null,
    output_text: text
  });
  await writeText(path.join(base, "reports", "latest.md"), `# Google Managed Agent Run

Status: ${error ? "artifact download failed" : "completed"}

Environment: ${envId || "unknown"}

Interaction: ${intId || "unknown"}

${error ? `Artifact error: ${error.message}\n` : ""}

## Agent Output

${text || "No text output returned."}
`);
}

function serializeMainMemoryForPrompt(main) {
  const memory = {
    state: main.state,
    graph: main.graph,
    behaviors: main.behaviors?.map((item) => item.data) || [],
    skills: main.skills?.map((item) => item.name) || [],
    screenshots: main.screenshots?.map((item) => item.name) || []
  };
  return JSON.stringify(memory, null, 2).slice(0, 50000);
}

function googleMainPrompt(run) {
  return `You are the main-branch QA memory agent for auto-qa.

You are running in a Google managed-agent Linux environment. The repository is mounted at /workspace/repo.

Goal:
Learn the product behavior of the main branch, run tests, explore the app through a browser, capture screenshots, and write a durable product-memory artifact tree.

Branch:
${runtimeConfig.mainBranch}

Required output directory:
/workspace/autoqa-output/main

Create this exact file tree where possible:
- state.json
- behavior-graph.json
- behaviors/*.json
- screenshots/*.png
- skills/*.md
- reports/latest.md
- runs/${run}.json

Execution requirements:
1. cd /workspace/repo.
2. Checkout the branch "${runtimeConfig.mainBranch}".
3. Inspect package files and install dependencies using the repo's package manager.
4. Run the repo's test command if one exists.
5. Start the app locally. Detect the app URL/port.
6. Explore the UI with a real browser.
7. Use Gemini Computer Use for screenshot-based UI actions if the managed environment exposes it. If it is not available, use Playwright as the action executor and the managed agent's visual reasoning over screenshots as the fallback. Record which path you used in runs/${run}.json.
8. Capture useful screenshots into screenshots/*.png.
9. Create behavior contracts that describe actions and expected results. Prefer navigation and important buttons/forms.
10. Create at least one reusable skill markdown file.
11. Write a human-readable report.

Behavior contract JSON shape:
{
  "id": "stable-kebab-id",
  "screen": "Screen name",
  "action": "click or type action",
  "expected_result": {
    "type": "navigation|modal|state-change|form-result|unknown",
    "destination": "optional",
    "url_change": "optional",
    "visual_anchor": "observable text/element"
  },
  "confidence": 0.0,
  "learned_from": "main",
  "last_verified_at": "ISO timestamp",
  "evidence": {
    "before_screenshot": "screenshots/file.png",
    "after_screenshot": "screenshots/file.png"
  }
}

At the end, print a compact JSON summary between these exact markers:
AUTOQA_RESULT_JSON_START
{"target":"main","run_id":"${run}","summary":"...","artifact_root":"/workspace/autoqa-output/main","computer_use_path":"computer_use|playwright_fallback|blocked"}
AUTOQA_RESULT_JSON_END

Do not ask for clarification. If the app cannot run, still write state.json, reports/latest.md, and runs/${run}.json explaining the blocker.`;
}

function googlePrPrompt({ run, prId, mainMemory }) {
  const branch = runtimeConfig.prBranch || `pull/${runtimeConfig.prNumber}/head`;
  const title = runtimeConfig.prTitle || `PR ${runtimeConfig.prNumber}`;
  const scope = runtimeConfig.prScope || "No manual scope provided. Infer the intended scope from the branch, git diff, commits, and changed files.";
  return `You are a PR-specific QA memory agent for auto-qa.

You are running in a Google managed-agent Linux environment. The repository is mounted at /workspace/repo.

Goal:
Analyze a pull request branch by comparing it against the main product memory. Run tests, replay known behavior contracts through a browser, capture screenshots, and flag behavior changes outside the PR scope.

PR id:
${prId}

PR number:
${runtimeConfig.prNumber}

PR branch or ref:
${branch}

PR title:
${title}

PR scope:
${scope}

Main memory to compare against:
${mainMemory}

Required output directory:
/workspace/autoqa-output/prs/${prId}

Create this exact file tree where possible:
- metadata.json
- scope.json
- behavior-diff.json
- screenshots/*.png
- skills/*.md
- reports/latest.md
- runs/${run}.json

Execution requirements:
1. cd /workspace/repo.
2. Fetch and checkout the PR branch/ref. If "${branch}" is not directly check-outable and this is GitHub, try "git fetch origin pull/${runtimeConfig.prNumber}/head:autoqa-${prId}" and checkout "autoqa-${prId}".
3. Install dependencies using the repo's package manager if needed.
4. Run the repo's test command if one exists.
5. Start the app locally. Detect the app URL/port.
6. Explore the UI with a real browser.
7. Use Gemini Computer Use for screenshot-based UI actions if the managed environment exposes it. If it is not available, use Playwright as the action executor and the managed agent's visual reasoning over screenshots as the fallback. Record which path you used in runs/${run}.json.
8. Replay the known main behavior contracts, prioritizing navigation and important UI actions.
9. Capture before/after screenshots into screenshots/*.png.
10. Compare observed PR behavior against main behavior and PR scope.
11. Write behavior-diff.json. If no issue is found, write severity "none" and verdict "No unexpected behavior changes found".
12. Write a report with test results, behavior diffs, screenshots, confidence, and whether the change is in scope.
13. Create or refine at least one skill markdown file for future PR testing.

metadata.json shape:
{
  "pr_number": ${JSON.stringify(Number(runtimeConfig.prNumber || 1))},
  "id": "${prId}",
  "branch": ${JSON.stringify(branch)},
  "title": ${JSON.stringify(title)},
  "status": "open",
  "inherited_from": "main",
  "agent_environment_id": "",
  "previous_interaction_id": "",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}

behavior-diff.json shape:
{
  "id": "stable-kebab-id",
  "severity": "none|expected|suspicious|regression|blocked",
  "verdict": "short verdict",
  "confidence": 0.0,
  "contract": "behavior contract id",
  "action": "action replayed",
  "main_behavior": {"type":"...","description":"..."},
  "pr_behavior": {"type":"...","description":"..."},
  "scope_match": false,
  "rationale": "why this is expected or suspicious",
  "evidence": ["screenshots/file.png"]
}

At the end, print a compact JSON summary between these exact markers:
AUTOQA_RESULT_JSON_START
{"target":"pr","pr_id":"${prId}","run_id":"${run}","summary":"...","artifact_root":"/workspace/autoqa-output/prs/${prId}","computer_use_path":"computer_use|playwright_fallback|blocked"}
AUTOQA_RESULT_JSON_END

Do not ask for clarification. If the app cannot run, still write metadata.json, scope.json, behavior-diff.json, reports/latest.md, and runs/${run}.json explaining the blocker.`;
}

async function finalizeImportedGoogleArtifacts({ target, prId, run, interaction, importResult, resultJson }) {
  const base = target === "main" ? path.join(STORE_DIR, "main") : path.join(STORE_DIR, "prs", prId);
  const envId = environmentId(interaction);
  const intId = interactionId(interaction);
  const runFile = path.join(base, "runs", `${run}.json`);
  const existingRun = await readJson(runFile, {});
  await writeJson(runFile, {
    id: run,
    mode: "google",
    status: existingRun.status || "completed",
    started_at: existingRun.started_at || nowIso(),
    completed_at: nowIso(),
    ...existingRun,
    environment_id: envId,
    interaction_id: intId,
    artifact_import: importResult,
    result_json: resultJson || null
  });

  if (target === "main") {
    const stateFile = path.join(base, "state.json");
    const state = await readJson(stateFile, {});
    await writeJson(stateFile, {
      branch: runtimeConfig.mainBranch,
      title: "Main product memory",
      status: "remote-agent-complete",
      last_run_id: run,
      last_verified_at: nowIso(),
      ...state,
      agent_environment_id: envId,
      previous_interaction_id: intId
    });
  } else {
    const metadataFile = path.join(base, "metadata.json");
    const metadata = await readJson(metadataFile, {});
    await writeJson(metadataFile, {
      pr_number: Number(runtimeConfig.prNumber || prId.replace(/^pr-/, "")),
      id: prId,
      branch: runtimeConfig.prBranch,
      title: runtimeConfig.prTitle || `PR ${runtimeConfig.prNumber || prId}`,
      status: "open",
      inherited_from: "main",
      created_at: nowIso(),
      ...metadata,
      agent_environment_id: envId,
      previous_interaction_id: intId,
      updated_at: nowIso()
    });
  }
}

async function runGoogleMainLearning() {
  if (!runtimeConfig.repoUrl) {
    throw new Error("Repository URL is required for Google mode");
  }
  const run = runId("google-main-learning");
  await appendEvent("google-main-learning", "Starting remote Gemini main learning run", { run_id: run });
  const interaction = await callGoogleManagedAgent({
    prompt: googleMainPrompt(run),
    environment: googleEnvironmentConfig()
  });
  const resultJson = extractMarkedJson(interactionText(interaction));
  let importResult = null;
  try {
    importResult = await importSnapshotArtifacts({
      envId: environmentId(interaction),
      run,
      target: "main"
    });
    await finalizeImportedGoogleArtifacts({ target: "main", run, interaction, importResult, resultJson });
  } catch (error) {
    await writeGoogleFallbackArtifacts({ target: "main", run, interaction, error, resultJson });
    importResult = { ok: false, error: error.message };
  }

  await appendEvent("google-main-learning", "Remote Gemini main learning run completed", {
    run_id: run,
    environment_id: environmentId(interaction),
    artifact_import: importResult
  });
  return { run, interaction_id: interactionId(interaction), environment_id: environmentId(interaction), artifact_import: importResult };
}

async function runGooglePrAnalysis(prNumber = "1") {
  if (!runtimeConfig.repoUrl) {
    throw new Error("Repository URL is required for Google mode");
  }
  runtimeConfig.prNumber = String(prNumber || runtimeConfig.prNumber || "1");
  const prId = `pr-${runtimeConfig.prNumber}`;
  const run = runId(`${prId}-google-analysis`);
  const mainMemory = serializeMainMemoryForPrompt(await collectMain());
  const previous = await readJson(path.join(STORE_DIR, "prs", prId, "metadata.json"), null);
  const previousInteractionId = previous?.previous_interaction_id || "";
  const previousEnvironmentId = previous?.agent_environment_id || "";
  await appendEvent("google-pr-analysis", `Starting remote Gemini analysis for ${prId}`, {
    pr: prId,
    run_id: run
  });

  const interaction = await callGoogleManagedAgent({
    prompt: googlePrPrompt({ run, prId, mainMemory }),
    environment: googleEnvironmentConfig(),
    previousInteractionId,
    previousEnvironmentId
  });
  const resultJson = extractMarkedJson(interactionText(interaction));
  let importResult = null;
  try {
    importResult = await importSnapshotArtifacts({
      envId: environmentId(interaction) || previousEnvironmentId,
      run,
      target: "pr",
      prId
    });
    await finalizeImportedGoogleArtifacts({ target: "pr", prId, run, interaction, importResult, resultJson });
  } catch (error) {
    await writeGoogleFallbackArtifacts({ target: "pr", prId, run, interaction, error, resultJson });
    importResult = { ok: false, error: error.message };
  }

  await appendEvent("google-pr-analysis", `Remote Gemini PR analysis completed for ${prId}`, {
    pr: prId,
    run_id: run,
    environment_id: environmentId(interaction) || previousEnvironmentId,
    artifact_import: importResult
  });
  return { run, pr: prId, interaction_id: interactionId(interaction), environment_id: environmentId(interaction) || previousEnvironmentId, artifact_import: importResult };
}

async function collectMain() {
  const base = path.join(STORE_DIR, "main");
  const behaviorFiles = await listFiles(path.join(base, "behaviors"), [".json"]);
  const reportFiles = await listFiles(path.join(base, "reports"), [".md"]);
  const skillFiles = await listFiles(path.join(base, "skills"), [".md"]);
  const screenshotFiles = await listFiles(path.join(base, "screenshots"), [".svg", ".png", ".jpg", ".jpeg"]);
  const runFiles = await listFiles(path.join(base, "runs"), [".json"]);

  return {
    state: await readJson(path.join(base, "state.json"), null),
    graph: await readJson(path.join(base, "behavior-graph.json"), null),
    behaviors: await Promise.all(
      behaviorFiles.map(async (name) => ({
        name,
        data: await readJson(path.join(base, "behaviors", name)),
        url: artifactUrl("main", "behaviors", name)
      }))
    ),
    reports: reportFiles.map((name) => ({ name, url: artifactUrl("main", "reports", name) })),
    skills: skillFiles.map((name) => ({ name, url: artifactUrl("main", "skills", name) })),
    screenshots: screenshotFiles.map((name) => ({ name, url: artifactUrl("main", "screenshots", name) })),
    runs: await Promise.all(
      runFiles.map(async (name) => ({
        name,
        data: await readJson(path.join(base, "runs", name)),
        url: artifactUrl("main", "runs", name)
      }))
    )
  };
}

async function collectPr(prId) {
  const base = path.join(STORE_DIR, "prs", prId);
  const reportFiles = await listFiles(path.join(base, "reports"), [".md"]);
  const skillFiles = await listFiles(path.join(base, "skills"), [".md"]);
  const screenshotFiles = await listFiles(path.join(base, "screenshots"), [".svg", ".png", ".jpg", ".jpeg"]);
  const runFiles = await listFiles(path.join(base, "runs"), [".json"]);
  return {
    id: prId,
    metadata: await readJson(path.join(base, "metadata.json"), null),
    scope: await readJson(path.join(base, "scope.json"), null),
    behaviorDiff: await readJson(path.join(base, "behavior-diff.json"), null),
    promotionReport: await readJson(path.join(base, "promotion-report.json"), null),
    reports: reportFiles.map((name) => ({ name, url: artifactUrl("prs", prId, "reports", name) })),
    skills: skillFiles.map((name) => ({ name, url: artifactUrl("prs", prId, "skills", name) })),
    screenshots: screenshotFiles.map((name) => ({ name, url: artifactUrl("prs", prId, "screenshots", name) })),
    runs: await Promise.all(
      runFiles.map(async (name) => ({
        name,
        data: await readJson(path.join(base, "runs", name)),
        url: artifactUrl("prs", prId, "runs", name)
      }))
    )
  };
}

async function collectState() {
  await ensureDir(STORE_DIR);
  const prsDir = path.join(STORE_DIR, "prs");
  const prIds = await listDirs(prsDir);
  return {
    config: publicConfig(),
    main: await collectMain(),
    prs: await Promise.all(prIds.map(collectPr)),
    events: await readJson(path.join(STORE_DIR, "event-log.json"), [])
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/state") {
      return sendJson(res, 200, await collectState());
    }

    if (req.method === "GET" && pathname === "/api/config") {
      return sendJson(res, 200, publicConfig());
    }

    if (req.method === "POST" && pathname === "/api/config") {
      const body = await readBody(req);
      await saveLocalConfig(body);
      return sendJson(res, 200, { ok: true, config: publicConfig(), state: await collectState() });
    }

    if (req.method === "POST" && pathname === "/api/demo/reset") {
      const savedConfig = { ...runtimeConfig };
      await rm(STORE_DIR, { recursive: true, force: true });
      runtimeConfig = savedConfig;
      await writeJson(LOCAL_CONFIG_FILE, runtimeConfig);
      await appendEvent("reset", "Local auto-qa artifact store reset");
      return sendJson(res, 200, await collectState());
    }

    if (req.method === "POST" && pathname === "/api/runs/main") {
      let result;
      if (runtimeConfig.mode === "google") {
        result = await runGoogleMainLearning();
      } else {
        result = await seedMainArtifacts();
      }
      return sendJson(res, 200, { ok: true, result, state: await collectState() });
    }

    if (req.method === "POST" && pathname === "/api/prs/analyze") {
      const body = await readBody(req);
      if (body.prNumber) runtimeConfig.prNumber = String(body.prNumber);
      if (body.prBranch !== undefined) runtimeConfig.prBranch = String(body.prBranch || "");
      if (body.prTitle !== undefined) runtimeConfig.prTitle = String(body.prTitle || "");
      if (body.prScope !== undefined) runtimeConfig.prScope = String(body.prScope || "");
      await writeJson(LOCAL_CONFIG_FILE, runtimeConfig);
      const prNumber = String(runtimeConfig.prNumber || "1");
      const result = runtimeConfig.mode === "google"
        ? await runGooglePrAnalysis(prNumber)
        : await seedPrArtifacts(prNumber);
      return sendJson(res, 200, { ok: true, result, state: await collectState() });
    }

    const promoteMatch = pathname.match(/^\/api\/prs\/([^/]+)\/promote$/);
    if (req.method === "POST" && promoteMatch) {
      const result = await promotePr(promoteMatch[1].replace(/^pr-/, ""));
      return sendJson(res, 200, { ok: true, result, state: await collectState() });
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}

async function serveFile(res, file) {
  try {
    const info = await stat(file);
    if (!info.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith("/api/")) {
    return handleApi(req, res, pathname);
  }

  if (pathname.startsWith("/artifacts/")) {
    const requested = pathname.slice("/artifacts/".length);
    return serveFile(res, safeJoin(STORE_DIR, requested));
  }

  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  return serveFile(res, safeJoin(PUBLIC_DIR, requested));
});

server.listen(PORT, HOST, async () => {
  await ensureDir(PUBLIC_DIR);
  await ensureDir(STORE_DIR);
  await loadLocalConfig();
  console.log(`auto-qa local viewer running at http://${HOST}:${PORT}`);
  console.log(`mode=${runtimeConfig.mode} repo=${runtimeConfig.repoUrl || "(not configured)"}`);
});
