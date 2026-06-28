import Link from "next/link";
import { getMainMemory, getRoutes, evidence } from "@/lib/memory";
import { ScreenShot } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const mem = await getMainMemory();
  const routes = await getRoutes();

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
        Product memory
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
        What the agent learned by exploring{" "}
        <b style={{ color: "var(--ink-2)" }}>slab10000/test-app</b> like a new hire. This
        is the baseline every pull request is measured against.
      </p>

      {/* SCREENS LEARNED */}
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: ".12em",
          color: "var(--faint)",
          margin: "28px 0 12px",
        }}
      >
        SCREENS LEARNED · {mem.screens.length}
      </div>
      {mem.screens.length === 0 && (
        <div className="empty" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <span>No product memory yet — auto·qa hasn’t learned slab10000/test-app.</span>
          <Link href="/run?start=onboard" className="btn btn-primary">▶ Onboard slab10000/test-app</Link>
          <span style={{ fontSize: 11, color: "var(--faint)", fontFamily: "var(--mono)" }}>
            clones the repo, drives every page with Computer Use, and writes the baseline
          </span>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 14,
        }}
      >
        {mem.screens.map((s) => (
          <div
            key={s.id}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <ScreenShot
              src={evidence(s.screenshot)}
              url={"test-app" + s.url}
              height={150}
            />
            <div style={{ padding: "14px 15px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--display)",
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  {s.name}
                </span>
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--accent-2)",
                  }}
                >
                  {s.url}
                </span>
              </div>
              <p
                style={{
                  color: "var(--muted-2)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  margin: "8px 0 0",
                }}
              >
                {s.purpose}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* BEHAVIOR CONTRACTS */}
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: ".12em",
          color: "var(--faint)",
          margin: "30px 0 12px",
        }}
      >
        BEHAVIOR CONTRACTS · {mem.behaviors.length}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {mem.behaviors.map((b) => (
          <div
            key={b.id}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "16px 18px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--accent-ink)",
                  background: "rgba(124,131,255,.1)",
                  border: "1px solid rgba(124,131,255,.26)",
                  padding: "3px 9px",
                  borderRadius: 7,
                }}
              >
                {b.screen}
              </span>
              <span style={{ fontWeight: 600, fontSize: 14.5 }}>{b.action}</span>
              <span style={{ flex: 1 }} />
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--faint)",
                }}
              >
                confidence {Math.round(b.confidence * 100)}%
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 13,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--faint)",
                  flex: "0 0 auto",
                }}
              >
                EXPECTED
              </span>
              <span style={{ color: "#3a4358" }}>→</span>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 13,
                  color: "var(--green-ink)",
                  background: "rgba(52,211,153,.08)",
                  border: "1px solid rgba(52,211,153,.22)",
                  padding: "6px 11px",
                  borderRadius: 8,
                }}
              >
                {b.expected_result.type}
                {b.expected_result.destination_url
                  ? " → " + b.expected_result.destination_url
                  : ""}
              </span>
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--faint)",
                marginTop: 11,
              }}
            >
              visual anchor · {b.expected_result.visual_anchor}
            </div>
          </div>
        ))}
      </div>

      {/* LEARNED ROUTES */}
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: ".12em",
          color: "var(--faint)",
          margin: "30px 0 12px",
        }}
      >
        LEARNED ROUTES · replayed with 0 model calls
      </div>
      {routes.length === 0 ? (
        <div className="empty">No learned routes yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {routes.map((r, i) => {
            const sig = r.actions
              .map((a: any) => a.signature && a.signature.text)
              .filter(Boolean)
              .join(" → ");
            return (
              <div
                key={i}
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: "16px 18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>
                    {r.goal}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      color: "var(--accent-ink)",
                      background: "rgba(124,131,255,.1)",
                      border: "1px solid rgba(124,131,255,.26)",
                      padding: "3px 9px",
                      borderRadius: 7,
                    }}
                  >
                    expected → {r.expected_url}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      color: "var(--green-ink)",
                      background: "rgba(52,211,153,.08)",
                      border: "1px solid rgba(52,211,153,.22)",
                      padding: "3px 9px",
                      borderRadius: 7,
                    }}
                  >
                    0 model calls
                  </span>
                </div>
                {sig && (
                  <div
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 13,
                      color: "var(--ink-2)",
                      marginTop: 13,
                    }}
                  >
                    {sig}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 11,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {r.actions.map((a: any, j: number) => (
                    <div
                      key={j}
                      style={{
                        display: "flex",
                        gap: 9,
                        fontSize: 12.5,
                        color: "var(--muted-2)",
                        lineHeight: 1.45,
                      }}
                    >
                      <span style={{ color: "var(--accent-2)", flex: "0 0 auto" }}>
                        ·
                      </span>
                      {a.intent}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
