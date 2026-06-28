"use client";
import { useEffect, useRef, useState } from "react";

type Ev = any;
type Cmd = "review" | "onboard" | "merge";
const mono: React.CSSProperties = { fontFamily: "var(--mono)" };

// Embedded live "control room": watch Computer Use drive the app, the steps it takes, the skills
// it writes, and whether it's REPLAYING learned routes (cached) or LEARNING from scratch.
export function ControlRoom({
  metrics,
}: {
  metrics: { screens: number; contracts: number; skills: number; routes: number };
}) {
  const [events, setEvents] = useState<Ev[]>([]);
  const [running, setRunning] = useState(false);
  const [watch, setWatch] = useState<{ repo: string; watching: boolean; open?: number } | null>(null);
  const [detected, setDetected] = useState<{ pr: number; title: string } | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const runningRef = useRef(false);
  const startedRef = useRef(false);
  // Set while a *watcher-launched* review is in flight, so we can record the reviewed head SHA
  // (or release the claim) when the stream ends. null for manual Re-run.
  const triggerRef = useRef<{ pr: number; sha: string } | null>(null);

  // Tell the server we finished with a watcher-triggered PR: ok → mark this head SHA reviewed
  // (won't retrigger until the next push); !ok → release so it can be retried.
  const releaseTrigger = (ok: boolean) => {
    const t = triggerRef.current;
    if (!t) return;
    triggerRef.current = null;
    fetch("/api/github/poll", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ok ? { pr: t.pr, status: "done", sha: t.sha } : { pr: t.pr, status: "done" }),
    }).catch(() => {});
  };

  const start = (cmd: Cmd, opts?: { pr?: number; post?: boolean; trigger?: { pr: number; sha: string } }) => {
    if (runningRef.current) return false;
    runningRef.current = true;
    // Set atomically with the guard (no await between) so a concurrent start can't clobber it.
    triggerRef.current = opts?.trigger ?? null;
    esRef.current?.close();
    setEvents([]);
    setRunning(true);
    const prNum = opts?.pr ?? 1;
    const post = opts?.post ? "&post=1" : "";
    const es = new EventSource(`/api/run?cmd=${cmd}&pr=pr-${prNum}${post}`);
    esRef.current = es;
    let doneWatch: ReturnType<typeof setTimeout> | null = null;
    const stop = (ok: boolean) => {
      if (doneWatch) { clearTimeout(doneWatch); doneWatch = null; }
      es.close();
      runningRef.current = false;
      setRunning(false);
      releaseTrigger(ok);
    };
    es.onmessage = (e) => {
      let ev: Ev;
      try { ev = JSON.parse(e.data); } catch { return; }
      if (ev.type === "log") return;
      setEvents((prev) => [...prev, ev]);
      if (ev.type === "done") stop(true);
      else if (ev.type === "error") stop(false);
      else if (ev.type === "exit") stop(ev.code === 0);
      else if (ev.type === "report" && ev.verdict && !doneWatch) {
        // The verdict is in and report.json is written — the run is essentially complete.
        // Guarantee the UI recovers even if the trailing done/exit event is lost on a flaky
        // connection (the SSE heartbeat should keep it alive, but never hang on it).
        doneWatch = setTimeout(() => stop(true), 20000);
      }
    };
    es.onerror = () => stop(false);
    return true;
  };
  useEffect(() => () => esRef.current?.close(), []);

  // PR watcher: ask the server if an open PR has a commit we haven't reviewed; if so, claim it
  // and launch a live, posting review. Safe to call on every tick — the server dedups by SHA.
  const poll = async () => {
    if (runningRef.current) return;
    try {
      const r = await fetch("/api/github/poll", { cache: "no-store" });
      const data = await r.json();
      setWatch({ repo: data.repo, watching: !!data.watching, open: data.openCount });
      const cand = data.candidates?.[0];
      if (!cand || runningRef.current) return;
      // Commit to the run first (sets runningRef + triggerRef atomically); only then announce +
      // claim. If start() bailed (a manual run beat us to it), don't touch state or claim.
      const began = start("review", { pr: cand.number, post: true, trigger: { pr: cand.number, sha: cand.headSha } });
      if (!began) return;
      setDetected({ pr: cand.number, title: cand.title });
      // claim server-side so a reload (or another tab) mid-run won't re-launch the same PR
      fetch("/api/github/poll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pr: cand.number, status: "running" }),
      }).catch(() => {});
    } catch {
      /* offline / transient — next tick retries */
    }
  };
  // keep the interval/focus listeners pointed at the latest closure without re-subscribing
  const pollRef = useRef(poll);
  pollRef.current = poll;
  useEffect(() => {
    const tick = () => pollRef.current();
    tick(); // instant on mount — covers "I just opened the cockpit tab"
    const id = setInterval(tick, 20000);
    const onFocus = () => tick(); // instant the moment the tab regains focus
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Auto-start from /cockpit?start=onboard|review|merge (deep links) and listen for in-page
  // triggers (the header Onboard button, the ON MERGE "Approve & merge" action).
  useEffect(() => {
    if (!startedRef.current) {
      const s = new URLSearchParams(window.location.search).get("start");
      if (s === "review" || s === "onboard" || s === "merge") {
        startedRef.current = true;
        window.history.replaceState({}, "", "/cockpit");
        start(s);
      }
    }
    const onRun = (e: Event) => {
      const cmd = (e as CustomEvent).detail as Cmd;
      if (cmd === "review" || cmd === "onboard" || cmd === "merge") start(cmd);
    };
    window.addEventListener("autoqa-run", onRun);
    return () => window.removeEventListener("autoqa-run", onRun);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps = events.filter((e) => e.type === "step");
  const framed = [...steps].reverse().find((s) => s.shot);
  const last = steps[steps.length - 1];
  const routes = events.filter((e) => e.type === "route");
  const lastRoute = routes[routes.length - 1];
  const skillsLearned = events.filter((e) => e.type === "skill_learned");
  const phase = [...events].reverse().find((e) => e.type === "phase");
  const report = events.find((e) => e.type === "report" && e.verdict);
  const codeReview = [...events].reverse().find((e) => e.type === "code_review");

  // Using learned routes (cached) vs learning from scratch (Computer Use)?
  const cachedNow = lastRoute ? !!lastRoute.cached : !!last?.cached;
  const cachedCount = routes.filter((r) => r.cached).length;
  const exploredCount = routes.filter((r) => !r.cached).length;
  const mode = !routes.length && !running
    ? null
    : cachedNow
      ? { label: "⚡ Using learned routes", sub: "replaying cached navigation · 0 model calls", color: "var(--green)", rgb: "52,211,153" }
      : { label: "🔎 Learning from scratch", sub: "exploring with Gemini Computer Use", color: "var(--accent)", rgb: "124,131,255" };

  const status = running
    ? phase?.message || phase?.phase || "starting…"
    : report
      ? `done · ${report.verdict}`
      : "idle";

  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(124,131,255,.05), transparent 60%), var(--panel)",
        border: "1px solid var(--line-frame)",
        borderRadius: 16,
        padding: 18,
        marginTop: 24,
      }}
    >
      {/* header + controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: running ? "var(--accent)" : "var(--faint)", animation: running ? "pulseI 1.6s infinite" : "none" }} />
          <span style={{ ...mono, fontSize: 11, letterSpacing: ".12em", color: "var(--accent-ink)" }}>LIVE CONTROL ROOM</span>
        </span>
        <span style={{ ...mono, fontSize: 11, color: "var(--faint)" }}>— Computer Use, live</span>
        <span style={{ flex: 1 }} />
        {watch && (
          <span
            title={watch.watching ? `Polling ${watch.repo} every 20s · instantly when you focus this tab` : "Couldn't reach GitHub (is `gh` authed?)"}
            style={{ ...mono, fontSize: 11, color: watch.watching ? "var(--green)" : "var(--faint)", padding: "5px 11px", border: `1px solid ${watch.watching ? "rgba(52,211,153,.3)" : "var(--line)"}`, borderRadius: 999, background: watch.watching ? "rgba(52,211,153,.06)" : "transparent", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: watch.watching ? "var(--green)" : "var(--faint)", animation: watch.watching ? "pulseI 2.4s infinite" : "none" }} />
            {watch.watching ? `watching ${watch.repo}` : "watcher offline"}
          </span>
        )}
        <span style={{ ...mono, fontSize: 11.5, color: running ? "var(--accent-ink)" : "var(--muted-3)", padding: "5px 11px", border: `1px solid ${running ? "rgba(124,131,255,.3)" : "var(--line)"}`, borderRadius: 999, background: running ? "rgba(124,131,255,.06)" : "transparent" }}>
          {status}
        </span>
        <button className="btn btn-primary" disabled={running} onClick={() => start("review")} style={{ padding: "8px 14px" }}>▶ Re-run review</button>
        <button className="btn" disabled={running} onClick={() => start("onboard")} style={{ padding: "8px 14px" }}>⟳ Re-onboard</button>
      </div>

      {/* PR watcher caught a new commit */}
      {detected && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 14, padding: "9px 13px", borderRadius: 11, background: "rgba(124,131,255,.09)", border: "1px solid rgba(124,131,255,.34)" }}>
          <span style={{ ...mono, fontWeight: 600, fontSize: 12, color: "var(--accent-ink)" }}>
            {running ? `🔔 New commit on PR #${detected.pr} — reviewing live` : `✓ Reviewed PR #${detected.pr}`}
          </span>
          <span style={{ fontSize: 12.5, color: "var(--muted-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 360 }}>{detected.title}</span>
        </div>
      )}

      {/* mode badge: using skills vs learning */}
      {mode && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 14, padding: "9px 13px", borderRadius: 11, background: `rgba(${mode.rgb},.09)`, border: `1px solid rgba(${mode.rgb},.34)` }}>
          <span style={{ ...mono, fontWeight: 600, fontSize: 12, color: mode.color }}>{mode.label}</span>
          <span style={{ fontSize: 12.5, color: "var(--muted-2)" }}>{mode.sub}</span>
          {routes.length > 0 && (
            <span style={{ ...mono, fontSize: 11, color: "var(--faint)" }}>· {cachedCount} cached / {exploredCount} explored</span>
          )}
        </div>
      )}

      {/* live grid */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr)", gap: 16, marginTop: 14, alignItems: "start" }}>
        {/* sandbox */}
        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line-frame)", background: "var(--panel-2)", minHeight: 210, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 11px", borderBottom: "1px solid var(--line-frame)", background: "#0c0e14" }}>
            <span style={{ ...mono, fontSize: 9.5, letterSpacing: ".06em", color: "var(--green)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", opacity: running ? 1 : 0.4 }} />
              SANDBOX · CHROMIUM
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ ...mono, fontSize: 9.5, color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{last?.url || ""}</span>
          </div>
          <div style={{ position: "relative", flex: 1, minHeight: 170, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {framed ? (
              <img src={`/api/evidence/${framed.shot}`} alt="current screen" style={{ width: "100%", display: "block" }} />
            ) : (
              <div style={{ ...mono, fontSize: 12, color: "var(--faint)", padding: "60px 20px", textAlign: "center" }}>
                {running ? "waiting for first frame…" : "Re-run the review to watch Computer Use drive the app."}
              </div>
            )}
            {running && framed && <div className="scanline" />}
          </div>
          {last && (
            <div style={{ padding: "10px 12px", borderTop: "1px solid var(--line-frame)" }}>
              <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.45 }}>{last.intent || last.action}</div>
            </div>
          )}
        </div>

        {/* learning feed */}
        <div>
          <div style={{ ...mono, fontSize: 10, letterSpacing: ".1em", color: "var(--faint)", marginBottom: 10 }}>WHAT IT'S LEARNING</div>

          {/* live tally (falls back to current memory when idle) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {[
              { v: metrics.screens, l: "SCREENS" },
              { v: skillsLearned.length || metrics.skills, l: "SKILLS", accent: skillsLearned.length > 0 },
              { v: metrics.contracts, l: "CONTRACTS" },
              { v: (running ? routes.length : 0) || metrics.routes, l: "ROUTES" },
            ].map((t) => (
              <div key={t.l} style={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "9px 6px", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 18, color: t.accent ? "var(--accent-2)" : "var(--ink)" }}>{t.v}</div>
                <div style={{ ...mono, fontSize: 8, letterSpacing: ".06em", color: "var(--faint)", marginTop: 3 }}>{t.l}</div>
              </div>
            ))}
          </div>

          {/* skills created this run */}
          {skillsLearned.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ ...mono, fontSize: 9.5, letterSpacing: ".08em", color: "var(--faint)", marginBottom: 7 }}>SKILLS WRITTEN</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {skillsLearned.map((s, i) => (
                  <span key={i} style={{ ...mono, fontSize: 11.5, color: "var(--accent-ink)", background: "rgba(124,131,255,.08)", border: "1px solid rgba(124,131,255,.22)", padding: "4px 9px", borderRadius: 7 }}>✦ {s.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* recent steps */}
          {steps.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ ...mono, fontSize: 9.5, letterSpacing: ".08em", color: "var(--faint)", marginBottom: 7 }}>RECENT STEPS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 150, overflowY: "auto" }}>
                {steps.slice(-6).reverse().map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ ...mono, fontSize: 10, color: s.cached ? "var(--green)" : "var(--accent-2)", flex: "0 0 auto" }}>{s.cached ? "⚡" : "▸"}</span>
                    <span style={{ color: "var(--muted-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.intent || s.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {codeReview?.reused_session && (
            <div style={{ marginTop: 12, ...mono, fontSize: 11, color: "var(--green)", display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.28)", padding: "5px 10px", borderRadius: 8 }}>
              ♻ reused managed-agent session
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
