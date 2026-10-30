// World 1 (Mossveil Forest) enemies, mid-bosses and the boss, painted procedurally.
import { addTex, makeCanvas, paintShapes, px, type Shape } from './pixel';

type FrameFn = (ctx: CanvasRenderingContext2D, ox: number, oy: number, f: number) => void;

function sheet(scene: Phaser.Scene, key: string, fw: number, fh: number, n: number, draw: FrameFn) {
  const [cv, ctx] = makeCanvas(fw * n, fh);
  for (let f = 0; f < n; f++) draw(ctx, f * fw, 0, f);
  addTex(scene, key, cv, fw, fh);
}

function anim(scene: Phaser.Scene, key: string, tex: string, frames: number[], rate: number, repeat = -1) {
  if (scene.anims.exists(key)) scene.anims.remove(key);
  scene.anims.create({ key, frames: frames.map((frame) => ({ key: tex, frame })), frameRate: rate, repeat });
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, c: number, w = 2, h = 2) {
  px(ctx, x - 1, y - 1, 0x0b0714, w + 2, h + 2);
  px(ctx, x, y, c, w, h);
  px(ctx, x, y, 0xffffff, 1, 1);
}

export function buildEnemies(scene: Phaser.Scene) {
  // ---------------- Sproutling: walking bulb with a leaf, lunges at you. 28x28, frames: walk0-3, wind, lunge, hurt
  sheet(scene, 'en_sprout', 28, 28, 7, (ctx, ox, oy, f) => {
    const walk = f < 4 ? f : 0;
    const bob = f < 4 ? [0, -1, 0, -1][walk] : 0;
    const sq = f === 4 ? 2 : f === 5 ? -2 : f === 6 ? 1 : 0;
    const lean = f === 5 ? 3 : f === 6 ? -2 : 0;
    const legA = f < 4 ? [-2, 0, 2, 0][walk] : f === 5 ? 3 : 0;
    const s: Shape[] = [
      { k: 'ell', x: 9 + legA * 0.5 + lean * 0.3, y: 25, rx: 3, ry: 2, c: 0x4a3226 },
      { k: 'ell', x: 18 - legA * 0.5 + lean * 0.3, y: 25, rx: 3, ry: 2, c: 0x4a3226 },
      { k: 'ell', x: 14 + lean, y: 17 + bob + sq * 0.5, rx: 9 + sq * 0.6, ry: 8 - sq * 0.5, c: 0x6cc24a },
      { k: 'ell', x: 14 + lean, y: 21 + bob, rx: 6, ry: 3, c: 0xa8e07a, z: 1, flat: true },
      { k: 'cap', x1: 14 + lean, y1: 10 + bob, x2: 16 + lean, y2: 5 + bob, r: 1, c: 0x3d8a3a, z: 2 },
      { k: 'ell', x: 20 + lean, y: 5 + bob, rx: 5, ry: 2.5, c: 0x8de05a, z: 3, rot: -0.4 },
      { k: 'ell', x: 11 + lean, y: 6 + bob, rx: 4, ry: 2, c: 0x6cc24a, z: 3, rot: 0.5 },
    ];
    paintShapes(ctx, ox, oy, 28, 28, s);
    const ec = f === 6 ? 0xffffff : 0xfff3a0;
    eye(ctx, ox + 15 + lean, oy + 14 + bob, ec, 2, f === 6 ? 1 : 3);
    eye(ctx, ox + 20 + lean, oy + 14 + bob, ec, 2, f === 6 ? 1 : 3);
  });
  anim(scene, 'sprout_walk', 'en_sprout', [0, 1, 2, 3], 8);

  // ---------------- Mothling: flying dusty moth, swoops. 32x26, frames: flap0-2, dive, hurt
  sheet(scene, 'en_moth', 32, 26, 5, (ctx, ox, oy, f) => {
    const wingY = [0, -5, 4, -3, 2][f];
    const s: Shape[] = [
      { k: 'ell', x: 9, y: 10 + wingY * 0.6, rx: 8, ry: 6 - Math.abs(wingY) * 0.3, c: 0xb48ad8, rot: -0.3 - wingY * 0.05 },
      { k: 'ell', x: 23, y: 10 + wingY * 0.6, rx: 8, ry: 6 - Math.abs(wingY) * 0.3, c: 0xb48ad8, rot: 0.3 + wingY * 0.05 },
      { k: 'ell', x: 9, y: 11 + wingY * 0.6, rx: 3, ry: 2, c: 0xffd27a, z: 1, flat: true },
      { k: 'ell', x: 23, y: 11 + wingY * 0.6, rx: 3, ry: 2, c: 0xffd27a, z: 1, flat: true },
      { k: 'ell', x: 16, y: 15, rx: 5, ry: 7, c: 0x7a5aa8, z: 2 },
      { k: 'ell', x: 16, y: 9, rx: 4.5, ry: 4, c: 0xd8c8f0, z: 3 },
    ];
    paintShapes(ctx, ox, oy, 32, 26, s);
    eye(ctx, ox + 13, oy + 8, f === 4 ? 0xffffff : 0xff5a8a);
    eye(ctx, ox + 18, oy + 8, f === 4 ? 0xffffff : 0xff5a8a);
    px(ctx, ox + 13, oy + 2, 0x3a2a50, 1, 3); px(ctx, ox + 19, oy + 2, 0x3a2a50, 1, 3);
    px(ctx, ox + 12, oy + 1, 0x3a2a50, 1, 1); px(ctx, ox + 20, oy + 1, 0x3a2a50, 1, 1);
  });
  anim(scene, 'moth_fly', 'en_moth', [0, 1, 0, 2], 12);

  // ---------------- Sporecap: rooted flower turret that spits seeds. 28x32, frames: idle0-1, charge, shoot, hurt
  sheet(scene, 'en_spore', 28, 32, 5, (ctx, ox, oy, f) => {
    const sq = f === 2 ? 2 : f === 3 ? -2 : 0;
    const sway = [0, 1, 0, 0, -1][f];
    const s: Shape[] = [
      { k: 'ell', x: 14, y: 29, rx: 9, ry: 3, c: 0x5a3c2a },
      { k: 'cap', x1: 14, y1: 28, x2: 14 + sway, y2: 15, r: 2.5, c: 0x4fa040, z: 1 },
      { k: 'ell', x: 8, y: 23, rx: 5, ry: 2, c: 0x6cc24a, z: 2, rot: 0.5 },
      { k: 'ell', x: 20, y: 22, rx: 5, ry: 2, c: 0x6cc24a, z: 2, rot: -0.5 },
      { k: 'ell', x: 14 + sway, y: 11 + sq * 0.3, rx: 10 + sq * 0.5, ry: 8 - sq * 0.5, c: 0xe0507a, z: 3 },
      { k: 'ell', x: 14 + sway, y: 9, rx: 3, ry: 2, c: 0xffd0e0, z: 4, flat: true },
      { k: 'ell', x: 8 + sway, y: 12, rx: 2, ry: 1.5, c: 0xffd0e0, z: 4, flat: true },
      { k: 'ell', x: 20 + sway, y: 13, rx: 2, ry: 1.5, c: 0xffd0e0, z: 4, flat: true },
      { k: 'ell', x: 14 + sway, y: 15 + sq * 0.2, rx: 4, ry: f === 3 ? 3 : 2, c: 0x2a1020, z: 5, flat: true },
    ];
    paintShapes(ctx, ox, oy, 28, 32, s);
    eye(ctx, ox + 10 + sway, oy + 9, f === 2 ? 0xffffff : 0xfff3a0, 2, 2);
    eye(ctx, ox + 16 + sway, oy + 9, f === 2 ? 0xffffff : 0xfff3a0, 2, 2);
  });
  anim(scene, 'spore_idle', 'en_spore', [0, 1], 3);

  // ---------------- Bulwark beetle: front shell blocks normal attacks. 36x26, frames: walk0-1, charge, stun, hurt
  sheet(scene, 'en_beetle', 36, 26, 5, (ctx, ox, oy, f) => {
    const step = f === 1 ? 1 : 0;
    const lower = f === 2 ? 2 : 0;
    const s: Shape[] = [
      { k: 'cap', x1: 9, y1: 19, x2: 6 + step, y2: 24, r: 1.5, c: 0x2c2440 },
      { k: 'cap', x1: 17, y1: 20, x2: 17 - step, y2: 24, r: 1.5, c: 0x2c2440 },
      { k: 'cap', x1: 25, y1: 20, x2: 27 + step, y2: 24, r: 1.5, c: 0x2c2440 },
      { k: 'ell', x: 15, y: 14, rx: 13, ry: 9, c: 0x3a6ab8, z: 1 },
      { k: 'ell', x: 13, y: 10, rx: 7, ry: 3, c: 0x8ec4ff, z: 2, flat: true },
      { k: 'ell', x: 28, y: 16 + lower, rx: 6, ry: 5.5, c: 0x2c3a68, z: 3 },
      { k: 'cap', x1: 31, y1: 13 + lower, x2: 35, y2: 5 + lower * 2, r: 1.8, r2: 0.8, c: 0xc0d8ff, z: 4 },
      { k: 'cap', x1: 15, y1: 6, x2: 15, y2: 22, r: 0.6, c: 0x22305a, z: 2 },
    ];
    paintShapes(ctx, ox, oy, 36, 26, s);
    eye(ctx, ox + 29, oy + 14 + lower, f === 3 ? 0xffffff : 0xff9a3a, 2, 2);
  });
  anim(scene, 'beetle_walk', 'en_beetle', [0, 1], 5);

  // ---------------- Mid-boss: Moss Golem. 72x72, frames: idle0-1, raise, slam, throw, hurt
  sheet(scene, 'mb_golem', 72, 72, 6, (ctx, ox, oy, f) => {
    const breathe = f === 1 ? 1 : 0;
    const armUp = f === 2 ? -18 : f === 3 ? 10 : f === 4 ? -10 : 0;
    const crouch = f === 3 ? 4 : 0;
    const s: Shape[] = [
      { k: 'rect', x: 20, y: 54 + crouch * 0.5, w: 11, h: 16 - crouch * 0.5, c: 0x6a6070, r: 3 },
      { k: 'rect', x: 41, y: 54 + crouch * 0.5, w: 11, h: 16 - crouch * 0.5, c: 0x6a6070, r: 3 },
      { k: 'ell', x: 36, y: 38 + breathe + crouch, rx: 24, ry: 20, c: 0x8a8296, z: 1 },
      { k: 'ell', x: 33, y: 22 + breathe + crouch, rx: 18, ry: 8, c: 0x5aa84a, z: 2 },
      { k: 'ell', x: 22, y: 26 + crouch, rx: 7, ry: 4, c: 0x6cc24a, z: 3 },
      { k: 'ell', x: 50, y: 24 + crouch, rx: 6, ry: 3, c: 0x6cc24a, z: 3 },
      { k: 'ell', x: 40, y: 46 + crouch, rx: 5, ry: 4, c: 0x6a6070, z: 2 },
      { k: 'ell', x: 26, y: 48 + crouch, rx: 4, ry: 3, c: 0x6a6070, z: 2 },
      { k: 'ell', x: 9, y: 40 + armUp + crouch, rx: 8, ry: 11, c: 0x7a7286, z: 4 },
      { k: 'ell', x: 63, y: 40 + armUp + crouch, rx: 8, ry: 11, c: 0x7a7286, z: 4 },
      { k: 'ell', x: 9, y: 49 + armUp + crouch, rx: 7, ry: 5, c: 0x5a5266, z: 5 },
      { k: 'ell', x: 63, y: 49 + armUp + crouch, rx: 7, ry: 5, c: 0x5a5266, z: 5 },
    ];
    paintShapes(ctx, ox, oy, 72, 72, s);
    const ec = f === 5 ? 0xffffff : f === 2 || f === 4 ? 0xff7a3a : 0x7affd8;
    px(ctx, ox + 25, oy + 33 + crouch + breathe, 0x0b0714, 9, 5);
    px(ctx, ox + 39, oy + 33 + crouch + breathe, 0x0b0714, 9, 5);
    px(ctx, ox + 26, oy + 34 + crouch + breathe, ec, 7, 3);
    px(ctx, ox + 40, oy + 34 + crouch + breathe, ec, 7, 3);
    px(ctx, ox + 26, oy + 34 + crouch + breathe, 0xffffff, 2, 1);
    px(ctx, ox + 40, oy + 34 + crouch + breathe, 0xffffff, 2, 1);
  });
  anim(scene, 'golem_idle', 'mb_golem', [0, 1], 2);

  // ---------------- Mid-boss: Bladed Mantis. 64x60, frames: idle0-1, windup, slash, leap, hurt
  sheet(scene, 'mb_mantis', 64, 60, 6, (ctx, ox, oy, f) => {
    const b = f === 1 ? 1 : 0;
    const arm = f === 2 ? -1 : f === 3 ? 1 : 0;
    const crouch = f === 4 ? 4 : f === 2 ? 2 : 0;
    const s: Shape[] = [
      { k: 'cap', x1: 22, y1: 40 + crouch, x2: 16, y2: 58, r: 2, c: 0x2e7a3a },
      { k: 'cap', x1: 30, y1: 42 + crouch, x2: 34, y2: 58, r: 2, c: 0x2e7a3a },
      { k: 'cap', x1: 24, y1: 40 + crouch, x2: 8, y2: 50 + crouch, r: 2, c: 0x2e7a3a },
      { k: 'ell', x: 18, y: 38 + crouch, rx: 14, ry: 7, c: 0x4fb84a, z: 1, rot: 0.2 },
      { k: 'cap', x1: 28, y1: 36 + crouch, x2: 36, y2: 20 + b + crouch, r: 5, r2: 4, c: 0x5ccf52, z: 2 },
      { k: 'ell', x: 40, y: 15 + b + crouch, rx: 8, ry: 6, c: 0x7ae070, z: 3 },
      { k: 'cap', x1: 36, y1: 26 + crouch, x2: arm > 0 ? 58 : 44, y2: arm > 0 ? 34 : arm < 0 ? 4 : 30, r: 2.5, c: 0x4fb84a, z: 4 },
      { k: 'cap', x1: arm > 0 ? 58 : 44, y1: arm > 0 ? 34 : arm < 0 ? 4 : 30, x2: arm > 0 ? 62 : arm < 0 ? 58 : 56, y2: arm > 0 ? 50 : arm < 0 ? 2 : 20, r: 2.5, r2: 0.6, c: 0xd8f0e0, z: 5 },
      { k: 'ell', x: 14, y: 30 + crouch, rx: 10, ry: 4, c: 0xa8f0c0, z: 0, rot: -0.3 },
    ];
    paintShapes(ctx, ox, oy, 64, 60, s);
    const ec = f === 5 ? 0xffffff : f === 2 ? 0xff3a5a : 0xffe04a;
    px(ctx, ox + 40, oy + 11 + b + crouch, 0x0b0714, 5, 4); px(ctx, ox + 41, oy + 12 + b + crouch, ec, 3, 2);
    px(ctx, ox + 45, oy + 12 + b + crouch, 0x0b0714, 4, 4); px(ctx, ox + 46, oy + 13 + b + crouch, ec, 2, 2);
    px(ctx, ox + 38, oy + 6 + b + crouch, 0x2e7a3a, 1, 4); px(ctx, ox + 36, oy + 3 + b + crouch, 0x2e7a3a, 2, 1);
  });
  anim(scene, 'mantis_idle', 'mb_mantis', [0, 1], 4);

  // ---------------- Boss: Elderwood, the Hollow King. Body 120x128 (frames: idle0-1, roar, hurt, enraged0-1)
  sheet(scene, 'boss_tree', 120, 128, 6, (ctx, ox, oy, f) => {
    const rage = f >= 4;
    const b = f === 1 || f === 5 ? 2 : 0;
    const leaf = rage ? 0xc8502a : 0x4f9a3a;
    const leaf2 = rage ? 0xe8783a : 0x6cc24a;
    const s: Shape[] = [
      { k: 'tri', pts: [30, 128, 60, 80, 48, 128], c: 0x5a3a28 },
      { k: 'tri', pts: [90, 128, 60, 80, 72, 128], c: 0x5a3a28 },
      { k: 'rect', x: 34, y: 50 + b, w: 52, h: 76 - b, c: 0x7a5236, r: 10, z: 1 },
      { k: 'ell', x: 60, y: 36 + b, rx: 50, ry: 30, c: leaf, z: 2 },
      { k: 'ell', x: 30, y: 30 + b, rx: 24, ry: 20, c: leaf2, z: 3 },
      { k: 'ell', x: 88, y: 28 + b, rx: 26, ry: 20, c: leaf2, z: 3 },
      { k: 'ell', x: 60, y: 16 + b, rx: 26, ry: 16, c: leaf2, z: 4 },
      { k: 'ell', x: 60, y: 92 + b, rx: 14, ry: 10, c: 0x3a2418, z: 5, flat: true },
      { k: 'ell', x: 44, y: 110, rx: 5, ry: 8, c: 0x6a4630, z: 2 },
      { k: 'ell', x: 78, y: 104, rx: 4, ry: 7, c: 0x6a4630, z: 2 },
    ];
    paintShapes(ctx, ox, oy, 120, 128, s);
    const ec = f === 3 ? 0xffffff : rage ? 0xff3a3a : 0xfff27a;
    const ey = oy + 70 + b;
    for (const ex of [ox + 44, ox + 66]) {
      px(ctx, ex - 1, ey - 1, 0x0b0714, 12, 8);
      px(ctx, ex, ey, ec, 10, 6);
      px(ctx, ex + 2, ey + 1, 0xffffff, 3, 2);
      if (rage) { px(ctx, ex - 1, ey - 3, 0x0b0714, 12, 2); }
    }
    if (f === 2) px(ctx, ox + 52, oy + 86, 0xff5a3a, 16, 10);
    // bark lines
    for (let i = 0; i < 6; i++) px(ctx, ox + 40 + i * 8, oy + 100 + (i % 2) * 6, 0x4a2e1e, 1, 14);
  });
  anim(scene, 'tree_idle', 'boss_tree', [0, 1], 2);
  anim(scene, 'tree_rage', 'boss_tree', [4, 5], 4);

  // Boss arm (separate so it can swing)
  sheet(scene, 'boss_arm', 48, 40, 2, (ctx, ox, oy, f) => {
    const c = f ? 0x8a3a20 : 0x6a4630;
    const s: Shape[] = [
      { k: 'cap', x1: 6, y1: 6, x2: 34, y2: 26, r: 6, r2: 8, c },
      { k: 'ell', x: 38, y: 30, rx: 9, ry: 8, c, z: 1 },
      { k: 'cap', x1: 38, y1: 34, x2: 44, y2: 39, r: 2, c, z: 2 },
      { k: 'cap', x1: 34, y1: 34, x2: 32, y2: 39, r: 2, c, z: 2 },
      { k: 'ell', x: 16, y: 10, rx: 6, ry: 4, c: f ? 0xe8783a : 0x6cc24a, z: 3 },
    ];
    paintShapes(ctx, ox, oy, 48, 40, s);
  });

  // projectiles
  sheet(scene, 'pr_seed', 10, 10, 1, (ctx, ox, oy) => paintShapes(ctx, ox, oy, 10, 10, [{ k: 'ell', x: 5, y: 5, rx: 3.5, ry: 3.5, c: 0xc8e05a }]));
  sheet(scene, 'pr_rock', 18, 18, 1, (ctx, ox, oy) => paintShapes(ctx, ox, oy, 18, 18, [
    { k: 'ell', x: 9, y: 9, rx: 7.5, ry: 6.5, c: 0x8a8296 }, { k: 'ell', x: 7, y: 6, rx: 4, ry: 2, c: 0x5aa84a, z: 1 },
  ]));
  sheet(scene, 'pr_thorn', 12, 24, 1, (ctx, ox, oy) => paintShapes(ctx, ox, oy, 12, 24, [
    { k: 'tri', pts: [1, 24, 6, 0, 11, 24], c: 0x7a5236 }, { k: 'tri', pts: [4, 24, 6, 8, 8, 24], c: 0x9a6a46, z: 1 },
  ]));
}
