import Link from "next/link";
import { listPRReports, listGhReviews, evidence } from "@/lib/memory";
import { Badge, ScreenShot } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

const verdictColor = (v: string): string =>
  ({
    FAIL: "var(--red)",
    WARN: "var(--amber)",
    PASS: "var(--green)",
    RUNNING: "var(--accent)",
    BASELINE: "var(--accent)",
  } as Record<string, string>)[(v || "").toUpperCase()] || "var(--ink)";

function ghFirstLine(comment: string): string {
  const line = (comment || "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#") && !l.startsWith(">") && !l.startsWith("-") && !l.startsWith("*"));
  return line || "Reviewed against the baseline.";
}

export default async function CurrentPage() {
  const reports = await listPRReports();
  const gh = await listGhReviews();

  const empty = reports.length === 0 && gh.length === 0;

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
        Current PRs
      </h2>
      <p
        style={{
          color: "var(--muted-2)",
          fontSize: 15,
          lineHeight: 1.55,
          margin: "9px 0 0",
          maxWidth: "64ch",
        }}
      >
        Open pull requests, each driven through your app in a sandbox browser and judged against the baseline.
      </p>

      {empty ? (
        <div className="empty" style={{ marginTop: 24 }}>
          No open pull requests right now. New PRs appear here as they are reviewed.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 24 }}>
          {reports.map((p) => {
            const bc = p.behavior_checks?.[0];
            const inScope: string[] = p.scope_analysis?.in_scope ?? [];
            const outScope: string[] = p.scope_analysis?.out_of_scope ?? [];
            const files: string[] = p.changed_files ?? [];
            return (
              <div
                key={p.pr?.id}
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                {/* header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "18px 20px",
                    borderBottom: "1px solid var(--line-soft)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--display)",
                      fontWeight: 700,
                      fontSize: 22,
                      letterSpacing: ".02em",
                      color: verdictColor(p.verdict),
                    }}
                  >
                    {p.verdict}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 17 }}>
                      #{p.pr?.number} · {p.pr?.title}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 11.5,
                        color: "var(--faint)",
                        marginTop: 3,
                      }}
                    >
                      {p.pr?.branch}
                      {p.scope_analysis?.classification ? ` · ${p.scope_analysis.classification}` : ""}
                    </div>
                  </div>
                  <Link
                    href={`/pr/${p.pr?.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      color: "var(--accent-ink)",
                      background: "rgba(var(--accent-rgb),.1)",
                      border: "1px solid rgba(var(--accent-rgb),.3)",
                      padding: "6px 11px",
                      borderRadius: 8,
                      textDecoration: "none",
                    }}
                  >
                    ▸ view trace
                  </Link>
                </div>

                {/* body */}
                <div style={{ padding: "18px 20px" }}>
                  <p style={{ color: "var(--ink-2)", fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>
                    {p.pr?.description}
                  </p>

                  {bc && (
                    <div
                      style={{
                        marginTop: 16,
                        background: "var(--panel-2)",
                        border: "1px solid var(--line)",
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10.5,
                          letterSpacing: ".1em",
                          color: "var(--faint)",
                        }}
                      >
                        BEHAVIOR CONTRACT REPLAY
                      </div>
                      <div style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 9 }}>{bc.action}</div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto 1fr",
                          gap: 12,
                          alignItems: "center",
                          marginTop: 13,
                        }}
                      >
                        <div
                          style={{
                            background: "var(--panel)",
                            border: "1px solid var(--line)",
                            borderRadius: 9,
                            padding: "11px 13px",
                          }}
                        >
                          <div
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 9.5,
                              letterSpacing: ".06em",
                              color: "var(--faint)",
                            }}
                          >
                            BASELINE EXPECTS
                          </div>
                          <div
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 12.5,
                              color: "var(--green-ink)",
                              marginTop: 6,
                              wordBreak: "break-word",
                            }}
                          >
                            {bc.expected?.type}
                            {bc.expected?.destination_url ? ` → ${bc.expected.destination_url}` : ""}
                          </div>
                        </div>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }}>vs</span>
                        <div
                          style={{
                            background: "var(--panel)",
                            border: "1px solid var(--line)",
                            borderRadius: 9,
                            padding: "11px 13px",
                          }}
                        >
                          <div
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 9.5,
                              letterSpacing: ".06em",
                              color: "var(--faint)",
                            }}
                          >
                            THIS PR OBSERVED
                          </div>
                          <div
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 12.5,
                              color: "var(--ink-2)",
                              marginTop: 6,
                              wordBreak: "break-word",
                            }}
                          >
                            {bc.observed?.type}
                            {bc.observed?.url_changed === false ? " · URL unchanged" : ""}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 13 }}>
                        <Badge verdict={bc.match ? "PASS" : "FAIL"}>
                          {bc.match ? "✓ matches baseline" : "✗ behavior mismatch"}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {(inScope.length > 0 || outScope.length > 0) && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 14,
                        marginTop: 14,
                      }}
                    >
                      {inScope.length > 0 && (
                        <div>
                          <div
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 10.5,
                              letterSpacing: ".08em",
                              color: "var(--green)",
                            }}
                          >
                            IN SCOPE
                          </div>
                          <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 7 }}>
                            {inScope.map((x, i) => (
                              <div
                                key={i}
                                style={{
                                  display: "flex",
                                  gap: 9,
                                  fontSize: 13,
                                  color: "var(--muted-2)",
                                  lineHeight: 1.45,
                                }}
                              >
                                <span style={{ color: "var(--green)", flex: "0 0 auto" }}>＋</span>
                                {x}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {outScope.length > 0 && (
                        <div>
                          <div
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 10.5,
                              letterSpacing: ".08em",
                              color: "var(--red)",
                            }}
                          >
                            OUT OF SCOPE
                          </div>
                          <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 7 }}>
                            {outScope.map((x, i) => (
                              <div
                                key={i}
                                style={{
                                  display: "flex",
                                  gap: 9,
                                  fontSize: 13,
                                  color: "#cbb0b0",
                                  lineHeight: 1.45,
                                }}
                              >
                                <span style={{ color: "var(--red)", flex: "0 0 auto" }}>!</span>
                                {x}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {files.length > 0 && (
                    <div style={{ marginTop: 15 }}>
                      <div
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 10.5,
                          letterSpacing: ".1em",
                          color: "var(--faint)",
                        }}
                      >
                        CHANGED FILES
                      </div>
                      <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 5 }}>
                        {files.map((f, i) => (
                          <div
                            key={i}
                            style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--muted-2)" }}
                          >
                            <span style={{ color: "var(--accent-2)" }}>M</span>
                            &nbsp;&nbsp;{f}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* GitHub reviews — simpler cards, no contract */}
          {gh.map((g) => {
            const num = g.pr.replace("pr-", "");
            return (
              <div
                key={`${g.repo}-${g.pr}`}
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "18px 20px",
                    borderBottom: "1px solid var(--line-soft)",
                  }}
                >
                  <Badge verdict={g.verdict}>{g.verdict}</Badge>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 17 }}>
                      {g.repo} · {g.pr}
                    </div>
                    <div style={{ marginTop: 5 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontFamily: "var(--mono)",
                          fontSize: 10.5,
                          letterSpacing: ".04em",
                          color: "var(--accent-ink)",
                          background: "rgba(var(--accent-rgb),.1)",
                          border: "1px solid rgba(var(--accent-rgb),.3)",
                          padding: "2px 9px",
                          borderRadius: 999,
                        }}
                      >
                        GitHub · posted comment
                      </span>
                    </div>
                  </div>
                  <a
                    href={`https://github.com/${g.repo}/pull/${num}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost"
                  >
                    view on GitHub →
                  </a>
                </div>

                <div style={{ padding: "18px 20px" }}>
                  <p style={{ color: "var(--ink-2)", fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>
                    {ghFirstLine(g.comment)}
                  </p>

                  {g.head.length > 0 && (
                    <div
                      style={{
                        marginTop: 16,
                        display: "grid",
                        gridTemplateColumns: `repeat(${Math.min(g.head.length, 3)}, 1fr)`,
                        gap: 12,
                      }}
                    >
                      {g.head.slice(0, 3).map((s) => (
                        <ScreenShot
                          key={s.rel}
                          src={evidence(s.rel)}
                          url={`github · ${s.screen}`}
                          height={150}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
