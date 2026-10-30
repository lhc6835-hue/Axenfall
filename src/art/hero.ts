// The hero: a wide rectangle with two eyes and two short legs. Nothing else.
import { ABILITIES } from '../data/abilities';
import { addTex, makeCanvas, px } from './pixel';

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

/** Draws one hero frame at (ox, oy): one flat-coloured wide rectangle, two square eyes, two short legs. */
export function drawHero(ctx: CanvasRenderingContext2D, ox: number, oy: number, body: number, pose: HeroPose, scale = 1) {
  const s = scale;
  const [r, g, b] = [(body >> 16) & 255, (body >> 8) & 255, body & 255];
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const eyeC = lum < 0.3 ? 0xffffff : 0x161216;
  const bw = Math.round((22 + pose.squash * 3) * s);
  const bh = Math.round((13 - pose.squash * 2) * s);
  const legH = Math.max(1, Math.round(pose.legL[1] * s)), legH2 = Math.max(1, Math.round(pose.legR[1] * s));
  const baseY = oy + HERO_FH * s;
  const by = baseY - Math.max(legH, legH2) - bh + Math.round(pose.bodyDy * s);
  const bx = ox + Math.round((HERO_FW * s - bw) / 2) + Math.round(pose.lean * s * 0.5);
  // legs
  const legW = Math.max(2, Math.round(3 * s));
  const lx1 = bx + Math.round(4 * s) + Math.round(pose.legL[0] * s * 0.5);
  const lx2 = bx + bw - Math.round(4 * s) - legW + Math.round(pose.legR[0] * s * 0.5);
  px(ctx, lx1, by + bh - 1, body, legW, baseY - by - bh + 1 - (Math.max(legH, legH2) - legH));
  px(ctx, lx2, by + bh - 1, body, legW, baseY - by - bh + 1 - (Math.max(legH, legH2) - legH2));
  // body with softly rounded corners
  const cr = Math.max(1, Math.round(1.5 * s));
  for (let y = 0; y < bh; y++) {
    const d = y < cr ? cr - y - 0.5 : y >= bh - cr ? y - (bh - cr) + 0.5 : 0;
    const inset = d ? Math.round(cr - Math.sqrt(Math.max(0, cr * cr - d * d))) : 0;
    px(ctx, bx + inset, by + y, body, bw - inset * 2, 1);
  }
  // face: wide-set eyes, one long flat mouth, shifted a little toward the facing side
  const cx = bx + bw * 0.56 + pose.lean * s * 0.4;
  drawFace(ctx, cx, by + Math.round(3 * s), bw * 0.64, s, pose.eyes, eyeC);
}

/** Shared dopey face: two small eyes set far apart and a long straight mouth between/below them. */
export function drawFace(ctx: CanvasRenderingContext2D, cx: number, eyeY: number, spread: number, s: number, eyes: HeroPose['eyes'] | 'open', c: number) {
  const one = Math.max(1, Math.round(s));
  const ew = Math.max(2, Math.round(2 * s)), eh = Math.max(2, Math.round(3 * s));
  const xs = [Math.round(cx - spread / 2 - ew / 2), Math.round(cx + spread / 2 - ew / 2)];
  for (const ex of xs) {
    if (eyes === 'blink') px(ctx, ex, eyeY + eh - one, c, ew, one);
    else if (eyes === 'shut') px(ctx, ex - one, eyeY + one, c, ew + one * 2, one);
    else px(ctx, ex, eyeY, c, ew, eh);
  }
  const mw = Math.max(4, Math.round(spread * 0.62));
  px(ctx, Math.round(cx - mw / 2), eyeY + eh + Math.max(2, Math.round(2 * s)), c, mw, one);
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
