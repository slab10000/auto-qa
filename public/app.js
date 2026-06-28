const els = {
  modeLabel: document.querySelector("#modeLabel"),
  repoLabel: document.querySelector("#repoLabel"),
  mainTitle: document.querySelector("#mainTitle"),
  mainSummary: document.querySelector("#mainSummary"),
  behaviorCount: document.querySelector("#behaviorCount"),
  prCount: document.querySelector("#prCount"),
  eventCount: document.querySelector("#eventCount"),
  latestVerdict: document.querySelector("#latestVerdict"),
  latestVerdictCopy: document.querySelector("#latestVerdictCopy"),
  lastVerified: document.querySelector("#lastVerified"),
  behaviorGraph: document.querySelector("#behaviorGraph"),
  mainSkills: document.querySelector("#mainSkills"),
  mainReports: document.querySelector("#mainReports"),
  prList: document.querySelector("#prList"),
  evidenceGrid: document.querySelector("#evidenceGrid"),
  timelineList: document.querySelector("#timelineList"),
  toast: document.querySelector("#toast"),
  configForm: document.querySelector("#configForm"),
  keyStatus: document.querySelector("#keyStatus"),
  modeInput: document.querySelector("#modeInput"),
  repoInput: document.querySelector("#repoInput"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  mainBranchInput: document.querySelector("#mainBranchInput"),
  githubPatInput: document.querySelector("#githubPatInput"),
  prNumberInput: document.querySelector("#prNumberInput"),
  prBranchInput: document.querySelector("#prBranchInput"),
  prTitleInput: document.querySelector("#prTitleInput"),
  prScopeInput: document.querySelector("#prScopeInput"),
  buttons: Array.from(document.querySelectorAll("button"))
};

const actions = {
  runMain: document.querySelector("#runMainBtn"),
  analyzePr: document.querySelector("#analyzePrBtn"),
  promotePr: document.querySelector("#promotePrBtn"),
  reset: document.querySelector("#resetBtn")
};

let state = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setBusy(isBusy) {
  els.buttons.forEach((button) => {
    button.disabled = isBusy;
  });
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => {
    els.toast.hidden = true;
  }, 3600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

async function refresh() {
  state = await api("/api/state");
  render();
}

async function postAndRefresh(path, body, message) {
  try {
    setBusy(true);
    const payload = await api(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined
    });
    state = payload.state || (await api("/api/state"));
    render();
    toast(message);
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(false);
  }
}

function renderFiles(target, files) {
  if (!files?.length) {
    target.innerHTML = `<span class="muted">None yet</span>`;
    return;
  }
  target.innerHTML = files
    .map((file) => `<a href="${file.url}" target="_blank" rel="noreferrer">${escapeHtml(file.name)}</a>`)
    .join("");
}

function latestPrDiff() {
  return state?.prs?.find((pr) => pr.behaviorDiff)?.behaviorDiff || null;
}

function renderOverview() {
  const main = state.main;
  els.modeLabel.textContent = state.config.mode;
  els.repoLabel.textContent = state.config.repoUrl || "No repo configured";
  els.keyStatus.textContent = state.config.hasGeminiKey ? "key saved" : "no key saved";
  els.modeInput.value = state.config.mode || "demo";
  els.repoInput.value = state.config.repoUrl || "";
  els.mainBranchInput.value = state.config.mainBranch || "main";
  els.prNumberInput.value = state.config.prNumber || "1";
  els.prBranchInput.value = state.config.prBranch || "";
  els.prTitleInput.value = state.config.prTitle || "";
  els.prScopeInput.value = state.config.prScope || "";
  els.apiKeyInput.placeholder = state.config.hasGeminiKey ? "Saved. Paste a new key to replace." : "Paste key to save";
  els.githubPatInput.placeholder = state.config.hasGithubPat ? "Saved. Paste a new token to replace." : "Private repos only";
  els.mainTitle.textContent = main.state?.title || "No product memory yet";
  els.mainSummary.textContent = main.state?.summary || "Run main learning to create the canonical behavior memory.";
  els.behaviorCount.textContent = String(main.behaviors?.length || 0);
  els.prCount.textContent = String(state.prs?.length || 0);
  els.eventCount.textContent = String(state.events?.length || 0);
  els.lastVerified.textContent = main.state?.last_verified_at
    ? `verified ${new Date(main.state.last_verified_at).toLocaleString()}`
    : "not verified";

  const diff = latestPrDiff();
  if (!diff) {
    els.latestVerdict.className = "verdict empty";
    els.latestVerdict.textContent = "Waiting for analysis";
    els.latestVerdictCopy.textContent = "The PR agent has not replayed behavior contracts yet.";
  } else {
    els.latestVerdict.className = diff.severity === "suspicious" ? "verdict fail" : "verdict pass";
    els.latestVerdict.textContent = diff.verdict;
    els.latestVerdictCopy.textContent = diff.rationale;
  }
}

function renderMemory() {
  const behaviors = state.main.behaviors || [];
  if (!behaviors.length) {
    els.behaviorGraph.innerHTML = `<div class="empty-list">No behavior contracts learned yet.</div>`;
  } else {
    els.behaviorGraph.innerHTML = behaviors
      .map(({ data }) => {
        const expected = data.expected_result || {};
        return `<article class="behavior-card">
          <strong>${escapeHtml(data.screen)} -> ${escapeHtml(data.action)}</strong>
          <span class="muted">${escapeHtml(expected.type)} to ${escapeHtml(expected.destination || expected.url_change)}</span>
          <div class="contract-grid">
            <div>
              <span class="label">Expected</span>
              <p>${escapeHtml(expected.visual_anchor || "No anchor recorded")}</p>
            </div>
            <div>
              <span class="label">Confidence</span>
              <p>${escapeHtml(data.confidence ?? "unknown")}</p>
            </div>
          </div>
        </article>`;
      })
      .join("");
  }
  renderFiles(els.mainSkills, state.main.skills || []);
  renderFiles(els.mainReports, state.main.reports || []);
}

function renderPrs() {
  const prs = state.prs || [];
  if (!prs.length) {
    els.prList.className = "pr-list empty-list";
    els.prList.textContent = "No PR memories yet.";
    return;
  }
  els.prList.className = "pr-list";
  els.prList.innerHTML = prs
    .map((pr) => {
      const meta = pr.metadata || {};
      const scope = pr.scope || {};
      const diff = pr.behaviorDiff;
      const promotion = pr.promotionReport;
      return `<article class="pr-card">
        <strong>PR ${escapeHtml(meta.pr_number || pr.id)}: ${escapeHtml(meta.title || "Untitled")}</strong>
        <p class="muted">${escapeHtml(meta.branch || "unknown branch")} | ${escapeHtml(meta.status || "unknown")}</p>
        <p>${escapeHtml(scope.summary || "No scope summary yet.")}</p>
        ${diff ? `<div class="contract-grid">
          <div>
            <span class="label">Main behavior</span>
            <p>${escapeHtml(diff.main_behavior?.description)}</p>
          </div>
          <div>
            <span class="label">PR behavior</span>
            <p>${escapeHtml(diff.pr_behavior?.description)}</p>
          </div>
        </div>
        <div class="verdict fail">${escapeHtml(diff.verdict)}</div>
        <p class="muted">${escapeHtml(diff.rationale)}</p>` : ""}
        ${promotion ? `<p><span class="pill">knowledge promoted</span></p>` : ""}
        <div class="file-list">
          ${(pr.reports || []).map((file) => `<a href="${file.url}" target="_blank" rel="noreferrer">${escapeHtml(file.name)}</a>`).join("")}
          ${(pr.skills || []).map((file) => `<a href="${file.url}" target="_blank" rel="noreferrer">${escapeHtml(file.name)}</a>`).join("")}
        </div>
      </article>`;
    })
    .join("");
}

function renderEvidence() {
  const shots = [];
  for (const shot of state.main.screenshots || []) {
    shots.push({ ...shot, source: "main" });
  }
  for (const pr of state.prs || []) {
    for (const shot of pr.screenshots || []) {
      shots.push({ ...shot, source: pr.id });
    }
  }

  if (!shots.length) {
    els.evidenceGrid.innerHTML = `<div class="empty-list">No screenshots captured yet.</div>`;
    return;
  }

  els.evidenceGrid.innerHTML = shots
    .map((shot) => `<figure class="shot">
      <img src="${shot.url}" alt="${escapeHtml(shot.name)}">
      <figcaption>${escapeHtml(shot.source)} / ${escapeHtml(shot.name)}</figcaption>
    </figure>`)
    .join("");
}

function renderTimeline() {
  const events = state.events || [];
  const runSteps = [];
  for (const run of state.main.runs || []) {
    for (const step of run.data?.steps || []) {
      runSteps.push({ created_at: run.data.completed_at, message: step, type: "main-run" });
    }
  }
  for (const pr of state.prs || []) {
    for (const run of pr.runs || []) {
      for (const step of run.data?.steps || []) {
        runSteps.push({ created_at: run.data.completed_at, message: step, type: pr.id });
      }
    }
  }
  const timeline = [...events, ...runSteps]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 32);

  if (!timeline.length) {
    els.timelineList.innerHTML = `<div class="empty-list">No agent activity yet.</div>`;
    return;
  }

  els.timelineList.innerHTML = timeline
    .map((item) => `<div class="timeline-item">
      <time>${escapeHtml(item.type || "event")}</time>
      <div>
        <strong>${escapeHtml(item.message)}</strong>
        <div class="muted">${escapeHtml(item.created_at ? new Date(item.created_at).toLocaleString() : "")}</div>
      </div>
    </div>`)
    .join("");
}

function render() {
  renderOverview();
  renderMemory();
  renderPrs();
  renderEvidence();
  renderTimeline();
}

actions.runMain.addEventListener("click", () => {
  postAndRefresh("/api/runs/main", null, "Main learning run complete");
});

actions.analyzePr.addEventListener("click", () => {
  const prNumber = els.prNumberInput.value || "1";
  postAndRefresh("/api/prs/analyze", {
    prNumber,
    prBranch: els.prBranchInput.value,
    prTitle: els.prTitleInput.value,
    prScope: els.prScopeInput.value
  }, `PR ${prNumber} analysis complete`);
});

actions.promotePr.addEventListener("click", () => {
  const prNumber = els.prNumberInput.value || "1";
  postAndRefresh(`/api/prs/pr-${encodeURIComponent(prNumber)}/promote`, null, "Accepted PR knowledge promoted");
});

actions.reset.addEventListener("click", () => {
  postAndRefresh("/api/demo/reset", null, "Demo artifact store reset");
});

els.configForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const body = {
    mode: els.modeInput.value,
    repoUrl: els.repoInput.value,
    mainBranch: els.mainBranchInput.value || "main",
    prNumber: els.prNumberInput.value || "1",
    prBranch: els.prBranchInput.value,
    prTitle: els.prTitleInput.value,
    prScope: els.prScopeInput.value
  };
  if (els.apiKeyInput.value.trim()) {
    body.geminiApiKey = els.apiKeyInput.value.trim();
  }
  if (els.githubPatInput.value.trim()) {
    body.githubPat = els.githubPatInput.value.trim();
  }
  postAndRefresh("/api/config", body, "Configuration saved");
  els.apiKeyInput.value = "";
  els.githubPatInput.value = "";
});

refresh().catch((error) => {
  toast(error.message);
});
