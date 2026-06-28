import Link from "next/link";
import { getPRReport, getPRSkills, evidence } from "@/lib/memory";
import { buildRunView } from "@/lib/cockpit";
import { CockpitShell } from "@/app/_components/cockpit-shell";
import { PIPELINE, PipelineRail, Badge, Sev, ScreenShot, verdictClass } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

const backBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "none",
  border: "1px solid var(--line-frame)",
  color: "var(--muted-3)",
  fontFamily: "var(--sans)",
  fontSize: 13,
  fontWeight: 500,
  padding: "8px 14px",
  borderRadius: 9,
  textDecoration: "none",
} as const;

const railDotStyle = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontSize: 11,
  color: "var(--green-ink)",
  background: "rgba(52,211,153,.14)",
  border: "1px solid rgba(52,211,153,.4)",
  flex: "0 0 auto",
} as const;

const kindLabelStyle = {
  fontFamily: "var(--mono)",
  fontSize: 10,
  letterSpacing: ".08em",
  color: "var(--accent-ink)",
  background: "rgba(124,131,255,.1)",
  border: "1px solid rgba(124,131,255,.24)",
  padding: "3px 9px",
  borderRadius: 6,
} as const;

const thoughtStyle = {
  flex: 1,
  fontSize: 13.5,
  color: "var(--ink-2)",
  lineHeight: 1.55,
  background: "var(--panel)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "11px 13px",
} as const;

const insetStyle = {
  marginTop: 11,
  background: "var(--panel-2)",
  border: "1px solid var(--line)",
  borderRadius: 11,
  padding: 13,
} as const;

const scopeKeyStyle = {
  fontFamily: "var(--mono)",
  fontSize: 9.5,
  letterSpacing: ".08em",
} as const;

export default async function PRPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const report = await getPRReport(id);

  if (!report) {
    return (
      <CockpitShell repo="sample-app">
        <Link href="/cockpit/current" style={backBtnStyle}>
          <span>←</span> back
        </Link>
        <h2 style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, marginTop: 18 }}>
          PR not found
        </h2>
      </CockpitShell>
    );
  }

  const prSkills = await getPRSkills(id);
  const v = buildRunView(report, prSkills);

  return (
    <CockpitShell repo="sample-app">
      <Link href="/cockpit/current" style={backBtnStyle}>
        <span>←</span> Back to Current PRs
      </Link>

      {/* header card */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "20px 22px",
          marginTop: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          {v.live && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--accent)",
                animation: "pulseI 1.6s infinite",
                flex: "0 0 auto",
              }}
            />
          )}
          <Badge verdict={v.verdict}>{v.verdict}</Badge>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 18 }}>
              #{v.num} · {v.title}
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--faint)", marginTop: 2 }}>
              {v.branch} · {v.base} · {v.files.length} files
            </div>
          </div>
          {v.reviewMs != null && (
            <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--faint)" }}>
              reviewed in {v.reviewMs}ms
            </span>
          )}
        </div>
        <div style={{ marginTop: 20 }}>
          <PipelineRail stages={PIPELINE} current={v.current} live={v.live} />
        </div>
      </div>

      {/* two columns */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)",
          gap: 18,
          marginTop: 18,
          alignItems: "start",
        }}
      >
        {/* LEFT — trace */}
        <div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: ".12em",
              color: "var(--faint)",
              marginBottom: 15,
            }}
          >
            AGENT TRACE — STEP BY STEP
          </div>

          {v.trace.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: "0 0 auto",
                  paddingTop: 3,
                }}
              >
                <span style={railDotStyle}>✓</span>
                <span style={{ flex: 1, width: 2, background: "var(--line-soft)", marginTop: 6, minHeight: 14 }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={kindLabelStyle}>{e.kindLabel}</span>
                  {e.action && (
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted-2)" }}>
                      {e.action}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 9 }}>
                  <span style={{ color: "var(--accent-2)", flex: "0 0 auto", fontSize: 12, paddingTop: 9 }}>✦</span>
                  <div style={thoughtStyle}>{e.thought}</div>
                </div>

                {e.shot && (
                  <div style={{ marginTop: 11, maxWidth: 282 }}>
                    <ScreenShot src={e.shot.src} url={e.shot.url} height={152} />
                  </div>
                )}

                {/* route */}
                {e.kind === "route" && e.route && (
                  <div style={{ ...insetStyle, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    {e.route.cached ? (
                      <Badge variant="pass">⚡ cached</Badge>
                    ) : (
                      <Badge variant="accent">🔎 explored</Badge>
                    )}
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted-2)" }}>
                      {e.route.ms}ms · {e.route.llmCalls} model calls
                    </span>
                  </div>
                )}

                {/* contract */}
                {e.kind === "contract" && e.contract && (
                  <div style={insetStyle}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 11, alignItems: "center" }}>
                      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 11px" }}>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".06em", color: "var(--faint)" }}>BASELINE</div>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--green-ink)", marginTop: 5, wordBreak: "break-word" }}>
                          {e.contract.expected}
                        </div>
                      </div>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }}>vs</span>
                      <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 11px" }}>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".06em", color: "var(--faint)" }}>OBSERVED</div>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--ink-2)", marginTop: 5, wordBreak: "break-word" }}>
                          {e.contract.observed}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 11 }}>
                      {e.contract.match ? (
                        <Badge variant="pass">✓ match</Badge>
                      ) : (
                        <Badge variant="fail">✗ mismatch</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* compare */}
                {e.kind === "compare" && e.compare && (
                  <div
                    style={{
                      marginTop: 11,
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
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        color: "var(--accent-ink)",
                        background: "rgba(124,131,255,.1)",
                        border: "1px solid rgba(124,131,255,.24)",
                        padding: "3px 9px",
                        borderRadius: 6,
                        flex: "0 0 auto",
                      }}
                    >
                      {e.compare.screen}
                    </span>
                    <Sev changed={e.compare.changed} severity={e.compare.severity} />
                    <span style={{ fontSize: 12.5, color: "var(--muted-2)" }}>{e.compare.summary}</span>
                  </div>
                )}

                {/* scope */}
                {e.kind === "scope" && e.scope && (
                  <div style={insetStyle}>
                    {e.scope.inScope.length > 0 && (
                      <>
                        <div style={{ ...scopeKeyStyle, color: "var(--green)" }}>IN SCOPE</div>
                        <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--ink-2)", fontSize: 12.5, lineHeight: 1.6 }}>
                          {e.scope.inScope.map((x, j) => (
                            <li key={j}>{x}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {e.scope.outScope.length > 0 && (
                      <>
                        <div style={{ ...scopeKeyStyle, color: "var(--red)", marginTop: e.scope.inScope.length > 0 ? 13 : 0 }}>OUT OF SCOPE</div>
                        <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--ink-2)", fontSize: 12.5, lineHeight: 1.6 }}>
                          {e.scope.outScope.map((x, j) => (
                            <li key={j}>{x}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}

                {/* code */}
                {e.kind === "code" && e.code && (
                  <div style={insetStyle}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--muted-2)" }}>
                      scope: {e.code.scopeMatch} · risk: {e.code.risk}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55, marginTop: 9 }}>{e.code.summary}</div>
                    {e.code.concerns.length > 0 && (
                      <ul style={{ margin: "9px 0 0", paddingLeft: 18, color: "var(--red)", fontSize: 12.5, lineHeight: 1.6 }}>
                        {e.code.concerns.map((c, j) => (
                          <li key={j}>{c}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* skill */}
                {e.kind === "skill" && e.skill && (
                  <div
                    style={{
                      marginTop: 11,
                      background: "var(--panel-2)",
                      border: "1px solid rgba(124,131,255,.3)",
                      borderRadius: 11,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", borderBottom: "1px solid var(--line-soft)" }}>
                      <span style={{ color: "var(--accent-2)" }}>✦</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--accent-ink)" }}>{e.skill.name}</span>
                      <span style={{ flex: 1 }} />
                      <span
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 9,
                          letterSpacing: ".08em",
                          color: "var(--green)",
                          background: "rgba(52,211,153,.1)",
                          border: "1px solid rgba(52,211,153,.3)",
                          padding: "2px 7px",
                          borderRadius: 5,
                        }}
                      >
                        NEW SKILL
                      </span>
                    </div>
                    <pre className="skill">{e.skill.body}</pre>
                  </div>
                )}

                {/* verdict */}
                {e.kind === "verdict" && e.verdict && (
                  <div style={{ marginTop: 11 }}>
                    <Badge verdict={e.verdict}>{e.verdict}</Badge>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT — sticky */}
        <div style={{ position: "sticky", top: 88 }}>
          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "2px 4px 11px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 10, color: "var(--green)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", animation: "pulseG 2s infinite" }} />
                SANDBOX
              </span>
              <span style={{ flex: 1 }} />
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  color: "var(--faint)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {v.lastShot?.url ?? ""}
              </span>
            </div>
            <ScreenShot
              src={v.lastShot && v.lastShot.src}
              url={v.lastShot ? v.lastShot.url : undefined}
              height={224}
              chrome={false}
              scan={v.live}
            />
            <div style={{ marginTop: 13, padding: "0 3px" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: ".08em", color: "var(--faint)" }}>CURRENTLY</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5, marginTop: 6 }}>
                {v.trace[v.trace.length - 1]?.thought ?? ""}
              </div>
            </div>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 16, padding: "16px 18px", marginTop: 14 }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".12em", color: "var(--faint)" }}>ARTIFACTS PRODUCED</div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <StatTile value={v.artifacts.skills} label="SKILLS" accent />
              <StatTile value={v.artifacts.shots} label="SHOTS" />
              <StatTile value={v.artifacts.contracts} label="CONTRACTS" />
            </div>
            {v.skillsWritten.length > 0 && (
              <>
                <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: ".08em", color: "var(--faint)", marginTop: 16 }}>
                  NEW SKILLS THIS RUN
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 9 }}>
                  {v.skillsWritten.map((sk, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                        color: "var(--accent-ink)",
                        background: "rgba(124,131,255,.08)",
                        border: "1px solid rgba(124,131,255,.22)",
                        padding: "7px 11px",
                        borderRadius: 8,
                      }}
                    >
                      <span style={{ color: "var(--accent-2)" }}>✦</span>
                      {sk.name}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </CockpitShell>
  );
}

function StatTile({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 11, padding: "11px 8px", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 21, color: accent ? "var(--accent-2)" : "var(--ink)" }}>{value}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: ".06em", color: "var(--faint)", marginTop: 4 }}>{label}</div>
    </div>
  );
}
