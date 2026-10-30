import { GROUND_Y } from '../core/const';
import type { BattleScene } from '../scenes/BattleScene';
import type { Fighter, HitboxOpts, Hitbox, HitInfo } from './combat';

type Obj = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.Container;

export interface ProjOpts extends Omit<HitboxOpts, 'x' | 'y' | 'follow' | 'life'> {
  obj: Obj;
  vx: number; vy: number;
  life: number;
  gravity?: number;
  homing?: number; // radians per second of turning toward nearest target
  homingRange?: number;
  spin?: number; // deg per second
  faceVel?: boolean;
  hitGround?: boolean; // ends when touching the ground
  pierceAll?: boolean; // keep flying after hits
  onEnd?: (x: number, y: number, reason: 'hit' | 'time' | 'ground') => void;
  onTick?: (p: Projectile, dt: number) => void;
  trail?: { stop: () => void };
}

export class Projectile {
  dead = false;
  t = 0;
  hb: Hitbox;
  constructor(public bs: BattleScene, public o: ProjOpts) {
    const userHit = o.onHit;
    this.hb = bs.combat.add({
      ...o, x: 0, y: 0, follow: o.obj, life: o.life + 50,
      onHit: (t: Fighter, h: HitInfo) => {
        userHit?.(t, h);
        if (!o.pierceAll) this.end('hit');
      },
    });
  }

  update(dt: number) {
    if (this.dead) return;
    const o = this.o, s = dt / 1000;
    this.t += dt;
    if (o.homing) {
      const targets: Fighter[] = o.team === 'p' ? this.bs.enemies : [this.bs.player];
      let best: Fighter | null = null, bd = o.homingRange ?? 260;
      for (const e of targets) {
        if (!e.alive) continue;
        const d = Phaser.Math.Distance.Between(o.obj.x, o.obj.y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const sp = Math.hypot(o.vx, o.vy);
        const cur = Math.atan2(o.vy, o.vx);
        const want = Math.atan2(best.y - o.obj.y, best.x - o.obj.x);
        const na = Phaser.Math.Angle.RotateTo(cur, want, o.homing * s);
        o.vx = Math.cos(na) * sp; o.vy = Math.sin(na) * sp;
      }
    }
    if (o.gravity) o.vy += o.gravity * s;
    o.obj.x += o.vx * s;
    o.obj.y += o.vy * s;
    if (o.spin) o.obj.angle += o.spin * s;
    if (o.faceVel) o.obj.rotation = Math.atan2(o.vy, o.vx);
    o.onTick?.(this, dt);
    if (o.hitGround && o.obj.y >= GROUND_Y - 2) { o.obj.y = GROUND_Y - 2; this.end('ground'); return; }
    if (this.t >= o.life) this.end('time');
  }

  end(reason: 'hit' | 'time' | 'ground') {
    if (this.dead) return;
    this.dead = true;
    this.hb.dead = true;
    this.o.trail?.stop();
    this.o.onEnd?.(this.o.obj.x, this.o.obj.y, reason);
    const ob = this.o.obj;
    this.bs.tweens.add({ targets: ob, alpha: 0, scale: (ob.scale ?? 1) * 1.4, duration: 90, onComplete: () => ob.destroy() });
  }
}
