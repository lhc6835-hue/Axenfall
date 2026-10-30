// Abilities 9-20: basic combos, skills and ultimates. Registers into BASICS / SKILL_FX.
import { GROUND_Y, W } from '../core/const';
import { sfx } from '../core/audio';
import { addTex, makeCanvas, mix, paintShapes } from '../art/pixel';
import { drawFace } from '../art/hero';
import { Hitbox, type Fighter, type HitboxOpts } from './combat';
import { BASICS, SKILL_FX, later, hit, img, nearest, onScreen, dim, viewCenter, burstMove, swing, type SkillCtx, type BasicDef } from './skills';

const ADD = Phaser.BlendModes.ADD;
type SkillFn = (c: SkillCtx) => { lock: number; iframes?: number };

/** Damages exactly one target, bypassing area overlap (used for poison ticks, marks…). */
function strike(c: SkillCtx, e: Fighter, mult: number, o: Partial<HitboxOpts> = {}) {
  if (!e.alive) return;
  const hb = new Hitbox({ team: 'p', x: e.x, y: e.y, w: 1, h: 1, dmg: c.atk * mult, life: 1, dir: Math.sign(e.x - c.p.x) || c.dir, kbx: 0, stun: 150, color: c.c1, ...o }, 0);
  c.bs.combat.apply(hb, e, e.rect());
}

/** Damage over time, shown as small coloured bubbles rising from the target. */
function dot(c: SkillCtx, e: Fighter, mult: number, ticks: number, every: number, color: number) {
  for (let i = 1; i <= ticks; i++) later(c, i * every, () => {
    if (!e.alive) return;
    c.fx.burst(e.x, e.y - 6, { tex: 'p2', n: 3, color: [color, 0xffffff], speed: [10, 40], angle: [250, 290], life: [300, 500] });
    strike(c, e, mult, { noSpark: true, stun: 60, color });
  });
}

function proj(c: SkillCtx, o: Omit<import('./proj').ProjOpts, 'team' | 'dmg'> & { mult: number }) {
  const { mult, ...rest } = o;
  return c.bs.addProj({ team: 'p', dmg: c.atk * mult, color: c.c1, kbx: 60, stun: 250, critChance: 0.1, ...rest });
}

const ELEMENTS = [
  { c: 0xff7a2a, c2: 0xffd04a, tex: 'flame', slow: 0, freeze: 0, stun: 260 },
  { c: 0x9fe8ff, c2: 0xffffff, tex: 'snow', slow: 1500, freeze: 0, stun: 260 },
  { c: 0xfff27a, c2: 0x6ae8ff, tex: 'spark', slow: 0, freeze: 0, stun: 700 },
];
const randEl = () => ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];

function elementBurst(c: SkillCtx, x: number, y: number, mult: number, size = 60) {
  const el = randEl();
  c.fx.glow(x, y, el.c, size / 40, 300);
  c.fx.ring(x, y, el.c, 4, size, 300);
  c.fx.burst(x, y, { tex: el.tex, n: 14, color: [el.c, el.c2], speed: [60, 200], life: [250, 500] });
  if (el.tex === 'spark') c.fx.lightning(x, y - 60, x, y, el.c, 2, 200);
  hit(c, mult, { x, y, w: size, h: size * 0.8, slow: el.slow, stun: el.stun, kbx: 80, skill: true, color: el.c, critChance: 0.12 });
}

function ensureUltArt(s: Phaser.Scene) {
  if (s.textures.exists('ultTree')) return;
  {
    const [cv, ctx] = makeCanvas(72, 140);
    paintShapes(ctx, 0, 0, 72, 140, [
      { k: 'cap', x1: 22, y1: 138, x2: 10, y2: 132, r: 5, r2: 2, c: 0x7a5236 },
      { k: 'cap', x1: 50, y1: 138, x2: 62, y2: 132, r: 5, r2: 2, c: 0x7a5236 },
      { k: 'rect', x: 24, y: 40, w: 24, h: 100, c: 0x7a5236, r: 5, z: 1 },
      { k: 'ell', x: 36, y: 34, rx: 34, ry: 28, c: 0x2f7a3a, z: 2 },
      { k: 'ell', x: 20, y: 38, rx: 16, ry: 12, c: 0x4fa040, z: 3 },
      { k: 'ell', x: 52, y: 38, rx: 16, ry: 12, c: 0x4fa040, z: 3 },
      { k: 'ell', x: 36, y: 22, rx: 20, ry: 14, c: 0x6cc24a, z: 4 },
      { k: 'ell', x: 30, y: 14, rx: 10, ry: 6, c: 0x9ad86a, z: 5 },
    ]);
    addTex(s, 'ultTree', cv);
  }
  {
    const [cv, ctx] = makeCanvas(60, 80);
    paintShapes(ctx, 0, 0, 60, 80, [
      { k: 'rect', x: 4, y: 2, w: 52, h: 56, c: 0x6a7a90, r: 6 },
      { k: 'tri', pts: [4, 50, 30, 78, 56, 50], c: 0x6a7a90 },
      { k: 'rect', x: 10, y: 8, w: 40, h: 44, c: 0xb8c8dc, r: 4, z: 1 },
      { k: 'tri', pts: [10, 46, 30, 70, 50, 46], c: 0xb8c8dc, z: 1 },
      { k: 'rect', x: 27, y: 10, w: 6, h: 56, c: 0xffd166, z: 2 },
      { k: 'rect', x: 12, y: 28, w: 36, h: 6, c: 0xffd166, z: 2 },
    ]);
    addTex(s, 'ultShield', cv);
  }
}

function ensureDragonHead(s: Phaser.Scene) {
  if (s.textures.exists('dragonHead')) return;
  const [cv, ctx] = makeCanvas(104, 72);
  paintShapes(ctx, 0, 0, 104, 72, [
    { k: 'tri', pts: [14, 6, 26, 26, 36, 18], c: 0xe8d8a0 },
    { k: 'tri', pts: [30, 2, 40, 24, 50, 16], c: 0xe8d8a0 },
    { k: 'ell', x: 44, y: 38, rx: 34, ry: 26, c: 0x3ab87a, z: 1 },
    { k: 'rect', x: 56, y: 34, w: 46, h: 26, c: 0x3ab87a, r: 10, z: 2 },
    { k: 'rect', x: 58, y: 52, w: 42, h: 10, c: 0xf0d080, r: 4, z: 3 },
    { k: 'ell', x: 30, y: 24, rx: 10, ry: 6, c: 0x5ad89a, z: 3 },
  ]);
  drawFace(ctx, 66, 36, 26, 2, 'open', 0x161216);
  addTex(s, 'dragonHead', cv);
}

// ======================================================================= BASICS

const shardShot = (c: SkillCtx, mult: number, ang: number, key: string, tint: number, speed: number, extra: Partial<import('./proj').ProjOpts> = {}) => {
  const o = img(c, key, c.p.x + c.dir * 12, c.p.y - 2, tint);
  return proj(c, { obj: o, vx: Math.cos(ang) * speed * c.dir, vy: Math.sin(ang) * speed, life: 520, faceVel: true, w: 14, h: 10, mult, ...extra });
};

const NEW_BASICS: Record<string, BasicDef> = {
  stone: {
    mult: 1.15, steps: [
      { dur: 320, at: 100, lunge: 60, fn: (c) => {
        const x = c.p.x + c.dir * 22;
        c.fx.burst(x, c.p.y, { tex: 'p3', n: 10, color: [c.c1, c.c2], speed: [60, 180], gravity: 500, add: false, life: [300, 500] });
        c.fx.glow(x, c.p.y, c.c1, 0.5, 150);
        sfx(c.bs, 'hitHeavy', { rate: 1.3, vol: 0.5 });
        hit(c, 1.25, { x, y: c.p.y, w: 42, h: 32, kbx: 120, critChance: 0.08, hitstop: 50 });
      } },
      { dur: 440, at: 150, lunge: 40, fn: (c) => {
        const x = c.p.x + c.dir * 30;
        c.fx.groundSlam(x, GROUND_Y - 1, c.c1, 1.3);
        c.fx.shake(0.008, 140);
        sfx(c.bs, 'boom', { rate: 1.1 });
        hit(c, 1.9, { x, y: GROUND_Y - 20, w: 80, h: 44, kbx: 200, kby: -180, heavy: true, critChance: 0.08, hitstop: 80 });
      } },
    ],
  },
  bubble: {
    mult: 0.9, steps: [
      { dur: 240, at: 40, fn: (c) => bubbleShot(c, 0.95, 0) },
      { dur: 240, at: 40, fn: (c) => bubbleShot(c, 0.95, -0.15) },
      { dur: 360, at: 60, fn: (c) => { bubbleShot(c, 0.7, -0.3); bubbleShot(c, 0.7, 0); bubbleShot(c, 0.7, 0.25); } },
    ],
  },
  vine: {
    mult: 1, steps: [
      { dur: 260, at: 50, fn: (c) => whip(c, 1, -10) },
      { dur: 260, at: 50, fn: (c) => whip(c, 1, 8) },
      { dur: 380, at: 80, fn: (c) => whip(c, 1.6, 0, true) },
    ],
  },
  iron: {
    mult: 1.05, steps: [
      { dur: 260, at: 50, lunge: 110, fn: (c) => bash(c, 1, false) },
      { dur: 260, at: 50, lunge: 110, fn: (c) => bash(c, 1, false) },
      { dur: 400, at: 90, lunge: 200, fn: (c) => bash(c, 1.7, true) },
    ],
  },
  poison: {
    mult: 0.85, steps: [
      { dur: 220, at: 40, fn: (c) => dart(c, 0.8, 0) },
      { dur: 220, at: 40, fn: (c) => dart(c, 0.8, 0) },
      { dur: 320, at: 60, fn: (c) => { dart(c, 0.7, -0.12); dart(c, 0.7, 0.12); } },
    ],
  },
  sonic: {
    mult: 0.95, steps: [
      { dur: 260, at: 40, fn: (c) => soundRing(c, 0.95, 1) },
      { dur: 260, at: 40, fn: (c) => soundRing(c, 0.95, 1) },
      { dur: 380, at: 60, fn: (c) => soundRing(c, 1.6, 1.6) },
    ],
  },
  crystal: {
    mult: 1, steps: [
      { dur: 220, at: 40, lunge: 90, fn: (c) => swing(c, 1, { angle: -0.4, thin: 0.45, c: c.c1 }) },
      { dur: 220, at: 40, lunge: 90, fn: (c) => swing(c, 1, { angle: 0.4, thin: 0.45, c: c.c2 }) },
      { dur: 360, at: 70, lunge: 140, fn: (c) => {
        swing(c, 1.3, { big: true, scale: 0.7, thin: 0.5, kb: 200, heavy: true, c: mix(c.c1, c.c2, 0.5) });
        for (const a of [-0.35, 0, 0.35]) shardShot(c, 0.45, a, 'diamond', [c.c1, c.c2, 0xffffff][Math.floor(Math.random() * 3)], 380, { life: 320, w: 10, h: 10 });
      } },
    ],
  },
  magma: {
    mult: 1, steps: [
      { dur: 230, at: 50, lunge: 70, fn: (c) => lavaPunch(c, 0.95, false) },
      { dur: 230, at: 50, lunge: 70, fn: (c) => lavaPunch(c, 0.95, false) },
      { dur: 380, at: 80, lunge: 110, fn: (c) => lavaPunch(c, 1.6, true) },
    ],
  },
  chrono: {
    mult: 0.95, steps: [
      { dur: 150, at: 25, lunge: 80, fn: (c) => swing(c, 0.66, { angle: -0.5, scale: 0.7, thin: 0.35, c: c.c1, w: 44 }) },
      { dur: 150, at: 25, lunge: 80, fn: (c) => swing(c, 0.66, { angle: 0.5, scale: 0.7, thin: 0.35, c: c.c2, w: 44 }) },
      { dur: 150, at: 25, lunge: 80, fn: (c) => swing(c, 0.66, { angle: 0, scale: 0.75, thin: 0.35, c: c.c1, w: 44 }) },
      { dur: 300, at: 50, lunge: 140, fn: (c) => {
        const x = c.p.x + c.dir * 26;
        swing(c, 1.2, { big: true, scale: 0.7, thin: 0.4, kb: 200, heavy: true, c: c.c1 });
        c.fx.ring(x, c.p.y, c.c1, 6, 50, 300, true);
        c.fx.ring(x, c.p.y, c.c2, 6, 40, 360, true);
      } },
    ],
  },
  dragon: {
    mult: 1.05, steps: [
      { dur: 230, at: 45, lunge: 90, fn: (c) => claw(c, 1, -0.3) },
      { dur: 230, at: 45, lunge: 90, fn: (c) => claw(c, 1, 0.35) },
      { dur: 380, at: 80, lunge: 150, fn: (c) => {
        claw(c, 1.4, 0);
        const x = c.p.x + c.dir * 34;
        c.fx.burst(x, c.p.y, { tex: 'flame', n: 18, color: [c.c1, c.c2, 0xff3010], speed: [60, 200], life: [250, 500], gravity: -200 });
        hit(c, 0.6, { x, y: c.p.y, w: 60, h: 50, kbx: 200, kby: -140, heavy: true, hitstop: 50 });
      } },
    ],
  },
  light: {
    mult: 1, steps: [
      { dur: 240, at: 40, fn: (c) => lance(c, 1, 0) },
      { dur: 240, at: 40, fn: (c) => lance(c, 1, 0) },
      { dur: 360, at: 60, fn: (c) => { lance(c, 0.75, -0.12); lance(c, 0.75, 0); lance(c, 0.75, 0.12); } },
    ],
  },
  chaos: {
    mult: 1.05, steps: [
      { dur: 240, at: 50, lunge: 80, fn: (c) => chaosHit(c, 1.05, -0.3) },
      { dur: 240, at: 50, lunge: 80, fn: (c) => chaosHit(c, 1.05, 0.3) },
      { dur: 380, at: 80, lunge: 130, fn: (c) => { chaosHit(c, 1.2, 0); later(c, 90, () => elementBurst(c, c.p.x + c.dir * 40, c.p.y, 0.8, 70)); } },
    ],
  },
};

function bubbleShot(c: SkillCtx, mult: number, ang: number) {
  const o = c.bs.add.container(c.p.x + c.dir * 14, c.p.y - 4).setDepth(55);
  o.add([c.bs.add.image(0, 0, 'glowS').setBlendMode(ADD).setTint(c.c2).setScale(1.2), c.bs.add.image(0, 0, 'ringThin').setTint(c.c1).setScale(0.16)]);
  sfx(c.bs, 'shoot', { rate: 1.8, vol: 0.4 });
  let t0 = Math.random() * 6;
  proj(c, { obj: o, vx: Math.cos(ang) * 250 * c.dir, vy: Math.sin(ang) * 250, life: 650, w: 16, h: 16, mult,
    onTick: (p, dt) => { t0 += dt / 120; p.o.vy += Math.sin(t0) * 8; },
    onEnd: (x, y) => { c.fx.ring(x, y, c.c1, 4, 20, 180, true); c.fx.burst(x, y, { tex: 'p2', n: 8, color: [c.c1, 0xffffff], speed: [40, 100], life: [150, 300] }); } });
}

function whip(c: SkillCtx, mult: number, dy: number, heavy = false) {
  const g = c.bs.add.graphics().setDepth(55);
  const x0 = c.p.x + c.dir * 8, y0 = c.p.y, reach = heavy ? 96 : 84;
  const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x0, y0), new Phaser.Math.Vector2(x0 + c.dir * reach * 0.5, y0 - 26 + dy), new Phaser.Math.Vector2(x0 + c.dir * reach, y0 + dy));
  const pts = curve.getPoints(16);
  g.lineStyle(heavy ? 4 : 3, 0x3a8a3a, 1).strokePoints(pts);
  g.lineStyle(1, c.c1, 1).strokePoints(pts);
  pts.forEach((p, i) => { if (i % 4 === 2) g.fillStyle(c.c1).fillEllipse(p.x, p.y - 2, 5, 3); });
  c.bs.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  const end = pts[pts.length - 1];
  c.fx.burst(end.x, end.y, { tex: 'leaf', n: heavy ? 10 : 5, color: [c.c1, c.c2], speed: [40, 120], add: false });
  sfx(c.bs, heavy ? 'swingHeavy' : 'swing', { rate: 0.9 });
  hit(c, mult, { x: c.p.x + c.dir * (reach * 0.6 + 8), y: c.p.y + dy / 2, w: reach * 0.8, h: 30, kbx: heavy ? 180 : 70, heavy, critChance: 0.1, hitstop: heavy ? 60 : 25 });
}

function bash(c: SkillCtx, mult: number, heavy: boolean) {
  const x = c.p.x + c.dir * 18;
  const sh = c.bs.add.rectangle(x, c.p.y - 2, 8, 22, c.c1).setStrokeStyle(2, c.c2).setDepth(56);
  c.bs.tweens.add({ targets: sh, x: x + c.dir * 10, scaleY: heavy ? 1.5 : 1.15, alpha: 0, duration: 220, onComplete: () => sh.destroy() });
  c.fx.burst(x + c.dir * 8, c.p.y, { tex: 'spark', n: heavy ? 12 : 6, color: [0xffffff, c.c1], speed: [60, 180] });
  if (heavy) { c.fx.ring(x + c.dir * 8, c.p.y, c.c1, 6, 50, 250); c.fx.shake(0.006, 100); }
  sfx(c.bs, heavy ? 'hitHeavy' : 'land', { rate: heavy ? 1 : 1.6 });
  hit(c, mult, { x: x + c.dir * 8, y: c.p.y, w: 40, h: 34, kbx: heavy ? 300 : 150, kby: heavy ? -120 : 0, stun: heavy ? 600 : 300, heavy, critChance: 0.08, hitstop: heavy ? 70 : 30 });
}

function dart(c: SkillCtx, mult: number, ang: number) {
  sfx(c.bs, 'shoot', { rate: 2, vol: 0.4 });
  shardShot(c, mult, ang, 'shard', c.c1, 470, {
    life: 450,
    trail: undefined,
    onHit: (t) => dot(c, t, 0.22, 4, 400, c.c1),
    onEnd: (x, y) => c.fx.burst(x, y, { tex: 'p2', n: 5, color: [c.c1, c.c2], speed: [30, 80] }),
  });
}

function soundRing(c: SkillCtx, mult: number, size: number) {
  const o = img(c, 'ringThin', c.p.x + c.dir * 14, c.p.y - 2, c.c1).setScale(0.12 * size, 0.3 * size);
  sfx(c.bs, 'zap', { rate: 2, vol: 0.35 });
  proj(c, { obj: o, vx: 330 * c.dir, vy: 0, life: 420, w: 18 * size, h: 30 * size, mult, pierceAll: true, interval: 9999, kbx: 110 * size,
    onTick: (p) => { const k = 1 + p.t / 300; o.setScale(0.12 * size * k, 0.3 * size * k); o.setAlpha(1 - p.t / 420); p.hb.o.h = 30 * size * k; } });
}

function lavaPool(c: SkillCtx, x: number, ms: number, mult: number) {
  const pool = c.bs.add.image(x, GROUND_Y - 1, 'glow').setBlendMode(ADD).setTint(c.c1).setScale(1.1, 0.25).setDepth(22);
  c.bs.tweens.add({ targets: pool, scaleX: 1.3, duration: 200, yoyo: true, repeat: -1 });
  const tr = c.fx.trail({ x, y: GROUND_Y - 2 }, { tex: 'p2', color: [c.c1, c.c2], freq: 60, speed: [20, 60], angle: [250, 290], gravity: 200, spread: 14, life: [200, 400] });
  hit(c, mult, { x, y: GROUND_Y - 12, w: 50, h: 24, life: ms, interval: 300, kbx: 0, stun: 120, noSpark: true, skill: true });
  later(c, ms, () => { tr.stop(); c.bs.tweens.add({ targets: pool, alpha: 0, duration: 250, onComplete: () => pool.destroy() }); });
}

function lavaPunch(c: SkillCtx, mult: number, big: boolean) {
  const x = c.p.x + c.dir * (big ? 28 : 20), y = c.p.y;
  c.fx.glow(x, y, c.c1, big ? 1 : 0.5, 180);
  c.fx.burst(x, y, { tex: 'flame', n: big ? 16 : 7, color: [c.c1, c.c2, 0xa02010], speed: [40, big ? 200 : 110], angle: c.dir > 0 ? [-50, 50] : [130, 230], gravity: 200, life: [200, 420] });
  sfx(c.bs, big ? 'boom' : 'swing', { vol: big ? 0.6 : 1 });
  hit(c, mult, { x, y, w: big ? 60 : 36, h: big ? 46 : 30, kbx: big ? 200 : 60, kby: big ? -100 : 0, heavy: big, critChance: 0.1, hitstop: big ? 60 : 25 });
  if (big) lavaPool(c, x + c.dir * 10, 1500, 0.25);
}

function claw(c: SkillCtx, mult: number, ang: number) {
  const x = c.p.x + c.dir * 26, y = c.p.y;
  for (let i = -1; i <= 1; i++) later(c, (i + 1) * 20, () => c.fx.slash(x, y + i * 7, c.dir, i ? c.c1 : c.c2, { scale: 0.75, angle: ang + 0.5, thin: 0.3, dur: 220 }));
  sfx(c.bs, 'swing', { rate: 0.8 });
  hit(c, mult, { x, y, w: 50, h: 40, kbx: 90, critChance: 0.15, hitstop: 30 });
}

function lance(c: SkillCtx, mult: number, ang: number) {
  const o = c.bs.add.container(c.p.x + c.dir * 14, c.p.y - 2).setDepth(56).setRotation(c.dir > 0 ? ang : Math.PI - ang);
  o.add([c.bs.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(c.c1).setScale(0.7, 0.25), c.bs.add.image(0, 0, 'line').setBlendMode(ADD).setTint(0xffffff).setScale(0.5, 3)]);
  sfx(c.bs, 'shoot', { rate: 1.5, vol: 0.4 });
  proj(c, { obj: o, vx: Math.cos(ang) * 540 * c.dir, vy: Math.sin(ang) * 540, life: 420, w: 30, h: 12, mult, pierceAll: true, interval: 9999, pierce: true,
    trail: c.fx.trail(o, { tex: 'p1', color: [c.c1, 0xffffff], freq: 15, speed: [0, 15], life: [150, 250] }),
    onHit: (t) => c.fx.burst(t.x, t.y, { tex: 'star4', n: 4, color: [c.c1, 0xffffff], speed: [40, 120], scale: [0.6, 0] }) });
}

function chaosHit(c: SkillCtx, mult: number, ang: number) {
  const el = randEl();
  const x = c.p.x + c.dir * 24, y = c.p.y;
  c.fx.slash(x, y, c.dir, el.c, { scale: 0.85, angle: ang, thin: 0.6 });
  c.fx.burst(x, y, { tex: el.tex, n: 10, color: [el.c, el.c2], speed: [50, 160], life: [200, 400] });
  if (el.tex === 'spark') c.fx.lightning(c.p.x, y, x + c.dir * 20, y + (Math.random() - 0.5) * 12, el.c, 1, 140);
  sfx(c.bs, 'swing', { rate: 1.1 });
  hit(c, mult, { x, y, w: 48, h: 34, kbx: 90, slow: el.slow, stun: el.stun, color: el.c, critChance: 0.12, hitstop: 30 });
}

// ======================================================================= SKILLS & ULTS

const NEW_SKILLS: Record<string, SkillFn> = {
  // ------------------------------------------------------------ STONE
  stone_throw: (c) => {
    const o = img(c, 'pr_rock', c.p.x + c.dir * 10, c.p.y - 14, c.c1, false).setScale(1.6);
    sfx(c.bs, 'swingHeavy', { rate: 0.7 });
    proj(c, { obj: o, vx: c.dir * 280, vy: -330, gravity: 900, life: 2000, w: 24, h: 24, mult: 0.6, spin: 400, hitGround: true, skill: true, kbx: 120,
      onEnd: (x, y) => {
        c.fx.groundSlam(x, GROUND_Y - 1, c.c1, 1.2);
        c.fx.burst(x, y - 6, { tex: 'p3', n: 16, color: [c.c1, c.c2, 0x6a5a40], speed: [80, 240], angle: [200, 340], gravity: 600, add: false, life: [400, 700] });
        c.fx.shake(0.01, 160);
        sfx(c.bs, 'boom');
        hit(c, 1, { x, y: GROUND_Y - 22, w: 90, h: 50, kbx: 200, kby: -200, heavy: true, skill: true, critChance: 0.1, hitstop: 70 });
      } });
    return { lock: 320 };
  },
  stone_quake: (c) => {
    c.fx.groundSlam(c.p.x, GROUND_Y - 1, c.c1, 1.8);
    c.fx.shake(0.014, 300);
    sfx(c.bs, 'bigBoom', { rate: 1.2, vol: 0.7 });
    for (const d of [-1, 1]) {
      for (let i = 1; i <= 5; i++) later(c, i * 70, () => {
        const x = c.p.x + d * i * 36;
        const th = c.bs.add.image(x, GROUND_Y + 20, 'pr_thorn').setOrigin(0.5, 1).setTint(c.c1).setScale(1.6, 1.4 + i * 0.12).setDepth(27);
        c.bs.tweens.add({ targets: th, y: GROUND_Y + 2, duration: 80, ease: 'Back.easeOut', onComplete: () => c.bs.tweens.add({ targets: th, y: GROUND_Y + 50, delay: 250, duration: 200, onComplete: () => th.destroy() }) });
        c.fx.dust(x, GROUND_Y - 1, 3);
        hit(c, 0.5, { x, y: GROUND_Y - 18, w: 36, h: 36, dir: d, kbx: 120, kby: -260, stun: 500, skill: true, critChance: 0.1 });
      });
    }
    return { lock: 460 };
  },
  stone_ult: (c) => {
    const { v } = viewCenter(c);
    dim(c, 0x201408, 0.5, 200, 1700);
    sfx(c.bs, 'fall', { rate: 0.6 });
    for (let i = 0; i < 14; i++) later(c, 150 + i * 100, () => {
      const tx = v.x + 40 + Math.random() * (W - 80);
      const sc = 2.2 + Math.random() * 1.4;
      const o = c.bs.add.image(tx - 60, v.y - 40, 'pr_rock').setTint(mix(c.c1, 0xffffff, Math.random() * 0.2)).setScale(sc).setDepth(56);
      proj(c, { obj: o, vx: 120, vy: 650, life: 2000, w: 20 * sc, h: 20 * sc, mult: 0.3, spin: 300, hitGround: true, skill: true,
        onEnd: (x) => {
          c.fx.groundSlam(x, GROUND_Y - 1, c.c1, sc * 0.6);
          c.fx.burst(x, GROUND_Y - 8, { tex: 'p3', n: 14, color: [c.c1, c.c2], speed: [80, 260], angle: [200, 340], gravity: 700, add: false });
          c.fx.shake(0.012, 120);
          sfx(c.bs, 'boom', { rate: 0.9 + Math.random() * 0.4, vol: 0.6 });
          hit(c, 0.35, { x, y: GROUND_Y - 30, w: 30 * sc, h: 60, kbx: 160, kby: -220, heavy: true, skill: true, critChance: 0.12, hitstop: 40 });
        } });
    });
    return { lock: 1900 };
  },

  // ------------------------------------------------------------ BUBBLE
  bubble_jail: (c) => {
    const o = c.bs.add.container(c.p.x + c.dir * 16, c.p.y - 4).setDepth(56);
    o.add([c.bs.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(c.c2).setScale(0.6), c.bs.add.image(0, 0, 'ringThin').setTint(c.c1).setScale(0.32)]);
    sfx(c.bs, 'shoot', { rate: 0.8 });
    proj(c, { obj: o, vx: c.dir * 300, vy: 0, life: 700, w: 30, h: 30, mult: 0.2, skill: true,
      onHit: (t) => {
        const b = c.bs.add.image(t.x, t.y, 'ringThin').setTint(c.c1).setScale(0.6).setDepth(57);
        const gl = c.bs.add.image(t.x, t.y, 'glow').setBlendMode(ADD).setTint(c.c2).setScale(1.2).setAlpha(0.5).setDepth(57);
        if (!t.isBoss) strike(c, t, 0.01, { freeze: 1800, noSpark: true, stun: 0 });
        const ev = c.bs.time.addEvent({ delay: 16, loop: true, callback: () => { b.setPosition(t.x, t.y + Math.sin(c.bs.time.now / 150) * 2); gl.setPosition(t.x, t.y); } });
        later(c, 1800, () => {
          ev.remove(); b.destroy(); gl.destroy();
          c.fx.ring(t.x, t.y, c.c1, 10, 60, 250, true);
          c.fx.burst(t.x, t.y, { tex: 'p2', n: 16, color: [c.c1, 0xffffff], speed: [60, 160] });
          sfx(c.bs, 'flip', { rate: 1.6 });
          strike(c, t, 1, { kbx: 100, heavy: true, stun: 400, critChance: 0.2 });
        });
      } });
    return { lock: 300 };
  },
  bubble_splash: (c) => {
    const o = c.bs.add.container(c.p.x + c.dir * 20, GROUND_Y - 24).setDepth(56);
    const wave = c.bs.add.image(0, 0, 'beam').setBlendMode(ADD).setTint(c.c2).setDisplaySize(26, 52);
    o.add([c.bs.add.image(0, 6, 'glow').setBlendMode(ADD).setTint(c.c1).setScale(1, 0.8), wave]);
    sfx(c.bs, 'skid', { rate: 0.6 });
    const tr = c.fx.trail(o, { tex: 'p2', color: [c.c1, c.c2, 0xffffff], freq: 12, speed: [40, 120], angle: c.dir > 0 ? [200, 260] : [280, 340], gravity: 400, spread: 12 });
    proj(c, { obj: o, vx: c.dir * 300, vy: 0, life: 650, w: 40, h: 56, mult: 1, pierceAll: true, interval: 9999, kbx: 320, kby: -80, skill: true, trail: tr,
      onTick: (p) => o.setScale(1 + p.t / 600) });
    return { lock: 340 };
  },
  bubble_ult: (c) => {
    const { v } = viewCenter(c);
    dim(c, 0x082040, 0.4, 200, 1600);
    const startX = c.dir > 0 ? v.x - 60 : v.right + 60;
    const wv = c.bs.add.container(startX, GROUND_Y).setDepth(58);
    const body = c.bs.add.rectangle(0, -100, 110, 200, c.c2, 0.75);
    const crest = c.bs.add.rectangle(c.dir * 40, -196, 50, 16, 0xffffff, 0.9);
    const gl = c.bs.add.image(0, -100, 'glow').setBlendMode(ADD).setTint(c.c1).setScale(3, 4).setAlpha(0.7);
    wv.add([gl, body, crest]);
    const tr = c.fx.trail(wv, { tex: 'p3', color: [0xffffff, c.c1], freq: 6, speed: [60, 200], angle: c.dir > 0 ? [200, 250] : [290, 340], gravity: 500, spread: 40, add: false });
    sfx(c.bs, 'skid', { rate: 0.35 });
    c.fx.shake(0.008, 1400);
    hit(c, 0.6, { x: 0, y: 0, follow: wv, offY: -100, w: 120, h: 200, life: 1400, interval: 220, kbx: 220, kby: -120, stun: 500, skill: true, heavy: true, critChance: 0.12 });
    c.bs.tweens.add({ targets: wv, x: startX + c.dir * (W + 120), duration: 1400, ease: 'Sine.easeIn', onComplete: () => {
      tr.stop(); wv.destroy();
      c.fx.flash(c.c1, 0.4, 250);
      sfx(c.bs, 'bigBoom', { rate: 1.3, vol: 0.6 });
      for (const e of onScreen(c)) hit(c, 1.2, { x: e.x, y: e.y, w: 30, h: 30, kbx: 160, kby: -240, heavy: true, skill: true, life: 40, hitstop: 60 });
    } });
    return { lock: 1600 };
  },

  // ------------------------------------------------------------ VINE
  vine_roots: (c) => {
    sfx(c.bs, 'fall', { rate: 1.4, vol: 0.5 });
    for (let i = 0; i < 5; i++) later(c, i * 80, () => {
      const x = c.p.x + c.dir * (40 + i * 38);
      const th = c.bs.add.image(x, GROUND_Y + 34, 'pr_thorn').setOrigin(0.5, 1).setTint(c.c1).setScale(1.5, 2.4 + i * 0.15).setDepth(27);
      c.bs.tweens.add({ targets: th, y: GROUND_Y + 2, duration: 90, ease: 'Back.easeOut', onComplete: () => c.bs.tweens.add({ targets: th, y: GROUND_Y + 70, delay: 350, duration: 250, onComplete: () => th.destroy() }) });
      c.fx.burst(x, GROUND_Y - 10, { tex: 'leaf', n: 6, color: [c.c1, c.c2], speed: [60, 160], angle: [240, 300], add: false });
      sfx(c.bs, 'swing', { rate: 1.2 + i * 0.1, vol: 0.5 });
      hit(c, 1, { x, y: GROUND_Y - 26, w: 30, h: 56, kbx: 30, kby: -300, stun: 600, skill: true, critChance: 0.1, hitstop: 20 });
    });
    return { lock: 380 };
  },
  vine_drain: (c) => {
    const x = c.p.x, y = c.p.y;
    c.fx.ring(x, y, c.c1, 100, 10, 500, true);
    sfx(c.bs, 'reveal', { rate: 0.7 });
    const tr = c.fx.trail(c.p.spr, { tex: 'leaf', color: [c.c1, c.c2], freq: 30, speed: [40, 90], spread: 30, add: false });
    for (let k = 0; k < 5; k++) later(c, 100 + k * 150, () => {
      hit(c, 0.32, { x: c.p.x, y: c.p.y, w: 170, h: 90, kbx: 0, stun: 300, skill: true, noSpark: true, life: 40,
        onHit: (t) => {
          const orb = c.bs.add.image(t.x, t.y, 'glowS').setBlendMode(ADD).setTint(c.c1).setDepth(58);
          c.bs.tweens.add({ targets: orb, x: { getEnd: () => c.p.x }, y: { getEnd: () => c.p.y }, duration: 350, ease: 'Quad.easeIn', onComplete: () => { orb.destroy(); c.p.heal(c.p.maxHp * 0.012); } });
        } });
    });
    later(c, 850, () => tr.stop());
    return { lock: 800 };
  },
  vine_ult: (c) => {
    ensureUltArt(c.bs);
    const { v } = viewCenter(c);
    dim(c, 0x082008, 0.5, 200, 1500);
    sfx(c.bs, 'fall', { rate: 0.5 });
    c.fx.shake(0.006, 1200);
    for (let i = 0; i < 8; i++) later(c, 150 + i * 120, () => {
      const x = v.x + 40 + (i + Math.random() * 0.6) * ((W - 80) / 8);
      const tree = c.bs.add.image(x, GROUND_Y + 280, 'ultTree').setOrigin(0.5, 1).setScale(1.5 + Math.random() * 0.3).setDepth(54);
      c.bs.tweens.add({ targets: tree, y: GROUND_Y + 2, duration: 180, ease: 'Back.easeOut' });
      later(c, 900, () => c.bs.tweens.add({ targets: tree, alpha: 0, y: '+=60', duration: 300, onComplete: () => tree.destroy() }));
      c.fx.burst(x, GROUND_Y - 30, { tex: 'leaf', n: 18, color: [c.c1, c.c2, 0x3a8a3a], speed: [80, 220], add: false, life: [400, 800] });
      sfx(c.bs, 'boom', { rate: 1.3, vol: 0.5 });
      hit(c, 0.5, { x, y: GROUND_Y - 90, w: 50, h: 200, kbx: 40, kby: -280, stun: 600, skill: true, critChance: 0.12, hitstop: 30 });
    });
    later(c, 1300, () => {
      c.fx.glow(c.p.x, c.p.y, c.c1, 2.5, 600);
      c.fx.burst(c.p.x, c.p.y, { tex: 'leaf', n: 20, color: [c.c1, c.c2], speed: [40, 120], angle: [240, 300], add: false });
      c.p.heal(c.p.maxHp * 0.25);
      sfx(c.bs, 'reveal');
    });
    return { lock: 1500 };
  },

  // ------------------------------------------------------------ IRON
  iron_charge: (c) => {
    burstMove(c, c.dir * 620, 0, 260);
    sfx(c.bs, 'dash', { rate: 0.7 });
    const sh = c.bs.add.rectangle(c.p.x + c.dir * 16, c.p.y - 2, 9, 26, c.c1).setStrokeStyle(2, c.c2).setDepth(56);
    const ev = c.bs.time.addEvent({ delay: 16, loop: true, callback: () => sh.setPosition(c.p.x + c.dir * 16, c.p.y - 2) });
    const tr = c.fx.trail(sh, { tex: 'spark', color: [0xffffff, c.c1], freq: 15, speed: [40, 120], angle: c.dir > 0 ? [150, 210] : [-30, 30] });
    hit(c, 1, { x: 0, y: 0, follow: c.p.spr, offX: c.dir * 14, offY: -9, w: 34, h: 30, life: 280, kbx: 340, kby: -100, stun: 700, heavy: true, skill: true, critChance: 0.1, hitstop: 60 });
    later(c, 280, () => { ev.remove(); tr.stop(); c.bs.tweens.add({ targets: sh, alpha: 0, duration: 150, onComplete: () => sh.destroy() }); c.fx.dust(c.p.x, GROUND_Y - 1, 5); });
    return { lock: 320, iframes: 340 };
  },
  iron_parry: (c) => {
    const ring = c.bs.add.image(c.p.x, c.p.y, 'ring').setBlendMode(ADD).setTint(c.c1).setScale(0.7).setDepth(56);
    const ev = c.bs.time.addEvent({ delay: 16, loop: true, callback: () => ring.setPosition(c.p.x, c.p.y).setAlpha(0.5 + Math.sin(c.bs.time.now / 60) * 0.3) });
    sfx(c.bs, 'equip');
    const end = () => { ev.remove(); ring.destroy(); };
    c.p.parry = {
      until: c.bs.time.now + 1000,
      fn: () => {
        end();
        c.p.stateT = 200;
        c.p.iframes = Math.max(c.p.iframes, 500);
        c.fx.flash(0xffffff, 0.5, 160);
        c.fx.shake(0.012, 200);
        c.bs.hitstop(120);
        sfx(c.bs, 'hitHeavy'); sfx(c.bs, 'swingHeavy');
        c.fx.label(c.p.x, c.p.y - 30, '반격!', 0xffd166);
        for (const d of [-1, 1]) c.fx.slash(c.p.x + d * 30, c.p.y, d, c.c1, { big: true, scale: 0.8, thin: 0.5 });
        c.fx.ring(c.p.x, c.p.y, 0xffffff, 10, 110, 300);
        hit(c, 1, { x: c.p.x, y: c.p.y, w: 130, h: 64, kbx: 300, kby: -200, stun: 900, heavy: true, skill: true, forceCrit: true, pierce: true, hitstop: 100 });
      },
    };
    later(c, 1000, () => { if (c.p.parry) { c.p.parry = null; end(); } });
    return { lock: 1000 };
  },
  iron_ult: (c) => {
    ensureUltArt(c.bs);
    c.p.iframes = Math.max(c.p.iframes, 2600);
    dim(c, 0x101828, 0.4, 200, 1500);
    const { v } = viewCenter(c);
    const dir = (c.dir > 0 ? v.right - c.p.x : c.p.x - v.x) < 290 ? -c.dir : c.dir;
    for (let i = 0; i < 5; i++) later(c, 150 + i * 220, () => {
      const x = Phaser.Math.Clamp(c.p.x + dir * (50 + i * 55), v.x + 30, v.right - 30);
      const sh = c.bs.add.image(x, GROUND_Y - 300, 'ultShield').setScale(1.2).setDepth(57);
      c.bs.tweens.add({ targets: sh, y: GROUND_Y - 38, duration: 140, ease: 'Quad.easeIn', onComplete: () => {
        c.fx.groundSlam(x, GROUND_Y - 1, c.c1, 1.6);
        c.fx.shake(0.016, 160);
        sfx(c.bs, 'bigBoom', { rate: 1.1 + i * 0.05, vol: 0.6 });
        hit(c, 0.8, { x, y: GROUND_Y - 40, w: 70, h: 90, kbx: 260, kby: -200, heavy: true, stun: 700, skill: true, critChance: 0.12, hitstop: 70 });
        c.bs.tweens.add({ targets: sh, alpha: 0, delay: 500, duration: 300, onComplete: () => sh.destroy() });
      } });
    });
    return { lock: 1400 };
  },

  // ------------------------------------------------------------ POISON
  poison_cloud: (c) => {
    const x = c.p.x + c.dir * 90, y = GROUND_Y - 30;
    sfx(c.bs, 'skid', { rate: 0.5, vol: 0.5 });
    const em = c.bs.add.particles(x, y, 'smoke', { x: { min: -60, max: 60 }, y: { min: -26, max: 20 }, lifespan: 1200, scale: { start: 1.2, end: 2.4 }, alpha: { start: 0.55, end: 0 }, tint: [c.c1, c.c2, 0x6a8a3a], frequency: 40, speedY: { min: -12, max: 4 } }).setDepth(57);
    hit(c, 1, { x, y, w: 130, h: 70, life: 4000, interval: 400, kbx: 0, stun: 150, slow: 600, skill: true, noSpark: true, color: c.c1 });
    later(c, 4000, () => { em.stop(); later(c, 1300, () => em.destroy()); });
    return { lock: 300 };
  },
  poison_fan: (c) => {
    for (let i = -3; i <= 3; i++) dart(c, 1, i * 0.1);
    return { lock: 280 };
  },
  poison_ult: (c) => {
    dim(c, 0x200828, 0.55, 250, 1600);
    sfx(c.bs, 'reveal', { rate: 0.5 });
    c.fx.flash(c.c1, 0.3, 200);
    for (const e of onScreen(c)) {
      c.fx.glow(e.x, e.y, c.c2, 1.5, 500);
      c.fx.burst(e.x, e.y, { tex: 'smoke', n: 10, color: [c.c1, c.c2], speed: [20, 70], add: false, alpha: [0.8, 0], life: [400, 800] });
      strike(c, e, 0.25, { heavy: true, stun: 500 });
      const tr = c.fx.trail(e as unknown as { x: number; y: number }, { tex: 'p2', color: [c.c1, c.c2], freq: 60, speed: [10, 40], angle: [250, 290], life: [300, 600] });
      later(c, 3000, () => tr.stop());
      dot(c, e, 0.07, 12, 250, c.c1);
    }
    return { lock: 900 };
  },

  // ------------------------------------------------------------ SONIC
  sonic_boom: (c) => {
    sfx(c.bs, 'bigBoom', { rate: 1.6, vol: 0.6 });
    for (let i = 0; i < 4; i++) later(c, i * 70, () => c.fx.ring(c.p.x, c.p.y, i % 2 ? c.c1 : c.c2, 8, 90 + i * 25, 320, true));
    c.fx.shake(0.01, 200);
    c.fx.burst(c.p.x, c.p.y, { tex: 'streak', n: 16, color: [c.c1, c.c2], speed: [150, 300], life: [200, 350] });
    hit(c, 1, { x: c.p.x, y: c.p.y, w: 160, h: 90, kbx: 320, kby: -220, heavy: true, stun: 600, skill: true, critChance: 0.1, hitstop: 60 });
    return { lock: 340 };
  },
  sonic_mark: (c) => {
    const ts = c.bs.enemies.filter((e) => e.alive && Math.abs(e.x - c.p.x) < 260).slice(0, 6);
    sfx(c.bs, 'flip', { rate: 1.5 });
    if (!ts.length) { c.fx.ring(c.p.x + c.dir * 60, c.p.y, c.c1, 6, 40, 300, true); return { lock: 260 }; }
    for (const e of ts) {
      const n = c.bs.add.text(e.x, e.y - 22, '♪', { fontFamily: 'Galmuri11B', fontSize: '15px', color: '#ffd0ec', stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0.5).setDepth(700);
      const ev = c.bs.time.addEvent({ delay: 16, loop: true, callback: () => n.setPosition(e.x, e.y - 22 + Math.sin(c.bs.time.now / 80) * 2) });
      later(c, 700, () => {
        ev.remove(); n.destroy();
        if (!e.alive) return;
        c.fx.ring(e.x, e.y, c.c1, 6, 60, 300, true); c.fx.ring(e.x, e.y, c.c2, 6, 44, 260);
        c.fx.burst(e.x, e.y, { tex: 'spark', n: 10, color: [c.c1, c.c2], speed: [60, 180] });
        sfx(c.bs, 'zap', { rate: 1.8, vol: 0.5 });
        strike(c, e, 1, { heavy: true, stun: 600, kbx: 120, critChance: 0.2 });
      });
    }
    return { lock: 280 };
  },
  sonic_ult: (c) => {
    dim(c, 0x200820, 0.5, 150, 1500);
    c.fx.speedLines(c.c1, 1200, 30);
    sfx(c.bs, 'skid', { rate: 2.5 });
    for (let i = 0; i < 8; i++) later(c, 100 + i * 140, () => {
      c.fx.ring(c.p.x, c.p.y, i % 2 ? c.c1 : c.c2, 10, 620, 600, i % 2 === 0);
      c.fx.shake(0.012, 140);
      sfx(c.bs, 'boom', { rate: 1.8 - i * 0.08, vol: 0.4 });
      for (const e of onScreen(c)) strike(c, e, 0.4, { stun: 400, kbx: 40, noSpark: i % 2 === 1, critChance: 0.1 });
    });
    later(c, 1300, () => { c.fx.flash(0xffffff, 0.6, 250); for (const e of onScreen(c)) strike(c, e, 1, { heavy: true, kbx: 260, kby: -200, stun: 800 }); });
    return { lock: 1500 };
  },

  // ------------------------------------------------------------ CRYSTAL
  crystal_spikes: (c) => {
    const cols = [0xe8d8ff, 0x6ae8ff, 0xff9aff, 0xfff27a];
    for (let i = 0; i < 6; i++) later(c, i * 70, () => {
      const x = c.p.x + c.dir * (36 + i * 32);
      const d = c.bs.add.image(x, GROUND_Y + 20, 'diamond').setTint(cols[i % 4]).setScale(1.6, 0.4).setBlendMode(ADD).setDepth(56);
      c.bs.tweens.add({ targets: d, y: GROUND_Y - 16, scaleY: 4 + i * 0.3, duration: 110, ease: 'Back.easeOut', onComplete: () => c.bs.tweens.add({ targets: d, alpha: 0, delay: 300, duration: 250, onComplete: () => d.destroy() }) });
      c.fx.burst(x, GROUND_Y - 10, { tex: 'shard', n: 6, color: [cols[i % 4], 0xffffff], speed: [60, 160], angle: [230, 310], rotate: true });
      sfx(c.bs, 'shatter', { rate: 1.6 + i * 0.05, vol: 0.4 });
      hit(c, 1, { x, y: GROUND_Y - 22, w: 30, h: 50, kbx: 40, kby: -240, stun: 500, skill: true, critChance: 0.12, hitstop: 20 });
    });
    return { lock: 400 };
  },
  crystal_ray: (c) => {
    const beam = c.bs.add.image(0, 0, 'glow').setBlendMode(ADD).setDepth(57).setScale(7.4, 0.5);
    const core = c.bs.add.image(0, 0, 'line').setBlendMode(ADD).setTint(0xffffff).setDepth(58).setScale(5.5, 5);
    const src = c.bs.add.image(0, 0, 'glow').setBlendMode(ADD).setDepth(58).setScale(0.9);
    sfx(c.bs, 'zap', { rate: 0.6 });
    const ev = c.bs.time.addEvent({ delay: 16, loop: true, callback: () => {
      const h = (c.bs.time.now / 3) % 360;
      const rgb = Phaser.Display.Color.HSVToRGB(h / 360, 0.6, 1) as Phaser.Types.Display.ColorObject;
      const col = Phaser.Display.Color.GetColor(rgb.r, rgb.g, rgb.b);
      const x = c.p.x + c.dir * 182, y = c.p.y - 2;
      beam.setPosition(x, y).setTint(col).setScale(7.4, 0.45 + Math.sin(c.bs.time.now / 30) * 0.08);
      core.setPosition(x, y); src.setPosition(c.p.x + c.dir * 12, y).setTint(col);
    } });
    hit(c, 1, { x: 0, y: 0, follow: c.p.spr, offX: c.dir * 182, offY: -11, w: 340, h: 20, life: 1000, interval: 100, kbx: 20, stun: 200, skill: true, critChance: 0.08, noSpark: false });
    later(c, 1000, () => { ev.remove(); c.bs.tweens.add({ targets: [beam, core, src], scaleY: 0, alpha: 0, duration: 150, onComplete: () => { beam.destroy(); core.destroy(); src.destroy(); } }); });
    return { lock: 1000 };
  },
  crystal_ult: (c) => {
    const { v } = viewCenter(c);
    const cx = v.centerX, cy = v.y + 120;
    dim(c, 0x100820, 0.6, 200, 1900);
    const prism = c.bs.add.image(cx, cy, 'diamond').setScale(0).setTint(c.c1).setDepth(58);
    const gl = c.bs.add.image(cx, cy, 'glow').setBlendMode(ADD).setTint(c.c2).setScale(0).setDepth(57);
    c.bs.tweens.add({ targets: prism, scale: 5, angle: 360, duration: 400, ease: 'Back.easeOut' });
    c.bs.tweens.add({ targets: gl, scale: 3, duration: 400 });
    sfx(c.bs, 'reveal', { rate: 0.8 });
    const beams: Phaser.GameObjects.Image[] = [];
    const cols = [0xff5a5a, 0xffd04a, 0x5aff8a, 0x5ac8ff, 0xc85aff, 0xffffff];
    for (let i = 0; i < 6; i++) beams.push(c.bs.add.image(cx, cy, 'line').setBlendMode(ADD).setTint(cols[i]).setOrigin(0, 0.5).setScale(0, 5).setDepth(57));
    c.bs.tweens.add({ targets: beams, scaleX: 9, duration: 300, delay: 300 });
    let ang = 0;
    const ev = c.bs.time.addEvent({ delay: 16, loop: true, callback: () => { ang += 0.04; beams.forEach((b, i) => b.setRotation(ang + (i / 6) * Math.PI * 2)); prism.angle += 3; } });
    for (let k = 0; k < 10; k++) later(c, 400 + k * 140, () => {
      sfx(c.bs, 'zap', { rate: 1 + k * 0.05, vol: 0.4 });
      for (const e of onScreen(c)) strike(c, e, 0.35, { stun: 300, color: cols[k % 6], critChance: 0.12, noSpark: k % 2 === 1 });
    });
    later(c, 1900, () => {
      ev.remove();
      beams.forEach((b) => b.destroy()); gl.destroy();
      c.bs.tweens.add({ targets: prism, scale: 7, alpha: 0, duration: 200, onComplete: () => prism.destroy() });
      c.fx.flash(0xffffff, 0.8, 300); c.fx.shake(0.02, 300);
      sfx(c.bs, 'shatter', { rate: 0.7 }); sfx(c.bs, 'bigBoom', { vol: 0.6 });
      c.fx.burst(cx, cy, { tex: 'shard', n: 50, color: cols, speed: [150, 450], rotate: true, gravity: 300, life: [500, 1000] });
      for (const e of onScreen(c)) strike(c, e, 1.6, { heavy: true, kbx: 220, kby: -240, stun: 800, pierce: true, critChance: 0.25 });
    });
    return { lock: 2000 };
  },

  // ------------------------------------------------------------ MAGMA
  magma_geyser: (c) => {
    const x = c.p.x + c.dir * 90;
    c.fx.glow(x, GROUND_Y - 4, c.c1, 1.2, 250);
    sfx(c.bs, 'boom', { rate: 0.8 });
    later(c, 120, () => {
      c.fx.beam(x, GROUND_Y - 160, GROUND_Y, 44, c.c1, 450);
      c.fx.burst(x, GROUND_Y - 10, { tex: 'flame', n: 26, color: [c.c1, c.c2, 0xa02010], speed: [80, 260], angle: [250, 290], gravity: 300, life: [400, 800] });
      c.fx.shake(0.008, 150);
      hit(c, 1.8, { x, y: GROUND_Y - 70, w: 50, h: 140, kbx: 30, kby: -300, stun: 600, heavy: true, skill: true, hitstop: 50 });
      lavaPool(c, x, 3000, 1);
      for (let k = 1; k <= 8; k++) later(c, k * 330, () => {
        c.fx.burst(x + (Math.random() - 0.5) * 30, GROUND_Y - 6, { tex: 'flame', n: 6, color: [c.c1, c.c2], speed: [60, 160], angle: [255, 285], gravity: 300 });
        hit(c, 0.6, { x, y: GROUND_Y - 40, w: 40, h: 80, kbx: 0, kby: -120, stun: 250, skill: true, noSpark: true });
      });
    });
    return { lock: 350 };
  },
  magma_bombs: (c) => {
    [90, 150, 210].forEach((d, i) => later(c, i * 90, () => {
      const o = c.bs.add.container(c.p.x, c.p.y - 10).setDepth(56);
      o.add([c.bs.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(c.c1).setScale(0.6), c.bs.add.image(0, 0, 'orb').setBlendMode(ADD).setTint(c.c2)]);
      const T = 0.8;
      sfx(c.bs, 'shoot', { rate: 0.6 });
      proj(c, { obj: o, vx: (c.dir * d) / T, vy: ((GROUND_Y - 10) - (c.p.y - 10) - 0.5 * 900 * T * T) / T, gravity: 900, life: 2000, w: 18, h: 18, mult: 0.3, hitGround: true, skill: true,
        trail: c.fx.trail(o, { tex: 'flame', color: [c.c1, c.c2], freq: 20, speed: [10, 40], gravity: -100 }),
        onEnd: (x) => {
          c.fx.glow(x, GROUND_Y - 10, c.c1, 1.6, 300); c.fx.ring(x, GROUND_Y - 10, c.c2, 6, 70, 300);
          c.fx.burst(x, GROUND_Y - 10, { tex: 'flame', n: 18, color: [c.c1, c.c2, 0xa02010], speed: [80, 220], angle: [200, 340], gravity: 300 });
          c.fx.shake(0.006, 100);
          sfx(c.bs, 'boom', { rate: 1.2, vol: 0.6 });
          hit(c, 1, { x, y: GROUND_Y - 24, w: 70, h: 50, kbx: 160, kby: -180, heavy: true, skill: true, critChance: 0.1, hitstop: 40 });
          lavaPool(c, x, 1600, 0.25);
        } });
    }));
    return { lock: 360 };
  },
  magma_ult: (c) => {
    const { v } = viewCenter(c);
    dim(c, 0x300800, 0.5, 200, 1800);
    const floor = c.bs.add.rectangle(v.centerX, GROUND_Y + 10, W + 40, 30, c.c1, 0).setBlendMode(ADD).setDepth(23);
    c.bs.tweens.add({ targets: floor, fillAlpha: 0.7, duration: 800, yoyo: true, hold: 600 });
    const bub = c.bs.add.particles(0, 0, 'p3', { x: { min: v.x, max: v.right }, y: GROUND_Y - 2, speedY: { min: -120, max: -40 }, lifespan: 600, tint: [c.c1, c.c2], gravityY: 200, frequency: 10, blendMode: 'ADD' }).setDepth(24);
    c.fx.shake(0.006, 1000);
    sfx(c.bs, 'fall', { rate: 0.4 });
    for (let i = 0; i < 12; i++) later(c, 900 + i * 60, () => {
      const x = (c.dir > 0 ? v.x : v.right) + c.dir * (30 + i * ((W - 60) / 11));
      c.fx.beam(x, GROUND_Y - 220, GROUND_Y, 46, i % 2 ? c.c1 : c.c2, 500);
      c.fx.burst(x, GROUND_Y - 10, { tex: 'flame', n: 14, color: [c.c1, c.c2, 0xa02010], speed: [100, 300], angle: [250, 290], gravity: 300 });
      c.fx.shake(0.014, 100);
      sfx(c.bs, 'boom', { rate: 0.8 + i * 0.04, vol: 0.5 });
      hit(c, 0.6, { x, y: GROUND_Y - 100, w: 56, h: 210, kbx: 40, kby: -320, stun: 700, heavy: true, skill: true, critChance: 0.12, hitstop: 30 });
    });
    later(c, 1700, () => { bub.stop(); later(c, 700, () => bub.destroy()); floor.destroy(); c.fx.flash(c.c2, 0.5, 300); });
    return { lock: 1800 };
  },

  // ------------------------------------------------------------ CHRONO
  chrono_stop: (c) => {
    dim(c, 0x403010, 0.35, 150, 1800);
    c.fx.ring(c.p.x, c.p.y, c.c1, 10, 400, 600, true);
    c.fx.ring(c.p.x, c.p.y, c.c2, 10, 300, 500);
    const face = c.bs.add.container(c.p.x, c.p.y - 40).setDepth(58);
    const hand = c.bs.add.rectangle(0, 0, 2, 22, c.c1).setOrigin(0.5, 1);
    face.add([c.bs.add.image(0, 0, 'ringThin').setTint(c.c1).setScale(0.6), hand]);
    c.bs.tweens.add({ targets: hand, angle: 360, duration: 600, repeat: 2 });
    c.bs.tweens.add({ targets: face, alpha: 0, delay: 1600, duration: 300, onComplete: () => face.destroy() });
    sfx(c.bs, 'rotate', { rate: 0.5 }); sfx(c.bs, 'reveal', { rate: 0.6 });
    for (const e of onScreen(c)) strike(c, e, 1, { freeze: 2000, noSpark: true, stun: 0 });
    return { lock: 400 };
  },
  chrono_rewind: (c) => {
    const now = c.bs.time.now;
    const past = c.p.hpLog.find((s) => now - s.t <= 3100) ?? c.p.hpLog[0];
    const from = c.p.spr.x;
    c.fx.flash(c.c2, 0.3, 200);
    sfx(c.bs, 'rotate', { rate: 0.4 }); sfx(c.bs, 'reveal', { rate: 1.4 });
    for (let i = 0; i < 6; i++) later(c, i * 30, () => c.fx.afterimage(c.p.spr, c.c2, 300, 0.6));
    if (past) {
      const b = c.bs.arenaBounds();
      const tx = Phaser.Math.Clamp(past.x, b.left + 12, b.right - 12);
      c.bs.tweens.addCounter({ from: 0, to: 1, duration: 200, onUpdate: (tw) => { const x = from + (tx - from) * (tw.getValue() ?? 0); c.p.spr.x = x; c.p.body.reset(x, c.p.spr.y); } });
      if (past.hp > c.p.hp) c.p.heal(past.hp - c.p.hp);
    }
    c.fx.ring(c.p.x, c.p.y, c.c1, 40, 4, 400, true);
    return { lock: 300, iframes: 600 };
  },
  chrono_ult: (c) => {
    const { v } = viewCenter(c);
    dim(c, 0x403010, 0.6, 150, 2000);
    const ts = onScreen(c);
    for (const e of ts) strike(c, e, 0.01, { freeze: 2600, noSpark: true, stun: 0 });
    sfx(c.bs, 'rotate', { rate: 0.3 });
    for (let i = 0; i < 24; i++) later(c, 200 + i * 55, () => {
      const t = ts.length ? ts[i % ts.length] : null;
      const x = t ? t.x : v.x + Math.random() * W, y = t ? t.y : v.centerY;
      const ln = c.bs.add.image(x, y, 'line').setBlendMode(ADD).setTint(i % 2 ? c.c1 : c.c2).setDepth(60).setRotation(Math.random() * Math.PI).setScale(0.2, 2);
      c.bs.tweens.add({ targets: ln, scaleX: 4, duration: 60, onComplete: () => c.bs.tweens.add({ targets: ln, alpha: 0.35, duration: 100 }) });
      later(c, 1700 - i * 55, () => ln.destroy());
      if (i % 3 === 0) sfx(c.bs, 'swing', { rate: 1.6, vol: 0.5 });
    });
    later(c, 1700, () => {
      c.fx.flash(0xffffff, 0.9, 300); c.fx.shake(0.025, 400);
      sfx(c.bs, 'bigBoom'); sfx(c.bs, 'shatter', { rate: 0.8 });
      c.fx.ring(v.centerX, v.centerY, c.c1, 20, 500, 600);
      for (const e of ts) { for (let k = 0; k < 4; k++) strike(c, e, 0.6, { stun: 400, critChance: 0.2, kbx: 0 }); strike(c, e, 1, { heavy: true, kbx: 260, kby: -220, stun: 900, pierce: true }); }
    });
    return { lock: 2000 };
  },

  // ------------------------------------------------------------ DRAGON
  dragon_breath: (c) => {
    sfx(c.bs, 'skid', { rate: 0.5 }); sfx(c.bs, 'boom', { rate: 1.5, vol: 0.4 });
    const mouth = { x: c.p.x + c.dir * 12, y: c.p.y - 2 };
    const em = c.bs.add.particles(0, 0, 'flame', {
      follow: mouth as Phaser.Types.Math.Vector2Like, speed: { min: 220, max: 340 }, angle: c.dir > 0 ? { min: -14, max: 14 } : { min: 166, max: 194 },
      lifespan: 450, scale: { start: 0.8, end: 2.6 }, alpha: { start: 1, end: 0 }, tint: [c.c1, c.c2, 0xff3010], frequency: 8, quantity: 2, blendMode: 'ADD',
    }).setDepth(57);
    const ev = c.bs.time.addEvent({ delay: 16, loop: true, callback: () => { mouth.x = c.p.x + c.dir * 12; mouth.y = c.p.y - 2; } });
    hit(c, 1, { x: 0, y: 0, follow: c.p.spr, offX: c.dir * 82, offY: -11, w: 150, h: 44, life: 1200, interval: 120, kbx: 30, stun: 250, skill: true, critChance: 0.08, noSpark: true });
    later(c, 1200, () => { ev.remove(); em.stop(); later(c, 500, () => em.destroy()); });
    return { lock: 1200 };
  },
  dragon_dive: (c) => {
    c.p.gravityOff = false;
    c.p.body.setVelocity(c.dir * 60, -520);
    sfx(c.bs, 'jump', { rate: 0.7 });
    c.fx.ring(c.p.x, GROUND_Y - 2, c.c1, 6, 60, 300);
    later(c, 330, () => {
      c.p.body.setVelocity(c.dir * 280, 780);
      sfx(c.bs, 'dash', { rate: 0.6 });
      const tr = c.fx.trail(c.p.spr, { tex: 'flame', color: [c.c1, c.c2], freq: 8, speed: [20, 80], spread: 6, scale: [1.6, 0] });
      let done = false;
      const ev = c.bs.time.addEvent({ delay: 16, loop: true, callback: () => {
        if (done || !(c.p.onGround || c.p.spr.y >= GROUND_Y - 1)) return;
        done = true; ev.remove(); tr.stop();
        const x = c.p.x;
        c.fx.groundSlam(x, GROUND_Y - 1, c.c1, 2);
        c.fx.glow(x, GROUND_Y - 20, c.c1, 2.4, 400);
        c.fx.burst(x, GROUND_Y - 10, { tex: 'flame', n: 30, color: [c.c1, c.c2, 0xff3010], speed: [100, 300], angle: [200, 340], gravity: -100 });
        c.fx.shake(0.016, 250);
        sfx(c.bs, 'bigBoom', { rate: 1.1 });
        hit(c, 1, { x, y: GROUND_Y - 26, w: 130, h: 60, kbx: 260, kby: -260, heavy: true, stun: 800, skill: true, critChance: 0.15, hitstop: 90 });
      } });
      later(c, 900, () => { if (!done) { done = true; ev.remove(); tr.stop(); } });
    });
    return { lock: 900, iframes: 950 };
  },
  dragon_ult: (c) => {
    ensureDragonHead(c.bs);
    const { v } = viewCenter(c);
    dim(c, 0x200800, 0.55, 200, 1800);
    const y = v.y + 190;
    const startX = c.dir > 0 ? v.x - 120 : v.right + 120;
    const head = c.bs.add.image(startX, y, 'dragonHead').setScale(2).setFlipX(c.dir < 0).setDepth(59);
    const segs: Phaser.GameObjects.Ellipse[] = [];
    for (let i = 0; i < 9; i++) segs.push(c.bs.add.ellipse(startX, y, 64 - i * 5, 54 - i * 4, i % 2 ? 0x3ab87a : 0x2a9a64).setDepth(58 - i * 0.01));
    const tr = c.fx.trail(head, { tex: 'flame', color: [c.c1, c.c2, 0xff3010], freq: 5, speed: [60, 200], spread: 40, scale: [2.4, 0], life: [400, 700] });
    const hist: { x: number; y: number }[] = [];
    sfx(c.bs, 'swingHeavy', { rate: 0.4 }); sfx(c.bs, 'bigBoom', { rate: 0.6, vol: 0.5 });
    hit(c, 0.55, { x: 0, y: 0, follow: head, w: 160, h: 200, life: 1500, interval: 160, kbx: 200, kby: -180, stun: 500, heavy: true, skill: true, critChance: 0.15 });
    c.bs.tweens.addCounter({ from: 0, to: 1, duration: 1500, ease: 'Sine.easeIn', onUpdate: (tw) => {
      const t = tw.getValue() ?? 0;
      head.x = startX + c.dir * t * (W + 400);
      head.y = y + Math.sin(t * Math.PI * 3) * 40;
      head.setRotation(Math.cos(t * Math.PI * 3) * 0.25 * c.dir);
      hist.unshift({ x: head.x, y: head.y });
      segs.forEach((sg, i) => { const h = hist[Math.min(hist.length - 1, (i + 1) * 4)]; sg.setPosition(h.x - c.dir * 20, h.y + 6); });
      c.fx.shake(0.006, 30);
    }, onComplete: () => {
      tr.stop(); head.destroy(); segs.forEach((s) => s.destroy());
      c.fx.flash(c.c1, 0.6, 300);
      for (const e of onScreen(c)) { c.fx.burst(e.x, e.y, { tex: 'flame', n: 14, color: [c.c1, c.c2], speed: [60, 200], gravity: -150 }); strike(c, e, 1.2, { heavy: true, kbx: 200, kby: -200, stun: 800 }); }
      sfx(c.bs, 'bigBoom');
    } });
    return { lock: 1700 };
  },

  // ------------------------------------------------------------ LIGHT
  light_sanctum: (c) => {
    const x = c.p.x;
    const zone = c.bs.add.image(x, GROUND_Y - 2, 'ring').setBlendMode(ADD).setTint(c.c1).setScale(0, 0).setDepth(22);
    const gl = c.bs.add.image(x, GROUND_Y - 30, 'glow').setBlendMode(ADD).setTint(c.c1).setScale(3, 1.6).setAlpha(0).setDepth(22);
    c.bs.tweens.add({ targets: zone, scaleX: 1.8, scaleY: 0.35, duration: 300, ease: 'Back.easeOut' });
    c.bs.tweens.add({ targets: gl, alpha: 0.35, duration: 300 });
    c.bs.tweens.add({ targets: zone, angle: 360, duration: 3000 });
    const motes = c.bs.add.particles(x, GROUND_Y - 4, 'star4', { x: { min: -80, max: 80 }, speedY: { min: -70, max: -30 }, lifespan: 900, scale: { start: 0.6, end: 0 }, tint: [c.c1, 0xffffff], frequency: 40, blendMode: 'ADD' }).setDepth(57);
    sfx(c.bs, 'reveal', { rate: 1.2 });
    hit(c, 1, { x, y: GROUND_Y - 40, w: 170, h: 80, life: 3000, interval: 300, kbx: 0, stun: 200, skill: true, noSpark: true, pierce: true, color: c.c1 });
    for (let k = 1; k <= 10; k++) later(c, k * 300, () => { if (Math.abs(c.p.x - x) < 90) c.p.heal(c.p.maxHp * 0.02); });
    later(c, 3000, () => { motes.stop(); later(c, 900, () => motes.destroy()); c.bs.tweens.add({ targets: [zone, gl], alpha: 0, duration: 300, onComplete: () => { zone.destroy(); gl.destroy(); } }); });
    return { lock: 400 };
  },
  light_spear: (c) => {
    const vs = onScreen(c);
    const t = vs.sort((a, b) => ((b as unknown as { hp: number }).hp ?? 0) - ((a as unknown as { hp: number }).hp ?? 0))[0] ?? nearest(c, 400);
    const x = t ? t.x : c.p.x + c.dir * 120;
    const mark = c.bs.add.image(x, GROUND_Y - 2, 'ringThin').setBlendMode(ADD).setTint(c.c1).setScale(1.2, 0.3).setDepth(22);
    c.bs.tweens.add({ targets: mark, scaleX: 0.4, duration: 400 });
    sfx(c.bs, 'reveal', { rate: 1.6 });
    later(c, 400, () => {
      mark.destroy();
      const tx = t && t.alive ? t.x : x;
      const sp = c.bs.add.image(tx, GROUND_Y - 400, 'shard').setTint(c.c1).setBlendMode(ADD).setScale(14, 5).setRotation(Math.PI / 2).setDepth(58);
      c.bs.tweens.add({ targets: sp, y: GROUND_Y - 40, duration: 120, ease: 'Quad.easeIn', onComplete: () => {
        c.fx.beam(tx, GROUND_Y - 300, GROUND_Y, 40, c.c1, 500);
        c.fx.flash(0xffffff, 0.6, 200); c.fx.shake(0.018, 250);
        c.fx.ring(tx, GROUND_Y - 30, 0xffffff, 10, 140, 400);
        c.fx.burst(tx, GROUND_Y - 30, { tex: 'star4', n: 24, color: [c.c1, 0xffffff], speed: [100, 300], scale: [1, 0] });
        sfx(c.bs, 'bigBoom', { rate: 1.3 });
        hit(c, 1, { x: tx, y: GROUND_Y - 60, w: 70, h: 120, kbx: 120, kby: -260, heavy: true, stun: 900, skill: true, pierce: true, critChance: 0.3, hitstop: 120 });
        c.bs.tweens.add({ targets: sp, alpha: 0, duration: 400, onComplete: () => sp.destroy() });
      } });
    });
    return { lock: 300 };
  },
  light_ult: (c) => {
    const { v } = viewCenter(c);
    dim(c, 0x302810, 0.45, 300, 1900);
    const sky = c.bs.add.image(v.centerX, v.y - 20, 'glow').setBlendMode(ADD).setTint(c.c1).setScale(14, 3).setScrollFactor(1).setAlpha(0).setDepth(41);
    c.bs.tweens.add({ targets: sky, alpha: 0.8, duration: 400, hold: 1400, yoyo: true, onComplete: () => sky.destroy() });
    sfx(c.bs, 'reveal', { rate: 0.5 });
    const ts = onScreen(c);
    for (let i = 0; i < 12; i++) later(c, 300 + i * 110, () => {
      const t = ts.length && i % 2 === 0 ? ts[(i / 2) % ts.length] : null;
      const x = t && t.alive ? t.x : v.x + 30 + Math.random() * (W - 60);
      c.fx.beam(x, v.y, GROUND_Y, 50, i % 2 ? c.c1 : 0xffffff, 500);
      c.fx.burst(x, GROUND_Y - 10, { tex: 'star4', n: 10, color: [c.c1, 0xffffff], speed: [80, 220], angle: [200, 340], scale: [0.8, 0] });
      c.fx.shake(0.008, 90);
      sfx(c.bs, 'zap', { rate: 0.7 + i * 0.05, vol: 0.4 });
      hit(c, 0.5, { x, y: GROUND_Y - 100, w: 60, h: 220, kbx: 40, kby: -140, stun: 500, skill: true, pierce: true, critChance: 0.15, hitstop: 20 });
    });
    later(c, 1700, () => {
      c.fx.flash(0xffffff, 1, 400); c.fx.shake(0.02, 300);
      sfx(c.bs, 'bigBoom', { rate: 0.8 });
      for (const e of onScreen(c)) strike(c, e, 1.5, { heavy: true, kbx: 220, kby: -240, stun: 900, pierce: true, critChance: 0.25 });
      c.p.heal(c.p.maxHp * 0.3);
      c.fx.glow(c.p.x, c.p.y, c.c1, 3, 700);
    });
    return { lock: 1900 };
  },

  // ------------------------------------------------------------ CHAOS
  chaos_orb: (c) => {
    const o = c.bs.add.container(c.p.x + c.dir * 14, c.p.y - 10).setDepth(56);
    const gl = c.bs.add.image(0, 0, 'glow').setBlendMode(ADD).setScale(0.8);
    const core = c.bs.add.image(0, 0, 'orb').setBlendMode(ADD).setScale(1.2);
    o.add([gl, core]);
    sfx(c.bs, 'shoot', { rate: 0.5 });
    let lastBurst = 0;
    proj(c, { obj: o, vx: c.dir * 230, vy: -240, gravity: 600, life: 2600, w: 22, h: 22, mult: 1, pierceAll: true, interval: 300, skill: true,
      trail: c.fx.trail(o, { tex: 'p2', color: [c.c1, c.c2, 0xfff27a], freq: 15, speed: [10, 50] }),
      onTick: (p, dt) => {
        const h = (c.bs.time.now / 3) % 360;
        const rgb = Phaser.Display.Color.HSVToRGB(h / 360, 0.7, 1) as Phaser.Types.Display.ColorObject;
        const col = Phaser.Display.Color.GetColor(rgb.r, rgb.g, rgb.b);
        gl.setTint(col); core.setTint(col);
        if (o.y >= GROUND_Y - 12 && p.o.vy > 0) { p.o.vy = -Math.max(260, Math.abs(p.o.vy) * 0.85); c.fx.dust(o.x, GROUND_Y - 1, 3); sfx(c.bs, 'land', { rate: 1.8, vol: 0.4 }); }
        lastBurst += dt;
        if (lastBurst > 450) { lastBurst = 0; elementBurst(c, o.x, o.y, 0.8, 56); }
      },
      onEnd: (x, y) => elementBurst(c, x, y, 1.4, 90) });
    return { lock: 320 };
  },
  chaos_entropy: (c) => {
    sfx(c.bs, 'reveal', { rate: 1.8 });
    for (let i = 0; i < 8; i++) later(c, i * 90, () => {
      const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 110;
      const x = c.p.x + Math.cos(a) * r, y = Math.min(GROUND_Y - 20, c.p.y + Math.sin(a) * r * 0.5);
      elementBurst(c, x, y, 1, 70);
      c.fx.shake(0.005, 80);
      sfx(c.bs, 'boom', { rate: 1.4 + Math.random() * 0.4, vol: 0.4 });
    });
    return { lock: 400 };
  },
  chaos_ult: (c) => {
    const { v } = viewCenter(c);
    const cx = v.centerX, cy = v.centerY + 10;
    dim(c, 0x000000, 0.92, 300, 2000);
    sfx(c.bs, 'skid', { rate: 0.3 });
    const pt = c.bs.add.image(cx, cy, 'glow').setBlendMode(ADD).setTint(0xffffff).setScale(0.2).setDepth(59);
    const suck = c.bs.add.particles(cx, cy, 'p2', {
      emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 300) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      moveToX: cx, moveToY: cy, lifespan: 600, tint: [c.c1, c.c2, 0xfff27a, 0xffffff], frequency: 4, quantity: 3, blendMode: 'ADD',
    }).setDepth(58);
    for (let k = 0; k < 10; k++) later(c, k * 100, () => { for (const e of onScreen(c)) if (!e.isBoss) e.pullTo?.(cx, cy, 300); });
    c.bs.tweens.add({ targets: pt, scale: 1.2, duration: 1100, ease: 'Cubic.easeIn' });
    later(c, 1200, () => {
      suck.stop(); later(c, 600, () => suck.destroy());
      c.bs.tweens.add({ targets: pt, scale: 0, duration: 100, onComplete: () => pt.destroy() });
      later(c, 150, () => {
        c.fx.flash(0xffffff, 1, 600); c.fx.shake(0.045, 800);
        sfx(c.bs, 'bigBoom', { rate: 0.4 }); later(c, 150, () => sfx(c.bs, 'bigBoom', { rate: 0.6 })); later(c, 300, () => sfx(c.bs, 'shatter', { rate: 0.5 }));
        const cols = [0xff4a8a, 0x4affd8, 0xfff27a, 0x9a6aff, 0xffffff, 0xff7a2a];
        cols.forEach((col, i) => later(c, i * 70, () => c.fx.ring(cx, cy, col, 10, 700 + i * 50, 900, i % 2 === 1)));
        c.fx.burst(cx, cy, { tex: 'star4', n: 90, color: cols, speed: [150, 700], life: [600, 1400], scale: [1.4, 0] });
        c.fx.burst(cx, cy, { tex: 'streak', n: 50, color: cols, speed: [300, 800], life: [300, 700] });
        for (const e of onScreen(c)) { for (let k = 0; k < 3; k++) strike(c, e, 0.6, { stun: 300, critChance: 0.2, color: cols[k] }); strike(c, e, 1.8, { heavy: true, kbx: 380, kby: -320, stun: 1200, pierce: true, critChance: 0.3 }); }
        const stars = c.bs.add.particles(0, 0, 'star4', { x: { min: v.x, max: v.right }, y: { min: v.y, max: v.bottom - 60 }, lifespan: 1200, scale: { start: 0, end: 0.6, ease: 'Sine.easeInOut' }, alpha: { start: 1, end: 0 }, tint: cols, frequency: 30, blendMode: 'ADD' }).setDepth(57);
        later(c, 1500, () => { stars.stop(); later(c, 1300, () => stars.destroy()); });
      });
    });
    return { lock: 2200 };
  },
};

Object.assign(BASICS, NEW_BASICS);
Object.assign(SKILL_FX, NEW_SKILLS);
