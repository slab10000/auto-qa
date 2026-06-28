import type { ReactNode, CSSProperties } from "react";

/* Fixed background glow + grid. Render once per top-level view, inside .fx-root. */
export function BackgroundFx() {
  return (
    <>
      <div className="fx-glow" />
      <div className="fx-grid" />
    </>
  );
}

/* Logo mark (the ⊙ gradient tile). */
export function Mark({ sm }: { sm?: boolean }) {
  return <span className={`mark${sm ? " sm" : ""}`}>⊙</span>;
}

export function Wordmark({ style }: { style?: CSSProperties }) {
  return (
    <span className="wordmark" style={style}>
      auto<span className="dot">·</span>qa
    </span>
  );
}

export type Verdict = "PASS" | "WARN" | "FAIL" | "RUNNING" | "REVIEWING" | "BASELINE" | string;

export function verdictClass(v: Verdict): string {
  const u = (v || "").toUpperCase();
  if (u === "FAIL") return "fail";
  if (u === "WARN" || u === "NEEDS_REVIEW") return "warn";
  if (u === "PASS") return "pass";
  if (u === "RUNNING" || u === "REVIEWING") return "running";
  if (u === "BASELINE") return "baseline";
  return "baseline";
}

export function Badge({
  verdict,
  variant,
  dot,
  children,
  style,
}: {
  verdict?: Verdict;
  variant?: "pass" | "warn" | "fail" | "running" | "baseline" | "accent";
  dot?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const cls = variant ?? verdictClass(verdict ?? "");
  return (
    <span className={`badge ${cls}${dot ? " dot" : ""}`} style={style}>
      {children}
    </span>
  );
}

export function Sev({ changed, severity }: { changed?: boolean; severity?: string }) {
  const sev = (severity ?? "none").toLowerCase();
  return <span className={`sev ${sev}`}>{changed ? `changed · ${sev}` : "no change"}</span>;
}

/* A real screenshot dressed in a browser-chrome frame (replaces the design's MockScreen). */
export function ScreenShot({
  src,
  url,
  alt,
  height,
  chrome = true,
  scan = false,
  style,
  outline,
}: {
  src?: string | null;
  url?: string;
  alt?: string;
  height?: number | string;
  chrome?: boolean;
  scan?: boolean;
  style?: CSSProperties;
  outline?: string;
}) {
  const h = typeof height === "number" ? `${height}px` : height;
  return (
    <div
      className="shot"
      style={{
        borderRadius: 12,
        border: "1px solid var(--line-frame)",
        outline,
        outlineOffset: outline ? -1 : undefined,
        ...style,
      }}
    >
      {chrome && (
        <div className="shot-chrome">
          <span className="dotrow">
            <i />
            <i />
            <i />
          </span>
          <span className="url">{url || ""}</span>
        </div>
      )}
      <div style={{ position: "relative", height: chrome ? `calc(${h ?? "150px"} - 30px)` : h, minHeight: 60 }}>
        {src ? (
          <img src={src} alt={alt || ""} />
        ) : (
          <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--faint)", fontFamily: "var(--mono)", fontSize: 12 }}>
            no screenshot
          </div>
        )}
        {scan && <div className="scanline" />}
      </div>
    </div>
  );
}

/* Tiny area sparkline. `series` are raw values; lower-is-better is fine (auto-scaled). */
export function Sparkline({
  series,
  width = 240,
  height = 56,
  color = "#34d399",
  invert = false,
}: {
  series: number[];
  width?: number;
  height?: number;
  color?: string;
  invert?: boolean;
}) {
  const pad = 6;
  const mn = Math.min(...series);
  const mx = Math.max(...series);
  const span = mx - mn || 1;
  const pts = series.map((v, i) => {
    const x = pad + (i * (width - pad * 2)) / Math.max(series.length - 1, 1);
    const t = (v - mn) / span;
    const y = invert ? pad + t * (height - pad * 2) : height - pad - t * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${pad},${height} ${line} ${width - pad},${height}`;
  const last = pts[pts.length - 1];
  const gid = `spk-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".3" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="3.4" fill={color} />
    </svg>
  );
}

/* Horizontal pipeline stepper (clone→diff→drive→compare→scope→code→verdict). */
export type Stage = { label: string };
export function PipelineRail({
  stages,
  current,
  live,
}: {
  stages: Stage[];
  current: number; // index of the active/last-reached stage
  live?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {stages.map((st, i) => {
        const done = i < current;
        const active = i === current && !!live;
        const node: CSSProperties = {
          width: 23,
          height: 23,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          fontFamily: "var(--mono)",
          fontSize: 10,
          position: "relative",
          zIndex: 1,
          ...(active
            ? { color: "#0a0b0f", background: "var(--accent-3)", boxShadow: "0 0 0 4px rgba(var(--accent-rgb),.16)", animation: "pulseI 1.6s infinite" }
            : done
              ? { color: "var(--accent-ink)", background: "rgba(var(--accent-rgb),.2)", border: "1px solid rgba(var(--accent-rgb),.5)" }
              : { color: "var(--faint)", background: "var(--panel-2)", border: "1px solid var(--line-frame)" }),
        };
        const lab: CSSProperties = {
          fontSize: 10,
          marginTop: 7,
          textAlign: "center",
          color: active ? "var(--ink)" : done ? "var(--muted-3)" : "var(--faint)",
          fontWeight: active ? 600 : 400,
        };
        const conn = i === 0 ? "transparent" : i <= current ? "var(--accent)" : "var(--line-frame)";
        return (
          <div key={st.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            <div style={{ position: "absolute", top: 11, left: "-50%", width: "100%", height: 2, background: conn }} />
            <div style={node}>{done ? "✓" : String(i + 1)}</div>
            <div style={lab}>{st.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export const PIPELINE: Stage[] = [
  { label: "Clone" },
  { label: "Diff" },
  { label: "Drive" },
  { label: "Compare" },
  { label: "Scope" },
  { label: "Code" },
  { label: "Verdict" },
];
