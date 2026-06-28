// Publish before/after screenshots so they can be EMBEDDED in the PR comment.
// GitHub markdown can't inline local files or data: URIs, so the images are pushed to a branch
// in the tool's OWN repo (auto-qa) and referenced via raw.githubusercontent.com. Hosting in the
// tool repo (not the reviewed repo) keeps the target clean and works even without push access there.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const EVIDENCE_BRANCH = process.env.AUTOQA_EVIDENCE_BRANCH || "auto-qa-evidence";

function evidenceEnv() {
  const env = { ...process.env };
  if (env.AUTOQA_EVIDENCE_TOKEN) {
    env.GH_TOKEN = env.AUTOQA_EVIDENCE_TOKEN;
  } else if (env.AUTOQA_BOT_TOKEN && env.GH_TOKEN === env.AUTOQA_BOT_TOKEN) {
    delete env.GH_TOKEN;
  }
  return env;
}

const gh = (args, opts = {}) =>
  execFileSync("gh", args, { encoding: "utf8", maxBuffer: 96 * 1024 * 1024, env: evidenceEnv(), ...opts });

// The repo to host evidence in: AUTOQA_EVIDENCE_REPO, else the repo this CLI runs from (auto-qa).
export function evidenceRepo() {
  if (process.env.AUTOQA_EVIDENCE_REPO) return process.env.AUTOQA_EVIDENCE_REPO;
  try { return gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]).trim(); }
  catch { return null; }
}

function ensureBranch(repo, branch) {
  try { gh(["api", `repos/${repo}/branches/${branch}`]); return true; } catch {}
  try {
    const sha = gh(["api", "repos/" + repo + "/commits/HEAD", "-q", ".sha"]).trim();
    gh(["api", "-X", "POST", `repos/${repo}/git/refs`, "-f", `ref=refs/heads/${branch}`, "-f", `sha=${sha}`]);
    return true;
  } catch { return false; }
}

function rawUrl(repo, branch, filePath) {
  return `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
}

function existingRawUrl(repo, branch, filePath) {
  try {
    return gh(["api", `repos/${repo}/contents/${filePath}?ref=${branch}`, "-q", ".download_url"]).trim() ||
      rawUrl(repo, branch, filePath);
  } catch {
    return null;
  }
}

// Create the file on the evidence branch. Paths are keyed by head SHA, so re-reviewing the same
// commit hits the same path; if the image already exists, reuse its raw URL without writing.
function putFile(repo, branch, filePath, buf, message) {
  const existing = existingRawUrl(repo, branch, filePath);
  if (existing) return existing;

  const body = JSON.stringify({ message, branch, content: buf.toString("base64") });
  try {
    gh(["api", "-X", "PUT", `repos/${repo}/contents/${filePath}`, "--input", "-"], { input: body });
  } catch (e) {
    const existingAfterFailure = existingRawUrl(repo, branch, filePath);
    if (existingAfterFailure) return existingAfterFailure;
    const msg = String(e?.stderr || e?.message || e);
    if (!/already exists|wasn't supplied|HTTP 422|\b422\b/i.test(msg)) {
      throw new Error(`${msg.trim()}\nSet AUTOQA_EVIDENCE_TOKEN to a token with write access to ${repo}, or let gh use a local account that can push there.`);
    }
  }
  return rawUrl(repo, branch, filePath);
}

// changedScreens: [{ name, file }]. shotPath(side, file) → absolute png path (side: "base"|"head").
// Returns { [screenName]: { before, after } } of public raw URLs. Best-effort: failures are skipped.
export async function publishEvidence({ repo, prNumber, slug, sha, changedScreens, shotPath, onEvent }) {
  const emit = onEvent || (() => {});
  const evRepo = evidenceRepo();
  if (!evRepo || !changedScreens?.length) return {};
  if (!ensureBranch(evRepo, EVIDENCE_BRANCH)) return {};
  const tag = String(sha || "head").slice(0, 7);
  const urls = {};
  for (const { name, file } of changedScreens) {
    const stem = file.replace(/\.html?$/, "");
    const dir = `evidence/${slug}/pr-${prNumber}/${tag}`;
    try {
      const before = putFile(evRepo, EVIDENCE_BRANCH, `${dir}/${stem}-before.png`, readFileSync(shotPath("base", file)), `evidence ${slug} pr-${prNumber} ${stem} before`);
      const after = putFile(evRepo, EVIDENCE_BRANCH, `${dir}/${stem}-after.png`, readFileSync(shotPath("head", file)), `evidence ${slug} pr-${prNumber} ${stem} after`);
      urls[name] = { before, after };
      emit({ type: "evidence", screen: name, before, after });
    } catch (e) {
      console.error(`⚠️  evidence upload failed for ${name}: ${e?.message || e}`);
    }
  }
  return urls;
}
