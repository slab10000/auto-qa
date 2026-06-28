"use client";
import Link from "next/link";
import type { ReactNode } from "react";

// The cockpit shell, restyled to the Claude Design "v2" — a full-width teal header
// (no sidebar) over a scrolling content area. The whole subtree is wrapped in
// `.cockpit-theme`, which swaps the design tokens to the teal palette.
export function CockpitFrame({ repo, children }: { repo: string; children: ReactNode }) {
  // Onboard / Run review drive the live control room on the Overview tab. When we're already
  // on /cockpit, switch to Overview and fire the run in-page; otherwise deep-link there.
  const run = (cmd: "onboard" | "review") => {
    if (window.location.pathname === "/cockpit") {
      window.dispatchEvent(new CustomEvent("autoqa-tab", { detail: "overview" }));
      window.dispatchEvent(new CustomEvent("autoqa-run", { detail: cmd }));
    } else {
      window.location.href = `/cockpit?start=${cmd}`;
    }
  };

  return (
    <div
      className="cockpit-theme"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "radial-gradient(1100px 700px at 78% -10%, rgba(var(--accent-rgb),.06), transparent 60%), var(--bg)",
        color: "var(--ink)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          gap: 16,
          height: 64,
          padding: "0 22px",
          borderBottom: "1px solid var(--line)",
          background: "linear-gradient(180deg, rgba(255,255,255,.02), transparent)",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: "linear-gradient(150deg, #2a3138, #0c0f13)",
              border: "1px solid var(--line-frame)",
              display: "grid",
              placeItems: "center",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)",
            }}
          >
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 12px var(--accent)" }} />
          </span>
          <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 18, letterSpacing: "-.02em" }}>
            auto<span style={{ color: "var(--accent)" }}>·</span>qa
          </span>
        </Link>

        <span style={{ width: 1, height: 24, background: "var(--line)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 14 }}>
          <GitGlyph />
          <span style={{ fontWeight: 600 }}>{repo}</span>
          <span style={{ color: "var(--faint)" }}>/</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--accent)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
            main
          </span>
        </div>

        <span style={{ flex: 1 }} />

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 12px",
            borderRadius: 9,
            border: "1px solid var(--line-frame)",
            background: "var(--panel)",
            fontFamily: "var(--mono)",
            fontSize: 11,
            letterSpacing: ".05em",
            color: "var(--muted)",
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", animation: "pulseI 2.4s infinite" }} />
          CONTROL ROOM
        </span>

        <button type="button" onClick={() => run("onboard")} className="btn" style={{ height: 38 }}>
          <span style={{ opacity: 0.7 }}>↻</span> Onboard
        </button>
        <button type="button" onClick={() => run("review")} className="btn btn-primary" style={{ height: 38 }}>
          ▸ Run review
        </button>
      </header>

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ padding: "26px 30px 64px", maxWidth: 1320, margin: "0 auto" }}>{children}</div>
      </div>
    </div>
  );
}

function GitGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" style={{ opacity: 0.6, flex: "0 0 auto" }} aria-hidden>
      <path
        fill="var(--muted)"
        d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.49-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}
