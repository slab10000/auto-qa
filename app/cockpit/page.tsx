import Link from "next/link";
import { getMetrics } from "@/lib/cockpit";
import { getMainMemory, listPRReports } from "@/lib/memory";
import { Badge, PipelineRail, PIPELINE, Sparkline } from "@/app/_components/ui";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const m = await getMetrics();
  const reports = await listPRReports();
  const mem = await getMainMemory();

  const latest = reports[0];
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

      {/* LATEST REVIEW */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, margin: "30px 0 13px" }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--accent)",
            animation: "pulseI 1.8s infinite",
          }}
        />
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: ".12em",
            color: "var(--accent-ink)",
          }}
        >
          LATEST REVIEW
        </span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)" }}>
          — the most recent run, end to end
        </span>
      </div>

      {latest ? (
        <div
          style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: 16,
            padding: "18px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Badge verdict={latest.verdict} style={{ flex: "0 0 auto" }}>
              {(latest.verdict ?? "").toUpperCase()}
            </Badge>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--display)", fontWeight: 600, fontSize: 15.5 }}>
                #{latest.pr?.number} · {latest.pr?.title}
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--faint)",
                  marginTop: 2,
                }}
              >
                {latest.pr?.branch}
                {latest.scope_analysis?.classification
                  ? ` · ${latest.scope_analysis.classification}`
                  : ""}
              </div>
            </div>
            <Link
              href={`/pr/${latest.pr?.id}`}
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11,
                color: "var(--accent-2)",
                flex: "0 0 auto",
                textDecoration: "none",
              }}
            >
              open trace →
            </Link>
          </div>
          <div style={{ marginTop: 18 }}>
            <PipelineRail stages={PIPELINE} current={7} />
          </div>
        </div>
      ) : (
        <div className="empty">
          No reviews yet — trigger one from{" "}
          <Link href="/run" style={{ color: "var(--accent-2)" }}>
            Watch it think
          </Link>
          .
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
