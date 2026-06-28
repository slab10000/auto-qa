import { Badge } from "@/app/_components/ui";
import { getMainMemory } from "@/lib/memory";
import { getMetrics, REPO_LABEL } from "@/lib/cockpit";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const mem = await getMainMemory();
  const m = await getMetrics();
  const onboarded = !!mem.learnedAt && mem.screens.length > 0;

  return (
    <div>
      <h2 className="display" style={{ fontWeight: 700, fontSize: 28, letterSpacing: "-.02em", margin: 0 }}>
        PR history
      </h2>
      <p style={{ color: "var(--muted-2)", fontSize: 15, lineHeight: 1.55, margin: "9px 0 0", maxWidth: "64ch" }}>
        Pull requests the agent reviewed and you merged. Each merge folded its accepted behavior into the baseline.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 24 }}>
        {onboarded ? (
          <>
            <div
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: "16px 18px",
                display: "flex",
                alignItems: "flex-start",
                gap: 15,
              }}
            >
              <span style={{ marginTop: 2, flex: "0 0 auto" }}>
                <Badge verdict="BASELINE">BASELINE</Badge>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>#0 · Initial onboarding</span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>{REPO_LABEL} · main</span>
                  <span
                    className="mono"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 10.5,
                      color: "var(--accent-2)",
                      background: "rgba(var(--accent-rgb),.1)",
                      border: "1px solid rgba(var(--accent-rgb),.24)",
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    ◷ explored once
                  </span>
                </div>
                <div style={{ fontSize: 13.5, color: "var(--muted-2)", marginTop: 7, lineHeight: 1.5 }}>
                  First run — {m.screens} screens, {m.contracts} contract(s), {m.skills} skill(s), {m.routes} cached
                  route(s) written to memory.
                </div>
              </div>
              <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                <div className="mono" style={{ fontSize: 10, color: "var(--faint)" }}>MERGED</div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>{mem.learnedAt}</div>
              </div>
            </div>

            <div className="empty">
              No PRs merged yet — reviewed PRs live under Current PRs until you approve &amp; merge them.
            </div>
          </>
        ) : (
          <div className="empty">
            Not onboarded yet. Run <code style={{ fontFamily: "var(--mono)" }}>npm run onboard</code> to learn
            {" "}
            {REPO_LABEL}; the baseline and merged-PR history appear here afterwards.
          </div>
        )}
      </div>
    </div>
  );
}
