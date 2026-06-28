"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Ev = any;
const vClass = (v: string) => (v === "FAIL" ? "fail" : v === "WARN" ? "warn" : v === "PASS" ? "pass" : "blocked");

export default function RunPage() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [running, setRunning] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const start = (cmd: string) => {
    esRef.current?.close();
    setEvents([]);
    setRunning(true);
    const es = new EventSource(`/api/run?cmd=${cmd}&pr=pr-1`);
    esRef.current = es;
    es.onmessage = (e) => {
      let ev: Ev;
      try { ev = JSON.parse(e.data); } catch { return; }
      if (ev.type === "log") return;
      setEvents((prev) => [...prev, ev]);
      if (ev.type === "exit" || ev.type === "error") {
        es.close();
        setRunning(false);
      }
    };
    es.onerror = () => { es.close(); setRunning(false); };
  };

  useEffect(() => () => esRef.current?.close(), []);

  const steps = events.filter((e) => e.type === "step");
  const last = steps[steps.length - 1];
  const phase = [...events].reverse().find((e) => e.type === "phase");
  const report = events.find((e) => e.type === "report");

  return (
    <main className="wrap">
      <h1>Watch it think</h1>
      <p className="lede">
        Trigger a run and watch the agent drive the app with Gemini Computer Use in real time — every
        action, its stated intent, and the exact screen it sees before deciding the next move.
      </p>

      <div className="controls">
        <button className="btn primary" disabled={running} onClick={() => start("review")}>▶ Review pr-1</button>
        <button className="btn" disabled={running} onClick={() => start("onboard")}>⟳ Onboard main</button>
        <button className="btn" disabled={running} onClick={() => start("merge")}>✓ Approve &amp; merge pr-1</button>
        <span className="phase-pill">
          {running ? (phase ? `● ${phase.message || phase.phase}` : "● starting…") : report ? `done · ${report.verdict}` : ""}
        </span>
        <div className="spacer" />
        {report && <Link className="btn" href="/pr/pr-1">open full report →</Link>}
      </div>

      <div className="live-grid">
        <div className="now">
          <div className="frame">
            {last ? (
              <img src={`/api/evidence/${last.shot}`} alt="current screen" />
            ) : (
              <div className="placeholder">waiting for first frame…</div>
            )}
          </div>
          <div className="cap">
            {last && (
              <>
                <div className="intent">{last.intent || last.action}</div>
                <div className="where">{last.url}</div>
              </>
            )}
          </div>
        </div>

        <div className="timeline">
          {events.map((e, i) => {
            if (e.type === "step")
              return (
                <div className={`tl ${e === last ? "active" : ""}`} key={i}>
                  <div className="act">{e.action}</div>
                  <div className="txt">{e.intent}</div>
                  <small>{e.url}</small>
                </div>
              );
            if (e.type === "contract")
              return (
                <div className="tl" key={i}>
                  <div className="act">contract replay</div>
                  <div className="tl-card">
                    expected <b>{e.expected.type}</b>
                    {e.expected.destination_url ? ` → ${e.expected.destination_url}` : ""} · observed{" "}
                    <b>{e.observed.type}</b>
                    <div style={{ marginTop: 6 }}>
                      <span className={`badge ${e.match ? "pass" : "fail"}`}>{e.match ? "✓ match" : "✗ mismatch"}</span>
                    </div>
                  </div>
                </div>
              );
            if (e.type === "comparison")
              return (
                <div className="tl" key={i}>
                  <div className="act">compare · {e.screen}</div>
                  <div className="tl-card">
                    {e.changed ? `changed (${e.severity})` : "no change"} — {e.summary}
                  </div>
                </div>
              );
            if (e.type === "scope")
              return (
                <div className="tl" key={i}>
                  <div className="act">scope analysis</div>
                  <div className="tl-card">
                    <span className={`badge ${vClass(e.verdict)}`}>{e.verdict}</span> {e.classification}
                    <div style={{ marginTop: 6, color: "var(--muted)" }}>{e.reasoning}</div>
                  </div>
                </div>
              );
            if (e.type === "route")
              return (
                <div className="tl" key={i}>
                  <div className="act">navigation route</div>
                  <div className="tl-card">
                    {e.cached ? (
                      <><span className="badge pass">⚡ cached</span> replayed in {e.ms}ms · <b>0 model calls</b></>
                    ) : (
                      <><span className="badge">🔎 explored</span> {e.llmCalls} model calls · {e.ms}ms — route saved for next time</>
                    )}
                  </div>
                </div>
              );
            if (e.type === "skill_learned")
              return (
                <div className="tl" key={i}>
                  <div className="act">learned skill</div>
                  <div className="txt">wrote <b>{e.name}</b> for {e.screen}</div>
                </div>
              );
            if (e.type === "merge_done")
              return (
                <div className="tl" key={i}>
                  <div className="act">merged into main</div>
                  <div className="tl-card">
                    {e.contract_updates?.length > 0 && (
                      <div>
                        contract updated: {e.contract_updates.map((c: any) => `${c.from} → ${c.to}`).join(", ")}
                      </div>
                    )}
                    <div>history snapshot: <code style={{ color: "var(--accent)" }}>{e.history_snapshot}</code></div>
                    {e.merged_skills?.length > 0 && <div>graduated skills: {e.merged_skills.join(", ")}</div>}
                  </div>
                </div>
              );
            if (e.type === "code_review")
              return (
                <div className="tl" key={i}>
                  <div className="act">code review · managed agent</div>
                  <div className="tl-card">
                    <span className="badge">{e.scope_match}</span> risk: {e.risk}
                    <div style={{ marginTop: 6, color: "var(--muted)" }}>{e.summary}</div>
                  </div>
                </div>
              );
            if (e.type === "phase" && e.phase !== "start")
              return (
                <div className="tl" key={i}>
                  <div className="act">{e.phase}</div>
                  <div className="txt" style={{ color: "var(--muted)" }}>{e.message}</div>
                </div>
              );
            return null;
          })}
        </div>
      </div>
    </main>
  );
}
