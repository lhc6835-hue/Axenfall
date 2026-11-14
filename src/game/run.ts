import { Gfx } from '../engine/gfx';
import { TAU, angDiff, clamp, hash2, mix, rand, randi } from '../engine/math';
import { sfx } from '../engine/audio';
import type { Input } from '../engine/input';
import { FX, PK } from './fx';
import { Enemy, type EType } from './enemies';
import { worldById, type WorldDef } from './worlds';
import { Player } from './player';
import { UPGRADES, baseMods, type GunDef, type Mods, type SkinDef, type SwordDef, type Upgrade } from './data';
import type { SwordCtl } from './weapons';

export interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  friendly: boolean;
  c: number;
  pierce: number;
  hit: Set<Enemy> | null;
  px: number;
  py: number;
  /** how it is drawn */
  kind?: 'crescent' | 'blade';
  /** lobbed shells fly over everything and burst where they land */
  lob?: { sx: number; sy: number; tx: number; ty: number; t: number; dur: number; n: number; z: number };
}

/** an expanding shockwave ring; parried by facing it, or dashed through */
interface Wave {
  x: number;
  y: number;
  r: number;
  v: number;
  max: number;
  dmg: number;
  c: number;
  hit: boolean;
  cut: number;
}

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'xp' | 'gold' | 'heal';
  v: number;
  t: number;
  pull: boolean;
}

export interface Loadout {
  gun: GunDef;
  gunLvl: number;
  sword: SwordDef;
  swordLvl: number;
  skin: SkinDef;
  world?: number;
}

export interface RunResult {
  won: boolean;
  time: number;
  kills: number;
  level: number;
  gold: number;
  parries: number;
  perfects: number;
  world: number;
}

export interface Hooks {
  levelUp(choices: Upgrade[]): void;
  over(r: RunResult): void;
  banner(text: string, sub?: string, color?: string): void;
}

export const WIN_TIME = 600;
export const BOSS1_AT = 240;
export const BOSS2_AT = 480;

export class Run {
  fx = new FX();
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  waves: Wave[] = [];
  drops: Drop[] = [];
  world: WorldDef;
  mods: Mods = baseMods();
  upLv: Record<string, number> = {};
  player: Player;
  time = 0;
  clock = 0;
  kills = 0;
  gold = 0;
  level = 1;
  xp = 0;
  xpNeed = 6;
  pending = 0;
  choosing = false;
  freeze = 0;
  slow = 0;
  slowScale = 0.3;
  shakeAmp = 0;
  shakeX = 0;
  shakeY = 0;
  /** directional camera kick from gunfire, springs back */
  kickX = 0;
  kickY = 0;
  camX = 0;
  camY = 0;
  over = false;
  overT = 0;
  won = false;
  boss: Enemy | null = null;
  bossDone = [false, false];
  spawnAcc = 0;
  eliteT = 55;
  swarms = [180, 400];
  parries = 0;
  perfects = 0;
  demoT = 0;
  demoShotT = 1.5;
  lastParryText = 0;
  resultSent = false;

  constructor(
    public g: Gfx,
    public load: Loadout,
    public input: Input | null,
    public hooks: Hooks | null,
    public demo: boolean,
    public mouseWorld: () => [number, number],
  ) {
    this.world = worldById(load.world ?? 1);
    this.player = new Player(this, load.gun, load.gunLvl, load.sword, load.swordLvl, load.skin);
    if (demo) this.setupDemo();
  }

  // ---------------- juice ----------------
  hitstop(t: number) {
    this.freeze = Math.min(0.28, Math.max(this.freeze, t));
  }
  shake(a: number) {
    this.shakeAmp = Math.min(12, Math.max(this.shakeAmp, a));
  }
  /** the view is shoved away from the line of fire */
  camKick(aim: number, amt: number) {
    if (this.demo) return;
    this.kickX = Math.max(-10, Math.min(10, this.kickX - Math.cos(aim) * amt));
    this.kickY = Math.max(-10, Math.min(10, this.kickY - Math.sin(aim) * amt));
  }
  flash(a: number, c = 0xffffff) {
    this.g.flash = Math.max(this.g.flash, a);
    this.g.flashColor = c;
  }
  slowmo(t: number, scale: number) {
    this.slow = Math.max(this.slow, t);
    this.slowScale = scale;
  }

  // ---------------- queries ----------------
  nearestEnemy(x: number, y: number, range: number, skip?: Enemy): Enemy | null {
    let best: Enemy | null = null, bd = range * range;
    for (const e of this.enemies) {
      if (e.dead || e === skip || e.spawnT > 0.2 || e.z > 20) continue;
      const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** where the sword should face when there is no mouse: the most urgent threat */
  threatAngle(x: number, y: number, fallback: number) {
    let best = -1, ang = fallback;
    for (const s of this.shots) {
      if (s.friendly) continue;
      const dx = s.x - x, dy = s.y - y, d = Math.hypot(dx, dy);
      if (d > 70) continue;
      const closing = -(dx * s.vx + dy * s.vy) / (d || 1);
      if (closing <= 0) continue;
      const score = 200 - d + closing * 0.2;
      if (score > best) {
        best = score;
        ang = Math.atan2(dy, dx);
      }
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
      if (d > 90) continue;
      const score = (e.telegraph || e.state === 'strike' ? 260 : 120) - d;
      if (score > best) {
        best = score;
        ang = Math.atan2(dy, dx);
      }
    }
    return ang;
  }

  // ---------------- combat ----------------
  damageEnemy(e: Enemy, dmg: number, kx: number, ky: number, crit: boolean, src: 'gun' | 'sword' | 'parry' | 'shot'): boolean {
    if (e.dead) return false;
    if (e.z > 20) return false;
    if (src === 'gun' || src === 'shot') {
      const p = this.player;
      const from = src === 'shot' ? Math.atan2(-ky, -kx) : Math.atan2(p.y - e.y, p.x - e.x);
      if (e.guarding()) {
        this.guardBlock(e, from);
        return false;
      }
      if (e.blocks(from)) {
        // the shield turns most of it
        dmg *= 0.15;
        kx *= 0.3;
        ky *= 0.3;
        if (e.guardCd <= 0) {
          e.guardCd = 0.22;
          const bx = e.x + Math.cos(from) * (e.r + 3), by = e.y + Math.sin(from) * (e.r + 3);
          this.fx.sparks(bx, by, from, 0.9, 4, 130, 0xdfe8ff, 0xffffff, 0.15);
          this.fx.pop(e.x, e.y - e.r - 4, '막음', '#bcd0ee', 0.8);
          sfx.click(1.6);
        }
      }
    } else if (src === 'sword' && e.guarding()) {
      // a blade breaks the guard wide open
      e.stun = 2.4;
      e.state = 'stun';
      e.t = 0;
      dmg *= 2.5;
      crit = true;
      this.fx.pop(e.x, e.y - e.r - 8, '가드 브레이크!', '#ffe46a', 1.6, true);
      this.fx.ring(e.x, e.y, 4, 40, 0.35, 0xd8c8ff, 3);
      this.fx.sparks(e.x, e.y, 0, Math.PI, 20, 220, 0xd8c8ff, 0xffffff, 0.35);
      this.hitstop(0.14);
      this.flash(0.3, 0xe8dcff);
      this.shake(6);
      sfx.parry(true);
    }
    e.hp -= dmg;
    e.flash = src === 'gun' ? 0.05 : 0.1;
    const m = Math.sqrt(e.spec.mass);
    e.kx += kx / m;
    e.ky += ky / m;
    const n = Math.round(dmg);
    // plain gun hits get small quick numbers; crits, blades and parries get the big ones
    const minor = src === 'gun' && !crit;
    if (!minor || Math.random() < 0.5) this.fx.pop(e.x, e.y - e.r - 3, String(n), crit ? '#ffe04a' : minor ? '#d8c8b8' : '#ffffff', crit ? 1.3 : minor ? 0.7 : 1.1);
    if (src !== 'gun') sfx.bulletHit();
    if (e.hp <= 0) {
      this.kill(e, kx, ky);
      return true;
    }
    return false;
  }

  /** the duelist cuts a bullet out of the air and sends one back */
  guardBlock(e: Enemy, from: number) {
    const bx = e.x + Math.cos(from) * (e.r + 5), by = e.y + Math.sin(from) * (e.r + 5);
    this.fx.sparks(bx, by, from, 0.8, 3, 140, 0xd8c8ff, 0xffffff, 0.15);
    if (e.guardCd > 0) return;
    e.guardCd = 0.3;
    e.flash = 0.04;
    this.fx.flare(bx, by, 6, 0xe8dcff, 0.07);
    this.fx.pop(e.x, e.y - e.r - 6, '튕겨냄', '#d8c8ff', 0.9);
    sfx.reflect();
    const p = this.player;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    this.enemyShot(bx, by, Math.cos(a) * 165, Math.sin(a) * 165, e.dmg * 0.45, 2.5, 0xd8c8ff);
  }

  kill(e: Enemy, kx: number, ky: number) {
    e.dead = true;
    if (e.type === 'dummy') {
      e.dead = false;
      e.hp = e.max;
      return;
    }
    this.kills++;
    const fx = this.fx;
    const c = e.spec.color;
    const a = Math.atan2(ky, kx);
    fx.shards(e.x, e.y, e.boss ? 40 : e.type === 'brute' ? 14 : 7, mix(c, 0xffffff, 0.2), mix(c, 0x000000, 0.45), e.boss ? 2 : 1, a, 1.2);
    fx.sparks(e.x, e.y, a, 1.4, e.boss ? 40 : 6, 180, c, 0xffffff, 0.3);
    fx.light(e.x, e.y, e.boss ? 120 : 26, c, e.boss ? 1.4 : 0.55, e.boss ? 0.6 : 0.15);
    fx.smoke(e.x, e.y, e.boss ? 14 : 2, 0x3a3448, e.boss ? 6 : 3, 0.8);
    if (e.boss || e.type === 'brute') fx.ring(e.x, e.y, e.r, e.r * 3, 0.35, c, 3);
    sfx.kill();
    if (e.type === 'splitter') {
      // splits into quick little shards
      const n = e.elite ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const sa = a + Math.PI / 2 + (i / n) * TAU;
        const sh = new Enemy('shard', e.x + Math.cos(sa) * 4, e.y + Math.sin(sa) * 4, this.scale() * this.world.hp, false);
        sh.spawnT = 0;
        sh.kx = Math.cos(sa) * 120;
        sh.ky = Math.sin(sa) * 120;
        sh.cd = rand(0.6, 1.0);
        this.enemies.push(sh);
      }
    }
    // drops
    // fewer, meaner enemies: each one is worth more
    const bounty = e.boss ? 1 : 2;
    const xp = e.spec.xp * (e.elite ? 5 : 1) * bounty;
    if (xp > 0) this.drop(e.x, e.y, 'xp', xp);
    const gc = e.spec.gold * (e.elite ? 12 : 1) * bounty * this.world.gold;
    let goldN = Math.floor(gc) + (Math.random() < gc % 1 ? 1 : 0);
    if (goldN > 0) {
      const pieces = Math.min(goldN, e.boss ? 30 : 6);
      for (let i = 0; i < pieces; i++) this.drop(e.x, e.y, 'gold', Math.round(goldN / pieces));
    }
    if (e.elite || (Math.random() < 0.006 && !this.demo)) this.drop(e.x, e.y, 'heal', 25);
    if (e.boss) {
      this.hitstop(0.28);
      this.slowmo(1.2, 0.25);
      this.flash(0.7);
      this.shake(12);
      this.boss = null;
      const W = this.world;
      this.waves = [];
      if (e.type === W.boss1.type) {
        this.bossDone[0] = true;
        this.hooks?.banner(`${W.boss1.name} 격파`, '보상 골드 획득', W.boss1.color);
      } else {
        this.bossDone[1] = true;
        this.won = true;
        this.hooks?.banner(`${W.boss2.name} 격파`, '승리', '#ffd25a');
        this.endRun(true);
      }
    }
  }

  drop(x: number, y: number, kind: Drop['kind'], v: number) {
    const a = rand(0, TAU), s = rand(20, 70);
    this.drops.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, kind, v, t: 0, pull: false });
  }

  /** an enemy's melee blow arrives at (hx,hy) */
  meleeStrike(e: Enemy, dmg: number, hx: number, hy: number) {
    const p = this.player;
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    if (p.sword.guards(a)) {
      this.parry(e, hx, hy);
      return;
    }
    this.hurtPlayer(dmg, a);
  }

  parry(e: Enemy, hx: number, hy: number) {
    const p = this.player, s = p.sword;
    const perfect = s.perfect();
    this.parries++;
    if (perfect) this.perfects++;
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    const d = Math.min(s.reach() * 0.55, Math.hypot(e.x - p.x, e.y - p.y));
    const cx = p.x + Math.cos(a) * d, cy = p.y + Math.sin(a) * d;
    void hx; void hy;
    // the enemy is thrown off balance
    e.stun = (e.boss ? 1.6 : 1.8) * (perfect ? 1.5 : 1);
    e.state = 'stun';
    e.t = 0;
    e.z = 0;
    const kb = e.boss ? 120 : 260;
    e.kx += Math.cos(a) * kb;
    e.ky += Math.sin(a) * kb;
    const dmg = s.dmg() * (perfect ? 3 : 1.6);
    this.damageEnemy(e, dmg, 0, 0, perfect, 'parry');
    this.parryFx(cx, cy, a, perfect);
    s.deflect(a, perfect);
    p.parryJolt(a, perfect, e.boss ? 1.3 : e.type === 'brute' ? 1.15 : 1);
    this.afterParry(perfect, p.x, p.y);
  }

  parryFx(x: number, y: number, a: number, perfect: boolean) {
    const fx = this.fx;
    fx.flare(x, y, perfect ? 14 : 9, 0xfff0b0, perfect ? 0.14 : 0.09);
    fx.ring(x, y, 2, perfect ? 34 : 22, perfect ? 0.35 : 0.25, perfect ? 0xffe46a : 0xffffff, 3);
    if (perfect) fx.ring(x, y, 2, 60, 0.5, 0xffb03a, 2);
    fx.sparks(x, y, a, 1.0, perfect ? 30 : 16, perfect ? 300 : 220, 0xffd04a, 0xffffff, perfect ? 0.45 : 0.3);
    fx.sparks(x, y, a + Math.PI, 0.6, perfect ? 10 : 5, 120, 0xffffff, 0xffffff, 0.2);
    for (let i = 0; i < (perfect ? 8 : 4); i++)
      fx.spawn(PK.Star, x + rand(-10, 10), y + rand(-10, 10), rand(-20, 20), rand(-30, 0), rand(0.3, 0.6), 0xffe46a, { s: rand(1, 3) });
    fx.light(x, y, perfect ? 110 : 70, 0xffe0a0, perfect ? 1.5 : 1, perfect ? 0.35 : 0.22);
    this.hitstop(perfect ? 0.2 : 0.12);
    this.slowmo(perfect ? 0.5 : 0.28, perfect ? 0.3 : 0.5);
    this.flash(perfect ? 0.55 : 0.3, perfect ? 0xfff4d0 : 0xffffff);
    this.shake(perfect ? 8 : 5);
    this.g.mono = perfect ? 0.6 : 0.3;
    sfx.parry(perfect);
    if (this.clock - this.lastParryText > 0.15) {
      this.lastParryText = this.clock;
      this.fx.pop(x, y - 10, perfect ? 'PERFECT!' : 'PARRY!', perfect ? '#ffe46a' : '#ffffff', perfect ? 1.9 : 1.4, true);
    }
  }

  afterParry(perfect: boolean, x: number, y: number) {
    const p = this.player;
    // riposte: the sword is ready again immediately
    p.sword.cd = 0;
    if (this.mods.parryWave > 0) {
      const R = 40 + this.mods.parryWave * 14;
      this.fx.ring(x, y, 6, R, 0.35, 0x9ff0ff, 3);
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < R + e.r) this.damageEnemy(e, p.sword.dmg() * 0.6 * this.mods.parryWave, ((e.x - x) / (d || 1)) * 200, ((e.y - y) / (d || 1)) * 200, false, 'parry');
      }
    }
    if (this.mods.parryReload > 0) {
      p.gun.finishReloadNow();
      p.gun.critShots = 3;
    }
    if (perfect) p.inv = Math.max(p.inv, 0.25);
  }

  /** reflect hostile bullets the blade meets during the parry window */
  parryShots(px: number, py: number, radius: number, sword: SwordCtl) {
    for (const s of this.shots) {
      if (s.friendly || s.lob) continue;
      const dx = s.x - px, dy = s.y - py;
      if (dx * dx + dy * dy > radius * radius) continue;
      if (!sword.guards(Math.atan2(dy, dx))) continue;
      this.reflect(s, sword.perfect());
    }
  }

  reflect(s: Shot, perfect: boolean) {
    s.friendly = true;
    s.hit = new Set();
    s.pierce = perfect ? 4 : 2;
    s.dmg = Math.max(18, s.dmg * 3) * this.mods.swordDmg * (perfect ? 2 : 1);
    s.c = perfect ? 0xffe46a : 0x8ff3ff;
    s.life = 1.6;
    s.r = 3;
    const t = this.nearestEnemy(s.x, s.y, 220);
    const a = t ? Math.atan2(t.y - s.y, t.x - s.x) : Math.atan2(-s.vy, -s.vx);
    const sp = 300;
    s.vx = Math.cos(a) * sp;
    s.vy = Math.sin(a) * sp;
    this.parries++;
    if (perfect) this.perfects++;
    // bullets only pull the blade into a guard when it isn't mid-cut
    const from = Math.atan2(s.y - this.player.y, s.x - this.player.x);
    this.player.sword.deflect(from, perfect, false);
    // a bullet is light: just a nudge
    this.player.parryJolt(from, perfect, 0.35);
    const fx = this.fx;
    fx.flare(s.x, s.y, perfect ? 9 : 6, s.c, 0.08);
    fx.sparks(s.x, s.y, a, 0.8, perfect ? 12 : 7, 200, s.c, 0xffffff, 0.25);
    fx.ring(s.x, s.y, 1, perfect ? 18 : 12, 0.2, s.c, 2);
    fx.light(s.x, s.y, 40, s.c, 0.8, 0.15);
    this.hitstop(perfect ? 0.1 : 0.05);
    this.shake(perfect ? 4 : 2);
    sfx.reflect();
    if (perfect) {
      sfx.parry(true, true);
      this.flash(0.25, 0xfff4d0);
      this.g.mono = 0.4;
      this.afterParry(true, this.player.x, this.player.y);
      if (this.clock - this.lastParryText > 0.15) {
        this.lastParryText = this.clock;
        fx.pop(s.x, s.y - 8, 'PERFECT!', '#ffe46a', 1.6, true);
      }
    } else {
      sfx.parry(false, true);
      if (this.clock - this.lastParryText > 0.25) {
        this.lastParryText = this.clock;
        fx.pop(s.x, s.y - 8, '반사!', '#8ff3ff', 1.1, true);
      }
    }
  }

  hostileShots() {
    let n = 0;
    for (const s of this.shots) if (!s.friendly) n++;
    return n;
  }
  /** how many enemy bullets may be in the air at once */
  shotCap() {
    return this.boss ? 30 : 8 + Math.floor(this.time / 60);
  }
  /** enemies currently winding up or striking: limits the pile-on so every attack is readable */
  attackers() {
    let n = 0;
    for (const e of this.enemies) if (!e.dead && !e.boss && (e.state === 'windup' || e.state === 'strike')) n++;
    return n;
  }
  attackCap() {
    return 2 + Math.floor(this.time / 150);
  }

  enemyShot(x: number, y: number, vx: number, vy: number, dmg: number, r: number, c: number, kind?: Shot['kind'], force = false) {
    if (!force && this.hostileShots() >= this.shotCap()) return;
    this.shots.push({ x, y, vx, vy, r, dmg, life: 4.5, friendly: false, c, pierce: 0, hit: null, px: x, py: y, kind });
  }

  /** a shell lobbed at (tx,ty): it lands after dur seconds and bursts into n bullets */
  lobShot(sx: number, sy: number, tx: number, ty: number, dmg: number, dur: number, c: number, n: number) {
    if (this.hostileShots() >= this.shotCap() + 4) return;
    this.shots.push({
      x: sx, y: sy, vx: 0, vy: 0, r: 3, dmg, life: dur + 1, friendly: false, c, pierce: 0, hit: null, px: sx, py: sy,
      lob: { sx, sy, tx, ty, t: 0, dur, n, z: 0 },
    });
  }

  wave(x: number, y: number, r0: number, v: number, max: number, dmg: number, c: number) {
    this.waves.push({ x, y, r: r0, v, max, dmg, c, hit: false, cut: NaN });
  }

  private burst(s: Shot) {
    const L = s.lob!;
    const fx = this.fx;
    fx.flare(L.tx, L.ty, 8, 0xffe0a0, 0.08);
    fx.ring(L.tx, L.ty, 2, 16, 0.25, s.c, 2);
    fx.sparks(L.tx, L.ty, 0, Math.PI, 10, 150, s.c, 0xffffff, 0.3);
    fx.dust(L.tx, L.ty, 6);
    fx.light(L.tx, L.ty, 40, s.c, 0.9, 0.18);
    this.shake(2);
    sfx.play('slam2', { vol: 0.35, rate: 1.4, jitter: 0.1, gate: 60 });
    const off = rand(0, TAU);
    for (let i = 0; i < L.n; i++) {
      const a = off + (i / L.n) * TAU;
      this.enemyShot(L.tx, L.ty, Math.cos(a) * 72, Math.sin(a) * 72, s.dmg, 2.5, s.c, undefined, true);
    }
  }

  hurtPlayer(dmg: number, fromAng: number) {
    const p = this.player;
    if (this.demo || p.inv > 0 || p.dead || this.over) return;
    p.hp -= dmg;
    p.inv = 0.75;
    p.hurtFlash = 0.3;
    p.vx -= Math.cos(fromAng) * 160;
    p.vy -= Math.sin(fromAng) * 160;
    this.hitstop(0.07);
    this.shake(6);
    this.g.hurt = 0.8;
    sfx.hurt();
    this.fx.pop(p.x, p.y - 12, '-' + Math.round(dmg), '#ff5a6a', 1.3);
    this.fx.sparks(p.x, p.y, fromAng + Math.PI, 1, 8, 150, 0xff5a6a, 0xffffff, 0.25);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      this.slowmo(1.5, 0.25);
      this.flash(0.6, 0xff4050);
      this.fx.shards(p.x, p.y, 24, p.skin.a, p.skin.b, 1.4);
      this.endRun(false);
    }
  }

  endRun(won: boolean) {
    if (this.over) return;
    this.over = true;
    this.won = won;
    this.overT = won ? 2.2 : 1.6;
  }

  // ---------------- progression ----------------
  gainXp(v: number) {
    this.xp += v;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level++;
      this.xpNeed = Math.round(6 + this.level * 4.2 + Math.pow(this.level, 1.55));
      this.pending++;
    }
  }

  rollUpgrades(): Upgrade[] {
    const pool = UPGRADES.filter((u) => (this.upLv[u.id] ?? 0) < u.max);
    const out: Upgrade[] = [];
    while (out.length < 3 && pool.length) {
      const i = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }

  applyUpgrade(u: Upgrade) {
    this.upLv[u.id] = (this.upLv[u.id] ?? 0) + 1;
    const before = this.mods.maxHp;
    u.apply(this.mods);
    if (this.mods.maxHp > before) this.player.hp = Math.min(this.mods.maxHp, this.player.hp + (this.mods.maxHp - before) + 15);
    if (u.id === 'mg') this.player.gun.ammo = this.player.gun.magSize();
    this.choosing = false;
    this.pending--;
  }

  // ---------------- spawning ----------------
  private spawnPos(): [number, number] {
    const a = rand(0, TAU);
    const R = Math.hypot(this.g.w / 2, this.g.h / 2) + 18;
    return [this.player.x + Math.cos(a) * R, this.player.y + Math.sin(a) * R];
  }

  scale() {
    const t = this.time;
    return 1 + t / 95 + Math.max(0, t - 300) / 70;
  }

  spawn(type: EType, elite = false, x?: number, y?: number) {
    const [sx, sy] = x === undefined ? this.spawnPos() : [x, y!];
    const e = new Enemy(type, sx, sy, this.scale() * this.world.hp, elite);
    this.enemies.push(e);
    return e;
  }

  private director(dt: number) {
    const t = this.time;
    const W = this.world;
    if (!this.boss && !this.bossDone[0] && t >= BOSS1_AT) {
      this.boss = this.spawn(W.boss1.type);
      this.boss.hp = this.boss.max = W.boss1.hp * (1 + this.level * 0.03);
      this.hooks?.banner('보스 출현', W.boss1.name, W.boss1.color);
      sfx.bossAppear();
    }
    if (!this.boss && !this.bossDone[1] && t >= BOSS2_AT) {
      this.boss = this.spawn(W.boss2.type);
      this.boss.hp = this.boss.max = W.boss2.hp * (1 + this.level * 0.03);
      this.hooks?.banner('최종 보스', W.boss2.name, W.boss2.color);
      sfx.bossAppear();
    }
    if (this.swarms.length && t >= this.swarms[0]) {
      this.swarms.shift();
      const n = 14;
      const R = 150;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        this.spawn(i % 3 === 0 ? W.swarm[1] : W.swarm[0], false, this.player.x + Math.cos(a) * R, this.player.y + Math.sin(a) * R);
      }
      this.hooks?.banner('포위', '사방에서 몰려온다', '#ff8a5a');
    }
    this.eliteT -= dt;
    if (this.eliteT <= 0) {
      this.eliteT = rand(50, 70);
      const types: EType[] = W.elites(t);
      this.spawn(types[Math.floor(Math.random() * types.length)], true);
    }
    const alive = this.enemies.length;
    const cap = 22 + t * 0.11;
    if (alive > cap) return;
    const rate = (0.75 + t / 50) * (this.boss ? 0.35 : 1);
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc--;
      this.spawn(this.pickType());
    }
  }

  private pickType(): EType {
    const t = this.time;
    const w: [EType, number][] = this.world.pool.map(([k, at, base, grow]) => [k, t >= at ? base + (grow * t) / 100 : 0]);
    let total = 0;
    for (const [, v] of w) total += v;
    let x = Math.random() * total;
    for (const [k, v] of w) {
      x -= v;
      if (x <= 0) return k;
    }
    return 'grunt';
  }

  // ---------------- lobby demo ----------------
  private setupDemo() {
    const R = 52;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * TAU + 0.3;
      this.spawn('dummy', false, Math.cos(a) * R * 1.5, Math.sin(a) * R);
    }
    for (const e of this.enemies) e.spawnT = 0;
  }

  private demoUpdate(dt: number) {
    const p = this.player;
    this.demoT -= dt;
    this.demoShotT -= dt;
    p.x = 0;
    p.y = 0;
    p.vx = p.vy = 0;
    // a stray bullet comes in every so often so the parry can be shown off
    if (this.demoShotT <= 0) {
      this.demoShotT = rand(2.2, 3.4);
      const a = rand(0, TAU);
      const R = 150;
      const sp = 110;
      this.enemyShot(Math.cos(a) * R, Math.sin(a) * R, -Math.cos(a) * sp, -Math.sin(a) * sp, 8, 2.5, 0xb36cff);
    }
    // auto-parry incoming bullets at the right moment, otherwise slash a dummy now and then
    for (const s of this.shots) {
      if (s.friendly) continue;
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < p.sword.reach() + 10 && d > p.sword.reach() - 6) {
        p.autoAttack(Math.atan2(s.y - p.y, s.x - p.x));
      }
    }
    if (this.demoT <= 0) {
      this.demoT = rand(1.3, 2.2);
      const e = this.enemies[randi(0, this.enemies.length - 1)];
      if (e) {
        const a = Math.atan2(e.y - p.y, e.x - p.x);
        if (Math.hypot(e.x, e.y) < p.sword.reach() + 30) p.autoAttack(a);
        else p.autoAttack(p.gun.aim);
      }
    }
  }

  // ---------------- main update ----------------
  update(realDt: number) {
    this.clock += realDt;
    // flashes and tints always fade in real time
    this.g.flash = Math.max(0, this.g.flash - realDt * 3.5);
    this.g.hurt = Math.max(0, this.g.hurt - realDt * 2.2);
    this.g.mono = Math.max(0, this.g.mono - realDt * 2.5);
    this.shakeAmp *= Math.exp(-realDt * 9);
    const sa = this.shakeAmp;
    this.shakeX = (Math.random() * 2 - 1) * sa;
    this.shakeY = (Math.random() * 2 - 1) * sa;
    const kd = Math.exp(-realDt * 16);
    this.kickX *= kd;
    this.kickY *= kd;
    if (this.choosing) return;
    if (this.freeze > 0) {
      // hit-stop: the whole world holds still for a beat
      this.freeze -= realDt;
      return;
    }
    let dt = Math.min(realDt, 1 / 30);
    if (this.slow > 0) {
      this.slow -= realDt;
      dt *= this.slowScale;
    }
    // fixed substeps keep collisions honest at low frame rates
    const steps = Math.ceil(dt / (1 / 120));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.step(h);
      if (this.freeze > 0 || this.choosing) break;
    }
    if (this.over) {
      this.overT -= realDt;
      if (this.overT <= 0 && !this.resultSent) {
        this.resultSent = true;
        this.hooks?.over({ won: this.won, time: this.time, kills: this.kills, level: this.level, gold: this.gold, parries: this.parries, perfects: this.perfects, world: this.world.id });
      }
    }
  }

  private step(dt: number) {
    const p = this.player;
    if (!this.over) this.time += dt;
    if (this.demo) this.demoUpdate(dt);
    else if (!this.over) this.director(dt);
    p.update(dt, this.demo ? null : this.input, this.clock);

    // enemies
    for (const e of this.enemies) if (!e.dead) e.update(this, dt);
    this.separate();
    this.enemies = this.enemies.filter((e) => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 700);

    // shots
    for (const s of this.shots) {
      if (s.lob) {
        const L = s.lob;
        L.t += dt;
        const k = Math.min(1, L.t / L.dur);
        s.x = L.sx + (L.tx - L.sx) * k;
        s.y = L.sy + (L.ty - L.sy) * k;
        L.z = Math.sin(k * Math.PI) * 60;
        if (Math.random() < 0.4) this.fx.spawn(PK.Ember, s.x, s.y - L.z, rand(-8, 8), rand(-8, 8), 0.3, s.c, { c2: 0xffe080 });
        if (k >= 1) {
          s.life = 0;
          this.burst(s);
        }
        continue;
      }
      s.px = s.x;
      s.py = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (!s.friendly) {
        if (Math.hypot(s.x - p.x, s.y - p.y) < s.r + 5) {
          const a = Math.atan2(s.y - p.y, s.x - p.x);
          if (p.sword.guards(a)) this.reflect(s, p.sword.perfect());
          else if (p.inv <= 0 && !p.dead) {
            this.hurtPlayer(s.dmg, a);
            s.life = 0;
          }
        }
      } else {
        for (const e of this.enemies) {
          if (e.dead || s.hit!.has(e)) continue;
          if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + s.r + 1) {
            s.hit!.add(e);
            this.damageEnemy(e, s.dmg, s.vx * 0.5, s.vy * 0.5, true, 'shot');
            this.fx.sparks(s.x, s.y, Math.atan2(s.vy, s.vx) + Math.PI, 0.8, 5, 140, s.c, 0xffffff, 0.2);
            if (s.pierce-- <= 0) {
              s.life = 0;
              break;
            }
          }
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
    this.updateWaves(dt);

    // drops
    const mag = this.mods.magnet;
    for (const d of this.drops) {
      d.t += dt;
      const dx = p.x - d.x, dy = p.y - d.y, dist = Math.hypot(dx, dy);
      if (!d.pull && (dist < mag || (this.over && this.won))) d.pull = true;
      if (d.pull && d.t > 0.25) {
        const sp = 140 + d.t * 120;
        d.vx += ((dx / dist) * sp - d.vx) * Math.min(1, dt * 10);
        d.vy += ((dy / dist) * sp - d.vy) * Math.min(1, dt * 10);
      } else {
        d.vx *= Math.exp(-dt * 5);
        d.vy *= Math.exp(-dt * 5);
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (dist < 7 && d.t > 0.25) {
        d.t = -1;
        if (d.kind === 'xp') {
          this.gainXp(d.v);
          sfx.gem();
        } else if (d.kind === 'gold') {
          this.gold += Math.max(1, Math.round(d.v * this.mods.goldMul));
          sfx.coin();
        } else {
          p.hp = Math.min(this.mods.maxHp, p.hp + d.v);
          this.fx.pop(p.x, p.y - 12, '+' + d.v, '#6aff9a', 1.2);
          sfx.heal();
        }
      }
    }
    this.drops = this.drops.filter((d) => d.t >= 0);

    this.fx.update(dt);

    // camera follows with a little lead toward where the gun points
    const lead = 10;
    const tx = p.x + Math.cos(p.gun.aim) * lead, ty = p.y + Math.sin(p.gun.aim) * lead;
    this.camX += (tx - this.camX) * Math.min(1, dt * 7);
    this.camY += (ty - this.camY) * Math.min(1, dt * 7);
    if (this.demo) {
      this.camX = 0;
      this.camY = 4;
    }

    if (this.pending > 0 && !this.choosing && !this.over && !this.demo) {
      this.choosing = true;
      sfx.levelUp();
      this.hooks?.levelUp(this.rollUpgrades());
    }
  }

  private updateWaves(dt: number) {
    const p = this.player;
    for (const w of this.waves) {
      w.r += w.v * dt;
      if (w.hit || p.dead || this.over) continue;
      const d = Math.hypot(p.x - w.x, p.y - w.y);
      if (Math.abs(d - w.r) > 4) continue;
      w.hit = true;
      // dashing through the crest is safe
      if (p.inv > 0) continue;
      const a = Math.atan2(w.y - p.y, w.x - p.x);
      if (p.sword.guards(a)) {
        const s = p.sword;
        const perfect = s.perfect();
        this.parries++;
        if (perfect) this.perfects++;
        w.cut = Math.atan2(p.y - w.y, p.x - w.x);
        const cx = p.x + Math.cos(a) * 8, cy = p.y + Math.sin(a) * 8;
        this.parryFx(cx, cy, a, perfect);
        s.deflect(a, perfect);
        p.parryJolt(a, perfect, 1.2);
        this.afterParry(perfect, p.x, p.y);
      } else this.hurtPlayer(w.dmg, a);
    }
    this.waves = this.waves.filter((w) => w.r < w.max);
  }

  /** soft separation so the horde reads as a crowd, not a blob */
  private separate() {
    const cell = 16;
    const grid = new Map<number, Enemy[]>();
    for (const e of this.enemies) {
      if (e.dead) continue;
      const k = (Math.floor(e.x / cell) & 0xffff) | ((Math.floor(e.y / cell) & 0xffff) << 16);
      let arr = grid.get(k);
      if (!arr) grid.set(k, (arr = []));
      arr.push(e);
    }
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const cx = Math.floor(e.x / cell), cy = Math.floor(e.y / cell);
      for (let ox = -1; ox <= 1; ox++)
        for (let oy = -1; oy <= 1; oy++) {
          const arr = grid.get(((cx + ox) & 0xffff) | (((cy + oy) & 0xffff) << 16));
          if (!arr) continue;
          for (const o of arr) {
            if (o.id <= e.id) continue;
            const dx = o.x - e.x, dy = o.y - e.y;
            const rr = e.r + o.r;
            const d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr || d2 === 0) continue;
            const d = Math.sqrt(d2), push = (rr - d) * 0.5;
            const nx = dx / d, ny = dy / d;
            const me = e.spec.mass, mo = o.spec.mass, tot = me + mo;
            e.x -= nx * push * (mo / tot);
            e.y -= ny * push * (mo / tot);
            o.x += nx * push * (me / tot);
            o.y += ny * push * (me / tot);
          }
        }
      // keep bodies off the player (no contact damage, only real attacks hurt)
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy), rr = e.r + 6;
      if (d < rr && d > 0 && e.z < 5) {
        const push = rr - d;
        e.x += (dx / d) * push * 0.7;
        e.y += (dy / d) * push * 0.7;
        if (!this.demo) {
          p.x -= (dx / d) * push * 0.3;
          p.y -= (dy / d) * push * 0.3;
        }
      }
    }
  }

  // ---------------- render ----------------
  render(ctx: CanvasRenderingContext2D) {
    const g = this.g;
    g.ox = Math.round(g.w / 2 - this.camX + this.shakeX + this.kickX);
    g.oy = Math.round(g.h / 2 - this.camY + this.shakeY + this.kickY);
    g.clear(this.world.id === 2 ? 0x120d0b : 0x14121f);
    this.drawFloor();
    this.fx.drawBack(g);
    this.drawWaves();
    this.drawLobMarks();
    this.drawDrops();
    for (const e of this.enemies) e.drawFloor(g, this.clock);
    const p = this.player;
    // draw back-to-front so overlaps read right
    const list = this.enemies.slice().sort((a, b) => a.y - b.y);
    let drawnPlayer = false;
    for (const e of list) {
      if (!drawnPlayer && e.y > p.y) {
        if (!p.dead) p.draw(g, this.clock);
        drawnPlayer = true;
      }
      e.draw(g, this.clock);
    }
    if (!drawnPlayer && !p.dead) p.draw(g, this.clock);
    this.drawShots();
    this.fx.draw(g);
    g.present(ctx);
  }

  private drawWaves() {
    const g = this.g;
    for (const w of this.waves) {
      const fade = Math.min(1, (w.max - w.r) / 30);
      const gap = 0.32;
      const segs: [number, number][] = isNaN(w.cut) ? [[0, TAU]] : [[w.cut + gap, w.cut + TAU - gap]];
      for (const [a0, a1] of segs) {
        g.arc(w.x, w.y, w.r, 3, a0, a1, mix(w.c, 0x000000, 0.3), 0.55 * fade);
        g.arc(w.x, w.y, w.r + 1, 1, a0, a1, 0xffe0b0, 0.9 * fade);
        g.arc(w.x, w.y, w.r - 5, 1, a0, a1, w.c, 0.3 * fade);
      }
      // light along the crest
      const n = Math.max(8, Math.floor(w.r / 6));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        if (!isNaN(w.cut) && Math.abs(angDiff(a, w.cut)) < gap) continue;
        g.glow(w.x + Math.cos(a) * w.r, w.y + Math.sin(a) * w.r, 7, w.c, 0.18 * fade);
      }
    }
  }

  private drawLobMarks() {
    const g = this.g;
    const blink = Math.sin(this.clock * 30) > 0;
    for (const s of this.shots) {
      if (!s.lob) continue;
      const L = s.lob;
      const k = Math.min(1, L.t / L.dur);
      g.disc(L.tx, L.ty, 9, 0xff3020, 0.08 + k * 0.16, true);
      g.ring(L.tx, L.ty, 9 * (1 - k) + 2, 1, 0xff9060, 0.9);
      g.ring(L.tx, L.ty, 10, 1, k > 0.7 && blink ? 0xffd0a0 : 0xa03018, 1);
      g.ellipse(s.x, s.y + 2, 3 - L.z / 40, 1.2, 0x000000, 0.35, true);
    }
  }

  private drawFloor() {
    const g = this.g;
    const T = 24;
    const F = this.world.floor;
    const hot = this.world.id === 2;
    const x0 = Math.floor((-g.ox) / T) - 1, x1 = Math.ceil((g.w - g.ox) / T) + 1;
    const y0 = Math.floor((-g.oy) / T) - 1, y1 = Math.ceil((g.h - g.oy) / T) + 1;
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        const h = hash2(tx, ty);
        const base = (tx + ty) & 1 ? F.a : F.b;
        g.rect(tx * T, ty * T, T, T, h > 0.9 ? mix(base, F.hi, 0.6) : base);
        g.rect(tx * T, ty * T, T, 1, F.line);
        g.rect(tx * T, ty * T, 1, T, F.line);
        if (hot) {
          // riveted iron plates with molten seams between some of them
          g.px(tx * T + 3, ty * T + 3, 0x3a2e28);
          g.px(tx * T + T - 3, ty * T + 3, 0x3a2e28);
          g.px(tx * T + 3, ty * T + T - 3, 0x3a2e28);
          g.px(tx * T + T - 3, ty * T + T - 3, 0x3a2e28);
          if (h > 0.55 && h < 0.72) {
            const pulse = 0.55 + 0.45 * Math.sin(this.clock * 2 + tx * 0.7 + ty * 1.3);
            const vert = h < 0.635;
            const x0 = tx * T, y0 = ty * T;
            if (vert) g.rect(x0, y0 + 2, 1, T - 4, mix(0x6a2008, F.seam, pulse));
            else g.rect(x0 + 2, y0, T - 4, 1, mix(0x6a2008, F.seam, pulse));
            g.glow(vert ? x0 : x0 + T / 2, vert ? y0 + T / 2 : y0, 14, F.glow, 0.12 * pulse);
          }
        }
        g.rect(tx * T + 1, ty * T + 1, T - 1, 1, mix(base, 0xffffff, 0.04));
        if (h < 0.18) {
          const px = tx * T + 4 + Math.floor(hash2(ty, tx) * 14), py = ty * T + 4 + Math.floor(h * 80) % 14;
          g.px(px, py, hot ? 0x3a2a22 : 0x2a2644);
          g.px(px + 1, py, hot ? 0x2e221c : 0x221f38);
        }
        if (h > 0.96) {
          // a hairline crack
          const sx = tx * T + 6, sy = ty * T + 8;
          g.line(sx, sy, sx + 5, sy + 3, 0x0f0d1a);
          g.line(sx + 5, sy + 3, sx + 9, sy + 2, 0x0f0d1a);
        }
      }
    if (this.demo) {
      // a soft spotlight under the showcase cube
      g.glow(0, 4, 90, hot ? 0xff7a2a : 0x6a5aff, 0.12);
      g.ellipse(0, 9, 34, 9, hot ? 0x4a2a1a : 0x2a2650, 0.35, true);
    }
  }

  private drawDrops() {
    const g = this.g;
    for (const d of this.drops) {
      const bob = Math.sin(this.clock * 6 + d.x) * 1;
      if (d.kind === 'xp') {
        const big = d.v >= 5;
        const c = big ? 0x6affd0 : d.v >= 2 ? 0x5ac8ff : 0x7a9aff;
        const s = big ? 3 : 2;
        g.poly([d.x, d.y - s - bob, d.x + s, d.y - bob, d.x, d.y + s - bob, d.x - s, d.y - bob], c);
        g.px(d.x - 0.5, d.y - s * 0.5 - bob, 0xffffff);
        g.glow(d.x, d.y - bob, 6, c, 0.3);
      } else if (d.kind === 'gold') {
        const w = Math.abs(Math.cos(this.clock * 5 + d.x)) * 2 + 0.6;
        g.ellipse(d.x, d.y - bob, w, 2.2, 0xffc23a);
        g.px(d.x, d.y - bob - 1, 0xfff2b0);
        g.glow(d.x, d.y - bob, 6, 0xffc23a, 0.25);
      } else {
        g.rect(d.x - 1, d.y - 3 - bob, 2, 6, 0xff5a7a);
        g.rect(d.x - 3, d.y - 1 - bob, 6, 2, 0xff5a7a);
        g.glow(d.x, d.y - bob, 9, 0xff5a7a, 0.4);
      }
    }
  }

  private drawShots() {
    const g = this.g;
    for (const s of this.shots) {
      if (s.lob) {
        const y = s.y - s.lob.z;
        g.disc(s.x, y, 3.2, 0x2a1a14);
        g.disc(s.x, y, 2.4, s.c);
        g.disc(s.x - 0.6, y - 0.6, 1, 0xffe0b0);
        g.glow(s.x, y, 10, s.c, 0.5);
        continue;
      }
      if (s.kind === 'crescent') {
        const a = Math.atan2(s.vy, s.vx);
        g.arc(s.x - Math.cos(a) * 4, s.y - Math.sin(a) * 4, 7, 2.5, a - 1.2, a + 1.2, s.friendly ? 0xffe46a : s.c);
        g.arc(s.x - Math.cos(a) * 3, s.y - Math.sin(a) * 3, 7, 1, a - 0.9, a + 0.9, 0xffffff);
        g.glow(s.x, s.y, 16, s.c, 0.5);
        continue;
      }
      if (s.kind === 'blade') {
        const a = Math.atan2(s.vy, s.vx);
        const ca = Math.cos(a), sa = Math.sin(a);
        const col = s.friendly ? 0xffe46a : 0xf0ecff;
        g.poly([s.x + ca * 4, s.y + sa * 4, s.x - sa * 1.8 - ca * 2, s.y + ca * 1.8 - sa * 2, s.x - ca * 9, s.y - sa * 9, s.x + sa * 1.8 - ca * 2, s.y - ca * 1.8 - sa * 2], col);
        g.glow(s.x, s.y, 12, s.c, 0.5);
        continue;
      }
      const tx = s.x - s.vx * 0.04, ty = s.y - s.vy * 0.04;
      g.line(tx, ty, s.x, s.y, mix(s.c, 0x000000, 0.3));
      g.disc(s.x, s.y, s.r, s.c);
      g.disc(s.x - 0.5, s.y - 0.5, s.r * 0.5, 0xffffff);
      g.glow(s.x, s.y, s.r * 4, s.c, s.friendly ? 0.7 : 0.45);
    }
  }

  /** world -> css pixel position, used by the HUD overlay */
  toScreen(x: number, y: number): [number, number] {
    return [x + this.g.ox, y + this.g.oy];
  }
}

export { angDiff, clamp };
