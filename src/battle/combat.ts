import type { BattleScene } from '../scenes/BattleScene';

export type Team = 'p' | 'e';

export interface HitInfo {
  dmg: number;
  dir: number; // -1 / 1 horizontal direction of the push
  kbx: number;
  kby: number;
  stun: number; // ms of hitstun
  crit: boolean;
  skill: boolean; // skills bypass beetle shells
  pierce: boolean; // ignores shells / armor entirely
  heavy: boolean;
  freeze: number;
  slow: number;
  color: number;
  srcX: number;
}

export interface Fighter {
  team: Team;
  alive: boolean;
  x: number;
  y: number;
  rect(): Phaser.Geom.Rectangle;
  takeHit(h: HitInfo): boolean; // returns true if it actually took damage
  invulnerable(): boolean;
  isBoss?: boolean;
  pullTo?(x: number, y: number, strength: number): void;
}

export interface HitboxOpts {
  team: Team;
  x: number; y: number; w: number; h: number; // centred
  follow?: { x: number; y: number };
  offX?: number; offY?: number;
  dmg: number;
  life: number; // ms
  interval?: number; // re-hit interval per target (ms). undefined => hit once
  dir?: number;
  kbx?: number; kby?: number;
  stun?: number;
  critChance?: number;
  forceCrit?: boolean;
  skill?: boolean;
  pierce?: boolean;
  heavy?: boolean;
  freeze?: number;
  slow?: number;
  color?: number;
  hitstop?: number;
  sfx?: string;
  noSpark?: boolean;
  onHit?: (t: Fighter, h: HitInfo) => void;
  maxTargets?: number;
}

export class Hitbox {
  dead = false;
  checked = false;
  born: number;
  hits = new Map<Fighter, number>();
  count = 0;
  constructor(public o: HitboxOpts, now: number) { this.born = now; }
  get rect() {
    const fx = this.o.follow ? this.o.follow.x + (this.o.offX ?? 0) : this.o.x;
    const fy = this.o.follow ? this.o.follow.y + (this.o.offY ?? 0) : this.o.y;
    return new Phaser.Geom.Rectangle(fx - this.o.w / 2, fy - this.o.h / 2, this.o.w, this.o.h);
  }
}

export class Combat {
  boxes: Hitbox[] = [];
  /** Combat time only advances while the battle is actually simulating (not during hitstop/cut-ins). */
  clock = 0;
  constructor(private bs: BattleScene) {}

  add(o: HitboxOpts) {
    const hb = new Hitbox(o, this.clock);
    this.boxes.push(hb);
    return hb;
  }

  clear() { this.boxes.length = 0; }

  update(dt: number) {
    this.clock += dt;
    const now = this.clock;
    for (const hb of this.boxes) {
      if (hb.dead) continue;
      if (hb.checked && now - hb.born > hb.o.life) { hb.dead = true; continue; }
      hb.checked = true;
      const r = hb.rect;
      const targets: Fighter[] = hb.o.team === 'p' ? this.bs.enemies : [this.bs.player];
      for (const t of targets) {
        if (!t.alive || t.invulnerable()) continue;
        if (hb.o.maxTargets && hb.count >= hb.o.maxTargets && !hb.hits.has(t)) continue;
        const last = hb.hits.get(t);
        if (last !== undefined && (hb.o.interval === undefined || now - last < hb.o.interval)) continue;
        if (!Phaser.Geom.Intersects.RectangleToRectangle(r, t.rect())) continue;
        if (last === undefined) hb.count++;
        hb.hits.set(t, now);
        this.apply(hb, t, r);
      }
    }
    if (this.boxes.some((b) => b.dead)) this.boxes = this.boxes.filter((b) => !b.dead);
  }

  apply(hb: Hitbox, t: Fighter, r: Phaser.Geom.Rectangle) {
    const o = hb.o;
    const crit = o.forceCrit || Math.random() < (o.critChance ?? 0);
    const variance = 0.92 + Math.random() * 0.16;
    const dir = o.dir ?? (t.x >= r.centerX ? 1 : -1);
    const h: HitInfo = {
      dmg: Math.max(1, Math.round(o.dmg * variance * (crit ? 1.65 : 1))),
      dir, kbx: o.kbx ?? 60, kby: o.kby ?? 0, stun: o.stun ?? 220,
      crit, skill: !!o.skill, pierce: !!o.pierce, heavy: !!o.heavy, freeze: o.freeze ?? 0, slow: o.slow ?? 0,
      color: o.color ?? 0xffffff, srcX: r.centerX,
    };
    const took = t.takeHit(h);
    if (!took) return;
    if (o.team === 'p') this.bs.onPlayerHit(t, h, o);
    o.onHit?.(t, h);
  }

  /** Simple instant query helper used by skills. */
  enemiesIn(x: number, y: number, w: number, h: number) {
    const r = new Phaser.Geom.Rectangle(x - w / 2, y - h / 2, w, h);
    return this.bs.enemies.filter((e) => e.alive && Phaser.Geom.Intersects.RectangleToRectangle(r, e.rect()));
  }
}
