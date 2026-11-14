import { Gfx } from '../engine/gfx';
import { TAU, clamp, ease, mix, rand } from '../engine/math';
import { sfx } from '../engine/audio';
import type { Run } from './run';
import { PK } from './fx';

export type EType =
  | 'grunt' | 'runner' | 'archer' | 'dasher' | 'brute' | 'caster' | 'warden' | 'overlord' | 'dummy'
  | 'lancer' | 'shield' | 'sniper' | 'mortar' | 'splitter' | 'shard' | 'golem' | 'duelist';
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
  // ---- world 2 ----
  lancer: { r: 5, hp: 22, spd: 38, dmg: 12, range: 58, windup: 0.72, color: 0xff9a4a, xp: 2, gold: 0.35, mass: 1.1 },
  shield: { r: 7, hp: 40, spd: 30, dmg: 13, range: 90, windup: 0.7, color: 0x8aa0c0, xp: 3, gold: 0.5, mass: 2.5 },
  sniper: { r: 5, hp: 16, spd: 30, dmg: 14, range: 210, windup: 1.15, color: 0x5affa0, xp: 3, gold: 0.5, mass: 1 },
  mortar: { r: 6, hp: 26, spd: 24, dmg: 10, range: 180, windup: 0.8, color: 0xd0703a, xp: 3, gold: 0.55, mass: 1.6 },
  splitter: { r: 6, hp: 20, spd: 38, dmg: 9, range: 13, windup: 0.5, color: 0xff5ad0, xp: 1, gold: 0.3, mass: 1.2 },
  shard: { r: 3.5, hp: 6, spd: 70, dmg: 6, range: 10, windup: 0.32, color: 0xff8ae0, xp: 1, gold: 0.1, mass: 0.6 },
  golem: { r: 18, hp: 3400, spd: 22, dmg: 26, range: 60, windup: 0.9, color: 0xff7a2a, xp: 80, gold: 220, mass: 40 },
  duelist: { r: 12, hp: 7200, spd: 56, dmg: 24, range: 40, windup: 0.5, color: 0xb08aff, xp: 150, gold: 520, mass: 30 },
};

const BOSSES: EType[] = ['warden', 'overlord', 'golem', 'duelist'];
const RANGED: EType[] = ['archer', 'caster', 'sniper', 'mortar'];
const JABBER: EType[] = ['grunt', 'runner', 'splitter', 'shard'];

/** the duelist's guard lasts this long before it answers with a cut */
export const GUARD_T = 1.9;

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
  /** boss target marks (x,y pairs) */
  marks: number[] = [];
  /** shield / guard reaction cooldown */
  guardCd = 0;
  lastPat = -1;
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
    this.boss = BOSSES.includes(type);
    this.r = this.spec.r * (elite ? 1.35 : 1);
    this.max = this.hp = this.spec.hp * scale * (elite ? 4 : 1);
    this.dmg = this.spec.dmg * (1 + (scale - 1) * 0.35) * (elite ? 1.3 : 1);
    this.cd = rand(0.5, 1.5);
    if (this.boss) this.cd = 1.5;
  }

  get telegraph() {
    return this.state === 'windup';
  }

  /** a shield bearer turns gunfire that comes from the front */
  blocks(fromAng: number) {
    if (this.type !== 'shield' || this.state === 'stun') return false;
    const face = this.state === 'windup' || this.state === 'strike' ? this.atk : this.face;
    return Math.abs(angleTo(face, fromAng)) < 1.15;
  }

  /** the duelist's guard stance: bullets are cut down, a blade breaks it */
  guarding() {
    return this.type === 'duelist' && this.state === 'strike' && this.pattern === 2 && this.t < GUARD_T;
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
    this.guardCd -= dt;

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
    if (this.type === 'golem') return this.golemUpdate(run, dt, d, toP);
    if (this.type === 'duelist') return this.duelistUpdate(run, dt, d, toP);
    if (this.boss) return this.bossUpdate(run, dt, d, toP);

    const sp = s.spd * (this.elite ? 0.9 : 1);
    const ranged = RANGED.includes(this.type);
    const jab = JABBER.includes(this.type);
    const charger = this.type === 'dasher' || this.type === 'shield';
    switch (this.state) {
      case 'chase': {
        this.cd -= dt;
        let mv = 1;
        if (ranged) {
          // hold a comfortable distance and strafe
          const keep = this.type === 'archer' ? 105 : this.type === 'sniper' ? 165 : this.type === 'mortar' ? 140 : 125;
          mv = d > keep + 15 ? 1 : d < keep - 15 ? -0.8 : 0;
          const strafe = Math.sin(this.bob * 0.15 + this.id) * 0.6;
          this.x += (Math.cos(toP) * mv - Math.sin(toP) * strafe) * sp * dt;
          this.y += (Math.sin(toP) * mv + Math.cos(toP) * strafe) * sp * dt;
        } else {
          this.x += Math.cos(toP) * sp * dt;
          this.y += Math.sin(toP) * sp * dt;
        }
        this.face = toP;
        const inRange = charger ? d < s.range && d > 28 : this.type === 'lancer' ? d < s.range : ranged ? d < s.range + 40 : d < s.range + 4;
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
        const wu0 = s.windup * (this.elite ? 0.9 : 1);
        const track = charger
          ? this.t < wu0 * 0.6 ? 1 : 0
          : this.type === 'lancer'
            ? this.t < wu0 * 0.65 ? 1 : 0
            : this.type === 'sniper'
              ? this.t < wu0 * 0.75 ? 1.4 : 0
              : ranged ? 1 : 0.35;
        this.atk += angleTo(this.atk, toP) * Math.min(1, dt * 6 * track);
        if (jab || this.type === 'lancer') {
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
        if (jab) {
          const sp2 = this.type === 'runner' || this.type === 'shard' ? 190 : 150;
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
        } else if (this.type === 'lancer') {
          // a long, straight thrust: the body lunges and the spear reaches far past it
          if (this.t < 0.1) {
            this.x += Math.cos(this.atk) * 260 * dt;
            this.y += Math.sin(this.atk) * 260 * dt;
          }
          if (!this.struck && this.t >= 0.08) {
            this.struck = true;
            const ca = Math.cos(this.atk), sa = Math.sin(this.atk);
            const rx = p.x - this.x, ry = p.y - this.y;
            const u = rx * ca + ry * sa, v = -rx * sa + ry * ca;
            const tipX = this.x + ca * 40, tipY = this.y + sa * 40;
            run.fx.tracer(this.x, this.y, tipX, tipY, 0xffd0a0, 2, 0.12);
            run.fx.sparks(tipX, tipY, this.atk, 0.3, 4, 120, 0xffb070, 0xffffff, 0.15);
            if (u > -4 && u < 42 && Math.abs(v) < 8) run.meleeStrike(this, this.dmg, this.x + ca * Math.max(6, u), this.y + sa * Math.max(6, u));
          }
          if (this.state === 'strike' && this.t > 0.3) this.toRecover(0.5);
        } else if (this.type === 'dasher' || this.type === 'shield') {
          const shield = this.type === 'shield';
          const dur = shield ? 0.34 : 0.42;
          const v = shield ? 230 : 300;
          this.x += Math.cos(this.atk) * v * dt;
          this.y += Math.sin(this.atk) * v * dt;
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
          this.cd =
            this.type === 'archer' ? rand(3.2, 4.6)
            : this.type === 'caster' ? rand(4.5, 6)
            : this.type === 'sniper' ? rand(4, 5.5)
            : this.type === 'mortar' ? rand(4.5, 6.2)
            : this.type === 'lancer' ? rand(1.4, 2.2)
            : rand(1.0, 1.8);
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
      case 'sniper': {
        const mx = this.x + Math.cos(this.atk) * 9, my = this.y + Math.sin(this.atk) * 9;
        run.enemyShot(mx, my, Math.cos(this.atk) * 280, Math.sin(this.atk) * 280, this.dmg, 2, s.color);
        run.fx.flare(mx, my, 5, 0xc0ffe0, 0.06);
        run.fx.light(mx, my, 30, s.color, 0.8, 0.1);
        sfx.enemyShot();
        break;
      }
      case 'mortar': {
        const p = run.player;
        const tx = p.x + p.vx * 0.35 + rand(-6, 6), ty = p.y + p.vy * 0.35 + rand(-6, 6);
        run.lobShot(this.x, this.y - 5, tx, ty, this.dmg, 1.0, s.color, this.elite ? 8 : 6);
        run.fx.smoke(this.x, this.y - 6, 3, 0x4a3a34, 3, 0.6);
        sfx.enemyShot();
        break;
      }
      case 'lancer':
        sfx.swing('spear');
        break;
      case 'dasher':
      case 'shield':
        sfx.dash();
        break;
      default:
        break;
    }
  }

  // ---------------- world 2 bosses ----------------
  private pickPattern(pats: number[]) {
    let k = pats[Math.floor(Math.random() * pats.length)];
    if (k === this.lastPat) k = pats[Math.floor(Math.random() * pats.length)];
    this.lastPat = k;
    return k;
  }

  private startWindup(k: number, toP: number, run: Run) {
    this.pattern = k;
    this.state = 'windup';
    this.t = 0;
    this.sub = 0;
    this.atk = toP;
    this.tx = run.player.x;
    this.ty = run.player.y;
  }

  private bossRecover(enraged: boolean, slow: [number, number], fast: [number, number]) {
    if (this.t >= this.sub) {
      this.state = 'chase';
      this.t = 0;
      this.cd = enraged ? rand(...fast) : rand(...slow);
    }
  }

  /** golem: ground-pound shockwaves, a huge arm sweep, molten mortar volleys */
  golemUpdate(run: Run, dt: number, d: number, toP: number) {
    const p = run.player;
    const s = this.spec;
    const enraged = this.hp < this.max * 0.5;
    this.face = toP;
    switch (this.state) {
      case 'chase': {
        this.cd -= dt;
        this.x += Math.cos(toP) * s.spd * dt;
        this.y += Math.sin(toP) * s.spd * dt;
        if (this.cd <= 0) {
          let k = this.pickPattern([0, 1, 2]);
          if (k === 1 && d > 80) k = Math.random() < 0.5 ? 0 : 2;
          this.startWindup(k, toP, run);
          if (k === 1) sfx.warn();
        }
        break;
      }
      case 'windup': {
        const wu = [0.8, 0.95, 0.7][this.pattern];
        if (this.pattern === 1 && this.t < wu * 0.6) this.atk += angleTo(this.atk, toP) * Math.min(1, dt * 5);
        if (this.pattern === 0) this.z = Math.sin(clamp(this.t / wu, 0, 1) * Math.PI * 0.5) * 10;
        if (this.t >= wu) {
          this.state = 'strike';
          this.t = 0;
          this.sub = 0;
          this.struck = false;
        }
        break;
      }
      case 'strike': {
        if (this.pattern === 0) {
          const waves = enraged ? 3 : 2;
          const gap = 0.55;
          if (this.t >= this.sub * gap && this.sub < waves) {
            this.z = 0;
            run.fx.ring(this.x, this.y, 6, 40, 0.3, 0xffc090, 3, 0.6);
            run.fx.dust(this.x, this.y + 6, 18);
            run.fx.shards(this.x, this.y, 10, 0x5a4038, 0x2a1c18, 1.1);
            run.fx.light(this.x, this.y, 80, 0xff7a2a, 1, 0.25);
            run.shake(7);
            sfx.slam();
            run.wave(this.x, this.y, this.r, 95 + this.sub * 10, 210, this.dmg * 0.7, 0xff8a3a);
            if (d < this.r + 14) run.meleeStrike(this, this.dmg, this.x + Math.cos(toP) * this.r, this.y + Math.sin(toP) * this.r);
            if (this.state !== 'strike') break;
            this.sub++;
          }
          if (this.sub >= waves && this.t > (waves - 1) * gap + 0.45) this.toRecover(1.1);
        } else if (this.pattern === 1) {
          if (!this.struck && this.t >= 0.06) {
            this.struck = true;
            run.fx.crescent(this.x, this.y, 60, this.atk - 1.8, this.atk + 1.8, 5, 0xffb070, 0.22);
            run.fx.crescent(this.x, this.y, 48, this.atk - 1.6, this.atk + 1.6, 3, 0xffffff, 0.12);
            run.fx.sparks(this.x + Math.cos(this.atk) * 50, this.y + Math.sin(this.atk) * 50, this.atk, 1.2, 10, 160, 0xffa050, 0xffffff, 0.25);
            run.shake(5);
            sfx.swing('greatsword');
            if (d < 66 && Math.abs(angleTo(this.atk, toP)) < 1.85) run.meleeStrike(this, this.dmg, p.x, p.y);
          }
          if (this.state === 'strike' && this.t > 0.4) this.toRecover(1.0);
        } else {
          const n = enraged ? 8 : 5;
          if (this.t >= this.sub * 0.14 && this.sub < n) {
            let tx = p.x + p.vx * 0.4, ty = p.y + p.vy * 0.4;
            if (this.sub > 0) {
              const a = rand(0, TAU), R = rand(22, 62);
              tx = p.x + Math.cos(a) * R;
              ty = p.y + Math.sin(a) * R;
            }
            run.lobShot(this.x, this.y - this.r, tx, ty, this.dmg * 0.55, 1.05, 0xff8a3a, 6);
            run.fx.spawn(PK.Ember, this.x, this.y - this.r, rand(-20, 20), rand(-60, -30), 0.5, 0xff8a2a, { c2: 0xffe080 });
            sfx.enemyShot();
            this.sub++;
          }
          if (this.sub >= n && this.t > n * 0.14 + 0.3) this.toRecover(0.9);
        }
        break;
      }
      case 'recover':
        this.z = 0;
        this.bossRecover(enraged, [1.2, 1.9], [0.7, 1.2]);
        break;
      default:
        break;
    }
  }

  /** time of slash i in the duelist's combo */
  comboAt(i: number) {
    const enraged = this.hp < this.max * 0.5;
    return 0.2 + i * (enraged ? 0.36 : 0.44);
  }
  comboHits() {
    return this.hp < this.max * 0.5 ? 4 : 3;
  }

  /** duelist: a rhythm of cuts to parry, flying crescents, a guard that answers bullets, a ring of falling blades */
  duelistUpdate(run: Run, dt: number, d: number, toP: number) {
    const p = run.player;
    const s = this.spec;
    const enraged = this.hp < this.max * 0.5;
    switch (this.state) {
      case 'chase': {
        this.cd -= dt;
        this.face = toP;
        const mv = d > 62 ? 1 : d < 36 ? -0.6 : 0;
        const strafe = Math.sin(this.bob * 0.2) * 0.7;
        this.x += (Math.cos(toP) * mv - Math.sin(toP) * strafe) * s.spd * dt;
        this.y += (Math.sin(toP) * mv + Math.cos(toP) * strafe) * s.spd * dt;
        if (this.cd <= 0) {
          const k = this.pickPattern(enraged ? [0, 0, 1, 2, 3] : [0, 0, 1, 2]);
          this.startWindup(k, toP, run);
          if (k === 3) {
            this.marks = [];
            const n = 8;
            const off = rand(0, TAU);
            for (let i = 0; i < n; i++) {
              const a = off + (i / n) * TAU;
              this.marks.push(p.x + Math.cos(a) * 78, p.y + Math.sin(a) * 78);
            }
            sfx.warn();
          }
        }
        break;
      }
      case 'windup': {
        const wu = [0.45, 0.6, 0.3, 0.95][this.pattern];
        this.face = toP;
        if (this.pattern === 0 && d > 34) {
          // closes the distance in a blink
          this.x += Math.cos(toP) * 240 * dt;
          this.y += Math.sin(toP) * 240 * dt;
          if (Math.random() < 0.5) run.fx.spawn(PK.Mote, this.x, this.y, 0, 0, 0.25, 0xb08aff, { c2: 0xffffff });
        }
        if (this.pattern !== 3) this.atk += angleTo(this.atk, toP) * Math.min(1, dt * 8);
        if (this.t >= wu) {
          this.state = 'strike';
          this.t = 0;
          this.sub = 0;
          this.struck = false;
        }
        break;
      }
      case 'strike': {
        if (this.pattern === 0) {
          const hits = this.comboHits();
          const ts = this.comboAt(this.sub);
          if (this.sub < hits && this.t < ts - 0.12) {
            this.atk += angleTo(this.atk, toP) * Math.min(1, dt * 10);
            if (d > 30) {
              this.x += Math.cos(toP) * 110 * dt;
              this.y += Math.sin(toP) * 110 * dt;
            }
          }
          if (this.sub < hits && this.t >= ts) {
            this.x += Math.cos(this.atk) * 6;
            this.y += Math.sin(this.atk) * 6;
            const side = this.sub % 2 ? -1 : 1;
            run.fx.crescent(this.x, this.y, 26, this.atk - 1.25 * side, this.atk + 1.25 * side, 3, 0xe0d4ff, 0.14);
            sfx.swing('katana');
            this.sub++;
            if (d < 40 && Math.abs(angleTo(this.atk, toP)) < 1.35) run.meleeStrike(this, this.dmg * 0.8, p.x, p.y);
            if (this.state !== 'strike') break;
          }
          if (this.sub >= hits && this.t > this.comboAt(hits - 1) + 0.3) this.toRecover(0.75);
        } else if (this.pattern === 1) {
          if (this.t >= this.sub * 0.26 && this.sub < 3) {
            const a = toP + (this.sub - 1) * 0.28;
            run.enemyShot(this.x, this.y, Math.cos(a) * 135, Math.sin(a) * 135, this.dmg * 0.7, 5, 0xd8c8ff, 'crescent');
            run.fx.crescent(this.x, this.y, 16, a - 1.4, a + 1.4, 2, 0xffffff, 0.1);
            sfx.swing('katana');
            this.sub++;
          }
          if (this.sub >= 3 && this.t > 0.85) this.toRecover(0.8);
        } else if (this.pattern === 2) {
          this.face = toP;
          this.atk += angleTo(this.atk, toP) * Math.min(1, dt * 4);
          if (this.t >= GUARD_T && !this.struck) {
            // the guard answers with a cut
            this.struck = true;
            this.x += Math.cos(toP) * Math.min(18, Math.max(0, d - 20));
            this.y += Math.sin(toP) * Math.min(18, Math.max(0, d - 20));
            run.fx.crescent(this.x, this.y, 30, this.atk - 1.4, this.atk + 1.4, 4, 0xffffff, 0.16);
            sfx.swing('katana');
            if (d < 46) run.meleeStrike(this, this.dmg, p.x, p.y);
            if (this.state === 'strike') this.toRecover(0.7);
          }
        } else {
          if (this.sub === 0) {
            this.sub = 1;
            for (let i = 0; i < this.marks.length; i += 2) {
              const mx = this.marks[i], my = this.marks[i + 1];
              const a = Math.atan2(this.ty - my, this.tx - mx);
              run.enemyShot(mx, my, Math.cos(a) * 155, Math.sin(a) * 155, this.dmg * 0.55, 3, 0xe8dcff, 'blade');
              run.fx.flare(mx, my, 5, 0xe8dcff, 0.08);
            }
            this.marks = [];
            sfx.enemyShot();
          }
          if (this.t > 0.9) this.toRecover(1.0);
        }
        break;
      }
      case 'recover':
        this.bossRecover(enraged, [0.9, 1.5], [0.5, 0.9]);
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
    const blink = Math.sin(time * 40) > 0;
    // the duelist's next cut is shown just before it lands
    if (this.type === 'duelist' && this.state === 'strike' && this.pattern === 0) {
      const rem = this.comboAt(this.sub) - this.t;
      if (this.sub < this.comboHits() && rem < 0.24 && rem > 0) sector(g, this.x, this.y, 40, this.atk, 1.35, 1 - rem / 0.24, blink);
    }
    if (this.type === 'duelist' && this.state === 'strike' && this.pattern === 2 && this.t > GUARD_T - 0.4)
      g.ring(this.x, this.y, 46, 1, blink ? 0xffffff : 0xa070ff, 0.9);
    if (this.state !== 'windup' && !(this.state === 'air')) return;
    const k = clamp(this.t / this.spec.windup, 0, 1);
    if (this.type === 'golem') {
      const wu = [0.8, 0.95, 0.7][this.pattern];
      const k2 = clamp(this.t / wu, 0, 1);
      if (this.pattern === 1) sector(g, this.x, this.y, 64, this.atk, 1.85, k2, blink);
      else if (this.pattern === 0) {
        g.ring(this.x, this.y, this.r + 12 + k2 * 20, 1, blink ? 0xffb070 : 0xa04010, 0.8);
        g.disc(this.x, this.y, this.r + 14, 0xff5020, 0.08 + k2 * 0.12, true);
      }
      return;
    }
    if (this.type === 'duelist') {
      if (this.pattern === 3) {
        const k2 = clamp(this.t / 0.95, 0, 1);
        g.ring(this.tx, this.ty, 10 + (1 - k2) * 20, 1, blink ? 0xffffff : 0xa070ff, 0.9);
        for (let i = 0; i < this.marks.length; i += 2) {
          const mx = this.marks[i], my = this.marks[i + 1];
          g.line(mx, my, mx + (this.tx - mx) * k2, my + (this.ty - my) * k2, 0x7a5ad0, 0.35 + k2 * 0.4);
        }
      }
      return;
    }
    if (this.type === 'lancer') {
      const L = 62;
      const ex = this.x + Math.cos(this.atk) * L, ey = this.y + Math.sin(this.atk) * L;
      g.glowLine(this.x, this.y, ex, ey, 3, 0xff6020, 0.12 + 0.2 * k);
      g.line(this.x, this.y, ex, ey, blink && k > 0.6 ? 0xffd0a0 : 0xa04820, 0.5 + k * 0.5);
      return;
    }
    if (this.type === 'brute') {
      const cx = this.x + Math.cos(this.atk) * 14, cy = this.y + Math.sin(this.atk) * 14;
      g.disc(cx, cy, 26, 0xff3040, 0.12 + k * 0.15, true);
      g.ring(cx, cy, 26 * k, 1, 0xff6070, 0.9);
      g.ring(cx, cy, 26, 1, blink ? 0xff8090 : 0xa02030, 1);
    } else if (this.type === 'dasher' || this.type === 'shield' || (this.boss && this.pattern === 1 && this.state === 'windup')) {
      const L = this.boss ? 220 : this.type === 'shield' ? 90 : 130;
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
        // a glowing diamond core
        const p = 0.5 + 0.5 * Math.sin(time * 5);
        const cr = r * 0.26;
        g.quad(x, y, ang * 2 + Math.PI / 4, -cr, -cr, cr * 2, cr * 2, flash ? 0xffffff : final ? 0xff4060 : 0x8adfff);
        g.glow(x, y, r * 1.6, c, 0.3 + p * 0.2 + (wind ? 0.4 : 0));
        if (final) for (let i = 0; i < 4; i++) {
          const a = ang * 2 + (i * TAU) / 4;
          g.quad(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6), a, -2, -2, 4, 4, 0xff8aa0);
        }
        break;
      }
      case 'lancer': {
        const a = wind || this.state === 'strike' ? this.atk : f;
        const pull = wind ? -k * 5 : this.state === 'strike' ? 8 : 0;
        const ca = Math.cos(a), sa = Math.sin(a);
        const bx = x + ca * (pull - 6), by = y + sa * (pull - 6);
        const tx2 = x + ca * (pull + 16), ty2 = y + sa * (pull + 16);
        g.beam(bx, by, tx2, ty2, 1.2, 0x6a4a30);
        g.tri(tx2 + ca * 5, ty2 + sa * 5, tx2 - sa * 2.2, ty2 + ca * 2.2, tx2 + sa * 2.2, ty2 - ca * 2.2, flash ? 0xffffff : 0xe8e0d0);
        g.quad(x, y, a, -r - 1.2, -r - 1.2, (r + 1.2) * 2, (r + 1.2) * 2, outline);
        g.quad(x, y, a, -r, -r, r * 2, r * 2, body);
        g.quad(x, y, a, -r, -r, r * 2, 2, lite);
        if (wind) g.glow(tx2, ty2, 6 + k * 6, 0xff8a3a, 0.3 + k * 0.4);
        break;
      }
      case 'shield': {
        const a = wind || this.state === 'strike' ? this.atk : f;
        hex(g, x, y, r + 1.5, outline, a);
        hex(g, x, y, r, body, a);
        hex(g, x - 1, y - 1.5, r * 0.45, lite, a);
        const sc = flash ? 0xffffff : this.state === 'stun' ? 0x6a6a7a : 0xd8e4f4;
        g.arc(x, y, r + 3, 4, a - 1.05, a + 1.05, outline);
        g.arc(x, y, r + 3, 3, a - 1, a + 1, sc);
        g.arc(x, y, r + 4, 1, a - 0.9, a + 0.9, 0xffffff, 0.7);
        if (this.guardCd > 0.05) g.glow(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3), 10, 0xcfe0ff, this.guardCd * 3);
        if (this.state === 'strike') g.glow(x, y, 14, 0xa0c0ff, 0.5);
        break;
      }
      case 'sniper': {
        const a = wind ? this.atk : f;
        const ca = Math.cos(a), sa = Math.sin(a);
        g.beam(x, y, x + ca * 11, y + sa * 11, 1, 0x2a3a34);
        tri(g, x, y, r + 1.5, a, outline);
        tri(g, x, y, r, a, body);
        g.disc(x, y, 1.4, flash ? 0xffffff : 0xeafff4);
        if (wind) {
          const wu = s.windup * (this.elite ? 0.9 : 1);
          const locked = this.t >= wu * 0.75;
          const L = 260;
          const mx = x + ca * 11, my = y + sa * 11;
          const col = locked ? (Math.sin(time * 50) > 0 ? 0xffffff : 0xff5070) : s.color;
          g.line(mx, my, mx + ca * L, my + sa * L, col, locked ? 0.85 : 0.3 + k * 0.3);
          if (locked) g.glowLine(mx, my, mx + ca * L, my + sa * L, 2, 0xff4060, 0.25);
          g.glow(mx, my, 6, col, 0.6);
        }
        break;
      }
      case 'mortar': {
        const a = Math.atan2(this.ty - this.y, this.tx - this.x);
        const tilt = Math.cos(a) * 0.5;
        g.quad(x, y, 0, -r - 1.5, -r * 0.7 - 1.5, r * 2 + 3, r * 1.4 + 3, outline);
        g.quad(x, y, 0, -r, -r * 0.7, r * 2, r * 1.4, body);
        g.quad(x, y, 0, -r, -r * 0.7, r * 2, 2, lite);
        const tube = -Math.PI / 2 + tilt;
        const tx2 = x + Math.cos(tube) * (r + 4), ty2 = y - 2 + Math.sin(tube) * (r + 4);
        g.beam(x, y - 2, tx2, ty2, 2.4, 0x3a2a24);
        g.beam(x, y - 2, tx2, ty2, 1.4, dark);
        if (wind) g.glow(tx2, ty2, 5 + k * 8, 0xff8a3a, 0.3 + k * 0.5);
        break;
      }
      case 'splitter': {
        const w = Math.sin(this.bob * 0.8) * 1;
        g.disc(x - 2, y, r * 0.8 + 1.2, outline);
        g.disc(x + 2, y, r * 0.8 + 1.2, outline);
        g.disc(x - 2, y + w * 0.3, r * 0.8, body);
        g.disc(x + 2, y - w * 0.3, r * 0.8, body);
        g.line(x, y - r * 0.7, x, y + r * 0.7, dark);
        g.disc(x - 3, y - 1.5, r * 0.25, lite);
        g.disc(x + 1, y - 1.5, r * 0.25, lite);
        break;
      }
      case 'shard': {
        diamond(g, x, y, r + 1.2, outline);
        diamond(g, x, y, r, body);
        g.px(x - 0.5, y - 1, lite);
        break;
      }
      case 'golem': {
        // a heavy octagon of iron around a molten core
        const enr = this.hp < this.max * 0.5;
        const iron = flash ? 0xffffff : this.state === 'stun' ? 0x4a4450 : 0x4a3a34;
        const lava = enr ? 0xffd060 : 0xff7a2a;
        const pulse = 0.5 + 0.5 * Math.sin(time * 4);
        // the sweep winds the whole body back, then spins it through
        let rot = this.spin * 0.04;
        if (this.pattern === 1 && wind) rot += -k * 0.9;
        else if (this.pattern === 1 && this.state === 'strike') rot += -0.9 + clamp(this.t / 0.15, 0, 1) * 3.2;
        const charge = wind && this.pattern === 0 ? k : 0;
        ngon(g, x, y, r + 2, 8, rot, outline);
        ngon(g, x, y, r, 8, rot, iron);
        ngon(g, x - 1, y - 2, r * 0.82, 8, rot, mix(iron, 0xffffff, 0.12));
        ngon(g, x, y, r * 0.62, 8, rot + Math.PI / 8, 0x1e1410);
        ngon(g, x, y, r * (0.4 + charge * 0.14), 8, -rot * 2, flash ? 0xffffff : mix(0x8a2a08, lava, 0.5 + pulse * 0.5));
        ngon(g, x, y, r * 0.18, 4, rot * 3, flash ? 0xffffff : 0xfff0c0);
        if (enr) ngonRing(g, x, y, r + 4, 8, rot, lava, 0.7);
        g.glow(x, y, r * 1.2, lava, 0.25 + pulse * 0.15 + charge * 0.5);
        break;
      }
      case 'duelist': {
        // a long, blade-like rhombus that always points where it means to cut
        const enr = this.hp < this.max * 0.5;
        const guard = this.guarding();
        let a = this.state === 'chase' ? f : this.atk;
        // every cut of the combo whips the body across
        if (this.state === 'strike' && this.pattern === 0) {
          const since = this.t - this.comboAt(Math.max(0, this.sub - 1));
          const side = (this.sub - 1) % 2 ? -1 : 1;
          if (this.sub > 0 && since < 0.12) a += side * (1 - since / 0.12) * 1.2;
        }
        const hue = enr ? 0xff6a8a : c;
        const body2 = flash ? 0xffffff : this.state === 'stun' ? 0x5a5070 : 0x2a2240;
        const edge = flash ? 0xffffff : hue;
        g.poly(rhomb(x, y, r * 1.8 + 1.5, r * 0.8 + 1.5, r * 1.2 + 1.5, a), outline);
        g.poly(rhomb(x, y, r * 1.8, r * 0.8, r * 1.2, a), edge);
        g.poly(rhomb(x, y, r * 1.4, r * 0.55, r * 0.9, a), body2);
        g.poly(rhomb(x, y, r * 0.55, r * 0.28, r * 0.35, a), flash ? 0xffffff : 0xf0ecff);
        // two small shards orbit it
        for (let i = 0; i < (enr ? 3 : 2); i++) {
          const oa = time * (enr ? 3 : 2) + (i * TAU) / (enr ? 3 : 2);
          const ox = x + Math.cos(oa) * (r + 7), oy = y + Math.sin(oa) * (r + 7) * 0.8;
          g.poly(rhomb(ox, oy, 3.5, 1.4, 2, oa + Math.PI / 2), hue);
        }
        if (this.state === 'strike' && !guard) g.glowLine(x - Math.cos(a) * r, y - Math.sin(a) * r, x + Math.cos(a) * r * 1.7, y + Math.sin(a) * r * 1.7, 3, hue, 0.35);
        if (guard) {
          // a hexagonal ward in front of it
          const sh = 0.55 + 0.25 * Math.sin(time * 18);
          ngonRing(g, x, y, r + 9, 6, a + Math.PI / 6, 0xd8c8ff, 0.9);
          ngonRing(g, x, y, r + 11, 6, a + Math.PI / 6, 0xb08aff, sh);
          g.glow(x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8), 14, 0xb08aff, 0.35 + this.guardCd * 2);
        }
        g.glow(x, y, r * 2, hue, 0.15 + (wind ? 0.3 : 0));
        if (this.state === 'windup' && this.pattern === 3)
          for (let i = 0; i < this.marks.length; i += 2) {
            const mx = this.marks[i], my = this.marks[i + 1];
            const da = Math.atan2(this.ty - my, this.tx - mx);
            const bob2 = Math.sin(time * 8 + i) * 1.5;
            g.poly(rhomb(mx, my - 6 + bob2, 7, 1.8, 4, da), 0xf0ecff);
            g.glow(mx, my - 6 + bob2, 8, 0xb08aff, 0.5);
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
    // the duelist flags each cut of its combo
    if (this.type === 'duelist' && this.state === 'strike' && this.pattern === 0) {
      const rem = this.comboAt(this.sub) - this.t;
      if (this.sub < this.comboHits() && rem < 0.22 && rem > 0) {
        const col = rem < 0.1 ? 0xffffff : 0xff4050;
        g.rect(x - 0.5, y - r - 10, 1.5, 3, col);
        g.rect(x - 0.5, y - r - 6, 1.5, 1, col);
        g.glow(x, y - r - 8, 7, 0xff3040, 0.6);
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

function ngon(g: Gfx, x: number, y: number, r: number, n: number, rot: number, c: number, a = 1) {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) pts.push(x + Math.cos(rot + (i * TAU) / n) * r, y + Math.sin(rot + (i * TAU) / n) * r);
  g.poly(pts, c, a);
}
function ngonRing(g: Gfx, x: number, y: number, r: number, n: number, rot: number, c: number, a = 1) {
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i * TAU) / n, a1 = rot + ((i + 1) * TAU) / n;
    g.line(x + Math.cos(a0) * r, y + Math.sin(a0) * r, x + Math.cos(a1) * r, y + Math.sin(a1) * r, c, a);
  }
}
/** a rhombus: front tip, half width, back tip */
function rhomb(x: number, y: number, front: number, half: number, back: number, a: number) {
  const cs = Math.cos(a), sn = Math.sin(a);
  const P = (u: number, v: number) => [x + u * cs - v * sn, y + u * sn + v * cs];
  return [...P(front, 0), ...P(0, half), ...P(-back, 0), ...P(0, -half)];
}

/** a flashing danger fan on the floor */
function sector(g: Gfx, x: number, y: number, R: number, a: number, half: number, k: number, blink: boolean) {
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a0 = a - half + (i / n) * half * 2, a1 = a - half + ((i + 1) / n) * half * 2;
    g.tri(x, y, x + Math.cos(a0) * R, y + Math.sin(a0) * R, x + Math.cos(a1) * R, y + Math.sin(a1) * R, 0xff3040, 0.08 + k * 0.14, true);
  }
  g.arc(x, y, R * Math.max(0.15, k), 1, a - half, a + half, 0xff7080, 0.9);
  g.arc(x, y, R, 1, a - half, a + half, blink ? 0xff8090 : 0xa02030, 1);
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
