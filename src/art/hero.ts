// The hero: a wide rectangle with two eyes and two short legs. Nothing else.
import { ABILITIES } from '../data/abilities';
import { addTex, makeCanvas, mix, px, ramp } from './pixel';

export const HERO_FW = 32;
export const HERO_FH = 26;

export interface HeroPose {
  bodyDy: number; // vertical offset of body
  squash: number; // -1..1 (positive = wider/shorter)
  legL: [number, number]; // x offset, length
  legR: [number, number];
  eyes: 'open' | 'blink' | 'shut' | 'wide' | 'focus';
  lean: number; // horizontal body offset
}

const POSES: Record<string, HeroPose[]> = {
  idle: [
    { bodyDy: 0, squash: 0, legL: [0, 3], legR: [0, 3], eyes: 'open', lean: 0 },
    { bodyDy: 1, squash: 0.25, legL: [0, 2], legR: [0, 2], eyes: 'open', lean: 0 },
    { bodyDy: 1, squash: 0.25, legL: [0, 2], legR: [0, 2], eyes: 'blink', lean: 0 },
  ],
  run: [
    { bodyDy: 0, squash: 0, legL: [-2, 3], legR: [2, 2], eyes: 'focus', lean: 1 },
    { bodyDy: -1, squash: -0.2, legL: [0, 3], legR: [0, 3], eyes: 'focus', lean: 1 },
    { bodyDy: 0, squash: 0, legL: [2, 2], legR: [-2, 3], eyes: 'focus', lean: 1 },
    { bodyDy: -1, squash: -0.2, legL: [0, 3], legR: [0, 3], eyes: 'focus', lean: 1 },
  ],
  jump: [{ bodyDy: -1, squash: -0.4, legL: [-1, 2], legR: [1, 2], eyes: 'wide', lean: 0 }],
  fall: [{ bodyDy: 0, squash: -0.1, legL: [-1, 4], legR: [1, 4], eyes: 'open', lean: 0 }],
  attack: [{ bodyDy: 0, squash: 0.15, legL: [-2, 3], legR: [2, 3], eyes: 'focus', lean: 2 }],
  hurt: [{ bodyDy: 0, squash: 0.3, legL: [-1, 2], legR: [1, 2], eyes: 'shut', lean: -2 }],
};

export const HERO_ANIMS: Record<string, { frames: number[]; rate: number; repeat: number }> = {};

/** Draws one hero frame at (ox, oy) inside a HERO_FW x HERO_FH cell. */
export function drawHero(ctx: CanvasRenderingContext2D, ox: number, oy: number, body: number, pose: HeroPose, scale = 1) {
  const r = ramp(body);
  const ink = mix(r[0], 0x0b0714, 0.6);
  const bw = Math.round((22 + pose.squash * 3) * scale);
  const bh = Math.round((13 - pose.squash * 2) * scale);
  const legH = Math.round(pose.legL[1] * scale), legH2 = Math.round(pose.legR[1] * scale);
  const baseY = oy + HERO_FH * scale - 1;
  const by = baseY - Math.max(legH, legH2) - bh + Math.round(pose.bodyDy * scale);
  const bx = ox + Math.round((HERO_FW * scale - bw) / 2) + Math.round(pose.lean * scale * 0.5);
  const s = scale;
  // legs
  const legW = Math.max(2, Math.round(3 * s));
  const lx1 = bx + Math.round(5 * s) + Math.round(pose.legL[0] * s * 0.5);
  const lx2 = bx + bw - Math.round(5 * s) - legW + Math.round(pose.legR[0] * s * 0.5);
  const legTop = by + bh - 1;
  for (const [lx, lh] of [[lx1, legH], [lx2, legH2]] as const) {
    px(ctx, lx - 1, legTop, ink, legW + 2, lh + 2);
    px(ctx, lx, legTop, r[1], legW, lh + 1);
    px(ctx, lx, legTop, r[0], legW, Math.max(1, Math.round(s)));
  }
  // body outline (rounded corners)
  const c = Math.max(1, Math.round(s));
  px(ctx, bx + c, by - 1, ink, bw - 2 * c, 1);
  px(ctx, bx + c, by + bh, ink, bw - 2 * c, 1);
  px(ctx, bx - 1, by + c, ink, 1, bh - 2 * c);
  px(ctx, bx + bw, by + c, ink, 1, bh - 2 * c);
  for (let i = 0; i < c; i++) {
    px(ctx, bx + i, by + c - 1 - i, ink); px(ctx, bx + bw - 1 - i, by + c - 1 - i, ink);
    px(ctx, bx + i, by + bh - c + i, ink); px(ctx, bx + bw - 1 - i, by + bh - c + i, ink);
  }
  // body fill with soft vertical shading
  for (let y = 0; y < bh; y++) {
    const inset = y < c ? c - y : y >= bh - c ? y - (bh - c) + 1 : 0;
    const t = y / (bh - 1);
    const tone = t < 0.12 ? r[4] : t < 0.3 ? r[3] : t < 0.78 ? r[2] : r[1];
    px(ctx, bx + inset, by + y, tone, bw - inset * 2, 1);
  }
  // side shading: right edge darker, left edge lit
  px(ctx, bx + bw - Math.max(1, Math.round(1.5 * s)), by + c + 1, r[1], Math.max(1, Math.round(1.5 * s)), bh - 2 * c - 1);
  px(ctx, bx, by + c, r[3], 1, bh - 2 * c - Math.round(3 * s));
  // eyes
  const ew = Math.max(2, Math.round(2.4 * s)), eh = Math.max(3, Math.round(5 * s));
  const ey = by + Math.round(3 * s);
  const ex1 = bx + Math.round(bw * 0.56) + Math.round(pose.lean * s * 0.4);
  const ex2 = ex1 + Math.round(6 * s);
  for (const ex of [ex1, ex2]) {
    if (pose.eyes === 'blink') px(ctx, ex, ey + Math.floor(eh / 2), ink, ew, Math.max(1, Math.round(s)));
    else if (pose.eyes === 'shut') {
      px(ctx, ex, ey + 1, ink, ew, Math.max(1, Math.round(s)));
      px(ctx, ex + ew - 1, ey + 1 + Math.round(s), ink, 1, Math.max(1, Math.round(s)));
      px(ctx, ex, ey + 1 + Math.round(2 * s), ink, ew, Math.max(1, Math.round(s)));
    } else {
      const h = pose.eyes === 'wide' ? eh + Math.round(s) : pose.eyes === 'focus' ? eh - Math.round(s) : eh;
      const yy = pose.eyes === 'focus' ? ey + Math.round(s) : ey;
      px(ctx, ex, yy, ink, ew, h);
      if (s >= 2) px(ctx, ex, yy, 0xffffff, Math.max(1, Math.round(s * 0.9)), Math.max(1, Math.round(s * 0.9)));
      else px(ctx, ex, yy, mix(ink, 0xffffff, 0.75));
    }
  }
}

/** Builds a spritesheet for every ability body colour: key `hero_<abilityId>`. */
export function buildHeroSheets(scene: Phaser.Scene) {
  const order: [string, number][] = [];
  for (const k of Object.keys(POSES)) POSES[k].forEach((_, i) => order.push([k, i]));
  let idx = 0;
  for (const k of Object.keys(POSES)) {
    const n = POSES[k].length;
    HERO_ANIMS[k] = {
      frames: Array.from({ length: n }, (_, i) => idx + i),
      rate: k === 'run' ? 12 : k === 'idle' ? 3 : 1,
      repeat: k === 'idle' || k === 'run' ? -1 : 0,
    };
    idx += n;
  }
  const variants: [string, number][] = [['base', 0xf2ece0], ...ABILITIES.map((a) => [a.id, a.body] as [string, number])];
  for (const [id, color] of variants) {
    const [cv, ctx] = makeCanvas(HERO_FW * order.length, HERO_FH);
    order.forEach(([k, i], f) => drawHero(ctx, f * HERO_FW, 0, color, POSES[k][i]));
    const key = 'hero_' + id;
    addTex(scene, key, cv, HERO_FW, HERO_FH);
    for (const k of Object.keys(HERO_ANIMS)) {
      const a = HERO_ANIMS[k];
      const animKey = `${key}_${k}`;
      if (scene.anims.exists(animKey)) continue;
      const frames = k === 'idle'
        ? [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 2, 1].map((fi) => ({ key, frame: a.frames[fi] }))
        : a.frames.map((fr) => ({ key, frame: fr }));
      scene.anims.create({ key: animKey, frames, frameRate: k === 'idle' ? 5 : a.rate, repeat: a.repeat });
    }
  }
}

/** Large hero illustration used on cards, title and cut-ins (`heroBig_<id>`). */
export function buildHeroBig(scene: Phaser.Scene) {
  const variants: [string, number][] = [['base', 0xf2ece0], ...ABILITIES.map((a) => [a.id, a.body] as [string, number])];
  const pose: HeroPose = { bodyDy: 0, squash: 0, legL: [0, 3], legR: [0, 3], eyes: 'open', lean: 0 };
  for (const [id, color] of variants) {
    const S = 4;
    const [cv, ctx] = makeCanvas(HERO_FW * S, HERO_FH * S);
    drawHero(ctx, 0, 0, color, pose, S);
    addTex(scene, 'heroBig_' + id, cv);
  }
}
