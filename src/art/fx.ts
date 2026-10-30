// White (tintable) effect textures generated at boot.
import { addTex, bayer, css, disc, makeCanvas, px } from './pixel';

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const [cv, ctx] = makeCanvas(w, h);
  draw(ctx);
  addTex(scene, key, cv);
}

/** Alpha falloff painter with ordered dithering so soft shapes stay pixel-crisp. */
function soft(ctx: CanvasRenderingContext2D, w: number, h: number, f: (x: number, y: number) => number, bands = 5) {
  const img = ctx.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = Math.max(0, Math.min(1, f(x + 0.5, y + 0.5)));
    if (a <= 0) continue;
    const q = Math.floor(a * bands + bayer(x, y) * 0.9) / bands;
    if (q <= 0) continue;
    const i = (y * w + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(q * 255);
  }
  ctx.putImageData(img, 0, 0);
}

export function buildFx(scene: Phaser.Scene) {
  tex(scene, 'p1', 1, 1, (c) => px(c, 0, 0, 0xffffff));
  tex(scene, 'p2', 2, 2, (c) => px(c, 0, 0, 0xffffff, 2, 2));
  tex(scene, 'p3', 3, 3, (c) => px(c, 0, 0, 0xffffff, 3, 3));
  tex(scene, 'p4', 4, 4, (c) => { px(c, 1, 0, 0xffffff, 2, 4); px(c, 0, 1, 0xffffff, 4, 2); });
  tex(scene, 'spark', 5, 5, (c) => { px(c, 2, 0, 0xffffff, 1, 5); px(c, 0, 2, 0xffffff, 5, 1); });
  tex(scene, 'star4', 11, 11, (c) => {
    px(c, 5, 0, 0xffffff, 1, 11); px(c, 0, 5, 0xffffff, 11, 1);
    px(c, 4, 3, 0xffffff, 3, 5); px(c, 3, 4, 0xffffff, 5, 3);
  });
  tex(scene, 'glow', 48, 48, (c) => soft(c, 48, 48, (x, y) => { const d = Math.hypot(x - 24, y - 24) / 24; return Math.pow(1 - d, 1.8); }, 6));
  tex(scene, 'glowS', 16, 16, (c) => soft(c, 16, 16, (x, y) => { const d = Math.hypot(x - 8, y - 8) / 8; return Math.pow(1 - d, 1.4); }, 4));
  tex(scene, 'ring', 96, 96, (c) => soft(c, 96, 96, (x, y) => { const d = Math.hypot(x - 48, y - 48); return d > 47 ? 0 : d > 43 ? 1 : d > 38 ? (d - 38) / 5 : 0; }, 4));
  tex(scene, 'ringThin', 96, 96, (c) => soft(c, 96, 96, (x, y) => { const d = Math.hypot(x - 48, y - 48); return d <= 47 && d > 45 ? 1 : 0; }, 1));
  tex(scene, 'disc', 64, 64, (c) => disc(c, 32, 32, 31, 0xffffff));
  // crescent slash: thick in the middle, tapering, bright leading edge
  const crescent = (w: number, h: number) => (x: number, y: number) => {
    const cx = w * 0.18, cy = h * 0.5;
    const R = w * 0.78, r2 = w * 0.66;
    const d1 = Math.hypot((x - cx) / R, (y - cy) / (h * 0.52));
    const d2 = Math.hypot((x - cx + w * 0.1) / r2, (y - cy) / (h * 0.44));
    if (d1 > 1 || d2 < 1) return 0;
    const ang = Math.abs(y - cy) / (h * 0.5);
    const edge = 1 - (1 - d1) / 0.25;
    return Math.max(0, (1 - ang * ang) * (0.45 + edge * 0.55));
  };
  tex(scene, 'slash', 64, 40, (c) => soft(c, 64, 40, crescent(64, 40), 5));
  tex(scene, 'slashBig', 128, 80, (c) => soft(c, 128, 80, crescent(128, 80), 6));
  tex(scene, 'streak', 48, 3, (c) => soft(c, 48, 3, (x, y) => (y === 1.5 ? 1 : 0.5) * Math.sin((x / 48) * Math.PI) * (x / 48), 4));
  tex(scene, 'line', 64, 1, (c) => soft(c, 64, 1, (x) => Math.sin((x / 64) * Math.PI), 4));
  tex(scene, 'shard', 7, 3, (c) => { px(c, 0, 1, 0xffffff, 7, 1); px(c, 2, 0, 0xffffff, 3, 3); });
  tex(scene, 'smoke', 14, 14, (c) => soft(c, 14, 14, (x, y) => { const d = Math.hypot(x - 7, y - 7) / 7; return 1 - d * d; }, 3));
  tex(scene, 'leaf', 5, 3, (c) => { px(c, 1, 0, 0xffffff, 3, 1); px(c, 0, 1, 0xffffff, 5, 1); px(c, 1, 2, 0xffffff, 2, 1); });
  tex(scene, 'flame', 8, 12, (c) => soft(c, 8, 12, (x, y) => { const t = y / 12; const wd = 4 * Math.sin(t * Math.PI * 0.95 + 0.15) * (0.6 + t * 0.4); return Math.abs(x - 4) < wd ? 1 - Math.abs(x - 4) / (wd + 0.5) * 0.5 : 0; }, 3));
  tex(scene, 'snow', 5, 5, (c) => { px(c, 2, 0, 0xffffff, 1, 5); px(c, 0, 2, 0xffffff, 5, 1); px(c, 1, 1, 0xffffff); px(c, 3, 3, 0xffffff); px(c, 3, 1, 0xffffff); px(c, 1, 3, 0xffffff); });
  tex(scene, 'beam', 16, 32, (c) => soft(c, 16, 32, (x) => { const d = Math.abs(x - 8) / 8; return 1 - d * d; }, 5));
  tex(scene, 'orb', 16, 16, (c) => {
    soft(c, 16, 16, (x, y) => { const d = Math.hypot(x - 8, y - 8) / 8; return d < 0.62 ? 1 : 1 - (d - 0.62) / 0.38; }, 3);
  });
  tex(scene, 'hitspark', 32, 32, (c) => soft(c, 32, 32, (x, y) => {
    const dx = x - 16, dy = y - 16, d = Math.hypot(dx, dy) / 16, a = Math.atan2(dy, dx);
    const rays = Math.pow(Math.abs(Math.cos(a * 4)), 12);
    return Math.max((1 - d) * rays * 1.4, d < 0.25 ? 1 : 0);
  }, 4));
  tex(scene, 'shuriken', 13, 13, (c) => {
    const k = 0x2a1f40;
    px(c, 6, 0, 0xffffff, 1, 13); px(c, 0, 6, 0xffffff, 13, 1);
    px(c, 5, 2, 0xffffff, 3, 9); px(c, 2, 5, 0xffffff, 9, 3);
    px(c, 6, 6, k);
  });
  tex(scene, 'shadowOval', 24, 6, (c) => soft(c, 24, 6, (x, y) => { const d = Math.hypot((x - 12) / 12, (y - 3) / 3); return d < 1 ? 1 : 0; }, 1));
  tex(scene, 'square', 8, 8, (c) => { c.strokeStyle = css(0xffffff); c.lineWidth = 1; c.strokeRect(0.5, 0.5, 7, 7); });
  tex(scene, 'diamond', 9, 9, (c) => { for (let y = 0; y < 9; y++) { const w = 4 - Math.abs(4 - y); px(c, 4 - w, y, 0xffffff, w * 2 + 1, 1); } });
}
