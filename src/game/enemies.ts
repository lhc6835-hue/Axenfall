import { Gfx } from '../engine/gfx';
import { TAU, clamp, ease, mix, rand } from '../engine/math';
import { sfx } from '../engine/audio';
import type { Run } from './run';
import { PK } from './fx';

export type EType = 'grunt' | 'runner' | 'archer' | 'dasher' | 'brute' | 'caster' | 'warden' | 'overlord' | 'dummy';
type EState = 'chase' | 'windup' | 'strike' | 'recover' | 'stun' | 'air';

interface Spec {
  r: number;
  hp: number;
  spd: number;
  dmg: number;
  range: number;
  windup: number;
  color: number;
  xp: number;
  gold: number;
  mass: number;
}

export const SPECS: Record<EType, Spec> = {
  grunt: { r: 5, hp: 14, spd: 40, dmg: 9, range: 13, windup: 0.5, color: 0xff5468, xp: 1, gold: 0.25, mass: 1 },
  runner: { r: 4, hp: 7, spd: 76, dmg: 6, range: 11, windup: 0.34, color: 0xffa040, xp: 1, gold: 0.2, mass: 0.7 },
  archer: { r: 5, hp: 12, spd: 34, dmg: 8, range: 115, windup: 0.6, color: 0xb36cff, xp: 2, gold: 0.35, mass: 1 },
  dasher: { r: 5, hp: 20, spd: 36, dmg: 12, range: 115, windup: 0.62, color: 0x3fe0c8, xp: 2, gold: 0.35, mass: 1.2 },
  brute: { r: 10, hp: 100, spd: 23, dmg: 22, range: 26, windup: 0.85, color: 0x9a7058, xp: 6, gold: 1.2, mass: 4 },
  caster: { r: 6, hp: 32, spd: 26, dmg: 8, range: 140, windup: 0.85, color: 0xffe04a, xp: 4, gold: 0.8, mass: 1.4 },
  warden: { r: 16, hp: 2200, spd: 30, dmg: 24, range: 40, windup: 0.8, color: 0x6aa8ff, xp: 60, gold: 160, mass: 30 },
  overlord: { r: 19, hp: 5600, spd: 34, dmg: 28, range: 44, windup: 0.7, color: 0xff4a6a, xp: 120, gold: 400, mass: 40 },
  dummy: { r: 6, hp: 120, spd: 0, dmg: 0, range: 0, windup: 1, color: 0xc8a870, xp: 0, gold: 0, mass: 99 },
};

let NEXT_ID = 1;

export class Enemy {
  id = NEXT_ID++;
  type: EType;
  spec: Spec;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  kx = 0;
  ky = 0;
  r: number;
  hp: number;
  max: number;
  dmg: number;
  state: EState = 'chase';
  t = 0;
  cd: number;
  stun = 0;
  flash = 0;
  dead = false;
  elite = false;
  boss = false;
  atk = 0; // attack angle
  struck = false;
  face = 0;
  z = 0;
  tx = 0;
  ty = 0;
  pattern = 0;
  sub = 0;
  spin = rand(0, TAU);
  bob = rand(0, TAU);
  spawnT = 0.35;
  /** dummies in the lobby keep a fixed home */
  homeX = 0;
  homeY = 0;

  constructor(type: EType, x: number, y: number, scale: number, elite = false) {
    this.type = type;
    this.spec = SPECS[type];
    this.x = x;
    this.y = y;
    this.homeX = x;
    this.homeY = y;
    this.elite = elite;
    this.boss = type === 'warden' || type === 'overlord';
    this.r = this.spec.r * (elite ? 1.35 : 1);
    this.max = this.hp = this.spec.hp * scale * (elite ? 4 : 1);
    this.dmg = this.spec.dmg * (1 + (scale - 1) * 0.35) * (elite ? 1.3 : 1);
    this.cd = rand(0.5, 1.5);
    if (this.boss) this.cd = 1.5;
  }

  get telegraph() {
    return this.state === 'windup';
  }

  update(run: Run, dt: number) {
    const s = this.spec;
    const p = run.player;
    this.flash = Math.max(0, this.flash - dt);
    this.spin += dt * (this.state === 'windup' ? 9 : 1.5);
    this.bob += dt * 6;
    if (this.spawnT > 0) this.spawnT -= dt;
    // knockback decays
    const kd = Math.exp(-dt * (8 / Math.sqrt(s.mass)));
    this.x += this.kx * dt;
    this.y += this.ky * dt;
    this.kx *= kd;
    this.ky *= kd;
    if (this.type === 'dummy') {
      this.x += (this.homeX - this.x) * Math.min(1, dt * 3);
      this.y += (this.homeY - this.y) * Math.min(1, dt * 3);
      if (this.hp < this.max) this.hp = Math.min(this.max, this.hp + dt * 60);
      return;
    }
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const toP = Math.atan2(dy, dx);
    this.t += dt;

    if (this.stun > 0) {
      this.stun -= dt;
      this.state = 'stun';
      if (this.stun <= 0) {
        this.state = 'chase';
        this.t = 0;
        this.cd = rand(0.6, 1.2);
      }
      return;
    }
    if (this.boss) return this.bossUpdate(run, dt, d, toP);

    const sp = s.spd * (this.elite ? 0.9 : 1);
    const ranged = this.type === 'archer' || this.type === 'caster';
    switch (this.state) {
      case 'chase': {
        this.cd -= dt;
        let mv = 1;
        if (ranged) {
          // hold a comfortable distance and strafe
          const keep = this.type === 'archer' ? 105 : 125;
          mv = d > keep + 15 ? 1 : d < keep - 15 ? -0.8 : 0;
          const strafe = Math.sin(this.bob * 0.15 + this.id) * 0.6;
          this.x += (Math.cos(toP) * mv - Math.sin(toP) * strafe) * sp * dt;
          this.y += (Math.sin(toP) * mv + Math.cos(toP) * strafe) * sp * dt;
        } else {
          this.x += Math.cos(toP) * sp * dt;
          this.y += Math.sin(toP) * sp * dt;
        }
        this.face = toP;
        const inRange = this.type === 'dasher' ? d < s.range && d > 30 : ranged ? d < s.range + 40 : d < s.range + 4;
        // wait your turn: only a few enemies may attack at once, and ranged ones hold fire while the sky is busy
        const crowded = run.attackers() >= run.attackCap() || (ranged && run.hostileShots() >= run.shotCap() - 2);
        if (inRange && this.cd <= 0 && crowded) this.cd = rand(0.3, 0.7);
        else if (inRange && this.cd <= 0) {
          this.state = 'windup';
          this.t = 0;
          this.atk = toP;
          this.tx = p.x;
          this.ty = p.y;
        }
        break;
      }
      case 'windup': {
        // melee units keep tracking a little; the dasher locks in late
        const track = this.type === 'dasher' ? (this.t < s.windup * 0.6 ? 1 : 0) : ranged ? 1 : 0.35;
        this.atk += angleTo(this.atk, toP) * Math.min(1, dt * 6 * track);
        if (this.type === 'grunt' || this.type === 'runner') {
          // small step back before the jab
          this.x -= Math.cos(this.atk) * 12 * dt;
          this.y -= Math.sin(this.atk) * 12 * dt;
        }
        const wu = s.windup * (this.elite ? 0.9 : 1);
        if (this.t >= wu) {
          this.state = 'strike';
          this.t = 0;
          this.struck = false;
          this.release(run);
        }
        break;
      }
      case 'strike': {
        if (this.type === 'grunt' || this.type === 'runner') {
          const sp2 = this.type === 'runner' ? 190 : 150;
          if (this.t < 0.12) {
            this.x += Math.cos(this.atk) * sp2 * dt;
            this.y += Math.sin(this.atk) * sp2 * dt;
          }
          if (!this.struck && this.t >= 0.06) {
            this.struck = true;
            const hx = this.x + Math.cos(this.atk) * (this.r + 4), hy = this.y + Math.sin(this.atk) * (this.r + 4);
            run.fx.crescent(this.x, this.y, this.r + 6, this.atk - 0.9, this.atk + 0.9, 2, 0xff6a6a, 0.12);
            if (Math.hypot(p.x - hx, p.y - hy) < s.range * 0.75 + 6) run.meleeStrike(this, this.dmg, hx, hy);
          }
          if (this.t > 0.22) this.toRecover(0.35);
        } else if (this.type === 'dasher') {
          const dur = 0.42;
          this.x += Math.cos(this.atk) * 300 * dt;
          this.y += Math.sin(this.atk) * 300 * dt;
          if (Math.random() < 0.6) run.fx.spawn(PK.Ember, this.x, this.y, rand(-10, 10), rand(-10, 10), 0.3, s.color, { c2: 0xffffff });
          if (!this.struck && d < this.r + 9) {
            this.struck = true;
            run.meleeStrike(this, this.dmg, this.x + Math.cos(this.atk) * this.r, this.y + Math.sin(this.atk) * this.r);
            if (this.state === 'strike') this.toRecover(0.6);
          }
          if (this.t > dur) this.toRecover(0.7);
        } else if (this.type === 'brute') {
          if (this.t > 0.35) this.toRecover(0.7);
        } else {
          if (this.t > 0.3) this.toRecover(0.2);
        }
        break;
      }
      case 'recover':
        if (this.t >= this.sub) {
          this.state = 'chase';
          this.t = 0;
          this.cd = this.type === 'archer' ? rand(3.2, 4.6) : this.type === 'caster' ? rand(4.5, 6) : rand(1.0, 1.8);
        }
        break;
      default:
        break;
    }
  }

  toRecover(t: number) {
    this.state = 'recover';
    this.t = 0;
    this.sub = t;
  }

  /** the moment an attack leaves */
  release(run: Run) {
    const s = this.spec;
    switch (this.type) {
      case 'archer': {
        const sp = 125;
        run.enemyShot(this.x, this.y, Math.cos(this.atk) * sp, Math.sin(this.atk) * sp, this.dmg, 2.5, s.color);
        sfx.enemyShot();
        break;
      }
      case 'caster': {
        const n = this.elite ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const a = this.atk + (i / (n - 1) - 0.5) * 1.1;
          run.enemyShot(this.x, this.y, Math.cos(a) * 95, Math.sin(a) * 95, this.dmg, 2.5, s.color);
        }
        sfx.enemyShot();
        break;
      }
      case 'brute': {
        const cx = this.x + Math.cos(this.atk) * 14, cy = this.y + Math.sin(this.atk) * 14;
        run.fx.ring(cx, cy, 4, 30, 0.35, 0xffb080, 3, 0.7);
        run.fx.dust(cx, cy, 14);
        run.fx.shards(cx, cy, 6, 0x6a5a50, 0x3a3030, 0.8);
        run.shake(4);
        sfx.slam();
        const p = run.player;
        if (Math.hypot(p.x - cx, p.y - cy) < 26 + 5) run.meleeStrike(this, this.dmg, cx, cy);
        break;
      }
      case 'dasher':
        sfx.dash();
        break;
      default:
        break;
    }
  }

  // ---------------- bosses ----------------
  bossUpdate(run: Run, dt: number, d: number, toP: number) {
    const p = run.player;
    const s = this.spec;
    const final = this.type === 'overlord';
    const enraged = this.hp < this.max * 0.5;
    switch (this.state) {
      case 'chase': {
        this.cd -= dt;
        this.x += Math.cos(toP) * s.spd * dt;
        this.y += Math.sin(toP) * s.spd * dt;
        if (this.cd <= 0) {
          const pats = final ? [0, 1, 2, 3] : [0, 1, 2];
          this.pattern = pats[Math.floor(Math.random() * pats.length)];
          if (d > 170 && this.pattern === 2) this.pattern = 1;
          this.state = 'windup';
          this.t = 0;
          this.sub = 0;
          this.atk = toP;
          this.tx = p.x;
          this.ty = p.y;
          if (this.pattern === 1) sfx.warn();
        }
        break;
      }
      case 'windup': {
        const wu = this.pattern === 0 ? 0.7 : this.pattern === 1 ? 0.85 : this.pattern === 2 ? 0.45 : 0.6;
        if (this.pattern === 1) this.atk += angleTo(this.atk, toP) * Math.min(1, dt * (this.t < wu * 0.7 ? 5 : 0));
        if (this.t >= wu) {
          this.state = this.pattern === 2 ? 'air' : 'strike';
          this.t = 0;
          this.sub = 0;
          this.struck = false;
          if (this.pattern === 1) sfx.dash();
        }
        break;
      }
      case 'strike': {
        if (this.pattern === 0) {
          // bullet rings, each one offset
          const waves = enraged ? 3 : 2;
          if (this.t >= this.sub * 0.32 && this.sub < waves) {
            const n = final ? 12 : 10;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * TAU + this.sub * 0.21;
              run.enemyShot(this.x, this.y, Math.cos(a) * 80, Math.sin(a) * 80, this.dmg * 0.5, 3, s.color);
            }
            run.fx.ring(this.x, this.y, this.r, this.r + 14, 0.25, s.color, 2);
            sfx.enemyShot();
            this.sub++;
          }
          if (this.sub >= waves && this.t > waves * 0.32 + 0.2) this.toRecover(0.9);
        } else if (this.pattern === 1) {
          this.x += Math.cos(this.atk) * 360 * dt;
          this.y += Math.sin(this.atk) * 360 * dt;
          run.fx.dust(this.x, this.y + this.r * 0.6, 1);
          if (!this.struck && d < this.r + 9) {
            this.struck = true;
            run.meleeStrike(this, this.dmg, this.x + Math.cos(this.atk) * this.r, this.y + Math.sin(this.atk) * this.r);
            if (this.state === 'strike') this.toRecover(0.8);
          }
          if (this.t > 0.6) this.toRecover(0.9);
        } else if (this.pattern === 3) {
          // spiral stream
          if (this.t >= this.sub * 0.12 && this.t < 2.2) {
            for (let k = 0; k < 2; k++) {
              const a = this.sub * 0.33 + (k * TAU) / 2;
              run.enemyShot(this.x, this.y, Math.cos(a) * 85, Math.sin(a) * 85, this.dmg * 0.45, 2.5, 0xff8aa0);
            }
            if (this.sub % 3 === 0) sfx.enemyShot();
            this.sub++;
          }
          if (this.t > 2.4) this.toRecover(1);
        }
        break;
      }
      case 'air': {
        // leap: rise while homing to the player, hang, then crash
        const up = 0.55, hang = 0.3, fall = 0.12;
        if (this.t < up) {
          this.z = ease.outCubic(this.t / up) * 70;
          this.x += (p.x - this.x) * Math.min(1, dt * 5);
          this.y += (p.y - this.y) * Math.min(1, dt * 5);
          this.tx = this.x;
          this.ty = this.y;
        } else if (this.t < up + hang) {
          this.z = 70;
        } else if (this.t < up + hang + fall) {
          this.z = 70 * (1 - ease.inQuad((this.t - up - hang) / fall));
        } else if (!this.struck) {
          this.z = 0;
          this.struck = true;
          run.fx.ring(this.x, this.y, 6, 52, 0.4, 0xffd0a0, 3, 0.6);
          run.fx.dust(this.x, this.y, 24);
          run.fx.shards(this.x, this.y, 12, 0x5a5068, 0x2a2438, 1.2);
          run.shake(9);
          run.hitstop(0.05);
          sfx.slam();
          if (Math.hypot(p.x - this.x, p.y - this.y) < 46) run.meleeStrike(this, this.dmg, this.x, this.y);
          if (this.state === 'air') this.toRecover(1.0);
        }
        break;
      }
      case 'recover':
        if (this.t >= this.sub) {
          this.state = 'chase';
          this.t = 0;
          this.cd = enraged ? rand(0.6, 1.1) : rand(1.1, 1.8);
        }
        break;
      default:
        break;
    }
  }

  // ---------------- draw ----------------
  drawFloor(g: Gfx, time: number) {
    // shadow + floor telegraphs
    const sh = this.boss ? 0.4 : 0.3;
    g.ellipse(this.x, this.y + this.r * 0.7, this.r * (this.z > 0 ? 1 - this.z / 140 : 1), this.r * 0.35, 0x000000, sh, true);
    if (this.state !== 'windup' && !(this.state === 'air')) return;
    const k = clamp(this.t / this.spec.windup, 0, 1);
    const blink = Math.sin(time * 40) > 0;
    if (this.type === 'brute') {
      const cx = this.x + Math.cos(this.atk) * 14, cy = this.y + Math.sin(this.atk) * 14;
      g.disc(cx, cy, 26, 0xff3040, 0.12 + k * 0.15, true);
      g.ring(cx, cy, 26 * k, 1, 0xff6070, 0.9);
      g.ring(cx, cy, 26, 1, blink ? 0xff8090 : 0xa02030, 1);
    } else if (this.type === 'dasher' || (this.boss && this.pattern === 1 && this.state === 'windup')) {
      const L = this.boss ? 220 : 130;
      const ex = this.x + Math.cos(this.atk) * L, ey = this.y + Math.sin(this.atk) * L;
      g.line(this.x, this.y, ex, ey, blink ? 0xff5060 : 0x902030, 0.5 + k * 0.5);
      g.glowLine(this.x, this.y, ex, ey, 4, 0xff3040, 0.15 * k);
    } else if (this.boss && this.state === 'air') {
      const k2 = clamp(this.t / 0.85, 0, 1);
      g.disc(this.tx, this.ty, 46, 0xff3040, 0.1 + 0.15 * k2, true);
      g.ring(this.tx, this.ty, 46 * k2, 1, 0xff7080, 1);
      g.ring(this.tx, this.ty, 46, 1, blink ? 0xff8090 : 0xa02030, 1);
    }
  }

  draw(g: Gfx, time: number) {
    const s = this.spec;
    const wind = this.state === 'windup';
    const k = wind ? clamp(this.t / s.windup, 0, 1) : 0;
    let c = s.color;
    if (this.state === 'stun') c = mix(c, 0x6a6a7a, 0.5);
    const flash = this.flash > 0;
    const shake = wind ? (Math.random() - 0.5) * k * 2 : 0;
    const x = this.x + shake, y = this.y - this.z - (this.state === 'chase' ? Math.abs(Math.sin(this.bob)) * 1 : 0);
    const r = this.r * (this.spawnT > 0 ? 1 - this.spawnT / 0.35 : 1);
    if (r <= 0.5) return;
    const body = flash ? 0xffffff : wind && Math.sin(time * 30) > 0.3 ? mix(c, 0xffffff, 0.45) : c;
    const dark = flash ? 0xffffff : mix(c, 0x000000, 0.5);
    const lite = flash ? 0xffffff : mix(c, 0xffffff, 0.4);
    const outline = this.elite ? 0xffd24a : 0x0c0a14;
    const f = this.face;
    switch (this.type) {
      case 'grunt': {
        const a = this.state === 'windup' || this.state === 'strike' ? this.atk : f;
        tri(g, x, y, r + 1.5, a, outline);
        tri(g, x, y, r, a, body);
        tri(g, x - 1, y - 1, r * 0.45, a, lite);
        break;
      }
      case 'runner': {
        diamond(g, x, y, r + 1.5, outline);
        diamond(g, x, y, r, body);
        diamond(g, x - 0.5, y - 1, r * 0.4, lite);
        break;
      }
      case 'archer': {
        g.disc(x, y, r + 1.2, outline);
        g.disc(x, y, r, body);
        g.disc(x - 1, y - 1, r * 0.45, lite);
        // bow
        const a = wind ? this.atk : f;
        g.arc(x, y, r + 3, 1.2, a - 0.9, a + 0.9, 0xd8c8a8);
        if (wind) {
          const px = x + Math.cos(a) * (r + 2), py = y + Math.sin(a) * (r + 2);
          g.disc(px, py, 1 + k * 2, 0xffffff);
          g.glow(px, py, 8 + k * 8, c, 0.5 * k);
        }
        break;
      }
      case 'dasher': {
        const a = wind || this.state === 'strike' ? this.atk : f;
        const pts = arrow(x, y, r + 1.5, a);
        g.poly(pts, outline);
        g.poly(arrow(x, y, r, a), body);
        if (this.state === 'strike') g.glow(x, y, 14, c, 0.5);
        break;
      }
      case 'brute': {
        hex(g, x, y, r + 1.5, outline, this.spin * 0.1);
        hex(g, x, y, r, body, this.spin * 0.1);
        hex(g, x - 1.5, y - 2, r * 0.5, lite, this.spin * 0.1);
        hex(g, x + 2, y + 2, r * 0.3, dark, this.spin * 0.1);
        break;
      }
      case 'caster': {
        star(g, x, y, r + 1.8, outline, this.spin);
        star(g, x, y, r, body, this.spin);
        g.disc(x, y, r * 0.35, flash ? 0xffffff : 0xfff6c0);
        g.glow(x, y, 12 + k * 10, c, 0.25 + k * 0.4);
        break;
      }
      case 'warden':
      case 'overlord': {
        const ang = this.spin * 0.25;
        const final = this.type === 'overlord';
        g.quad(x, y, ang, -r - 2, -r - 2, r * 2 + 4, r * 2 + 4, outline);
        g.quad(x, y, ang, -r, -r, r * 2, r * 2, body);
        g.quad(x, y, ang, -r, -r, r * 2, 3, lite);
        g.quad(x, y, ang, -r, r - 3, r * 2, 3, dark);
        g.quad(x, y, -ang * 1.6, -r * 0.45, -r * 0.45, r * 0.9, r * 0.9, final ? 0x2a0a14 : 0x0a1430);
        // eye
        const p = 0.5 + 0.5 * Math.sin(time * 5);
        g.disc(x, y, r * 0.22, flash ? 0xffffff : final ? 0xff4060 : 0x8adfff);
        g.glow(x, y, r * 1.6, c, 0.3 + p * 0.2 + (wind ? 0.4 : 0));
        if (final) for (let i = 0; i < 4; i++) {
          const a = ang * 2 + (i * TAU) / 4;
          g.disc(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6), 2, 0xff8aa0);
        }
        break;
      }
      case 'dummy': {
        g.rect(x - 1, y + 2, 2, 6, 0x6a4a30);
        g.disc(x, y, r + 1, outline);
        g.disc(x, y, r, flash ? 0xffffff : 0xc8a870);
        g.ring(x, y, r * 0.55, 1, 0xa83a3a);
        g.disc(x, y, 1.2, 0xa83a3a);
        break;
      }
    }
    // telegraph "!" above the head
    if (wind && !this.boss && this.type !== 'dummy') {
      const ey = y - r - 7 - (1 - k) * 2;
      const col = k > 0.7 ? 0xffffff : 0xff4050;
      g.rect(x - 0.5, ey, 1.5, 3, col);
      g.rect(x - 0.5, ey + 4, 1.5, 1, col);
      g.glow(x, ey + 2, 6, 0xff3040, 0.4 + k * 0.4);
    }
    if (this.state === 'stun') {
      for (let i = 0; i < 3; i++) {
        const a = time * 5 + (i * TAU) / 3;
        g.px(x + Math.cos(a) * (r + 2), y - r - 3 + Math.sin(a) * 1.5, 0xffe46a);
      }
    }
    if ((this.elite || this.type === 'brute') && this.hp < this.max && !this.boss) {
      const w = r * 2 + 2;
      g.rect(x - w / 2, y - r - 4, w, 1, 0x200a10);
      g.rect(x - w / 2, y - r - 4, w * (this.hp / this.max), 1, 0xff4a5a);
    }
  }
}

function angleTo(a: number, b: number) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function tri(g: Gfx, x: number, y: number, r: number, a: number, c: number) {
  const p = (k: number) => [x + Math.cos(a + (k * TAU) / 3) * r, y + Math.sin(a + (k * TAU) / 3) * r];
  const [ax, ay] = p(0), [bx, by] = p(1), [cx, cy] = p(2);
  g.tri(ax, ay, bx, by, cx, cy, c);
}
function diamond(g: Gfx, x: number, y: number, r: number, c: number) {
  g.poly([x, y - r * 1.2, x + r, y, x, y + r * 1.2, x - r, y], c);
}
function hex(g: Gfx, x: number, y: number, r: number, c: number, rot: number) {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) pts.push(x + Math.cos(rot + (i * TAU) / 6) * r, y + Math.sin(rot + (i * TAU) / 6) * r);
  g.poly(pts, c);
}
function star(g: Gfx, x: number, y: number, r: number, c: number, rot: number) {
  for (let i = 0; i < 5; i++) {
    const a = rot + (i * TAU) / 5;
    const b0 = a - TAU / 10, b1 = a + TAU / 10;
    g.tri(x, y, x + Math.cos(b0) * r * 0.5, y + Math.sin(b0) * r * 0.5, x + Math.cos(a) * r, y + Math.sin(a) * r, c);
    g.tri(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(b1) * r * 0.5, y + Math.sin(b1) * r * 0.5, c);
  }
}
function arrow(x: number, y: number, r: number, a: number) {
  const cs = Math.cos(a), sn = Math.sin(a);
  const P = (u: number, v: number) => [x + u * cs - v * sn, y + u * sn + v * cs];
  return [...P(r * 1.4, 0), ...P(-r, r), ...P(-r * 0.4, 0), ...P(-r, -r)];
}
