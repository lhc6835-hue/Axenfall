import { Gfx } from '../engine/gfx';
import { TAU, angDiff, clamp, hsv, lerp, rand } from '../engine/math';
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
    const crouch = this.sword.squash * 0.25 - this.sword.hop * 0.22;
    this.sx = lerp(this.sx, 1 + bounce * 0.5 + dashS + crouch, Math.min(1, dt * 20));
    this.sy = lerp(this.sy, 1 - bounce - dashS * 0.6 - crouch, Math.min(1, dt * 20));

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

    this.sword.hx0 = this.x;
    this.sword.hy0 = this.y;
    this.sword.update(dt, this.x, this.y, aim, time);
    if (this.sword.parryT > 0) run.parryShots(this.x, this.y, this.sword.reach() + 4, this.sword);

    this.gun.update(dt, this.x, this.y, spd > 10 ? Math.atan2(this.vy, this.vx) : NaN);
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
    const gunBehind = Math.sin(this.gun.aim) < -0.35;
    const swordBehind = Math.sin(this.sword.ang) < -0.2 && this.sword.state === 'rest';
    // stowed blades (saya, back, belt, shoulder) rest without a hand when the gun needs both
    const sk = this.sword.def.kind;
    const inHand = sk === 'dagger' || sk === 'rapier' || sk === 'longsword' || sk === 'saber' || sk === 'katar' || sk === 'cleaver' || sk === 'spear' || sk === 'twinblade' || sk === 'whip';
    const swordHand = this.sword.busy || !this.gun.hold.two || inHand;
    const offhandBusy = this.sword.busy;

    if (swordBehind) this.sword.draw(g, hc, time, swordHand);
    if (gunBehind) this.gun.draw(g, hc, offhandBusy, time);
    if (!blink) {
      const flashW = this.hurtFlash > 0.15 ? 1 : 0;
      const hop = Math.sin(Math.min(1, this.sword.hop) * Math.PI) * 3;
      drawCube(g, skin, this.x, this.y - 1 - hop, this.size, this.tilt + this.sword.bodyRot, time, this.sx, this.sy, flashW);
    }
    if (!gunBehind) this.gun.draw(g, hc, offhandBusy, time);
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

  /** squash (amt > 0) or stretch (amt < 0) the cube along direction a, bulging the other way */
  private squashAlong(a: number, amt: number) {
    const ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a));
    this.sx = clamp(this.sx - amt * ca + amt * 0.5 * sa, 0.6, 1.45);
    this.sy = clamp(this.sy - amt * sa + amt * 0.5 * ca, 0.6, 1.45);
  }

  /** the cut leaves: the body twists with the blade and stretches into it */
  swingFeel(a: number, side: number, heavy: boolean, fin: boolean) {
    if (this.dead) return;
    const k = (heavy ? 1.4 : 1) * (fin ? 1.3 : 1);
    this.tilt += side * 0.2 * k;
    this.squashAlong(a, -0.16 * k);
    this.run.camKick(a + Math.PI, 0.9 * k);
  }

  /** the blade bites: a short jolt back from the contact */
  slashImpact(a: number, heavy: boolean) {
    if (this.dead) return;
    const push = heavy ? 55 : 30;
    if (this.dashT <= 0) {
      this.vx -= Math.cos(a) * push;
      this.vy -= Math.sin(a) * push;
    }
    this.squashAlong(a, heavy ? 0.2 : 0.12);
    this.run.camKick(a + Math.PI, heavy ? 1.6 : 0.8);
  }

  /** a blow is turned aside: the cube is driven back, braced against it, and rocked */
  parryJolt(threat: number, perfect: boolean, force: number) {
    if (this.dead) return;
    // a perfect parry is clean: less of the blow gets through
    const push = (perfect ? 95 : 150) * force;
    if (this.dashT <= 0) {
      this.vx -= Math.cos(threat) * push;
      this.vy -= Math.sin(threat) * push;
    }
    this.squashAlong(threat, (perfect ? 0.24 : 0.3) * Math.min(1.3, force));
    this.tilt -= (Math.cos(threat) >= 0 ? 1 : -1) * (perfect ? 0.22 : 0.32) * Math.min(1.3, force);
    this.run.camKick(threat, (perfect ? 2.5 : 3.5) * force);
  }

  /** aim helper used by the lobby demo */
  faceToward(a: number, dt: number) {
    this.swordAim += angDiff(this.swordAim, a) * Math.min(1, dt * 8);
  }
}

export { TAU, rand };
