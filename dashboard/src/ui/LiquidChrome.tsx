// A liquid field, after reactbits' Liquid Chrome: layered cosine warps of the plane, shaded by
// 1/|sin|, but instead of silver the light runs up one ramp (deep forest, forest, pine, the hot
// colour, cream), rippling where the pointer touches. Plain WebGL, no library.
// Pauses off-screen and when the tab is hidden; under reduced motion it paints one still frame.
import { useEffect, useRef } from "react";

const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `precision highp float;
uniform float uTime; uniform vec2 uRes; uniform vec3 uBase; uniform float uDepth; uniform float uAmp; uniform vec2 uFreq; uniform vec2 uMouse;
varying vec2 vUv;
const vec3 DEEP = vec3(.039, .110, .075);
const vec3 FOREST = vec3(.059, .165, .114);
const vec3 PINE = vec3(.184, .365, .247);
const vec3 CREAM = vec3(.953, .933, .875);
vec3 ramp(float t){
  if (t < .18) return mix(DEEP, FOREST, t / .18);
  if (t < .38) return mix(FOREST, PINE, (t - .18) / .2);
  if (t < .62) return mix(PINE, uBase, (t - .38) / .24);
  return mix(uBase, CREAM, (t - .62) / .38);
}
void main(){
  vec2 uv = (2. * vUv * uRes - uRes) / min(uRes.x, uRes.y);
  for (float i = 1.; i < 10.; i++) {
    uv.x += uAmp / i * cos(i * uFreq.x * uv.y + uTime + uMouse.x * 3.14159);
    uv.y += uAmp / i * cos(i * uFreq.y * uv.x + uTime + uMouse.y * 3.14159);
  }
  vec2 d = vUv - uMouse; float dist = length(d);
  uv += (d / (dist + .0001)) * sin(10. * dist - uTime * 2.) * .03 * exp(-dist * 20.);
  // Brighter towards the bottom, darker under the title area at the top.
  float sky = .75 + .5 * (1. - vUv.y);
  float v = uDepth * sky / abs(sin(uTime - uv.y - uv.x));
  gl_FragColor = vec4(ramp(clamp(v, 0., 1.)), 1.);
}`;

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

interface Props {
  /** The hot colour: what the light turns to just before it goes cream. */
  color: string;
  /** How bright the field is (0.06 mostly dark, 0.16 mostly lit). */
  depth?: number;
  speed?: number;
  amplitude?: number;
  className?: string;
}

export function LiquidChrome({ color, depth = 0.11, speed = 0.22, amplitude = 0.42, className = "" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // r, g, b of the hot colour, then the depth: all four ease together.
  const base = useRef<number[]>([0, 0, 0, 0]);

  useEffect(() => {
    base.current = [...rgb(color), depth];
  }, [color, depth]);

  useEffect(() => {
    const c = ref.current;
    const gl = c?.getContext("webgl", { antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!c || !gl) return;
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uTime = u("uTime"), uRes = u("uRes"), uBase = u("uBase"), uDepth = u("uDepth"), uAmp = u("uAmp"), uFreq = u("uFreq"), uMouse = u("uMouse");
    gl.uniform1f(uAmp, amplitude);
    gl.uniform2f(uFreq, 3, 2);

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const cur = [...base.current];
    let raf = 0, visible = true, t0 = performance.now();

    const size = () => {
      // Half resolution: the field is soft by nature and this keeps phones cool.
      const s = Math.min(1, (window.devicePixelRatio || 1)) * 0.5;
      c.width = Math.max(1, Math.round(c.clientWidth * s));
      c.height = Math.max(1, Math.round(c.clientHeight * s));
      gl.viewport(0, 0, c.width, c.height);
      gl.uniform2f(uRes, c.width, c.height);
    };
    const frame = (now: number) => {
      // Ease towards the target ink so a page change pours rather than cuts.
      for (let i = 0; i < 4; i++) cur[i] += (base.current[i] - cur[i]) * 0.06;
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      gl.uniform1f(uTime, ((now - t0) / 1000) * speed);
      gl.uniform3f(uBase, cur[0], cur[1], cur[2]);
      gl.uniform1f(uDepth, cur[3]);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced && visible && !document.hidden) raf = requestAnimationFrame(frame);
      else raf = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const onMove = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width;
      mouse.ty = 1 - (e.clientY - r.top) / r.height;
    };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); });
    const ro = new ResizeObserver(() => { size(); if (reduced) { t0 = performance.now() - 4000; frame(performance.now()); } });
    io.observe(c);
    ro.observe(c);
    size();
    if (reduced) { for (let i = 0; i < 4; i++) cur[i] = base.current[i]; t0 = performance.now() - 4000; frame(performance.now()); }
    else kick();
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", kick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", kick);
      // Free what this mount made, but keep the context: a remount (React's dev double-mount, or a
      // fast page change) gets the same context back from the canvas, and a lost one paints nothing.
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
    };
  }, [speed, amplitude]);

  return <canvas ref={ref} aria-hidden className={`block h-full w-full ${className}`} />;
}
