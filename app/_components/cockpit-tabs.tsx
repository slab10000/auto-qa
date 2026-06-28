"use client";
import { useEffect, useState, type ReactNode } from "react";

// Two-mode cockpit shell: "Overview" (the live control room + analyses, unchanged) and
// "Tree" (the new graph + inspector visualizer). Both subtrees stay mounted and are merely
// shown/hidden, so the Overview's live SSE run + PR-watcher poller keep running while the
// user is looking at the Tree.
export function CockpitTabs({ overview, tree }: { overview: ReactNode; tree: ReactNode }) {
  const [tab, setTab] = useState<"overview" | "tree">("overview");

  // The header's Onboard / Run review buttons switch us to Overview so the live run is visible.
  useEffect(() => {
    const onTab = (e: Event) => {
      const t = (e as CustomEvent).detail;
      if (t === "overview" || t === "tree") setTab(t);
    };
    window.addEventListener("autoqa-tab", onTab);
    return () => window.removeEventListener("autoqa-tab", onTab);
  }, []);

  const TabBtn = ({ id, label, hint, glyph }: { id: "overview" | "tree"; label: string; hint: string; glyph: string }) => {
    const active = tab === id;
    return (
      <button
        type="button"
        onClick={() => setTab(id)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 9,
          padding: "9px 16px",
          borderRadius: 11,
          border: `1px solid ${active ? "rgba(var(--accent-rgb),.4)" : "var(--line)"}`,
          background: active ? "rgba(var(--accent-rgb),.13)" : "var(--panel)",
          color: active ? "var(--ink)" : "var(--muted-3)",
          fontFamily: "var(--sans)",
          fontSize: 14.5,
          fontWeight: active ? 600 : 500,
          cursor: "pointer",
          transition: ".15s",
        }}
      >
        <span style={{ fontSize: 14, color: active ? "var(--accent-2)" : "var(--faint)" }}>{glyph}</span>
        {label}
        <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--faint)", fontWeight: 400 }}>{hint}</span>
      </button>
    );
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          marginBottom: 24,
          paddingBottom: 18,
          borderBottom: "1px solid var(--line-soft)",
        }}
      >
        <TabBtn id="overview" label="Overview" hint="live control room" glyph="▦" />
        <TabBtn id="tree" label="Tree" hint="graph + inspector" glyph="❖" />
      </div>

      <div style={{ display: tab === "overview" ? "block" : "none" }}>{overview}</div>
      <div style={{ display: tab === "tree" ? "block" : "none", animation: tab === "tree" ? "fadeIn .25s ease" : undefined }}>
        {tree}
      </div>
    </div>
  );
}
