// World 1 (Mossveil Forest) enemies, mid-bosses and the boss.
// Style: one flat-coloured geometric shape each, with square eyes and a mouth. No shading, no outlines.
import { addTex, makeCanvas, paintShapes, px, type Shape } from './pixel';

type FrameFn = (ctx: CanvasRenderingContext2D, ox: number, oy: number, f: number) => void;

const INK = 0x161216;

function sheet(scene: Phaser.Scene, key: string, fw: number, fh: number, n: number, draw: FrameFn) {
  const [cv, ctx] = makeCanvas(fw * n, fh);
  for (let f = 0; f < n; f++) draw(ctx, f * fw, 0, f);
  addTex(scene, key, cv, fw, fh);
}

function anim(scene: Phaser.Scene, key: string, tex: string, frames: number[], rate: number, repeat = -1) {
  if (scene.anims.exists(key)) scene.anims.remove(key);
  scene.anims.create({ key, frames: frames.map((frame) => ({ key: tex, frame })), frameRate: rate, repeat });
}

const flat = (ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number, shapes: Shape[]) =>
  paintShapes(ctx, ox, oy, w, h, shapes, { outline: null, selout: false, dither: false, flat: true });

type Face = 'open' | 'shut' | 'wide' | 'angry';
/** Two square eyes at (x, y) and (x + gap, y). */
function eyes(ctx: CanvasRenderingContext2D, x: number, y: number, gap: number, size: number, face: Face = 'open', c = INK) {
  for (const ex of [x, x + gap]) {
    if (face === 'shut') px(ctx, ex - 1, y + Math.floor(size / 2), c, size + 2, Math.max(1, Math.floor(size / 3)));
    else if (face === 'wide') px(ctx, ex, y - 1, c, size, size + 2);
    else px(ctx, ex, y, c, size, size);
  }
  if (face === 'angry') {
    const t = Math.max(1, Math.floor(size / 3));
    px(ctx, x - 1, y - t - 1, c, size + 1, t);
    px(ctx, x + gap, y - t - 1, c, size + 1, t);
  }
}
/** A mouth: a flat line, or an open rectangle. */
function mouth(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, open = 0, c = INK) {
  px(ctx, x, y, c, w, Math.max(1, open || 1));
}

export function buildEnemies(scene: Phaser.Scene) {
  // ---------------- Sproutling -> purple triangle that hops and lunges. 28x28: walk0-3, wind, lunge, hurt
  sheet(scene, 'en_sprout', 28, 28, 7, (ctx, ox, oy, f) => {
    const C = 0x8a5cd8;
    const walk = f < 4 ? f : 0;
    const bob = f < 4 ? [0, -1, 0, -1][walk] : 0;
    const wide = f === 4 ? 2 : f === 6 ? 1 : 0;
    const lean = f === 5 ? 4 : f === 6 ? -2 : 0;
    const leg = f < 4 ? [-1, 0, 1, 0][walk] : 0;
    const top = 5 + bob + (f === 4 ? 3 : 0);
    flat(ctx, ox, oy, 28, 28, [
      { k: 'tri', pts: [3 - wide, 24 + bob, 14 + lean, top, 25 + wide, 24 + bob], c: C },
      { k: 'rect', x: 8 + leg, y: 23 + bob, w: 3, h: 4 - bob, c: C },
      { k: 'rect', x: 17 - leg, y: 23 + bob, w: 3, h: 4 - bob, c: C },
    ]);
    const face: Face = f === 6 ? 'shut' : f === 4 ? 'angry' : f === 5 ? 'wide' : 'open';
    eyes(ctx, ox + 14 + Math.round(lean / 2), oy + 15 + bob, 5, 2, face);
    mouth(ctx, ox + 15 + Math.round(lean / 2), oy + 20 + bob, f === 5 ? 3 : 4, f === 5 ? 2 : 1);
  });
  anim(scene, 'sprout_walk', 'en_sprout', [0, 1, 2, 3], 8);

  // ---------------- Mothling -> blue round blob with two flapping square wings. 32x26: flap0-2, dive, hurt
  sheet(scene, 'en_moth', 32, 26, 5, (ctx, ox, oy, f) => {
    const C = 0x3f9cf0, Wg = 0x8fd0ff;
    const wy = [0, -5, 3, -6, 1][f];
    flat(ctx, ox, oy, 32, 26, [
      { k: 'rect', x: 1, y: 9 + wy, w: 9, h: 7, c: Wg },
      { k: 'rect', x: 22, y: 9 + wy, w: 9, h: 7, c: Wg },
      { k: 'ell', x: 16, y: 14, rx: 8.5, ry: 8.5, c: C, z: 1 },
    ]);
    const face: Face = f === 4 ? 'shut' : f === 3 ? 'angry' : 'open';
    eyes(ctx, ox + 14, oy + 11, 5, 2, face);
    mouth(ctx, ox + 15, oy + 16, f === 3 ? 3 : 3, f === 3 ? 2 : 1);
  });
  anim(scene, 'moth_fly', 'en_moth', [0, 1, 0, 2], 12);

  // ---------------- Sporecap -> pink box turret on a stand; mouth opens to spit seeds. 28x32: idle0-1, charge, shoot, hurt
  sheet(scene, 'en_spore', 28, 32, 5, (ctx, ox, oy, f) => {
    const C = 0xe8507e;
    const sq = f === 2 ? 2 : f === 3 ? -2 : 0;
    const sway = f === 1 ? 1 : 0;
    const top = 7 + sq;
    flat(ctx, ox, oy, 28, 32, [
      { k: 'rect', x: 6 + sway - Math.max(0, sq), y: top, w: 16 + Math.max(0, sq) * 2, h: 17 - sq, c: C },
      { k: 'rect', x: 12, y: 23, w: 4, h: 6, c: C },
      { k: 'rect', x: 7, y: 28, w: 14, h: 3, c: C },
    ]);
    const face: Face = f === 4 ? 'shut' : f === 2 ? 'angry' : 'open';
    eyes(ctx, ox + 8 + sway, oy + top + 4, 6, 2, face);
    mouth(ctx, ox + 8 + sway, oy + top + 10, f === 3 ? 6 : 4, f === 3 ? 4 : f === 2 ? 2 : 1);
  });
  anim(scene, 'spore_idle', 'en_spore', [0, 1], 3);

  // ---------------- Bulwark beetle -> navy half-dome with a flat steel shield in front. 36x26: walk0-1, charge, stun, hurt
  sheet(scene, 'en_beetle', 36, 26, 5, (ctx, ox, oy, f) => {
    const C = 0x34508f, S = 0xb8c8e0;
    const step = f === 1 ? 1 : 0;
    const low = f === 2 ? 2 : 0;
    flat(ctx, ox, oy, 36, 26, [
      { k: 'ell', x: 16, y: 21, rx: 13, ry: 13, c: C },
      { k: 'rect', x: 7 + step, y: 20, w: 3, h: 5, c: C },
      { k: 'rect', x: 21 - step, y: 20, w: 3, h: 5, c: C },
      { k: 'rect', x: 28, y: 8 + low, w: 5, h: 14, c: S, z: 1 },
    ]);
    // cut the dome flat at the bottom, then put the legs back
    ctx.clearRect(ox, oy + 21, 36, 5);
    flat(ctx, ox, oy, 36, 26, [
      { k: 'rect', x: 7 + step, y: 20, w: 3, h: 5, c: C },
      { k: 'rect', x: 21 - step, y: 20, w: 3, h: 5, c: C },
    ]);
    const face: Face = f === 3 || f === 4 ? 'shut' : f === 2 ? 'angry' : 'open';
    eyes(ctx, ox + 17, oy + 12 + low, 5, 2, face, 0xffffff);
    mouth(ctx, ox + 18, oy + 17 + low, 4, 1, 0xffffff);
  });
  anim(scene, 'beetle_walk', 'en_beetle', [0, 1], 5);

  // ---------------- Mid-boss: Moss Golem -> big grey block with blocky arms and four legs. 72x72: idle0-1, raise, slam, throw, hurt
  sheet(scene, 'mb_golem', 72, 72, 6, (ctx, ox, oy, f) => {
    const C = 0x8e8aa0;
    const br = f === 1 ? 1 : 0;
    const arm = f === 2 ? -16 : f === 3 ? 8 : f === 4 ? -10 : 0;
    const crouch = f === 3 ? 4 : 0;
    const by = 18 + br + crouch;
    flat(ctx, ox, oy, 72, 72, [
      { k: 'rect', x: 16, y: by, w: 40, h: 44 - br - crouch, c: C },
      { k: 'rect', x: 6, y: by + 14 + arm, w: 10, h: 12, c: C },
      { k: 'rect', x: 56, y: by + 14 + arm, w: 10, h: 12, c: C },
      { k: 'rect', x: 18, y: 61, w: 6, h: 11, c: C },
      { k: 'rect', x: 28, y: 61, w: 6, h: 11, c: C },
      { k: 'rect', x: 38, y: 61, w: 6, h: 11, c: C },
      { k: 'rect', x: 48, y: 61, w: 6, h: 11, c: C },
    ]);
    const face: Face = f === 5 ? 'shut' : f === 2 || f === 4 ? 'angry' : 'open';
    eyes(ctx, ox + 30, oy + by + 10, 14, 5, face);
    mouth(ctx, ox + 32, oy + by + 24, f === 3 ? 12 : 10, f === 2 || f === 3 ? 4 : 2);
  });
  anim(scene, 'golem_idle', 'mb_golem', [0, 1], 2);

  // ---------------- Mid-boss: Bladed Mantis -> green diamond on stilts with one long blade arm. 64x60: idle0-1, windup, slash, leap, hurt
  sheet(scene, 'mb_mantis', 64, 60, 6, (ctx, ox, oy, f) => {
    const C = 0x4cc35a, B = 0xe6f2e6;
    const b = f === 1 ? 1 : 0;
    const crouch = f === 4 ? 5 : f === 2 ? 2 : 0;
    const cy = 30 + b + crouch;
    // blade: up on windup, forward on slash, resting otherwise
    const [bx2, by2] = f === 2 ? [40, 2] : f === 3 ? [63, cy + 4] : [52, cy - 14];
    flat(ctx, ox, oy, 64, 60, [
      { k: 'tri', pts: [14, cy, 30, cy - 20, 46, cy], c: C },
      { k: 'tri', pts: [14, cy, 30, cy + 16, 46, cy], c: C },
      { k: 'rect', x: 22, y: cy + 8, w: 3, h: 60 - cy - 8, c: C },
      { k: 'rect', x: 35, y: cy + 8, w: 3, h: 60 - cy - 8, c: C },
      { k: 'cap', x1: 40, y1: cy - 2, x2: bx2, y2: by2, r: 1.6, c: B, z: 1 },
    ]);
    const face: Face = f === 5 ? 'shut' : f === 2 || f === 3 ? 'angry' : 'open';
    eyes(ctx, ox + 29, oy + cy - 5, 6, 3, face);
    mouth(ctx, ox + 31, oy + cy + 2, 5, f === 3 ? 2 : 1);
  });
  anim(scene, 'mantis_idle', 'mb_mantis', [0, 1], 4);

  // ---------------- Boss: Elderwood -> brown block trunk with a big flat round crown. 120x128: idle0-1, roar, hurt, enraged0-1
  sheet(scene, 'boss_tree', 120, 128, 6, (ctx, ox, oy, f) => {
    const rage = f >= 4;
    const b = f === 1 || f === 5 ? 2 : 0;
    const crown = rage ? 0xe8703a : 0x4cb84a;
    const trunk = 0x8a5a3a;
    flat(ctx, ox, oy, 120, 128, [
      { k: 'rect', x: 34, y: 48 + b, w: 52, h: 80 - b, c: trunk },
      { k: 'ell', x: 60, y: 34 + b, rx: 52, ry: 32, c: crown, z: 1 },
    ]);
    const face: Face = f === 3 ? 'shut' : rage || f === 2 ? 'angry' : 'open';
    eyes(ctx, ox + 44, oy + 74 + b, 24, 8, face);
    mouth(ctx, ox + 50, oy + 96 + b, 20, f === 2 ? 12 : rage ? 6 : 3);
  });
  anim(scene, 'tree_idle', 'boss_tree', [0, 1], 2);
  anim(scene, 'tree_rage', 'boss_tree', [4, 5], 4);

  // Boss arm: flat log with a square fist
  sheet(scene, 'boss_arm', 48, 40, 2, (ctx, ox, oy, f) => {
    const c = f ? 0xa0502a : 0x8a5a3a;
    flat(ctx, ox, oy, 48, 40, [
      { k: 'cap', x1: 6, y1: 8, x2: 32, y2: 26, r: 6, c },
      { k: 'rect', x: 28, y: 20, w: 18, h: 18, c },
    ]);
  });

  // projectiles: plain shapes
  sheet(scene, 'pr_seed', 10, 10, 1, (ctx, ox, oy) => flat(ctx, ox, oy, 10, 10, [{ k: 'ell', x: 5, y: 5, rx: 3.5, ry: 3.5, c: 0xc8e05a }]));
  sheet(scene, 'pr_rock', 18, 18, 1, (ctx, ox, oy) => flat(ctx, ox, oy, 18, 18, [{ k: 'rect', x: 2, y: 2, w: 14, h: 14, c: 0x8e8aa0 }]));
  sheet(scene, 'pr_thorn', 12, 24, 1, (ctx, ox, oy) => flat(ctx, ox, oy, 12, 24, [{ k: 'tri', pts: [1, 24, 6, 0, 11, 24], c: 0x8a5a3a }]));
}
