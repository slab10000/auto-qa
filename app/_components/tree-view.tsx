"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { TreeData, TreePR, TreeMain } from "@/lib/cockpit";
import { Badge, Sev, ScreenShot } from "@/app/_components/ui";
import { Zoomable } from "@/app/_components/zoomable";

/* ============================================================
   Tree tab — a git-graph of main + open PRs on the left, and an
   inspector on the right that renders either the learned `main`
   memory or a selected PR's review. Ported from the Claude Design
   "auto-qa Cockpit v2.dc.html", wired to real .autoqa data, using
   the cockpit's own design tokens. (Merge / Request-changes buttons
   intentionally omitted.)
   ============================================================ */

const PANEL_W = 440;
const ROW_H = 82;
const TOP = 12;
const LANE_X = [54, 122, 190, 258];
const HUE_VAR = ["var(--accent)", "#f6a64a", "#9b8bff", "#5ac8fa"]; // 2D (css)
const HUE_HEX = ["#7c83ff", "#f6a64a", "#9b8bff", "#5ac8fa"]; // 3D (three.js)

type Row = {
  id: string;
  kind: "main" | "pr" | "hist";
  lane: number;
  idx: number;
  hueVar: string;
  hueHex: string;
  chip: string;
  title: string;
  sub: string;
  verdict: string;
  selectable: boolean;
  target: string;
  activeId: string;
};

function verdictColor(v: string): string {
  const u = (v || "").toUpperCase();
  if (u === "FAIL") return "var(--red)";
  if (u === "PASS") return "var(--green)";
  if (u === "WARN" || u === "NEEDS_REVIEW") return "var(--amber)";
  return "var(--muted-3)";
}

function buildRows(data: TreeData): Row[] {
  const c = data.main.counts;
  const repoShort = data.repo.split("/")[1] || data.repo;
  const rows: Row[] = [];
  rows.push({
    id: "main",
    kind: "main",
    lane: 0,
    idx: 0,
    hueVar: HUE_VAR[0],
    hueHex: HUE_HEX[0],
    chip: "main",
    title: "Current baseline",
    sub: `${c.screens} screens · ${c.contracts} contracts · ${c.skills} skills`,
    verdict: "HEAD",
    selectable: true,
    target: "main",
    activeId: "main",
  });
  data.prs.forEach((p, i) => {
    const lane = 1 + (i % 3);
    rows.push({
      id: p.id,
      kind: "pr",
      lane,
      idx: rows.length,
      hueVar: HUE_VAR[lane],
      hueHex: HUE_HEX[lane],
      chip: p.branch || p.id,
      title: `#${p.num} · ${p.title}`,
      sub: `${p.verdict} · ${p.classification || "—"}${p.took ? ` · ${p.took}` : ""}`,
      verdict: p.verdict,
      selectable: true,
      target: p.id,
      activeId: p.id,
    });
  });
  rows.push({
    id: "main-onboard",
    kind: "hist",
    lane: 0,
    idx: rows.length,
    hueVar: HUE_VAR[0],
    hueHex: HUE_HEX[0],
    chip: "",
    title: `Onboarded ${repoShort}`,
    sub: `learned ${c.screens} screens · ${c.routes} routes`,
    verdict: "",
    selectable: false,
    target: "main",
    activeId: "",
  });
  rows.push({
    id: "main-init",
    kind: "hist",
    lane: 0,
    idx: rows.length,
    hueVar: HUE_VAR[0],
    hueHex: HUE_HEX[0],
    chip: "",
    title: `Connected ${data.repo}`,
    sub: "repo linked · baseline captured",
    verdict: "",
    selectable: false,
    target: "main",
    activeId: "",
  });
  return rows;
}

const cy = (i: number) => TOP + i * ROW_H + ROW_H / 2;

export function TreeView({ data }: { data: TreeData }) {
  const [sel, setSel] = useState<string>("main");
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const rows = useMemo(() => buildRows(data), [data]);
  const pr = data.prs.find((p) => p.id === sel) || null;
  const onSelect = (target: string) => setSel(target);
  const gh = TOP + rows.length * ROW_H + 6;

  return (
    <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
      {/* ============ GRAPH PANEL ============ */}
      <aside
        style={{
          flex: `0 0 ${PANEL_W}px`,
          position: "sticky",
          top: 14,
          alignSelf: "flex-start",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".12em", color: "var(--faint)" }}>GRAPH</span>
          <span style={{ fontSize: 12, color: "var(--muted-3)" }}>
            main + {data.prs.length} open PR{data.prs.length === 1 ? "" : "s"}
          </span>
          <span style={{ flex: 1 }} />
          <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 9, overflow: "hidden" }}>
            {(["2d", "3d"] as const).map((mdv) => (
              <button
                key={mdv}
                type="button"
                onClick={() => setMode(mdv)}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 10.5,
                  letterSpacing: ".04em",
                  padding: "5px 10px",
                  border: "none",
                  cursor: "pointer",
                  background: mode === mdv ? "rgba(124,131,255,.16)" : "transparent",
                  color: mode === mdv ? "var(--accent-ink)" : "var(--faint)",
                }}
              >
                {mdv === "2d" ? "2D graph" : "3D orbit"}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 16,
            background: "linear-gradient(180deg, rgba(124,131,255,.03), transparent 45%), var(--panel-2)",
            overflow: "hidden",
          }}
        >
          {mode === "2d" ? (
            <Graph2D rows={rows} sel={sel} onSelect={onSelect} height={gh} />
          ) : (
            <Graph3D rows={rows} sel={sel} onSelect={onSelect} />
          )}
          <div style={{ textAlign: "center", fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--faint)", padding: "0 0 14px" }}>
            {mode === "2d" ? "click a node to inspect →" : "drag to orbit · scroll to zoom · click a node"}
          </div>
        </div>
      </aside>

      {/* ============ INSPECTOR ============ */}
      <main style={{ flex: 1, minWidth: 0 }}>
        {sel === "main" ? <MainInspector main={data.main} /> : pr ? <PRInspector pr={pr} repo={data.repo} /> : null}
      </main>
    </div>
  );
}

/* ---------------- 2D graph ---------------- */

function Graph2D({ rows, sel, onSelect, height }: { rows: Row[]; sel: string; onSelect: (t: string) => void; height: number }) {
  const last = rows.length - 1;
  const edges: { d: string; c: string; w: number; o: number }[] = [];
  // main spine (lane 0) from baseline down to the last history node
  edges.push({ d: `M${LANE_X[0]} ${cy(0)} L${LANE_X[0]} ${cy(last)}`, c: "var(--accent)", w: 2.5, o: 0.5 });
  // each PR branches off the baseline node
  rows
    .filter((r) => r.kind === "pr")
    .forEach((r) => {
      const x = LANE_X[r.lane];
      const mid = (cy(0) + cy(r.idx)) / 2;
      edges.push({ d: `M${LANE_X[0]} ${cy(0)} C${LANE_X[0]} ${mid} ${x} ${mid} ${x} ${cy(r.idx)}`, c: r.hueVar, w: 2.5, o: 0.85 });
    });

  return (
    <div style={{ position: "relative", width: PANEL_W, height }}>
      <svg width={PANEL_W} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {edges.map((e, i) => (
          <path key={i} d={e.d} fill="none" stroke={e.c} strokeWidth={e.w} strokeLinecap="round" opacity={e.o} />
        ))}
      </svg>

      {rows.map((r) => {
        const active = r.selectable && sel === r.target;
        const isTip = r.kind === "main" || r.kind === "pr";
        const dot = active ? 17 : isTip ? 13 : 9;
        const dotStyle: CSSProperties = {
          position: "absolute",
          left: LANE_X[r.lane],
          top: ROW_H / 2,
          width: dot,
          height: dot,
          borderRadius: "50%",
          transform: "translate(-50%,-50%)",
          background: isTip ? r.hueVar : "var(--panel)",
          border: `${isTip ? 3 : 2}px solid ${r.hueVar}`,
          boxShadow: active
            ? `0 0 0 5px color-mix(in srgb, ${r.hueVar} 22%, transparent), 0 0 20px ${r.hueVar}`
            : isTip
              ? `0 0 11px color-mix(in srgb, ${r.hueVar} 55%, transparent)`
              : "none",
          zIndex: 2,
          transition: "box-shadow .25s, width .2s, height .2s",
        };
        return (
          <div
            key={r.id}
            onClick={r.selectable ? () => onSelect(r.target) : undefined}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: TOP + r.idx * ROW_H,
              height: ROW_H,
              cursor: r.selectable ? "pointer" : "default",
            }}
          >
            {active && (
              <div
                style={{
                  position: "absolute",
                  left: LANE_X[r.lane] + 22,
                  right: 12,
                  top: 8,
                  bottom: 8,
                  borderRadius: 13,
                  background: `linear-gradient(90deg, color-mix(in srgb, ${r.hueVar} 13%, transparent), transparent 80%)`,
                  border: `1px solid color-mix(in srgb, ${r.hueVar} 34%, var(--line))`,
                }}
              />
            )}
            <div style={dotStyle} />
            <div style={{ position: "absolute", left: 200, right: 18, top: "50%", transform: "translateY(-50%)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {r.chip && (
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      fontWeight: 500,
                      color: r.hueVar,
                      background: `color-mix(in srgb, ${r.hueVar} 14%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${r.hueVar} 34%, transparent)`,
                      padding: "2px 8px",
                      borderRadius: 7,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 150,
                    }}
                  >
                    {r.chip}
                  </span>
                )}
                {!!r.verdict && r.verdict !== "HEAD" && (
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 9.5,
                      fontWeight: 600,
                      letterSpacing: ".04em",
                      color: verdictColor(r.verdict),
                      border: `1px solid color-mix(in srgb, ${verdictColor(r.verdict)} 40%, transparent)`,
                      padding: "2px 6px",
                      borderRadius: 6,
                    }}
                  >
                    {r.verdict}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: r.selectable ? "var(--ink)" : "var(--muted-3)",
                  marginTop: 5,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.title}
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--faint)",
                  marginTop: 3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.sub}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- 3D orbit (lazy three.js) ---------------- */

function Graph3D({ rows, sel, onSelect }: { rows: Row[]; sel: string; onSelect: (t: string) => void }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const selRef = useRef(sel);
  const onSelectRef = useRef(onSelect);
  selRef.current = sel;
  onSelectRef.current = onSelect;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let teardown: (() => void) | null = null;

    const loadThree = (cb: () => void) => {
      const w = window as any;
      if (w.THREE) return cb();
      let s = document.getElementById("three-cdn") as HTMLScriptElement | null;
      if (s) {
        s.addEventListener("load", cb);
        s.addEventListener("error", () => setFailed(true));
        return;
      }
      s = document.createElement("script");
      s.id = "three-cdn";
      s.src = "https://unpkg.com/three@0.149.0/build/three.min.js";
      s.onload = cb;
      s.onerror = () => setFailed(true);
      document.head.appendChild(s);
    };

    loadThree(() => {
      if (disposed) return;
      const THREE = (window as any).THREE;
      const mount = mountRef.current;
      if (!THREE || !mount) return;
      try {
        const W = mount.clientWidth || PANEL_W;
        const H = mount.clientHeight || 480;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
        camera.position.set(2.6, 0.6, 8.2);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        mount.appendChild(renderer.domElement);
        scene.add(new THREE.AmbientLight(0xffffff, 0.75));
        const pl = new THREE.PointLight(0xffffff, 0.7);
        pl.position.set(5, 6, 9);
        scene.add(pl);

        const laneX = [0, 1.7, 2.9, 4.0];
        const n = rows.length;
        const pos: Record<string, any> = {};
        rows.forEach((r) => {
          pos[r.id] = new THREE.Vector3(laneX[r.lane], (n / 2 - r.idx) * 1.3, 0);
        });
        const addLine = (pts: any[], hex: number) => {
          const g = new THREE.BufferGeometry().setFromPoints(pts);
          scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.7 })));
        };
        // spine through lane-0 nodes
        const spine = rows.filter((r) => r.lane === 0).map((r) => pos[r.id]);
        if (spine.length > 1) addLine(spine, 0x7c83ff);
        // PR branches from baseline
        rows
          .filter((r) => r.kind === "pr")
          .forEach((r) => {
            const a = pos["main"];
            const b = pos[r.id];
            const curve = new THREE.CubicBezierCurve3(a, new THREE.Vector3(a.x, (a.y + b.y) / 2, 0), new THREE.Vector3(b.x, (a.y + b.y) / 2, 0), b);
            addLine(curve.getPoints(36), parseInt(r.hueHex.slice(1), 16));
          });

        const nodes: any[] = [];
        rows.forEach((r) => {
          const tip = r.kind === "main" || r.kind === "pr";
          const hex = parseInt(r.hueHex.slice(1), 16);
          const base = tip ? 0.18 : 0.11;
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(base, 32, 32),
            new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: tip ? 0.85 : 0.4, roughness: 0.35, metalness: 0.25 })
          );
          mesh.position.copy(pos[r.id]);
          mesh.userData = { target: r.target, selectable: r.selectable, activeId: r.activeId };
          scene.add(mesh);
          nodes.push(mesh);
        });

        const target = new THREE.Vector3(1.0, 0, 0);
        let radius = 8.2,
          theta = 0.5,
          phi = 1.32,
          dragging = false,
          last: number[] | null = null,
          downXY: number[] | null = null;
        const setCam = () => {
          phi = Math.max(0.4, Math.min(Math.PI - 0.4, phi));
          camera.position.set(
            target.x + radius * Math.sin(phi) * Math.sin(theta),
            target.y + radius * Math.cos(phi),
            target.z + radius * Math.sin(phi) * Math.cos(theta)
          );
          camera.lookAt(target);
        };
        setCam();

        const ray = new THREE.Raycaster();
        const mv = new THREE.Vector2();
        const dom = renderer.domElement;
        dom.style.cursor = "grab";
        const onDown = (e: PointerEvent) => {
          dragging = true;
          last = [e.clientX, e.clientY];
          downXY = [e.clientX, e.clientY];
          dom.style.cursor = "grabbing";
        };
        const onMove = (e: PointerEvent) => {
          if (!dragging || !last) return;
          theta -= (e.clientX - last[0]) * 0.006;
          phi -= (e.clientY - last[1]) * 0.006;
          last = [e.clientX, e.clientY];
          setCam();
        };
        const onUp = (e: PointerEvent) => {
          dragging = false;
          dom.style.cursor = "grab";
          if (!downXY) return;
          const moved = Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]);
          downXY = null;
          if (moved > 5) return;
          const rect = dom.getBoundingClientRect();
          mv.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mv.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          ray.setFromCamera(mv, camera);
          const hit = ray.intersectObjects(nodes);
          if (hit.length && hit[0].object.userData.selectable) onSelectRef.current(hit[0].object.userData.target);
        };
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          radius = Math.max(4.5, Math.min(15, radius + e.deltaY * 0.01));
          setCam();
        };
        dom.addEventListener("pointerdown", onDown);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        dom.addEventListener("wheel", onWheel, { passive: false });

        let raf = 0;
        let t = 0;
        const loop = () => {
          if (disposed) return;
          t += 1;
          if (!dragging) {
            theta += 0.0015;
            setCam();
          }
          const cur = selRef.current;
          nodes.forEach((nd) => {
            const on = nd.userData.activeId && nd.userData.activeId === cur;
            nd.scale.setScalar(on ? 1.55 + 0.12 * Math.sin(t * 0.08) : 1);
            nd.material.emissiveIntensity = on ? 1.5 : nd.userData.activeId ? 0.85 : 0.4;
          });
          renderer.render(scene, camera);
          raf = requestAnimationFrame(loop);
        };
        loop();

        teardown = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          dom.removeEventListener("pointerdown", onDown);
          dom.removeEventListener("wheel", onWheel);
          try {
            renderer.dispose();
          } catch {}
          if (dom.parentNode) dom.parentNode.removeChild(dom);
        };
      } catch {
        setFailed(true);
      }
    });

    return () => {
      disposed = true;
      if (teardown) teardown();
    };
  }, [rows]);

  if (failed) {
    return (
      <div style={{ width: PANEL_W, height: 480, display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--faint)", lineHeight: 1.6 }}>
          3D orbit unavailable (couldn&apos;t load three.js).
          <br />
          Switch back to the 2D graph above.
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      style={{
        position: "relative",
        width: PANEL_W,
        height: 480,
        cursor: "grab",
        background: "radial-gradient(300px 300px at 45% 42%, rgba(124,131,255,.07), transparent 72%)",
      }}
    />
  );
}

/* ---------------- inspectors ---------------- */

const eyebrowRow = (label: string, hint?: string) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "34px 0 14px" }}>
    <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".1em", color: "var(--faint)" }}>{label}</span>
    <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
    {hint && <span style={{ fontSize: 12, color: "var(--muted-3)" }}>{hint}</span>}
  </div>
);

function MainInspector({ main }: { main: TreeMain }) {
  const c = main.counts;
  const learned = main.learnedAt ? new Date(main.learnedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  if (c.screens === 0) {
    return (
      <div style={{ animation: "fadeIn .3s ease" }}>
        <h1 style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 28, letterSpacing: "-.02em", margin: "4px 0 0" }}>
          No product memory yet
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted-2)", lineHeight: 1.55, margin: "8px 0 18px", maxWidth: "60ch" }}>
          auto·qa hasn&apos;t learned <span style={{ color: "var(--ink-2)" }}>{main.repo}</span> yet. Run onboarding to clone the repo,
          drive every page with Computer Use, and write the baseline.
        </p>
        <div className="empty">
          Run <span style={{ fontFamily: "var(--mono)", color: "var(--accent-ink)" }}>npm&nbsp;run&nbsp;onboard</span> — or use the Onboard button in the header.
        </div>
      </div>
    );
  }

  const stat = (value: React.ReactNode, label: string, extra?: React.ReactNode) => (
    <div style={{ border: "1px solid var(--line)", borderRadius: 13, padding: "15px 17px", background: "var(--panel)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
        <span style={{ fontFamily: "var(--display)", fontSize: 26, fontWeight: 700 }}>{value}</span>
        {extra}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--muted-3)", marginTop: 2 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Badge variant="accent" dot>
              main
            </Badge>
            <span style={{ fontSize: 13, color: "var(--muted-3)" }}>accepted product · in sync</span>
          </div>
          <h1 style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 30, letterSpacing: "-.02em", margin: "14px 0 0" }}>
            What auto·qa knows about main
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: "var(--muted-2)", margin: "8px 0 0", maxWidth: "60ch" }}>
            The living product memory learned by driving the real app. Every screen, navigation contract, skill and cached route below was
            captured from <span style={{ color: "var(--ink-2)" }}>{main.repo}</span> — and is the baseline every PR is reviewed against.
          </p>
        </div>
        <div style={{ flex: "0 0 auto", fontFamily: "var(--mono)", fontSize: 11, color: "var(--faint)", textAlign: "right", paddingTop: 4 }}>
          LEARNED
          <br />
          <span style={{ color: "var(--muted-3)" }}>{learned}</span>
        </div>
      </div>

      {/* stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 24 }}>
        {stat(c.screens, "screens")}
        {stat(c.contracts, "nav contracts")}
        {stat(c.skills, "skills")}
        {stat(
          c.routes,
          "cached routes",
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent-ink)", border: "1px solid rgba(124,131,255,.3)", padding: "1px 6px", borderRadius: 5 }}>
            0 calls
          </span>
        )}
      </div>

      {/* screens */}
      {eyebrowRow("LEARNED SCREENS")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
        {main.screens.map((s) => (
          <Zoomable key={s.id} src={s.shot} caption={`${s.name} · ${s.url}`}>
            <div style={{ border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", background: "var(--panel)" }}>
              <ScreenShot src={s.shot} url={`test-app${s.url}`} height={196} />
              <div style={{ padding: "13px 15px 15px" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--muted-2)", marginTop: 5 }}>{s.purpose}</div>
              </div>
            </div>
          </Zoomable>
        ))}
      </div>

      {/* nav contracts */}
      {eyebrowRow("NAVIGATION CONTRACTS", "what should happen on each action")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 13 }}>
        {main.contracts.map((ct) => (
          <div key={ct.id} style={{ border: "1px solid var(--line)", borderRadius: 13, padding: "15px 16px", background: "var(--panel)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 8px var(--green)" }} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>{ct.action}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 11, fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted-2)" }}>
              <span style={{ color: "var(--faint)" }}>→ navigate to</span> <span style={{ color: "var(--accent-ink)" }}>{ct.dest || "—"}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 6 }}>anchor · {ct.anchor || "—"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11 }}>
              <span style={{ flex: 1, height: 4, borderRadius: 3, background: "var(--line-frame)", overflow: "hidden" }}>
                <span style={{ display: "block", width: ct.confPct, height: "100%", background: "var(--green)" }} />
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--muted-3)" }}>{ct.confPct} confidence</span>
            </div>
          </div>
        ))}
      </div>

      {/* skills */}
      {eyebrowRow("SKILLS", "how-to-test notes the agent wrote")}
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {main.skills.map((k, i) => (
          <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 13, padding: "14px 17px", background: "var(--panel)", display: "flex", alignItems: "flex-start", gap: 13 }}>
            <span
              style={{
                flex: "0 0 auto",
                width: 30,
                height: 30,
                borderRadius: 9,
                background: "rgba(124,131,255,.13)",
                border: "1px solid rgba(124,131,255,.3)",
                display: "grid",
                placeItems: "center",
                color: "var(--accent-2)",
                fontSize: 14,
              }}
            >
              ✦
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{k.name}</div>
              {k.step && <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted-2)", marginTop: 5 }}>{k.step}</div>}
              {k.expected && <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 5 }}>expected · {k.expected}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* routes */}
      {eyebrowRow("CACHED ROUTES", "replayed with zero model calls")}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {main.routes.map((r, i) => (
          <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "13px 16px", background: "var(--panel)", display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                flex: "0 0 auto",
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--accent-ink)",
                background: "rgba(124,131,255,.1)",
                border: "1px solid rgba(124,131,255,.28)",
                padding: "4px 9px",
                borderRadius: 7,
              }}
            >
              ⚡ 0 calls
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.goal}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--faint)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.sig} &nbsp;→&nbsp; {r.url}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PRInspector({ pr, repo }: { pr: TreePR; repo: string }) {
  const vColor = verdictColor(pr.verdict);

  return (
    <div style={{ animation: "fadeIn .3s ease" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <span style={{ flex: "0 0 auto", marginTop: 3 }}>
          <Badge verdict={pr.verdict} style={{ fontSize: 12.5, padding: "6px 12px" }}>
            {pr.verdict}
          </Badge>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 26, letterSpacing: "-.02em", margin: 0 }}>
            #{pr.num} · {pr.title}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 9, flexWrap: "wrap" }}>
            {pr.branch && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "#b3a9ff", background: "rgba(155,139,255,.12)", border: "1px solid rgba(155,139,255,.3)", padding: "3px 9px", borderRadius: 7 }}>
                {pr.branch}
              </span>
            )}
            <span style={{ color: "var(--faint)", fontSize: 13 }}>→</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent-ink)", background: "rgba(124,131,255,.1)", border: "1px solid rgba(124,131,255,.3)", padding: "3px 9px", borderRadius: 7 }}>
              {pr.base}
            </span>
            {pr.classification && <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: vColor }}>· {pr.classification}</span>}
            {pr.took && <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--faint)" }}>· ⏱ {pr.took}</span>}
          </div>
          {pr.statedScope && (
            <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted-2)", margin: "13px 0 0" }}>
              Stated scope — <span style={{ color: "var(--ink-2)" }}>{pr.statedScope}</span>
            </p>
          )}
        </div>
      </div>

      {/* chips */}
      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        {pr.contractsTotal != null && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--mono)",
              fontSize: 12,
              color: pr.contractsOk === pr.contractsTotal ? "var(--green)" : "var(--red)",
              background: pr.contractsOk === pr.contractsTotal ? "rgba(52,211,153,.08)" : "rgba(248,113,113,.08)",
              border: `1px solid ${pr.contractsOk === pr.contractsTotal ? "rgba(52,211,153,.28)" : "rgba(248,113,113,.3)"}`,
              padding: "7px 12px",
              borderRadius: 9,
            }}
          >
            {pr.contractsOk === pr.contractsTotal ? "✓" : "✗"} {pr.contractsOk}/{pr.contractsTotal} navigation contracts intact
          </span>
        )}
        {pr.replay && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--mono)",
              fontSize: 12,
              color: "var(--accent)",
              background: "rgba(124,131,255,.08)",
              border: "1px solid rgba(124,131,255,.28)",
              padding: "7px 12px",
              borderRadius: 9,
            }}
          >
            ⚡ replayed {pr.replay.pages} learned routes · {pr.replay.llm} model calls
          </span>
        )}
      </div>

      {/* visual diff */}
      {eyebrowRow("PER-SCREEN VISUAL DIFF", "main vs PR · captured by Computer Use")}
      {pr.diffs.map((d) => {
        const sColor = d.scope === "out" ? "var(--red)" : d.scope === "in" ? "var(--green)" : "var(--muted-3)";
        return (
          <div key={d.screen} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px", marginBottom: 13, background: "var(--panel)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{d.screen}</span>
              <Sev changed={d.changed} severity={d.severity} />
              {d.changed && d.scope && (
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: sColor,
                    background: `color-mix(in srgb, ${sColor} 13%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${sColor} 42%, transparent)`,
                    padding: "2px 9px",
                    borderRadius: 6,
                  }}
                >
                  {d.scope === "out" ? "✗ OUT OF SCOPE" : "✓ IN SCOPE"}
                </span>
              )}
              {d.navChanged && (
                <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 600, color: "var(--red)", background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.45)", padding: "2px 9px", borderRadius: 6 }}>
                  ✗ NAVIGATION CHANGED{d.navObserved ? ` → ${d.navObserved}` : ""}
                </span>
              )}
            </div>
            {d.changed ? (
              <>
                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-2)", marginTop: 11 }}>{d.summary}</div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 13, marginTop: 14 }}>
                  <figure style={{ margin: 0 }}>
                    <figcaption style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".08em", color: "var(--faint)", marginBottom: 7 }}>MAIN BASELINE</figcaption>
                    <Zoomable src={d.base} caption={`${d.screen} · main baseline`}>
                      <ScreenShot src={d.base} url="main" height={172} />
                    </Zoomable>
                  </figure>
                  <figure style={{ margin: 0 }}>
                    <figcaption style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".08em", color: sColor, marginBottom: 7 }}>THIS PR</figcaption>
                    <Zoomable src={d.head} caption={`${d.screen} · ${pr.branch || "PR"}`}>
                      <ScreenShot src={d.head} url={pr.branch || "PR"} height={172} outline={`1px solid color-mix(in srgb, ${sColor} 45%, var(--line-frame))`} />
                    </Zoomable>
                  </figure>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "var(--faint)", marginTop: 8 }}>No changes detected between the baseline and the PR version.</div>
            )}
          </div>
        );
      })}

      {/* scope analysis */}
      {eyebrowRow("SCOPE ANALYSIS")}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
        <div style={{ border: "1px solid color-mix(in srgb, var(--green) 24%, var(--line))", borderRadius: 13, padding: "15px 17px", background: "color-mix(in srgb, var(--green) 5%, var(--panel))" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--green)", letterSpacing: ".04em" }}>✓ IN SCOPE</div>
          {pr.inScope.length ? (
            pr.inScope.map((x, i) => (
              <div key={i} style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)", marginTop: 9 }}>
                {x}
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: "var(--faint)", marginTop: 9 }}>No in-scope changes recorded.</div>
          )}
        </div>
        <div style={{ border: "1px solid color-mix(in srgb, var(--red) 24%, var(--line))", borderRadius: 13, padding: "15px 17px", background: "color-mix(in srgb, var(--red) 5%, var(--panel))" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--red)", letterSpacing: ".04em" }}>✗ OUT OF SCOPE</div>
          {pr.outScope.length ? (
            pr.outScope.map((x, i) => (
              <div key={i} style={{ fontSize: 13, lineHeight: 1.5, color: "#e9d2d6", marginTop: 9 }}>
                {x}
              </div>
            ))
          ) : (
            <div style={{ fontSize: 13, color: "var(--faint)", marginTop: 9 }}>None — every change matches the stated scope.</div>
          )}
        </div>
      </div>
      {pr.reasoning && (
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--muted-2)", marginTop: 13, padding: "14px 16px", borderLeft: "2px solid var(--line-frame)", background: "rgba(255,255,255,.014)", borderRadius: "0 10px 10px 0" }}>
          {pr.reasoning}
        </div>
      )}

      {/* code-side review */}
      {pr.code && (
        <>
          {eyebrowRow("CODE-SIDE REVIEW · MANAGED AGENT")}
          <div style={{ border: "1px solid var(--line)", borderRadius: 13, padding: "15px 17px", background: "var(--panel)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: pr.code.status === "passed" ? "var(--green)" : "var(--amber)",
                  border: `1px solid color-mix(in srgb, ${pr.code.status === "passed" ? "var(--green)" : "var(--amber)"} 40%, transparent)`,
                  padding: "3px 9px",
                  borderRadius: 7,
                }}
              >
                {pr.code.status}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--muted-2)" }}>
                scope: {pr.code.scope} · risk: {pr.code.risk}
              </span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted-2)", marginTop: 10 }}>{pr.code.note}</div>
          </div>
        </>
      )}

      {/* on merge → main (no action buttons, per request) */}
      <div
        style={{
          marginTop: 24,
          border: "1px solid color-mix(in srgb, var(--accent) 22%, var(--line))",
          borderRadius: 16,
          padding: "20px 22px",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 6%, var(--panel)), var(--panel))",
        }}
      >
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".06em", color: "var(--accent-ink)" }}>ON MERGE → MAIN</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)", marginTop: 10, maxWidth: "62ch" }}>{pr.mergeNote}</div>
      </div>

      {/* footer links */}
      {(pr.href || pr.githubUrl) && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20 }}>
          <span style={{ flex: 1 }} />
          {pr.href && (
            <a href={pr.href} className="btn btn-ghost">
              open step-by-step trace →
            </a>
          )}
          {pr.githubUrl && (
            <a href={pr.githubUrl} target="_blank" rel="noreferrer" className="btn btn-ghost">
              view on GitHub →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
