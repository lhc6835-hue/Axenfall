import { Gfx } from '../engine/gfx';
import { TAU, angDiff, clamp, hsv, lerp, rand, spring } from '../engine/math';
import { sfx } from '../engine/audio';
import type { Input } from '../engine/input';
import { drawCube, handColor } from './art';
import type { GunDef, SkinDef, SwordDef } from './data';
import { GunCtl, SwordCtl } from './weapons';
import type { Run } from './run';

interface Ghost { x: number; y: number; ang: number; life: number; c: number }

export class Player {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  hp: number;
  inv = 0;
  dashT = 0;
  dashCd = 0;
  dashX = 1;
  dashY = 0;
  tilt = 0;
  sx = 1;
  sy = 1;
  walk = 0;
  gun: GunCtl;
  sword: SwordCtl;
  skin: SkinDef;
  moveAng = 0;
  ghosts: Ghost[] = [];
  swordAim = 0;
  hurtFlash = 0;
  dead = false;
  size = 11;
  /** sprung body reactions to blade work: a twist and a squash along kSqA */
  kRot = 0;
  kRotV = 0;
  kSq = 0;
  kSqV = 0;
  kSqA = 0;
  /** where the hands carry the weapons, relative to the body: they trail motion and bob with the step */
  carryX = 0;
  carryY = 0;

  constructor(private run: Run, gun: GunDef, gunLvl: number, sword: SwordDef, swordLvl: number, skin: SkinDef) {
    this.gun = new GunCtl(gun, gunLvl, run);
    this.sword = new SwordCtl(sword, swordLvl, run);
    this.skin = skin;
    this.hp = run.mods.maxHp;
  }

  get speed() {
    let s = 92 * this.run.mods.speed;
    if (this.gun.def.kind === 'minigun' && this.gun.firing > 0) s *= 0.8;
    const sk = this.sword.def.kind;
    if ((sk === 'greatsword' || sk === 'nodachi') && this.sword.busy) s *= 0.7;
    if (this.gun.def.kind === 'musket' && this.gun.reloading) s *= 0.75;
    return s;
  }

  update(dt: number, input: Input | null, time: number) {
    const run = this.run;
    let mx = 0, my = 0;
    if (input && !this.dead) [mx, my] = input.move();
    if (mx || my) this.moveAng = Math.atan2(my, mx);

    // ---- dash ----
    this.dashCd -= dt;
    if (input && input.take('dash') && this.dashCd <= 0 && !this.dead) {
      const a = mx || my ? Math.atan2(my, mx) : this.moveAng;
      this.dashX = Math.cos(a);
      this.dashY = Math.sin(a);
      this.dashT = 0.16;
      this.dashCd = 1.1 * Math.max(0.3, run.mods.dashCd);
      this.inv = Math.max(this.inv, 0.22);
      sfx.dash();
      run.fx.dust(this.x, this.y + 5, 6, a + Math.PI, 0.8);
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashX * 330;
      this.vy = this.dashY * 330;
      if (Math.random() < 0.9) this.ghosts.push({ x: this.x, y: this.y, ang: this.tilt, life: 0.18, c: this.skin.a });
    } else {
      const sp = this.speed;
      const acc = mx || my ? 14 : 18;
      this.vx += (mx * sp - this.vx) * Math.min(1, dt * acc);
      this.vy += (my * sp - this.vy) * Math.min(1, dt * acc);
    }
    // sword lunge nudges the body along the cut
    const lunge = this.sword.lunge;
    const la = this.sword.aim;
    this.x += (this.vx + Math.cos(la) * lunge * 70) * dt;
    this.y += (this.vy + Math.sin(la) * lunge * 70) * dt;

    // ---- body feel: tilt toward motion, squash on start/stop ----
    const spd = Math.hypot(this.vx, this.vy);
    const wantTilt = clamp(this.vx / 400, -0.25, 0.25);
    this.tilt += (wantTilt - this.tilt) * Math.min(1, dt * 12);
    this.walk += spd * dt * 0.12;
    const bounce = spd > 10 ? Math.abs(Math.sin(this.walk)) * 0.08 : 0;
    const dashS = this.dashT > 0 ? 0.25 : 0;
    const crouch = this.sword.squash * 0.1 - this.sword.hop * 0.06;
    this.sx = lerp(this.sx, 1 + bounce * 0.5 + dashS + crouch, Math.min(1, dt * 20));
    // the weapons have weight: they lag behind a change of pace and ride the step
    const lagX = clamp(-this.vx * 0.012, -2.5, 2.5), lagY = clamp(-this.vy * 0.012, -2.5, 2.5);
    const bob = spd > 10 ? bounce * 14 : Math.sin(time * 2.4) * 0.4;
    this.carryX += (lagX - this.carryX) * Math.min(1, dt * 9);
    this.carryY += (lagY + bob - this.carryY) * Math.min(1, dt * 14);
    this.sy = lerp(this.sy, 1 - bounce - dashS * 0.6 - crouch, Math.min(1, dt * 20));

    // critically damped: the body snaps over and settles back without wobbling
    [this.kRot, this.kRotV] = spring(this.kRot, this.kRotV, 170, 26, dt);
    [this.kSq, this.kSqV] = spring(this.kSq, this.kSqV, 400, 40, dt);
    this.inv -= dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    for (const gh of this.ghosts) gh.life -= dt;
    this.ghosts = this.ghosts.filter((g) => g.life > 0);
    if (this.skin.kind === 'prism' && spd > 20 && Math.random() < dt * 30)
      this.ghosts.push({ x: this.x, y: this.y, ang: this.tilt, life: 0.25, c: hsv(time * 0.25, 0.6, 1) });

    // regen
    if (!this.dead) this.hp = Math.min(run.mods.maxHp, this.hp + run.mods.regen * dt);

    // ---- sword aim ----
    let aim = this.swordAim;
    if (input && input.mouseAiming()) {
      const [wx, wy] = run.mouseWorld();
      aim = Math.atan2(wy - this.y, wx - this.x);
    } else {
      aim = run.threatAngle(this.x, this.y, this.gun.aim);
    }
    this.swordAim = aim;
    if (input && !this.dead && input.take('slash')) {
      if (this.sword.attack(aim)) this.afterAttackStart();
    }
    if (input && input.take('reload')) this.gun.startReload();

    const ax = this.x + this.carryX, ay = this.y + this.carryY;
    this.sword.bodyAim = this.dead ? null : this.gun.aim;
    this.sword.hx0 = ax;
    this.sword.hy0 = ay;
    this.sword.update(dt, ax, ay, aim, time);
    if (this.sword.parryT > 0) run.parryShots(this.x, this.y, this.sword.reach() + 4, this.sword);

    this.gun.update(dt, ax, ay, spd > 10 ? Math.atan2(this.vy, this.vx) : NaN);
  }

  /** in the lobby the cube attacks by itself */
  autoAttack(a: number) {
    if (this.sword.attack(a)) this.afterAttackStart();
  }

  private afterAttackStart() {
    const s = this.sword;
    // greatsword leans back into the wind-up, katana flashes out of the saya
    if (s.def.kind === 'katana') this.run.fx.flare(...s.sheathMouth(this.x, this.y), 3, 0xcfe8ff, 0.05);
  }

  draw(g: Gfx, time: number) {
    const skin = this.skin;
    const hc = handColor(skin);
    // dash / prism after-images
    for (const gh of this.ghosts) {
      const k = gh.life / 0.18;
      g.quad(gh.x, gh.y, gh.ang, -5, -5, 10, 10, gh.c, Math.min(1, k) * 0.45, 1, true);
    }
    // shadow
    g.ellipse(this.x, this.y + 7, 6.5, 2.2, 0x000000, 0.35, true);

    const blink = this.inv > 0 && !this.dead && Math.sin(time * 50) > 0 && this.hurtFlash > 0;
    // long guns ride along the body's side: the stock tucks behind it, the hands stay in front
    const gunBehind = Math.sin(this.gun.aim) < -0.35 || (this.gun.hold.two && Math.sin(this.gun.aim) < 0.55);
    const swordBehind = Math.sin(this.sword.ang) < -0.2 && this.sword.state === 'rest';
    // stowed blades (saya, back, belt, shoulder) rest without a hand when the gun needs both
    const sk = this.sword.def.kind;
    const inHand = sk === 'dagger' || sk === 'rapier' || sk === 'longsword' || sk === 'saber' || sk === 'katar' || sk === 'cleaver' || sk === 'spear' || sk === 'twinblade' || sk === 'whip';
    const swordHand = this.sword.busy || !this.gun.hold.two || inHand;

    if (swordBehind) this.sword.draw(g, hc, time, swordHand);
    // one body, two hands: a blade in hand leaves the gun only one
    if (gunBehind) this.gun.draw(g, hc, swordHand, time, 'gun');
    if (!blink) {
      const flashW = this.hurtFlash > 0.15 ? 1 : 0;
      const hop = Math.sin(Math.min(1, this.sword.hop) * Math.PI) * 3;
      // the sprung squash: compress along kSqA, bulge across it
      const q = clamp(this.kSq, -0.4, 0.4);
      const ca = Math.abs(Math.cos(this.kSqA)), sa = Math.abs(Math.sin(this.kSqA));
      const sx = clamp(this.sx * (1 - q * ca + q * 0.6 * sa), 0.55, 1.5);
      const sy = clamp(this.sy * (1 - q * sa + q * 0.6 * ca), 0.55, 1.5);
      drawCube(g, skin, this.x, this.y - 1 - hop, this.size, this.tilt + this.sword.bodyRot + this.kRot, time, sx, sy, flashW);
    }
    this.gun.draw(g, hc, swordHand, time, gunBehind ? 'hands' : 'all');
    if (!swordBehind) this.sword.draw(g, hc, time, swordHand);
  }

  /** a shot's recoil: shoved back along the line of fire, squashed against it, rocked back */
  recoil(aim: number, push: number, squash: number) {
    if (this.dead) return;
    const ca = Math.cos(aim), sa = Math.sin(aim);
    if (this.dashT <= 0) {
      this.vx -= ca * push;
      this.vy -= sa * push;
    }
    const k = Math.min(1, squash);
    this.sx = Math.max(0.6, this.sx - 0.22 * k * Math.abs(ca));
    this.sy = Math.max(0.6, this.sy - 0.22 * k * Math.abs(sa));
    this.tilt -= 0.28 * k * (ca >= 0 ? 1 : -1);
  }

  /** an after-image of the cube where it stands, for fast committed moves */
  private afterimage(life = 0.12) {
    this.ghosts.push({ x: this.x, y: this.y, ang: this.tilt + this.sword.bodyRot + this.kRot, life, c: this.skin.a });
  }

  /** the cut leaves: the body snaps into it, all weight behind the blade */
  swingFeel(a: number, side: number, heavy: boolean, fin: boolean) {
    if (this.dead) return;
    const k = (heavy ? 1.35 : 1) * (fin ? 1.25 : 1);
    this.afterimage();
    this.kRot = clamp(this.kRot + side * 0.2 * k, -0.45, 0.45);
    this.kRotV = 0;
    this.run.camKick(a + Math.PI, 1.1 * k);
    if (heavy || fin) this.run.fx.dust(this.x, this.y + 5, heavy ? 4 : 2, a + Math.PI, 0.6);
  }

  /** the blade bites: a short hard jolt back from the contact */
  slashImpact(a: number, heavy: boolean) {
    if (this.dead) return;
    const push = heavy ? 60 : 32;
    if (this.dashT <= 0) {
      this.vx -= Math.cos(a) * push;
      this.vy -= Math.sin(a) * push;
    }
    this.run.camKick(a + Math.PI, heavy ? 1.8 : 0.9);
  }

  /** a blow is turned aside: the cube is driven back and skids, braced against it */
  parryJolt(threat: number, perfect: boolean, force: number) {
    if (this.dead) return;
    // a perfect parry is clean: less of the blow gets through
    const push = (perfect ? 100 : 160) * force;
    if (this.dashT <= 0) {
      this.vx -= Math.cos(threat) * push;
      this.vy -= Math.sin(threat) * push;
    }
    const f = Math.min(1.3, force);
    this.afterimage(0.16);
    // braced: a hard set against the blow, no rebound
    this.kSqA = threat;
    this.kSq = (perfect ? 0.1 : 0.14) * f;
    this.kSqV = 0;
    this.kRot = clamp(this.kRot - (Math.cos(threat) >= 0 ? 1 : -1) * (perfect ? 0.2 : 0.3) * f, -0.5, 0.5);
    this.kRotV = 0;
    // heels skid away from the hit
    if (force >= 0.6) this.run.fx.dust(this.x, this.y + 5, Math.round(5 * f), threat + Math.PI, 0.5);
    this.run.camKick(threat, (perfect ? 2.8 : 3.8) * force);
  }

  /** aim helper used by the lobby demo */
  faceToward(a: number, dt: number) {
    this.swordAim += angDiff(this.swordAim, a) * Math.min(1, dt * 8);
  }
}

export { TAU, rand };
