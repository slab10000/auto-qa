// Merge-on-merge: when a PR is accepted/merged, fold its branch knowledge into main.
// This is the continual-learning core — only accepted behavior becomes canonical, and
// every merged branch leaves a visual-history snapshot under screenshots/<branch>/.
import path from "node:path";
import { existsSync, cpSync, readdirSync, mkdirSync } from "node:fs";
import { AUTOQA, paths, readJSON, writeJSON } from "./memory.mjs";

const stamp = () => new Date().toISOString();
const copyDir = (src, dest) => {
  if (!existsSync(src)) return [];
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  return readdirSync(src);
};

export async function mergePR(prId = "pr-1", { onEvent } = {}) {
  const emit = onEvent || (() => {});
  const report = await readJSON(paths.prReport(prId));
  if (!report) throw new Error(`no report for ${prId} — run a review first`);
  const branch = report.pr.branch;

  emit({ type: "phase", phase: "merge", message: `Approving & folding ${branch} into main` });

  // 1) Visual history: snapshot the PR's screens under screenshots/<branch>/
  const prScreensDir = paths.prScreens(prId);
  const baselines = copyDir(prScreensDir, paths.screenshots(branch));

  // 2) The PR's screens become the new accepted main baselines
  copyDir(prScreensDir, paths.screenshots("main"));

  // 3) Behavior contracts: any mismatch is now the ACCEPTED behavior (human approved the merge)
  const contractUpdates = [];
  for (const bc of report.behavior_checks || []) {
    if (bc.match) continue;
    const file = path.join(paths.mainBehaviors, `${bc.contract_id}.json`);
    const contract = await readJSON(file);
    if (!contract) continue;
    const before = contract.expected_result.type;
    contract.expected_result = {
      type: bc.observed.type,
      url_changed: bc.observed.url_changed,
      destination_url: bc.observed.destination_url,
      visual_anchor: contract.expected_result.visual_anchor,
    };
    contract.learned_from = branch;
    contract.last_verified = stamp();
    await writeJSON(file, contract);
    contractUpdates.push({ contract: bc.contract_id, from: before, to: bc.observed.type });
  }

  // 4) PR-specific skills graduate into main skills
  const mergedSkills = copyDir(path.join(paths.prDir(prId), "skills"), paths.mainSkills).filter((f) => f.endsWith(".md"));

  // 5) Record the merge + mark the report merged
  const summary = {
    pr: report.pr,
    merged_at: stamp(),
    history_snapshot: `screenshots/${branch}/`,
    baselines_updated: baselines,
    contract_updates: contractUpdates,
    merged_skills: mergedSkills,
  };
  await writeJSON(path.join(AUTOQA, "main", "merges", `${prId}.json`), summary);
  report.merged = true;
  report.merged_at = summary.merged_at;
  await writeJSON(paths.prReport(prId), report);

  emit({ type: "merge_done", ...summary });
  console.log(`✅ merged ${branch} → main: ${contractUpdates.length} contract update(s), ${mergedSkills.length} skill(s), history snapshot saved`);
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await mergePR(process.argv[2] || "pr-1");
}
