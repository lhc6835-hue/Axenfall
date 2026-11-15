// Weapon and cube pixel art, all drawn from rectangles in a local frame.
// Local frame: origin at the gripping hand, +x along the barrel / blade, +y "below".
import { Gfx, Xf } from '../engine/gfx';
import { TAU, hash2, hsv, mix } from '../engine/math';
import type { GunLook, SkinDef, SwordLook } from './data';

// palette
const K = {
  ink: 0x0e0c16,
  dark: 0x262636,
  metal: 0x4a4d63,
  steel: 0x7d8299,
  light: 0xb6bccf,
  shine: 0xeef2ff,
  wood: 0x6b3f24,
  woodL: 0x9c6235,
  brass: 0xe0b24a,
  brassD: 0x9a6f22,
  olive: 0x56603a,
  oliveL: 0x7a8650,
  red: 0xb8323a,
  cyan: 0x63f0ff,
};

export interface GunPose {
  slide: number; // 0..1 slide back
  mag: number; // 0 seated, >0 px down, <0 hidden
  cyl: number; // 0..1 cylinder swung out
  pump: number; // 0..1 pump back
  bolt: number; // 0..1 bolt back
  boltUp: number; // 0..1 bolt handle lifted
  handle: number; // smg charging handle 0..1
  box: number; // minigun box offset (px down, <0 hidden)
  barrel: number; // minigun barrel phase
  gap: number; // railgun rail opening 0..1
  cells: number; // railgun coil charge 0..4
  charge: number; // 0..1 railgun shot charge
  cell: number; // railgun battery offset (<0 hidden)
  tip: number; // derringer barrels tipped up 0..1
  lever: number; // lever-action loop swung down 0..1
  brk: number; // break-action barrels hinged open 0..1
  drum: number; // launcher drum rotation (chambers)
  drumOut: number; // launcher drum swung out 0..1
  heat: number; // laser heat 0..1
  fins: number; // laser vents open 0..1
  rod: number; // musket ramrod: <0 stowed, 0..1 depth in the barrel
  hammer: number; // musket hammer cocked 0..1
  pan: number; // musket flash-pan flare 0..1
  hand2: [number, number] | null;
  handC: number;
}

export const blankPose = (): GunPose => ({
  slide: 0, mag: 0, cyl: 0, pump: 0, bolt: 0, boltUp: 0, handle: 0, box: 0, barrel: 0, gap: 0, cells: 4, charge: 0, cell: 0, tip: 0, lever: 0, brk: 0, drum: 0, drumOut: 0, heat: 0, fins: 0, rod: -1, hammer: 1, pan: 0, hand2: null, handC: 0x999999,
});

export const MUZZLE: Record<GunLook, [number, number]> = {
  mpistol: [12, -3],
  flare: [10.5, -3.2],
  nailgun: [13.5, -2.8],
  crossbow: [15, -2.6],
  harpoon: [19, -3.2],
  blunder: [20, -3.4],
  tesla: [15.5, -3],
  drum: [18.5, -3.6],
  dragon: [23, -4],
  nova: [20, -3.5],
  void: [25, -3.1],
  pistol: [10, -3],
  revolver: [13, -3.5],
  smg: [14, -2.5],
  shotgun: [17, -3],
  sniper: [24, -3],
  minigun: [20, -3.5],
  railgun: [20, -3.5],
  derringer: [7, -3.2],
  lever: [19, -3.8],
  rifle: [18, -3.2],
  laser: [12.5, -3],
  dbarrel: [12, -2.6],
  cannon: [12.5, -4],
  musket: [27, -3.3],
  launcher: [19, -4],
};
/** where casings leave the gun */
export const PORT: Record<GunLook, [number, number]> = {
  mpistol: [3, -4], flare: [1, -4], nailgun: [5, -4], crossbow: [3, -3], harpoon: [-1, -5], blunder: [-1, -5], tesla: [2, -5],
  drum: [3, -5], dragon: [-2, -2], nova: [-4, -4], void: [-1, -4],
  pistol: [3, -4], revolver: [1, -3], smg: [4, -4], shotgun: [1, -4], sniper: [-1, -4], minigun: [-2, -2], railgun: [-4, -4],
  derringer: [1, -4], lever: [1, -5], rifle: [3, -5], laser: [2, -5], dbarrel: [2, -3], cannon: [4, -5.5], musket: [-1, -5], launcher: [2, -5],
};

/** a little cube fist: dark rim so it reads on any body or floor, lit top, shaded bottom */
export function hand(x: Xf, u: number, v: number, c: number) {
  x.q(u - 2.5, v - 2.5, 5, 5, 0x0c0a14);
  x.q(u - 2, v - 2, 4, 4, c);
  x.q(u - 2, v - 2, 4, 1, mix(c, 0xffffff, 0.35));
  x.q(u - 2, v + 1, 4, 1, mix(c, 0x000000, 0.3));
}

export function drawGun(x: Xf, kind: GunLook, p: GunPose, time: number) {
  const g = x.g;
  switch (kind) {
    case 'mpistol': {
      const s = -p.slide * 3;
      x.q(-2, -1, 3, 4, K.dark); // grip
      x.q(-2, -1, 1, 4, K.metal);
      if (p.mag >= 0) {
        x.q(-1.8, 3 + p.mag, 2.6, 4.5, K.ink); // extended magazine
        x.q(-1.8, 3 + p.mag, 0.8, 4.5, K.metal);
      }
      x.q(-1, -2, 9, 1.5, K.metal);
      x.q(2, -1, 2, 1.5, K.dark);
      x.q(-2 + s, -4, 11, 2, 0x3a3e52); // dark slide
      x.q(-2 + s, -4, 11, 1, K.steel);
      x.q(3 + s, -3.4, 1, 0.8, K.ink);
      x.q(5 + s, -3.4, 1, 0.8, K.ink);
      x.q(9, -4.3, 3, 2.6, K.dark); // compensator
      x.q(9.6, -4.7, 0.8, 0.8, 0xff8a3a);
      x.q(-3, -2.4, 1.2, 1, 0xff8a3a); // fire selector
      break;
    }
    case 'flare': {
      x.q(-2.5, -1, 3.2, 4, 0xd8541e); // orange polymer grip
      x.q(-2.5, -1, 1, 4, 0xff7a3a);
      x.q(-2.2, -3.2, 4.4, 2.4, 0xc84a1a); // frame
      x.q(0.5, -1, 1.5, 1.2, K.dark);
      x.q(-2.8, -4.2, 1.4, 1, K.dark); // hammer
      const [hx, hy] = x.pt(1.5, -2.4);
      const B = new Xf(x.g, hx, hy, x.ang - p.tip * 1.1 * x.fy, x.fy);
      B.q(0, -2.4, 9, 3.2, 0xe0602a); // fat barrel
      B.q(0, -2.4, 9, 1, 0xff9a5a);
      B.q(8, -2.8, 1.4, 4, K.dark);
      if (p.tip > 0.3) B.q(-0.4, -1.8, 0.8, 2, 0xff3a2a); // the shell
      break;
    }
    case 'nailgun': {
      x.q(-1, -1, 2.4, 4, K.dark); // grip
      x.q(-4, -5, 12, 4.2, 0xe8b830); // tool body
      x.q(-4, -5, 12, 1, 0xffe070);
      x.q(-4, -1, 3, 2, 0xc89820);
      x.q(-3, -3.6, 2, 1, K.ink); // vent
      if (p.mag >= 0) {
        x.q(6, -1 + p.mag, 1, 6.5, K.metal); // nail strip
        for (let i = 0; i < 5; i++) x.q(6.8, -0.6 + p.mag + i * 1.2, 3, 0.5, K.light);
      }
      x.q(8, -4, 5, 2.4, K.metal); // nose
      x.q(12.5, -3.6, 1.2, 1.6, K.dark);
      x.q(4 - p.handle * 3, -6, 2, 1, K.dark);
      break;
    }
    case 'crossbow': {
      x.q(-12, -3, 10, 3, K.wood); // stock
      x.q(-12, -3, 10, 1, K.woodL);
      x.q(-12, -4, 2, 5, K.wood);
      x.q(-2, -3.6, 16, 2.4, K.wood); // tiller
      x.q(-2, -3.6, 16, 0.8, K.woodL);
      x.q(-1, -1.2, 1.6, 2, K.dark); // trigger
      x.q(12.5, -10, 1.6, 14, K.metal); // prod
      x.q(12.5, -10, 0.6, 14, K.steel);
      x.q(14, -3.4, 1.2, 2, K.metal); // stirrup
      // the string is re-drawn after every shot (it snaps forward, then is hauled back to the nut)
      const su = 3 + p.bolt * 9;
      const [ax, ay] = x.pt(13, -9.6), [bx, by] = x.pt(su, -2.4), [cx, cy] = x.pt(13, 3.6);
      g.line(ax, ay, bx, by, 0xe8e0c8);
      g.line(bx, by, cx, cy, 0xe8e0c8);
      if (p.bolt < 0.35) {
        x.q(su, -2.9, 11, 0.8, 0xd8c8a0); // bolt on the rail
        x.tri(su + 11, -3.6, su + 11, -1.6, su + 13.5, -2.6, K.light);
        x.q(su, -3.3, 2, 0.5, 0xd84a3a);
      }
      break;
    }
    case 'harpoon': {
      x.q(-12, -3, 11, 3.4, K.wood); // stock
      x.q(-12, -3, 11, 1, K.woodL);
      x.q(-13, -4, 2, 5.4, K.wood);
      x.q(-7, -0.2, 4, 2.4, 0xc8b080); // coiled line
      x.q(-7, 0.6, 4, 0.5, 0x9a8458);
      x.q(-1, -5, 20, 3.6, K.metal); // heavy barrel
      x.q(-1, -5, 20, 1, K.steel);
      x.q(4, -5.4, 1.2, 4.4, K.brass);
      x.q(13, -5.4, 1.2, 4.4, K.brass);
      x.q(0, -1.4, 14, 2, K.woodL); // forestock
      // the harpoon: head out of the muzzle when loaded, pushed down the barrel while reloading
      if (p.rod <= 1.5) {
        const out = p.rod < 0 ? 4 : (1 - p.rod) * 16;
        x.q(19, -3.6, out, 0.9, 0xd8c8a0);
        x.tri(19 + out, -4.7, 19 + out, -2, 22.5 + out, -3.3, K.light);
        x.tri(19 + out, -4.7, 20.5 + out, -3.3, 18.2 + out, -5.8, K.steel);
        x.tri(19 + out, -2, 20.5 + out, -3.3, 18.2 + out, -0.8, K.steel);
      }
      const [hx, hy] = x.pt(-2.5, -5);
      const H = new Xf(x.g, hx, hy, x.ang + (-0.9 + p.hammer * 1.5) * x.fy, x.fy);
      H.q(-0.5, -3, 1.2, 3, K.dark);
      if (p.pan > 0) x.glow(0.5, -5.6, 6, 0xffb060, 0.9 * p.pan);
      break;
    }
    case 'blunder': {
      if (p.rod >= 0) x.q(19 - p.rod * 14, -3.9, 16, 0.7, 0xd8c8a0);
      x.q(-13, -3, 12, 3.2, K.wood);
      x.q(-13, -3, 12, 1, K.woodL);
      x.q(-14, -4, 2, 5.4, K.wood);
      x.q(0, -2.4, 12, 1.8, K.woodL);
      x.q(0, -4.4, 16, 2, K.brass); // brass barrel
      x.q(0, -4.4, 16, 0.7, 0xffe08a);
      // the flared bell mouth
      x.tri(16, -4.4, 20, -6.6, 20, -0.2, K.brass);
      x.tri(16, -4.4, 16, -2.4, 20, -0.2, K.brass);
      x.q(19.4, -6.6, 0.9, 6.4, K.brassD);
      x.q(-3.5, -4.8, 5, 2.4, K.metal);
      x.q(-0.5, -5.2, 2, 1, K.brass);
      const [hx, hy] = x.pt(-2.5, -4.5);
      const H = new Xf(x.g, hx, hy, x.ang + (-0.9 + p.hammer * 1.5) * x.fy, x.fy);
      H.q(-0.5, -3, 1.2, 3, K.dark);
      H.q(-0.6, -3.6, 1.6, 1, 0x9a8a70);
      if (p.pan > 0) {
        x.q(0, -6.5, 1.5, 1.5, 0xffffff, p.pan);
        x.glow(0.5, -5.6, 6, 0xffb060, 0.9 * p.pan);
      }
      break;
    }
    case 'tesla': {
      const heatC = mix(0x9fe0ff, 0xffffff, p.heat);
      x.q(-2, -1, 3, 4, 0x2a2a3a);
      x.q(-3, -5, 8, 4, 0x3a3a50);
      x.q(-3, -5, 8, 1, 0x5a5a74);
      const fo = p.fins * 2;
      x.q(-2, -6 - fo, 6, 1, 0x5a5a74); // vent lid
      x.q(-1, -3.8, 4, 1.4, heatC);
      x.q(5, -3.6, 7, 1.2, K.metal);
      for (let i = 0; i < 4; i++) {
        x.q(5 + i * 1.6, -5.6, 1, 5.2, 0xc87a3a); // copper coils
        x.q(5 + i * 1.6, -5.6, 1, 1, 0xffb070);
      }
      x.disc(13, -3, 2.6, 0x2a3a50);
      x.disc(13, -3, 1.8, heatC);
      x.glow(13, -3, 7, 0x9fe0ff, 0.3 + p.heat * 0.4);
      // little arcs crawl over the sphere
      const [sx, sy] = x.pt(13, -3);
      for (let k = 0; k < 2; k++) {
        const a = time * 37 + k * 2.6;
        const [ex, ey] = x.pt(13 + Math.cos(a) * 4, -3 + Math.sin(a) * 4);
        g.line(sx, sy, ex, ey, 0xd8f4ff, 0.6);
      }
      break;
    }
    case 'drum': {
      x.q(-10, -3.8, 6, 3.2, K.dark); // stock
      x.q(-10, -4.2, 1.2, 4.6, K.dark);
      x.q(-1, -1, 2, 3.5, K.dark); // grip
      if (p.mag >= 0) {
        x.disc(4, 1.6 + p.mag, 3.6, K.ink); // drum
        x.disc(4, 1.6 + p.mag, 2.6, K.metal);
        x.disc(4, 1.6 + p.mag, 1, K.dark);
      }
      x.q(-3, -5, 10, 4, K.metal); // receiver
      x.q(-3, -5, 10, 1, K.steel);
      x.q(7, -4.6, 11, 2, K.light); // barrel
      x.q(7, -4.6, 11, 0.7, K.shine);
      x.q(7, -2.6, 9, 1.6, K.dark); // handguard
      x.q(17, -5, 1.5, 2.8, K.dark);
      x.q(-2 - p.handle * 3, -5.8, 1.6, 0.8, K.steel);
      break;
    }
    case 'dragon': {
      const ph = p.barrel;
      for (let i = 0; i < 3; i++) {
        const v = -6 + i * 1.6 + Math.sin(ph + i * 2.1) * 0.6;
        x.q(2, v, 15, 1.2, Math.cos(ph + i * 2.1) > 0 ? 0xd8a050 : 0x7a3a20);
      }
      x.q(8, -6.5, 1.5, 5, 0x5a2a20); // clamp
      x.q(16, -7.5, 4, 7, 0xa02a1a); // dragon head
      x.q(16, -7.5, 4, 1.4, 0xd84a2a);
      x.tri(20, -7.5, 20, -0.5, 23, -4, 0xc83a1a);
      x.q(17, -6.6, 1, 1, 0xffd040); // eye
      x.q(20.2, -5.2, 1, 0.6, 0xffffff); // fangs
      x.q(20.2, -3.4, 1, 0.6, 0xffffff);
      x.glow(22, -4, 6, 0xff7a2a, 0.3);
      x.q(-7, -7, 9, 7, 0x5a2a20); // motor
      x.q(-7, -7, 9, 1, 0x8a4a30);
      x.q(-4, -9, 6, 1.5, K.dark); // top handle
      x.q(-4, -9, 1, 3, K.dark);
      x.q(1, -9, 1, 3, K.dark);
      if (p.box >= 0) {
        x.q(-7, 0 + p.box, 7, 5, 0xb8302a); // fuel tank
        x.q(-7, 0 + p.box, 7, 1, 0xff6a4a);
        x.q(-5, 1.6 + p.box, 3, 2, 0xffd040);
        x.q(-1, -1 + p.box * 0.5, 1, 2, K.dark);
      }
      break;
    }
    case 'nova': {
      const gp = p.gap * 2;
      x.q(-9, -5, 8, 5, 0x4a2a5a);
      x.q(-9, -5, 8, 1, 0x7a4a8a);
      x.q(-6, 0, 2, 3.5, K.dark);
      if (p.cell >= 0) {
        x.q(-8, -1 + p.cell, 3, 2, 0xff9af0);
        x.q(-8, -1 + p.cell, 3, 1, 0xffd8fa);
      }
      x.q(0, -4.6, 18, 3.2, 0x1a0a24); // bore
      for (let i = 0; i < 4; i++) {
        const lit = p.cells > i ? Math.min(1, p.cells - i) : 0;
        x.q(1 + i * 4, -6.5, 2.4, 7, lit > 0 ? mix(0x5a2a6a, 0xff9af0, lit) : 0x3a1a4a);
      }
      x.q(0, -7.5 - gp, 20, 1.2, 0xc89ad8);
      x.q(0, 0.3 + gp, 20, 1.2, 0xc89ad8);
      x.q(18, -7, 2, 8, 0x7a4a8a);
      // a small star grows in the bore while it charges
      const r = 1.2 + p.charge * 2.6;
      x.disc(9, -3, r, mix(0xff9af0, 0xffffff, p.charge));
      x.glow(9, -3, 4 + r * 3, 0xff9af0, 0.25 + p.charge * 0.6);
      break;
    }
    case 'void': {
      x.q(-12, -3.2, 10, 3.2, 0x1a1428);
      x.q(-12, -3.2, 10, 0.8, 0x3a2a58);
      x.q(-12.5, -4, 1.6, 5, 0x1a1428);
      x.q(-2, -4.4, 16, 3, 0x241a38);
      x.q(-2, -4.4, 16, 0.8, 0x4a3a70);
      x.q(0, -2.6, 14, 0.6, 0xc89aff); // glowing seam
      x.glow(7, -2.3, 8, 0xc89aff, 0.2 + 0.1 * Math.sin(time * 4));
      x.q(14, -3.8, 11, 1.4, 0x120c1e);
      for (let i = 0; i < 3; i++) x.q(16 + i * 3, -4.2, 0.8, 2.2, 0xc89aff);
      x.q(1, -7.4, 8, 1.6, 0x241a38); // scope
      x.q(8.6, -7.4, 1, 1.6, 0xff9af0);
      const bb = -p.bolt * 3;
      x.q(-2 + bb, -4.9, 3, 1, 0xc89aff);
      x.q(-1 + bb, -0.5 - p.boltUp * 3.5, 1.6, 1.6, 0x4a3a70);
      break;
    }
    case 'pistol': {
      const s = -p.slide * 3;
      x.q(-2, -1, 3, 4, K.dark); // grip
      x.q(-2, -1, 1, 4, K.metal);
      if (p.mag >= 0) x.q(-2, 3 + p.mag, 3, 1.2, K.steel);
      x.q(-1, -2, 8, 1.5, K.metal); // frame
      x.q(2, -1, 2, 1.5, K.dark); // trigger guard
      x.q(-2 + s, -4, 11, 2, K.light); // slide
      x.q(-2 + s, -4, 11, 1, K.shine);
      x.q(6 + s, -3, 1, 1, K.dark);
      break;
    }
    case 'revolver': {
      x.q(-4, -1, 3, 4.5, K.wood); // grip
      x.q(-4, -1, 1, 4.5, K.woodL);
      x.q(-5, -5, 2, 1, K.dark); // hammer
      x.q(-3, -5.5, 6.5, 1, K.metal); // top strap ties frame to barrel
      x.q(-2, -2, 4, 1.5, K.metal);
      x.q(0, -1, 2, 1.5, K.dark);
      const cy = p.cyl * 2.5;
      x.q(-1, -4.5 + cy, 4, 3, K.steel); // cylinder
      x.q(-1, -4.5 + cy, 4, 1, K.light);
      x.q(0, -3.5 + cy, 1, 1, K.dark);
      x.q(2, -3.5 + cy, 1, 1, K.dark);
      x.q(3, -4.5, 10, 2, K.light); // barrel
      x.q(3, -4.5, 10, 1, K.shine);
      x.q(3, -5.5, 9, 1, K.metal); // rib
      x.q(11.5, -6, 1, 1, K.steel); // sight
      break;
    }
    case 'smg': {
      x.q(-8, -3, 5, 2, K.dark); // stock
      x.q(-8, -3, 1, 3, K.dark);
      x.q(-1, -1, 2, 3.5, K.dark); // grip
      if (p.mag >= 0) {
        x.q(3, -1 + p.mag, 2.2, 7, K.ink); // long mag
        x.q(3, -1 + p.mag, 1, 7, K.metal);
      }
      x.q(-3, -4, 12, 3, K.metal); // body
      x.q(-3, -4, 12, 1, K.steel);
      x.q(9, -3, 5, 1.2, K.dark); // barrel
      x.q(12, -3.5, 1, 2, K.metal);
      x.q(5 - p.handle * 3, -5, 2, 1, K.brass); // charging handle
      // vents
      for (let i = 0; i < 3; i++) x.q(1 + i * 2.5, -3, 1, 1, K.ink);
      break;
    }
    case 'shotgun': {
      x.q(-11, -3, 8, 3, K.wood); // stock
      x.q(-11, -3, 8, 1, K.woodL);
      x.q(-11, -3, 1, 4, K.wood);
      x.q(-3, -4, 5, 3.5, K.metal); // receiver
      x.q(-3, -4, 5, 1, K.steel);
      x.q(-1, -0.5, 2, 1.5, K.dark);
      x.q(2, -4, 15, 2, K.light); // barrel
      x.q(2, -4, 15, 1, K.shine);
      x.q(2, -2, 12, 1.2, K.steel); // tube
      const pu = -p.pump * 4;
      x.q(6 + pu, -2.5, 5, 2.5, K.wood); // pump
      x.q(6 + pu, -2.5, 5, 1, K.woodL);
      for (let i = 0; i < 2; i++) x.q(7 + pu + i * 2, -1, 1, 1, K.wood);
      break;
    }
    case 'sniper': {
      x.q(-12, -3, 10, 3, K.wood); // stock
      x.q(-12, -3, 10, 1, K.woodL);
      x.q(-12, -4, 2, 5, K.wood);
      x.q(-2, -4, 16, 2.5, K.metal); // receiver + forestock
      x.q(-2, -4, 16, 1, K.steel);
      x.q(6, -2, 8, 1.5, K.wood);
      x.q(14, -3.5, 10, 1.2, K.dark); // long barrel
      x.q(22, -4, 2, 2, K.metal); // muzzle brake
      // scope
      x.q(0, -7, 9, 2, K.dark);
      x.q(-1, -7.5, 2, 3, K.ink);
      x.q(8, -7.5, 2, 3, K.ink);
      x.q(9, -7, 1, 1, K.cyan);
      x.q(3, -5, 1, 1, K.dark);
      // bolt
      const bb = -p.bolt * 3;
      x.q(-2 + bb, -4.5, 3, 1, K.light);
      x.q(-1 + bb, -3 + -p.boltUp * 3, 1, 2.5 - p.boltUp, K.light);
      x.q(-1 + bb, -0.5 - p.boltUp * 3.5, 1.6, 1.6, K.steel); // bolt knob
      break;
    }
    case 'minigun': {
      // barrels (spinning stripes)
      const ph = p.barrel;
      for (let i = 0; i < 3; i++) {
        const v = -6 + i * 1.6 + Math.sin(ph + i * 2.1) * 0.6;
        const bright = Math.cos(ph + i * 2.1) > 0;
        x.q(2, v, 17, 1.2, bright ? K.light : K.metal);
      }
      x.q(17, -6.5, 2, 5, K.dark); // muzzle clamp
      x.q(8, -6.5, 1.5, 5, K.dark); // mid clamp
      x.q(-7, -7, 9, 7, K.metal); // motor body
      x.q(-7, -7, 9, 1, K.steel);
      x.q(-5, -5, 5, 3, K.dark);
      x.q(-4, -9, 6, 1.5, K.dark); // top handle
      x.q(-4, -9, 1, 3, K.dark);
      x.q(1, -9, 1, 3, K.dark);
      if (p.box >= 0) {
        x.q(-7, 0 + p.box, 7, 5, K.olive); // ammo box
        x.q(-7, 0 + p.box, 7, 1, K.oliveL);
        x.q(-5, 2 + p.box, 3, 1, K.ink);
        // belt
        for (let i = 0; i < 3; i++) x.q(-1 + i * 1.3, -1 + p.box * 0.5 - i * 0.5, 1, 1.5, K.brass);
      }
      break;
    }
    case 'railgun': {
      const gp = p.gap * 2;
      x.q(-9, -5, 8, 5, K.metal); // body
      x.q(-9, -5, 8, 1, K.steel);
      x.q(-6, 0, 2, 3.5, K.dark); // grip
      if (p.cell >= 0) {
        x.q(-8, -1 + p.cell, 3, 2, K.cyan); // battery
        x.q(-8, -1 + p.cell, 3, 1, 0xd8fdff);
      }
      x.q(-1, -5, 17, 4, K.ink); // core
      // coils
      for (let i = 0; i < 4; i++) {
        const lit = p.cells > i ? Math.min(1, p.cells - i) : 0;
        const c = lit > 0 ? mix(0x1c4a66, K.cyan, lit) : 0x1c2a40;
        x.q(1 + i * 4, -5, 2, 4, c);
        if (lit > 0) x.glow(2 + i * 4, -3, 6, K.cyan, 0.18 * lit + p.charge * 0.25);
      }
      x.q(0, -7 - gp, 20, 1.5, K.light); // upper rail
      x.q(0, -7 - gp, 20, 0.8, K.shine);
      x.q(0, -1 + gp, 20, 1.5, K.light); // lower rail
      x.q(18, -7.5 - gp, 2, 2, K.steel);
      x.q(18, -1 + gp, 2, 2, K.steel);
      if (p.charge > 0) {
        const pulse = 0.6 + 0.4 * Math.sin(time * 60);
        x.q(2, -3.5, 16 * p.charge, 1, mix(K.cyan, 0xffffff, pulse));
        x.glow(19, -3.5, 4 + 10 * p.charge, K.cyan, 0.6 * p.charge);
      }
      break;
    }

    case 'derringer': {
      x.q(-2.5, -1, 3, 3.5, 0xe8e0d0); // pearl grip
      x.q(-2.5, -1, 1, 3.5, 0xffffff);
      x.q(-2.5, 2, 3, 0.8, K.brass);
      x.q(-1.5, -2.5, 3, 1.6, K.brass); // frame
      x.q(0.5, -1, 1.5, 1.2, K.brassD); // spur trigger
      x.q(-2.5, -3.8, 1.5, 1, K.dark); // hammer
      // over-under barrels tip up on the hinge at the front of the frame
      const [hx, hy] = x.pt(0.2, -2.4);
      const B = new Xf(x.g, hx, hy, x.ang - p.tip * 1.1 * x.fy, x.fy);
      B.q(0, -2.6, 7, 1.3, K.light);
      B.q(0, -2.6, 7, 0.6, K.shine);
      B.q(0, -1.3, 7, 1.3, K.steel);
      B.q(6.4, -2.6, 0.8, 2.6, K.metal);
      if (p.tip > 0.3) {
        B.q(-0.2, -2.4, 0.6, 1, K.brass);
        B.q(-0.2, -1.1, 0.6, 1, K.brass);
      }
      break;
    }
    case 'lever': {
      x.q(-8, -3.2, 6, 3, K.wood); // short stock
      x.q(-8, -3.2, 6, 1, K.woodL);
      x.q(-8.5, -3.8, 1.5, 4, K.wood);
      x.q(-2, -4.3, 6, 3.2, 0xa07a30); // brass receiver
      x.q(-2, -4.3, 6, 1, 0xd8b058);
      x.q(-0.5, -3.3, 1, 1, K.dark); // loading gate
      x.q(4, -4.8, 15, 1.4, K.metal); // barrel
      x.q(4, -4.8, 15, 0.6, K.steel);
      x.q(4, -3.4, 12, 1.2, K.dark); // tube magazine
      x.q(5, -3.6, 7, 2.2, K.wood); // forend
      x.q(5, -3.6, 7, 0.8, K.woodL);
      x.q(17.5, -5.6, 1, 1, K.steel); // sight
      // the big loop lever swings down from under the receiver
      const [lx, ly] = x.pt(1, -1.2);
      const L = new Xf(x.g, lx, ly, x.ang + p.lever * 0.9 * x.fy, x.fy);
      L.q(-3, 0, 4, 0.9, K.dark);
      L.q(-3, 2.6, 4.5, 0.9, K.dark);
      L.q(1, 0, 0.9, 3.4, K.dark);
      L.q(-3, 0, 0.9, 3.4, K.dark);
      break;
    }
    case 'rifle': {
      x.q(-10, -3.6, 5.5, 3, K.dark); // stock
      x.q(-10, -4, 1.2, 4.2, K.dark);
      x.q(-4.5, -3.2, 2.5, 1.4, K.metal); // buffer tube
      x.q(-1, -1, 2, 3.5, K.dark); // grip
      if (p.mag >= 0) {
        // curved magazine
        x.q(2.2, -1 + p.mag, 2.3, 3.5, K.ink);
        x.q(2.9, 2.2 + p.mag, 2.3, 2.6, K.ink);
        x.q(2.2, -1 + p.mag, 0.8, 3.5, K.metal);
      }
      x.q(-2, -4.6, 9, 3.5, K.metal); // receiver
      x.q(-2, -4.6, 9, 1, K.steel);
      x.q(7, -4.2, 7, 2.6, K.dark); // handguard
      for (let i = 0; i < 3; i++) x.q(8 + i * 2, -3.4, 1, 0.8, K.ink);
      x.q(14, -3.6, 4, 1, K.dark); // barrel
      x.q(13, -5.8, 1, 1.8, K.dark); // front sight
      x.q(0, -6.6, 4.5, 1.6, K.dark); // red dot
      x.q(3.6, -6.3, 0.9, 1, 0xff4a4a);
      x.glow(4, -5.8, 3, 0xff3a3a, 0.15);
      x.q(-2 - p.handle * 3, -5.4, 1.6, 0.8, K.steel); // charging handle
      break;
    }
    case 'laser': {
      const heatC = p.heat < 0.5 ? mix(0x6af0ff, 0xff6ad8, p.heat * 2) : mix(0xff6ad8, 0xffe0a0, (p.heat - 0.5) * 2);
      x.q(-2, -1, 3, 4, 0x3a3a50); // grip
      x.q(-2, -1, 1, 4, 0x5a5a74);
      x.q(-3, -5, 11, 4, 0xe4e8f2); // white shell
      x.q(-3, -5, 11, 1, 0xffffff);
      x.q(-3, -2, 10, 1, 0xa8b0c8);
      // vent fins lift off the top when it overheats
      const fo = p.fins * 2.2;
      x.q(-1, -6 - fo, 7, 1, 0xc8d0e0);
      x.q(-1, -6 - fo, 7, 0.4, 0xffffff);
      for (let i = 0; i < 3; i++) {
        x.q(0 + i * 2.5, -3.8, 1.6, 1.6, heatC); // heat cells
        x.glow(0.8 + i * 2.5, -3, 3, heatC, 0.15 + p.heat * 0.35);
      }
      x.q(8, -5.6, 2, 5.2, 0x3a3a50); // emitter collar
      x.q(10, -4, 2.5, 2, 0xff6ad8);
      x.q(10.5, -3.6, 1.5, 1.2, 0xffffff);
      x.glow(11, -3, 5, 0xff6ad8, 0.3 + p.heat * 0.3);
      break;
    }
    case 'dbarrel': {
      x.q(-4.5, -1, 3, 4.2, K.wood); // pistol grip
      x.q(-4.5, -1, 1, 4.2, K.woodL);
      x.q(-5, 2.6, 3.5, 1, K.wood);
      x.q(-2.5, -4, 4.5, 3.4, K.metal); // action
      x.q(-2.5, -4, 4.5, 1, K.steel);
      x.q(-0.5, -0.6, 2, 1.2, K.dark);
      x.q(-3, -5, 1.2, 1.2, K.dark); // hammers
      // barrels drop open on the hinge
      const [hx, hy] = x.pt(2, -1.2);
      const B = new Xf(x.g, hx, hy, x.ang + p.brk * 0.75 * x.fy, x.fy);
      B.q(0, -2.8, 10, 1.4, K.light);
      B.q(0, -2.8, 10, 0.5, K.shine);
      B.q(0, -1.4, 10, 1.4, K.steel);
      B.q(0, 0, 6, 1, K.wood); // forend
      B.q(9.4, -2.8, 0.8, 2.8, K.metal);
      if (p.brk > 0.4) {
        B.q(-0.3, -2.6, 0.6, 1.1, 0xd0403a);
        B.q(-0.3, -1.2, 0.6, 1.1, 0xd0403a);
      }
      break;
    }
    case 'cannon': {
      const s = -p.slide * 3.5;
      x.q(-3, -1, 3.6, 4.6, K.dark); // grip
      x.q(-3, -1, 1, 4.6, K.metal);
      if (p.mag >= 0) x.q(-2.6, 3.6 + p.mag, 3, 1.2, K.steel);
      x.q(-2, -2.6, 10, 2, K.metal); // frame
      x.q(1, -0.6, 3, 1.2, K.dark); // trigger guard
      x.q(-3 + s, -6, 15, 3.4, 0xc8ccd8); // big slide
      x.q(-3 + s, -6, 15, 1, K.shine);
      x.q(-2 + s, -4, 2, 1, K.dark); // serrations
      x.q(6 + s, -5, 5, 1, K.brass);
      x.q(11.5 + s, -5.6, 1.2, 2.6, K.steel);
      x.q(-3.5, -6.8, 1.5, 1, K.dark); // hammer
      break;
    }
    case 'musket': {
      // ramrod first so the barrel hides the part that's inside
      if (p.rod >= 0) {
        const depth = p.rod * 18;
        x.q(27 - depth, -3.9, 20, 0.7, 0xd8c8a0);
        x.q(27 - depth + 19, -4.2, 1.2, 1.3, K.brass);
      }
      x.q(-14, -3, 13, 3.2, K.wood); // stock
      x.q(-14, -3, 13, 1, K.woodL);
      x.q(-15, -4, 2, 5.4, K.wood); // butt
      x.q(0, -2.6, 21, 1.8, K.woodL); // forestock
      x.q(0, -4.2, 27, 1.6, K.metal); // long barrel
      x.q(0, -4.2, 27, 0.6, K.steel);
      x.q(8, -4.4, 1, 3.6, K.brass); // bands
      x.q(18, -4.4, 1, 3.6, K.brass);
      if (p.rod < 0) x.q(3, -0.9, 19, 0.7, 0xd8c8a0); // stowed ramrod
      x.q(-3.5, -4.8, 5, 2.4, K.metal); // lock plate
      x.q(-0.5, -5.2, 2, 1, K.brass); // pan
      // hammer with its flint: cocked back, or fallen forward onto the pan
      const [hx, hy] = x.pt(-2.5, -4.5);
      const H = new Xf(x.g, hx, hy, x.ang + (-0.9 + p.hammer * 1.5) * x.fy, x.fy);
      H.q(-0.5, -3, 1.2, 3, K.dark);
      H.q(-0.6, -3.6, 1.6, 1, 0x9a8a70);
      if (p.pan > 0) {
        x.q(0, -6.5, 1.5, 1.5, 0xffffff, p.pan);
        x.glow(0.5, -5.6, 6, 0xffb060, 0.9 * p.pan);
      }
      break;
    }
    case 'launcher': {
      x.q(-10, -4.4, 6.5, 1.4, K.dark); // skeleton stock
      x.q(-10, -4.4, 1.4, 5.4, K.dark);
      x.q(-10, -0.4, 6, 1, K.dark);
      x.q(-3.5, -3.6, 3.5, 1.4, K.metal);
      x.q(-2, -1, 2, 3.8, K.dark); // grip
      // the revolving drum, swung out for loading
      const dv = p.drumOut * 3.5;
      x.q(0, -7.5 + dv, 8, 7.5, K.olive);
      x.q(0, -7.5 + dv, 8, 1, K.oliveL);
      for (let i = 0; i < 4; i++) {
        const ph = ((i + p.drum) % 4) / 4;
        const v = -7 + dv + ph * 6.8;
        const front = Math.sin(ph * Math.PI);
        x.q(0.6, v, 6.8, 1.1, front > 0.6 ? K.oliveL : mix(K.olive, 0x000000, 0.35));
        if (front > 0.6) x.q(0.6, v, 0.8, 1.1, K.brass);
      }
      x.q(8, -6, 10, 3.2, K.metal); // fat barrel
      x.q(8, -6, 10, 1, K.steel);
      x.q(17.4, -6.6, 1.6, 4.4, K.dark);
      x.q(10, -2.8, 1.6, 3.4, K.dark); // foregrip
      x.q(-1, -8.8, 12, 1, K.dark); // rail
      x.q(6, -10.2, 2, 1.4, K.dark);
      break;
    }
  }
  if (p.hand2) hand(x, p.hand2[0], p.hand2[1], p.handC);
  void g;
}

// ---------------- swords ----------------
export const BLADE_LEN: Record<SwordLook, number> = {
  tanto: 10,
  gladius: 16,
  axe: 16,
  halberd: 31,
  hammer: 24,
  flamberge: 28,
  chainsword: 17,
  glaive: 18,
  voidblade: 20,
  starblade: 22,
  dagger: 9,
  longsword: 17,
  rapier: 23,
  katana: 19,
  greatsword: 25,
  scythe: 18,
  saber: 16,
  cleaver: 11,
  katar: 9,
  spear: 30,
  nodachi: 27,
  twinblade: 23,
  whip: 15,
  plasma: 21,
};

/** `amt`: plasma ignition / whip blade closed (1) or flying out as a chain (handled by the controller) */
export function drawSword(x: Xf, kind: SwordLook, color: number, time: number, sheathed = false, amt = 1, chainOut = false) {
  const hi = mix(color, 0xffffff, 0.6);
  const lo = mix(color, 0x202030, 0.45);
  switch (kind) {
    case 'tanto': {
      x.q(-4.5, -1, 4.5, 2, 0x2a1e2a);
      for (let i = 0; i < 2; i++) x.tri(-4 + i * 2, -1, -3 + i * 2, 0, -4 + i * 2, 1, 0xd8d0e8);
      x.q(0, -1.8, 0.8, 3.6, K.brass);
      x.q(1, -1.1, 8, 2.2, lo);
      x.q(1, -1.1, 8, 0.8, color);
      x.q(1, 0.6, 8, 0.5, 0xffffff);
      x.tri(9, -1.1, 9, 1.1, 11, -0.6, color);
      break;
    }
    case 'gladius': {
      x.disc(-5.5, 0, 1.4, K.brass); // pommel
      x.q(-4.5, -1, 4.5, 2, 0x4a2a1a);
      x.q(-0.4, -2.6, 1.6, 5.2, K.brass);
      // broad leaf blade
      x.q(1.5, -1.8, 12, 3.6, lo);
      x.q(1.5, -1.8, 12, 1.8, color);
      x.q(2, -1.8, 11, 0.6, hi);
      x.tri(13.5, -1.8, 13.5, 1.8, 17, 0, color);
      break;
    }
    case 'axe': {
      x.q(-6, -0.9, 20, 1.8, K.wood); // haft
      x.q(-6, -0.9, 20, 0.6, K.woodL);
      x.q(-6.5, -1.2, 1, 2.4, K.metal);
      x.q(10, -2.2, 3, 4.4, K.metal); // socket
      x.q(10.5, -6, 4, 8.4, lo); // bearded bit
      x.tri(14.5, -6, 14.5, 2.4, 17, 4.6, lo);
      x.tri(14.5, -6, 17, -7.6, 14.5, 2.4, lo);
      x.q(10.5, -6, 4, 1.4, color);
      x.tri(16.6, -7.4, 17.2, -7.4, 16.8, 4.4, 0xffffff); // edge
      break;
    }
    case 'halberd': {
      x.q(-18, -0.8, 40, 1.6, 0x4a3020);
      x.q(-18, -0.8, 40, 0.5, 0x6a4a30);
      x.q(-18.5, -1.1, 1.2, 2.2, K.metal);
      x.q(21.5, -1.2, 2.2, 2.4, K.brass);
      x.q(22, -6.2, 5, 5.4, lo); // axe blade
      x.q(22, -6.2, 5, 1.4, color);
      x.q(26.4, -6.2, 0.7, 5.4, 0xffffff);
      x.tri(23, 0.8, 26, 0.8, 24, 3.6, K.metal); // back hook
      x.tri(23.5, -1.4, 23.5, 1.4, 31, 0, color); // spike
      break;
    }
    case 'hammer': {
      x.q(-9, -1, 26, 2, 0x3a2a30); // haft
      for (let i = 0; i < 4; i++) x.q(-8 + i * 2, -1, 0.8, 2, 0x5a4a50);
      x.q(-9.5, -1.4, 1.2, 2.8, 0x6a6e80);
      x.q(17, -5, 7, 10, 0x5a5e70); // head
      x.q(17, -5, 7, 2, 0x8a8ea0);
      x.q(23, -5, 1, 10, 0x3a3e50);
      x.tri(17, -5, 17, -2, 13.5, -3.5, 0x6a6e80); // back spike
      for (let i = 0; i < 2; i++) {
        const k = 0.5 + 0.5 * Math.sin(time * 4 + i * 2);
        x.q(19 + i * 2, -1, 1, 1, mix(0x2a3a6a, 0x7ab0ff, k));
        x.glow(19.5 + i * 2, -0.5, 3, 0x7ab0ff, 0.12 * k);
      }
      break;
    }
    case 'flamberge': {
      x.q(-7, -1, 7, 2, 0x3a2030);
      x.q(-7.5, -1.2, 0.8, 2.4, K.brass);
      x.q(0, -4, 1.4, 8, K.brass);
      x.q(-0.6, -4.4, 1, 1, K.brass);
      x.q(-0.6, 3.4, 1, 1, K.brass);
      x.q(1.4, -1.2, 3, 2.4, lo); // ricasso
      for (let i = 0; i < 9; i++) {
        const off = Math.sin(i * 1.4) * 0.7;
        x.q(4 + i * 2.6, -1.4 + off, 2.8, 2.8, lo);
        x.q(4 + i * 2.6, -1.4 + off, 2.8, 1.1, color);
        x.q(4 + i * 2.6, 1 + off, 2.8, 0.4, 0xffffff);
      }
      x.tri(27.4, -1.4, 27.4, 1.4, 30, 0, color);
      x.glow(15, 0, 10, color, 0.08);
      break;
    }
    case 'chainsword': {
      x.q(-5, -1.2, 5, 2.4, 0x2a2a32);
      x.q(-3, -2.4, 2.5, 1.2, 0xff6a4a); // engine
      x.q(-0.5, -3, 1.6, 6, 0x3a3a44);
      x.q(1, -2, 15, 4, 0x4a4e5c); // bar
      x.q(1, -2, 15, 1, 0x7a7e8c);
      x.disc(16, 0, 2, 0x4a4e5c);
      // teeth running round the bar
      const ph = (time * 40) % 2;
      for (let i = 0; i < 8; i++) {
        x.q(1.5 + i * 2 + ph, -2.8, 1, 0.8, 0xff6a4a);
        x.q(15.5 - i * 2 - ph, 1.9, 1, 0.8, 0xff6a4a);
      }
      break;
    }
    case 'glaive': {
      x.q(-16, -1, 34, 2, 0x1e2a3a);
      x.q(-16, -1, 34, 0.7, 0x3a4a5e);
      x.q(-17, -1.5, 1.5, 3, 0x9fb8d0);
      x.q(17, -2, 2, 4, 0x9fb8d0);
      // a long crescent knife-blade carrying on from the haft
      for (let i = 0; i < 8; i++) {
        const u = 19 + i * 1.8, v = -(i * i) * 0.09;
        const w = 3.6 * (1 - i / 10);
        x.q(u, v - w / 2, 2, w, lo);
        x.q(u, v - w / 2, 2, w * 0.4, color);
        x.glow(u, v, 4, 0x9fd8ff, 0.06);
      }
      x.tri(33.4, -5.1, 33.4, -3.9, 35.5, -5.8, color);
      break;
    }
    case 'voidblade': {
      x.q(-7, -1, 7, 2, 0x120c1e);
      for (let i = 0; i < 3; i++) x.tri(-6.5 + i * 2.2, -1, -5.4 + i * 2.2, 0, -6.5 + i * 2.2, 1, 0x8a6ad0);
      x.q(-7.5, -1, 0.8, 2, 0xc89aff);
      x.q(0, -2.2, 1, 4.4, 0x3a2a58);
      if (sheathed) {
        x.q(1, -1.6, 19, 3.2, 0x120c1e);
        x.q(1, -1.6, 19, 0.8, 0x4a3a70);
        x.q(19, -1.6, 1.5, 3.2, 0xc89aff);
      } else {
        for (let i = 0; i < 6; i++) {
          const u = 1 + i * 3, curve = -(i * i) * 0.05;
          x.q(u, -1 + curve, 3.2, 2, 0x1a1028);
          x.q(u, 0.4 + curve, 3.2, 0.6, color); // violet edge
        }
        x.tri(19, -2.25, 19, -0.25, 21, -1.6, color);
        x.glow(10, -0.5, 10, color, 0.15);
      }
      break;
    }
    case 'starblade': {
      x.q(-5, -1.3, 6, 2.6, 0xc8a050);
      x.q(-4, -1.3, 0.8, 2.6, 0x7a5a20);
      x.q(-1.8, -1.3, 0.8, 2.6, 0x7a5a20);
      x.q(1, -1.8, 1.2, 3.6, 0xffe08a);
      x.q(-5.6, -0.6, 0.6, 1.2, 0xffffff);
      if (amt > 0.01) {
        const L = 21 * amt;
        x.q(2.2, -1.9, L, 3.8, color, 0.5);
        x.q(2.2, -1.1, L, 2.2, mix(color, 0xffffff, 0.6));
        x.q(2.2, -0.5, L + 0.5, 1, 0xffffff);
        x.tri(2.2 + L, -1.1, 2.2 + L, 1.1, 4 + L, 0, 0xffffff);
        // stars caught in the blade
        for (let i = 0; i < 3; i++) {
          const u = 4 + ((time * 9 + i * 7) % Math.max(1, L - 2));
          x.q(u, -0.6 + Math.sin(i * 5) * 0.8, 0.8, 0.8, 0xffffff);
        }
        const [ax, ay] = x.pt(2.2, 0), [bx, by] = x.pt(2.2 + L, 0);
        x.g.glowLine(ax, ay, bx, by, 7, color, 0.5 * amt);
      }
      break;
    }
    case 'dagger': {
      x.q(-4, -1, 4, 2, 0x5a3a2a);
      x.q(-4, -1, 4, 0.8, 0x80563c);
      x.q(-5, -1, 1, 2, 0x8a7a6a);
      x.q(0, -2.5, 1.2, 5, 0x8a7a6a); // guard
      x.q(1, -1, 7, 2, lo);
      x.q(1, -1, 7, 1, color);
      x.q(2, -1, 5, 0.6, hi);
      x.tri(8, -1, 8, 1, 10.5, -0.2, color);
      // rust specks
      x.q(4, 0, 1, 1, 0x8a5a3a);
      break;
    }
    case 'longsword': {
      x.q(-6, -1.2, 1.5, 2.4, K.brass); // pommel
      x.q(-5, -1, 5, 2, 0x3a2a40); // leather grip
      for (let i = 0; i < 3; i++) x.q(-4.5 + i * 1.6, -1, 0.7, 2, 0x5a4460);
      x.q(0, -3.5, 1.5, 7, K.brass); // crossguard
      x.q(0, -3.5, 1.5, 1, 0xffe08a);
      x.q(1.5, -1.5, 14, 3, lo);
      x.q(1.5, -1.5, 14, 1.5, color);
      x.q(2.5, -0.5, 11, 1, mix(lo, 0x000000, 0.2)); // fuller
      x.q(2, -1.5, 13, 0.6, hi);
      x.tri(15.5, -1.5, 15.5, 1.5, 18.5, 0, color);
      break;
    }
    case 'rapier': {
      x.q(-4, -0.8, 4, 1.6, 0x2a2a3a);
      x.q(-5, -1, 1, 2, 0xd0d4e4);
      x.disc(0.5, 0, 2.6, 0xaab0c8); // cup guard
      x.disc(0.2, -0.6, 1.4, 0xe8ecff);
      x.q(-3, 2, 4, 0.7, 0xaab0c8); // knuckle bow
      x.q(1, -0.5, 22, 1, color);
      x.q(1, -0.5, 18, 0.5, hi);
      x.q(22, -0.5, 1.5, 0.7, 0xffffff);
      break;
    }
    case 'katana': {
      // tsuka with wrap pattern
      x.q(-7, -1, 7, 2, 0x1a1420);
      for (let i = 0; i < 3; i++) x.tri(-6.5 + i * 2.2, -1, -5.4 + i * 2.2, 0, -6.5 + i * 2.2, 1, 0xd8d0e8);
      x.q(-7.5, -1, 0.8, 2, K.brass);
      x.q(0, -2.2, 1, 4.4, K.brass); // tsuba
      if (sheathed) {
        // scabbard (saya)
        x.q(1, -1.6, 18, 3.2, 0x3a1020);
        x.q(1, -1.6, 18, 1, 0x7a2438);
        x.q(1, -1.6, 2, 3.2, 0x1a0810);
        x.q(18, -1.6, 1.5, 3.2, K.brass);
      } else {
        // slightly curved blade: segments rising toward the tip
        for (let i = 0; i < 6; i++) {
          const u = 1 + i * 3, curve = -(i * i) * 0.05;
          x.q(u, -1 + curve, 3.2, 2, lo);
          x.q(u, -1 + curve, 3.2, 0.8, color);
          x.q(u, 0.4 + curve, 3.2, 0.6, 0xffffff); // hamon edge
        }
        x.tri(19, -1 - 1.25, 19, 1 - 1.25, 21, -1.6, color);
      }
      break;
    }
    case 'greatsword': {
      x.q(-9, -1.5, 1.5, 3, 0x6a6a80); // pommel
      x.q(-8, -1.2, 8, 2.4, 0x2a2030);
      for (let i = 0; i < 4; i++) x.q(-7.5 + i * 2, -1.2, 0.8, 2.4, 0x4a3a50);
      x.q(0, -5, 2.5, 10, 0x3a3a4c); // heavy guard
      x.q(0, -5, 2.5, 1.5, 0x6a6a80);
      x.q(2.5, -2.5, 22, 5, lo);
      x.q(2.5, -2.5, 22, 2.5, color);
      x.q(3, -2.5, 21, 0.8, hi);
      x.q(4, -0.5, 16, 1, mix(lo, 0x000000, 0.25));
      // runes that glow
      for (let i = 0; i < 4; i++) {
        const k = 0.5 + 0.5 * Math.sin(time * 4 + i * 1.3);
        x.q(6 + i * 4, -0.6, 1, 1, mix(0x6a2a1a, 0xff8a3a, k));
        x.glow(6.5 + i * 4, 0, 3, 0xff7a2a, 0.12 * k);
      }
      x.tri(24.5, -2.5, 24.5, 2.5, 28, 0, color);
      break;
    }
    case 'scythe': {
      // shaft runs both ways from the hand
      x.q(-16, -1, 34, 2, 0x2a1e2e);
      x.q(-16, -1, 34, 0.7, 0x4a3a50);
      x.q(-17, -1.5, 1.5, 3, 0x8a7aa0);
      x.q(17, -2, 2, 4, 0x8a7aa0);
      // curved blade at the end, sweeping to -y then back
      const pts: [number, number][] = [];
      for (let i = 0; i <= 8; i++) {
        const a = i / 8;
        // leaves the shaft head sideways, then hooks back toward the hand
        pts.push([18 - a * a * 11, -2 - a * 12 + a * a * 3]);
      }
      for (let i = 0; i < 8; i++) {
        const [u0, v0] = pts[i], [u1, v1] = pts[i + 1];
        const w = 3.2 * (1 - i / 9);
        x.tri(u0, v0, u1, v1, u0 + 0.5, v0 + w, lo);
        x.tri(u1, v1, u1 + 0.5, v1 + w * 0.8, u0 + 0.5, v0 + w, lo);
        x.tri(u0, v0, u1, v1, u0 + 0.3, v0 + 1, color);
      }
      for (let i = 0; i < 8; i++) {
        const [u0, v0] = pts[i];
        x.glow(u0, v0, 4, 0xb07aff, 0.07);
      }
      break;
    }
    case 'saber': {
      x.q(-5, -1, 5, 2, 0x3a2a24); // grip
      x.q(-6, -1.2, 1, 2.4, K.brass);
      x.q(-5, 1.6, 5.5, 0.8, K.brass); // knuckle bow
      x.q(-0.5, -2.2, 1.2, 4.6, K.brass);
      // single-edged, curving more toward the tip
      for (let i = 0; i < 5; i++) {
        const u = 0.7 + i * 3, curve = -(i * i) * 0.09;
        x.q(u, -1.2 + curve, 3.2, 2.2, lo);
        x.q(u, -1.2 + curve, 3.2, 0.9, color);
        x.q(u, 0.6 + curve, 3.2, 0.5, 0xffffff);
      }
      x.tri(15.7, -1.2 - 1.44, 15.7, 1 - 1.44, 18.4, -2.2, color);
      break;
    }
    case 'cleaver': {
      x.q(-5.5, -1, 5.5, 2, K.wood);
      x.q(-5.5, -1, 5.5, 0.7, K.woodL);
      x.q(-4.5, -0.4, 0.8, 0.8, K.brass); // rivets
      x.q(-2.5, -0.4, 0.8, 0.8, K.brass);
      x.q(0, -4.2, 11, 6, lo); // slab blade
      x.q(0, -4.2, 11, 1.6, color);
      x.q(0, 1.2, 11, 0.6, 0xffffff); // edge
      x.q(0, -4.2, 0.8, 6, mix(lo, 0x000000, 0.3));
      x.q(8, -3.2, 1.4, 1.4, 0x14121f); // hanging hole
      break;
    }
    case 'katar': {
      // H-shaped grip: the fist closes on the crossbar, side bars along the forearm
      x.q(-4.5, -2.6, 4.5, 0.9, K.brass);
      x.q(-4.5, 1.7, 4.5, 0.9, K.brass);
      x.q(-1.4, -2.6, 0.9, 5.2, K.brassD);
      x.q(-0.2, -2.6, 0.8, 5.2, K.brass);
      x.tri(0.6, -2.2, 0.6, 2.2, 9.5, 0, lo);
      x.tri(0.6, -2.2, 0.6, 0, 9.5, 0, color);
      x.q(1, -0.3, 6, 0.6, hi);
      break;
    }
    case 'spear': {
      x.q(-18, -0.8, 40, 1.6, 0x5a3a24); // shaft
      x.q(-18, -0.8, 40, 0.5, 0x7a5434);
      x.q(-18.5, -1.1, 1.2, 2.2, K.metal); // butt cap
      for (let i = 0; i < 3; i++) x.q(-3 + i * 1.6, -0.9, 0.6, 1.8, 0x3a2418); // wrap
      x.q(19, -1.8, 1.2, 3.6, 0xc83a3a); // tassel
      x.q(19.2, 1.6, 0.8, 1.4, 0xa02a2a);
      x.q(21.5, -1.2, 2.2, 2.4, K.brass); // socket
      x.tri(23.5, -2.3, 23.5, 2.3, 31, 0, lo);
      x.tri(23.5, -2.3, 23.5, 0, 31, 0, color);
      x.q(24, -0.3, 5, 0.6, hi);
      break;
    }
    case 'nodachi': {
      x.q(-10, -1, 10, 2, 0x1a1420); // long tsuka
      for (let i = 0; i < 4; i++) x.tri(-9.5 + i * 2.3, -1, -8.4 + i * 2.3, 0, -9.5 + i * 2.3, 1, 0xd8d0e8);
      x.q(-10.5, -1, 0.8, 2, K.brass);
      x.q(0, -2.4, 1.1, 4.8, K.brass); // tsuba
      if (sheathed) {
        x.q(1, -1.7, 27, 3.4, 0x20142a);
        x.q(1, -1.7, 27, 1, 0x4a3a66);
        x.q(1, -1.7, 2, 3.4, 0x0e0816);
        x.q(27, -1.7, 1.5, 3.4, K.brass);
      } else {
        for (let i = 0; i < 9; i++) {
          const u = 1 + i * 3, curve = -(i * i) * 0.025;
          x.q(u, -1 + curve, 3.2, 2, lo);
          x.q(u, -1 + curve, 3.2, 0.8, color);
          x.q(u, 0.4 + curve, 3.2, 0.6, 0xffffff);
        }
        x.tri(28, -1 - 1.6, 28, 1 - 1.6, 30.5, -2.1, color);
      }
      break;
    }
    case 'twinblade': {
      x.q(-10, -1, 20, 2, 0x2a2232); // staff
      x.q(-10, -1, 20, 0.6, 0x4a3e58);
      x.q(-1.5, -1.2, 3, 2.4, 0x6a3a24); // centre grip
      for (const sgn of [1, -1]) {
        x.q(sgn > 0 ? 9 : -10.5, -1.6, 1.5, 3.2, K.brass);
        const b0 = sgn > 0 ? 10.5 : -20.5;
        x.q(b0, -1.3, 10, 2.6, lo);
        x.q(b0, -1.3, 10, 1, color);
        x.q(b0 + 1, 0.8, 8, 0.5, 0xffffff);
        if (sgn > 0) x.tri(20.5, -1.3, 20.5, 1.3, 23.5, 0, color);
        else x.tri(-20.5, -1.3, -20.5, 1.3, -23.5, 0, color);
      }
      break;
    }
    case 'whip': {
      x.q(-5, -1, 5, 2, 0x24343a);
      x.q(-6, -1.3, 1, 2.6, K.metal);
      x.q(-0.2, -2.6, 1.4, 5.2, 0x4a6a6a); // guard
      if (!chainOut) {
        // the blade at rest: plates snapped together, seams visible
        for (let i = 0; i < 5; i++) {
          x.q(1.4 + i * 2.7, -1.2, 2.4, 2.4, lo);
          x.q(1.4 + i * 2.7, -1.2, 2.4, 0.9, color);
          x.q(1.4 + i * 2.7, 0.7, 2.4, 0.5, hi);
        }
        x.tri(14.9, -1.2, 14.9, 1.2, 17.5, 0, color);
      }
      break;
    }
    case 'plasma': {
      x.q(-5, -1.3, 6, 2.6, 0x6a6a7c); // hilt
      x.q(-4, -1.3, 0.8, 2.6, 0x2a2a3a);
      x.q(-1.8, -1.3, 0.8, 2.6, 0x2a2a3a);
      x.q(-5.5, -1, 0.6, 2, 0x3a3a4a);
      x.q(1, -1.6, 1.2, 3.2, 0xa0a0b4); // emitter
      x.q(-3, 1.2, 1.5, 0.8, 0xff4a6a); // button
      if (amt > 0.01) {
        const L = 20 * amt;
        const flick = 0.8 + 0.2 * Math.sin(time * 70);
        x.q(2.2, -1.8, L, 3.6, color, 0.55); // outer glow body
        x.q(2.2, -1.1, L, 2.2, mix(color, 0xffffff, 0.5));
        x.q(2.2, -0.5, L + 0.5, 1, 0xffffff); // white core
        x.tri(2.2 + L, -1.1, 2.2 + L, 1.1, 3.6 + L, 0, mix(color, 0xffffff, 0.5));
        const [ax, ay] = x.pt(2.2, 0), [bx, by] = x.pt(2.2 + L, 0);
        x.g.glowLine(ax, ay, bx, by, 6, color, 0.45 * flick * amt);
      }
      break;
    }
  }
}

// ---------------- the cube ----------------
export function drawCube(g: Gfx, skin: SkinDef, cx: number, cy: number, s: number, ang: number, time: number, sx = 1, sy = 1, whiteFlash = 0) {
  const hw = (s * sx) / 2, hh = (s * sy) / 2;
  const kind = skin.kind;
  const A = skin.a, B = skin.b;
  const edge = mix(B, 0x000000, 0.55);
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const ox = g.ox, oy = g.oy;
  const ext = Math.ceil(Math.max(hw, hh) * 1.5) + 1;
  const x0 = Math.floor(cx - ext + ox), x1 = Math.ceil(cx + ext + ox);
  const y0 = Math.floor(cy - ext + oy), y1 = Math.ceil(cy + ext + oy);
  const shine = ((time * 0.6) % 1.6) * 2 - 1.2;
  for (let iy = y0; iy <= y1; iy++) {
    if (iy < 0 || iy >= g.h) continue;
    for (let ix = x0; ix <= x1; ix++) {
      if (ix < 0 || ix >= g.w) continue;
      const wx = ix + 0.5 - ox - cx, wy = iy + 0.5 - oy - cy;
      const u = wx * cs + wy * sn, v = -wx * sn + wy * cs;
      if (u < -hw || u >= hw || v < -hh || v >= hh) continue;
      // normalised -1..1 and pixel position inside the cube
      const nu = u / hw, nv = v / hh;
      const pu = Math.floor(u + hw), pv = Math.floor(v + hh);
      const isEdge = u < -hw + 1 || u >= hw - 1 || v < -hh + 1 || v >= hh - 1;
      const isTL = !isEdge && (u < -hw + 2 || v < -hh + 2);
      const isBR = !isEdge && (u >= hw - 2 || v >= hh - 2);
      let c = A;
      switch (kind) {
        case 'flat':
          c = isTL ? mix(A, 0xffffff, 0.45) : isBR ? B : A;
          break;
        case 'checker':
          c = ((pu >> 2) + (pv >> 2)) & 1 ? A : B;
          if (isTL) c = mix(c, 0xffffff, 0.3);
          break;
        case 'stripe':
          c = Math.floor((pu + pv + time * 10) / 3) & 1 ? A : B;
          if (isBR) c = mix(c, 0x000000, 0.25);
          break;
        case 'neon':
          c = u < -hw + 2 || u >= hw - 2 || v < -hh + 2 || v >= hh - 2 ? A : B;
          if (!isEdge && c === B && ((pu + pv) & 3) === 0) c = mix(B, A, 0.2);
          break;
        case 'jelly': {
          const wob = Math.sin(time * 5 + nu * 2) * 0.15;
          const d = (nu + 0.35) ** 2 + (nv + 0.35 + wob) ** 2;
          c = d < 0.12 ? 0xffffff : d < 0.35 ? mix(A, 0xffffff, 0.4) : isBR ? B : A;
          break;
        }
        case 'gold': {
          const band = nu + nv - shine * 2;
          c = Math.abs(band) < 0.25 ? 0xfffbe6 : Math.abs(band) < 0.5 ? mix(A, 0xffffff, 0.5) : isTL ? mix(A, 0xffffff, 0.35) : isBR ? B : A;
          break;
        }
        case 'lava': {
          const n = Math.sin(pu * 1.7 + time * 1.3) + Math.sin(pv * 1.3 - time) + Math.sin((pu + pv) * 0.9 + time * 2);
          c = Math.abs(n) < 0.45 ? mix(A, 0xffe08a, 0.5 + 0.5 * Math.sin(time * 6 + pu)) : isTL ? mix(B, 0x6a4a40, 0.6) : B;
          break;
        }
        case 'galaxy': {
          const h = hash2(pu, pv);
          const tw = Math.sin(time * 4 + h * 40);
          c = h > 0.93 && tw > 0.2 ? 0xffffff : h > 0.86 ? mix(B, A, 0.8) : mix(B, A, 0.25 + 0.2 * Math.sin(nu * 2 + time) * Math.cos(nv * 2));
          break;
        }
        case 'prism':
          c = hsv(time * 0.25 + (nu + nv) * 0.18, 0.55, 1);
          if (isBR) c = mix(c, 0x303050, 0.4);
          if (isTL) c = mix(c, 0xffffff, 0.5);
          break;
      }
      if (isEdge) c = kind === 'neon' ? A : kind === 'prism' ? hsv(time * 0.25 + 0.5, 0.7, 0.55) : edge;
      if (whiteFlash > 0) c = mix(c, 0xffffff, whiteFlash);
      g.col[iy * g.w + ix] = c;
    }
  }
  if (kind === 'neon') g.glow(cx, cy, s * 1.4, A, 0.35);
  if (kind === 'lava') g.glow(cx, cy, s * 1.2, A, 0.22 + 0.08 * Math.sin(time * 5));
  if (kind === 'galaxy') g.glow(cx, cy, s * 1.1, A, 0.15);
  if (kind === 'gold') g.glow(cx, cy, s, 0xffd25a, 0.1);
  if (kind === 'prism') g.glow(cx, cy, s * 1.2, hsv(time * 0.25, 0.6, 1), 0.18);
}

/** hand colour that matches a skin */
export const handColor = (skin: SkinDef) => (skin.kind === 'neon' || skin.kind === 'galaxy' || skin.kind === 'lava' ? skin.a : mix(mix(skin.a, skin.b, 0.6), 0x000000, 0.12));

export { K as PAL, TAU };
