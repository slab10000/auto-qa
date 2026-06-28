// PR review = the GitHub review engine, plus a cockpit-shaped report.json so the
// in-app run inspector (/pr/[id]) and Current PRs render the same review the agent posts.
import { githubReview } from "./github-review.mjs";
import { TARGET_REPO } from "./config.mjs";
import { paths, writeJSON, writeText } from "./memory.mjs";

const stamp = () => new Date().toISOString();

export async function reviewPR(prRef = "1", { onEvent, post = true } = {}) {
  const t0 = Date.now();
  const n = String(prRef).replace(/^pr-/, "") || "1";
  const res = await githubReview(TARGET_REPO, n, { onEvent, post });

  // Map the GitHub review into the cockpit report shape. Evidence points at the
  // base/head screenshots Computer Use already captured under .autoqa/gh/.
  const slug = TARGET_REPO.replace("/", "__");
  const evidence = { main: {}, pr: {} };
  const visual_comparisons = res.comparisons.map((c) => {
    const id = c.page.toLowerCase();
    evidence.main[id] = `gh/${slug}/pr-${n}/base/${c.file}.png`;
    evidence.pr[id] = `gh/${slug}/pr-${n}/head/${c.file}.png`;
    return { screen: c.page, changed: c.changed, summary: c.summary, severity: c.severity };
  });

  const prId = `pr-${n}`;
  const report = {
    pr: {
      id: prId,
      number: res.pr.number,
      title: res.pr.title,
      description: res.pr.body,
      branch: res.pr.headRefName,
      base: res.pr.baseRefName,
    },
    generated_at: stamp(),
    took_ms: Date.now() - t0,
    verdict: res.scope.verdict,
    behavior_checks: [], // GitHub flow is page-level visual + scope; nav contracts live in main memory
    visual_comparisons,
    scope_analysis: res.scope,
    code_review: { ...res.code_review, ran_in: "remote managed agent · antigravity" },
    changed_files: res.changedFiles,
    evidence,
    github: { repo: TARGET_REPO, url: res.pr.url, posted: res.posted ?? null },
  };

  await writeJSON(paths.prReport(prId), report);
  await writeText(paths.prComparison(prId), res.body);
  console.log(`\n🧾 cockpit report written → .autoqa/prs/${prId}/report.json`);
  return report;
}

// Direct: node --env-file=.env.local qa-agent/review.mjs [pr-number]
if (import.meta.url === `file://${process.argv[1]}`) {
  await reviewPR(process.argv[2] || "1");
  // A managed-agent SDK call may still be in flight after a timeout; flush + force exit.
  process.stdout.write("", () => process.exit(0));
}
