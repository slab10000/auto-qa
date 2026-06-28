"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Mark, Wordmark } from "./ui";

const NAV = [
  { id: "overview", label: "Overview", glyph: "▦", href: "/cockpit" },
  { id: "memory", label: "Memory", glyph: "◈", href: "/cockpit/memory" },
  { id: "skills", label: "Skills", glyph: "✦", href: "/cockpit/skills" },
  { id: "gallery", label: "Gallery", glyph: "▣", href: "/cockpit/gallery" },
  { id: "history", label: "PR history", glyph: "⟲", href: "/cockpit/history" },
  { id: "current", label: "Current PRs", glyph: "◆", href: "/cockpit/current" },
];

export function CockpitShell({ repo, children }: { repo: string; children: ReactNode }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/cockpit" ? path === "/cockpit" : path.startsWith(href));

  return (
    <div className="fx-root">
      <div className="fx-glow" />
      <div className="fx-grid" />
      <div className="fx-content" style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        {/* SIDEBAR */}
        <aside
          style={{
            flex: "0 0 260px",
            height: "100vh",
            borderRight: "1px solid var(--line-soft)",
            background: "rgba(11,13,18,.66)",
            backdropFilter: "blur(14px)",
            display: "flex",
            flexDirection: "column",
            padding: "20px 15px",
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 7px" }}>
            <Mark sm />
            <Wordmark style={{ fontSize: 18 }} />
          </Link>

          <div
            style={{
              margin: "16px 7px 14px",
              padding: "11px 12px",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 12,
            }}
          >
            <div className="mono" style={{ fontSize: 9.5, letterSpacing: ".12em", color: "var(--faint)" }}>REPOSITORY</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <GitGlyph />
              <span className="mono" style={{ fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {repo}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)" }} />
              <span className="mono" style={{ fontSize: 11, color: "var(--muted-3)" }}>main · in sync</span>
            </div>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {NAV.map((n) => (
              <Link key={n.id} href={n.href} className={`navlink${isActive(n.href) ? " active" : ""}`}>
                <span className="g">{n.glyph}</span>
                <span>{n.label}</span>
              </Link>
            ))}
          </nav>

          <span style={{ flex: 1 }} />

          <Link
            href="/run"
            style={{
              margin: "0 7px 12px",
              padding: 13,
              border: "1px solid rgba(124,131,255,.26)",
              background: "rgba(124,131,255,.07)",
              borderRadius: 12,
              display: "block",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", animation: "pulseI 1.8s infinite" }} />
              <span className="mono" style={{ fontSize: 10, letterSpacing: ".08em", color: "var(--accent-ink)" }}>WATCH IT THINK</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8, lineHeight: 1.45 }}>
              ▶ Trigger a live review and watch the agent drive the app in real time.
            </div>
          </Link>

          <Link
            href="/"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 9px", color: "var(--faint)", fontSize: 13 }}
          >
            <span>←</span> Back to site
          </Link>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, height: "100vh", overflowY: "auto" }}>
          <header
            style={{
              position: "sticky",
              top: 0,
              zIndex: 6,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "15px 32px",
              background: "rgba(10,11,15,.78)",
              backdropFilter: "blur(14px)",
              borderBottom: "1px solid var(--line-soft)",
            }}
          >
            <span className="mono" style={{ fontSize: 12.5, color: "var(--muted-3)" }}>{repo}</span>
            <span className="mono" style={{ fontSize: 12.5, color: "var(--faint)" }}>/&nbsp;main</span>
            <span style={{ flex: 1 }} />
            <Link
              href="/run"
              className="mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 11.5,
                color: "var(--green)",
                padding: "5px 11px",
                border: "1px solid rgba(52,211,153,.3)",
                borderRadius: 999,
                background: "rgba(52,211,153,.06)",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", animation: "pulseG 2s infinite" }} />
              LIVE RUN
            </Link>
            <Link href="/run?start=onboard" className="btn" style={{ fontSize: 13.5, padding: "8px 14px" }}>⟳ Onboard</Link>
            <Link href="/" className="btn btn-light" style={{ fontSize: 13.5, padding: "8px 15px" }}>＋ New repo</Link>
          </header>

          <div style={{ padding: "30px 32px 64px", maxWidth: 1180 }}>{children}</div>
        </main>
      </div>
    </div>
  );
}

function GitGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" style={{ flex: "0 0 auto" }} aria-hidden>
      <path
        fill="#7c8398"
        d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.49-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.05-.49.05-.49.81.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.01.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
      />
    </svg>
  );
}
