// Basic attack combos and every skill / ultimate effect.
import { GROUND_Y, W, H } from '../core/const';
import { sfx } from '../core/audio';
import type { AbilityDef } from '../data/abilities';
import type { BattleScene } from '../scenes/BattleScene';
import type { Fighter, HitboxOpts } from './combat';
import type { FxKit } from './fxkit';
import type { Player } from './player';

export interface SkillCtx {
  bs: BattleScene; p: Player; dir: number; atk: number; fx: FxKit; c1: number; c2: number; ability: AbilityDef;
}
export interface BasicStep { dur: number; at: number; lunge?: number; fn: (c: SkillCtx, i: number) => void }
export interface BasicDef { mult: number; steps: BasicStep[] }
type SkillFn = (c: SkillCtx) => { lock: number; iframes?: number };

const ADD = Phaser.BlendModes.ADD;
const later = (c: SkillCtx, ms: number, fn: () => void) => c.bs.time.delayedCall(ms, fn);

function hit(c: SkillCtx, mult: number, o: Partial<HitboxOpts> & { x: number; y: number; w: number; h: number }) {
  return c.bs.combat.add({ team: 'p', dmg: c.atk * mult, dir: c.dir, color: c.c1, life: 90, stun: 260, kbx: 70, ...o });
}

function img(c: SkillCtx, key: string, x: number, y: number, tint?: number, add = true) {
  const im = c.bs.add.image(x, y, key).setDepth(55);
  if (tint !== undefined) im.setTint(tint);
  if (add) im.setBlendMode(ADD);
  return im;
}

function nearest(c: SkillCtx, range: number, from = { x: c.p.x, y: c.p.y }, exclude: Fighter[] = []) {
  let best: Fighter | null = null, bd = range;
  for (const e of c.bs.enemies) {
    if (!e.alive || exclude.includes(e)) continue;
    const d = Phaser.Math.Distance.Between(from.x, from.y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function onScreen(c: SkillCtx) {
  const v = c.bs.cameras.main.worldView;
  return c.bs.enemies.filter((e) => e.alive && e.x > v.x - 20 && e.x < v.right + 20);
}

function dim(c: SkillCtx, color: number, alpha: number, dur: number, hold: number) {
  const r = c.bs.add.rectangle(0, 0, W, H, color, 0).setOrigin(0).setScrollFactor(0).setDepth(40);
  c.bs.tweens.add({ targets: r, fillAlpha: alpha, duration: dur, hold, yoyo: true, onComplete: () => r.destroy() });
  return r;
}

const viewCenter = (c: SkillCtx) => { const v = c.bs.cameras.main.worldView; return { x: v.centerX, y: v.centerY, v }; };

/** Moves the player with physics for a short burst (keeps arena collision). */
function burstMove(c: SkillCtx, vx: number, vy: number, ms: number) {
  c.p.gravityOff = true;
  c.p.body.setVelocity(vx, vy);
  later(c, ms, () => { c.p.gravityOff = false; c.p.body.setVelocity(vx * 0.15, 0); });
}

// ======================================================================= BASICS

const swing = (c: SkillCtx, mult: number, o: { w?: number; h?: number; reach?: number; angle?: number; big?: boolean; kb?: number; kby?: number; heavy?: boolean; scale?: number; crit?: number; pierce?: boolean; thin?: number; c?: number }) => {
  const reach = o.reach ?? 22;
  const x = c.p.x + c.dir * reach, y = c.p.y - 2;
  c.fx.slash(x - c.dir * 4, y, c.dir, o.c ?? c.c1, { scale: o.scale ?? 0.85, angle: o.angle ?? 0, big: o.big, thin: o.thin });
  sfx(c.bs, o.heavy ? 'swingHeavy' : 'swing');
  hit(c, mult, { x, y, w: o.w ?? 46, h: o.h ?? 34, kbx: o.kb ?? 70, kby: o.kby ?? 0, heavy: o.heavy, critChance: o.crit ?? 0.1, pierce: o.pierce, hitstop: o.heavy ? 60 : 30 });
};

export const BASICS: Record<string, BasicDef> = {
  blade: {
    mult: 1, steps: [
      { dur: 230, at: 40, lunge: 90, fn: (c) => swing(c, 1, { angle: -0.35 }) },
      { dur: 230, at: 40, lunge: 90, fn: (c) => swing(c, 1, { angle: 0.45 }) },
      { dur: 340, at: 70, lunge: 170, fn: (c) => { swing(c, 1.7, { big: true, scale: 0.75, reach: 28, w: 64, h: 44, kb: 230, kby: -140, heavy: true }); c.fx.shake(0.004, 80); } },
    ],
  },
  flame: {
    mult: 1.05, steps: [
      { dur: 210, at: 50, lunge: 70, fn: (c) => punch(c, 0.9, false) },
      { dur: 210, at: 50, lunge: 70, fn: (c) => punch(c, 0.9, false) },
      { dur: 360, at: 80, lunge: 120, fn: (c) => punch(c, 1.8, true) },
    ],
  },
  frost: {
    mult: 0.95, steps: [
      { dur: 220, at: 40, fn: (c) => iceShard(c, 0) },
      { dur: 220, at: 40, fn: (c) => iceShard(c, 0) },
      { dur: 340, at: 60, fn: (c) => { iceShard(c, -0.18); iceShard(c, 0); iceShard(c, 0.18); } },
    ],
  },
  volt: {
    mult: 0.95, steps: [
      { dur: 150, at: 30, lunge: 60, fn: (c) => jab(c, 0.72) },
      { dur: 150, at: 30, lunge: 60, fn: (c) => jab(c, 0.72) },
      { dur: 150, at: 30, lunge: 60, fn: (c) => jab(c, 0.72) },
      { dur: 300, at: 50, lunge: 40, fn: (c) => {
        const x2 = c.p.x + c.dir * 96;
        c.fx.lightning(c.p.x + c.dir * 10, c.p.y, x2, c.p.y, c.c1, 2);
        c.fx.burst(x2, c.p.y, { tex: 'spark', n: 10, color: [c.c1, c.c2], speed: [60, 180] });
        sfx(c.bs, 'zap');
        hit(c, 1.4, { x: c.p.x + c.dir * 52, y: c.p.y, w: 96, h: 26, kbx: 160, stun: 420, heavy: true, critChance: 0.12, hitstop: 50 });
      } },
    ],
  },
  gale: {
    mult: 0.95, steps: [
      { dur: 230, at: 40, fn: (c) => windCutter(c, 0.9, 0.6, -0.2) },
      { dur: 230, at: 40, fn: (c) => windCutter(c, 0.9, 0.6, 0.25) },
      { dur: 340, at: 60, fn: (c) => windCutter(c, 1.5, 0.95, 0) },
    ],
  },
  shadow: {
    mult: 0.95, steps: [
      { dur: 140, at: 20, lunge: 80, fn: (c) => swing(c, 0.62, { angle: -0.5, scale: 0.6, thin: 0.5, crit: 0.35, w: 40 }) },
      { dur: 140, at: 20, lunge: 80, fn: (c) => swing(c, 0.62, { angle: 0.5, scale: 0.6, thin: 0.5, crit: 0.35, w: 40, c: c.c2 }) },
      { dur: 140, at: 20, lunge: 80, fn: (c) => swing(c, 0.62, { angle: -0.1, scale: 0.65, thin: 0.45, crit: 0.35, w: 40 }) },
      { dur: 280, at: 40, lunge: 160, fn: (c) => {
        swing(c, 1.1, { angle: 0.7, scale: 0.8, thin: 0.5, crit: 0.4, w: 52, kb: 200, heavy: true });
        swing(c, 0, { angle: -0.7, scale: 0.8, thin: 0.5, c: c.c2, w: 1, h: 1 });
      } },
    ],
  },
  star: {
    mult: 0.95, steps: [
      { dur: 230, at: 40, fn: (c) => starBolt(c, 0.85, -0.25) },
      { dur: 230, at: 40, fn: (c) => starBolt(c, 0.85, 0.25) },
      { dur: 340, at: 60, fn: (c) => { starBolt(c, 0.6, -0.5); starBolt(c, 0.6, 0); starBolt(c, 0.6, 0.5); } },
    ],
  },
  void: {
    mult: 1.05, steps: [
      { dur: 250, at: 50, lunge: 80, fn: (c) => claw(c, 1.05, -0.25) },
      { dur: 250, at: 50, lunge: 80, fn: (c) => claw(c, 1.05, 0.3) },
      { dur: 380, at: 80, lunge: 140, fn: (c) => {
        claw(c, 1.6, 0);
        const x = c.p.x + c.dir * 40;
        later(c, 120, () => {
          c.fx.ring(x, c.p.y, c.c1, 4, 50, 260); c.fx.ring(x, c.p.y, c.c2, 4, 40, 300, true);
          c.fx.burst(x, c.p.y, { tex: 'p2', n: 14, color: [c.c1, c.c2, 0x000000], speed: [40, 160] });
          hit(c, 0.9, { x, y: c.p.y, w: 70, h: 54, pierce: true, kbx: 150, heavy: true, hitstop: 60 });
        });
      } },
    ],
  },
};

function punch(c: SkillCtx, mult: number, big: boolean) {
  const x = c.p.x + c.dir * (big ? 28 : 20), y = c.p.y;
  c.fx.glow(x, y, c.c1, big ? 0.9 : 0.45, 160);
  c.fx.burst(x, y, { tex: 'flame', n: big ? 16 : 6, color: [c.c1, c.c2, 0xff4020], speed: [40, big ? 200 : 110], angle: c.dir > 0 ? [-50, 50] : [130, 230], life: [200, 420], scale: [1, 0.2] });
  sfx(c.bs, big ? 'boom' : 'swing', { vol: big ? 0.6 : 1 });
  if (big) { c.fx.ring(x, y, c.c1, 6, 60, 260); c.fx.shake(0.005, 90); }
  hit(c, mult, { x, y, w: big ? 66 : 36, h: big ? 50 : 30, kbx: big ? 220 : 60, kby: big ? -120 : 0, heavy: big, critChance: 0.1, hitstop: big ? 60 : 30 });
}

function iceShard(c: SkillCtx, ang: number) {
  const o = img(c, 'shard', c.p.x + c.dir * 12, c.p.y - 2, c.c1).setScale(1.6, 1.4);
  sfx(c.bs, 'shoot', { rate: 1.4, vol: 0.6 });
  const sp = 430;
  c.bs.addProj({
    team: 'p', obj: o, vx: Math.cos(ang) * sp * c.dir, vy: Math.sin(ang) * sp, life: 420, faceVel: true, w: 14, h: 10,
    dmg: c.atk * 0.82, kbx: 40, stun: 200, critChance: 0.1, color: c.c1, slow: 600,
    trail: c.fx.trail(o, { tex: 'p1', color: [c.c1, 0xffffff], freq: 25, life: [150, 250], speed: [0, 10] }),
    onEnd: (x, y) => c.fx.burst(x, y, { tex: 'snow', n: 5, color: [c.c1, 0xffffff], speed: [30, 90], life: [200, 350] }),
  });
}

function jab(c: SkillCtx, mult: number) {
  const x = c.p.x + c.dir * 22, y = c.p.y + (Math.random() - 0.5) * 8;
  c.fx.lightning(c.p.x + c.dir * 6, y, x + c.dir * 14, y + (Math.random() - 0.5) * 10, c.c1, 1, 120);
  c.fx.burst(x, y, { tex: 'p1', n: 6, color: [c.c1, c.c2], speed: [60, 150], life: [100, 220] });
  sfx(c.bs, 'swing', { rate: 1.3 });
  hit(c, mult, { x, y, w: 42, h: 28, kbx: 40, stun: 260, critChance: 0.12 });
}

function windCutter(c: SkillCtx, mult: number, scale: number, ang: number) {
  const o = img(c, 'slash', c.p.x + c.dir * 16, c.p.y, c.c1).setScale(scale * 0.7, scale).setFlipX(c.dir < 0).setRotation(c.dir * ang);
  sfx(c.bs, 'swing', { rate: 0.9 });
  c.bs.addProj({
    team: 'p', obj: o, vx: 400 * c.dir, vy: 0, life: 300, w: 30 * scale + 10, h: 34 * scale, dmg: c.atk * mult, pierceAll: true,
    kbx: 90 * scale, stun: 240, critChance: 0.1, color: c.c1,
    trail: c.fx.trail(o, { tex: 'leaf', color: [c.c1, c.c2], freq: 30, life: [200, 400], speed: [10, 40], add: false }),
    onTick: (p) => { p.o.obj.alpha = 1 - p.t / 300; },
  });
}

function starBolt(c: SkillCtx, mult: number, ang: number) {
  const o = img(c, 'star4', c.p.x + c.dir * 10, c.p.y - 4, c.c1).setScale(1.1);
  sfx(c.bs, 'shoot', { rate: 1.7, vol: 0.5 });
  c.bs.addProj({
    team: 'p', obj: o, vx: Math.cos(ang) * 330 * c.dir, vy: Math.sin(ang) * 330, life: 800, spin: 540, homing: 7, homingRange: 240,
    w: 14, h: 14, dmg: c.atk * mult, kbx: 40, stun: 200, critChance: 0.12, color: c.c1,
    trail: c.fx.trail(o, { tex: 'p2', color: [c.c1, c.c2], freq: 20, life: [150, 300], speed: [0, 15] }),
    onEnd: (x, y) => { c.fx.burst(x, y, { tex: 'star4', n: 4, color: [c.c1, c.c2], speed: [30, 80], scale: [0.6, 0] }); },
  });
}

function claw(c: SkillCtx, mult: number, ang: number) {
  const x = c.p.x + c.dir * 26, y = c.p.y;
  for (let i = -1; i <= 1; i++) {
    later(c, (i + 1) * 25, () => {
      c.fx.slash(x, y + i * 8, c.dir, i === 0 ? c.c2 : c.c1, { scale: 0.7, angle: ang + 0.6, thin: 0.3, dur: 240 });
    });
  }
  c.fx.burst(x, y, { tex: 'p2', n: 8, color: [0x000000, c.c1], speed: [30, 90], add: false, life: [200, 400] });
  sfx(c.bs, 'swing', { rate: 0.7 });
  hit(c, mult, { x, y, w: 50, h: 40, kbx: 80, pierce: true, critChance: 0.12, hitstop: 35 });
}

// ======================================================================= SKILLS

export const SKILL_FX: Record<string, SkillFn> = {
  // ------------------------------------------------------------ BLADE
  blade_dash: (c) => {
    const x0 = c.p.x;
    burstMove(c, c.dir * 900, 0, 170);
    sfx(c.bs, 'dash');
    c.fx.dust(x0, GROUND_Y - 1, 6, -c.dir);
    const ev = c.bs.time.addEvent({ delay: 25, repeat: 6, callback: () => c.fx.afterimage(c.p.spr, c.c1, 260, 0.7) });
    hit(c, 1, { x: 0, y: 0, follow: c.p.spr, offY: -9, w: 60, h: 36, life: 200, kbx: 40, stun: 500, critChance: 0.15 });
    later(c, 180, () => {
      ev.remove();
      const x1 = c.p.x;
      const mid = (x0 + x1) / 2;
      const ln = img(c, 'line', mid, c.p.y, c.c1).setScale(Math.abs(x1 - x0) / 64 + 0.6, 3);
      c.bs.tweens.add({ targets: ln, scaleY: 0, alpha: 0, duration: 260, onComplete: () => ln.destroy() });
      later(c, 140, () => {
        c.fx.slash(mid, c.p.y, c.dir, c.c1, { big: true, scale: 1.2, thin: 0.35, dur: 260 });
        c.fx.flash(c.c1, 0.2, 120);
        c.fx.shake(0.006, 120);
        sfx(c.bs, 'swingHeavy');
        hit(c, 1.3, { x: mid, y: c.p.y, w: Math.abs(x1 - x0) + 60, h: 44, kbx: 180, kby: -120, heavy: true, critChance: 0.2, hitstop: 70 });
      });
    });
    return { lock: 330, iframes: 360 };
  },
  blade_whirl: (c) => {
    sfx(c.bs, 'swingHeavy');
    if (!c.p.onGround) c.p.body.setVelocityY(-60);
    for (let i = 0; i < 6; i++) {
      later(c, i * 95, () => {
        const a = i * 1.05;
        c.fx.slash(c.p.x + Math.cos(a) * 16, c.p.y + Math.sin(a) * 6, i % 2 ? 1 : -1, i % 2 ? c.c1 : c.c2, { scale: 0.9, angle: a, thin: 0.6, dur: 180 });
        c.fx.ring(c.p.x, c.p.y, c.c1, 10, 52, 200, true);
        if (i % 2) sfx(c.bs, 'swing', { rate: 1.1 + i * 0.05 });
        hit(c, 1, { x: c.p.x, y: c.p.y, w: 96, h: 54, kbx: i === 5 ? 200 : 20, kby: i === 5 ? -160 : 0, stun: 300, critChance: 0.12, heavy: i === 5, hitstop: i === 5 ? 60 : 0 });
      });
    }
    const tr = c.fx.trail(c.p.spr, { tex: 'p2', color: [c.c1, 0xffffff], freq: 15, life: [200, 400], speed: [60, 140], spread: 6 });
    later(c, 600, () => tr.stop());
    return { lock: 620 };
  },
  blade_ult: (c) => {
    const { v } = viewCenter(c);
    dim(c, 0x000010, 0.65, 150, 1300);
    const per = 0.24;
    for (let i = 0; i < 26; i++) {
      later(c, 60 + i * 45, () => {
        const x = v.x + 40 + Math.random() * (W - 80), y = v.y + 60 + Math.random() * (H - 110);
        const ln = c.bs.add.image(x, y, 'line').setBlendMode(ADD).setTint(i % 3 ? c.c1 : 0xffffff).setDepth(60)
          .setRotation(Math.random() * Math.PI).setScale(0.2, 2);
        c.bs.tweens.add({ targets: ln, scaleX: 5 + Math.random() * 3, duration: 70, onComplete: () => c.bs.tweens.add({ targets: ln, scaleY: 0, alpha: 0, duration: 220, onComplete: () => ln.destroy() }) });
        if (i % 3 === 0) sfx(c.bs, 'swing', { rate: 1.5 + Math.random() * 0.5, vol: 0.6 });
        for (const e of onScreen(c)) if (Math.random() < 0.55) hit(c, per * 1.6, { x: e.x, y: e.y, w: 20, h: 20, stun: 400, kbx: 0, noSpark: false, critChance: 0.15, life: 40 });
      });
    }
    later(c, 1350, () => {
      const cx = v.centerX, cy = v.centerY + 20;
      c.fx.flash(0xffffff, 0.9, 300);
      c.fx.shake(0.02, 400);
      sfx(c.bs, 'bigBoom');
      for (const ang of [0.6, -0.6]) {
        const s = c.bs.add.image(cx, cy, 'slashBig').setBlendMode(ADD).setTint(c.c1).setDepth(61).setRotation(ang).setScale(0.5, 0.7);
        c.bs.tweens.add({ targets: s, scaleX: 6, scaleY: 1.2, alpha: 0, duration: 500, ease: 'Cubic.easeOut', onComplete: () => s.destroy() });
      }
      c.fx.ring(cx, cy, 0xffffff, 10, 400, 500);
      c.fx.burst(cx, cy, { tex: 'streak', n: 40, color: [c.c1, 0xffffff], speed: [200, 500], life: [300, 600] });
      for (const e of onScreen(c)) hit(c, 3, { x: e.x, y: e.y, w: 30, h: 30, kbx: 260, kby: -200, heavy: true, stun: 800, critChance: 0.3, hitstop: 120 });
    });
    return { lock: 1500 };
  },

  // ------------------------------------------------------------ FLAME
  flame_ball: (c) => {
    const o = c.bs.add.container(c.p.x + c.dir * 16, c.p.y - 2).setDepth(56);
    const g = c.bs.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(c.c1).setScale(0.9);
    const core = c.bs.add.image(0, 0, 'orb').setBlendMode(ADD).setTint(c.c2).setScale(1.2);
    o.add([g, core]);
    c.bs.tweens.add({ targets: core, scale: 1.45, duration: 80, yoyo: true, repeat: -1 });
    sfx(c.bs, 'shoot', { rate: 0.7 });
    c.fx.burst(o.x, o.y, { tex: 'flame', n: 10, color: [c.c1, c.c2], speed: [40, 120] });
    c.bs.addProj({
      team: 'p', obj: o, vx: 340 * c.dir, vy: 0, life: 650, w: 26, h: 26, dmg: c.atk * 0.6, color: c.c1, kbx: 60, skill: true,
      trail: c.fx.trail(o, { tex: 'flame', color: [c.c1, c.c2, 0xff3010], freq: 12, life: [250, 450], speed: [10, 50], spread: 6, gravity: -120 }),
      onEnd: (x, y) => {
        c.fx.glow(x, y, c.c1, 2.4, 400);
        c.fx.ring(x, y, c.c2, 8, 110, 380);
        c.fx.burst(x, y, { tex: 'flame', n: 30, color: [c.c1, c.c2, 0xff3010], speed: [80, 260], life: [300, 650], gravity: -200 });
        c.fx.burst(x, y, { tex: 'smoke', n: 8, color: 0x3a2020, speed: [20, 70], add: false, life: [400, 800], alpha: [0.6, 0] });
        c.fx.shake(0.008, 160);
        sfx(c.bs, 'boom');
        hit(c, 1.3, { x, y, w: 104, h: 84, kbx: 220, kby: -160, heavy: true, skill: true, critChance: 0.1, hitstop: 70 });
      },
    });
    return { lock: 300 };
  },
  flame_pillar: (c) => {
    for (let i = 0; i < 3; i++) {
      later(c, i * 150, () => {
        const x = c.p.x + c.dir * (54 + i * 62);
        c.fx.glow(x, GROUND_Y - 4, c.c1, 1.2, 200);
        later(c, 90, () => {
          c.fx.beam(x, GROUND_Y - 150, GROUND_Y, 38, c.c1, 420);
          c.fx.burst(x, GROUND_Y - 10, { tex: 'flame', n: 22, color: [c.c1, c.c2, 0xff3010], speed: [60, 200], angle: [250, 290], life: [300, 600], gravity: -300 });
          c.fx.dust(x, GROUND_Y - 1, 5);
          c.fx.shake(0.005, 100);
          sfx(c.bs, 'boom', { rate: 1.2 + i * 0.1, vol: 0.7 });
          hit(c, 1, { x, y: GROUND_Y - 70, w: 42, h: 140, life: 300, interval: 140, kbx: 20, kby: -300, stun: 600, skill: true, critChance: 0.1, hitstop: 40 });
        });
      });
    }
    return { lock: 420 };
  },
  flame_ult: (c) => {
    const { v } = viewCenter(c);
    const tx = v.centerX, ty = GROUND_Y - 20;
    dim(c, 0x200400, 0.45, 300, 1400);
    const sun = c.bs.add.container(tx, v.y - 60).setDepth(58);
    const g1 = c.bs.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(0xff6010).setScale(4);
    const g2 = c.bs.add.image(0, 0, 'disc').setBlendMode(ADD).setTint(0xffb040).setScale(1.1);
    const g3 = c.bs.add.image(0, 0, 'disc').setBlendMode(ADD).setTint(0xfff6c0).setScale(0.7);
    sun.add([g1, g2, g3]);
    c.bs.tweens.add({ targets: g1, scale: 4.6, duration: 120, yoyo: true, repeat: -1 });
    const tr = c.fx.trail(sun, { tex: 'flame', color: [0xff6010, 0xffd040], freq: 8, life: [300, 600], speed: [40, 120], spread: 30, scale: [2, 0] });
    sfx(c.bs, 'fall');
    c.bs.tweens.add({
      targets: sun, y: ty, duration: 800, ease: 'Quad.easeIn',
      onComplete: () => {
        tr.stop(); sun.destroy();
        c.fx.flash(0xffffff, 1, 250);
        later(c, 120, () => c.fx.flash(0xff6010, 0.6, 500));
        c.fx.shake(0.03, 600);
        sfx(c.bs, 'bigBoom');
        for (let i = 0; i < 4; i++) later(c, i * 80, () => c.fx.ring(tx, ty, i % 2 ? 0xffd040 : 0xff6010, 10, 300 + i * 80, 600));
        c.fx.glow(tx, ty, 0xff8020, 8, 900);
        c.fx.burst(tx, ty, { tex: 'flame', n: 70, color: [0xff6010, 0xffd040, 0xfff6c0], speed: [150, 520], life: [400, 900], scale: [2.2, 0], gravity: -200 });
        c.fx.burst(tx, ty, { tex: 'smoke', n: 20, color: 0x2a1010, speed: [60, 200], add: false, life: [600, 1200], scale: [2, 0.5], alpha: [0.7, 0] });
        for (const e of onScreen(c)) hit(c, 0.65, { x: e.x, y: e.y, w: 30, h: 30, kbx: 300, kby: -280, heavy: true, stun: 900, skill: true, critChance: 0.2, hitstop: 120 });
        for (let k = 0; k < 7; k++) later(c, 300 + k * 160, () => {
          for (let j = 0; j < 4; j++) c.fx.burst(v.x + Math.random() * W, GROUND_Y - 4, { tex: 'flame', n: 4, color: [0xff6010, 0xffd040], angle: [250, 290], speed: [40, 120], gravity: -100 });
          for (const e of onScreen(c)) hit(c, 0.05, { x: e.x, y: e.y, w: 30, h: 30, kbx: 0, stun: 200, skill: true, life: 40 });
        });
      },
    });
    return { lock: 1400 };
  },

  // ------------------------------------------------------------ FROST
  frost_lance: (c) => {
    const o = c.bs.add.container(c.p.x + c.dir * 14, c.p.y - 2).setDepth(56);
    const g = c.bs.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(c.c2).setScale(0.8, 0.5);
    const s = c.bs.add.image(0, 0, 'shard').setBlendMode(ADD).setTint(c.c1).setScale(6, 3).setFlipX(c.dir < 0);
    const s2 = c.bs.add.image(0, 0, 'shard').setBlendMode(ADD).setTint(0xffffff).setScale(4, 1.5).setFlipX(c.dir < 0);
    o.add([g, s, s2]);
    sfx(c.bs, 'shoot', { rate: 0.8 });
    c.fx.ring(o.x, o.y, c.c1, 4, 40, 200, true);
    c.bs.addProj({
      team: 'p', obj: o, vx: 560 * c.dir, vy: 0, life: 650, w: 44, h: 16, dmg: c.atk, pierceAll: true, interval: 9999, slow: 2400, color: c.c1,
      kbx: 120, stun: 400, skill: true, critChance: 0.12, hitstop: 40,
      trail: c.fx.trail(o, { tex: 'snow', color: [c.c1, 0xffffff], freq: 14, life: [300, 500], speed: [10, 40], spread: 4 }),
      onHit: (t) => c.fx.burst(t.x, t.y, { tex: 'shard', n: 8, color: [c.c1, 0xffffff], speed: [60, 180], rotate: true }),
    });
    return { lock: 280 };
  },
  frost_nova: (c) => {
    const x = c.p.x, y = c.p.y;
    sfx(c.bs, 'shatter');
    c.fx.flash(c.c1, 0.25, 200);
    c.fx.ring(x, y, c.c1, 6, 130, 420);
    c.fx.ring(x, y, 0xffffff, 6, 100, 300, true);
    c.fx.glow(x, y, c.c2, 2.5, 500);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const d = img(c, 'diamond', x + Math.cos(a) * 20, Math.min(GROUND_Y - 4, y + Math.sin(a) * 14), c.c1).setScale(0.5, 1.4).setRotation(a + Math.PI / 2);
      c.bs.tweens.add({ targets: d, x: x + Math.cos(a) * 70, y: Math.min(GROUND_Y - 4, y + Math.sin(a) * 40), scaleY: 2.4, duration: 220, ease: 'Back.easeOut', onComplete: () => c.bs.tweens.add({ targets: d, alpha: 0, delay: 500, duration: 300, onComplete: () => d.destroy() }) });
    }
    c.fx.burst(x, y, { tex: 'snow', n: 30, color: [c.c1, 0xffffff], speed: [60, 220], life: [400, 800] });
    hit(c, 1, { x, y, w: 170, h: 100, freeze: 1600, kbx: 30, stun: 300, skill: true, critChance: 0.1, hitstop: 60 });
    return { lock: 450 };
  },
  frost_ult: (c) => {
    const { v } = viewCenter(c);
    dim(c, 0x10305a, 0.5, 300, 1800);
    const storm = c.bs.add.particles(0, 0, 'snow', {
      x: { min: 0, max: W + 200 }, y: -10, speedX: { min: -500, max: -300 }, speedY: { min: 150, max: 300 },
      lifespan: 1400, scale: { min: 0.6, max: 1.6 }, alpha: { start: 1, end: 0.2 }, tint: [c.c1, 0xffffff, c.c2], frequency: 6, blendMode: 'ADD',
    }).setScrollFactor(0).setDepth(62);
    sfx(c.bs, 'skid', { rate: 0.5 });
    for (let k = 0; k < 10; k++) later(c, 200 + k * 130, () => {
      for (const e of onScreen(c)) hit(c, 0.45, { x: e.x, y: e.y, w: 30, h: 30, kbx: 10, stun: 300, slow: 1500, skill: true, critChance: 0.1, life: 40, noSpark: k % 2 === 1 });
    });
    later(c, 1550, () => {
      storm.stop();
      c.bs.time.delayedCall(1500, () => storm.destroy());
      const targets = onScreen(c);
      for (const e of targets) {
        hit(c, 0.01, { x: e.x, y: e.y, w: 30, h: 30, freeze: 1500, kbx: 0, stun: 0, skill: true, life: 40, noSpark: true });
        const ice = img(c, 'diamond', e.x, e.y, c.c1).setScale(3, 4).setAlpha(0.85);
        c.bs.tweens.add({ targets: ice, scale: 4.5, alpha: 1, duration: 200 });
        later(c, 500, () => {
          ice.destroy();
          c.fx.burst(e.x, e.y, { tex: 'shard', n: 16, color: [c.c1, 0xffffff, c.c2], speed: [100, 300], rotate: true, gravity: 400, life: [400, 700] });
          hit(c, 3, { x: e.x, y: e.y, w: 40, h: 40, kbx: 160, kby: -200, heavy: true, stun: 700, skill: true, pierce: true, critChance: 0.25, hitstop: 80 });
        });
      }
      later(c, 500, () => { c.fx.flash(0xffffff, 0.7, 250); c.fx.shake(0.02, 300); sfx(c.bs, 'shatter'); sfx(c.bs, 'bigBoom', { vol: 0.6 }); });
      c.fx.ring(v.centerX, v.centerY, c.c1, 20, 500, 600);
    });
    return { lock: 2100 };
  },

  // ------------------------------------------------------------ VOLT
  volt_chain: (c) => {
    sfx(c.bs, 'zap');
    const first = nearest(c, 280);
    if (!first) {
      const x2 = c.p.x + c.dir * 120;
      c.fx.lightning(c.p.x, c.p.y, x2, c.p.y, c.c1, 2);
      c.fx.burst(x2, c.p.y, { tex: 'spark', n: 8, color: c.c1 });
      return { lock: 260 };
    }
    const chain: Fighter[] = [first];
    while (chain.length < 6) {
      const n = nearest(c, 170, chain[chain.length - 1], chain);
      if (!n) break;
      chain.push(n);
    }
    let prev = { x: c.p.x, y: c.p.y };
    chain.forEach((e, i) => {
      const from = { ...prev };
      later(c, i * 80, () => {
        if (!e.alive) return;
        c.fx.lightning(from.x, from.y, e.x, e.y, c.c1, 3, 300);
        c.fx.glow(e.x, e.y, c.c2, 0.8, 200);
        c.fx.burst(e.x, e.y, { tex: 'spark', n: 10, color: [c.c1, c.c2, 0xffffff], speed: [60, 200] });
        sfx(c.bs, 'zap', { rate: 1 + i * 0.12, vol: 0.6 });
        hit(c, 1, { x: e.x, y: e.y, w: 30, h: 30, stun: 600, kbx: 30, skill: true, critChance: 0.12, life: 40, hitstop: 30 });
      });
      prev = { x: e.x, y: e.y };
    });
    return { lock: 280 };
  },
  volt_dash: (c) => {
    const x0 = c.p.x, y0 = c.p.y;
    const b = c.bs.arenaBounds();
    const x1 = Phaser.Math.Clamp(x0 + c.dir * 180, b.left + 12, b.right - 12);
    c.fx.flash(c.c1, 0.25, 100);
    c.p.spr.setAlpha(0);
    c.fx.burst(x0, y0, { tex: 'spark', n: 14, color: [c.c1, 0xffffff], speed: [80, 220] });
    sfx(c.bs, 'zap', { rate: 0.8 });
    later(c, 60, () => {
      c.p.spr.x = x1; c.p.body.reset(x1, c.p.spr.y);
      c.p.spr.setAlpha(1);
      c.fx.lightning(x0, y0, x1, c.p.y, c.c1, 3, 280);
      c.fx.ring(x1, c.p.y, c.c1, 4, 50, 220);
      for (let i = 0; i < 3; i++) later(c, 60 + i * 90, () => {
        const sx = x0 + (x1 - x0) * ((i + 1) / 3.2);
        c.fx.beam(sx, GROUND_Y - 260, GROUND_Y, 22, c.c1, 260);
        c.fx.lightning(sx + (Math.random() - 0.5) * 20, GROUND_Y - 260, sx, GROUND_Y - 4, 0xffffff, 2, 200);
        c.fx.groundSlam(sx, GROUND_Y - 1, c.c1, 0.6);
        c.fx.shake(0.005, 90);
        sfx(c.bs, 'boom', { rate: 1.6, vol: 0.5 });
        hit(c, 1, { x: sx, y: GROUND_Y - 60, w: 50, h: 140, stun: 500, kbx: 60, kby: -120, skill: true, critChance: 0.12, hitstop: 40 });
      });
    });
    return { lock: 320, iframes: 380 };
  },
  volt_ult: (c) => {
    const { v } = viewCenter(c);
    dim(c, 0x05051a, 0.7, 200, 1500);
    const rounds = 3;
    for (let r = 0; r < rounds; r++) {
      later(c, 200 + r * 380, () => {
        const ts = onScreen(c);
        const points = ts.length ? ts.map((e) => ({ x: e.x, e })) : [0, 1, 2].map(() => ({ x: v.x + 60 + Math.random() * (W - 120), e: null as Fighter | null }));
        c.fx.flash(0xffffff, 0.35, 90);
        c.fx.shake(0.012, 200);
        sfx(c.bs, 'bigBoom', { rate: 1.3 + r * 0.1, vol: 0.7 });
        for (const pt of points) {
          c.fx.beam(pt.x, v.y - 10, GROUND_Y, 48, c.c1, 400);
          c.fx.lightning(pt.x + (Math.random() - 0.5) * 60, v.y - 10, pt.x, GROUND_Y - 6, 0xffffff, 3, 300);
          c.fx.lightning(pt.x + (Math.random() - 0.5) * 60, v.y - 10, pt.x, GROUND_Y - 6, c.c2, 2, 300);
          c.fx.groundSlam(pt.x, GROUND_Y - 1, c.c1, 1.2);
          c.fx.burst(pt.x, GROUND_Y - 30, { tex: 'spark', n: 16, color: [c.c1, c.c2, 0xffffff], speed: [100, 320] });
          if (pt.e) hit(c, 3.1, { x: pt.e.x, y: pt.e.y, w: 40, h: 40, stun: 800, kbx: 40, kby: -100, heavy: true, skill: true, pierce: true, critChance: 0.2, life: 40, hitstop: 90 });
        }
      });
    }
    return { lock: 1450 };
  },

  // ------------------------------------------------------------ GALE
  gale_tornado: (c) => {
    const o = c.bs.add.container(c.p.x + c.dir * 30, GROUND_Y - 40).setDepth(56);
    const rings: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 6; i++) {
      const r = c.bs.add.image(0, 30 - i * 13, 'ringThin').setBlendMode(ADD).setTint(i % 2 ? c.c1 : c.c2).setScale(0.25 + i * 0.09, 0.08 + i * 0.012);
      rings.push(r); o.add(r);
    }
    const tw = c.bs.tweens.add({ targets: rings, x: { from: -4, to: 4 }, duration: 90, yoyo: true, repeat: -1, delay: c.bs.tweens.stagger(30, {}) });
    sfx(c.bs, 'skid', { rate: 0.7 });
    const tr = c.fx.trail(o, { tex: 'leaf', color: [c.c1, c.c2, 0xffffff], freq: 14, life: [300, 600], speed: [60, 160], angle: [200, 340], spread: 16, add: false });
    c.bs.addProj({
      team: 'p', obj: o, vx: 130 * c.dir, vy: 0, life: 1700, w: 56, h: 90, dmg: c.atk, pierceAll: true, interval: 140,
      kbx: 0, stun: 300, skill: true, critChance: 0.08, color: c.c1, noSpark: false, trail: tr,
      onTick: (p) => {
        for (const e of c.bs.enemies) if (e.alive && Math.abs(e.x - p.o.obj.x) < 110 && !e.isBoss) e.pullTo?.(p.o.obj.x, p.o.obj.y, 160);
      },
      onEnd: (x, y) => {
        tw.stop();
        c.fx.burst(x, y, { tex: 'leaf', n: 20, color: [c.c1, c.c2], speed: [80, 220], add: false });
        hit(c, 2.4, { x, y, w: 80, h: 100, kbx: 60, kby: -320, stun: 600, skill: true, heavy: true, hitstop: 50 });
      },
    });
    return { lock: 300 };
  },
  gale_rise: (c) => {
    const x = c.p.x, y = c.p.y;
    c.p.body.setVelocityY(-430);
    sfx(c.bs, 'jump', { rate: 0.8 });
    sfx(c.bs, 'swingHeavy');
    c.fx.ring(x, GROUND_Y - 2, c.c1, 8, 80, 300);
    for (let i = 0; i < 8; i++) {
      const s = img(c, 'streak', x + (Math.random() - 0.5) * 80, GROUND_Y - Math.random() * 20, c.c1).setRotation(-Math.PI / 2).setScale(1, 1.5);
      c.bs.tweens.add({ targets: s, y: s.y - 140 - Math.random() * 60, alpha: 0, duration: 400 + Math.random() * 200, onComplete: () => s.destroy() });
    }
    c.fx.burst(x, GROUND_Y - 6, { tex: 'leaf', n: 24, color: [c.c1, c.c2], speed: [100, 300], angle: [240, 300], add: false, life: [400, 800] });
    hit(c, 1, { x, y: y - 20, w: 130, h: 110, kbx: 0, kby: -460, stun: 900, skill: true, critChance: 0.12, hitstop: 50 });
    return { lock: 240 };
  },
  gale_ult: (c) => {
    const { v } = viewCenter(c);
    const cx = Phaser.Math.Clamp(c.p.x + c.dir * 140, v.x + 120, v.right - 120), cy = GROUND_Y - 80;
    dim(c, 0x052018, 0.45, 300, 2000);
    const holder = c.bs.add.container(cx, cy).setDepth(57);
    const rings: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 10; i++) {
      const r = c.bs.add.image(0, 70 - i * 16, 'ring').setBlendMode(ADD).setTint(i % 2 ? c.c1 : c.c2).setScale(0.6 + i * 0.22, 0.12 + i * 0.03).setAlpha(0);
      rings.push(r); holder.add(r);
    }
    c.bs.tweens.add({ targets: rings, alpha: 0.9, duration: 300, delay: c.bs.tweens.stagger(30, {}) });
    c.bs.tweens.add({ targets: rings, x: { from: -10, to: 10 }, duration: 120, yoyo: true, repeat: -1, delay: c.bs.tweens.stagger(25, {}) });
    const swirl = c.bs.add.particles(cx, cy, 'leaf', {
      emitZone: { type: 'edge', source: new Phaser.Geom.Ellipse(0, 0, 360, 200), quantity: 48 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      moveToX: cx, moveToY: cy, lifespan: 600, scale: { start: 1.6, end: 0.4 }, tint: [c.c1, c.c2, 0xffffff], frequency: 10, quantity: 2,
    }).setDepth(58);
    sfx(c.bs, 'skid', { rate: 0.4 });
    for (let k = 0; k < 20; k++) later(c, 200 + k * 100, () => {
      for (const e of onScreen(c)) {
        if (!e.isBoss) e.pullTo?.(cx, cy, 340);
        if (Math.abs(e.x - cx) < 160) hit(c, 0.3, { x: e.x, y: e.y, w: 30, h: 30, kbx: 0, stun: 300, skill: true, critChance: 0.08, life: 40, noSpark: k % 2 === 1 });
      }
      if (k % 4 === 0) sfx(c.bs, 'swing', { rate: 0.8, vol: 0.5 });
    });
    later(c, 2250, () => {
      swirl.stop(); later(c, 700, () => swirl.destroy());
      c.bs.tweens.add({ targets: holder, scaleX: 2.2, alpha: 0, duration: 300, onComplete: () => holder.destroy() });
      c.fx.flash(c.c1, 0.6, 300);
      c.fx.shake(0.02, 300);
      c.fx.ring(cx, cy, 0xffffff, 20, 400, 500);
      c.fx.burst(cx, cy, { tex: 'leaf', n: 60, color: [c.c1, c.c2, 0xffffff], speed: [200, 500], add: false, life: [400, 900] });
      sfx(c.bs, 'bigBoom');
      for (const e of onScreen(c)) hit(c, 3, { x: e.x, y: e.y, w: 30, h: 30, kbx: 200, kby: -420, heavy: true, stun: 900, skill: true, critChance: 0.2, life: 40, hitstop: 100 });
    });
    return { lock: 2300 };
  },

  // ------------------------------------------------------------ SHADOW
  shadow_star: (c) => {
    sfx(c.bs, 'swing', { rate: 1.4 });
    for (let i = -2; i <= 2; i++) {
      const ang = i * 0.13;
      const o = img(c, 'shuriken', c.p.x + c.dir * 10, c.p.y - 2, i % 2 ? c.c1 : c.c2, false).setScale(1.2);
      c.bs.addProj({
        team: 'p', obj: o, vx: Math.cos(ang) * 420 * c.dir, vy: Math.sin(ang) * 420, life: 520, spin: 1400, w: 16, h: 16,
        dmg: c.atk, pierceAll: true, interval: 9999, kbx: 40, stun: 260, critChance: 0.3, skill: true, color: c.c1,
        trail: c.fx.trail(o, { tex: 'p1', color: [c.c1, c.c2], freq: 20, life: [120, 220], speed: [0, 10] }),
      });
    }
    return { lock: 260 };
  },
  shadow_strike: (c) => {
    const t = nearest(c, 320);
    c.fx.burst(c.p.x, c.p.y, { tex: 'smoke', n: 12, color: [0x2a1040, c.c1], speed: [30, 120], add: false, alpha: [0.8, 0], life: [300, 600] });
    c.p.spr.setAlpha(0);
    sfx(c.bs, 'dash', { rate: 0.7 });
    const b = c.bs.arenaBounds();
    later(c, 120, () => {
      const side = t ? Math.sign(t.x - c.p.x) || c.dir : c.dir;
      const tx = Phaser.Math.Clamp(t ? t.x + side * 30 : c.p.x + c.dir * 120, b.left + 12, b.right - 12);
      c.p.spr.x = tx; c.p.body.reset(tx, c.p.spr.y);
      c.p.facing = -side; c.p.spr.setFlipX(-side < 0);
      c.p.spr.setAlpha(1);
      c.fx.burst(tx, c.p.y, { tex: 'smoke', n: 10, color: [0x2a1040, c.c1], speed: [30, 120], add: false, alpha: [0.8, 0], life: [300, 600] });
      later(c, 70, () => {
        const hx = tx - side * 26;
        c.fx.slash(hx, c.p.y, -side, c.c2, { scale: 1.2, angle: 0.8, thin: 0.4, dur: 260 });
        c.fx.slash(hx, c.p.y, -side, c.c1, { scale: 1.2, angle: -0.8, thin: 0.4, dur: 260 });
        c.fx.flash(c.c2, 0.25, 140);
        c.fx.shake(0.008, 140);
        sfx(c.bs, 'swingHeavy'); sfx(c.bs, 'hitHeavy');
        hit(c, 1, { x: hx, y: c.p.y, w: 60, h: 44, dir: -side, kbx: 200, kby: -120, heavy: true, stun: 700, skill: true, forceCrit: true, pierce: true, hitstop: 110 });
      });
    });
    return { lock: 400, iframes: 450 };
  },
  shadow_ult: (c) => {
    const { v } = viewCenter(c);
    dim(c, 0x000000, 0.8, 250, 1800);
    const moon = c.bs.add.container(v.centerX, v.y + 70).setDepth(41).setScrollFactor(1);
    const mg = c.bs.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(0xff2040).setScale(3).setAlpha(0);
    const md = c.bs.add.image(0, 0, 'disc').setTint(0xff3a50).setScale(0.8).setAlpha(0);
    const mc = c.bs.add.image(14, -8, 'disc').setTint(0x000000).setScale(0.72).setAlpha(0);
    moon.add([mg, md, mc]);
    c.bs.tweens.add({ targets: [mg, md, mc], alpha: 1, duration: 400 });
    c.bs.tweens.add({ targets: mc, x: 40, duration: 1800 });
    sfx(c.bs, 'swingHeavy', { rate: 0.6 });
    const ts = onScreen(c).slice(0, 8);
    const targets = ts.length ? ts : [];
    targets.forEach((e, ti) => {
      for (let k = 0; k < 4; k++) {
        later(c, 350 + ti * 60 + k * 230, () => {
          if (!e.alive) return;
          const from = Math.random() < 0.5 ? -1 : 1;
          const clone = c.bs.add.image(e.x + from * 90, e.y + 8, 'hero_shadow', 0).setTintFill(0x1a0a2a).setDepth(59).setFlipX(from > 0).setAlpha(0.9);
          c.bs.tweens.add({ targets: clone, x: e.x - from * 90, duration: 140, ease: 'Cubic.easeIn', onComplete: () => c.bs.tweens.add({ targets: clone, alpha: 0, duration: 150, onComplete: () => clone.destroy() }) });
          later(c, 70, () => {
            const ln = c.bs.add.image(e.x, e.y, 'line').setBlendMode(ADD).setTint(k % 2 ? c.c2 : 0xff2040).setDepth(60).setScale(3.5, 2).setRotation((Math.random() - 0.5) * 0.8);
            c.bs.tweens.add({ targets: ln, scaleY: 0, alpha: 0, duration: 260, onComplete: () => ln.destroy() });
            sfx(c.bs, 'swing', { rate: 1.3, vol: 0.6 });
            hit(c, 1.5, { x: e.x, y: e.y, w: 30, h: 30, kbx: 20, stun: 600, skill: true, forceCrit: true, pierce: true, life: 40, hitstop: k === 3 ? 80 : 0 });
          });
        });
      }
    });
    later(c, 1650, () => {
      c.bs.tweens.add({ targets: moon, alpha: 0, duration: 300, onComplete: () => moon.destroy() });
      c.fx.flash(0xff2040, 0.5, 300); c.fx.shake(0.015, 250);
      sfx(c.bs, 'bigBoom', { rate: 0.8 });
    });
    return { lock: 1900 };
  },

  // ------------------------------------------------------------ STARFALL
  star_meteor: (c) => {
    for (let i = 0; i < 8; i++) {
      later(c, i * 95, () => {
        const tx = c.p.x + c.dir * (50 + Math.random() * 230);
        const o = c.bs.add.container(tx - c.dir * 150, GROUND_Y - 300).setDepth(56);
        const g = c.bs.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(c.c2).setScale(0.7);
        const s = c.bs.add.image(0, 0, 'star4').setBlendMode(ADD).setTint(c.c1).setScale(1.5);
        o.add([g, s]);
        c.bs.addProj({
          team: 'p', obj: o, vx: c.dir * 300, vy: 600, life: 1200, w: 18, h: 18, dmg: c.atk * 0.4, hitGround: true, spin: 0, skill: true, color: c.c1, kbx: 30,
          trail: c.fx.trail(o, { tex: 'p2', color: [c.c1, c.c2, 0xffffff], freq: 8, life: [200, 400], speed: [10, 40], spread: 3 }),
          onEnd: (x, y) => {
            c.fx.glow(x, y, c.c2, 1.2, 300); c.fx.ring(x, y, c.c1, 6, 60, 300);
            c.fx.burst(x, y, { tex: 'star4', n: 8, color: [c.c1, c.c2], speed: [60, 180], scale: [0.7, 0], angle: [200, 340], gravity: 300 });
            c.fx.shake(0.004, 70);
            sfx(c.bs, 'boom', { rate: 1.5 + Math.random() * 0.3, vol: 0.5 });
            hit(c, 0.9, { x, y: y - 16, w: 60, h: 46, kbx: 80, kby: -100, stun: 400, skill: true, critChance: 0.12, hitstop: 20 });
          },
        });
      });
    }
    return { lock: 400 };
  },
  star_const: (c) => {
    let ts = c.bs.enemies.filter((e) => e.alive && Math.abs(e.x - c.p.x) < 300).slice(0, 7);
    const pts = ts.length ? ts.map((e) => ({ x: e.x, y: e.y })) : [0, 1, 2, 3].map((i) => ({ x: c.p.x + c.dir * (60 + i * 40), y: c.p.y - 20 - (i % 2) * 30 }));
    const g = c.bs.add.graphics().setDepth(57).setBlendMode(ADD);
    const marks = pts.map((p) => { const m = img(c, 'star4', p.x, p.y, c.c1).setScale(0); c.bs.tweens.add({ targets: m, scale: 1.5, angle: 180, duration: 250, ease: 'Back.easeOut' }); return m; });
    sfx(c.bs, 'reveal', { rate: 1.3 });
    let drawn = 0;
    const ev = c.bs.time.addEvent({
      delay: 70, repeat: pts.length - 1, callback: () => {
        drawn++;
        g.clear();
        g.lineStyle(3, c.c2, 0.4); g.beginPath();
        for (let i = 0; i < drawn && i < pts.length; i++) (i ? g.lineTo(pts[i].x, pts[i].y) : g.moveTo(pts[i].x, pts[i].y));
        g.strokePath();
        g.lineStyle(1, 0xffffff, 1); g.beginPath();
        for (let i = 0; i < drawn && i < pts.length; i++) (i ? g.lineTo(pts[i].x, pts[i].y) : g.moveTo(pts[i].x, pts[i].y));
        g.strokePath();
        sfx(c.bs, 'flip', { rate: 1.4 + drawn * 0.1, vol: 0.4 });
      },
    });
    later(c, 70 * pts.length + 350, () => {
      ev.remove();
      c.bs.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
      c.fx.flash(c.c1, 0.25, 150);
      c.fx.shake(0.01, 200);
      sfx(c.bs, 'boom', { rate: 1.2 });
      pts.forEach((p, i) => {
        marks[i].destroy();
        c.fx.glow(p.x, p.y, c.c2, 1.6, 400);
        c.fx.ring(p.x, p.y, c.c1, 6, 70, 350);
        c.fx.burst(p.x, p.y, { tex: 'star4', n: 12, color: [c.c1, c.c2, 0xffffff], speed: [60, 220], scale: [0.8, 0] });
        hit(c, 1, { x: p.x, y: p.y, w: 56, h: 56, kbx: 100, kby: -160, stun: 600, heavy: true, skill: true, critChance: 0.15, life: 60, hitstop: 60 });
      });
    });
    return { lock: 340 };
  },
  star_ult: (c) => {
    const x = c.p.x + c.dir * 60, y = c.p.y - 80;
    dim(c, 0x0a0020, 0.75, 300, 1500);
    const core = c.bs.add.image(x, y, 'glow').setBlendMode(ADD).setTint(0xffffff).setScale(3).setDepth(58);
    const ring = c.bs.add.image(x, y, 'ring').setBlendMode(ADD).setTint(c.c2).setScale(2).setDepth(58);
    c.bs.tweens.add({ targets: core, scale: 0.4, duration: 800, ease: 'Cubic.easeIn' });
    c.bs.tweens.add({ targets: ring, scale: 0.2, angle: 360, duration: 800, ease: 'Cubic.easeIn' });
    const suck = c.bs.add.particles(x, y, 'p2', {
      emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 170) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      moveToX: x, moveToY: y, lifespan: 500, tint: [c.c1, c.c2, 0xffffff], frequency: 8, quantity: 3, blendMode: 'ADD',
    }).setDepth(58);
    sfx(c.bs, 'reveal', { rate: 0.6 });
    for (const e of onScreen(c)) hit(c, 2.5, { x: e.x, y: e.y, w: 30, h: 30, kbx: 0, stun: 1200, skill: true, life: 40, critChance: 0.1 });
    later(c, 850, () => {
      suck.stop(); later(c, 600, () => suck.destroy());
      core.destroy(); ring.destroy();
      c.fx.flash(0xffffff, 1, 400);
      c.fx.shake(0.035, 700);
      sfx(c.bs, 'bigBoom'); later(c, 120, () => sfx(c.bs, 'bigBoom', { rate: 0.7 }));
      const colors = [0xffffff, c.c1, c.c2, 0x8ad8ff, 0xffe9a8];
      colors.forEach((col, i) => later(c, i * 70, () => c.fx.ring(x, y, col, 10, 500 + i * 60, 800)));
      c.fx.glow(x, y, c.c1, 10, 1000);
      c.fx.burst(x, y, { tex: 'star4', n: 60, color: colors, speed: [200, 600], life: [500, 1100], scale: [1.4, 0] });
      c.fx.burst(x, y, { tex: 'streak', n: 40, color: colors, speed: [300, 700], life: [300, 700] });
      for (const e of onScreen(c)) hit(c, 8.5, { x: e.x, y: e.y, w: 30, h: 30, kbx: 320, kby: -300, heavy: true, stun: 1000, skill: true, pierce: true, critChance: 0.25, life: 40, hitstop: 140 });
    });
    return { lock: 1600 };
  },

  // ------------------------------------------------------------ VOID
  void_hole: (c) => {
    const x = c.p.x + c.dir * 130, y = c.p.y - 30;
    const hole = c.bs.add.container(x, y).setDepth(57);
    const halo = c.bs.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(c.c1).setScale(0);
    const rim = c.bs.add.image(0, 0, 'ring').setBlendMode(ADD).setTint(c.c2).setScale(0);
    const disk = c.bs.add.image(0, 0, 'disc').setTint(0x000000).setScale(0);
    const rim2 = c.bs.add.image(0, 0, 'ringThin').setBlendMode(ADD).setTint(0xffffff).setScale(0);
    hole.add([halo, rim, disk, rim2]);
    c.bs.tweens.add({ targets: halo, scale: 2.2, duration: 300, ease: 'Back.easeOut' });
    c.bs.tweens.add({ targets: [disk], scale: 0.55, duration: 300, ease: 'Back.easeOut' });
    c.bs.tweens.add({ targets: rim, scale: 0.75, duration: 300, ease: 'Back.easeOut' });
    c.bs.tweens.add({ targets: rim2, scale: 0.72, duration: 300 });
    c.bs.tweens.add({ targets: [rim, rim2], angle: 360, duration: 600, repeat: -1 });
    c.bs.tweens.add({ targets: rim, scaleY: 0.6, duration: 200, yoyo: true, repeat: -1 });
    const suck = c.bs.add.particles(x, y, 'p2', {
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 110), quantity: 36 } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      moveToX: x, moveToY: y, lifespan: 450, tint: [c.c1, c.c2, 0xffffff], frequency: 10, quantity: 2, blendMode: 'ADD',
    }).setDepth(56);
    sfx(c.bs, 'skid', { rate: 0.3 });
    for (let k = 0; k < 16; k++) later(c, 150 + k * 120, () => {
      for (const e of c.bs.enemies) {
        if (!e.alive) continue;
        const d = Phaser.Math.Distance.Between(e.x, e.y, x, y);
        if (d < 190 && !e.isBoss) e.pullTo?.(x, y, 300);
        if (d < 70) hit(c, 1, { x: e.x, y: e.y, w: 30, h: 30, kbx: 0, stun: 300, pierce: true, skill: true, life: 40, noSpark: k % 2 === 1, critChance: 0.1 });
      }
    });
    later(c, 2150, () => {
      suck.stop(); later(c, 500, () => suck.destroy());
      c.bs.tweens.add({ targets: hole, scale: 0, duration: 120, ease: 'Back.easeIn', onComplete: () => {
        hole.destroy();
        c.fx.flash(c.c1, 0.5, 200);
        c.fx.ring(x, y, c.c1, 4, 160, 400); c.fx.ring(x, y, c.c2, 4, 120, 450, true);
        c.fx.burst(x, y, { tex: 'p3', n: 40, color: [c.c1, c.c2, 0xffffff], speed: [120, 380], life: [300, 700] });
        c.fx.shake(0.014, 250);
        sfx(c.bs, 'bigBoom', { rate: 1.1 });
        hit(c, 5.5, { x, y, w: 150, h: 130, kbx: 260, kby: -260, heavy: true, stun: 800, pierce: true, skill: true, critChance: 0.15, hitstop: 100 });
      } });
    });
    return { lock: 320 };
  },
  void_cut: (c) => {
    const y = c.p.y - 2;
    const { v } = viewCenter(c);
    const g = c.bs.add.graphics().setDepth(57);
    const pts: [number, number][] = [];
    for (let x = v.x - 20; x <= v.right + 20; x += 16) pts.push([x, y + (Math.random() - 0.5) * 6]);
    let shown = 0;
    sfx(c.bs, 'swing', { rate: 0.5 });
    const ev = c.bs.time.addEvent({ delay: 16, repeat: 24, callback: () => {
      shown = Math.min(pts.length, shown + 3);
      g.clear();
      g.lineStyle(1, 0xffffff, 1); g.beginPath();
      for (let i = 0; i < shown; i++) (i ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]));
      g.strokePath();
    } });
    later(c, 560, () => {
      ev.remove(); g.destroy();
      c.fx.flash(0xffffff, 0.5, 160);
      c.fx.shake(0.018, 300);
      sfx(c.bs, 'swingHeavy', { rate: 0.6 }); sfx(c.bs, 'bigBoom', { rate: 1.4, vol: 0.7 });
      const ln = (tint: number, dy: number, sc: number) => {
        const l = c.bs.add.image(v.centerX, y + dy, 'line').setBlendMode(ADD).setTint(tint).setDepth(58).setScale(W / 64 + 1, sc);
        c.bs.tweens.add({ targets: l, scaleY: 0, duration: 420, ease: 'Cubic.easeIn', onComplete: () => l.destroy() });
      };
      ln(c.c1, -3, 8); ln(c.c2, 3, 8); ln(0xffffff, 0, 5);
      const dark = c.bs.add.rectangle(v.centerX, y, W + 40, 18, 0x000000, 1).setDepth(57);
      c.bs.tweens.add({ targets: dark, scaleY: 0, duration: 380, ease: 'Cubic.easeIn', onComplete: () => dark.destroy() });
      c.fx.burst(v.centerX, y, { tex: 'p2', n: 50, color: [c.c1, c.c2, 0xffffff], speed: [50, 200], spread: 0, angle: [0, 360], life: [300, 700] });
      hit(c, 1, { x: v.centerX, y, w: W + 40, h: 40, kbx: 0, kby: -80, heavy: true, stun: 700, pierce: true, skill: true, critChance: 0.2, life: 60, hitstop: 110 });
    });
    return { lock: 360 };
  },
  void_ult: (c) => {
    const { v } = viewCenter(c);
    const cam = c.bs.cameras.main;
    let cm: Phaser.FX.ColorMatrix | null = null;
    try { cm = cam.postFX.addColorMatrix(); cm.negative(); } catch { cm = null; }
    dim(c, 0x000000, 0.3, 100, 2200);
    sfx(c.bs, 'reveal', { rate: 0.4 });
    const cx = v.centerX, cy = v.centerY + 10;
    const g = c.bs.add.graphics().setDepth(60);
    const cracks: { a: number; pts: [number, number][] }[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const pts: [number, number][] = [[cx, cy]];
      let px = cx, py = cy, ang = a;
      for (let k = 0; k < 12; k++) { ang += (Math.random() - 0.5) * 0.6; px += Math.cos(ang) * 30; py += Math.sin(ang) * 30; pts.push([px, py]); }
      cracks.push({ a, pts });
    }
    let n = 0;
    const ev = c.bs.time.addEvent({ delay: 40, repeat: 12, callback: () => {
      n++;
      g.clear();
      for (const cr of cracks) {
        g.lineStyle(3, c.c1, 0.6); g.beginPath();
        cr.pts.slice(0, n).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokePath();
        g.lineStyle(1, 0xffffff, 1); g.beginPath();
        cr.pts.slice(0, n).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokePath();
      }
      c.fx.shake(0.004, 40);
    } });
    for (let k = 0; k < 6; k++) later(c, 600 + k * 180, () => {
      c.fx.flash(k % 2 ? c.c1 : c.c2, 0.2, 120);
      sfx(c.bs, 'zap', { rate: 0.5 + k * 0.1, vol: 0.6 });
      for (const e of onScreen(c)) {
        c.fx.slash(e.x, e.y, Math.random() < 0.5 ? 1 : -1, k % 2 ? c.c1 : c.c2, { scale: 1, angle: Math.random() * 3, thin: 0.3 });
        hit(c, 0.9, { x: e.x, y: e.y, w: 30, h: 30, kbx: 0, stun: 500, pierce: true, skill: true, critChance: 0.15, life: 40 });
      }
    });
    later(c, 1750, () => {
      ev.remove();
      if (cm) { try { cam.postFX.remove(cm as unknown as Phaser.FX.Controller); } catch { /* ignore */ } }
      g.destroy();
      c.fx.flash(0xffffff, 1, 600);
      c.fx.shake(0.04, 700);
      sfx(c.bs, 'bigBoom', { rate: 0.5 }); later(c, 150, () => sfx(c.bs, 'shatter', { rate: 0.6 }));
      for (let i = 0; i < 5; i++) later(c, i * 60, () => c.fx.ring(cx, cy, [0xffffff, c.c1, c.c2][i % 3], 10, 600, 700));
      c.fx.burst(cx, cy, { tex: 'p3', n: 80, color: [c.c1, c.c2, 0xffffff, 0x000000], speed: [200, 700], life: [500, 1100] });
      for (const e of onScreen(c)) hit(c, 7.6, { x: e.x, y: e.y, w: 30, h: 30, kbx: 360, kby: -320, heavy: true, stun: 1200, pierce: true, skill: true, critChance: 0.3, life: 40, hitstop: 150 });
    });
    return { lock: 2200 };
  },
};

