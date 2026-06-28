"use client";

/* ============================================================
   auto·qa landing — 3D git-contribution table (three.js)
   A slightly-tilted "table" of the GitHub contribution grid.
   Each green square is a 3D tile extruded upward by activity:
   the greener (busier) the cell, the higher it rises. New
   commits pop up with a bounce + flash; tiles under the cursor
   slowly rise a little more and grow greener. Soft shadows sell
   the raised-above-the-plane look; bloom makes the greens glow.
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
const POP_H = 0.55; // extra height at the peak of a commit pop
const HOVER_H = 0.34; // extra height under the cursor
const HOVER_R = 1.25; // cursor influence radius (world units)

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
    // light fog only at the far edge for depth (kept well beyond the tiles)
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
    const popStart = new Float32Array(N).fill(-99);
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const i = c * ROWS + r;
        cellX[i] = (c - (COLS - 1) / 2) * PITCH;
        cellZ[i] = (r - (ROWS - 1) / 2) * PITCH;
        baseH[i] = 0.07 + Math.pow(levels[i], 1.25) * MAX_H;
        curH[i] = 0.07; // start flat, rise in on the intro
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
      const h = Math.max(0, Math.min(1.25, heat));
      if (h < 0.25) out.copy(cEmpty).lerp(cG1, h / 0.25);
      else if (h < 0.5) out.copy(cG1).lerp(cG2, (h - 0.25) / 0.25);
      else if (h < 0.75) out.copy(cG2).lerp(cG3, (h - 0.5) / 0.25);
      else out.copy(cG3).lerp(cG4, Math.min(1, (h - 0.75) / 0.35));
      if (h > 1) out.lerp(new THREE.Color(0xb8ffce), (h - 1) * 1.4); // flash on pops
      return out;
    }

    const dummy = new THREE.Object3D();
    // seed colors so instanceColor exists before first compile (enables USE_INSTANCING_COLOR)
    for (let i = 0; i < N; i++) mesh.setColorAt(i, heatColor(levels[i], tmp));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    /* ---- camera framing: fit the wide panel, viewed at a tilt ---- */
    const ELEV = 0.7; // ~40° elevation → "slightly horizontal" table view
    function fitCamera(w: number, h: number) {
      const aspect = w / h;
      camera.aspect = aspect;
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      const distW = (GRID_W * 0.5 + 0.25) / Math.tan(hFov / 2);
      const distD = (GRID_D * 0.5 + MAX_H) / Math.tan(vFov / 2);
      const dist = Math.max(distW, distD) * 0.92;
      camDist = dist;
      camera.updateProjectionMatrix();
    }
    let camDist = 14;

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
      fitCamera(W, H);
      if (composer) composer.setSize(W, H);
    }

    /* ---- post: bloom (defensive — fall back to direct render) ---- */
    let composer: EffectComposer | null = null;
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.4, 0.62);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    } catch (err) {
      console.warn("[contrib-grid] bloom unavailable, rendering direct", err);
      composer = null;
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    /* ---- animation ---- */
    const start = performance.now();
    let last = start;
    let nextPop = 0.4;
    let raf = 0;
    const wakeColor = new THREE.Color();

    function spawnPop(t: number) {
      // weight toward busier cells (commits cluster in active areas)
      let best = -1;
      let bestW = -1;
      for (let k = 0; k < 5; k++) {
        const i = (Math.random() * N) | 0;
        const w = (0.18 + levels[i]) * Math.random();
        if (w > bestW) {
          bestW = w;
          best = i;
        }
      }
      if (best >= 0) popStart[best] = t;
    }

    function frame(now: number) {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // intro reveal: tiles rise into place + camera eases in
      const reveal = Math.min(1, t / 1.6);
      const revEase = 1 - Math.pow(1 - reveal, 3);

      // commit pops
      while (t > nextPop) {
        spawnPop(nextPop);
        nextPop += 0.22 + Math.random() * 0.5;
      }

      // smooth parallax
      parallax.x += (parallax.tx - parallax.x) * Math.min(1, dt * 3);
      parallax.y += (parallax.ty - parallax.y) * Math.min(1, dt * 3);

      // camera: tilted table, gentle mouse parallax
      const az = parallax.x * 0.16;
      const el = ELEV + parallax.y * 0.06;
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
      const heatTmp = tmp;

      for (let i = 0; i < N; i++) {
        // commit pop bump (rise fast, settle)
        const age = t - popStart[i];
        let pop = 0;
        if (age >= 0 && age < 2) pop = age < 0.16 ? age / 0.16 : Math.exp(-(age - 0.16) * 2.7);

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

        // height: base (by activity) + pop + hover, eased toward target
        const targetH = (baseH[i] + pop * POP_H + hover[i] * HOVER_H) * revEase + 0.02;
        curH[i] += (targetH - curH[i]) * Math.min(1, dt * 12);
        const hgt = Math.max(0.02, curH[i]);

        dummy.position.set(cellX[i], hgt / 2, cellZ[i]);
        dummy.scale.set(1, hgt, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        // color: greener with activity + pop flash + hover
        const heat = levels[i] + pop * 0.95 + hover[i] * 0.6;
        mesh.setColorAt(i, heatColor(heat, heatTmp));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

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
      composer?.dispose();
      geo.dispose();
      mat.dispose();
      (ground.geometry as THREE.BufferGeometry).dispose();
      (ground.material as THREE.Material).dispose();
      mesh.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
