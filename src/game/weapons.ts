import { Gfx, Xf } from '../engine/gfx';
import { TAU, angDiff, clamp, ease, lerp, rand, rayCircle, seg, segDist, spring, mix } from '../engine/math';
import { sfx } from '../engine/audio';
import { ENHANCE_BONUS, type GunDef, type GunKind, type SwordDef } from './data';
import { BLADE_LEN, MUZZLE, PORT, blankPose, drawGun, drawSword, hand, type GunPose } from './art';
import { PK } from './fx';
import type { Run } from './run';
import type { Enemy } from './enemies';

interface Hold {
  d: number;
  side: number;
  two: boolean;
  fore: [number, number];
  kick: number;
  climb: number;
}
const HOLD: Record<GunKind, Hold> = {
  pistol: { d: 9, side: 2, two: false, fore: [0, 0], kick: 70, climb: 9 },
  revolver: { d: 9, side: 2, two: false, fore: [0, 0], kick: 95, climb: 14 },
  smg: { d: 8.5, side: 2.5, two: false, fore: [0, 0], kick: 30, climb: 3 },
  shotgun: { d: 7, side: 2.5, two: true, fore: [8.5, -1.2], kick: 140, climb: 10 },
  sniper: { d: 6, side: 2.5, two: true, fore: [10, -1.5], kick: 160, climb: 8 },
  minigun: { d: 7, side: 3.5, two: true, fore: [-1.5, -9], kick: 14, climb: 1.2 },
  railgun: { d: 7, side: 2.5, two: true, fore: [8, 0], kick: 220, climb: 12 },
};

/** post-shot action length (pump, bolt) */
const CYCLE: Partial<Record<GunKind, number>> = { shotgun: 0.32, sniper: 0.55 };
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
    if (this.def.kind === 'shotgun') {
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
    [this.kick, this.kickV] = spring(this.kick, this.kickV, 380, 24, dt);
    [this.climb, this.climbV] = spring(this.climb, this.climbV, 300, 20, dt);

    // ---- minigun barrel spin ----
    if (def.kind === 'minigun') {
      const wantSpin = t && !this.reloading ? 1 : 0;
      this.barrelV += (wantSpin - this.barrelV) * Math.min(1, dt * (wantSpin ? 1.6 : 0.9));
      this.barrel += this.barrelV * dt * 45;
    }
    this.firing = Math.max(0, this.firing - dt);

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
    } else if (this.ammo <= 0) {
      this.startReload();
    } else if (t && this.cycle < 0) {
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
      if (this.idle > 1.2 && this.ammo < this.magSize()) this.startReload();
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
    return x.pt(mu - this.kick * 0.03, mv);
  }

  fire() {
    const run = this.run;
    const def = this.def;
    this.cd = 1 / this.rate();
    this.ammo--;
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
    if (def.kind === 'shotgun' || def.kind === 'sniper' || def.kind === 'railgun') run.fx.smoke(mx, my, def.kind === 'railgun' ? 5 : 3, 0x4a4458, 2.5, 0.6);
    run.fx.sparks(mx, my, this.aim, 0.5, def.kind === 'shotgun' ? 6 : 2, 160, 0xffb84a, 0xffffff, 0.12);
    // kick
    this.kickV += this.hold.kick;
    this.climbV += this.hold.climb * (1 + rand(-0.2, 0.2));
    run.shake(def.shake * 0.5);
    if (def.kind === 'railgun') run.hitstop(0.04);
    if (anyKill) run.hitstop(def.stop);
    sfx.shot(def.kind);
    // casings for guns that eject on fire
    if (def.kind === 'pistol' || def.kind === 'smg' || def.kind === 'minigun') this.ejectCasing();
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
          this.kickV += 30;
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
            this.kickV -= 25;
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
  }

  /** compute the animated pose: local rotation, offsets, spin about a pivot, parts */
  computePose(handC: number, swordUsingOffhand: boolean) {
    const p = this.pose;
    Object.assign(p, blankPose());
    p.handC = handC;
    const kind = this.def.kind;
    const h = this.hold;
    let rot = -this.climb * 0.02; // negative = muzzle up
    let du = -this.kick * 0.03, dv = 0;
    let spin = 0;
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
      }
    }
    if (kind === 'railgun') p.charge = this.charge;
    p.barrel = this.barrel;
    p.hand2 = hand2;
    // while twirling, the hand stays at the pivot (trigger finger / pump grip)
    const grip: [number, number] = spin !== 0 ? pivot : [0, 0.5];
    return { rot, du, dv, spin, pivot, grip };
  }

  draw(g: Gfx, handC: number, swordUsingOffhand: boolean, time: number) {
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
    drawGun(X, this.def.kind, this.pose, time);
    hand(X, grip[0], grip[1], handC);
  }
}

// =====================================================================
// Sword
// =====================================================================
type SState = 'rest' | 'windup' | 'swing' | 'hold' | 'recover';

interface TrailPt { tx: number; ty: number; mx: number; my: number; age: number }

export class SwordCtl {
  def: SwordDef;
  lvl: number;
  state: SState = 'rest';
  t = 0;
  cd = 0;
  side = 1;
  aim = 0;
  restAim = 0;
  /** which way the body faces (+1 right, -1 left) and the smoothed blend between the two */
  facing = 1;
  faceK = 1;
  private sinceFlip = 1;
  private sinceAttack = 9;
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
  twirl = -1;
  twirlTimer = 1.5;
  combo = 0;
  hitStopDone = false;
  /** body nudges for the owner (lunge, crouch) */
  lunge = 0;
  squash = 0;
  sheathClick = false;

  constructor(def: SwordDef, lvl: number, private run: Run) {
    this.def = def;
    this.lvl = lvl;
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

  /** start an attack toward angle a */
  attack(a: number) {
    if (this.cd > 0 || (this.state !== 'rest' && this.state !== 'recover')) return false;
    this.aim = a;
    this.state = 'windup';
    this.t = 0;
    this.cd = this.def.cooldown * Math.max(0.35, this.run.mods.swordCd);
    const k = this.def.kind;
    const restSide = angDiff(a, this.restPose(0).ang) >= 0 ? 1 : -1;
    const alternates = k === 'dagger' || k === 'longsword';
    // a fresh attack winds up from where the blade already is; quick follow-ups alternate
    this.side = alternates && this.sinceAttack < 0.7 ? -this.side : restSide;
    this.sinceAttack = 0;
    this.combo++;
    this.hit.clear();
    this.hitStopDone = false;
    this.parryT = this.parryWindow();
    this.parryAge = 0;
    this.twirl = -1;
    this.trail.length = 0;
    this.sheathClick = false;
    if (this.def.kind === 'greatsword') this.squash = 1;
    return true;
  }

  /** a parry is active and `a` (angle from owner to threat) is inside the guarded sector */
  guards(a: number) {
    if (this.parryT <= 0) return false;
    if (this.def.arc >= 6) return true;
    const half = Math.max(this.def.arc / 2, 1.0) + 0.45;
    return Math.abs(angDiff(this.aim, a)) <= half;
  }
  perfect() {
    return this.parryAge <= 0.075;
  }

  /** swing path, in angles relative to aim */
  private path(): [number, number] {
    const k = this.def.kind;
    const half = this.def.arc / 2;
    if (k === 'scythe') return [this.side * 0.5, this.side * 0.5 - this.side * (TAU + 0.6)];
    if (k === 'rapier') return [0, 0];
    return [this.side * (half + 0.15), -this.side * (half + 0.25)];
  }

  /** rest pose for a body facing right, given the aim folded into the right half */
  private restRight(aimR: number, time: number, spinDir: number): { ang: number; hand: number; dist: number } {
    // how much the resting weapon leans toward where you look
    const lean = { dagger: 0.3, longsword: 0.35, rapier: 1, katana: 0.15, greatsword: 0.2, scythe: 0.2 }[this.def.kind];
    const t = Math.max(-1.3, Math.min(1.3, angDiff(0, aimR))) * lean;
    switch (this.def.kind) {
      case 'dagger': {
        let spin = 0;
        if (this.twirl >= 0) spin = ease.outCubic(this.twirl) * TAU * 2 * spinDir;
        // reverse grip at the side, blade pointing back and down
        return { ang: 2.35 + t + spin, hand: 1.55 + t * 0.5, dist: 8 };
      }
      case 'longsword':
        // held low in front, point raised
        return { ang: -0.95 + t + Math.sin(time * 2) * 0.04, hand: 1.25 + t * 0.5, dist: 8 };
      case 'rapier':
        // en garde: the point follows the aim
        return { ang: t + Math.sin(time * 3.1) * 0.12, hand: 0.75 + t * 0.6, dist: 9 + Math.sin(time * 3.1 + 1) * 0.7 };
      case 'katana':
        // saya at the hip, handle forward, tip trailing back and down
        return { ang: Math.PI - 0.55 + t, hand: 1.75 + t * 0.3, dist: 6 };
      case 'greatsword':
        // resting on the shoulder, blade back over the top
        return { ang: -Math.PI * 0.82 + t + Math.sin(time * 1.6) * 0.03, hand: -1.45 + t * 0.3, dist: 5 };
      case 'scythe':
        // carried behind, blade up
        return { ang: -Math.PI * 0.6 + t + Math.sin(time * 1.4) * 0.06, hand: 1.9 + t * 0.3, dist: 6 };
    }
  }

  restPose(time: number): { ang: number; hand: number; dist: number } {
    const a = this.restAim;
    const right = this.restRight(a, time, 1);
    // mirror across the vertical axis: angle -> PI - angle
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
    this.restAim += angDiff(this.restAim, wantAim) * Math.min(1, dt * 12);
    this.sinceFlip += dt;
    this.sinceAttack += dt;
    const c = Math.cos(wantAim);
    // don't flip-flop around straight up / down: need a clear lean and a short pause between flips
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
    this.lunge *= Math.exp(-dt * 10);

    // idle dagger twirl
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
    const rest = this.restPose(time);
    const [from, to] = this.path();
    let bladeRel = 0, handRel = 0, dist = rest.dist;
    let absAng = rest.ang, absHand = rest.hand;
    this.t += dt;
    const reach = this.reach();

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
        break;
      case 'windup': {
        const u = ease.outCubic(clamp(this.t / def.windup, 0, 1));
        if (def.kind === 'rapier') {
          absAng = this.aim;
          absHand = this.aim + lerp(0.75, 0.2, u);
          dist = lerp(rest.dist, 4, u);
        } else {
          const cock = from + this.side * (def.kind === 'greatsword' ? 0.6 : 0.3);
          absAng = lerpAng(rest.ang, this.aim + cock, u);
          absHand = lerpAng(rest.hand, this.aim + cock * 0.6, u);
          dist = lerp(rest.dist, 8, u);
        }
        if (advance('swing', def.windup)) {
          sfx.swing(def.kind);
          this.prevRel = def.kind === 'rapier' ? 0 : from;
          this.lunge = def.kind === 'rapier' ? 1 : def.kind === 'greatsword' ? 0.6 : 0.35;
        }
        break;
      }
      case 'swing': {
        const u = clamp(this.t / def.swing, 0, 1);
        if (def.kind === 'rapier') {
          const e = ease.outExpo(u);
          absAng = this.aim;
          absHand = this.aim + 0.2 * (1 - e);
          dist = lerp(4, 9 + reach * 0.35, e);
          this.sweepThrust(px, py, reach * (0.4 + 0.6 * e));
        } else {
          bladeRel = lerp(from, to, ease.outQuart(u));
          handRel = lerp(from * 0.65, to * 0.65, ease.outCubic(u));
          absAng = this.aim + bladeRel;
          absHand = this.aim + handRel;
          dist = def.kind === 'scythe' ? 4 : 9;
          this.sweepArc(px, py, reach, this.prevRel, bladeRel);
          this.prevRel = bladeRel;
        }
        if (advance('hold', def.swing)) this.onSwingEnd(px, py);
        break;
      }
      case 'hold': {
        if (def.kind === 'rapier') {
          absAng = this.aim;
          absHand = this.aim + 0.2;
          dist = 9 + reach * 0.35;
        } else {
          const settle = Math.sin(clamp(this.t / def.hold_, 0, 1) * Math.PI) * 0.1 * this.side;
          absAng = this.aim + to + settle;
          absHand = this.aim + to * 0.65;
          dist = def.kind === 'scythe' ? 4 : 9;
        }
        advance('recover', def.hold_);
        break;
      }
      case 'recover': {
        const u = clamp(this.t / def.recover, 0, 1);
        const e = ease.inOutCubic(u);
        if (def.kind === 'rapier') {
          absAng = lerpAng(this.aim, rest.ang, e);
          absHand = lerpAng(this.aim + 0.2, rest.hand, e);
          dist = lerp(9 + reach * 0.35, rest.dist, e);
        } else {
          let extra = 0;
          // dagger flicks a twirl on the way back, katana slides home into the saya
          if (def.kind === 'dagger') extra = ease.outCubic(u) * TAU * this.side;
          absAng = lerpAng(this.aim + to, rest.ang, e) + extra;
          absHand = lerpAng(this.aim + to * 0.65, rest.hand, e);
          dist = lerp(def.kind === 'scythe' ? 4 : 9, rest.dist, e);
          if (def.kind === 'katana' && u > 0.92 && !this.sheathClick) {
            this.sheathClick = true;
            sfx.sheathe();
            const [sx, sy] = this.sheathMouth(px, py);
            this.run.fx.flare(sx, sy, 3, 0xfff0c0, 0.06);
          }
        }
        if (advance('rest', def.recover)) this.t = 0;
        break;
      }
    }

    this.ang = absAng;
    this.hx = px + Math.cos(absHand) * dist;
    this.hy = py + Math.sin(absHand) * dist;

    // trail samples while the blade is moving fast
    for (const p of this.trail) p.age += dt;
    while (this.trail.length && this.trail[0].age > 0.11) this.trail.shift();
    if (this.state === 'swing' || (this.state === 'hold' && this.t < 0.03) || (def.kind === 'dagger' && this.state === 'recover' && this.t < def.recover * 0.6)) {
      const L = BLADE_LEN[def.kind] * (def.kind === 'scythe' ? 1.1 : 1);
      const ca = Math.cos(this.ang), sa = Math.sin(this.ang);
      const tip = def.kind === 'scythe' ? L + 2 : L;
      this.trail.push({ tx: this.hx + ca * tip, ty: this.hy + sa * tip, mx: this.hx + ca * L * 0.6, my: this.hy + sa * L * 0.6, age: 0 });
    }
  }

  private onSwingEnd(px: number, py: number) {
    const def = this.def;
    const fx = this.run.fx;
    if (def.kind === 'greatsword') {
      const [, to] = this.path();
      const a = this.aim + to;
      const r = this.reach() * 0.85;
      const x = px + Math.cos(a) * r, y = py + Math.sin(a) * r;
      fx.dust(x, y, 10);
      fx.ring(x, y, 3, 18, 0.3, 0xc8b8a0, 2, 0.6);
      fx.shards(x, y, 6, 0x6a6278, 0x3a3448, 0.8);
      this.run.shake(3);
      sfx.slam();
    }
    if (def.kind === 'katana') {
      // the iai cut lingers as a thin crescent
      const [from, to] = this.path();
      fx.crescent(px, py, this.reach() * 0.8, this.aim + from, this.aim + to, 3, 0xbfe4ff, 0.28);
    }
    if (def.kind === 'scythe') fx.ring(px, py, this.reach() * 0.5, this.reach() * 1.05, 0.25, 0xc49bff, 2);
  }

  sheathMouth(px: number, py: number): [number, number] {
    const rest = this.restPose(0);
    const hx = px + Math.cos(rest.hand) * rest.dist, hy = py + Math.sin(rest.hand) * rest.dist;
    return [hx + Math.cos(rest.ang) * 1, hy + Math.sin(rest.ang) * 1];
  }

  private sweepArc(px: number, py: number, reach: number, r0: number, r1: number) {
    const lo = Math.min(r0, r1) - 0.22, hi = Math.max(r0, r1) + 0.22;
    for (const e of this.run.enemies) {
      if (e.dead || this.hit.has(e)) continue;
      const dx = e.x - px, dy = e.y - py;
      const d = Math.hypot(dx, dy);
      if (d - e.r > reach) continue;
      const rel = angDiff(this.aim, Math.atan2(dy, dx));
      let inside = false;
      for (const off of [0, TAU, -TAU, 2 * TAU, -2 * TAU]) if (rel + off >= lo && rel + off <= hi) inside = true;
      if (d < e.r + 6) inside = true; // hugging: always connects
      if (inside) this.strike(e, dx / (d || 1), dy / (d || 1));
    }
    // blade sweeps enemy bullets during the parry window
    if (this.parryT > 0) this.run.parryShots(px, py, reach + 4, this);
  }

  private sweepThrust(px: number, py: number, len: number) {
    const ca = Math.cos(this.aim), sa = Math.sin(this.aim);
    const ex = px + ca * len, ey = py + sa * len;
    for (const e of this.run.enemies) {
      if (e.dead || this.hit.has(e)) continue;
      if (segDist(e.x, e.y, px, py, ex, ey) < e.r + 4) this.strike(e, ca, sa);
    }
    if (this.parryT > 0) this.run.parryShots(px, py, len + 6, this);
  }

  private strike(e: Enemy, nx: number, ny: number) {
    this.hit.add(e);
    const def = this.def;
    const crit = def.kind === 'rapier' ? Math.random() < 0.3 : Math.random() < 0.1;
    const dmg = this.dmg() * (crit ? 1.8 : 1) * (e.stun > 0 ? 1.5 : 1);
    this.run.damageEnemy(e, dmg, nx * def.knock, ny * def.knock, crit, 'sword');
    const fx = this.run.fx;
    const hx = e.x - nx * e.r, hy = e.y - ny * e.r;
    fx.flare(hx, hy, def.kind === 'greatsword' ? 8 : 5, def.color, 0.07);
    fx.sparks(hx, hy, Math.atan2(ny, nx), 0.7, def.kind === 'greatsword' ? 10 : 5, 170, 0xffffff, 0xffffff, 0.22);
    fx.light(hx, hy, 24, def.color, 0.6, 0.1);
    const heavy = def.kind === 'greatsword' || def.kind === 'scythe';
    sfx.slashHit(heavy);
    if (!this.hitStopDone) {
      this.hitStopDone = true;
      this.run.hitstop(def.stop);
      this.run.shake(heavy ? 5 : 2.5);
    } else this.run.hitstop(0.008);
  }

  // ---------------- draw ----------------
  draw(g: Gfx, handC: number, time: number, showHand: boolean) {
    const def = this.def;
    // trail: a ribbon from mid-blade to tip, white at the head, fading to the blade tint
    const tr = this.trail;
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i];
      const k = 1 - b.age / 0.11;
      const c = mix(def.color, 0xffffff, k * k);
      const alpha = 0.15 + k * 0.6;
      g.tri(a.mx, a.my, a.tx, a.ty, b.tx, b.ty, c, alpha, true);
      g.tri(a.mx, a.my, b.tx, b.ty, b.mx, b.my, c, alpha, true);
      // crisp leading edge along the tip path
      g.line(a.tx, a.ty, b.tx, b.ty, k > 0.5 ? 0xffffff : c, Math.min(1, k * 1.6));
      g.glowLine(a.tx, a.ty, b.tx, b.ty, 5, def.color, 0.14 * k);
    }
    const fy = this.state === 'rest' ? (this.faceK >= 0 ? 1 : -1) : -this.side;
    this.artFy = fy;
    // katana: the saya stays at the hip even when the blade is out
    if (def.kind === 'katana') {
      const rest = this.restPose(time);
      const sx = this.hx0 + Math.cos(rest.hand) * rest.dist, sy = this.hy0 + Math.sin(rest.hand) * rest.dist;
      const S = new Xf(g, sx, sy, rest.ang, this.faceK >= 0 ? 1 : -1);
      if (this.state === 'rest') {
        drawSword(S, 'katana', def.color, time, true);
        if (showHand) hand(S, -3, 0, handC);
        return;
      }
      // empty saya
      S.q(1, -1.6, 18, 3.2, 0x3a1020);
      S.q(1, -1.6, 18, 1, 0x7a2438);
      S.q(18, -1.6, 1.5, 3.2, 0xe0b24a);
    }
    const X = new Xf(g, this.hx, this.hy, this.ang, fy);
    drawSword(X, def.kind, def.color, time);
    if (showHand) hand(X, def.kind === 'scythe' ? -2 : -2.5, 0, handC);
    if (this.parryT > 0 && this.perfect()) {
      const L = BLADE_LEN[def.kind];
      const [tx, ty] = X.pt(L * 0.7, 0);
      g.glow(tx, ty, 10, 0xffffff, 0.25);
    }
  }
  /** owner centre, set by the player before drawing (for the katana saya) */
  hx0 = 0;
  hy0 = 0;
}

function lerpAng(a: number, b: number, t: number) {
  return a + angDiff(a, b) * t;
}
