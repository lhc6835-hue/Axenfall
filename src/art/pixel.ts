// Procedural pixel-art toolkit: palette ramps with hue shifting, a shape painter
// with per-pixel lighting + dithering + selective outlines, and canvas helpers.

export type RGB = [number, number, number];

export function hexToRgb(hex: number): RGB {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}
export function rgbToHex([r, g, b]: RGB): number {
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
export function css(hex: number, a = 1): string {
  const [r, g, b] = hexToRgb(hex);
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h * 360, s, l];
}
function hslToRgb(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360 / 360;
  s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** Hue-shifted 5-step ramp: [outline, shadow, base, light, highlight]. */
export function ramp(base: number): number[] {
  const [h, s, l] = rgbToHsl(hexToRgb(base));
  const toward = (target: number, amt: number) => {
    let d = ((target - h + 540) % 360) - 180;
    return h + d * amt;
  };
  return [
    rgbToHex(hslToRgb(toward(250, 0.35), Math.min(1, s * 0.9 + 0.1), l * 0.28)),
    rgbToHex(hslToRgb(toward(250, 0.18), Math.min(1, s * 1.05), l * 0.62)),
    base,
    rgbToHex(hslToRgb(toward(60, 0.12), s * 0.95, Math.min(0.92, l + (1 - l) * 0.35))),
    rgbToHex(hslToRgb(toward(60, 0.2), s * 0.7, Math.min(0.97, l + (1 - l) * 0.68))),
  ];
}

export function mix(a: number, b: number, t: number): number {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export function bayer(x: number, y: number): number {
  return BAYER4[(y & 3) * 4 + (x & 3)];
}

// ---------------------------------------------------------------- shape painter

export type Shape =
  | { k: 'ell'; x: number; y: number; rx: number; ry: number; c: number; z?: number; flat?: boolean; rot?: number }
  | { k: 'rect'; x: number; y: number; w: number; h: number; c: number; z?: number; r?: number; flat?: boolean }
  | { k: 'cap'; x1: number; y1: number; x2: number; y2: number; r: number; c: number; z?: number; r2?: number }
  | { k: 'tri'; pts: [number, number, number, number, number, number]; c: number; z?: number; flat?: boolean };

interface Hit { nx: number; ny: number; nz: number }

function hitShape(s: Shape, px: number, py: number): Hit | null {
  switch (s.k) {
    case 'ell': {
      let dx = px - s.x, dy = py - s.y;
      if (s.rot) {
        const c = Math.cos(-s.rot), si = Math.sin(-s.rot);
        const tx = dx * c - dy * si; dy = dx * si + dy * c; dx = tx;
      }
      const ux = dx / s.rx, uy = dy / s.ry;
      const d = ux * ux + uy * uy;
      if (d > 1) return null;
      return { nx: ux, ny: uy, nz: Math.sqrt(1 - d) };
    }
    case 'rect': {
      const r = s.r ?? 0;
      const lx = px - s.x, ly = py - s.y;
      if (lx < 0 || ly < 0 || lx >= s.w || ly >= s.h) return null;
      if (r > 0) {
        const cx = lx < r ? r - lx : lx > s.w - 1 - r ? lx - (s.w - 1 - r) : 0;
        const cy = ly < r ? r - ly : ly > s.h - 1 - r ? ly - (s.h - 1 - r) : 0;
        if (cx * cx + cy * cy > r * r + 0.5) return null;
      }
      const ux = (lx / (s.w - 1)) * 2 - 1, uy = (ly / (s.h - 1)) * 2 - 1;
      const ex = Math.pow(Math.abs(ux), 6) * Math.sign(ux), ey = Math.pow(Math.abs(uy), 6) * Math.sign(uy);
      return { nx: ex * 0.8, ny: ey * 0.8 - 0.15, nz: 0.7 };
    }
    case 'cap': {
      const vx = s.x2 - s.x1, vy = s.y2 - s.y1;
      const L = vx * vx + vy * vy || 1;
      let t = ((px - s.x1) * vx + (py - s.y1) * vy) / L;
      t = Math.max(0, Math.min(1, t));
      const r = s.r + ((s.r2 ?? s.r) - s.r) * t;
      const dx = px - (s.x1 + vx * t), dy = py - (s.y1 + vy * t);
      const d = (dx * dx + dy * dy) / (r * r);
      if (d > 1) return null;
      return { nx: dx / r, ny: dy / r, nz: Math.sqrt(Math.max(0, 1 - d)) };
    }
    case 'tri': {
      const [x1, y1, x2, y2, x3, y3] = s.pts;
      const d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
      const a = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / d;
      const b = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / d;
      const c = 1 - a - b;
      if (a < 0 || b < 0 || c < 0) return null;
      const m = Math.min(a, b, c);
      return { nx: 0, ny: -0.3, nz: 0.4 + Math.min(0.6, m * 3) };
    }
  }
}

export interface PaintOpts {
  outline?: number | 'auto' | null; // outer outline color
  light?: [number, number, number];
  selout?: boolean; // darken edges between overlapping shapes
  dither?: boolean;
  steps?: number; // tones used from ramp (3 or 4)
  flat?: boolean; // single flat colour per shape, no lighting
}

/** Paints lit shapes into ImageData at (ox,oy) on ctx. Shapes later in the array draw on top (or by z). */
export function paintShapes(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, shapes: Shape[], opts: PaintOpts = {}) {
  const L = opts.light ?? [-0.55, -0.7, 0.55];
  const ll = Math.hypot(L[0], L[1], L[2]);
  const lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
  const sorted = shapes.map((s, i) => ({ s, i, z: s.z ?? 0 })).sort((a, b) => a.z - b.z || a.i - b.i);
  const owner = new Int16Array(w * h).fill(-1);
  const col = new Int32Array(w * h).fill(-1);
  const ramps = new Map<number, number[]>();
  const getRamp = (c: number) => { let r = ramps.get(c); if (!r) { r = ramp(c); ramps.set(c, r); } return r; };
  const dith = opts.dither !== false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let k = sorted.length - 1; k >= 0; k--) {
        const s = sorted[k].s;
        const hit = hitShape(s, x + 0.5, y + 0.5);
        if (!hit) continue;
        const rp = getRamp(s.c);
        let tone: number;
        if (opts.flat || (s as { flat?: boolean }).flat) tone = 2;
        else {
          let I = hit.nx * lx + hit.ny * ly + hit.nz * lz; // -1..1
          I = I * 0.5 + 0.5;
          const t = dith ? I * 3.2 + (bayer(x + ox, y + oy) - 0.5) * 0.55 : I * 3.2;
          tone = Math.max(1, Math.min(4, Math.floor(t) + 1));
          if (tone === 4 && I < 0.9) tone = 3;
        }
        col[y * w + x] = opts.flat ? s.c : rp[tone];
        owner[y * w + x] = sorted[k].i;
        break;
      }
    }
  }
  // selective inner outline: pixel whose up/left neighbor belongs to a shape drawn above it
  if (opts.selout !== false) {
    const zOf = (i: number) => shapes[i].z ?? 0;
    const copy = col.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const o = owner[y * w + x];
      if (o < 0) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of nb) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const o2 = owner[yy * w + xx];
        if (o2 >= 0 && o2 !== o && (zOf(o2) > zOf(o) || (zOf(o2) === zOf(o) && o2 > o)) && shapes[o2].c !== shapes[o].c) {
          copy[y * w + x] = getRamp(shapes[o].c)[0];
          break;
        }
      }
    }
    col.set(copy);
  }
  const img = ctx.getImageData(ox, oy, w, h);
  const d = img.data;
  const outlineMode = opts.outline === undefined ? 'auto' : opts.outline;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let c = col[i];
    if (c < 0 && outlineMode !== null) {
      let near = -1;
      if (x > 0 && owner[i - 1] >= 0) near = owner[i - 1];
      else if (x < w - 1 && owner[i + 1] >= 0) near = owner[i + 1];
      else if (y > 0 && owner[i - w] >= 0) near = owner[i - w];
      else if (y < h - 1 && owner[i + w] >= 0) near = owner[i + w];
      if (near >= 0) c = outlineMode === 'auto' ? mix(getRamp(shapes[near].c)[0], 0x0b0714, 0.55) : outlineMode;
    }
    if (c < 0) continue;
    const [r, g, b] = hexToRgb(c);
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, ox, oy);
}

// ---------------------------------------------------------------- canvas helpers

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export function px(ctx: CanvasRenderingContext2D, x: number, y: number, c: number, w = 1, h = 1, a = 1) {
  ctx.fillStyle = css(c, a);
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** Registers a canvas as a texture; if frames given, slices it horizontally into frames 0..n-1. */
export function addTex(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, frameW?: number, frameH?: number) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, canvas)!;
  if (frameW && frameH) {
    const cols = Math.floor(canvas.width / frameW), rows = Math.floor(canvas.height / frameH);
    let n = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tex.add(n++, 0, c * frameW, r * frameH, frameW, frameH);
  }
  return tex;
}

/** Deterministic PRNG so generated art is stable between runs. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Draws a filled circle of pixels (no AA). */
export function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: number, a = 1) {
  ctx.fillStyle = css(c, a);
  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) {
    const hw = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
    ctx.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1);
  }
}
