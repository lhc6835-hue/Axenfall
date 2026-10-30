import { GROUND_Y } from '../core/const';
import { Save } from '../core/save';
import { sfx } from '../core/audio';
import { abilityById, abilityPower, skillById, type AbilityDef } from '../data/abilities';
import type { BattleScene } from '../scenes/BattleScene';
import type { Fighter, HitInfo } from './combat';
import { BASICS, SKILL_FX, type SkillCtx } from './skills';

export interface Keys {
  left: Phaser.Input.Keyboard.Key[]; right: Phaser.Input.Keyboard.Key[]; up: Phaser.Input.Keyboard.Key[]; down: Phaser.Input.Keyboard.Key[];
  jump: Phaser.Input.Keyboard.Key[]; attack: Phaser.Input.Keyboard.Key[]; dash: Phaser.Input.Keyboard.Key[];
  s1: Phaser.Input.Keyboard.Key[]; s2: Phaser.Input.Keyboard.Key[]; s3: Phaser.Input.Keyboard.Key[]; ult: Phaser.Input.Keyboard.Key[];
}

const down = (ks: Phaser.Input.Keyboard.Key[]) => ks.some((k) => k.isDown);

type State = 'free' | 'attack' | 'skill' | 'hurt' | 'dead' | 'locked';

export class Player implements Fighter {
  team = 'p' as const;
  spr: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Image;
  ability: AbilityDef;
  hp: number;
  maxHp: number;
  ult = 0;
  facing = 1;
  state: State = 'free';
  stateT = 0;
  combo = 0;
  comboQueued = false;
  comboWindow = 0;
  airJumps = 1;
  dashCd = 0;
  dashT = 0;
  iframes = 0;
  cds: [number, number, number] = [0, 0, 0];
  slots: (string | null)[];
  ultId: string | null;
  basicStepTimer?: Phaser.Time.TimerEvent;
  wasOnGround = true;
  invincible = false; // skills can toggle this
  gravityOff = false;
  hitCount = 0;
  damageTaken = 0;
  private lastBlink = 0;
  private sqTween?: Phaser.Tweens.Tween;

  constructor(public bs: BattleScene, x: number) {
    this.ability = abilityById(Save.d.main);
    this.maxHp = Save.hpMax();
    this.hp = this.maxHp;
    this.slots = [...Save.d.slots];
    this.ultId = Save.d.ult;
    this.shadow = bs.add.image(x, GROUND_Y, 'shadowOval').setTint(0x000000).setAlpha(0.35).setDepth(21);
    this.spr = bs.physics.add.sprite(x, GROUND_Y - 2, 'hero_' + this.ability.id, 0);
    this.spr.setOrigin(0.5, 1).setDepth(30);
    const body = this.spr.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 16).setOffset(6, 10);
    body.setMaxVelocity(600, 700);
    body.setDragX(0);
    this.spr.play(this.anim('idle'));
  }

  get x() { return this.spr.x; }
  get y() { return this.spr.y - 9; }
  get alive() { return this.state !== 'dead'; }
  get body() { return this.spr.body as Phaser.Physics.Arcade.Body; }
  get onGround() { return this.body.blocked.down || this.body.touching.down; }
  anim(k: string) { return `hero_${this.ability.id}_${k}`; }

  rect() { return new Phaser.Geom.Rectangle(this.spr.x - 10, this.spr.y - 16, 20, 16); }
  invulnerable() { return this.iframes > 0 || this.invincible || this.dashT > 0; }

  /** Power for a skill/basic, based on the owning ability's grade/level/star. */
  power(abilityId: string) {
    const o = Save.d.owned[abilityId] ?? { level: 1, star: 1 };
    return Save.atkBase() * abilityPower(abilityById(abilityId).grade, o.level, o.star);
  }

  ctx(abilityId: string, mult: number): SkillCtx {
    const a = abilityById(abilityId);
    return { bs: this.bs, p: this, dir: this.facing, atk: this.power(abilityId) * mult, fx: this.bs.fx, c1: a.fx, c2: a.fx2, ability: a };
  }

  update(dt: number, k: Keys) {
    const now = this.bs.time.now;
    if (this.iframes > 0) {
      this.iframes -= dt;
      this.spr.setAlpha(this.iframes > 0 && Math.floor(now / 60) % 2 ? 0.35 : 1);
    }
    if (this.dashCd > 0) this.dashCd -= dt;
    for (let i = 0; i < 3; i++) if (this.cds[i] > 0) this.cds[i] = Math.max(0, this.cds[i] - dt);
    if (this.comboWindow > 0) { this.comboWindow -= dt; if (this.comboWindow <= 0) this.combo = 0; }

    const body = this.body;
    body.setAllowGravity(!this.gravityOff);
    const ground = this.onGround;
    if (ground && !this.wasOnGround) this.onLand();
    this.wasOnGround = ground;
    if (ground) this.airJumps = 1;
    this.shadow.setPosition(this.spr.x, GROUND_Y);
    const air = Math.max(0, GROUND_Y - this.spr.y);
    this.shadow.setScale(Math.max(0.3, 0.9 - air / 200), 1).setAlpha(Math.max(0.1, 0.35 - air / 500));

    if (this.state === 'dead') return;

    if (this.dashT > 0) {
      this.dashT -= dt;
      body.setVelocity(this.facing * 420, 0);
      if (Math.floor(now / 30) % 2 === 0) this.bs.fx.afterimage(this.spr, this.ability.fx, 200, 0.5);
      if (this.dashT <= 0) { this.gravityOff = false; body.setVelocityX(this.facing * 120); }
      return;
    }

    if (this.state === 'hurt' && this.ult >= 100 && this.hp > 0 && this.bs.take('ult')) { this.tryUlt(); return; }
    if (this.state === 'hurt' || this.state === 'skill' || this.state === 'locked') {
      this.stateT -= dt;
      if (this.state === 'hurt') body.setVelocityX(body.velocity.x * 0.9);
      if (this.stateT <= 0 && this.state !== 'locked') this.toFree();
      // allow buffering a combo-attack during skill end
      return;
    }

    // ---- input
    const L = down(k.left), R = down(k.right);
    const moveDir = (R ? 1 : 0) - (L ? 1 : 0);

    const take = (a: keyof Keys) => this.bs.take(a);
    if (this.dashCd <= 0 && take('dash')) { this.dash(moveDir || this.facing); return; }
    if (this.ult >= 100 && take('ult')) { if (this.tryUlt()) return; }
    for (const [i, key] of (['s1', 's2', 's3'] as const).entries()) if (this.bs.peek(key) && (this.bs.take(key), this.trySkill(i))) return;

    if (this.state === 'attack') {
      this.stateT -= dt;
      if (take('attack') || this.bs.attackHeld) this.comboQueued = true;
      body.setVelocityX(body.velocity.x * 0.86);
      if (this.stateT <= 0) {
        if (this.comboQueued) { this.comboQueued = false; this.basic(); }
        else this.toFree();
      }
      return;
    }

    if (take('attack') || this.bs.attackHeld) { this.basic(); return; }

    // movement
    const accel = ground ? 1400 : 1000;
    const max = 168;
    if (moveDir) {
      this.facing = moveDir;
      this.spr.setFlipX(moveDir < 0);
      body.setVelocityX(Phaser.Math.Clamp(body.velocity.x + moveDir * accel * dt / 1000, -max, max));
    } else {
      const f = ground ? 0.72 : 0.92;
      body.setVelocityX(Math.abs(body.velocity.x) < 8 ? 0 : body.velocity.x * f);
    }
    if (!down(k.down) && take('jump')) {
      if (ground) this.jump(false);
      else if (this.airJumps > 0) { this.airJumps--; this.jump(true); }
    }
    if (!down(k.jump) && body.velocity.y < -120) body.setVelocityY(body.velocity.y * 0.85); // variable jump height

    // animation
    if (!ground) this.play(body.velocity.y < 0 ? 'jump' : 'fall');
    else if (Math.abs(body.velocity.x) > 20) {
      this.play('run');
      if (now - this.lastBlink > 260) { this.lastBlink = now; this.bs.fx.dust(this.spr.x - this.facing * 8, GROUND_Y - 1, 1, -this.facing); }
    } else this.play('idle');
  }

  play(k: string) {
    const key = this.anim(k);
    if (this.spr.anims.currentAnim?.key !== key) this.spr.play(key, true);
  }

  squash(sx: number, sy: number, dur = 90) {
    this.sqTween?.stop();
    this.spr.setScale(sx, sy);
    this.sqTween = this.bs.tweens.add({ targets: this.spr, scaleX: 1, scaleY: 1, duration: dur * 2, ease: 'Back.easeOut' });
  }

  jump(air: boolean) {
    this.body.setVelocityY(air ? -310 : -360);
    this.squash(0.75, 1.3);
    sfx(this.bs, 'jump', { rate: air ? 1.25 : 1 });
    if (air) {
      this.bs.fx.ring(this.spr.x, this.spr.y, this.ability.fx, 4, 26, 260, true);
      this.bs.fx.burst(this.spr.x, this.spr.y, { tex: 'p2', n: 8, color: this.ability.fx, speed: [30, 90], angle: [30, 150], life: [200, 380] });
    } else this.bs.fx.dust(this.spr.x, GROUND_Y - 1, 5);
  }

  onLand() {
    this.squash(1.3, 0.7);
    sfx(this.bs, 'land');
    this.bs.fx.dust(this.spr.x, this.spr.y - 1, 4);
  }

  dash(dir: number) {
    this.facing = dir; this.spr.setFlipX(dir < 0);
    this.dashT = 170; this.dashCd = 520;
    this.gravityOff = true;
    this.state = 'free';
    this.play('attack');
    this.squash(1.4, 0.7);
    sfx(this.bs, 'dash');
    this.bs.fx.dust(this.spr.x, this.spr.y - 2, 5, -dir);
    this.bs.fx.burst(this.spr.x - dir * 10, this.spr.y - 8, { tex: 'streak', n: 5, color: this.ability.fx, speed: [60, 140], angle: dir > 0 ? [170, 190] : [-10, 10], life: [150, 260] });
  }

  toFree() {
    this.state = 'free';
    this.invincible = false;
    this.gravityOff = false;
  }

  basic() {
    const b = BASICS[this.ability.id];
    const step = b.steps[this.combo % b.steps.length];
    this.state = 'attack';
    this.stateT = step.dur;
    this.comboQueued = false;
    this.play('attack');
    this.squash(1.15, 0.9, 60);
    const dir = this.facing;
    if (step.lunge) this.body.setVelocityX(dir * step.lunge);
    if (!this.onGround) this.body.setVelocityY(Math.min(this.body.velocity.y, -40));
    const idx = this.combo % b.steps.length;
    this.bs.time.delayedCall(step.at, () => {
      if (this.state === 'dead') return;
      step.fn(this.ctx(this.ability.id, b.mult), idx);
    });
    this.combo++;
    this.comboWindow = step.dur + 260;
    if (this.combo >= b.steps.length) { this.combo = 0; this.stateT += 90; }
  }

  trySkill(i: number) {
    const id = this.slots[i];
    if (!id) return false;
    if (this.cds[i] > 0) { this.bs.events.emit('cdDenied', i); return false; }
    const sk = skillById(id);
    const run = SKILL_FX[id];
    if (!run) return false;
    this.cds[i] = sk.cd * 1000;
    this.bs.events.emit('skillUsed', i);
    this.castFx(abilityById(sk.ability).fx);
    const r = run(this.ctx(sk.ability, sk.power));
    this.state = 'skill';
    this.stateT = r.lock;
    if (r.iframes) this.iframes = Math.max(this.iframes, r.iframes);
    this.combo = 0;
    return true;
  }

  tryUlt() {
    if (!this.ultId || this.ult < 100) return false;
    const sk = skillById(this.ultId);
    const run = SKILL_FX[this.ultId];
    if (!run) return false;
    this.ult = 0;
    this.state = 'locked';
    this.invincible = true;
    this.body.setVelocity(0, 0);
    this.bs.cutIn(sk.ability, sk.name, () => {
      const r = run(this.ctx(sk.ability, sk.power));
      this.state = 'skill';
      this.stateT = r.lock;
      this.iframes = Math.max(this.iframes, r.lock + 400);
      this.invincible = false;
    });
    return true;
  }

  castFx(color: number) {
    this.play('attack');
    this.bs.fx.glow(this.spr.x, this.y, color, 0.8, 200, 0.8);
    this.bs.fx.burst(this.spr.x, this.y, { tex: 'spark', n: 6, color, speed: [40, 100], life: [200, 350] });
  }

  gainUlt(v: number) { this.ult = Math.min(100, this.ult + v); }

  takeHit(h: HitInfo) {
    if (this.invulnerable() || this.state === 'dead') return false;
    this.hp -= h.dmg;
    this.damageTaken += h.dmg;
    this.gainUlt(4);
    this.bs.fx.number(this.spr.x, this.spr.y - 24, h.dmg, false, 0xff6a7a);
    this.bs.fx.hitspark(this.spr.x, this.y, 0xff4d6d, true);
    this.bs.fx.flash(0xff2040, 0.25, 160);
    this.bs.fx.shake(0.008, 160);
    this.bs.hitstop(70);
    sfx(this.bs, 'hurt');
    if (this.hp <= 0) { this.hp = 0; this.die(h); return true; }
    this.state = 'hurt';
    this.stateT = 300;
    this.iframes = 900;
    this.dashT = 0; this.gravityOff = false;
    this.play('hurt');
    this.squash(1.3, 0.75);
    this.body.setVelocity(h.dir * Math.max(140, h.kbx), -180);
    return true;
  }

  die(h: HitInfo) {
    this.state = 'dead';
    this.play('hurt');
    this.body.setVelocity(h.dir * 160, -260);
    this.bs.tweens.add({ targets: this.spr, angle: h.dir * 360, duration: 700 });
    this.bs.time.delayedCall(900, () => this.bs.onPlayerDead());
  }
}
