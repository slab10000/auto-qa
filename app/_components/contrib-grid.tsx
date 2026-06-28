"use client";

/* ============================================================
   auto·qa landing — 3D git-contribution table (three.js)
   A slightly-tilted "table" of the GitHub contribution grid.
   Each green square is a 3D tile extruded upward by activity.
   Nothing animates on its own — tiles only react to the cursor:
   the ones you sweep over slowly rise a little more and grow
   greener, and the active (green) squares reveal annotation
   "hints" — a connector line to a made-up PR label.
   Soft shadows ground the tiles; emissive + bloom make the
   active greens glow.
   ============================================================ */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const COLS = 52; // weeks
const ROWS = 7; // days
const N = COLS * ROWS;
const PITCH = 0.34; // cell-to-cell spacing
const TILE = 0.295; // tile footprint (PITCH - gap)
const GRID_W = COLS * PITCH;
const GRID_D = ROWS * PITCH;

const MAX_H = 0.74; // tallest resting tile — chunky raised squares, not towers
const HOVER_H = 0.42; // extra height under the cursor
const HOVER_R = 1.35; // cursor influence radius (world units)

// hint annotations
const MAX_HINTS = 5;
const HINT_SHOW = 0.55; // hover strength that spawns a hint
const HINT_HIDE = 0.26; // hover below this releases the hint (hysteresis)
const MSGS = [
  "PR #128 · change this color",
  "PR #214 · update the landing",
  "PR #97 · recolor the grid",
  "PR #305 · ship hover hints",
  "PR #142 · tweak the bloom",
  "PR #88 · new contribution palette",
  "PR #176 · center the hero",
  "PR #233 · faster route replay",
  "PR #51 · onboard a new repo",
  "PR #260 · fix the tile shadows",
  "PR #319 · add the subtitle",
  "PR #404 · review me 👀",
];

/* deterministic PRNG so the field looks the same every load */
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* a realistic-looking year of contributions, 0..1 per cell */
function genLevels(): Float32Array {
  const rnd = mulberry32(0x9e3779b9);
  const L = new Float32Array(N);
  const weekHot: number[] = [];
  for (let c = 0; c < COLS; c++) weekHot[c] = rnd();
  for (let c = 0; c < COLS; c++) {
    const seasonal = 0.5 + 0.5 * Math.sin(c * 0.17 + 0.8); // busier stretches
    const weekActivity = 0.36 + 0.64 * weekHot[c];
    const streak = weekHot[c] > 0.84 ? 2.3 : 1; // occasional hot weeks
    for (let r = 0; r < ROWS; r++) {
      const weekend = r === 0 || r === ROWS - 1 ? 0.55 : 1; // quieter weekends
      let v = rnd() * seasonal * weekActivity * weekend * streak;
      v = Math.pow(v, 1.32);
      if (v < 0.1) v = 0; // many empty days, like a real graph
      L[c * ROWS + r] = Math.min(1, v);
    }
  }
  return L;
}

export default function ContribGrid({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      canvas.setAttribute("data-webgl", "off");
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060a);
    scene.fog = new THREE.Fog(0x05060a, 26, 60);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    const target = new THREE.Vector3(0, 0.25, 0);

    /* ---- lights ---- */
    scene.add(new THREE.HemisphereLight(0x2a3550, 0x05060a, 0.65));
    const key = new THREE.DirectionalLight(0xcfe0ff, 1.15);
    key.position.set(6, 12, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    key.shadow.camera.left = -GRID_W * 0.6;
    key.shadow.camera.right = GRID_W * 0.6;
    key.shadow.camera.top = GRID_W * 0.4;
    key.shadow.camera.bottom = -GRID_W * 0.4;
    key.shadow.bias = -0.0008;
    key.shadow.radius = 3;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x6f7bff, 0.25);
    fill.position.set(-8, 4, -6);
    scene.add(fill);

    /* ---- the table the tiles sit on ---- */
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID_W * 3, GRID_W * 3),
      new THREE.MeshStandardMaterial({ color: 0x0a0d14, roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.001;
    ground.receiveShadow = true;
    scene.add(ground);

    /* ---- the contribution tiles ---- */
    const geo = new RoundedBoxGeometry(TILE, 1, TILE, 3, 0.07);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.02 });
    // per-instance color tints diffuse; reuse it as emissive so active tiles glow.
    const emissiveBoost = { value: 0.42 };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uEmissive = emissiveBoost;
      shader.vertexShader = "varying vec3 vICol;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n#ifdef USE_INSTANCING_COLOR\n vICol = instanceColor;\n#else\n vICol = vec3(1.0);\n#endif"
      );
      shader.fragmentShader = "uniform float uEmissive;\nvarying vec3 vICol;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "vec3 totalEmissiveRadiance = emissive;",
        "vec3 totalEmissiveRadiance = emissive + vICol * uEmissive;"
      );
    };

    const mesh = new THREE.InstancedMesh(geo, mat, N);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);

    const levels = genLevels();
    const cellX = new Float32Array(N);
    const cellZ = new Float32Array(N);
    const baseH = new Float32Array(N);
    const curH = new Float32Array(N);
    const hover = new Float32Array(N);
    const msgOf = new Array<string>(N);
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const i = c * ROWS + r;
        cellX[i] = (c - (COLS - 1) / 2) * PITCH;
        cellZ[i] = (r - (ROWS - 1) / 2) * PITCH;
        baseH[i] = 0.07 + Math.pow(levels[i], 1.25) * MAX_H;
        curH[i] = 0.07; // start flat, rise in on the intro
        const h = ((i * 2654435761) >>> 0) / 4294967296;
        msgOf[i] = MSGS[Math.floor(h * MSGS.length) % MSGS.length];
      }
    }

    /* GitHub-style green ramp, from a dark empty cell to bright lime */
    const cEmpty = new THREE.Color(0x1a2621);
    const cG1 = new THREE.Color(0x0e4429);
    const cG2 = new THREE.Color(0x006d32);
    const cG3 = new THREE.Color(0x26a641);
    const cG4 = new THREE.Color(0x4ae168);
    const tmp = new THREE.Color();
    function heatColor(heat: number, out: THREE.Color) {
      const h = Math.max(0, Math.min(1.1, heat));
      if (h < 0.25) out.copy(cEmpty).lerp(cG1, h / 0.25);
      else if (h < 0.5) out.copy(cG1).lerp(cG2, (h - 0.25) / 0.25);
      else if (h < 0.75) out.copy(cG2).lerp(cG3, (h - 0.5) / 0.25);
      else out.copy(cG3).lerp(cG4, Math.min(1, (h - 0.75) / 0.35));
      return out;
    }

    const dummy = new THREE.Object3D();
    // seed colors so instanceColor exists before first compile (enables USE_INSTANCING_COLOR)
    for (let i = 0; i < N; i++) mesh.setColorAt(i, heatColor(levels[i], tmp));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    /* ---- hint overlay DOM pool (lines + labels) ---- */
    const SVGNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("class", "lp-hint-lines");
    overlay.appendChild(svg);
    const lineEls: SVGLineElement[] = [];
    const dotEls: SVGCircleElement[] = [];
    const labelEls: HTMLDivElement[] = [];
    const slots = new Array<number>(MAX_HINTS).fill(-1);
    const slotSX = new Float32Array(MAX_HINTS);
    const slotSY = new Float32Array(MAX_HINTS);
    const slotLX = new Float32Array(MAX_HINTS);
    const slotLY = new Float32Array(MAX_HINTS);
    const boxL = new Float32Array(MAX_HINTS);
    const boxR = new Float32Array(MAX_HINTS);
    const boxT = new Float32Array(MAX_HINTS);
    const boxB = new Float32Array(MAX_HINTS);
    const slotPrev = new Array<number>(MAX_HINTS).fill(-1);
    const LBL_H = 28;
    // label sits up-and-toward-screen-centre from its tile; returns box + anchor
    function labelMetrics(ti: number, sx: number, sy: number) {
      const lx = sx + (sx < W * 0.5 ? 38 : -38);
      const ly = sy - 64;
      const w = msgOf[ti].length * 6.9 + 26;
      return { lx, ly, l: lx - w / 2, r: lx + w / 2, t: ly - LBL_H, b: ly };
    }
    function boxesOverlap(s: number, l: number, r: number, t: number, b: number) {
      const m = 10;
      return l < boxR[s] + m && r > boxL[s] - m && t < boxB[s] + m && b > boxT[s] - m;
    }
    for (let s = 0; s < MAX_HINTS; s++) {
      const ln = document.createElementNS(SVGNS, "line");
      ln.setAttribute("class", "lp-hint-line");
      ln.style.opacity = "0";
      svg.appendChild(ln);
      lineEls.push(ln);
      const dot = document.createElementNS(SVGNS, "circle");
      dot.setAttribute("class", "lp-hint-dot");
      dot.setAttribute("r", "3");
      dot.style.opacity = "0";
      svg.appendChild(dot);
      dotEls.push(dot);
      const lab = document.createElement("div");
      lab.className = "lp-hint";
      lab.style.opacity = "0";
      overlay.appendChild(lab);
      labelEls.push(lab);
    }

    /* ---- camera framing: fit the wide panel, viewed at a tilt ---- */
    const ELEV = 0.7; // ~40° elevation → "slightly horizontal" table view
    let camDist = 14;
    function fitCamera(w: number, h: number) {
      const aspect = w / h;
      camera.aspect = aspect;
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      const distW = (GRID_W * 0.5 + 0.25) / Math.tan(hFov / 2);
      const distD = (GRID_D * 0.5 + MAX_H) / Math.tan(vFov / 2);
      camDist = Math.max(distW, distD) * 0.92;
      camera.updateProjectionMatrix();
    }

    /* ---- pointer (window-level so the wrapping <a> doesn't block it) ---- */
    const ndc = new THREE.Vector2(-2, -2);
    let inside = false;
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3(1e3, 0, 1e3);
    const parallax = { x: 0, y: 0, tx: 0, ty: 0 };

    function onMove(e: PointerEvent) {
      const r = canvas!.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      parallax.tx = ndc.x;
      parallax.ty = ndc.y;
      inside = true;
    }
    function onLeave() {
      inside = false;
      parallax.tx = 0;
      parallax.ty = 0;
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("blur", onLeave);
    canvas.addEventListener("pointerleave", onLeave);

    /* ---- size ---- */
    let W = 1;
    let H = 1;
    function resize() {
      W = canvas!.clientWidth || window.innerWidth;
      H = canvas!.clientHeight || window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(W, H, false);
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      fitCamera(W, H);
      if (composer) composer.setSize(W, H);
    }

    /* ---- post: bloom (defensive — fall back to direct render) ---- */
    let composer: EffectComposer | null = null;
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.4, 0.62));
      composer.addPass(new OutputPass());
    } catch (err) {
      console.warn("[contrib-grid] bloom unavailable, rendering direct", err);
      composer = null;
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    /* ---- animation (cursor-driven only) ---- */
    const start = performance.now();
    let last = start;
    let raf = 0;
    const pv = new THREE.Vector3();
    const cands: number[] = [];

    function frame(now: number) {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // intro reveal: tiles rise into place + camera eases in
      const reveal = Math.min(1, t / 1.6);
      const revEase = 1 - Math.pow(1 - reveal, 3);

      // smooth parallax
      parallax.x += (parallax.tx - parallax.x) * Math.min(1, dt * 3);
      parallax.y += (parallax.ty - parallax.y) * Math.min(1, dt * 3);

      // camera: tilted table, gentle mouse parallax
      const az = parallax.x * 0.12;
      const el = ELEV + parallax.y * 0.05;
      const introPull = 1 + (1 - revEase) * 0.18;
      camera.position.set(
        Math.sin(az) * Math.cos(el) * camDist * introPull,
        Math.sin(el) * camDist * introPull,
        Math.cos(az) * Math.cos(el) * camDist * introPull
      );
      camera.lookAt(target);

      // cursor → grid-plane hit
      let hx = 1e3;
      let hz = 1e3;
      if (inside) {
        ray.setFromCamera(ndc, camera);
        if (ray.ray.intersectPlane(plane, hit)) {
          hx = hit.x;
          hz = hit.z;
        }
      }

      const hoverEase = Math.min(1, dt * 3.2); // "slowly" rise/fall under cursor
      cands.length = 0;

      for (let i = 0; i < N; i++) {
        // cursor proximity
        let infl = 0;
        if (inside) {
          const dx = cellX[i] - hx;
          const dz = cellZ[i] - hz;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < HOVER_R) {
            const s = 1 - d / HOVER_R;
            infl = s * s * (3 - 2 * s); // smoothstep
          }
        }
        hover[i] += (infl - hover[i]) * hoverEase;

        // height: base (by activity) + hover, eased toward target
        const targetH = (baseH[i] + hover[i] * HOVER_H) * revEase + 0.02;
        curH[i] += (targetH - curH[i]) * Math.min(1, dt * 12);
        const hgt = Math.max(0.02, curH[i]);

        dummy.position.set(cellX[i], hgt / 2, cellZ[i]);
        dummy.scale.set(1, hgt, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        // color: greener under the cursor
        mesh.setColorAt(i, heatColor(levels[i] + hover[i] * 0.8, tmp));

        // a green (real-activity) square that's strongly hovered → annotate it
        if (hover[i] > HINT_SHOW && levels[i] > 0.18) cands.push(i);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

      // ---- hint annotations ----
      // release faded slots
      for (let s = 0; s < MAX_HINTS; s++) {
        if (slots[s] >= 0 && hover[slots[s]] < HINT_HIDE) slots[s] = -1;
      }
      // re-project held slots + recompute their label boxes
      for (let s = 0; s < MAX_HINTS; s++) {
        const ti = slots[s];
        if (ti < 0) continue;
        pv.set(cellX[ti], curH[ti] + 0.05, cellZ[ti]).project(camera);
        const sx = (pv.x * 0.5 + 0.5) * W;
        const sy = (1 - (pv.y * 0.5 + 0.5)) * H;
        const m = labelMetrics(ti, sx, sy);
        slotSX[s] = sx; slotSY[s] = sy; slotLX[s] = m.lx; slotLY[s] = m.ly;
        boxL[s] = m.l; boxR[s] = m.r; boxT[s] = m.t; boxB[s] = m.b;
      }
      // fill empty slots from strongest candidates whose labels don't collide
      cands.sort((a, b) => hover[b] - hover[a]);
      for (let ci = 0; ci < cands.length; ci++) {
        const ti = cands[ci];
        if (slots.indexOf(ti) >= 0) continue;
        let empty = -1;
        for (let s = 0; s < MAX_HINTS; s++) if (slots[s] < 0) { empty = s; break; }
        if (empty < 0) break;
        pv.set(cellX[ti], curH[ti] + 0.05, cellZ[ti]).project(camera);
        if (pv.z > 1) continue;
        const sx = (pv.x * 0.5 + 0.5) * W;
        const sy = (1 - (pv.y * 0.5 + 0.5)) * H;
        const m = labelMetrics(ti, sx, sy);
        if (m.t < 6) continue; // would clip the top edge
        let ok = true;
        for (let s = 0; s < MAX_HINTS; s++) {
          if (slots[s] < 0) continue;
          if (boxesOverlap(s, m.l, m.r, m.t, m.b)) { ok = false; break; }
        }
        if (!ok) continue;
        slots[empty] = ti;
        slotSX[empty] = sx; slotSY[empty] = sy; slotLX[empty] = m.lx; slotLY[empty] = m.ly;
        boxL[empty] = m.l; boxR[empty] = m.r; boxT[empty] = m.t; boxB[empty] = m.b;
      }
      // render slots
      for (let s = 0; s < MAX_HINTS; s++) {
        const ti = slots[s];
        const ln = lineEls[s];
        const dot = dotEls[s];
        const lab = labelEls[s];
        if (ti < 0) {
          if (lab.style.opacity !== "0") { lab.style.opacity = "0"; ln.style.opacity = "0"; dot.style.opacity = "0"; }
          continue;
        }
        if (slotPrev[s] !== ti) {
          lab.textContent = msgOf[ti];
          slotPrev[s] = ti;
        }
        lab.style.transform = `translate(${slotLX[s]}px, ${slotLY[s]}px) translate(-50%, -100%)`;
        ln.setAttribute("x1", String(slotSX[s]));
        ln.setAttribute("y1", String(slotSY[s]));
        ln.setAttribute("x2", String(slotLX[s]));
        ln.setAttribute("y2", String(slotLY[s]));
        dot.setAttribute("cx", String(slotSX[s]));
        dot.setAttribute("cy", String(slotSY[s]));
        const op = Math.max(0, Math.min(1, (hover[ti] - HINT_HIDE) / (HINT_SHOW - HINT_HIDE)));
        lab.style.opacity = String(op);
        ln.style.opacity = String(op * 0.9);
        dot.style.opacity = String(op);
      }

      if (composer) composer.render();
      else renderer.render(scene, camera);

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function onVis() {
      if (document.hidden) cancelAnimationFrame(raf);
      else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("blur", onLeave);
      canvas.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
      composer?.dispose();
      geo.dispose();
      mat.dispose();
      (ground.geometry as THREE.BufferGeometry).dispose();
      (ground.material as THREE.Material).dispose();
      mesh.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="lp-stage">
      <canvas ref={canvasRef} className={className} aria-hidden="true" />
      <div ref={overlayRef} className="lp-hints" aria-hidden="true" />
    </div>
  );
}
