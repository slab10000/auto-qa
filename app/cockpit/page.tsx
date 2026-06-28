import Link from "next/link";
import { getMetrics, getAnalyses } from "@/lib/cockpit";
import { getMainMemory } from "@/lib/memory";
import { Badge, Sev, Sparkline } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

function fmtTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

export default async function OverviewPage() {
  const m = await getMetrics();
  const mem = await getMainMemory();
  const analyses = await getAnalyses();

  const replaySpeed = m.routeMs != null ? `${m.routeMs}ms` : "—";
  const cachedMs = m.routeMs ?? 447;

  const kpiCard = (
    label: string,
    value: React.ReactNode,
    sub: React.ReactNode,
    opts?: { border?: string; valueColor?: string; subColor?: string }
  ) => (
    <div
      style={{
        background: "var(--panel)",
        border: `1px solid ${opts?.border ?? "var(--line)"}`,
        borderRadius: 15,
        padding: "18px 19px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          letterSpacing: ".1em",
          color: "var(--faint)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--display)",
          fontWeight: 700,
          fontSize: 38,
          lineHeight: 1,
          marginTop: 12,
          color: opts?.valueColor,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: opts?.subColor ?? "var(--muted-3)", marginTop: 10 }}>
        {sub}
      </div>
    </div>
  );

  return (
    <div>
      <h2
        style={{
          fontFamily: "var(--display)",
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: "-.02em",
          margin: 0,
        }}
      >
        Overview
      </h2>
      <p style={{ color: "var(--muted-2)", fontSize: 15, lineHeight: 1.55, margin: "9px 0 0" }}>
        How the system is learning <b style={{ color: "var(--ink-2)" }}>slab10000/test-app</b> and getting
        faster — live.
      </p>

      {/* KPI ROW */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 14,
          marginTop: 24,
        }}
      >
        {kpiCard(
          "REPLAY SPEED",
          replaySpeed,
          "0 model calls · cached route replay",
          { subColor: "var(--green)" }
        )}
        {kpiCard("SCREENS LEARNED", m.screens, "explored with Computer Use", {
          border: "rgba(124,131,255,.3)",
          valueColor: "var(--accent-2)",
        })}
        {kpiCard("CONTRACTS LEARNED", m.contracts, "behavior contracts in baseline")}
        {kpiCard("REGRESSIONS CAUGHT", m.regressionsCaught, "out-of-scope changes", {
          border: "rgba(248,113,113,.28)",
          valueColor: "var(--red)",
        })}
      </div>

      {/* ANALYSES */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, margin: "30px 0 13px" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulseI 1.8s infinite" }} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".12em", color: "var(--accent-ink)" }}>ANALYSES</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }}>
          — {analyses.length} review{analyses.length === 1 ? "" : "s"} · click any to expand
        </span>
      </div>

      {analyses.length === 0 ? (
        <div className="empty">
          No analyses yet — trigger a review from{" "}
          <Link href="/run?start=review" style={{ color: "var(--accent-2)" }}>Watch it think</Link>.
        </div>
      ) : (
        <div>
          {analyses.map((a, i) => (
            <details className="acc" key={a.key} open={i === 0}>
              <summary>
                <Badge verdict={a.verdict} style={{ flex: "0 0 auto" }}>{a.verdict}</Badge>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    #{a.prNumber} · {a.title}
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.repo}{a.branch ? ` · ${a.branch}` : ""}{a.classification ? ` · ${a.classification}` : ""}
                  </div>
                </div>
                {a.tookMs != null && (
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted-3)", flex: "0 0 auto" }}>◷ {fmtTime(a.tookMs)}</span>
                )}
                {a.source === "github" && (
                  <span className="badge accent" style={{ flex: "0 0 auto" }}>GitHub</span>
                )}
                <span className="chev">▸</span>
              </summary>

              <div className="acc-body">
                {a.description && (
                  <p style={{ color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.6, margin: "12px 0 0" }}>{a.description}</p>
                )}

                {a.comparisons.length > 0 && (
                  <div className="acc-sec">
                    <div className="k">Results · per-page visual diff</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {a.comparisons.map((c) => (
                        <div key={c.screen} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent-ink)", background: "rgba(124,131,255,.1)", border: "1px solid rgba(124,131,255,.24)", padding: "3px 9px", borderRadius: 6, flex: "0 0 auto" }}>{c.screen}</span>
                          <Sev changed={c.changed} severity={c.severity} />
                          <span style={{ fontSize: 12.5, color: "var(--muted-2)" }}>{c.summary || "no change"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(a.scopeIn.length > 0 || a.scopeOut.length > 0) && (
                  <div className="acc-sec" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16 }}>
                    {a.scopeIn.length > 0 && (
                      <div>
                        <div className="k" style={{ color: "var(--green)" }}>In scope</div>
                        <ul className="list in">{a.scopeIn.map((x, j) => <li key={j}>{x}</li>)}</ul>
                      </div>
                    )}
                    {a.scopeOut.length > 0 && (
                      <div>
                        <div className="k" style={{ color: "var(--red)" }}>What it caught · out of scope</div>
                        <ul className="list out">{a.scopeOut.map((x, j) => <li key={j}>{x}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}

                {a.changedFiles.length > 0 && (
                  <div className="acc-sec">
                    <div className="k">Changed files</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--muted-2)", display: "flex", flexDirection: "column", gap: 4 }}>
                      {a.changedFiles.map((f) => (
                        <div key={f}><span style={{ color: "var(--accent-2)" }}>M</span>&nbsp; {f}</div>
                      ))}
                    </div>
                  </div>
                )}

                {a.codeReview && (
                  <div className="acc-sec">
                    <div className="k">Code-side review · managed agent</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--muted-2)" }}>scope: {a.codeReview.scopeMatch} · risk: {a.codeReview.risk}</div>
                    {a.codeReview.summary && (
                      <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55, marginTop: 8 }}>{a.codeReview.summary}</div>
                    )}
                    {a.codeReview.concerns.length > 0 && (
                      <ul className="list out" style={{ marginTop: 4 }}>{a.codeReview.concerns.map((x, j) => <li key={j}>{x}</li>)}</ul>
                    )}
                  </div>
                )}

                {a.skills.length > 0 && (
                  <div className="acc-sec">
                    <div className="k">Skills written this run</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {a.skills.map((s) => (
                        <span key={s.name} style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent-ink)", background: "rgba(124,131,255,.08)", border: "1px solid rgba(124,131,255,.22)", padding: "5px 10px", borderRadius: 8 }}>✦ {s.name}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }}>
                    {a.tookMs != null
                      ? `analysed in ${fmtTime(a.tookMs)}`
                      : a.generatedAt
                        ? `reviewed ${a.generatedAt}`
                        : "reviewed via GitHub"}
                  </span>
                  <span style={{ flex: 1 }} />
                  {a.href && <Link href={a.href} className="btn btn-ghost">open trace →</Link>}
                  {a.githubUrl && (
                    <a href={a.githubUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">view on GitHub →</a>
                  )}
                </div>
              </div>
            </details>
          ))}
        </div>
      )}

      {/* BOTTOM GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.35fr 1fr",
          gap: 16,
          marginTop: 24,
          alignItems: "start",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* EXPLORE ONCE, REPLAY FROM CACHE */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 15,
              padding: 19,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  letterSpacing: ".12em",
                  color: "var(--faint)",
                }}
              >
                EXPLORE ONCE, REPLAY FROM CACHE
              </span>
              <span
                style={{
                  fontFamily: "var(--display)",
                  fontWeight: 700,
                  fontSize: 15,
                  color: "var(--green)",
                }}
              >
                {cachedMs}ms
              </span>
            </div>
            <div style={{ marginTop: 16 }}>
              <Sparkline series={[7300, cachedMs]} color="#34d399" invert />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--faint)" }}>
                ~7.3s · first pass (explored)
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--faint)" }}>
                {cachedMs}ms · cached replay
              </span>
            </div>
            <p style={{ fontSize: 13, color: "var(--muted-2)", lineHeight: 1.5, margin: "13px 0 0" }}>
              The first time the agent reaches a screen it explores with Computer Use and records the
              route; later passes verify the element signature and replay it with zero model calls.
            </p>
          </div>

          {/* PRODUCT MEMORY */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 15,
              padding: 19,
            }}
          >
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: ".12em",
                color: "var(--faint)",
              }}
            >
              PRODUCT MEMORY
            </span>
            <div
              style={{
                fontSize: 13.5,
                color: "var(--ink-2)",
                lineHeight: 1.5,
                marginTop: 10,
              }}
            >
              {m.screens} screens · {m.contracts} contracts · {m.skills} skills · {m.routes} cached
              routes
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--faint)",
                marginTop: 8,
              }}
            >
              learned {mem.learnedAt}
            </div>
          </div>
        </div>

        {/* GRADUATED TO MAIN */}
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 15,
            padding: 19,
          }}
        >
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: ".12em",
              color: "var(--faint)",
            }}
          >
            GRADUATED TO MAIN
          </span>
          <p style={{ fontSize: 12.5, color: "var(--faint)", lineHeight: 1.5, margin: "7px 0 0" }}>
            When you merge, accepted skills &amp; contracts fold into the baseline.
          </p>
          <div className="empty" style={{ marginTop: 14 }}>
            Nothing merged yet — accepted skills &amp; contracts fold into the baseline when you merge
            a PR.
          </div>
        </div>
      </div>
    </div>
  );
}
