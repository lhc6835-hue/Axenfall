import { Gfx, Xf } from '../engine/gfx';
import { TAU, angDiff, clamp, ease, lerp, rand, rayCircle, seg, segDist, spring, mix } from '../engine/math';
import { sfx } from '../engine/audio';
import { ENHANCE_BONUS, type GunDef, type GunKind, type SwordDef, type SwordKind } from './data';
import { BLADE_LEN, MUZZLE, PORT, blankPose, drawGun, drawSword, hand, type GunPose } from './art';
import { PK } from './fx';
import type { Run } from './run';
import type { Enemy } from './enemies';

interface Hold {
  d: number;
  side: number;
  two: boolean;
  fore: [number, number];
  /** recoil per shot: slide back (px), muzzle flip (rad), shove on the body (px/s), camera kick (px) */
  kick: number;
  climb: number;
  push: number;
  cam: number;
  /** how stiffly it comes back (higher = snappier) */
  ret: number;
  /** sideways wobble on automatic fire (rad) */
  yaw?: number;
  /** a sliver of hit-stop on the shot itself for heavy guns */
  stop?: number;
}
const HOLD: Record<GunKind, Hold> = {
  pistol: { d: 7.5, side: 2, two: false, fore: [0, 0], kick: 2.6, climb: 0.28, push: 30, cam: 1.6, ret: 1 },
  revolver: { d: 7.5, side: 2, two: false, fore: [0, 0], kick: 3.4, climb: 0.5, push: 55, cam: 2.6, ret: 0.8 },
  smg: { d: 7.5, side: 2.5, two: false, fore: [0, 0], kick: 1.3, climb: 0.07, push: 9, cam: 0.7, ret: 1.4, yaw: 0.06 },
  shotgun: { d: 7, side: 4, two: true, fore: [8.5, -1.2], kick: 4.5, climb: 0.38, push: 130, cam: 4.5, ret: 0.75, stop: 0.02 },
  sniper: { d: 6, side: 4, two: true, fore: [10, -1.5], kick: 5, climb: 0.3, push: 110, cam: 4.5, ret: 0.7, stop: 0.02 },
  minigun: { d: 7, side: 4.5, two: true, fore: [-1.5, -9], kick: 1, climb: 0.035, push: 7, cam: 0.5, ret: 1.6, yaw: 0.05 },
  railgun: { d: 7, side: 4, two: true, fore: [8, 0], kick: 6, climb: 0.35, push: 170, cam: 6.5, ret: 0.6, stop: 0.03 },
  derringer: { d: 7.5, side: 2, two: false, fore: [0, 0], kick: 2, climb: 0.32, push: 25, cam: 1.5, ret: 1.1 },
  lever: { d: 7.5, side: 2.5, two: false, fore: [0, 0], kick: 3.4, climb: 0.36, push: 55, cam: 2.6, ret: 0.9 },
  rifle: { d: 6, side: 4, two: true, fore: [10, -1.5], kick: 1.7, climb: 0.1, push: 16, cam: 1.1, ret: 1.3, yaw: 0.04 },
  laser: { d: 7.5, side: 2, two: false, fore: [0, 0], kick: 1, climb: 0.06, push: 6, cam: 0.6, ret: 1.4, yaw: 0.03 },
  dbarrel: { d: 7.5, side: 2, two: false, fore: [0, 0], kick: 5, climb: 0.75, push: 150, cam: 5, ret: 0.65, stop: 0.025 },
  cannon: { d: 7.5, side: 2, two: false, fore: [0, 0], kick: 5, climb: 0.95, push: 150, cam: 5.5, ret: 0.55, stop: 0.03 },
  musket: { d: 5, side: 4, two: true, fore: [12, -1.5], kick: 6, climb: 0.38, push: 180, cam: 6.5, ret: 0.6, stop: 0.03 },
  launcher: { d: 6, side: 4.5, two: true, fore: [10.8, 0.5], kick: 5, climb: 0.3, push: 140, cam: 5, ret: 0.65, stop: 0.02 },
};

/** post-shot action length (pump, bolt) */
const CYCLE: Partial<Record<GunKind, number>> = { shotgun: 0.32, sniper: 0.55, lever: 0.42, launcher: 0.22 };
/** guns that reload one round at a time */
const PER_SHELL: Partial<Record<GunKind, true>> = { shotgun: true, lever: true, launcher: true };
const FLOURISH = 0.85;

export class GunCtl {
  def: GunDef;
  hold: Hold;
  lvl: number;
  ammo: number;
  reloading = false;
  rt = 0;
  rdur = 1;
  shellsToLoad = 0;
  cd = 0;
  kick = 0;
  kickV = 0;
  climb = 0;
  climbV = 0;
  yaw = 0;
  yawV = 0;
  cycle = -1;
  flourish = -1;
  idle = 0;
  charge = 0;
  barrel = 0;
  barrelV = 0;
  aim = 0;
  hasTarget = false;
  critShots = 0;
  /** world-space hand position and muzzle */
  hx = 0;
  hy = 0;
  fy = 1;
  sideK = 1;
  drawAng = 0;
  private prevU = 0;
  /** true while firing (minigun slows the player) */
  firing = 0;
  pose: GunPose = blankPose();
  targetX = 0;
  targetY = 0;
  private burstLeft = 0;
  private burstT = 0;
  /** musket: flint has struck, the charge goes off when this runs out */
  private delayT = -1;
  /** musket hammer state and launcher drum position persist between shots */
  hammer = 1;
  pan = 0;
  drum = 0;
  private drumTo = 0;

  constructor(def: GunDef, lvl: number, private run: Run) {
    this.def = def;
    this.hold = HOLD[def.kind];
    this.lvl = lvl;
    this.ammo = this.magSize();
  }

  magSize() {
    return Math.max(1, Math.round(this.def.mag * this.run.mods.mag));
  }
  dmg() {
    return this.def.dmg * this.run.mods.gunDmg * (1 + this.lvl * ENHANCE_BONUS);
  }

  startReload() {
    if (this.reloading || this.ammo >= this.magSize()) return;
    this.reloading = true;
    this.rt = 0;
    this.prevU = 0;
    this.flourish = -1;
    this.charge = 0;
    const spd = this.run.mods.reloadSpd;
    if (PER_SHELL[this.def.kind]) {
      this.shellsToLoad = this.magSize() - this.ammo;
      this.rdur = (0.18 + this.shellsToLoad * this.def.reload + 0.3) / spd;
    } else this.rdur = this.def.reload / spd;
  }

  finishReloadNow() {
    this.reloading = false;
    this.ammo = this.magSize();
    this.cycle = -1;
  }

  update(dt: number, px: number, py: number, moveAng: number) {
    const run = this.run;
    const def = this.def;
    // ---- target ----
    const t = run.nearestEnemy(px, py, def.range * 0.95);
    this.hasTarget = !!t;
    let want = this.aim;
    if (t) {
      want = Math.atan2(t.y - py, t.x - px);
      this.targetX = t.x;
      this.targetY = t.y;
      this.idle = 0;
    } else {
      this.idle += dt;
      if (!Number.isNaN(moveAng)) want = moveAng;
    }
    const turn = def.kind === 'minigun' ? 9 : def.kind === 'sniper' || def.kind === 'railgun' ? 14 : 26;
    this.aim += angDiff(this.aim, want) * Math.min(1, dt * turn);

    // ---- springs ----
    const ret = this.hold.ret;
    [this.kick, this.kickV] = spring(this.kick, this.kickV, 700 * ret * ret, 30 * ret, dt);
    [this.climb, this.climbV] = spring(this.climb, this.climbV, 260 * ret * ret, 17 * ret, dt);
    [this.yaw, this.yawV] = spring(this.yaw, this.yawV, 500, 22, dt);

    // ---- minigun barrel spin ----
    if (def.kind === 'minigun') {
      const wantSpin = t && !this.reloading ? 1 : 0;
      this.barrelV += (wantSpin - this.barrelV) * Math.min(1, dt * (wantSpin ? 1.6 : 0.9));
      this.barrel += this.barrelV * dt * 45;
    }
    this.firing = Math.max(0, this.firing - dt);
    this.pan = Math.max(0, this.pan - dt * 6);
    this.drum += (this.drumTo - this.drum) * Math.min(1, dt * 18);
    // the blaster cools down whenever it isn't firing
    if (def.heat && !this.reloading && this.firing <= 0.05) this.ammo = Math.min(this.magSize(), this.ammo + dt * 9);
    if (this.burstLeft > 0 && !this.reloading) {
      this.burstT -= dt;
      if (this.burstT <= 0 && this.ammo >= 1) {
        this.fireRound();
        this.burstLeft--;
        this.burstT = 0.065;
      } else if (this.ammo < 1) this.burstLeft = 0;
    }
    if (this.delayT >= 0) {
      this.delayT -= dt;
      if (this.delayT < 0) this.fireRound();
    }

    if (this.cycle >= 0) {
      const dur = CYCLE[def.kind] ?? 0.3;
      const c0 = this.cycle;
      this.cycle += dt / dur;
      this.cycleEvents(c0, this.cycle);
      if (this.cycle >= 1) this.cycle = -1;
    }
    if (this.flourish >= 0) {
      const f0 = this.flourish;
      this.flourish += dt / FLOURISH;
      this.flourishEvents(f0, this.flourish);
      if (this.flourish >= 1) this.flourish = -1;
    }

    this.cd -= dt;
    if (this.reloading) {
      this.rt += dt;
      const u = clamp(this.rt / this.rdur, 0, 1);
      this.reloadEvents(this.prevU, u);
      this.prevU = u;
      if (u >= 1) {
        this.reloading = false;
        this.ammo = this.magSize();
      }
    } else if (this.ammo < 1 && this.burstLeft <= 0 && this.delayT < 0) {
      this.startReload();
    } else if (t && this.cycle < 0 && this.burstLeft <= 0 && this.delayT < 0) {
      this.flourish = -1;
      const aligned = Math.abs(angDiff(this.aim, want)) < 0.35;
      if (def.kind === 'railgun') {
        if (this.cd <= 0 && aligned) {
          if (this.charge === 0) sfx.charge();
          this.charge += dt / 0.34;
          if (this.charge >= 1) {
            this.charge = 0;
            this.fire();
          }
        }
      } else if (def.kind === 'minigun') {
        if (this.cd <= 0 && this.barrelV > 0.3) this.fire();
      } else if (this.cd <= 0 && aligned) this.fire();
    } else if (!t) {
      this.charge = Math.max(0, this.charge - dt * 3);
      // tactical reload or show-off when nothing is around
      if (this.idle > 1.2 && this.ammo < this.magSize() && !def.heat) this.startReload();
      else if (this.idle > 2.6 && this.flourish < 0 && this.cycle < 0) {
        this.flourish = 0;
        this.idle = 0.6;
      }
    }

    // ---- placement ----
    // flip the gun over only once it clearly points the other way, then slide the grip across
    const ca = Math.cos(this.aim);
    if ((this.fy > 0 && ca < -0.18) || (this.fy < 0 && ca > 0.18)) this.fy = -this.fy;
    const ks = dt / 0.12;
    this.sideK += Math.max(-ks, Math.min(ks, this.fy - this.sideK));
    const h = this.hold;
    const cs = Math.cos(this.aim), sn = Math.sin(this.aim);
    this.hx = px + cs * h.d - sn * h.side * this.sideK;
    this.hy = py + sn * h.d + cs * h.side * this.sideK;
  }

  rate() {
    const r = this.def.rate * this.run.mods.fireRate;
    return this.def.kind === 'minigun' ? r * (0.25 + 0.75 * this.barrelV) : r;
  }

  muzzle(): [number, number] {
    const [mu, mv] = MUZZLE[this.def.kind];
    const x = new Xf(null as unknown as Gfx, this.hx, this.hy, this.aim, this.fy);
    return x.pt(mu - this.kick, mv);
  }

  /** pull the trigger: bursts and the flintlock's delay are handled here */
  fire() {
    const def = this.def;
    this.cd = 1 / this.rate();
    if (def.kind === 'musket') {
      // flint strikes, the pan flashes, then the charge goes off
      this.hammer = 0;
      this.pan = 1;
      this.delayT = 0.09;
      sfx.foley('flint', 0.9);
      const X = new Xf(null as unknown as Gfx, this.hx, this.hy, this.aim, this.fy);
      const [fx, fy] = X.pt(0.5, -5.8);
      this.run.fx.sparks(fx, fy, this.aim - (Math.PI / 2) * this.fy, 1.2, 5, 60, 0xffb060, 0xffffff, 0.2);
      this.run.fx.smoke(fx, fy, 1, 0x8a8478, 1.5, 0.5);
      return;
    }
    this.fireRound();
    if (def.burst && def.burst > 1) {
      this.burstLeft = def.burst - 1;
      this.burstT = 0.065;
    }
  }

  fireRound() {
    const run = this.run;
    const def = this.def;
    this.ammo = Math.max(0, this.ammo - 1);
    this.firing = 0.25;
    const [mx, my] = this.muzzle();
    const pellets = def.pellets + run.mods.extra * (def.pellets > 1 ? 2 : 1);
    const pierce = def.pierce + run.mods.pierce;
    let anyKill = false;
    for (let i = 0; i < pellets; i++) {
      let a = this.aim;
      if (pellets > 1) {
        // even fan with jitter so shotgun spreads read clean
        a += (i / (pellets - 1) - 0.5) * def.spread + rand(-0.04, 0.04);
      } else a += rand(-def.spread / 2, def.spread / 2) * (this.def.kind === 'minigun' ? 1 - this.barrelV * 0.3 : 1);
      const crit = this.critShots > 0 || Math.random() < def.crit + run.mods.crit;
      if (this.ray(mx, my, a, def.range, pierce, crit, run.mods.ricochet, def.tracer)) anyKill = true;
    }
    if (this.critShots > 0) this.critShots--;
    // muzzle
    run.fx.flare(mx + Math.cos(this.aim) * 2, my + Math.sin(this.aim) * 2, def.kind === 'railgun' ? 9 : def.kind === 'shotgun' || def.kind === 'sniper' ? 7 : 4.5, def.tracer, def.kind === 'railgun' ? 0.12 : 0.05);
    run.fx.light(mx, my, def.kind === 'railgun' ? 60 : 34, 0xffc46a, def.kind === 'railgun' ? 1.1 : 0.65, 0.08);
    const k = def.kind;
    if (k === 'shotgun' || k === 'sniper' || k === 'railgun' || k === 'dbarrel' || k === 'cannon' || k === 'launcher') run.fx.smoke(mx, my, k === 'railgun' ? 5 : 3, 0x4a4458, 2.5, 0.6);
    if (k === 'musket') {
      // black powder: a big white cloud rolling forward
      for (let i = 0; i < 9; i++) {
        const sp = rand(10, 55);
        const aa = this.aim + rand(-0.5, 0.5);
        run.fx.spawn(PK.Smoke, mx, my, Math.cos(aa) * sp, Math.sin(aa) * sp - 8, rand(0.9, 1.6), 0xb8b4ac, { s: rand(2.5, 4.5), drag: 2.5 });
      }
      run.fx.flare(mx + Math.cos(this.aim) * 3, my + Math.sin(this.aim) * 3, 10, 0xffd08a, 0.1);
      run.hitstop(0.035);
    }
    if (k === 'laser') run.fx.ring(mx, my, 1, 6, 0.12, def.tracer, 1);
    run.fx.sparks(mx, my, this.aim, 0.5, def.kind === 'shotgun' ? 6 : 2, 160, 0xffb84a, 0xffffff, 0.12);
    // recoil: the gun snaps back and flips up at once, then springs home
    const h = this.hold;
    this.kick = Math.min(h.kick * 1.6, this.kick + h.kick);
    this.kickV = 0;
    this.climb = Math.min(h.climb * 1.5, this.climb + h.climb * rand(0.85, 1.15));
    this.climbV = 0;
    if (h.yaw) this.yawV += rand(-1, 1) * h.yaw * 40;
    // ...and the shooter and the camera take the shove too
    run.player.recoil(this.aim, h.push, h.kick / 6);
    run.camKick(this.aim, h.cam);
    if (h.stop) run.hitstop(h.stop);
    run.shake(def.shake * 0.5);
    if (def.kind === 'railgun') run.hitstop(0.04);
    if (anyKill) run.hitstop(def.stop);
    sfx.shot(def.kind);
    // casings for guns that eject on fire
    if (k === 'pistol' || k === 'smg' || k === 'minigun' || k === 'rifle') this.ejectCasing();
    if (k === 'cannon') this.ejectCasing(0xe8b64a, 3, 1.4);
    if (k === 'launcher') this.drumTo += 1;
    const cyc = CYCLE[def.kind];
    if (cyc) this.cycle = 0;
  }

  private ejectCasing(c = 0xe8b64a, w = 2, h = 1) {
    const [pu, pv] = PORT[this.def.kind];
    const x = new Xf(null as unknown as Gfx, this.hx, this.hy, this.aim, this.fy);
    const [ex, ey] = x.pt(pu, pv);
    this.run.fx.casing(ex, ey, this.aim + (Math.PI / 2 + 0.6) * -this.fy, c, w, h);
  }

  /** hitscan: returns true if something died */
  ray(x: number, y: number, a: number, range: number, pierce: number, crit: boolean, bounces: number, color: number, skip?: Enemy): boolean {
    const run = this.run;
    const dx = Math.cos(a), dy = Math.sin(a);
    const hits: { e: Enemy; t: number }[] = [];
    for (const e of run.enemies) {
      if (e.dead || e === skip) continue;
      if (Math.abs(e.x - x) > range + 20 || Math.abs(e.y - y) > range + 20) continue;
      const t = rayCircle(x, y, dx, dy, e.x, e.y, e.r + 1);
      if (t >= 0 && t <= range) hits.push({ e, t });
    }
    hits.sort((p, q) => p.t - q.t);
    if (this.def.splash) {
      const t0 = hits.length ? hits[0].t : range;
      const ex = x + dx * t0, ey = y + dy * t0;
      run.fx.tracer(x, y, ex, ey, color, 2, 0.1);
      return this.explode(ex, ey, this.def.splash, crit);
    }
    const n = Math.min(hits.length, pierce + 1);
    let killed = false;
    let endT = range;
    const dmg = this.dmg() * (crit ? 2 : 1);
    for (let i = 0; i < n; i++) {
      const { e, t } = hits[i];
      const hx = x + dx * t, hy = y + dy * t;
      if (run.damageEnemy(e, dmg, dx * this.def.knock, dy * this.def.knock, crit, 'gun')) killed = true;
      run.fx.sparks(hx, hy, a + Math.PI, 0.9, crit ? 6 : 3, 120, crit ? 0xffe04a : 0xffa040, 0xffffff, 0.18);
      run.fx.light(hx, hy, 14, 0xffa050, 0.5, 0.06);
      if (i === n - 1) endT = t;
      if (bounces > 0 && i === 0) {
        const nxt = run.nearestEnemy(hx, hy, 90, e);
        if (nxt) {
          const na = Math.atan2(nxt.y - hy, nxt.x - hx);
          if (this.ray(hx, hy, na, 90, 0, crit, bounces - 1, 0x9ff0ff, e)) killed = true;
        }
      }
    }
    if (n === 0 || n === pierce + 1) {
      /* ends at last hit or at range */
    }
    const ex = x + dx * endT, ey = y + dy * endT;
    const w = this.def.kind === 'railgun' ? 4 : this.def.kind === 'sniper' ? 2 : 1;
    run.fx.tracer(x, y, ex, ey, color, w, this.def.kind === 'railgun' ? 0.22 : this.def.kind === 'sniper' ? 0.12 : 0.06);
    if (this.def.kind === 'railgun') {
      // sparks along the beam
      for (let i = 0; i < 14; i++) {
        const k = Math.random() * endT;
        run.fx.spawn(PK.Mote, x + dx * k, y + dy * k, rand(-30, 30), rand(-30, 30), rand(0.2, 0.5), 0x63f0ff, { c2: 0xffffff, drag: 4 });
      }
      run.fx.light(ex, ey, 30, 0x63f0ff, 0.8, 0.15);
    }
    return killed;
  }

  /** a grenade bursts: falloff damage, knockback and a lot of fire */
  explode(x: number, y: number, R: number, crit: boolean): boolean {
    const run = this.run;
    const fx = run.fx;
    let killed = false;
    const base = this.dmg() * (crit ? 1.6 : 1);
    for (const e of run.enemies) {
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
      if (d - e.r > R) continue;
      const k = 1 - 0.55 * Math.min(1, d / R);
      const nx = dx / (d || 1), ny = dy / (d || 1);
      if (run.damageEnemy(e, base * k, nx * this.def.knock * k, ny * this.def.knock * k, crit, 'gun')) killed = true;
    }
    fx.flare(x, y, 12, 0xffe0a0, 0.12);
    fx.ring(x, y, 2, R, 0.3, 0xffb050, 3);
    fx.ring(x, y, 2, R * 0.6, 0.18, 0xffffff, 2);
    fx.sparks(x, y, 0, Math.PI, 22, 220, 0xffa040, 0xffffff, 0.45);
    fx.shards(x, y, 8, 0x5a4a40, 0x2a2420, 1.1);
    for (let i = 0; i < 6; i++) fx.spawn(PK.Ember, x + rand(-6, 6), y + rand(-6, 6), rand(-30, 30), rand(-50, -10), rand(0.5, 1), 0xff8a2a, { c2: 0xffe080 });
    fx.smoke(x, y, 8, 0x3a3030, 5, 1.3);
    fx.light(x, y, R * 2.6, 0xffa050, 1.3, 0.3);
    run.shake(6);
    run.hitstop(0.05);
    sfx.explode();
    return killed;
  }

  // ---------------- choreography ----------------
  private reloadEvents(u0: number, u1: number) {
    const at = (k: number) => u0 < k && u1 >= k;
    const fx = this.run.fx;
    const X = new Xf(null as unknown as Gfx, this.hx, this.hy, this.aim, this.fy);
    switch (this.def.kind) {
      case 'pistol':
        if (at(0.18)) {
          const [x, y] = X.pt(-0.5, 4);
          fx.chunk(x, y, Math.cos(this.aim) * -20, 25, 0x7d8299, 3, 1.5);
          sfx.foley('mag_out');
        }
        if (at(0.56)) sfx.foley('mag_in');
        if (at(0.78)) sfx.foley('slide');
        break;
      case 'revolver':
        if (at(0.05)) sfx.foley('cyl_open');
        if (at(0.2)) {
          for (let i = 0; i < 6; i++) this.ejectCasing(0xe8b64a, 2, 1);
        }
        for (const k of [0.3, 0.36, 0.42, 0.48]) if (at(k)) sfx.foley('shell_in', 0.7, 1 + Math.random() * 0.1);
        if (at(0.53)) sfx.foley('cyl_close');
        if (at(0.56)) sfx.foley('cyl_spin', 0.6, 1.2);
        if (at(0.6) || at(0.78)) sfx.spin();
        if (at(0.97)) {
          this.kickV += 25;
          sfx.click(1.4);
        }
        break;
      case 'smg':
        if (at(0.16)) {
          const [x, y] = X.pt(4, 5);
          fx.chunk(x, y, Math.cos(this.aim) * -15, 30, 0x2a2a38, 2, 6);
          sfx.foley('smg_out');
        }
        if (at(0.58)) sfx.foley('smg_in');
        if (at(0.8)) sfx.foley('smg_bolt');
        break;
      case 'shotgun': {
        const T = this.rdur * this.run.mods.reloadSpd;
        const per = this.def.reload;
        for (let i = 0; i < this.shellsToLoad; i++) {
          const k = (0.18 + per * (i + 0.6)) / T;
          if (at(k)) {
            this.ammo = Math.min(this.magSize(), this.ammo + 1);
            this.kickV -= 18;
            sfx.foley('shell_load', 0.8, 1 + Math.random() * 0.08);
          }
        }
        const pumpAt = (0.18 + this.shellsToLoad * per + 0.06) / T;
        const pumpAt2 = (0.18 + this.shellsToLoad * per + 0.18) / T;
        if (at(pumpAt)) sfx.foley('pump_back');
        if (at(pumpAt2)) sfx.foley('pump_fwd');
        break;
      }
      case 'sniper':
        if (at(0.03)) sfx.foley('bolt_up');
        if (at(0.1)) sfx.foley('bolt_back');
        if (at(0.3)) sfx.foley('clip');
        for (const k of [0.4, 0.48, 0.56]) if (at(k)) sfx.foley('shell_in', 0.6, 1.1);
        if (at(0.72)) sfx.foley('bolt_fwd');
        if (at(0.83)) sfx.foley('bolt_down');
        break;
      case 'minigun':
        if (at(0.2)) {
          const [x, y] = X.pt(-4, 4);
          fx.chunk(x, y, Math.cos(this.aim) * -10, 20, 0x56603a, 6, 4, 2.2);
          sfx.foley('box_out');
          sfx.foley('slam2', 0.5, 1.3);
        }
        if (at(0.6)) sfx.foley('box_in');
        if (at(0.7)) sfx.foley('belt');
        if (at(0.8)) sfx.spin();
        break;
      case 'railgun':
        if (at(0.1)) sfx.foley('smg_out', 0.8, 0.8);
        if (at(0.18)) {
          const [x, y] = X.pt(-7, 1);
          fx.chunk(x, y, Math.cos(this.aim) * -15, 25, 0x63f0ff, 3, 2);
          fx.smoke(x, y, 4, 0x8a96aa, 3, 1);
          sfx.foley('dash', 0.4, 0.6);
        }
        if (u1 > 0.2 && u1 < 0.5 && Math.random() < 0.35) {
          const [x, y] = X.pt(rand(0, 16), -4);
          fx.smoke(x, y, 1, 0x9aa6ba, 2, 0.8);
        }
        if (at(0.6)) sfx.foley('mag_in', 0.8, 0.85);
        if (at(0.68)) sfx.charge();
        if (at(0.95)) sfx.foley('smg_bolt', 0.7, 0.8);
        break;
      case 'derringer':
        if (at(0.08)) sfx.foley('break_open', 0.8, 1.3);
        if (at(0.18)) {
          for (let i = 0; i < 2; i++) this.ejectCasing(0xe8b64a, 1.5, 1);
        }
        if (at(0.42) || at(0.62)) sfx.foley('breech', 0.7, 1.2);
        if (at(0.86)) sfx.foley('break_shut', 0.9, 1.3);
        break;
      case 'lever':
      case 'launcher': {
        const T = this.rdur * this.run.mods.reloadSpd;
        const per = this.def.reload;
        if (at(0.05)) sfx.foley(this.def.kind === 'lever' ? 'hammer' : 'cyl_open', 0.7, this.def.kind === 'launcher' ? 0.7 : 1);
        for (let i = 0; i < this.shellsToLoad; i++) {
          const k = (0.18 + per * (i + 0.6)) / T;
          if (at(k)) {
            this.ammo = Math.min(this.magSize(), this.ammo + 1);
            this.kickV -= 15;
            if (this.def.kind === 'launcher') this.drumTo += 1;
            sfx.foley(this.def.kind === 'lever' ? 'gate' : 'shell_load', 0.8, this.def.kind === 'launcher' ? 0.8 : 1 + Math.random() * 0.08);
          }
        }
        const endAt = (0.18 + this.shellsToLoad * per + 0.1) / T;
        if (at(endAt)) sfx.foley(this.def.kind === 'lever' ? 'lever' : 'cyl_close', 0.85, this.def.kind === 'launcher' ? 0.7 : 1);
        break;
      }
      case 'rifle':
        if (at(0.15)) {
          const [x, y] = X.pt(3, 5);
          fx.chunk(x, y, Math.cos(this.aim) * -15, 30, 0x1a1a24, 2, 5);
          sfx.foley('ar_out');
        }
        if (at(0.55)) sfx.foley('ar_in');
        if (at(0.64)) {
          // palm slap on the bottom of the magazine
          this.kickV -= 22;
          sfx.foley('mag_in', 0.5, 1.3);
        }
        if (at(0.8)) sfx.foley('ar_bolt');
        break;
      case 'laser':
        if (at(0.04)) sfx.foley('vent', 0.8);
        if (u1 > 0.08 && u1 < 0.8 && Math.random() < 0.55) {
          const [x, y] = X.pt(rand(-1, 6), -7);
          fx.spawn(PK.Smoke, x, y, rand(-8, 8), rand(-40, -20), rand(0.4, 0.8), 0xe8eaf4, { s: rand(1.2, 2.4), drag: 3 });
        }
        if (at(0.45)) sfx.foley('cool', 0.7);
        if (at(0.9)) sfx.click(1.4);
        break;
      case 'dbarrel':
        if (at(0.05)) sfx.foley('break_open');
        if (at(0.14)) {
          // spent shells fly up and out over the shoulder
          for (let i = 0; i < 2; i++) {
            const [ex, ey] = X.pt(2, -2);
            fx.casing(ex, ey, this.aim + Math.PI + rand(-0.4, 0.4), 0xd0403a, 3, 1.6);
          }
        }
        if (at(0.45) || at(0.62)) sfx.foley('shell_breech', 0.8, 1 + Math.random() * 0.06);
        if (at(0.84)) sfx.foley('break_shut', 1);
        break;
      case 'cannon':
        if (at(0.2)) {
          const [x, y] = X.pt(-1, 5);
          fx.chunk(x, y, Math.cos(this.aim) * -25, 30, 0x7d8299, 3.4, 1.6);
          sfx.foley('mag_out', 0.9, 0.85);
        }
        if (at(0.58)) sfx.foley('mag_in', 1, 0.85);
        if (at(0.8)) {
          sfx.foley('slide', 1, 0.8);
          this.kickV += 30;
        }
        break;
      case 'musket':
        if (at(0.12)) {
          // powder poured down the muzzle
          const [x, y] = X.pt(27, -3);
          for (let i = 0; i < 6; i++) fx.spawn(PK.Dust, x, y, rand(-10, 10), rand(-10, 5), rand(0.3, 0.6), 0x3a3430, { s: rand(1, 2), drag: 5 });
          sfx.foley('sheathe', 0.3, 0.7);
        }
        if (at(0.26)) sfx.foley('sheathe', 0.6, 1.1);
        for (const k of [0.4, 0.5, 0.6]) if (at(k)) sfx.foley('click', 0.45, 0.7);
        if (at(0.72)) sfx.foley('sheathe', 0.5, 1.3);
        if (at(0.88)) {
          this.hammer = 1;
          sfx.foley('hammer', 0.9);
        }
        break;
    }
  }

  private cycleEvents(c0: number, c1: number) {
    const at = (k: number) => c0 < k && c1 >= k;
    if (this.def.kind === 'shotgun') {
      if (at(0.12)) sfx.foley('pump_back');
      if (at(0.45)) this.ejectCasing(0xd0403a, 3, 1.6);
      if (at(0.62)) sfx.foley('pump_fwd');
    } else if (this.def.kind === 'sniper') {
      if (at(0.02)) sfx.foley('bolt_up', 0.7);
      if (at(0.22)) sfx.foley('bolt_back', 0.7);
      if (at(0.45)) this.ejectCasing(0xe8b64a, 3, 1);
      if (at(0.5)) sfx.foley('bolt_fwd', 0.7);
      if (at(0.8)) sfx.foley('bolt_down', 0.7);
    } else if (this.def.kind === 'lever') {
      if (at(0.35)) sfx.foley('lever', 0.8);
      if (at(0.5)) this.ejectCasing(0xe8b64a, 2.4, 1);
    } else if (this.def.kind === 'launcher') {
      if (at(0.4)) sfx.click(0.6);
    }
  }

  private flourishEvents(f0: number, f1: number) {
    const at = (k: number) => f0 < k && f1 >= k;
    const kind = this.def.kind;
    if (at(0.02) && (kind === 'pistol' || kind === 'revolver' || kind === 'shotgun')) sfx.spin();
    if (kind === 'revolver' && at(0.4)) sfx.spin();
    if (kind === 'shotgun' && at(0.74)) sfx.foley('pump_back', 0.6);
    if (kind === 'shotgun' && at(0.88)) sfx.foley('pump_fwd', 0.6);
    if (kind === 'sniper' && at(0.2)) sfx.foley('bolt_up', 0.5);
    if (kind === 'sniper' && at(0.75)) sfx.foley('bolt_down', 0.5);
    if (kind === 'smg' && at(0.4)) sfx.foley('smg_in', 0.4, 1.1);
    if (kind === 'minigun' && at(0.05)) sfx.spin();
    if (kind === 'revolver' && at(0.92)) sfx.click(1.4);
    if ((kind === 'derringer' || kind === 'dbarrel' || kind === 'cannon' || kind === 'laser' || kind === 'lever') && at(0.02)) sfx.spin();
    if (kind === 'lever' && at(0.6)) sfx.foley('lever', 0.6);
    if (kind === 'rifle' && at(0.3)) sfx.foley('ar_bolt', 0.4, 1.2);
    if (kind === 'launcher' && at(0.1)) sfx.foley('cyl_spin', 0.5, 0.7);
    if (kind === 'musket' && at(0.5)) sfx.foley('hammer', 0.5);
  }

  /** compute the animated pose: local rotation, offsets, spin about a pivot, parts */
  computePose(handC: number, swordUsingOffhand: boolean) {
    const p = this.pose;
    Object.assign(p, blankPose());
    p.handC = handC;
    const kind = this.def.kind;
    const h = this.hold;
    let rot = -this.climb + this.yaw; // negative = muzzle up
    let du = -this.kick, dv = 0;
    let spin = 0;
    let drumSpin = 0;
    let pivot: [number, number] = [1, 0];
    let hand2: [number, number] | null = h.two && !swordUsingOffhand ? [...h.fore] : null;

    if (this.cycle >= 0) {
      const c = this.cycle;
      const bump = Math.sin(Math.min(1, c) * Math.PI);
      if (kind === 'shotgun') {
        p.pump = bump;
        rot += -0.12 * bump;
        if (hand2) hand2 = [h.fore[0] - bump * 4, h.fore[1]];
      } else if (kind === 'sniper') {
        p.boltUp = c < 0.2 ? ease.outCubic(c / 0.2) : c > 0.8 ? 1 - ease.inOutCubic((c - 0.8) / 0.2) : 1;
        p.bolt = c < 0.2 ? 0 : c < 0.45 ? ease.outCubic((c - 0.2) / 0.25) : c < 0.75 ? 1 - ease.inOutCubic((c - 0.45) / 0.3) : 0;
        rot += 0.1 * bump;
        hand2 = [-1 - p.bolt * 3, 0 - p.boltUp * 3];
      } else if (kind === 'lever') {
        // spin-cock: the whole carbine whips round the lever loop
        spin = ease.inOutCubic(Math.min(1, c)) * TAU;
        pivot = [1, -1];
        p.lever = Math.sin(seg(c, 0.2, 0.7) * Math.PI);
      }
    }

    if (this.reloading) {
      const u = clamp(this.rt / this.rdur, 0, 1);
      const sm = (a: number, b: number) => ease.inOutCubic(seg(u, a, b));
      switch (kind) {
        case 'pistol': {
          const tilt = sm(0, 0.14) * (1 - sm(0.66, 0.82));
          rot += -0.75 * tilt;
          du -= 2 * tilt;
          p.mag = u < 0.18 ? 0 : u < 0.42 ? -1 : (1 - ease.outBack(seg(u, 0.42, 0.58))) * 7;
          if (u > 0.36 && u < 0.62) hand2 = [-0.5, 5 + p.mag * 0.8];
          p.slide = u < 0.72 ? 0 : u < 0.79 ? ease.outCubic(seg(u, 0.72, 0.79)) : 1 - ease.outExpo(seg(u, 0.79, 0.84));
          if (u > 0.68 && u < 0.86) hand2 = [-1 - p.slide * 3, -4];
          break;
        }
        case 'revolver': {
          p.cyl = u < 0.53 ? ease.outBack(seg(u, 0, 0.08)) : 1 - ease.outExpo(seg(u, 0.53, 0.56));
          const flick = sm(0.1, 0.18) * (1 - sm(0.24, 0.32));
          rot += -1.2 * flick + 0.25 * sm(0.0, 0.08) * (1 - sm(0.1, 0.16));
          if (u > 0.26 && u < 0.52) hand2 = [1 + Math.sin(u * 60) * 0.5, 1.5];
          // the twirl: two full turns around the trigger finger, fast in, eased out
          if (u > 0.56) spin = ease.outCubic(seg(u, 0.56, 0.98)) * TAU * 2;
          pivot = [1, -1];
          break;
        }
        case 'smg': {
          const cant = sm(0, 0.12) * (1 - sm(0.86, 1));
          rot += 1.0 * cant;
          du -= 3 * cant;
          dv -= 1 * cant;
          p.mag = u < 0.16 ? 0 : u < 0.42 ? -1 : (1 - ease.outBack(seg(u, 0.42, 0.6))) * 9;
          if (u > 0.38 && u < 0.64) hand2 = [4, 6 + p.mag * 0.8];
          p.handle = u < 0.72 ? 0 : u < 0.82 ? ease.outCubic(seg(u, 0.72, 0.82)) : 1 - ease.outExpo(seg(u, 0.82, 0.87));
          if (u > 0.68 && u < 0.9) hand2 = [5 - p.handle * 3, -5];
          break;
        }
        case 'shotgun': {
          const T = this.rdur * this.run.mods.reloadSpd;
          const tt = this.rt * this.run.mods.reloadSpd;
          const per = this.def.reload;
          const loadEnd = 0.18 + this.shellsToLoad * per;
          const tilt = ease.inOutCubic(clamp(tt / 0.18, 0, 1)) * (1 - ease.inOutCubic(clamp((tt - loadEnd) / 0.12, 0, 1)));
          rot += -0.45 * tilt;
          dv -= 1.5 * tilt;
          if (tt > 0.18 && tt < loadEnd) {
            const ph = ((tt - 0.18) % per) / per;
            // hand dips to the belt, comes up and thumbs the shell into the port
            const push = ph < 0.5 ? ease.outCubic(ph / 0.5) : 1 - ease.inCubic((ph - 0.5) / 0.5) * 0.2;
            hand2 = [1 - push * 1.5, 6 - push * 5];
          } else if (tt >= loadEnd) {
            const pk = clamp((tt - loadEnd) / Math.max(0.01, T - loadEnd), 0, 1);
            p.pump = Math.sin(pk * Math.PI);
            hand2 = [h.fore[0] - p.pump * 4, h.fore[1]];
          }
          break;
        }
        case 'sniper': {
          const tilt = sm(0, 0.1) * (1 - sm(0.86, 1));
          rot += 0.35 * tilt;
          p.boltUp = u < 0.08 ? ease.outCubic(seg(u, 0, 0.08)) : u > 0.82 ? 1 - ease.inOutCubic(seg(u, 0.82, 0.88)) : 1;
          p.bolt = u < 0.08 ? 0 : u < 0.18 ? ease.outCubic(seg(u, 0.08, 0.18)) : u < 0.7 ? 1 : 1 - ease.inOutCubic(seg(u, 0.7, 0.8));
          if (u < 0.2 || u > 0.66) hand2 = [-1 - p.bolt * 3, -p.boltUp * 3];
          else {
            const ph = ((u - 0.2) / 0.46) * 5;
            const k = ph - Math.floor(ph);
            hand2 = [-2, -6 + Math.sin(k * Math.PI) * 2];
          }
          break;
        }
        case 'minigun': {
          const tilt = sm(0, 0.15) * (1 - sm(0.8, 0.95));
          rot += 0.3 * tilt;
          du -= 2 * tilt;
          p.box = u < 0.2 ? 0 : u < 0.45 ? -1 : (1 - ease.outBack(seg(u, 0.45, 0.62))) * 10;
          if (u > 0.4 && u < 0.66) hand2 = [-3.5, 6 + p.box];
          if (u > 0.78) this.barrel += 0.6;
          break;
        }
        case 'railgun': {
          const tilt = sm(0, 0.1) * (1 - sm(0.92, 1));
          rot += -0.3 * tilt;
          p.gap = sm(0.02, 0.12) * (1 - sm(0.92, 0.98));
          p.cell = u < 0.18 ? 0 : u < 0.48 ? -1 : (1 - ease.outBack(seg(u, 0.48, 0.62))) * 6;
          p.cells = u < 0.15 ? 4 * (1 - seg(u, 0, 0.15)) : u < 0.68 ? 0 : 4 * seg(u, 0.68, 0.94);
          if (u > 0.44 && u < 0.66) hand2 = [-6.5, 1 + p.cell];
          break;
        }
        case 'derringer': {
          const tilt = sm(0, 0.12) * (1 - sm(0.84, 0.94));
          rot += 0.55 * tilt;
          p.tip = tilt;
          if (u > 0.28 && u < 0.76) hand2 = [1.5, -5 + Math.sin(((u - 0.28) / 0.24) * Math.PI) * 1.2];
          break;
        }
        case 'lever':
        case 'launcher': {
          const T = this.rdur * this.run.mods.reloadSpd;
          const tt = this.rt * this.run.mods.reloadSpd;
          const per = this.def.reload;
          const loadEnd = 0.18 + this.shellsToLoad * per;
          const tilt = ease.inOutCubic(clamp(tt / 0.18, 0, 1)) * (1 - ease.inOutCubic(clamp((tt - loadEnd) / 0.14, 0, 1)));
          if (kind === 'lever') {
            rot += -0.35 * tilt;
            if (tt > 0.18 && tt < loadEnd) {
              const ph = ((tt - 0.18) % per) / per;
              const push = ph < 0.5 ? ease.outCubic(ph / 0.5) : 1 - ease.inCubic((ph - 0.5) / 0.5) * 0.3;
              hand2 = [-0.5, 3 - push * 5];
            } else if (tt >= loadEnd) p.lever = Math.sin(clamp((tt - loadEnd) / Math.max(0.01, T - loadEnd), 0, 1) * Math.PI);
          } else {
            rot += 0.3 * tilt;
            p.drumOut = tilt;
            if (tt > 0.18 && tt < loadEnd) {
              const ph = ((tt - 0.18) % per) / per;
              const push = ph < 0.5 ? ease.outCubic(ph / 0.5) : 1 - ease.inCubic((ph - 0.5) / 0.5) * 0.3;
              hand2 = [4, 4 - push * 3];
            }
          }
          break;
        }
        case 'rifle': {
          const cant = sm(0, 0.12) * (1 - sm(0.86, 1));
          rot += 0.7 * cant;
          du -= 2 * cant;
          p.mag = u < 0.15 ? 0 : u < 0.4 ? -1 : (1 - ease.outBack(seg(u, 0.4, 0.56))) * 8;
          if (u > 0.36 && u < 0.58) hand2 = [3, 6 + p.mag * 0.8];
          if (u > 0.58 && u < 0.7) hand2 = [3.5, 6.5 - Math.sin(seg(u, 0.6, 0.68) * Math.PI) * 2];
          p.handle = u < 0.74 ? 0 : u < 0.8 ? ease.outCubic(seg(u, 0.74, 0.8)) : 1 - ease.outExpo(seg(u, 0.8, 0.85));
          if (u > 0.72 && u < 0.88) hand2 = [-2 - p.handle * 3, -5.4];
          break;
        }
        case 'laser': {
          const tilt = sm(0, 0.1) * (1 - sm(0.88, 1));
          rot += -0.6 * tilt;
          p.fins = sm(0.02, 0.12) * (1 - sm(0.86, 0.95));
          p.heat = 1 - seg(u, 0.1, 0.85);
          break;
        }
        case 'dbarrel': {
          p.brk = sm(0, 0.1) * (1 - sm(0.8, 0.86));
          const flick = Math.sin(seg(u, 0.76, 0.92) * Math.PI);
          rot += 0.35 * p.brk - 0.75 * flick;
          if (u > 0.3 && u < 0.7) hand2 = [2.5, -1 + Math.sin(((u - 0.3) / 0.2) * Math.PI) * 1.5];
          break;
        }
        case 'cannon': {
          const tilt = sm(0, 0.14) * (1 - sm(0.66, 0.82));
          rot += -0.85 * tilt;
          du -= 2 * tilt;
          p.mag = u < 0.2 ? 0 : u < 0.42 ? -1 : (1 - ease.outBack(seg(u, 0.42, 0.58))) * 8;
          if (u > 0.36 && u < 0.62) hand2 = [-1, 6 + p.mag * 0.8];
          p.slide = u < 0.72 ? 0 : u < 0.79 ? ease.outCubic(seg(u, 0.72, 0.79)) : 1 - ease.outExpo(seg(u, 0.79, 0.84));
          if (u > 0.68 && u < 0.86) hand2 = [-1.5 - p.slide * 3.5, -5];
          break;
        }
        case 'musket': {
          // muzzle up, powder, ramrod out, three strokes, ramrod home, lower, cock
          const up = sm(0, 0.1) * (1 - sm(0.76, 0.86));
          rot += -1.15 * up;
          du -= 3 * up;
          if (u >= 0.24 && u < 0.74) {
            const depth = u < 0.34 ? 0.15 : u < 0.66 ? 0.35 + 0.6 * Math.abs(Math.sin(((u - 0.34) / 0.32) * Math.PI * 3)) : 0.6 * (1 - seg(u, 0.66, 0.74));
            p.rod = depth;
            hand2 = [27 - depth * 18 + 19.5, -3.6];
          } else if (u > 0.1 && u < 0.24) hand2 = [26, -5];
          break;
        }
      }
    }

    if (this.flourish >= 0) {
      const f = this.flourish;
      switch (kind) {
        case 'pistol':
          spin = ease.outCubic(f) * TAU;
          pivot = [1, -1];
          break;
        case 'revolver': {
          // forward two turns, then a reverse half turn back into the hand
          spin = f < 0.65 ? ease.outCubic(f / 0.65) * TAU * 2 : TAU * 2 - ease.inOutCubic((f - 0.65) / 0.35) * TAU;
          pivot = [1, -1];
          break;
        }
        case 'smg':
          rot += 1.0 * Math.sin(f * Math.PI);
          p.mag = Math.max(0, Math.sin(seg(f, 0.3, 0.6) * Math.PI) * 2);
          if (f > 0.25 && f < 0.7) hand2 = [4, 5 + p.mag];
          break;
        case 'shotgun':
          // spin-cock: the whole gun flips around the pump hand, racks at the bottom
          spin = ease.inOutCubic(seg(f, 0, 0.75)) * TAU;
          pivot = [8, -1];
          p.pump = Math.sin(seg(f, 0.72, 0.95) * Math.PI);
          hand2 = null;
          break;
        case 'sniper':
          p.boltUp = Math.sin(seg(f, 0.1, 0.9) * Math.PI) > 0 ? Math.min(1, Math.sin(seg(f, 0.1, 0.9) * Math.PI) * 2) : 0;
          p.bolt = Math.sin(seg(f, 0.3, 0.7) * Math.PI);
          rot += 0.15 * Math.sin(f * Math.PI);
          hand2 = [-1 - p.bolt * 3, -p.boltUp * 3];
          break;
        case 'minigun':
          this.barrel += 0.5 * Math.sin(f * Math.PI);
          rot += -0.08 * Math.sin(f * Math.PI * 2);
          break;
        case 'railgun':
          p.cells = 4 * (0.6 + 0.4 * Math.cos(f * TAU * 2));
          p.gap = 0.4 * Math.sin(f * Math.PI);
          break;
        case 'derringer':
          // palm flip: tucked away and back out
          spin = ease.inOutCubic(seg(f, 0, 0.45)) * Math.PI - ease.inOutCubic(seg(f, 0.55, 1)) * Math.PI;
          pivot = [0, 0.5];
          break;
        case 'lever':
          spin = ease.outCubic(f) * TAU * 2;
          pivot = [1, -1];
          p.lever = Math.sin(seg(f, 0.5, 0.8) * Math.PI);
          break;
        case 'rifle':
          rot += 0.5 * Math.sin(f * Math.PI);
          p.handle = Math.sin(seg(f, 0.3, 0.6) * Math.PI) * 0.6;
          if (f > 0.25 && f < 0.65) hand2 = [-2 - p.handle * 3, -5.4];
          break;
        case 'laser':
        case 'cannon':
          spin = ease.outCubic(f) * TAU;
          pivot = [1, -1.2];
          break;
        case 'dbarrel':
          spin = ease.inOutCubic(f) * TAU;
          pivot = [0.5, 0];
          break;
        case 'musket':
          rot += -0.9 * Math.sin(f * Math.PI);
          du -= 2 * Math.sin(f * Math.PI);
          break;
        case 'launcher':
          drumSpin = ease.outCubic(f) * 4;
          break;
      }
    }
    if (kind === 'railgun') p.charge = this.charge;
    if (kind === 'launcher') p.drum = this.drum + drumSpin;
    if (kind === 'musket') {
      p.hammer = this.hammer;
      p.pan = this.pan;
    }
    if (this.def.heat && !this.reloading) p.heat = 1 - this.ammo / this.magSize();
    p.barrel = this.barrel;
    p.hand2 = hand2;
    // while twirling, the hand stays at the pivot (trigger finger / pump grip)
    const grip: [number, number] = spin !== 0 ? pivot : [0, 0.5];
    return { rot, du, dv, spin, pivot, grip };
  }

  /** part: 'all', or the gun alone / the hands alone so the body can sit between them */
  draw(g: Gfx, handC: number, swordUsingOffhand: boolean, time: number, part: 'all' | 'gun' | 'hands' = 'all') {
    const { rot, du, dv, spin, pivot, grip } = this.computePose(handC, swordUsingOffhand);
    const fy = this.fy;
    const base = this.aim + rot * fy;
    // spin about a pivot in local space: origin' = P + R(spin)(-P)
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const ou = pivot[0] + (-pivot[0] * cs + pivot[1] * sn) + du;
    const ov = pivot[1] + (-pivot[0] * sn - pivot[1] * cs) + dv;
    const bx = new Xf(g, this.hx, this.hy, base, fy);
    const [wx, wy] = bx.pt(ou, ov);
    const X = new Xf(g, wx, wy, base + spin * fy, fy);
    this.drawAng = base + spin * fy;
    const h2 = this.pose.hand2;
    if (part !== 'hands') {
      if (part === 'gun') this.pose.hand2 = null;
      drawGun(X, this.def.kind, this.pose, time);
      this.pose.hand2 = h2;
    }
    if (part !== 'gun') {
      if (part === 'hands' && h2) hand(X, h2[0], h2[1], handC);
      hand(X, grip[0], grip[1], handC);
    }
  }
}

// =====================================================================
// Sword
// =====================================================================
type SState = 'rest' | 'windup' | 'swing' | 'hold' | 'recover' | 'deflect';

interface TrailPt { tx: number; ty: number; mx: number; my: number; age: number }

type Motion = 'arc' | 'thrust' | 'jabs' | 'double' | 'handspin' | 'whip';
/**
 * One technique in a sword's combo.
 * dir: which way the blade travels on screen. 'up' = rising cut (from below to above),
 * 'down' = overhead cut, 'alt' = opposite of the previous cut, 'rest' = starting from where the blade rests.
 */
interface Move {
  m: Motion;
  dir: 'up' | 'down' | 'alt' | 'rest';
  /** radians swept (arc / double); over 2*PI is a spinning cut */
  span: number;
  /** starts further back on the starting side */
  bias?: number;
  /** wind-up pull-back past the start */
  cock?: number;
  /** hand distance at start / end, and an outward bulge mid-swing (elliptical path) */
  rIn?: number;
  rOut?: number;
  bulge?: number;
  /** timing multipliers on the sword's windup / swing / hold / recover */
  tw?: number;
  ts?: number;
  th?: number;
  tr?: number;
  dmg?: number;
  reach?: number;
  lunge?: number;
  /** blade twirls in the hand during recovery (turns) */
  twirl?: number;
  /** the whole body spins with the cut */
  body?: boolean;
  /** jump into the cut (rising) / crouch into it (overhead) */
  hop?: number;
  /** thrusts: the spear-style full twirl on the way in */
  twirlIn?: boolean;
  /** finisher: bigger hit-stop and shake */
  fin?: boolean;
}
const S = Math.PI;
/** each sword's combo; quick follow-ups walk through it, a pause starts over */
const MOVES: Record<SwordKind, Move[]> = {
  dagger: [
    { m: 'arc', dir: 'rest', span: 2.0, rIn: 7, rOut: 10, bulge: 2 },
    { m: 'arc', dir: 'alt', span: 2.2, rIn: 6, rOut: 10, bulge: 2, twirl: 1 },
    { m: 'arc', dir: 'up', span: S * 2 + 0.4, rIn: 5, rOut: 6, ts: 2.6, body: true, dmg: 1.3, twirl: 2, fin: true },
  ],
  longsword: [
    { m: 'arc', dir: 'down', span: 2.6, bias: 0.3, rIn: 6, rOut: 10, bulge: 3, hop: -1 },
    { m: 'arc', dir: 'up', span: 2.9, bias: 0.5, rIn: 5, rOut: 11, bulge: 3, hop: 1 },
    { m: 'thrust', dir: 'rest', span: 0, ts: 1.3, reach: 1.35, lunge: 1.6, dmg: 1.4, fin: true, twirl: 1 },
  ],
  rapier: [
    { m: 'thrust', dir: 'rest', span: 0 },
    { m: 'thrust', dir: 'rest', span: 0, ts: 0.85 },
    { m: 'arc', dir: 'up', span: 2.4, rIn: 6, rOut: 12, bulge: 4, dmg: 1.2, twirl: 1 },
    { m: 'thrust', dir: 'rest', span: 0, ts: 1.4, reach: 1.4, lunge: 2.2, dmg: 1.6, fin: true },
  ],
  katana: [
    { m: 'arc', dir: 'up', span: 3.6, bias: 0.3, rIn: 6, rOut: 11, bulge: 3 },
    { m: 'arc', dir: 'alt', span: 3.0, rIn: 8, rOut: 10, bulge: 2, tw: 0.6, th: 0.4 },
    { m: 'arc', dir: 'down', span: S * 2 + 0.8, rIn: 7, rOut: 7, ts: 2.2, body: true, dmg: 1.5, fin: true },
  ],
  greatsword: [
    { m: 'arc', dir: 'down', span: 3.2, bias: 0.6, cock: 0.7, rIn: 5, rOut: 10, bulge: 3, hop: -1 },
    { m: 'arc', dir: 'up', span: 3.4, bias: 0.4, rIn: 6, rOut: 11, bulge: 2, hop: 1, ts: 1.1 },
    { m: 'arc', dir: 'down', span: S * 2 + 0.6, rIn: 6, rOut: 6, ts: 2.3, body: true, dmg: 1.5, fin: true },
  ],
  scythe: [
    { m: 'arc', dir: 'down', span: S * 2 + 0.6, rIn: 4, rOut: 5, body: true },
    { m: 'arc', dir: 'alt', span: S * 2 + 0.6, rIn: 4, rOut: 5, body: true },
    { m: 'arc', dir: 'up', span: S * 4 + 0.6, rIn: 5, rOut: 6, ts: 1.7, body: true, dmg: 1.4, fin: true },
  ],
  saber: [
    { m: 'double', dir: 'down', span: 2.2, rIn: 8, rOut: 9, bulge: 2 },
    { m: 'arc', dir: 'up', span: 2.8, bias: 0.4, rIn: 6, rOut: 11, bulge: 3, hop: 1, twirl: 1 },
    { m: 'thrust', dir: 'rest', span: 0, reach: 1.3, lunge: 1.5, dmg: 1.5, fin: true },
  ],
  cleaver: [
    { m: 'arc', dir: 'down', span: 1.6, bias: 0.6, cock: 1.0, rIn: 5, rOut: 9, hop: -1 },
    { m: 'arc', dir: 'alt', span: 1.8, rIn: 6, rOut: 9, bulge: 2 },
    { m: 'arc', dir: 'down', span: S * 2 + 0.4, rIn: 6, rOut: 6, ts: 2.6, body: true, dmg: 1.6, fin: true },
  ],
  katar: [
    { m: 'jabs', dir: 'rest', span: 0 },
    { m: 'jabs', dir: 'rest', span: 0, ts: 0.8 },
    { m: 'arc', dir: 'up', span: 2.2, rIn: 4, rOut: 11, bulge: 2, hop: 1, dmg: 1.5, fin: true },
  ],
  spear: [
    { m: 'thrust', dir: 'rest', span: 0, twirlIn: true },
    { m: 'arc', dir: 'alt', span: 2.6, rIn: 4, rOut: 6, ts: 1.6, reach: 0.9 },
    { m: 'arc', dir: 'down', span: S * 2 + 0.6, rIn: 2, rOut: 2, ts: 2.6, body: true, reach: 0.85, dmg: 1.3, fin: true },
  ],
  nodachi: [
    { m: 'arc', dir: 'down', span: 4.4, bias: 0.3, rIn: 6, rOut: 9, bulge: 3 },
    { m: 'arc', dir: 'up', span: 3.6, rIn: 7, rOut: 10, bulge: 2, hop: 1 },
    { m: 'arc', dir: 'down', span: S * 2 + 1.0, rIn: 7, rOut: 7, ts: 1.9, body: true, dmg: 1.5, fin: true },
  ],
  twinblade: [
    { m: 'handspin', dir: 'rest', span: 0 },
    { m: 'handspin', dir: 'alt', span: 0 },
    { m: 'arc', dir: 'up', span: S * 2 + 0.6, rIn: 3, rOut: 3, ts: 1.4, body: true, dmg: 1.4, fin: true },
  ],
  whip: [
    { m: 'whip', dir: 'down', span: 2.4 },
    { m: 'whip', dir: 'alt', span: 2.6 },
    { m: 'whip', dir: 'up', span: S * 2 + 0.6, ts: 1.6, body: true, dmg: 1.3, fin: true },
  ],
  plasma: [
    { m: 'arc', dir: 'up', span: 3.2, rIn: 6, rOut: 10, bulge: 3, hop: 1 },
    { m: 'arc', dir: 'alt', span: 3.2, rIn: 6, rOut: 10, bulge: 2 },
    { m: 'arc', dir: 'down', span: S * 3, rIn: 6, rOut: 7, ts: 2.2, body: true, dmg: 1.5, fin: true, twirl: 1 },
  ],
};
/** how much the resting weapon leans toward where you look */
const LEAN: Record<SwordKind, number> = {
  dagger: 0.3, longsword: 0.35, rapier: 1, katana: 0.15, greatsword: 0.2, scythe: 0.2,
  saber: 0.35, cleaver: 0.2, katar: 0.8, spear: 0.3, nodachi: 0.12, twinblade: 0, whip: 0.35, plasma: 0.15,
};
/** where the hand sits on the weapon (local x) */
const GRIP: Record<SwordKind, number> = {
  dagger: -2.5, longsword: -2.5, rapier: -2.5, katana: -3, greatsword: -3, scythe: -2,
  saber: -2.5, cleaver: -2.5, katar: -1, spear: 0, nodachi: -4, twinblade: 0, whip: -2.5, plasma: -2,
};
/** weapons that live in a scabbard at rest */
const SAYA: Partial<Record<SwordKind, number>> = { katana: 18, nodachi: 27 };
const HEAVY: Partial<Record<SwordKind, true>> = { greatsword: true, scythe: true, cleaver: true, nodachi: true };
const WHIP_N = 10;

export class SwordCtl {
  def: SwordDef;
  lvl: number;
  move: Move;
  state: SState = 'rest';
  t = 0;
  cd = 0;
  side = 1;
  aim = 0;
  restAim = 0;
  /** where the whole body faces (the gun's aim); the resting blade follows it, not the threat */
  bodyAim: number | null = null;
  /** which way the body faces (+1 right, -1 left) and the smoothed blend between the two */
  facing = 1;
  faceK = 1;
  private sinceFlip = 1;
  private sinceAttack = 9;
  private comboIdx = -1;
  /** sign used to mirror the blade art */
  artFy = 1;
  /** absolute blade angle and hand pos */
  ang = 0;
  hx = 0;
  hy = 0;
  parryT = 0;
  parryAge = 0;
  hit = new Set<Enemy>();
  prevRel = 0;
  trail: TrailPt[] = [];
  trail2: TrailPt[] = [];
  twirl = -1;
  twirlTimer = 1.5;
  combo = 0;
  hitStopDone = false;
  /** body nudges for the owner (lunge, crouch / hop, spin) */
  lunge = 0;
  squash = 0;
  hop = 0;
  bodyRot = 0;
  sheathClick = false;
  /** 0..1: plasma blade ignition / whip extension */
  ext = 0;
  private step = -1;
  chain: { x: number; y: number }[] = [];
  /** parry reaction */
  private defAng = 0;
  private defGuard = 0;
  private defFrom = 0;
  private defSpin = 1;
  private defDur = 0.3;
  private defPerfect = false;
  /** owner centre, set by the player before drawing */
  hx0 = 0;
  hy0 = 0;

  constructor(def: SwordDef, lvl: number, private run: Run) {
    this.def = def;
    this.lvl = lvl;
    this.move = MOVES[def.kind][0];
  }

  get busy() {
    return this.state !== 'rest';
  }
  reach() {
    return this.def.reach * this.run.mods.reach;
  }
  dmg() {
    return this.def.dmg * this.run.mods.swordDmg * (1 + this.lvl * ENHANCE_BONUS);
  }
  parryWindow() {
    return this.def.parry + this.run.mods.parryWin;
  }
  private dur(k: 'w' | 's' | 'h' | 'r') {
    const d = this.def, m = this.move;
    if (k === 'w') return d.windup * (m.tw ?? 1);
    if (k === 's') return d.swing * (m.ts ?? 1);
    if (k === 'h') return d.hold_ * (m.th ?? 1);
    return d.recover * (m.tr ?? 1);
  }

  /** start an attack toward angle a */
  attack(a: number) {
    const canCancel = this.state === 'rest' || this.state === 'recover' || (this.state === 'deflect' && this.t > 0.1);
    if (this.cd > 0 || !canCancel) return false;
    const list = MOVES[this.def.kind];
    // keep the combo going on quick follow-ups, start over after a pause
    this.comboIdx = this.sinceAttack < 0.75 ? (this.comboIdx + 1) % list.length : 0;
    const mv = list[this.comboIdx];
    this.move = mv;
    this.aim = a;
    this.state = 'windup';
    this.t = 0;
    const fin = !!mv.fin;
    this.cd = this.def.cooldown * Math.max(0.35, this.run.mods.swordCd) * (fin ? 1.25 : 1);
    // which way the blade travels on screen
    const face = Math.abs(Math.cos(a)) > 0.2 ? (Math.cos(a) >= 0 ? 1 : -1) : this.facing;
    const restSide = angDiff(a, this.restPose(0).ang) >= 0 ? 1 : -1;
    if (mv.dir === 'up') this.side = face;
    else if (mv.dir === 'down') this.side = -face;
    else if (mv.dir === 'alt') this.side = -this.side;
    else this.side = restSide;
    this.sinceAttack = 0;
    this.combo++;
    this.hit.clear();
    this.hitStopDone = false;
    this.parryT = this.parryWindow();
    this.parryAge = 0;
    this.twirl = -1;
    this.trail.length = 0;
    this.trail2.length = 0;
    this.sheathClick = false;
    this.step = -1;
    const k = this.def.kind;
    if (HEAVY[k] || mv.hop === -1) this.squash = 1;
    if (k === 'plasma' && this.ext < 0.5) sfx.foley('ignite', 0.5, 1.2);
    if (mv.twirlIn) sfx.spin();
    return true;
  }

  /** a successful parry: snap the blade across the blow, ride the recoil, twirl back to guard */
  deflect(threat: number, perfect: boolean, interrupt = true) {
    if (!interrupt && (this.state === 'swing' || this.state === 'windup')) return;
    if (this.motionIs('whip')) return; // the chain whip keeps its own motion
    this.state = 'deflect';
    this.t = 0;
    this.defAng = threat;
    this.defFrom = this.ang;
    // block with the blade crossways, on whichever side it already was
    const g = angDiff(threat, this.ang) >= 0 ? 1 : -1;
    this.defGuard = threat + g * Math.PI * 0.5;
    this.defSpin = g;
    this.defPerfect = perfect;
    this.defDur = perfect ? 0.5 : 0.36;
    this.trail.length = 0;
    this.trail2.length = 0;
    this.lunge = -0.6;
    if (this.def.kind === 'plasma') this.ext = 1;
  }

  private motionIs(m: Motion) {
    return this.move.m === m && this.state !== 'rest' && this.state !== 'deflect';
  }

  /** a parry is active and `a` (angle from owner to threat) is inside the guarded sector */
  guards(a: number) {
    if (this.parryT <= 0) return false;
    if (this.def.arc >= 6 || this.move.span >= 6) return true;
    const half = Math.max(this.def.arc / 2, 1.0) + 0.45;
    return Math.abs(angDiff(this.aim, a)) <= half;
  }
  perfect() {
    return this.parryAge <= 0.075;
  }

  /** swing path, in angles relative to aim */
  private path(): [number, number] {
    const mv = this.move;
    if (mv.m === 'thrust' || mv.m === 'jabs') return [0, 0];
    if (mv.m === 'handspin') return [this.side * Math.PI * 0.5, this.side * (Math.PI * 0.5 + Math.PI * 3)];
    const span = mv.m === 'whip' ? mv.span : mv.span;
    const from = this.side * (span * 0.5 + (mv.bias ?? 0) + (span < 6 ? 0.15 : 0));
    return [from, from - this.side * span];
  }
  /** where the blade ends up after the swing */
  private endRel(): number {
    const [from, to] = this.path();
    return this.move.m === 'double' ? from : to;
  }

  /** rest pose for a body facing right, given the aim folded into the right half */
  private restRight(aimR: number, time: number, spinDir: number): { ang: number; hand: number; dist: number } {
    const t = Math.max(-1.3, Math.min(1.3, angDiff(0, aimR))) * LEAN[this.def.kind];
    switch (this.def.kind) {
      case 'dagger': {
        let spin = 0;
        if (this.twirl >= 0) spin = ease.outCubic(this.twirl) * TAU * 2 * spinDir;
        return { ang: 2.15 + t + spin, hand: 2.3 + t * 0.3, dist: 8 };
      }
      case 'longsword':
        return { ang: 2.75 + t + Math.sin(time * 2) * 0.04, hand: 2.3 + t * 0.3, dist: 8 };
      case 'rapier':
        return { ang: 2.95 + t + Math.sin(time * 3.1) * 0.08, hand: 2.35 + t * 0.3, dist: 8.5 + Math.sin(time * 3.1 + 1) * 0.5 };
      case 'katana':
        return { ang: Math.PI - 0.55 + t, hand: 1.75 + t * 0.3, dist: 6 };
      case 'greatsword':
        return { ang: -Math.PI * 0.82 + t + Math.sin(time * 1.6) * 0.03, hand: -1.45 + t * 0.3, dist: 5 };
      case 'scythe':
        return { ang: -2.1 + t + Math.sin(time * 1.4) * 0.06, hand: 2.4 + t * 0.3, dist: 6.5 };
      case 'saber':
        return { ang: 2.45 + t + Math.sin(time * 2.2) * 0.05, hand: 2.3 + t * 0.3, dist: 8 };
      case 'cleaver':
        return { ang: 1.75 + t, hand: 2.2 + t * 0.3, dist: 7 };
      case 'katar':
        return { ang: 2.6 + t, hand: 2.3 + t * 0.3, dist: 7 + Math.sin(time * 4) * 0.4 };
      case 'spear':
        return { ang: -1.45 + t, hand: 2.4 + t * 0.3, dist: 7 };
      case 'nodachi':
        return { ang: 2.3 + t, hand: -2.15 + t * 0.3, dist: 4 };
      case 'twinblade':
        return { ang: time * 1.6 * spinDir, hand: 2.3, dist: 8 };
      case 'whip':
        return { ang: 2.0 + t + Math.sin(time * 2) * 0.05, hand: 2.3 + t * 0.3, dist: 8 };
      case 'plasma':
        return { ang: 2.6 + t, hand: 2.3 + t * 0.3, dist: 7.5 };
    }
  }

  restPose(time: number): { ang: number; hand: number; dist: number } {
    const a = this.restAim;
    const right = this.restRight(a, time, 1);
    const l = this.restRight(Math.PI - a, time, -1);
    const left = { ang: Math.PI - l.ang, hand: Math.PI - l.hand, dist: l.dist };
    const u = ease.inOutCubic((this.faceK + 1) / 2);
    return {
      ang: left.ang + angDiff(left.ang, right.ang) * u,
      hand: left.hand + angDiff(left.hand, right.hand) * u,
      dist: left.dist + (right.dist - left.dist) * u,
    };
  }

  update(dt: number, px: number, py: number, wantAim: number, time: number) {
    this.cd -= dt;
    const faceAim = this.bodyAim ?? wantAim;
    this.restAim += angDiff(this.restAim, faceAim) * Math.min(1, dt * 12);
    this.sinceFlip += dt;
    this.sinceAttack += dt;
    const c = Math.cos(faceAim);
    if (!this.busy && this.sinceFlip > 0.25 && ((this.facing > 0 && c < -0.3) || (this.facing < 0 && c > 0.3))) {
      this.facing = -this.facing;
      this.sinceFlip = 0;
    }
    const kstep = dt / 0.14;
    this.faceK += Math.max(-kstep, Math.min(kstep, this.facing - this.faceK));
    if (this.parryT > 0) {
      this.parryT -= dt;
      this.parryAge += dt;
    }
    this.squash = Math.max(0, this.squash - dt * 3);
    this.hop = Math.max(0, this.hop - dt * 4);
    this.lunge *= Math.exp(-dt * 10);

    if (this.def.kind === 'dagger' && this.state === 'rest') {
      if (this.twirl >= 0) {
        this.twirl += dt / 0.5;
        if (this.twirl >= 1) this.twirl = -1;
      } else if ((this.twirlTimer -= dt) <= 0) {
        this.twirl = 0;
        this.twirlTimer = rand(1.8, 3.2);
        sfx.spin();
      }
    }

    const def = this.def;
    const k = def.kind;
    const mv = this.move;
    const mo = mv.m;
    const rest = this.restPose(time);
    const [from, to] = this.path();
    const end = this.endRel();
    let dist = rest.dist;
    let absAng = rest.ang, absHand = rest.hand;
    this.t += dt;
    const reach = this.reach() * (mv.reach ?? 1);
    const stabbing = mo === 'thrust' || mo === 'jabs';
    const thrustDist = 9 + reach * (k === 'spear' ? 0.25 : 0.35);
    const rIn = mv.rIn ?? (k === 'scythe' ? 4 : 8), rOut = mv.rOut ?? 9;
    const spinning = mv.span >= 6;

    const advance = (next: SState, dur: number) => {
      if (this.t >= dur) {
        this.t -= dur;
        this.state = next;
        return true;
      }
      return false;
    };

    switch (this.state) {
      case 'rest':
        this.ext = Math.max(0, this.ext - dt * 6);
        this.bodyRot += angDiff(this.bodyRot, 0) * Math.min(1, dt * 14);
        break;
      case 'windup': {
        const W = this.dur('w');
        const u = ease.outCubic(clamp(this.t / W, 0, 1));
        if (mo === 'thrust') {
          absAng = mv.twirlIn ? rest.ang + (angDiff(rest.ang, this.aim) + this.side * TAU) * u : lerpAng(rest.ang, this.aim, u);
          absHand = lerpAng(rest.hand, this.aim + 0.2 * this.side, u);
          dist = lerp(rest.dist, 3.5, u);
        } else if (mo === 'jabs') {
          absAng = lerpAng(rest.ang, this.aim, u);
          absHand = lerpAng(rest.hand, this.aim + 0.3, u);
          dist = lerp(rest.dist, 4, u);
        } else if (mo === 'handspin') {
          absAng = lerpAng(rest.ang, this.aim + from, u);
          absHand = lerpAng(rest.hand, this.aim, u);
          dist = lerp(rest.dist, 9, u);
        } else {
          // pull back past the start of the cut: the coil before the release
          const cock = from + this.side * (mv.cock ?? (HEAVY[k] ? 0.6 : 0.35));
          absAng = lerpAng(rest.ang, this.aim + cock, u);
          absHand = lerpAng(rest.hand, this.aim + cock * (spinning ? 1 : 0.6), u);
          dist = lerp(rest.dist, rIn, u);
        }
        if (k === 'plasma') this.ext = Math.max(this.ext, u);
        if (advance('swing', W)) {
          sfx.swing(k);
          if (mv.fin) sfx.play(['swing_h1', 'swing_h2'], { vol: 0.35, rate: 1.2 });
          this.prevRel = stabbing ? 0 : from;
          this.lunge = mv.lunge ?? (k === 'spear' ? 1.3 : k === 'rapier' ? 1 : mo === 'jabs' ? 0.5 : HEAVY[k] ? 0.6 : 0.35);
          if (mv.hop === 1) this.hop = 1;
          if (mo === 'whip') this.resetChain();
          if (this.run.player) this.run.player.swingFeel(this.aim, this.side, !!HEAVY[k], !!mv.fin);
        }
        break;
      }
      case 'swing': {
        const SW = this.dur('s');
        const u = clamp(this.t / SW, 0, 1);
        if (mo === 'thrust') {
          const e = ease.outExpo(u);
          absAng = this.aim;
          absHand = this.aim + 0.2 * this.side * (1 - e);
          dist = lerp(3.5, thrustDist, e);
          this.sweepThrust(px, py, reach * (0.4 + 0.6 * e), this.aim);
        } else if (mo === 'jabs') {
          const j = Math.min(2, Math.floor(u * 3));
          if (j !== this.step) {
            this.step = j;
            this.hit.clear();
            if (j > 0) sfx.swing(k);
          }
          const f = Math.min(1, u * 3 - j);
          const out = Math.sin(f * Math.PI);
          const off = [-0.2, 0.2, 0][j] * this.side;
          absAng = this.aim + off;
          absHand = this.aim + off * 0.5;
          dist = 4 + out * reach * 0.45;
          this.sweepThrust(px, py, 6 + out * reach, this.aim + off);
        } else if (mo === 'handspin') {
          const pass = Math.min(2, Math.floor(u * 3));
          if (pass !== this.step) {
            this.step = pass;
            this.hit.clear();
            if (pass > 0) sfx.swing(k);
          }
          absAng = this.aim + lerp(from, to, u);
          absHand = this.aim;
          dist = 9;
          this.sweepAround(px + Math.cos(this.aim) * 9, py + Math.sin(this.aim) * 9, reach, px, py);
        } else {
          let rel: number;
          if (mo === 'double') {
            const back = u >= 0.5;
            const step = back ? 1 : 0;
            if (step !== this.step) {
              this.step = step;
              if (back) {
                this.hit.clear();
                this.prevRel = to;
                sfx.swing(k);
              }
            }
            rel = back ? lerp(to, from, ease.outQuart((u - 0.5) * 2)) : lerp(from, to, ease.outQuart(u * 2));
          } else {
            // fast attack, long follow-through; spins carry an even speed so they read as one motion
            rel = lerp(from, to, spinning ? ease.inOutSine(u) * 0.35 + ease.outCubic(u) * 0.65 : ease.outQuart(u));
            // a fresh cut every full turn of a spin
            if (spinning) {
              const turn = Math.floor(Math.abs(rel - from) / TAU);
              if (turn !== this.step) {
                if (this.step >= 0) {
                  this.hit.clear();
                  sfx.swing(k);
                }
                this.step = turn;
              }
            }
          }
          const handRel = mo === 'double' ? rel * 0.65 : spinning ? rel : lerp(from * 0.65, to * 0.65, ease.outCubic(u));
          absAng = this.aim + rel;
          absHand = this.aim + handRel;
          // elliptical hand path: in close at the start, out at the end, bulging mid-cut
          dist = lerp(rIn, rOut, ease.outCubic(u)) + (mv.bulge ?? 0) * Math.sin(u * Math.PI);
          if (spinning && mv.body) this.bodyRot = rel - from;
          if (mo === 'whip') this.ext = ease.outCubic(u);
          if (mo !== 'whip') this.sweepArc(px, py, reach, this.prevRel, rel);
          else if (this.parryT > 0) this.run.parryShots(px, py, reach * 0.7, this);
          this.prevRel = rel;
        }
        if (k === 'plasma') this.ext = 1;
        if (advance('hold', SW)) this.onSwingEnd(px, py);
        break;
      }
      case 'hold': {
        if (stabbing) {
          absAng = this.aim;
          absHand = this.aim + 0.2 * this.side;
          dist = mo === 'jabs' ? 5 : thrustDist;
        } else if (mo === 'handspin') {
          absAng = this.aim + end;
          absHand = this.aim;
          dist = 9;
        } else {
          // overshoot and settle back a touch
          const H = this.dur('h');
          const settle = Math.sin(clamp(this.t / Math.max(0.001, H), 0, 1) * Math.PI) * 0.12 * this.side;
          absAng = this.aim + end + settle;
          absHand = this.aim + (spinning ? end : end * 0.65);
          dist = rOut;
        }
        advance('recover', this.dur('h'));
        break;
      }
      case 'recover': {
        const R = this.dur('r');
        const u = clamp(this.t / R, 0, 1);
        const e = ease.inOutCubic(u);
        // a flourish: the blade turns over in the hand on the way back to guard
        const twirl = ((mv.twirl ?? (k === 'dagger' ? 1 : 0)) * TAU * this.side * -1) * ease.outCubic(u);
        if (stabbing) {
          absAng = lerpAng(this.aim, rest.ang, e) + twirl;
          absHand = lerpAng(this.aim + 0.2 * this.side, rest.hand, e);
          dist = lerp(mo === 'jabs' ? 5 : thrustDist, rest.dist, e);
        } else if (mo === 'handspin') {
          absAng = lerpAng(this.aim + end + this.side * u * 1.5, rest.ang, e);
          absHand = lerpAng(this.aim, rest.hand, e);
          dist = lerp(9, rest.dist, e);
        } else {
          absAng = lerpAng(this.aim + end, rest.ang, e) + twirl;
          absHand = lerpAng(this.aim + (spinning ? end : end * 0.65), rest.hand, e);
          dist = lerp(rOut, rest.dist, e);
          if (SAYA[k] && u > 0.92 && !this.sheathClick) {
            this.sheathClick = true;
            sfx.sheathe();
            const [sx, sy] = this.sheathMouth(px, py);
            this.run.fx.flare(sx, sy, 3, 0xfff0c0, 0.06);
          }
        }
        this.bodyRot += angDiff(this.bodyRot, 0) * Math.min(1, dt * 16);
        if (k === 'plasma') this.ext = 1 - seg(u, 0.25, 0.8);
        if (mo === 'whip') this.ext = 1 - ease.inOutCubic(seg(u, 0, 0.7));
        if (advance('rest', R)) this.t = 0;
        break;
      }
      case 'deflect': {
        // 0-50ms: snap crossways onto the blow; then the recoil; then a twirl back to guard
        const T = this.t, D = this.defDur;
        const snap = ease.outExpo(clamp(T / 0.05, 0, 1));
        const toward = this.defAng;
        if (T < 0.14) {
          absAng = lerpAng(this.defFrom, this.defGuard, snap);
          absHand = toward;
          const recoil = Math.sin(clamp((T - 0.04) / 0.1, 0, 1) * Math.PI);
          dist = 8 - recoil * 3.5;
        } else {
          const f = clamp((T - 0.14) / (D - 0.14), 0, 1);
          const spin = ease.outCubic(f) * TAU * (this.defPerfect ? 2 : 1) * this.defSpin;
          const back = ease.inOutCubic(seg(f, 0.45, 1));
          absAng = lerpAng(this.defGuard + spin, rest.ang, back);
          absHand = lerpAng(toward, rest.hand, back);
          dist = lerp(8, rest.dist, back);
        }
        this.bodyRot += angDiff(this.bodyRot, 0) * Math.min(1, dt * 16);
        if (k === 'plasma') this.ext = 1 - seg(T / D, 0.7, 1);
        if (T >= D) {
          this.state = 'rest';
          this.t = 0;
        }
        break;
      }
    }

    this.ang = absAng;
    this.hx = px + Math.cos(absHand) * dist;
    this.hy = py + Math.sin(absHand) * dist;
    if (mo === 'whip' && this.state !== 'deflect') this.updateChain(dt);
    if (mo === 'whip' && (this.state === 'swing' || (this.state === 'hold' && this.t < 0.04))) this.sweepChain(px, py, mv.dmg ?? 1);

    for (const tr of [this.trail, this.trail2]) {
      for (const p of tr) p.age += dt;
      while (tr.length && tr[0].age > 0.11) tr.shift();
    }
    const moving =
      this.state === 'swing' ||
      (this.state === 'hold' && this.t < 0.03) ||
      (this.state === 'recover' && this.t < this.dur('r') * 0.6 && ((mv.twirl ?? 0) > 0 || k === 'dagger')) ||
      (this.state === 'deflect' && this.t > 0.14 && this.t < this.defDur * 0.8);
    if (moving) {
      const ca = Math.cos(this.ang), sa = Math.sin(this.ang);
      if (mo === 'whip' && this.chain.length && this.state !== 'deflect') {
        const tip = this.chain[WHIP_N - 1], mid = this.chain[WHIP_N - 4];
        this.trail.push({ tx: tip.x, ty: tip.y, mx: mid.x, my: mid.y, age: 0 });
      } else {
        const L = BLADE_LEN[k] * (k === 'scythe' ? 1.1 : 1);
        const tip = k === 'scythe' ? L + 2 : L;
        this.trail.push({ tx: this.hx + ca * tip, ty: this.hy + sa * tip, mx: this.hx + ca * L * 0.6, my: this.hy + sa * L * 0.6, age: 0 });
        if (k === 'twinblade') this.trail2.push({ tx: this.hx - ca * tip, ty: this.hy - sa * tip, mx: this.hx - ca * L * 0.6, my: this.hy - sa * L * 0.6, age: 0 });
      }
    }
  }

  // ---------------- whip chain ----------------
  private resetChain() {
    this.chain = [];
    for (let i = 0; i < WHIP_N; i++) this.chain.push({ x: this.hx, y: this.hy });
  }
  private updateChain(dt: number) {
    if (this.chain.length !== WHIP_N) this.resetChain();
    const L = BLADE_LEN.whip + (this.reach() - BLADE_LEN.whip) * this.ext;
    const seg = L / WHIP_N;
    const ca = Math.cos(this.ang), sa = Math.sin(this.ang);
    let prevX = this.hx, prevY = this.hy;
    for (let i = 0; i < WHIP_N; i++) {
      const p = this.chain[i];
      const tx = this.hx + ca * seg * (i + 1), ty = this.hy + sa * seg * (i + 1);
      const k = Math.min(1, dt * (70 / (1 + i * 0.55)));
      p.x += (tx - p.x) * k;
      p.y += (ty - p.y) * k;
      const dx = p.x - prevX, dy = p.y - prevY, d = Math.hypot(dx, dy) || 1;
      p.x = prevX + (dx / d) * seg;
      p.y = prevY + (dy / d) * seg;
      prevX = p.x;
      prevY = p.y;
    }
  }
  private sweepChain(px: number, py: number, mul: number) {
    for (const e of this.run.enemies) {
      if (e.dead || this.hit.has(e)) continue;
      let px0 = this.hx, py0 = this.hy;
      for (const p of this.chain) {
        if (segDist(e.x, e.y, px0, py0, p.x, p.y) < e.r + 2.5) {
          const dx = e.x - px, dy = e.y - py, d = Math.hypot(dx, dy) || 1;
          this.strike(e, dx / d, dy / d, mul);
          break;
        }
        px0 = p.x;
        py0 = p.y;
      }
    }
  }

  private onSwingEnd(px: number, py: number) {
    const def = this.def;
    const fx = this.run.fx;
    const k = def.kind;
    const mv = this.move;
    if ((k === 'greatsword' || k === 'cleaver') && mv.dir === 'down' && mv.span < 6) {
      const a = this.aim + this.endRel();
      const r = this.reach() * 0.85;
      const x = px + Math.cos(a) * r, y = py + Math.sin(a) * r;
      fx.dust(x, y, k === 'cleaver' ? 6 : 10);
      fx.ring(x, y, 3, k === 'cleaver' ? 12 : 18, 0.3, 0xc8b8a0, 2, 0.6);
      fx.shards(x, y, k === 'cleaver' ? 4 : 6, 0x6a6278, 0x3a3448, 0.8);
      this.run.shake(k === 'cleaver' ? 2 : 3);
      if (k === 'greatsword') sfx.slam();
      else sfx.foley('slam2', 0.5, 1.3);
    }
    if ((k === 'katana' || k === 'nodachi' || k === 'plasma') && mv.span < 6) {
      const [from, to] = this.path();
      fx.crescent(px, py, this.reach() * 0.8, this.aim + from, this.aim + to, k === 'nodachi' ? 4 : 3, k === 'plasma' ? def.color : 0xbfe4ff, 0.28);
    }
    // spinning finishers leave a ring of wind behind
    if (mv.span >= 6 && mv.m !== 'whip') fx.ring(px, py, this.reach() * 0.5, this.reach() * (mv.reach ?? 1) * 1.05, 0.28, def.color, 2);
    if (mv.fin && mv.m === 'thrust') {
      const x = px + Math.cos(this.aim) * this.reach() * (mv.reach ?? 1), y = py + Math.sin(this.aim) * this.reach() * (mv.reach ?? 1);
      fx.ring(x, y, 1, 10, 0.18, 0xffffff, 1.5);
      fx.sparks(x, y, this.aim, 0.4, 5, 160, def.color, 0xffffff, 0.18);
    }
  }

  sheathMouth(px: number, py: number): [number, number] {
    const rest = this.restPose(0);
    const hx = px + Math.cos(rest.hand) * rest.dist, hy = py + Math.sin(rest.hand) * rest.dist;
    return [hx + Math.cos(rest.ang) * 1, hy + Math.sin(rest.ang) * 1];
  }

  private sweepArc(px: number, py: number, reach: number, r0: number, r1: number) {
    const lo = Math.min(r0, r1) - 0.22, hi = Math.max(r0, r1) + 0.22;
    const mul = this.move.dmg ?? 1;
    for (const e of this.run.enemies) {
      if (e.dead || this.hit.has(e)) continue;
      const dx = e.x - px, dy = e.y - py;
      const d = Math.hypot(dx, dy);
      if (d - e.r > reach) continue;
      const rel = angDiff(this.aim, Math.atan2(dy, dx));
      let inside = false;
      for (let off = -3; off <= 3; off++) if (rel + off * TAU >= lo && rel + off * TAU <= hi) inside = true;
      if (d < e.r + 6) inside = true;
      if (inside) this.strike(e, dx / (d || 1), dy / (d || 1), mul);
    }
    if (this.parryT > 0) this.run.parryShots(px, py, reach + 4, this);
  }

  private sweepThrust(px: number, py: number, len: number, a: number) {
    const ca = Math.cos(a), sa = Math.sin(a);
    const ex = px + ca * len, ey = py + sa * len;
    const mul = this.move.dmg ?? 1;
    for (const e of this.run.enemies) {
      if (e.dead || this.hit.has(e)) continue;
      if (segDist(e.x, e.y, px, py, ex, ey) < e.r + 4) this.strike(e, ca, sa, mul);
    }
    if (this.parryT > 0) this.run.parryShots(px, py, len + 6, this);
  }

  private sweepAround(cx: number, cy: number, reach: number, px: number, py: number) {
    const mul = this.move.dmg ?? 1;
    for (const e of this.run.enemies) {
      if (e.dead || this.hit.has(e)) continue;
      const dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy);
      if (d - e.r > reach) continue;
      const ox = e.x - px, oy = e.y - py, od = Math.hypot(ox, oy) || 1;
      this.strike(e, ox / od, oy / od, mul);
    }
    if (this.parryT > 0) this.run.parryShots(px, py, reach + 12, this);
  }

  private strike(e: Enemy, nx: number, ny: number, mul = 1) {
    this.hit.add(e);
    const def = this.def;
    const k = def.kind;
    const fin = !!this.move.fin;
    const critP = k === 'rapier' || k === 'cleaver' ? 0.3 : k === 'katar' ? 0.15 : 0.1;
    const crit = Math.random() < critP + (fin ? 0.15 : 0);
    const dmg = this.dmg() * mul * (crit ? 1.8 : 1) * (e.stun > 0 ? 1.5 : 1);
    this.run.damageEnemy(e, dmg, nx * def.knock * (fin ? 1.4 : 1), ny * def.knock * (fin ? 1.4 : 1), crit, 'sword');
    const fx = this.run.fx;
    const hx = e.x - nx * e.r, hy = e.y - ny * e.r;
    const heavy = !!HEAVY[k] || fin;
    fx.flare(hx, hy, heavy ? 8 : 5, def.color, 0.07);
    fx.sparks(hx, hy, Math.atan2(ny, nx), 0.7, heavy ? 10 : 5, 170, k === 'plasma' ? def.color : 0xffffff, 0xffffff, 0.22);
    fx.light(hx, hy, 24, def.color, 0.6, 0.1);
    sfx.slashHit(heavy);
    if (!this.hitStopDone) {
      this.hitStopDone = true;
      this.run.player?.slashImpact(Math.atan2(ny, nx), heavy);
      this.run.hitstop(def.stop * (fin ? 1.5 : 1));
      this.run.shake(heavy ? 5 : 2.5);
    } else this.run.hitstop(0.008);
  }

  // ---------------- draw ----------------
  private drawTrail(g: Gfx, tr: TrailPt[]) {
    const c0 = this.def.color;
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i];
      const k = 1 - b.age / 0.11;
      const c = mix(c0, 0xffffff, k * k);
      const alpha = 0.15 + k * 0.6;
      g.tri(a.mx, a.my, a.tx, a.ty, b.tx, b.ty, c, alpha, true);
      g.tri(a.mx, a.my, b.tx, b.ty, b.mx, b.my, c, alpha, true);
      g.line(a.tx, a.ty, b.tx, b.ty, k > 0.5 ? 0xffffff : c, Math.min(1, k * 1.6));
      g.glowLine(a.tx, a.ty, b.tx, b.ty, 5, c0, 0.14 * k);
    }
  }

  draw(g: Gfx, handC: number, time: number, showHand: boolean) {
    const def = this.def;
    const k = def.kind;
    this.drawTrail(g, this.trail);
    if (this.trail2.length) this.drawTrail(g, this.trail2);
    const fy = this.state === 'rest' ? (this.faceK >= 0 ? 1 : -1) : this.state === 'deflect' ? this.defSpin : -this.side;
    this.artFy = fy;
    const saya = SAYA[k];
    if (saya) {
      const rest = this.restPose(time);
      const sx = this.hx0 + Math.cos(rest.hand) * rest.dist, sy = this.hy0 + Math.sin(rest.hand) * rest.dist;
      const Sx = new Xf(g, sx, sy, rest.ang, this.faceK >= 0 ? 1 : -1);
      if (this.state === 'rest') {
        drawSword(Sx, k, def.color, time, true);
        if (showHand) hand(Sx, GRIP[k], 0, handC);
        return;
      }
      Sx.q(1, -1.6, saya, 3.2, 0x3a1020);
      Sx.q(1, -1.6, saya, 1, 0x7a2438);
      Sx.q(saya, -1.6, 1.5, 3.2, 0xe0b24a);
    }
    const X = new Xf(g, this.hx, this.hy, this.ang, fy);
    const extended = this.move.m === 'whip' && this.ext > 0.05 && this.chain.length === WHIP_N && this.state !== 'deflect';
    drawSword(X, k, def.color, time, false, extended ? 0 : this.ext, extended);
    if (extended) this.drawChain(g);
    if (showHand) hand(X, GRIP[k], 0, handC);
    // a cold glint along the edge while guarding or in the perfect window
    if ((this.parryT > 0 && this.perfect()) || (this.state === 'deflect' && this.t < 0.14)) {
      const L = BLADE_LEN[k];
      const [tx, ty] = X.pt(L * 0.7, 0);
      g.glow(tx, ty, 10, 0xffffff, this.state === 'deflect' ? 0.4 : 0.25);
    }
  }

  private drawChain(g: Gfx) {
    const c = this.def.color;
    const lo = mix(c, 0x202030, 0.45), hi = mix(c, 0xffffff, 0.6);
    let x0 = this.hx + Math.cos(this.ang) * 1.5, y0 = this.hy + Math.sin(this.ang) * 1.5;
    for (let i = 0; i < WHIP_N; i++) {
      const p = this.chain[i];
      const a = Math.atan2(p.y - y0, p.x - x0);
      const len = Math.hypot(p.x - x0, p.y - y0);
      const w = 3.4 - i * 0.14;
      g.line(x0, y0, p.x, p.y, 0x8a9aa0);
      g.quad(x0, y0, a, len * 0.1, -w / 2, len * 0.85, w, lo);
      g.quad(x0, y0, a, len * 0.1, -w / 2, len * 0.85, w * 0.45, c);
      g.quad(x0, y0, a, len * 0.3, -w / 2, len * 0.5, 0.8, hi);
      g.glowLine(x0, y0, p.x, p.y, 4, c, 0.2);
      x0 = p.x;
      y0 = p.y;
    }
    const tip = this.chain[WHIP_N - 1], pre = this.chain[WHIP_N - 2];
    const a = Math.atan2(tip.y - pre.y, tip.x - pre.x);
    g.tri(tip.x + Math.cos(a) * 3, tip.y + Math.sin(a) * 3, tip.x - Math.sin(a) * 1.3, tip.y + Math.cos(a) * 1.3, tip.x + Math.sin(a) * 1.3, tip.y - Math.cos(a) * 1.3, hi);
    g.glow(tip.x, tip.y, 6, c, 0.3);
  }
}

function lerpAng(a: number, b: number, t: number) {
  return a + angDiff(a, b) * t;
}
