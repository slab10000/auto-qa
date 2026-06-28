"use client";

/* ============================================================
   auto·qa landing — living git-contribution shader
   A single full-viewport WebGL2 fragment shader: a procedural,
   dense GitHub-style contribution grid that breathes, pops new
   commits, carries digital noise, and glitches under the cursor.
   The React side owns the plumbing; the art lives in FRAG.
   ============================================================ */

import { useEffect, useRef } from "react";

/* Fullscreen triangle — no vertex buffer; positions come from gl_VertexID. */
const VERT = `#version 300 es
precision highp float;
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/* -------------------------------------------------------------------------
   FRAG — placeholder that already realizes the concept so the harness can be
   verified end-to-end. Replaced by the workflow-synthesized shader.
   Uniform contract (do not change): uRes, uTime, uMouse, uHover, uReveal.
   ------------------------------------------------------------------------- */
const FRAG = `#version 300 es
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;
uniform float uHover;
uniform float uReveal;
out vec4 fragColor;

float hash11(float p){ p=fract(p*0.1031); p*=p+33.33; p*=p+p; return fract(p); }
float hash21(vec2 p){ vec3 q=fract(vec3(p.xyx)*0.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }

// contribution level 0..1 for a cell coordinate
float level(vec2 c){
  float n = hash21(c*1.7);
  float wk = hash21(vec2(c.x*0.3, 7.0));          // per-week density
  float seasonal = 0.5 + 0.5*sin(c.x*0.18);
  float v = n * mix(0.3, 1.0, wk) * mix(0.55,1.0,seasonal);
  v = pow(v, 1.7);
  return step(0.18, v) * v;                        // many empties, like real graphs
}

void main(){
  vec2 fragCoord = gl_FragCoord.xy;
  float aspect = uRes.x / uRes.y;
  vec2 uv = fragCoord / uRes;                       // 0..1, y up

  // mouse in uv space, glitch envelope
  vec2 m = uMouse / uRes;
  float md = distance(vec2((uv.x-m.x)*aspect, uv.y-m.y), vec2(0.0));
  float glitch = uHover * smoothstep(0.26, 0.0, md);

  // slice displacement near cursor
  vec2 guv = uv;
  float row = floor(uv.y * 90.0);
  float jitter = (hash21(vec2(row, floor(uTime*12.0))) - 0.5);
  guv.x += jitter * 0.05 * glitch;

  // grid space
  float COLS = 52.0;
  vec2 gp = guv - 0.5;
  gp.x *= aspect;
  float scale = COLS;
  vec2 cell = floor(gp * scale);
  vec2 f = fract(gp * scale);

  // dissolving organic edges
  vec2 ext = vec2(0.92*aspect, 0.62);
  float edge = max(abs(gp.x)/ext.x, abs(gp.y)/ext.y);
  float diss = smoothstep(1.05, 0.55, edge + 0.25*hash21(cell*0.7));

  float lv = level(cell) * diss;

  // commit pops — a few cells flaring on expanding rings
  float pop = 0.0;
  for (int i = 0; i < 6; i++){
    float fi = float(i);
    float t = uTime*0.5 + fi*1.7;
    float seed = floor(t);
    vec2 pc = floor(vec2(hash11(seed+fi*13.1)*COLS - COLS*0.5*0.0, 0.0));
    vec2 pcell = floor(vec2((hash11(seed*2.1+fi)*2.0-1.0)*ext.x*scale, (hash11(seed*3.3+fi)*2.0-1.0)*ext.y*scale));
    float age = fract(t);
    if (pcell == cell) pop += (1.0-age)*smoothstep(0.0,0.15,age);
  }

  // rounded cell mask with gap
  vec2 q = abs(f - 0.5);
  float d = max(q.x, q.y);
  float cellMask = smoothstep(0.46, 0.40, d);

  // sweep
  float sweep = smoothstep(0.0, 0.06, 0.5 + 0.5*sin(uTime*0.6 - uv.x*4.0)) * 0.10;

  float intensity = clamp(lv + pop*0.9 + sweep*lv*4.0, 0.0, 1.4);

  // GitHub-green ramp
  vec3 empty = vec3(0.086,0.106,0.133);
  vec3 g1 = vec3(0.055,0.267,0.161);
  vec3 g2 = vec3(0.0,0.427,0.196);
  vec3 g3 = vec3(0.149,0.651,0.255);
  vec3 g4 = vec3(0.224,0.827,0.325);
  vec3 col = empty;
  col = mix(col, g1, smoothstep(0.0,0.25,intensity));
  col = mix(col, g2, smoothstep(0.25,0.5,intensity));
  col = mix(col, g3, smoothstep(0.5,0.8,intensity));
  col = mix(col, g4, smoothstep(0.8,1.2,intensity));
  col += vec3(0.6,1.0,0.7)*max(0.0,intensity-1.0);   // bloom on pops

  col *= cellMask;

  // chromatic split under cursor
  col.r += glitch*0.4*hash21(cell+floor(uTime*20.0));
  col.b += glitch*0.3*hash21(cell+9.0);

  // digital noise
  float grain = hash21(fragCoord + floor(uTime*60.0));
  col += (grain-0.5)*0.05;
  col += (grain-0.5)*0.18*glitch;

  // background + vignette + indigo bloom
  vec3 bg = vec3(0.039,0.043,0.059);
  bg += vec3(0.486,0.514,1.0)*0.05*smoothstep(0.9,0.0,length(uv-vec2(0.5,0.65)));
  col = max(col, bg);
  col *= 1.0 - 0.5*smoothstep(0.4,1.2,length((uv-0.5)*vec2(aspect,1.0)));

  // intro reveal
  col *= smoothstep(0.0,1.0,uReveal) * (0.6+0.4*smoothstep(uv.x-0.2, uv.x+0.1, uReveal*1.3));

  fragColor = vec4(clamp(col,0.0,1.0), 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // Surface the exact GLSL error during development.
    console.error("[contrib-shader] compile failed:\n" + gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export default function ContribShader({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      canvas.setAttribute("data-webgl", "off");
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      canvas.setAttribute("data-webgl", "error");
      return;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("[contrib-shader] link failed:\n" + gl.getProgramInfoLog(prog));
      canvas.setAttribute("data-webgl", "error");
      return;
    }
    gl.useProgram(prog);

    // WebGL2 requires a bound VAO to draw, even with no attributes.
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uMouse = gl.getUniformLocation(prog, "uMouse");
    const uHover = gl.getUniformLocation(prog, "uHover");
    const uReveal = gl.getUniformLocation(prog, "uReveal");

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 1;
    let H = 1;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = canvas!.clientWidth || window.innerWidth;
      const ch = canvas!.clientHeight || window.innerHeight;
      W = Math.max(1, Math.round(cw * dpr));
      H = Math.max(1, Math.round(ch * dpr));
      canvas!.width = W;
      canvas!.height = H;
      gl!.viewport(0, 0, W, H);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // pointer state in fragCoord (bottom-left origin) device pixels; smoothed
    const mouse = { tx: -1e3, ty: -1e3, x: -1e3, y: -1e3 };
    const hover = { t: 0, v: 0 };

    function onMove(e: PointerEvent) {
      const r = canvas!.getBoundingClientRect();
      const px = (e.clientX - r.left) * dpr;
      const py = (r.height - (e.clientY - r.top)) * dpr; // flip Y
      mouse.tx = px;
      mouse.ty = py;
      hover.t = 1;
    }
    function onLeave() {
      hover.t = 0;
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    canvas.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);

    const start = performance.now();
    let raf = 0;
    let last = start;

    function frame(now: number) {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // smooth mouse + hover
      const k = 1 - Math.pow(0.001, dt); // frame-rate independent lerp
      mouse.x += (mouse.tx - mouse.x) * k;
      mouse.y += (mouse.ty - mouse.y) * k;
      hover.v += (hover.t - hover.v) * (1 - Math.pow(0.0005, dt));

      const reveal = Math.min(1, t / 1.9);

      gl!.uniform2f(uRes, W, H);
      gl!.uniform1f(uTime, t);
      gl!.uniform2f(uMouse, hover.v > 0.01 ? mouse.x : -1e3, hover.v > 0.01 ? mouse.y : -1e3);
      gl!.uniform1f(uHover, hover.v);
      gl!.uniform1f(uReveal, reveal);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function onVis() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
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
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
