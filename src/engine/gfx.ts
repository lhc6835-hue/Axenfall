// A tiny software pixel renderer.
// Two buffers: `col` holds opaque pixel colours, `L` holds additive light (glow).
// Everything is drawn at 1px = 1 game unit and scaled up with nearest-neighbour.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export class Gfx {
  w = 0;
  h = 0;
  col!: Uint32Array;
  L!: Float32Array;
  vig!: Float32Array;
  out!: ImageData;
  o32!: Uint32Array;
  /** camera offset: screen = world + o */
  ox = 0;
  oy = 0;
  flash = 0;
  flashColor = 0xffffff;
  /** 0..1 red damage tint */
  hurt = 0;
  /** 0..1 desaturate (used by hit-stop) */
  mono = 0;
  vignette = 0.5;

  constructor(w: number, h: number) {
    this.resize(w, h);
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.col = new Uint32Array(w * h);
    this.L = new Float32Array(w * h * 3);
    this.vig = new Float32Array(w * h);
    this.out = new ImageData(w, h);
    this.o32 = new Uint32Array(this.out.data.buffer);
    this.buildVignette();
  }

  buildVignette() {
    const { w, h } = this;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (x / w - 0.5) * 2, dy = (y / h - 0.5) * 2;
        const d = Math.min(1, Math.sqrt(dx * dx * 0.8 + dy * dy * 1.1) / 1.35);
        this.vig[y * w + x] = 1 - this.vignette * d * d * d;
      }
  }

  clear(c: number) {
    this.col.fill(c);
    this.L.fill(0);
  }

  // ---------- primitive pixel writes (screen space) ----------
  private put(ix: number, iy: number, c: number) {
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    this.col[iy * this.w + ix] = c;
  }
  private putA(ix: number, iy: number, c: number, a: number) {
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    if (a >= 1 || a > BAYER[((iy & 3) << 2) | (ix & 3)]) this.col[iy * this.w + ix] = c;
  }
  private putBlend(ix: number, iy: number, c: number, a: number) {
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const i = iy * this.w + ix, o = this.col[i];
    const r = (o >> 16) & 255, g = (o >> 8) & 255, b = o & 255;
    const r2 = (c >> 16) & 255, g2 = (c >> 8) & 255, b2 = c & 255;
    this.col[i] = ((r + (r2 - r) * a) << 16) | ((g + (g2 - g) * a) << 8) | (b + (b2 - b) * a);
  }

  // ---------- world-space API ----------
  px(x: number, y: number, c: number, a = 1) {
    this.putA(Math.floor(x + this.ox), Math.floor(y + this.oy), c, a);
  }
  blend(x: number, y: number, c: number, a: number) {
    this.putBlend(Math.floor(x + this.ox), Math.floor(y + this.oy), c, a);
  }

  rect(x: number, y: number, w: number, h: number, c: number, a = 1) {
    const x0 = Math.max(0, Math.round(x + this.ox)), y0 = Math.max(0, Math.round(y + this.oy));
    const x1 = Math.min(this.w, Math.round(x + w + this.ox)), y1 = Math.min(this.h, Math.round(y + h + this.oy));
    if (a >= 1) {
      for (let iy = y0; iy < y1; iy++) this.col.fill(c, iy * this.w + x0, iy * this.w + Math.max(x0, x1));
    } else for (let iy = y0; iy < y1; iy++) for (let ix = x0; ix < x1; ix++) this.putA(ix, iy, c, a);
  }

  /** truly translucent rect */
  rectBlend(x: number, y: number, w: number, h: number, c: number, a: number) {
    const x0 = Math.max(0, Math.round(x + this.ox)), y0 = Math.max(0, Math.round(y + this.oy));
    const x1 = Math.min(this.w, Math.round(x + w + this.ox)), y1 = Math.min(this.h, Math.round(y + h + this.oy));
    for (let iy = y0; iy < y1; iy++) for (let ix = x0; ix < x1; ix++) this.putBlend(ix, iy, c, a);
  }

  /**
   * A rectangle given in a rotated local frame: pivot (cx,cy), angle ang,
   * local rect (lx,ly,lw,lh), x along the angle. `fy` mirrors local y.
   */
  quad(cx: number, cy: number, ang: number, lx: number, ly: number, lw: number, lh: number, c: number, a = 1, fy = 1, blend = false) {
    if (fy < 0) ly = -(ly + lh);
    const cs = Math.cos(ang), sn = Math.sin(ang);
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (let k = 0; k < 4; k++) {
      const u = k & 1 ? lx + lw : lx, v = k & 2 ? ly + lh : ly;
      const wx = cx + u * cs - v * sn, wy = cy + u * sn + v * cs;
      if (wx < minx) minx = wx;
      if (wx > maxx) maxx = wx;
      if (wy < miny) miny = wy;
      if (wy > maxy) maxy = wy;
    }
    const x0 = Math.max(0, Math.floor(minx + this.ox)), x1 = Math.min(this.w - 1, Math.ceil(maxx + this.ox));
    const y0 = Math.max(0, Math.floor(miny + this.oy)), y1 = Math.min(this.h - 1, Math.ceil(maxy + this.oy));
    const ex = lx + lw, ey = ly + lh;
    for (let iy = y0; iy <= y1; iy++) {
      const wy = iy + 0.5 - this.oy - cy;
      for (let ix = x0; ix <= x1; ix++) {
        const wx = ix + 0.5 - this.ox - cx;
        const u = wx * cs + wy * sn, v = -wx * sn + wy * cs;
        if (u >= lx && u < ex && v >= ly && v < ey) {
          if (blend) this.putBlend(ix, iy, c, a);
          else this.putA(ix, iy, c, a);
        }
      }
    }
  }

  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: number, a = 1, blend = false) {
    const o = this.ox, p = this.oy;
    ax += o; bx += o; cx += o; ay += p; by += p; cy += p;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(this.w - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(this.h - 1, Math.ceil(Math.max(ay, by, cy)));
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 0.01) return;
    const s = area > 0 ? 1 : -1;
    for (let iy = y0; iy <= y1; iy++) {
      const py = iy + 0.5;
      for (let ix = x0; ix <= x1; ix++) {
        const px = ix + 0.5;
        const w0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) * s;
        const w1 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) * s;
        const w2 = ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) * s;
        if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
          if (blend) this.putBlend(ix, iy, c, a);
          else this.putA(ix, iy, c, a);
        }
      }
    }
  }

  poly(pts: number[], c: number, a = 1, blend = false) {
    for (let i = 2; i + 3 < pts.length; i += 2) this.tri(pts[0], pts[1], pts[i], pts[i + 1], pts[i + 2], pts[i + 3], c, a, blend);
  }

  disc(x: number, y: number, r: number, c: number, a = 1, blend = false) {
    const cx = x + this.ox, cy = y + this.oy;
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let iy = y0; iy <= y1; iy++) {
      const dy = iy + 0.5 - cy;
      const hw = r2 - dy * dy;
      if (hw < 0) continue;
      const s = Math.sqrt(hw);
      const xa = Math.max(0, Math.ceil(cx - s - 0.5)), xb = Math.min(this.w - 1, Math.floor(cx + s - 0.5));
      for (let ix = xa; ix <= xb; ix++) {
        if (blend) this.putBlend(ix, iy, c, a);
        else this.putA(ix, iy, c, a);
      }
    }
  }

  ellipse(x: number, y: number, rx: number, ry: number, c: number, a = 1, blend = false) {
    const cx = x + this.ox, cy = y + this.oy;
    const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(this.h - 1, Math.ceil(cy + ry));
    for (let iy = y0; iy <= y1; iy++) {
      const dy = (iy + 0.5 - cy) / ry;
      const q = 1 - dy * dy;
      if (q < 0) continue;
      const s = Math.sqrt(q) * rx;
      const xa = Math.max(0, Math.ceil(cx - s - 0.5)), xb = Math.min(this.w - 1, Math.floor(cx + s - 0.5));
      for (let ix = xa; ix <= xb; ix++) {
        if (blend) this.putBlend(ix, iy, c, a);
        else this.putA(ix, iy, c, a);
      }
    }
  }

  ring(x: number, y: number, r: number, th: number, c: number, a = 1, sy = 1) {
    const cx = x + this.ox, cy = y + this.oy;
    const ro = r + th / 2, ri = Math.max(0, r - th / 2);
    const y0 = Math.max(0, Math.floor(cy - ro * sy)), y1 = Math.min(this.h - 1, Math.ceil(cy + ro * sy));
    const x0 = Math.max(0, Math.floor(cx - ro)), x1 = Math.min(this.w - 1, Math.ceil(cx + ro));
    for (let iy = y0; iy <= y1; iy++) {
      const dy = (iy + 0.5 - cy) / sy;
      for (let ix = x0; ix <= x1; ix++) {
        const dx = ix + 0.5 - cx;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= ro && d >= ri) this.putA(ix, iy, c, a);
      }
    }
  }

  /** band of a ring between angles a0..a1 (a0<a1), width w */
  arc(x: number, y: number, r: number, w: number, a0: number, a1: number, c: number, a = 1) {
    const steps = Math.max(4, Math.ceil(Math.abs(a1 - a0) * r * 0.9));
    for (let i = 0; i < steps; i++) {
      const t0 = a0 + ((a1 - a0) * i) / steps, t1 = a0 + ((a1 - a0) * (i + 1)) / steps;
      const ri = r - w / 2, ro = r + w / 2;
      const ax = x + Math.cos(t0) * ri, ay = y + Math.sin(t0) * ri;
      const bx = x + Math.cos(t0) * ro, by = y + Math.sin(t0) * ro;
      const cx = x + Math.cos(t1) * ro, cy = y + Math.sin(t1) * ro;
      const dx = x + Math.cos(t1) * ri, dy = y + Math.sin(t1) * ri;
      this.tri(ax, ay, bx, by, cx, cy, c, a);
      this.tri(ax, ay, cx, cy, dx, dy, c, a);
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: number, a = 1) {
    const dx = x1 - x0, dy = y1 - y0;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    for (let i = 0; i <= n; i++) this.px(x0 + (dx * i) / n, y0 + (dy * i) / n, c, a);
  }

  /** thick capsule line */
  beam(x0: number, y0: number, x1: number, y1: number, w: number, c: number, a = 1) {
    const r = w / 2;
    const o = this.ox, p = this.oy;
    const ax = x0 + o, ay = y0 + p, bx = x1 + o, by = y1 + p;
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
    const xa = Math.max(0, Math.floor(Math.min(ax, bx) - r)), xb = Math.min(this.w - 1, Math.ceil(Math.max(ax, bx) + r));
    const ya = Math.max(0, Math.floor(Math.min(ay, by) - r)), yb = Math.min(this.h - 1, Math.ceil(Math.max(ay, by) + r));
    for (let iy = ya; iy <= yb; iy++)
      for (let ix = xa; ix <= xb; ix++) {
        const px = ix + 0.5, py = iy + 0.5;
        let t = ((px - ax) * vx + (py - ay) * vy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + vx * t - px, qy = ay + vy * t - py;
        if (qx * qx + qy * qy <= r * r) this.putA(ix, iy, c, a);
      }
  }

  // ---------- light ----------
  glow(x: number, y: number, r: number, c: number, k: number) {
    if (k <= 0 || r <= 0) return;
    const cr = (((c >> 16) & 255) / 255) * k, cg = (((c >> 8) & 255) / 255) * k, cb = ((c & 255) / 255) * k;
    const cx = x + this.ox, cy = y + this.oy;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    const ir = 1 / r;
    const L = this.L, w = this.w;
    for (let iy = y0; iy <= y1; iy++) {
      const dy = (iy + 0.5 - cy) * ir;
      for (let ix = x0; ix <= x1; ix++) {
        const dx = (ix + 0.5 - cx) * ir;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        let f = 1 - Math.sqrt(d2);
        f *= f;
        const i = (iy * w + ix) * 3;
        L[i] += cr * f;
        L[i + 1] += cg * f;
        L[i + 2] += cb * f;
      }
    }
  }

  glowLine(x0: number, y0: number, x1: number, y1: number, r: number, c: number, k: number) {
    if (k <= 0) return;
    const cr = (((c >> 16) & 255) / 255) * k, cg = (((c >> 8) & 255) / 255) * k, cb = ((c & 255) / 255) * k;
    const o = this.ox, p = this.oy;
    const ax = x0 + o, ay = y0 + p, bx = x1 + o, by = y1 + p;
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1;
    const xa = Math.max(0, Math.floor(Math.min(ax, bx) - r)), xb = Math.min(this.w - 1, Math.ceil(Math.max(ax, bx) + r));
    const ya = Math.max(0, Math.floor(Math.min(ay, by) - r)), yb = Math.min(this.h - 1, Math.ceil(Math.max(ay, by) + r));
    const L = this.L, w = this.w;
    for (let iy = ya; iy <= yb; iy++)
      for (let ix = xa; ix <= xb; ix++) {
        const px = ix + 0.5, py = iy + 0.5;
        let t = ((px - ax) * vx + (py - ay) * vy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + vx * t - px, qy = ay + vy * t - py;
        const d = Math.sqrt(qx * qx + qy * qy) / r;
        if (d >= 1) continue;
        const f = (1 - d) * (1 - d);
        const i = (iy * w + ix) * 3;
        L[i] += cr * f;
        L[i + 1] += cg * f;
        L[i + 2] += cb * f;
      }
  }

  // ---------- output ----------
  present(ctx: CanvasRenderingContext2D) {
    const { col, L, vig, o32 } = this;
    const n = this.w * this.h;
    const fl = this.flash, fr = (this.flashColor >> 16) & 255, fg = (this.flashColor >> 8) & 255, fb = this.flashColor & 255;
    const hurt = this.hurt, mono = this.mono;
    for (let i = 0, j = 0; i < n; i++, j += 3) {
      const c = col[i];
      let r = ((c >> 16) & 255) + L[j] * 255;
      let g = ((c >> 8) & 255) + L[j + 1] * 255;
      let b = (c & 255) + L[j + 2] * 255;
      const v = vig[i];
      r *= v; g *= v; b *= v;
      if (mono > 0) {
        const l = r * 0.3 + g * 0.55 + b * 0.15;
        r += (l - r) * mono; g += (l - g) * mono; b += (l - b) * mono;
      }
      if (hurt > 0) {
        const ef = hurt * (1 - v + 0.15);
        r += (200 - r) * ef * 0.8; g *= 1 - ef * 0.6; b *= 1 - ef * 0.6;
      }
      if (fl > 0) {
        r += (fr - r) * fl; g += (fg - g) * fl; b += (fb - b) * fl;
      }
      // soft shoulder so bright light blooms toward white instead of clipping hard
      if (r > 255 || g > 255 || b > 255) {
        const over = (Math.max(r, g, b) - 255) * 0.35;
        r += over; g += over; b += over;
      }
      o32[i] = 0xff000000 | ((b > 255 ? 255 : b | 0) << 16) | ((g > 255 ? 255 : g | 0) << 8) | (r > 255 ? 255 : r | 0);
    }
    ctx.putImageData(this.out, 0, 0);
  }
}

/** Helper for drawing parts in a rotated, optionally mirrored local frame. */
export class Xf {
  constructor(
    public g: Gfx,
    public x: number,
    public y: number,
    public ang: number,
    public fy = 1,
  ) {}
  q(lx: number, ly: number, lw: number, lh: number, c: number, a = 1) {
    this.g.quad(this.x, this.y, this.ang, lx, ly, lw, lh, c, a, this.fy);
  }
  /** local point -> world */
  pt(u: number, v: number): [number, number] {
    v *= this.fy;
    const cs = Math.cos(this.ang), sn = Math.sin(this.ang);
    return [this.x + u * cs - v * sn, this.y + u * sn + v * cs];
  }
  tri(u0: number, v0: number, u1: number, v1: number, u2: number, v2: number, c: number, a = 1) {
    const [ax, ay] = this.pt(u0, v0), [bx, by] = this.pt(u1, v1), [cx, cy] = this.pt(u2, v2);
    this.g.tri(ax, ay, bx, by, cx, cy, c, a);
  }
  disc(u: number, v: number, r: number, c: number, a = 1) {
    const [x, y] = this.pt(u, v);
    this.g.disc(x, y, r, c, a);
  }
  glow(u: number, v: number, r: number, c: number, k: number) {
    const [x, y] = this.pt(u, v);
    this.g.glow(x, y, r, c, k);
  }
}
