// Weapon and cube pixel art, all drawn from rectangles in a local frame.
// Local frame: origin at the gripping hand, +x along the barrel / blade, +y "below".
import { Gfx, Xf } from '../engine/gfx';
import { TAU, hash2, hsv, mix } from '../engine/math';
import type { GunKind, SkinDef, SwordKind } from './data';

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
  hand2: [number, number] | null;
  handC: number;
}

export const blankPose = (): GunPose => ({
  slide: 0, mag: 0, cyl: 0, pump: 0, bolt: 0, boltUp: 0, handle: 0, box: 0, barrel: 0, gap: 0, cells: 4, charge: 0, cell: 0, hand2: null, handC: 0x999999,
});

export const MUZZLE: Record<GunKind, [number, number]> = {
  pistol: [10, -3],
  revolver: [13, -3.5],
  smg: [14, -2.5],
  shotgun: [17, -3],
  sniper: [24, -3],
  minigun: [20, -3.5],
  railgun: [20, -3.5],
};
/** where casings leave the gun */
export const PORT: Record<GunKind, [number, number]> = {
  pistol: [3, -4], revolver: [1, -3], smg: [4, -4], shotgun: [1, -4], sniper: [-1, -4], minigun: [-2, -2], railgun: [-4, -4],
};

export function hand(x: Xf, u: number, v: number, c: number) {
  x.q(u - 1.5, v - 1.5, 3, 3, mix(c, 0x000000, 0.35));
  x.q(u - 1.5, v - 1.5, 2, 2, c);
}

export function drawGun(x: Xf, kind: GunKind, p: GunPose, time: number) {
  const g = x.g;
  switch (kind) {
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
  }
  if (p.hand2) hand(x, p.hand2[0], p.hand2[1], p.handC);
  void g;
}

// ---------------- swords ----------------
export const BLADE_LEN: Record<SwordKind, number> = {
  dagger: 9,
  longsword: 17,
  rapier: 23,
  katana: 19,
  greatsword: 25,
  scythe: 18,
};

export function drawSword(x: Xf, kind: SwordKind, color: number, time: number, sheathed = false) {
  const hi = mix(color, 0xffffff, 0.6);
  const lo = mix(color, 0x202030, 0.45);
  switch (kind) {
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
export const handColor = (skin: SkinDef) => (skin.kind === 'neon' || skin.kind === 'galaxy' || skin.kind === 'lava' ? skin.a : mix(skin.a, skin.b, 0.5));

export { K as PAL, TAU };
