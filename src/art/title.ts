// Stylised title lettering: custom pixel glyphs, beveled gradient fill, slash cut, extruded shadow.
import { addTex, bayer, makeCanvas, mix, px } from './pixel';

const G: Record<string, string[]> = {
  A: [
    '....###....', '...#####...', '..###.###..', '..##...##..', '.###...###.', '.##.....##.', '###.....###',
    '###########', '###########', '###.....###', '###.....###', '###.....###', '###.....###',
  ],
  X: [
    '###.....###', '###.....###', '.###...###.', '..###.###..', '...#####...', '....###....', '....###....',
    '...#####...', '..###.###..', '.###...###.', '###.....###', '###.....###', '###.....###',
  ],
  E: [
    '###########', '###########', '###........', '###........', '###........', '#########..', '#########..',
    '###........', '###........', '###........', '###........', '###########', '###########',
  ],
  F: [
    '###########', '###########', '###........', '###........', '###........', '#########..', '#########..',
    '###........', '###........', '###........', '###........', '###........', '###........',
  ],
  L: [
    '###........', '###........', '###........', '###........', '###........', '###........', '###........',
    '###........', '###........', '###........', '###........', '###########', '###########',
  ],
  N: Array.from({ length: 13 }, (_, y) => {
    let row = '';
    for (let x = 0; x < 11; x++) {
      const d = 2.5 + (y / 12) * 6;
      row += x < 3 || x > 7 || Math.abs(x - d) < 1.6 ? '#' : '.';
    }
    return row;
  }),
};

export const TITLE_WORD = 'AXENFALL';

/** Builds `tl_<letter>` textures. `cool` makes the alternate cyan palette used for highlights. */
export function buildTitle(scene: Phaser.Scene) {
  const S = 4; // pixels per glyph cell
  const shear = 0.22;
  const top = [0xffffff, 0xfff4b0, 0xffc23d, 0xff7a1a, 0xd8301a, 0x8a1030];
  for (const ch of Object.keys(G)) {
    const rows = G[ch];
    const gw = rows[0].length * S, gh = rows.length * S;
    const pad = 10;
    const W = gw + Math.ceil(gh * shear) + pad * 2, H = gh + pad * 2;
    const [cv, ctx] = makeCanvas(W, H);
    const filled = (x: number, y: number) => {
      // inverse shear back to glyph space
      const gy = y - pad;
      const gx = x - pad - Math.round((gh - gy) * shear);
      if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return false;
      return rows[Math.floor(gy / S)][Math.floor(gx / S)] === '#';
    };
    const mask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) mask[y * W + x] = filled(x, y) ? 1 : 0;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : mask[y * W + x]);
    // extruded shadow (down-right), then thick outline, then fill
    for (let d = 5; d >= 1; d--) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (at(x - d, y - d)) px(ctx, x, y, d > 3 ? 0x1a0820 : 0x3a0c2a);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (at(x, y)) continue;
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 3 && at(x + dx, y + dy)) { near = true; break; }
      if (near) px(ctx, x, y, 0x12061a);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!at(x, y)) continue;
      const t = (y - pad) / gh;
      const f = t * (top.length - 1);
      const i = Math.min(top.length - 2, Math.floor(f));
      const q = Math.floor((f - i) * 4 + bayer(x, y)) / 4;
      let c = mix(top[i], top[i + 1], Math.min(1, q));
      if (!at(x, y - 1) || !at(x, y - 2)) c = mix(c, 0xffffff, 0.7); // top bevel
      else if (!at(x - 1, y)) c = mix(c, 0xffffff, 0.35); // left bevel
      if (!at(x, y + 1)) c = mix(c, 0x5a0820, 0.55); // bottom bevel
      else if (!at(x + 1, y)) c = mix(c, 0x5a0820, 0.3);
      px(ctx, x, y, c);
    }
    // diagonal blade cut through the glyph
    const cy = pad + gh * 0.52;
    for (let x = 0; x < W; x++) {
      const y = Math.round(cy - (x - W / 2) * 0.18);
      if (at(x, y)) { px(ctx, x, y, 0x12061a); px(ctx, x, y + 1, 0xffffff); }
    }
    addTex(scene, 'tl_' + ch, cv);
  }
}
