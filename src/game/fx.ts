import { Gfx } from '../engine/gfx';
import { TAU, rand, mix, ease } from '../engine/math';
import { sfx } from '../engine/audio';

export const enum PK {
  Spark,
  Shard,
  Smoke,
  Casing,
  Chunk,
  Ember,
  Star,
  Dust,
  Mote,
}

export interface Part {
  k: PK;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  c: number;
  c2: number;
  s: number;
  a: number;
  va: number;
  drag: number;
  g: number;
  bounced: number;
  w: number;
  h: number;
}

interface Tracer { x0: number; y0: number; x1: number; y1: number; life: number; max: number; w: number; c: number }
interface Ring { x: number; y: number; r0: number; r1: number; life: number; max: number; c: number; th: number; sy: number }
interface Light { x: number; y: number; r: number; c: number; k: number; life: number; max: number }
interface Flare { x: number; y: number; s: number; c: number; life: number; max: number; ang: number }
interface Crescent { x: number; y: number; r: number; a0: number; a1: number; w: number; c: number; life: number; max: number }
export interface Pop { x: number; y: number; text: string; color: string; size: number; life: number; max: number; vy: number; big?: boolean }

export class FX {
  parts: Part[] = [];
  tracers: Tracer[] = [];
  rings: Ring[] = [];
  lights: Light[] = [];
  flares: Flare[] = [];
  crescents: Crescent[] = [];
  pops: Pop[] = [];

  spawn(k: PK, x: number, y: number, vx: number, vy: number, life: number, c: number, o: Partial<Part> = {}) {
    if (this.parts.length > 1600) this.parts.shift();
    const p: Part = {
      k, x, y, z: 0, vx, vy, vz: 0, life, max: life, c, c2: c, s: 1, a: rand(0, TAU), va: 0,
      drag: 3, g: 0, bounced: 0, w: 2, h: 1, ...o,
    };
    this.parts.push(p);
    return p;
  }

  light(x: number, y: number, r: number, c: number, k: number, life: number) {
    this.lights.push({ x, y, r, c, k, life, max: life });
  }
  ring(x: number, y: number, r0: number, r1: number, life: number, c: number, th = 2, sy = 1) {
    this.rings.push({ x, y, r0, r1, life, max: life, c, th, sy });
  }
  tracer(x0: number, y0: number, x1: number, y1: number, c: number, w = 1, life = 0.07) {
    this.tracers.push({ x0, y0, x1, y1, life, max: life, w, c });
  }
  flare(x: number, y: number, s: number, c: number, life = 0.08) {
    this.flares.push({ x, y, s, c, life, max: life, ang: rand(0, 0.8) });
  }
  crescent(x: number, y: number, r: number, a0: number, a1: number, w: number, c: number, life: number) {
    this.crescents.push({ x, y, r, a0: Math.min(a0, a1), a1: Math.max(a0, a1), w, c, life, max: life });
  }
  pop(x: number, y: number, text: string, color: string, size = 1, big = false) {
    if (this.pops.length > 45) this.pops.shift();
    const life = big ? 0.9 : size < 0.9 ? 0.4 : 0.6;
    this.pops.push({ x: x + rand(-3, 3), y, text, color, size, life, max: life, vy: big ? -18 : -40, big });
  }

  // ---------- composite helpers ----------
  sparks(x: number, y: number, ang: number, spread: number, n: number, speed: number, c: number, c2 = 0xffffff, life = 0.3) {
    for (let i = 0; i < n; i++) {
      const a = ang + rand(-spread, spread), sp = speed * rand(0.4, 1.2);
      this.spawn(PK.Spark, x, y, Math.cos(a) * sp, Math.sin(a) * sp, life * rand(0.5, 1.2), c, { c2, drag: rand(4, 7) });
    }
  }
  smoke(x: number, y: number, n: number, c = 0x3a3446, size = 3, life = 0.7) {
    for (let i = 0; i < n; i++)
      this.spawn(PK.Smoke, x + rand(-2, 2), y + rand(-2, 2), rand(-15, 15), rand(-25, -5), life * rand(0.6, 1.2), c, { s: size * rand(0.6, 1.2), drag: 3 });
  }
  dust(x: number, y: number, n: number, ang = -Math.PI / 2, spread = Math.PI) {
    for (let i = 0; i < n; i++) {
      const a = ang + rand(-spread, spread), sp = rand(20, 70);
      this.spawn(PK.Dust, x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, rand(0.3, 0.6), 0x5a536e, { s: rand(1.5, 3), drag: 6 });
    }
  }
  shards(x: number, y: number, n: number, c: number, c2: number, force = 1, ang = 0, spread = Math.PI) {
    for (let i = 0; i < n; i++) {
      const a = ang + rand(-spread, spread), sp = rand(40, 140) * force;
      this.spawn(PK.Shard, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.7, 1.4), c, {
        c2, vz: rand(60, 160) * force, g: 420, va: rand(-18, 18), s: rand(1.5, 3.2), drag: 1.5, z: 2,
      });
    }
  }
  casing(x: number, y: number, ang: number, c = 0xe8b64a, w = 2, h = 1) {
    const a = ang + rand(-0.4, 0.4), sp = rand(50, 90);
    this.spawn(PK.Casing, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(1.2, 1.8), c, {
      c2: mix(c, 0x000000, 0.4), vz: rand(70, 110), g: 480, va: rand(-25, 25), drag: 1.2, z: 3, w, h,
    });
  }
  chunk(x: number, y: number, vx: number, vy: number, c: number, w: number, h: number, life = 1.6) {
    this.spawn(PK.Chunk, x, y, vx, vy, life, c, { c2: mix(c, 0x000000, 0.45), vz: rand(10, 40), g: 420, va: rand(-8, 8), drag: 1.5, z: 4, w, h });
  }

  update(dt: number) {
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) {
        P[i] = P[P.length - 1];
        P.pop();
        continue;
      }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.a += p.va * dt;
      if (p.g) {
        p.vz -= p.g * dt;
        p.z += p.vz * dt;
        if (p.z <= 0) {
          p.z = 0;
          if (Math.abs(p.vz) > 25) {
            p.vz = -p.vz * 0.38;
            p.vx *= 0.55;
            p.vy *= 0.55;
            p.va *= 0.5;
            if (p.k === PK.Casing && p.bounced++ < 1) sfx.shell();
          } else {
            p.vz = 0;
            p.va *= 0.8;
            p.vx *= 0.9;
            p.vy *= 0.9;
          }
        }
      }
      if (p.k === PK.Ember) p.vy -= 30 * dt;
    }
    const step = <T extends { life: number }>(arr: T[]) => {
      for (let i = arr.length - 1; i >= 0; i--) if ((arr[i].life -= dt) <= 0) arr.splice(i, 1);
    };
    step(this.tracers);
    step(this.rings);
    step(this.lights);
    step(this.flares);
    step(this.crescents);
    for (const p of this.pops) {
      p.y += p.vy * dt;
      p.vy *= Math.exp(-4 * dt);
    }
    step(this.pops);
  }

  /** floor layer: settled debris, casings, dust */
  drawBack(g: Gfx) {
    for (const p of this.parts) {
      if (p.k === PK.Dust) {
        const t = p.life / p.max;
        g.disc(p.x, p.y, p.s * (1.4 - t * 0.5), p.c, t * 0.35, true);
      } else if (p.k === PK.Shard || p.k === PK.Casing || p.k === PK.Chunk) {
        // shadow
        const t = Math.min(1, p.life / 0.35);
        g.rectBlend(p.x - 1, p.y, 2, 1, 0x000000, 0.25 * t);
      }
    }
  }

  draw(g: Gfx) {
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      const e = ease.outCubic(t);
      g.ring(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, Math.max(1, r.th * (1 - t)), t < 0.15 ? 0xffffff : r.c, 1 - t * 0.6, r.sy);
      g.glow(r.x, r.y, r.r0 + (r.r1 - r.r0) * e + 6, r.c, 0.25 * (1 - t));
    }
    for (const p of this.parts) {
      const t = p.life / p.max;
      switch (p.k) {
        case PK.Spark: {
          const sp = Math.hypot(p.vx, p.vy);
          const len = Math.min(9, 1 + sp * 0.022);
          const nx = p.vx / (sp || 1), ny = p.vy / (sp || 1);
          const hot = t > 0.6 ? p.c2 : p.c;
          g.line(p.x, p.y, p.x - nx * len, p.y - ny * len, t > 0.3 ? hot : mix(p.c, 0x402018, 0.5));
          g.px(p.x, p.y, p.c2);
          g.glow(p.x, p.y, 4, p.c, 0.35 * t);
          break;
        }
        case PK.Mote: {
          g.px(p.x, p.y, t > 0.5 ? p.c2 : p.c, Math.min(1, t * 2));
          g.glow(p.x, p.y, 3, p.c, 0.3 * t);
          break;
        }
        case PK.Shard:
        case PK.Casing:
        case PK.Chunk: {
          const fade = Math.min(1, p.life / 0.35);
          const lit = Math.cos(p.a) > 0 ? p.c : p.c2;
          if (p.k === PK.Shard) g.quad(p.x, p.y - p.z, p.a, -p.s / 2, -p.s / 2, p.s, p.s, lit, fade);
          else g.quad(p.x, p.y - p.z, p.a, -p.w / 2, -p.h / 2, p.w, p.h, lit, fade);
          break;
        }
        case PK.Smoke: {
          const r = p.s * (1 + (1 - t) * 1.4);
          g.disc(p.x, p.y, r, p.c, 0.45 * t, true);
          g.disc(p.x - r * 0.25, p.y - r * 0.3, r * 0.55, mix(p.c, 0xffffff, 0.15), 0.3 * t, true);
          break;
        }
        case PK.Ember: {
          g.px(p.x, p.y, t > 0.5 ? p.c2 : p.c, t);
          g.glow(p.x, p.y, 3, p.c, 0.4 * t);
          break;
        }
        case PK.Star: {
          const s = Math.round(p.s * t + 0.4);
          g.px(p.x, p.y, 0xffffff);
          for (let k = 1; k <= s; k++) {
            g.px(p.x + k, p.y, p.c);
            g.px(p.x - k, p.y, p.c);
            g.px(p.x, p.y + k, p.c);
            g.px(p.x, p.y - k, p.c);
          }
          g.glow(p.x, p.y, 5, p.c, 0.4 * t);
          break;
        }
        default:
          break;
      }
    }
    for (const c of this.crescents) {
      const t = 1 - c.life / c.max;
      const w = c.w * (1 - ease.inQuad(t));
      if (w < 0.4) continue;
      g.arc(c.x, c.y, c.r, w, c.a0, c.a1, t < 0.25 ? 0xffffff : c.c, 1);
      const mid = (c.a0 + c.a1) / 2;
      g.glow(c.x + Math.cos(mid) * c.r, c.y + Math.sin(mid) * c.r, c.r * 0.8, c.c, 0.3 * (1 - t));
    }
    for (const tr of this.tracers) {
      const t = tr.life / tr.max;
      // tracer shrinks from the muzzle toward the hit point, like a real streak
      const s = 1 - t;
      const x0 = tr.x0 + (tr.x1 - tr.x0) * s * 0.85, y0 = tr.y0 + (tr.y1 - tr.y0) * s * 0.85;
      if (tr.w > 1.5) g.beam(x0, y0, tr.x1, tr.y1, tr.w * t + 0.5, tr.c, 1);
      g.line(x0, y0, tr.x1, tr.y1, t > 0.5 ? 0xffffff : tr.c);
      g.glowLine(x0, y0, tr.x1, tr.y1, 3 + tr.w * 2, tr.c, 0.55 * t);
    }
    for (const f of this.flares) {
      const t = f.life / f.max;
      const s = f.s * (0.5 + t * 0.7);
      const cs = Math.cos(f.ang), sn = Math.sin(f.ang);
      g.line(f.x - cs * s, f.y - sn * s, f.x + cs * s, f.y + sn * s, 0xffffff);
      g.line(f.x + sn * s, f.y - cs * s, f.x - sn * s, f.y + cs * s, 0xffffff);
      const d = s * 0.55;
      g.line(f.x - d, f.y - d, f.x + d, f.y + d, f.c);
      g.line(f.x - d, f.y + d, f.x + d, f.y - d, f.c);
      g.disc(f.x, f.y, Math.max(1, s * 0.3), 0xffffff);
      g.glow(f.x, f.y, s * 3, f.c, 0.7 * t);
    }
    for (const l of this.lights) {
      const t = l.life / l.max;
      g.glow(l.x, l.y, l.r, l.c, l.k * t * t);
    }
  }
}
