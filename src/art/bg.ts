// Parallax backgrounds, ground tiles and map art.
import { W, H } from '../core/const';
import { addTex, bayer, css, hexToRgb, makeCanvas, mix, paintShapes, px, rng, rgbToHex, type Shape } from './pixel';

export interface Theme {
  key: string;
  sky: [number, number, number];
  sun: number;
  far: number;
  mid: number;
  near: number;
  leaf: number;
  ground: number;
  grass: number;
}

export const THEMES: Record<string, Theme> = {
  forest: { key: 'forest', sky: [0x2a1f5a, 0x4f7ab8, 0xffc89a], sun: 0xfff0b0, far: 0x6a7ac0, mid: 0x2f6a5a, near: 0x1e3f34, leaf: 0x4f9a3a, ground: 0x6a4a34, grass: 0x6cc24a },
  dusk: { key: 'dusk', sky: [0x1a0f3a, 0x7a3a7a, 0xff8a5a], sun: 0xffd08a, far: 0x5a3a7a, mid: 0x3a2a5a, near: 0x221a3a, leaf: 0x7a4ab0, ground: 0x4a3450, grass: 0xa070e0 },
  night: { key: 'night', sky: [0x07060d, 0x1a1440, 0x3a2a6a], sun: 0xd8e8ff, far: 0x2a2a5a, mid: 0x1a1a3a, near: 0x0f0f22, leaf: 0x2a3a6a, ground: 0x2a2440, grass: 0x4a5aa0 },
};

function grad(ctx: CanvasRenderingContext2D, w: number, h: number, stops: number[], y0 = 0) {
  const img = ctx.getImageData(0, y0, w, h);
  const n = stops.length - 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = (y / (h - 1)) * n;
      const i = Math.min(n - 1, Math.floor(t));
      let f = t - i;
      f = Math.floor(f * 8 + bayer(x, y)) / 8;
      const [r, g, b] = hexToRgb(mix(stops[i], stops[i + 1], Math.min(1, f)));
      const k = (y * w + x) * 4;
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, y0);
}

function ridge(seed: number, w: number) {
  const r = rng(seed);
  const waves = Array.from({ length: 5 }, (_, i) => ({ k: [1, 2, 3, 5, 9][i], a: [1, 0.5, 0.35, 0.18, 0.08][i] * (0.7 + r() * 0.6), p: r() * Math.PI * 2 }));
  return (x: number) => waves.reduce((s, wv) => s + wv.a * Math.sin((x / w) * Math.PI * 2 * wv.k + wv.p), 0);
}

export function buildBackground(scene: Phaser.Scene, th: Theme) {
  const k = th.key;
  // sky
  {
    const [cv, ctx] = makeCanvas(W, H);
    grad(ctx, W, H, [th.sky[0], th.sky[1], th.sky[2], th.sky[2]]);
    const r = rng(7);
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(r() * W), y = Math.floor(r() * H * 0.45);
      px(ctx, x, y, 0xffffff, 1, 1, 0.3 + r() * 0.6);
      if (r() < 0.12) { px(ctx, x - 1, y, 0xffffff, 3, 1, 0.3); px(ctx, x, y - 1, 0xffffff, 1, 3, 0.3); }
    }
    // sun with pixel halo rings
    const sx = W * 0.7, sy = H * 0.42;
    for (let rr = 70; rr > 20; rr -= 10) {
      ctx.fillStyle = css(th.sun, 0.05);
      ctx.beginPath(); ctx.arc(sx, sy, rr, 0, Math.PI * 2); ctx.fill();
    }
    for (let y = -20; y <= 20; y++) {
      const hw = Math.floor(Math.sqrt(400 - y * y));
      px(ctx, sx - hw, sy + y, th.sun, hw * 2 + 1, 1);
    }
    if (th.key !== 'night') for (let y = -8; y < 20; y += 5) px(ctx, sx - 22, sy + y, th.sky[2], 44, 1 + Math.floor((y + 8) / 8));
    else { px(ctx, sx - 6, sy - 8, mix(th.sun, th.sky[1], 0.25), 5, 4); px(ctx, sx + 7, sy + 4, mix(th.sun, th.sky[1], 0.25), 6, 5); px(ctx, sx - 10, sy + 9, mix(th.sun, th.sky[1], 0.2), 3, 3); }
    addTex(scene, `bg_sky_${k}`, cv);
  }
  // far mountains (tileable)
  {
    const h = 200;
    const [cv, ctx] = makeCanvas(W, h);
    const f1 = ridge(11, W), f2 = ridge(23, W);
    for (let x = 0; x < W; x++) {
      const top = Math.floor(80 + f1(x) * 34);
      const top2 = Math.floor(120 + f2(x) * 26);
      for (let y = top; y < h; y++) {
        const t = (y - top) / (h - top);
        const c = mix(mix(th.far, th.sky[2], 0.35), th.far, Math.min(1, t * 2));
        px(ctx, x, y, y === top ? mix(th.far, 0xffffff, 0.25) : c);
      }
      for (let y = top2; y < h; y++) px(ctx, x, y, y === top2 ? mix(th.far, th.mid, 0.3) : mix(th.far, th.mid, 0.55 + bayer(x, y) * 0.1));
    }
    addTex(scene, `bg_far_${k}`, cv);
  }
  // mid tree line (tileable canopy)
  {
    const h = 210;
    const [cv, ctx] = makeCanvas(W, h);
    const r = rng(31);
    const shapes: Shape[] = [];
    for (let i = 0; i < 26; i++) {
      const x = (i / 26) * W + r() * 14, y = 90 + r() * 40, rx = 18 + r() * 16, ry = 22 + r() * 18;
      for (const dx of [-W, 0, W]) {
        shapes.push({ k: 'rect', x: x + dx - 3, y: y, w: 6, h: h - y, c: mix(th.mid, 0x1a1020, 0.4), z: 0 });
        shapes.push({ k: 'ell', x: x + dx, y, rx, ry, c: th.mid, z: 1 });
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = (i / 40) * W + r() * 10, rx = 10 + r() * 12;
      for (const dx of [-W, 0, W]) shapes.push({ k: 'ell', x: x + dx, y: 160 + r() * 10, rx, ry: rx * 0.7, c: mix(th.mid, th.leaf, 0.35), z: 2 });
    }
    shapes.push({ k: 'rect', x: 0, y: 166, w: W, h: 44, c: mix(th.mid, 0x1a1020, 0.45), z: 3, flat: true });
    paintShapes(ctx, 0, 0, W, h, shapes, { outline: null, selout: true, light: [-0.4, -0.8, 0.45] });
    addTex(scene, `bg_mid_${k}`, cv);
  }
  // near layer: big trunks and hanging leaves (tileable)
  {
    const h = 300;
    const [cv, ctx] = makeCanvas(W, h);
    const r = rng(57);
    const shapes: Shape[] = [];
    for (let i = 0; i < 5; i++) {
      const x = (i / 5) * W + r() * 60;
      const tw = 14 + r() * 10;
      for (const dx of [-W, 0, W]) {
        shapes.push({ k: 'rect', x: x + dx, y: 0, w: tw, h: h, c: mix(th.near, 0x0b0714, 0.35), z: 1, r: 2 });
        shapes.push({ k: 'ell', x: x + dx + tw / 2, y: 6 + r() * 14, rx: 46, ry: 26, c: mix(th.leaf, th.near, 0.55), z: 2 });
        shapes.push({ k: 'ell', x: x + dx + tw / 2 + 30, y: 0, rx: 34, ry: 18, c: mix(th.leaf, th.near, 0.4), z: 3 });
      }
    }
    paintShapes(ctx, 0, 0, W, h, shapes, { outline: null, light: [-0.6, -0.5, 0.6] });
    addTex(scene, `bg_near_${k}`, cv);
  }
  // ground tile (tileable 64x64)
  {
    const [cv, ctx] = makeCanvas(64, 64);
    const r = rng(77);
    const dirt = th.ground;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const n = bayer(x, y) * 0.25 + r() * 0.08;
      px(ctx, x, y, mix(dirt, 0x140a10, Math.min(0.75, y / 90 + n)));
    }
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(r() * 60), y = 14 + Math.floor(r() * 46);
      px(ctx, x, y, mix(dirt, 0xffffff, 0.18), 3, 2); px(ctx, x, y + 2, mix(dirt, 0x000000, 0.4), 3, 1);
    }
    for (let x = 0; x < 64; x++) {
      const gh = 6 + Math.floor((Math.sin(x * 0.9) + Math.sin(x * 2.3)) * 1.5 + 1);
      for (let y = 0; y < gh; y++) px(ctx, x, y, y === 0 ? mix(th.grass, 0xffffff, 0.35) : y < 3 ? th.grass : mix(th.grass, th.near, 0.4));
      px(ctx, x, gh, mix(th.grass, 0x0b0714, 0.6));
    }
    addTex(scene, `ground_${k}`, cv);
  }
  // floating platform tile 32x14
  {
    const [cv, ctx] = makeCanvas(32, 14);
    px(ctx, 0, 3, mix(th.ground, 0x0b0714, 0.55), 32, 11);
    for (let x = 0; x < 32; x++) for (let y = 4; y < 13; y++) px(ctx, x, y, mix(th.ground, 0x140a10, y / 20 + bayer(x, y) * 0.15));
    for (let x = 0; x < 32; x++) { px(ctx, x, 0, th.grass, 1, 3); px(ctx, x, 0, mix(th.grass, 0xffffff, 0.3)); }
    for (let x = 2; x < 32; x += 7) px(ctx, x, 3, th.grass, 2, 2 + (x % 3));
    addTex(scene, `plat_${k}`, cv);
  }
  // foreground grass blades overlay
  {
    const [cv, ctx] = makeCanvas(W, 26);
    const r = rng(91);
    for (let x = 0; x < W; x += 1) {
      if (r() < 0.55) continue;
      const hh = 6 + Math.floor(r() * 18);
      const c = r() < 0.5 ? th.grass : mix(th.grass, th.near, 0.5);
      px(ctx, x, 26 - hh, c, 1, hh);
      px(ctx, x, 26 - hh, mix(c, 0xffffff, 0.3));
    }
    addTex(scene, `fg_${k}`, cv);
  }
}

/** Utility: average color of a theme, used for UI tints. */
export function themeTint(th: Theme) { return rgbToHex(hexToRgb(mix(th.mid, th.sky[1], 0.5))); }
