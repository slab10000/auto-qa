"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Sev } from "@/app/_components/ui";
import { CockpitShell } from "@/app/_components/cockpit-shell";

type Ev = any;
const vClass = (v: string): "fail" | "warn" | "pass" =>
  v === "FAIL" ? "fail" : v === "WARN" ? "warn" : "pass";

const mono: React.CSSProperties = { fontFamily: "var(--mono)" };

const kindLabel: React.CSSProperties = {
  ...mono,
  fontSize: 10,
  letterSpacing: ".08em",
  color: "var(--muted-2)",
  background: "var(--panel-2)",
  border: "1px solid var(--line)",
  padding: "3px 9px",
  borderRadius: 6,
  textTransform: "uppercase",
};

function RailItem({
  glyph,
  glyphColor,
  last,
  children,
}: {
  glyph: string;
  glyphColor: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flex: "0 0 auto",
          paddingTop: 3,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            color: glyphColor,
            background: "var(--panel)",
            border: `1px solid ${glyphColor === "var(--faint)" ? "var(--line)" : glyphColor}`,
          }}
        >
          {glyph}
        </span>
        {!last && (
          <span
            style={{
              flex: 1,
              width: 2,
              background: "var(--line-soft)",
              marginTop: 6,
              minHeight: 14,
            }}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 20 }}>{children}</div>
    </div>
  );
}

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
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }
      if (ev.type === "log") return;
      setEvents((prev) => [...prev, ev]);
      if (ev.type === "exit" || ev.type === "error") {
        es.close();
        setRunning(false);
      }
    };
    es.onerror = () => {
      es.close();
      setRunning(false);
    };
  };

  useEffect(() => () => esRef.current?.close(), []);

  const steps = events.filter((e) => e.type === "step");
  const last = steps[steps.length - 1];
  const phase = [...events].reverse().find((e) => e.type === "phase");
  const report = events.find((e) => e.type === "report");
  const traceEvents = events.filter((e) => e.type !== "log" && e.type !== "exit");

  return (
    <CockpitShell repo="sample-app">
      <h2 style={{ fontFamily: "var(--display)", fontSize: 27, fontWeight: 700, margin: 0 }}>
        Watch it think
      </h2>
      <p
        style={{
          color: "var(--muted-2)",
          fontSize: 15,
          lineHeight: 1.55,
          margin: "9px 0 0",
          maxWidth: 760,
        }}
      >
        Trigger a run and watch the agent drive the app with Gemini 3.5 Computer Use in real time —
        every action, its stated intent, and the exact screen it sees before deciding the next move.
      </p>

      {/* controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 11,
          flexWrap: "wrap",
          margin: "20px 0 6px",
        }}
      >
        <button className="btn btn-primary" disabled={running} onClick={() => start("review")}>
          ▶ Review pr-1
        </button>
        <button className="btn" disabled={running} onClick={() => start("onboard")}>
          ⟳ Onboard main
        </button>
        <button className="btn" disabled={running} onClick={() => start("merge")}>
          ✓ Approve &amp; merge pr-1
        </button>
        <span
          style={{
            ...mono,
            fontSize: 11.5,
            color: running ? "var(--accent-ink)" : "var(--muted-3)",
            padding: "6px 12px",
            border: `1px solid ${running ? "rgba(124,131,255,.3)" : "var(--line)"}`,
            borderRadius: 999,
            background: running ? "rgba(124,131,255,.06)" : "transparent",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          {running && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--accent)",
                animation: "pulseI 1.6s infinite",
              }}
            />
          )}
          {running
            ? phase?.message || phase?.phase || "starting…"
            : report
              ? `done · ${report.verdict}`
              : "idle"}
        </span>
        <div style={{ flex: 1 }} />
        {report && (
          <Link className="btn" href="/pr/pr-1">
            open full report →
          </Link>
        )}
      </div>

      {/* live grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)",
          gap: 18,
          marginTop: 18,
          alignItems: "start",
        }}
      >
        {/* LEFT — sandbox */}
        <div style={{ position: "sticky", top: 88 }}>
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              padding: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "2px 4px 11px",
              }}
            >
              <span
                style={{
                  ...mono,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 10,
                  letterSpacing: ".06em",
                  color: "var(--green)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--green)",
                    animation: running ? "pulseG 2s infinite" : "none",
                    opacity: running ? 1 : 0.5,
                  }}
                />
                SANDBOX · CHROMIUM 1280×800
              </span>
              <span style={{ flex: 1 }} />
              <span
                style={{
                  ...mono,
                  fontSize: 10,
                  color: "var(--faint)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 180,
                }}
              >
                {last?.url || ""}
              </span>
            </div>

            <div
              style={{
                position: "relative",
                borderRadius: 11,
                overflow: "hidden",
                border: "1px solid var(--line-frame)",
                background: "var(--panel-2)",
                minHeight: 224,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {last ? (
                <img
                  src={`/api/evidence/${last.shot}`}
                  alt="current screen"
                  style={{ width: "100%", display: "block" }}
                />
              ) : (
                <div
                  style={{
                    ...mono,
                    fontSize: 12,
                    color: "var(--faint)",
                    padding: "80px 20px",
                  }}
                >
                  waiting for first frame…
                </div>
              )}
              {running && last && <div className="scanline" />}
            </div>

            <div style={{ marginTop: 13, padding: "0 3px" }}>
              <div
                style={{
                  ...mono,
                  fontSize: 9.5,
                  letterSpacing: ".08em",
                  color: "var(--faint)",
                }}
              >
                CURRENTLY
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  color: "var(--ink-2)",
                  lineHeight: 1.5,
                  marginTop: 6,
                }}
              >
                {last ? last.intent || last.action : "Idle — trigger a run to begin."}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — timeline */}
        <div>
          <div
            style={{
              ...mono,
              fontSize: 11,
              letterSpacing: ".12em",
              color: "var(--faint)",
              marginBottom: 15,
            }}
          >
            AGENT TRACE — STEP BY STEP
          </div>

          {traceEvents.length === 0 && (
            <div className="empty">No activity yet. Trigger a run above to watch the agent work.</div>
          )}

          {traceEvents.map((e, i) => {
            const isLast = i === traceEvents.length - 1;

            if (e.type === "step")
              return (
                <RailItem
                  key={i}
                  last={isLast}
                  glyph="▸"
                  glyphColor={e === last && running ? "var(--accent)" : "var(--faint)"}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      marginBottom: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={kindLabel}>action</span>
                    <span style={{ ...mono, fontSize: 12, color: "var(--muted-2)" }}>{e.action}</span>
                  </div>
                  <div style={{ display: "flex", gap: 9 }}>
                    <span style={{ color: "var(--accent-2)", flex: "0 0 auto", fontSize: 12, paddingTop: 1 }}>
                      ✦
                    </span>
                    <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
                      {e.intent}
                    </div>
                  </div>
                  <div style={{ ...mono, fontSize: 10.5, color: "var(--faint)", marginTop: 6, paddingLeft: 21 }}>
                    {e.url}
                  </div>
                </RailItem>
              );

            if (e.type === "contract")
              return (
                <RailItem key={i} last={isLast} glyph="◎" glyphColor="var(--accent-2)">
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                    <span style={kindLabel}>contract replay</span>
                  </div>
                  <div
                    style={{
                      background: "var(--panel-2)",
                      border: "1px solid var(--line)",
                      borderRadius: 11,
                      padding: 13,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        gap: 11,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          background: "var(--panel)",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          padding: "9px 11px",
                        }}
                      >
                        <div style={{ ...mono, fontSize: 9, letterSpacing: ".06em", color: "var(--faint)" }}>
                          BASELINE
                        </div>
                        <div style={{ ...mono, fontSize: 12, color: "var(--green-ink)", marginTop: 5, wordBreak: "break-word" }}>
                          {e.expected?.type}
                          {e.expected?.destination_url ? ` → ${e.expected.destination_url}` : ""}
                        </div>
                      </div>
                      <span style={{ ...mono, fontSize: 11, color: "var(--faint)" }}>vs</span>
                      <div
                        style={{
                          background: "var(--panel)",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          padding: "9px 11px",
                        }}
                      >
                        <div style={{ ...mono, fontSize: 9, letterSpacing: ".06em", color: "var(--faint)" }}>
                          OBSERVED
                        </div>
                        <div style={{ ...mono, fontSize: 12, color: "var(--ink-2)", marginTop: 5, wordBreak: "break-word" }}>
                          {e.observed?.type}
                          {e.observed?.destination_url ? ` → ${e.observed.destination_url}` : ""}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 11 }}>
                      <Badge variant={e.match ? "pass" : "fail"} dot>
                        {e.match ? "match" : "mismatch"}
                      </Badge>
                    </div>
                  </div>
                </RailItem>
              );

            if (e.type === "comparison")
              return (
                <RailItem key={i} last={isLast} glyph="❑" glyphColor="var(--accent-2)">
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                    <span style={kindLabel}>visual compare</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                      background: "var(--panel-2)",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      padding: "11px 13px",
                    }}
                  >
                    <span
                      style={{
                        ...mono,
                        fontSize: 11,
                        color: "var(--accent-ink)",
                        background: "rgba(124,131,255,.1)",
                        border: "1px solid rgba(124,131,255,.24)",
                        padding: "3px 9px",
                        borderRadius: 6,
                        flex: "0 0 auto",
                      }}
                    >
                      {e.screen}
                    </span>
                    <Sev changed={e.changed} severity={e.severity} />
                    <span style={{ fontSize: 12.5, color: "var(--muted-2)" }}>{e.summary}</span>
                  </div>
                </RailItem>
              );

            if (e.type === "scope")
              return (
                <RailItem key={i} last={isLast} glyph="⊕" glyphColor="var(--accent-2)">
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={kindLabel}>scope analysis</span>
                    <Badge verdict={e.verdict} dot>
                      {e.verdict}
                    </Badge>
                    <span style={{ ...mono, fontSize: 12, color: "var(--muted-2)" }}>{e.classification}</span>
                  </div>
                  <div style={{ display: "flex", gap: 9 }}>
                    <span style={{ color: "var(--accent-2)", flex: "0 0 auto", fontSize: 12, paddingTop: 1 }}>
                      ✦
                    </span>
                    <div style={{ fontSize: 13, color: "var(--muted-2)", lineHeight: 1.5 }}>
                      {e.reasoning}
                    </div>
                  </div>
                </RailItem>
              );

            if (e.type === "route")
              return (
                <RailItem key={i} last={isLast} glyph="⚡" glyphColor="var(--accent-2)">
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                    <span style={kindLabel}>learned route</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                      background: "var(--panel-2)",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      padding: "11px 13px",
                      fontSize: 12.5,
                      color: "var(--muted-2)",
                    }}
                  >
                    {e.cached ? (
                      <>
                        <Badge variant="pass" dot>
                          cached replay
                        </Badge>
                        <span>
                          replayed in {e.ms}ms · <b style={{ color: "var(--ink-2)" }}>0 model calls</b>
                        </span>
                      </>
                    ) : (
                      <>
                        <Badge variant="accent" dot>
                          explored
                        </Badge>
                        <span>
                          {e.llmCalls} model calls · {e.ms}ms — route cached for next time
                        </span>
                      </>
                    )}
                  </div>
                </RailItem>
              );

            if (e.type === "skill_learned")
              return (
                <RailItem key={i} last={isLast} glyph="✦" glyphColor="var(--accent-2)">
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                    <span style={kindLabel}>learned skill</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      padding: "11px 14px",
                      background: "var(--panel-2)",
                      border: "1px solid rgba(124,131,255,.3)",
                      borderRadius: 11,
                    }}
                  >
                    <span style={{ color: "var(--accent-2)" }}>✦</span>
                    <span style={{ ...mono, fontSize: 12.5, color: "var(--accent-ink)" }}>{e.name}</span>
                    <span style={{ flex: 1 }} />
                    <span
                      style={{
                        ...mono,
                        fontSize: 9,
                        letterSpacing: ".08em",
                        color: "var(--green)",
                        background: "rgba(52,211,153,.1)",
                        border: "1px solid rgba(52,211,153,.3)",
                        padding: "2px 7px",
                        borderRadius: 5,
                      }}
                    >
                      NEW · {e.screen}
                    </span>
                  </div>
                </RailItem>
              );

            if (e.type === "code_review")
              return (
                <RailItem key={i} last={isLast} glyph="⌥" glyphColor="var(--accent-2)">
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={kindLabel}>code review · managed agent</span>
                    <Badge variant={e.scope_match ? "pass" : "warn"} dot>
                      {e.scope_match ? "in scope" : "scope drift"}
                    </Badge>
                    <span style={{ ...mono, fontSize: 12, color: "var(--muted-2)" }}>risk: {e.risk}</span>
                  </div>
                  <div style={{ display: "flex", gap: 9 }}>
                    <span style={{ color: "var(--accent-2)", flex: "0 0 auto", fontSize: 12, paddingTop: 1 }}>
                      ✦
                    </span>
                    <div style={{ fontSize: 13, color: "var(--muted-2)", lineHeight: 1.5 }}>{e.summary}</div>
                  </div>
                </RailItem>
              );

            if (e.type === "merge_done")
              return (
                <RailItem key={i} last={isLast} glyph="⇲" glyphColor="var(--green)">
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                    <span style={kindLabel}>merged into main</span>
                  </div>
                  <div
                    style={{
                      background: "var(--panel-2)",
                      border: "1px solid var(--line)",
                      borderRadius: 11,
                      padding: 13,
                      fontSize: 12.5,
                      color: "var(--muted-2)",
                      lineHeight: 1.7,
                    }}
                  >
                    {e.contract_updates?.length > 0 && (
                      <div>
                        contract updated:{" "}
                        {e.contract_updates.map((c: any) => `${c.from} → ${c.to}`).join(", ")}
                      </div>
                    )}
                    <div>
                      history snapshot:{" "}
                      <code style={{ ...mono, color: "var(--accent-ink)" }}>{e.history_snapshot}</code>
                    </div>
                    {e.merged_skills?.length > 0 && (
                      <div>graduated skills: {e.merged_skills.join(", ")}</div>
                    )}
                  </div>
                </RailItem>
              );

            if (e.type === "report")
              return (
                <RailItem key={i} last={isLast} glyph="✓" glyphColor={vClass(e.verdict) === "fail" ? "var(--red)" : "var(--green)"}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <span style={kindLabel}>verdict</span>
                    <Badge verdict={e.verdict} dot>
                      {e.verdict}
                    </Badge>
                  </div>
                </RailItem>
              );

            if (e.type === "phase" && e.phase !== "start")
              return (
                <RailItem key={i} last={isLast} glyph="·" glyphColor="var(--faint)">
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                    <span style={kindLabel}>{e.phase}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--muted-3)", lineHeight: 1.5 }}>{e.message}</div>
                </RailItem>
              );

            if (e.type === "error")
              return (
                <RailItem key={i} last={isLast} glyph="!" glyphColor="var(--red)">
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
                    <span style={kindLabel}>error</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--red)", lineHeight: 1.5 }}>
                    {e.message || "Run failed."}
                  </div>
                </RailItem>
              );

            return null;
          })}
        </div>
      </div>
    </CockpitShell>
  );
}
