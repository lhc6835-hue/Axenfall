// World 1 (Mossveil Forest) enemies, mid-bosses and the boss.
// Style: one flat-coloured geometric shape each, with square eyes and a mouth. No shading, no outlines.
import { addTex, makeCanvas, paintShapes, px, type Shape } from './pixel';
import { drawFace } from './hero';

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

type Face = 'open' | 'shut';
/** Every creature shares the same dopey face: wide-set eyes and one long straight mouth. */
const face = (ctx: CanvasRenderingContext2D, cx: number, eyeY: number, spread: number, s: number, f: Face, c = INK) => drawFace(ctx, cx, eyeY, spread, s, f, c);

export function buildEnemies(scene: Phaser.Scene) {
  // ---------------- Sproutling -> purple triangle on tiny legs. 28x28: walk0-3, wind, lunge, hurt
  sheet(scene, 'en_sprout', 28, 28, 7, (ctx, ox, oy, f) => {
    const C = 0x8a5cd8;
    const walk = f < 4 ? f : 0;
    const bob = f < 4 ? [0, -1, 0, -1][walk] : 0;
    const wide = f === 4 ? 2 : f === 6 ? 1 : 0;
    const lean = f === 5 ? 3 : f === 6 ? -2 : 0;
    const leg = f < 4 ? [-1, 0, 1, 0][walk] : 0;
    const top = 4 + bob + (f === 4 ? 3 : 0);
    flat(ctx, ox, oy, 28, 28, [
      { k: 'tri', pts: [2 - wide, 24 + bob, 14 + lean, top, 26 + wide, 24 + bob], c: C },
      { k: 'rect', x: 8 + leg, y: 23 + bob, w: 3, h: 4 - bob, c: C },
      { k: 'rect', x: 17 - leg, y: 23 + bob, w: 3, h: 4 - bob, c: C },
    ]);
    face(ctx, ox + 14.5 + lean * 0.6, oy + 16 + bob, 11 + wide, 1, f === 6 ? 'shut' : 'open');
  });
  anim(scene, 'sprout_walk', 'en_sprout', [0, 1, 2, 3], 8);

  // ---------------- Mothling -> blue round blob with two flapping wings. 32x26: flap0-2, dive, hurt
  sheet(scene, 'en_moth', 32, 26, 5, (ctx, ox, oy, f) => {
    const C = 0x3f9cf0, Wg = 0x8fd0ff;
    const wy = [0, -5, 3, -6, 1][f];
    flat(ctx, ox, oy, 32, 26, [
      { k: 'rect', x: 0, y: 8 + wy, w: 9, h: 7, c: Wg, r: 2 },
      { k: 'rect', x: 23, y: 8 + wy, w: 9, h: 7, c: Wg, r: 2 },
      { k: 'ell', x: 16, y: 14, rx: 9.5, ry: 9, c: C, z: 1 },
    ]);
    face(ctx, ox + 17, oy + 10, 11, 1, f === 4 ? 'shut' : 'open');
  });
  anim(scene, 'moth_fly', 'en_moth', [0, 1, 0, 2], 12);

  // ---------------- Sporecap -> pink rounded box on a stand. 28x32: idle0-1, charge, shoot, hurt
  sheet(scene, 'en_spore', 28, 32, 5, (ctx, ox, oy, f) => {
    const C = 0xe8507e;
    const sq = f === 2 ? 2 : f === 3 ? -2 : 0;
    const sway = f === 1 ? 1 : 0;
    const top = 7 + sq;
    flat(ctx, ox, oy, 28, 32, [
      { k: 'rect', x: 5 + sway - Math.max(0, sq), y: top, w: 18 + Math.max(0, sq) * 2, h: 17 - sq, c: C, r: 3 },
      { k: 'rect', x: 12, y: 22, w: 4, h: 7, c: C },
      { k: 'rect', x: 7, y: 28, w: 14, h: 3, c: C, r: 1 },
    ]);
    face(ctx, ox + 13 + sway, oy + top + 4, 12, 1, f === 4 ? 'shut' : 'open');
  });
  anim(scene, 'spore_idle', 'en_spore', [0, 1], 3);

  // ---------------- Bulwark beetle -> navy half-dome with a steel shield in front. 36x26: walk0-1, charge, stun, hurt
  sheet(scene, 'en_beetle', 36, 26, 5, (ctx, ox, oy, f) => {
    const C = 0x34508f, S = 0xb8c8e0;
    const step = f === 1 ? 1 : 0;
    const low = f === 2 ? 2 : 0;
    flat(ctx, ox, oy, 36, 26, [
      { k: 'ell', x: 16, y: 21, rx: 14, ry: 14, c: C },
      { k: 'rect', x: 28, y: 8 + low, w: 5, h: 13, c: S, z: 1, r: 1 },
    ]);
    ctx.clearRect(ox, oy + 21, 36, 5); // cut the dome flat, then legs
    flat(ctx, ox, oy, 36, 26, [
      { k: 'rect', x: 7 + step, y: 20, w: 3, h: 5, c: C },
      { k: 'rect', x: 21 - step, y: 20, w: 3, h: 5, c: C },
    ]);
    face(ctx, ox + 17, oy + 12 + low, 13, 1, f === 3 || f === 4 ? 'shut' : 'open', 0xffffff);
  });
  anim(scene, 'beetle_walk', 'en_beetle', [0, 1], 5);

  // ---------------- Mid-boss: Moss Golem -> big grey rounded block with arms and four legs. 72x72: idle0-1, raise, slam, throw, hurt
  sheet(scene, 'mb_golem', 72, 72, 6, (ctx, ox, oy, f) => {
    const C = 0x8e8aa0;
    const br = f === 1 ? 1 : 0;
    const arm = f === 2 ? -16 : f === 3 ? 8 : f === 4 ? -10 : 0;
    const crouch = f === 3 ? 4 : 0;
    const by = 18 + br + crouch;
    flat(ctx, ox, oy, 72, 72, [
      { k: 'rect', x: 15, y: by, w: 42, h: 45 - br - crouch, c: C, r: 5 },
      { k: 'rect', x: 5, y: by + 14 + arm, w: 11, h: 13, c: C, r: 3 },
      { k: 'rect', x: 56, y: by + 14 + arm, w: 11, h: 13, c: C, r: 3 },
      { k: 'rect', x: 18, y: 60, w: 6, h: 12, c: C },
      { k: 'rect', x: 28, y: 60, w: 6, h: 12, c: C },
      { k: 'rect', x: 38, y: 60, w: 6, h: 12, c: C },
      { k: 'rect', x: 48, y: 60, w: 6, h: 12, c: C },
    ]);
    face(ctx, ox + 37, oy + by + 10, 28, 2, f === 5 ? 'shut' : 'open');
  });
  anim(scene, 'golem_idle', 'mb_golem', [0, 1], 2);

  // ---------------- Mid-boss: Bladed Mantis -> green diamond on stilts with one long blade arm. 64x60: idle0-1, windup, slash, leap, hurt
  sheet(scene, 'mb_mantis', 64, 60, 6, (ctx, ox, oy, f) => {
    const C = 0x4cc35a, B = 0xe6f2e6;
    const b = f === 1 ? 1 : 0;
    const crouch = f === 4 ? 5 : f === 2 ? 2 : 0;
    const cy = 30 + b + crouch;
    const [bx2, by2] = f === 2 ? [40, 2] : f === 3 ? [63, cy + 4] : [52, cy - 14];
    flat(ctx, ox, oy, 64, 60, [
      { k: 'tri', pts: [12, cy, 30, cy - 20, 48, cy], c: C },
      { k: 'tri', pts: [12, cy, 30, cy + 16, 48, cy], c: C },
      { k: 'rect', x: 22, y: cy + 8, w: 3, h: 60 - cy - 8, c: C },
      { k: 'rect', x: 35, y: cy + 8, w: 3, h: 60 - cy - 8, c: C },
      { k: 'cap', x1: 44, y1: cy + 3, x2: bx2, y2: by2, r: 1.6, c: B, z: 1 },
    ]);
    face(ctx, ox + 31, oy + cy - 6, 17, 1.4, f === 5 ? 'shut' : 'open');
  });
  anim(scene, 'mantis_idle', 'mb_mantis', [0, 1], 4);

  // ---------------- Boss: Elderwood, the Hollow King -> fully illustrated, shaded tree with the same dopey face.
  // 120x128: idle0-1, roar, hurt, enraged0-1
  sheet(scene, 'boss_tree', 120, 128, 6, (ctx, ox, oy, f) => {
    const rage = f >= 4;
    const b = f === 1 || f === 5 ? 2 : 0;
    const shake = f === 2 ? 2 : 0;
    const bark = 0x7a5236, barkDark = 0x5a3a26;
    const [ld, lm, ll] = rage ? [0x9a3a1a, 0xd8602a, 0xf0a040] : [0x2f7a3a, 0x4fa040, 0x8ad05a];
    const sh: Shape[] = [
      // roots
      { k: 'cap', x1: 40, y1: 110, x2: 18, y2: 126, r: 6, r2: 2.5, c: bark },
      { k: 'cap', x1: 80, y1: 110, x2: 103, y2: 126, r: 6, r2: 2.5, c: bark },
      { k: 'cap', x1: 50, y1: 116, x2: 40, y2: 127, r: 4, r2: 2, c: bark },
      { k: 'cap', x1: 70, y1: 116, x2: 82, y2: 127, r: 4, r2: 2, c: bark },
      // trunk
      { k: 'rect', x: 34, y: 46 + b, w: 52, h: 80 - b, c: bark, r: 9, z: 1 },
      { k: 'ell', x: 80, y: 108, rx: 4, ry: 5, c: barkDark, z: 2 },
      { k: 'ell', x: 42, y: 58 + b, rx: 9, ry: 4, c: 0x6a9a4a, z: 2 },
      { k: 'ell', x: 83, y: 94, rx: 5, ry: 3, c: 0x6a9a4a, z: 2 },
      { k: 'ell', x: 38, y: 118, rx: 6, ry: 3, c: 0x6a9a4a, z: 2 },
      // crown: dark mass with overlapping leaf clusters (upper ones lighter), plus side vines
      { k: 'ell', x: 60 + shake, y: 34 + b, rx: 56, ry: 28, c: ld, z: 3 },
      ...([[18, 44, 18, 13], [102, 44, 18, 13], [34, 54, 18, 8], [86, 54, 18, 8], [60, 50, 26, 10], [36, 30, 22, 15], [84, 30, 22, 15]] as const)
        .map(([x, y, rx, ry]) => ({ k: 'ell', x: x + shake, y: y + b, rx, ry, c: lm, z: 4 }) as Shape),
      ...([[44, 14, 20, 12], [78, 12, 20, 12], [60, 24, 18, 11], [20, 30, 12, 9], [100, 30, 12, 9]] as const)
        .map(([x, y, rx, ry]) => ({ k: 'ell', x: x + shake, y: y + b, rx, ry, c: ll, z: 5 }) as Shape),
      { k: 'cap', x1: 14, y1: 52 + b, x2: 13, y2: 72 + b, r: 1.3, c: lm, z: 6 },
      { k: 'cap', x1: 106, y1: 50 + b, x2: 107, y2: 66 + b, r: 1.3, c: lm, z: 6 },
      { k: 'cap', x1: 24, y1: 56 + b, x2: 25, y2: 66 + b, r: 1.2, c: lm, z: 6 },
    ];
    paintShapes(ctx, ox, oy, 120, 128, sh);
    // bark grooves (kept away from the face)
    // leaf texture: little two-pixel leaves scattered over the crown
    for (let i = 0; i < 260; i++) {
      const x = 6 + ((i * 53) % 108), y = 6 + ((i * 29 + (i >> 3) * 7) % 54);
      const dx = (x - 60) / 56, dy = (y - 34) / 28;
      if (dx * dx + dy * dy > 0.92) continue;
      px(ctx, ox + x + shake, oy + y + b, i % 3 ? ld : ll, 2, 1);
    }
    for (const [x, y0, y1] of [[39, 96, 122], [47, 100, 124], [73, 100, 124], [66, 110, 124], [52, 64, 72], [70, 63, 71]] as const) {
      for (let y = y0; y < y1; y++) px(ctx, ox + x + (Math.floor(y / 7) % 2), oy + y + b * (y < 90 ? 1 : 0), barkDark);
    }
    if (rage) for (let i = 0; i < 10; i++) px(ctx, ox + 14 + ((i * 37) % 92), oy + 6 + ((i * 23) % 50), 0xffd166, 2, 2);
    face(ctx, ox + 60, oy + 77 + b, 36, 3, f === 3 ? 'shut' : 'open');
  });
  anim(scene, 'tree_idle', 'boss_tree', [0, 1], 2);
  anim(scene, 'tree_rage', 'boss_tree', [4, 5], 4);

  // Boss arm: shaded branch with twig fingers and a leaf tuft
  sheet(scene, 'boss_arm', 48, 40, 2, (ctx, ox, oy, f) => {
    const c = 0x7a5236;
    paintShapes(ctx, ox, oy, 48, 40, [
      { k: 'cap', x1: 5, y1: 7, x2: 33, y2: 25, r: 6, r2: 5, c },
      { k: 'cap', x1: 33, y1: 25, x2: 44, y2: 37, r: 2.5, r2: 1.5, c, z: 1 },
      { k: 'cap', x1: 32, y1: 26, x2: 33, y2: 39, r: 2.5, r2: 1.5, c, z: 1 },
      { k: 'cap', x1: 34, y1: 24, x2: 46, y2: 26, r: 2.2, r2: 1.4, c, z: 1 },
      { k: 'ell', x: 16, y: 8, rx: 8, ry: 5, c: f ? 0xd8602a : 0x4fa040, z: 2 },
      { k: 'ell', x: 14, y: 6, rx: 4, ry: 2.5, c: f ? 0xf0a040 : 0x8ad05a, z: 3 },
    ]);
  });

  // projectiles
  sheet(scene, 'pr_seed', 10, 10, 1, (ctx, ox, oy) => flat(ctx, ox, oy, 10, 10, [{ k: 'ell', x: 5, y: 5, rx: 3.5, ry: 3.5, c: 0xc8e05a }]));
  sheet(scene, 'pr_rock', 18, 18, 1, (ctx, ox, oy) => flat(ctx, ox, oy, 18, 18, [{ k: 'rect', x: 2, y: 2, w: 14, h: 14, c: 0x8e8aa0, r: 3 }]));
  sheet(scene, 'pr_thorn', 12, 24, 1, (ctx, ox, oy) => paintShapes(ctx, ox, oy, 12, 24, [{ k: 'tri', pts: [1, 24, 6, 0, 11, 24], c: 0x7a5236 }, { k: 'tri', pts: [4, 24, 6, 8, 8, 24], c: 0x9a6a46, z: 1 }]));
}
