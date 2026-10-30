import { GROUND_Y } from '../core/const';
import { sfx } from '../core/audio';
import type { BattleScene } from '../scenes/BattleScene';
import { Enemy, spawnEnemy } from './enemies';
import type { HitInfo } from './combat';

const ADD = Phaser.BlendModes.ADD;

/** A wave of energy that runs along the ground; jump over it. */
export function shockwave(bs: BattleScene, x: number, dir: number, dmg: number, speed = 260, color = 0xffb060, life = 1300) {
  const o = bs.add.container(x, GROUND_Y - 8).setDepth(53);
  const g = bs.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(color).setScale(0.8, 0.5);
  const b = bs.add.image(0, 4, 'beam').setBlendMode(ADD).setTint(color).setOrigin(0.5, 1).setDisplaySize(14, 26);
  o.add([g, b]);
  bs.tweens.add({ targets: b, displayHeight: 34, duration: 90, yoyo: true, repeat: -1 });
  const tr = bs.fx.trail(o, { tex: 'p2', color: [color, 0xffffff], freq: 25, speed: [20, 80], angle: [240, 300], life: [200, 400], gravity: 200 });
  bs.addProj({ team: 'e', obj: o, vx: dir * speed, vy: 0, life, w: 18, h: 22, dmg, kbx: 180, kby: -200, stun: 300, color, trail: tr, pierceAll: false,
    onTick: (p) => { if (Math.random() < 0.3) bs.fx.dust(p.o.obj.x, GROUND_Y - 1, 1, -dir); } });
}

export class Boss extends Enemy {
  phase = 1;
  pending: Phaser.Time.TimerEvent[] = [];
  constructor(bs: BattleScene, type: import('../data/stages').BossType, x: number, tex: string, hp: number, dmg: number, w: number, h: number, public title: string) {
    super(bs, type, x, GROUND_Y - 60, 1, false, { hp, dmg, speed: 0, w, h, tex, gold: 0 });
    this.isBoss = true;
    this.superArmor = true;
    this.name = title;
    this.body.setCollideWorldBounds(true);
  }
  later(ms: number, fn: () => void) {
    const ev = this.bs.time.delayedCall(ms, () => { if (this.alive) fn(); });
    this.pending.push(ev);
    if (this.pending.length > 30) this.pending = this.pending.filter((e) => e.getProgress() < 1);
    return ev;
  }
  die(h: HitInfo) {
    this.pending.forEach((e) => e.remove());
    this.bs.fx.flash(0xffffff, 0.8, 500);
    this.bs.fx.shake(0.02, 600);
    this.bs.hitstop(220);
    sfx(this.bs, 'bigBoom');
    for (let i = 0; i < 6; i++) this.bs.time.delayedCall(i * 120, () => this.bs.fx.burst(this.spr.x + (Math.random() - 0.5) * 60, this.y + (Math.random() - 0.5) * 50, { tex: 'p3', n: 16, color: [0xffd166, 0xffffff, 0xff8a3a], speed: [80, 260] }));
    super.die(h);
  }
  hpRatio() { return this.hp / this.maxHp; }
}

// ---------------------------------------------------------------- Giant Sproutling (1-1)
export class BigSprout extends Boss {
  summoned = false;
  constructor(bs: BattleScene, x: number, lv: number) {
    super(bs, 'bigsprout', x, 'en_sprout', Math.round(760 * (1 + 0.22 * (lv - 1))), 15, 18, 18, '거대 새싹 대장');
    this.spr.setScale(2.4);
    this.body.setSize(18, 18).setOffset(5, 10);
    this.spr.play('sprout_walk');
    this.cd = 800;
  }
  think() {
    const dx = this.dx;
    if (this.st !== 'move') return;
    this.face(dx);
    if (!this.spr.anims.isPlaying) this.spr.play('sprout_walk');
    if (!this.summoned && this.hpRatio() < 0.5) {
      this.summoned = true;
      this.bs.fx.label(this.spr.x, this.spr.y - 60, '부하 소환!', 0xff9a3a);
      for (const off of [-80, 80]) this.bs.addEnemy(spawnEnemy(this.bs, 'sprout', this.spr.x + off, this.bs.stage.lv));
    }
    if (this.cd > 0) { this.body.setVelocityX(Math.sign(dx) * 45 * this.rate); return; }
    this.body.setVelocityX(0);
    if (Math.abs(dx) > 120 || Math.random() < 0.4) this.jumpSlam();
    else this.lunge();
  }
  lunge() {
    this.st = 'wind'; this.spr.stop(); this.spr.setFrame(4);
    this.warn(560);
    this.later(560, () => {
      this.st = 'atk'; this.spr.setFrame(5);
      this.body.setVelocityX(this.facing * 360);
      sfx(this.bs, 'enemyAtk', { rate: 0.7 });
      this.attackBox(this.facing * 20, -22, 44, 40, 320, 1.2, { kbx: 240 });
      this.later(380, () => { this.body.setVelocityX(0); this.spr.setFrame(0); this.st = 'move'; this.cd = 1200 + Math.random() * 600; });
    });
  }
  jumpSlam() {
    this.st = 'wind'; this.spr.stop(); this.spr.setFrame(4);
    this.warn(500, 0xffd166);
    this.later(500, () => {
      this.st = 'atk'; this.spr.setFrame(5);
      const T = 0.75;
      this.body.setVelocity(Phaser.Math.Clamp(this.dx / T, -380, 380), -(600 * T) / 2);
      sfx(this.bs, 'jump', { rate: 0.6 });
      this.later(T * 1000, () => {
        this.spr.setFrame(0);
        this.body.setVelocityX(0);
        this.bs.fx.groundSlam(this.spr.x, GROUND_Y - 1, 0xa8e07a, 1.4);
        this.bs.fx.shake(0.012, 200);
        sfx(this.bs, 'boom');
        this.attackBox(0, -14, 70, 30, 120, 1.3, { kbx: 220, kby: -200 });
        shockwave(this.bs, this.spr.x, -1, this.dmg * 0.9, 230, 0xa8e07a, 1100);
        shockwave(this.bs, this.spr.x, 1, this.dmg * 0.9, 230, 0xa8e07a, 1100);
        this.later(500, () => { this.st = 'move'; this.cd = 1300 + Math.random() * 700; });
      });
    });
  }
  interrupt() { /* super armour: attacks keep going */ }
}

// ---------------------------------------------------------------- Moss Golem
export class Golem extends Boss {
  constructor(bs: BattleScene, x: number, lv: number) {
    super(bs, 'golem', x, 'mb_golem', Math.round(1500 * (1 + 0.22 * (lv - 2))), 19, 46, 56, '이끼 골렘');
    this.spr.play('golem_idle');
    this.cd = 900;
  }
  facesRightByDefault() { return true; }
  think() {
    const dx = this.dx;
    if (this.st !== 'move') return;
    if (this.phase === 1 && this.hpRatio() < 0.5) {
      this.phase = 2;
      this.bs.fx.label(this.spr.x, this.spr.y - 80, '분노!', 0xff5a3a);
      this.bs.fx.ring(this.spr.x, this.y, 0xff5a3a, 10, 120, 500);
      sfx(this.bs, 'hitHeavy', { rate: 0.6 });
    }
    this.face(dx);
    if (this.cd > 0) {
      if (Math.abs(dx) > 90) this.body.setVelocityX(Math.sign(dx) * (this.phase === 2 ? 50 : 35) * this.rate);
      else this.body.setVelocityX(0);
      if (!this.spr.anims.isPlaying) this.spr.play('golem_idle');
      return;
    }
    this.body.setVelocityX(0);
    if (Math.abs(dx) < 110) this.slam(this.phase === 2 ? 2 : 1);
    else this.throwRocks(this.phase === 2 ? 3 : 1);
  }
  slam(times: number) {
    this.st = 'wind'; this.spr.stop(); this.spr.setFrame(2);
    const wind = this.phase === 2 ? 550 : 750;
    this.warn(wind);
    this.bs.fx.glow(this.spr.x, this.spr.y - 60, 0xff7a3a, 1, wind);
    this.later(wind, () => {
      this.spr.setFrame(3);
      this.bs.fx.groundSlam(this.spr.x + this.facing * 30, GROUND_Y - 1, 0xffb060, 1.6);
      this.bs.fx.shake(0.016, 260);
      sfx(this.bs, 'boom');
      this.attackBox(this.facing * 34, -16, 80, 36, 140, 1.3, { kbx: 260, kby: -220 });
      shockwave(this.bs, this.spr.x, -1, this.dmg * 0.85, 250);
      shockwave(this.bs, this.spr.x, 1, this.dmg * 0.85, 250);
      this.later(600, () => {
        if (times > 1) this.slam(times - 1);
        else { this.spr.play('golem_idle'); this.st = 'move'; this.cd = 1300 + Math.random() * 600; }
      });
    });
  }
  throwRocks(n: number) {
    this.st = 'wind'; this.spr.stop(); this.spr.setFrame(4);
    this.warn(600, 0xffd166);
    this.later(600, () => {
      for (let i = 0; i < n; i++) {
        this.later(i * 180, () => {
          const tx = this.player.x + (i - (n - 1) / 2) * 60;
          const T = 0.95;
          const sx = this.spr.x + this.facing * 10, sy = this.spr.y - 70;
          const vx = (tx - sx) / T, vy = ((GROUND_Y - 8) - sy - 0.5 * 700 * T * T) / T;
          const o = this.bs.add.image(sx, sy, 'pr_rock').setDepth(54).setScale(1.3);
          sfx(this.bs, 'swingHeavy', { rate: 0.6 });
          // landing marker
          const mark = this.bs.add.image(tx, GROUND_Y - 2, 'shadowOval').setTint(0xff3a3a).setAlpha(0.6).setDepth(19).setScale(1.4, 1);
          this.bs.tweens.add({ targets: mark, alpha: 0.2, duration: 150, yoyo: true, repeat: -1 });
          this.bs.addProj({ team: 'e', obj: o, vx, vy, gravity: 700, life: 3000, w: 20, h: 20, dmg: this.dmg, kbx: 200, stun: 300, hitGround: true, spin: 360, color: 0xb0a8c0,
            onEnd: (x, y) => {
              mark.destroy();
              this.bs.fx.burst(x, y, { tex: 'p3', n: 10, color: [0x8a8296, 0x5aa84a], speed: [60, 180], angle: [200, 340], gravity: 500, add: false });
              this.bs.fx.dust(x, y, 6);
              sfx(this.bs, 'hitHeavy', { vol: 0.5 });
              this.bs.combat.add({ team: 'e', x, y: y - 10, w: 44, h: 24, dmg: this.dmg * 0.7, life: 80, kbx: 160, stun: 250, color: 0xb0a8c0 });
            } });
        });
      }
      this.later(n * 180 + 500, () => { this.spr.play('golem_idle'); this.st = 'move'; this.cd = 1100 + Math.random() * 600; });
    });
  }
  onFlinch() { /* stays put */ }
}

// ---------------------------------------------------------------- Bladed Mantis
export class Mantis extends Boss {
  constructor(bs: BattleScene, x: number, lv: number) {
    super(bs, 'mantis', x, 'mb_mantis', Math.round(1700 * (1 + 0.22 * (lv - 3))), 17, 30, 44, '칼날 사마귀');
    this.spr.play('mantis_idle');
    this.cd = 700;
  }
  think() {
    const dx = this.dx;
    if (this.st !== 'move') return;
    if (this.phase === 1 && this.hpRatio() < 0.5) {
      this.phase = 2;
      this.bs.fx.label(this.spr.x, this.spr.y - 70, '각성!', 0xff3a5a);
      this.spr.setTint(0xffb0b0);
    }
    this.face(dx);
    if (!this.spr.anims.isPlaying) this.spr.play('mantis_idle');
    if (this.cd > 0) {
      const want = Math.abs(dx) < 90 ? -Math.sign(dx) : Math.abs(dx) > 200 ? Math.sign(dx) : 0;
      this.body.setVelocityX(want * 70 * this.rate);
      return;
    }
    this.body.setVelocityX(0);
    const r = Math.random();
    if (Math.abs(dx) < 70) this.combo();
    else if (r < 0.55) this.dashSlash(this.phase === 2 ? 2 : 1);
    else this.leap();
  }
  dashSlash(times: number) {
    this.st = 'wind'; this.spr.stop(); this.spr.setFrame(2);
    const wind = this.phase === 2 ? 450 : 600;
    this.warn(wind);
    const dir = Math.sign(this.dx) || 1;
    this.face(dir);
    const line = this.bs.add.image(this.spr.x + dir * 160, this.spr.y - 20, 'line').setTint(0xff3a5a).setBlendMode(ADD).setDepth(52).setScale(5, 2).setAlpha(0.2);
    this.bs.tweens.add({ targets: line, alpha: 0.7, duration: 100, yoyo: true, repeat: -1 });
    this.later(wind, () => {
      line.destroy();
      this.st = 'atk'; this.spr.setFrame(3);
      this.body.setVelocityX(dir * 600);
      sfx(this.bs, 'dash', { rate: 0.8 });
      const ev = this.bs.time.addEvent({ delay: 30, repeat: 8, callback: () => this.alive && this.bs.fx.afterimage(this.spr, 0x7ae070, 200, 0.5) });
      this.attackBox(dir * 10, -24, 44, 36, 330, 1.2, { kbx: 240, dir });
      this.later(340, () => {
        ev.remove();
        this.body.setVelocityX(0);
        this.bs.fx.slash(this.spr.x - dir * 30, this.spr.y - 24, dir, 0xff3a5a, { scale: 1.4, thin: 0.3, dur: 300 });
        if (times > 1) this.later(200, () => this.dashSlash(times - 1));
        else this.later(400, () => { this.st = 'move'; this.cd = 900 + Math.random() * 500; });
      });
    });
  }
  leap() {
    this.st = 'wind'; this.spr.stop(); this.spr.setFrame(4);
    this.warn(450, 0xffd166);
    this.later(450, () => {
      this.st = 'atk';
      const T = 0.7;
      this.body.setVelocity(Phaser.Math.Clamp(this.dx / T, -420, 420), -(600 * T) / 2);
      sfx(this.bs, 'jump', { rate: 0.8 });
      this.later(T * 1000, () => {
        this.spr.setFrame(3);
        this.body.setVelocityX(0);
        this.bs.fx.slash(this.spr.x, this.spr.y - 20, 1, 0xff3a5a, { scale: 1.3, angle: 0.3 });
        this.bs.fx.slash(this.spr.x, this.spr.y - 20, -1, 0xff3a5a, { scale: 1.3, angle: 0.3 });
        this.bs.fx.groundSlam(this.spr.x, GROUND_Y - 1, 0x7ae070, 1);
        this.bs.fx.shake(0.01, 160);
        sfx(this.bs, 'swingHeavy');
        this.attackBox(0, -22, 110, 40, 140, 1.2, { kbx: 220 });
        this.later(500, () => { this.st = 'move'; this.cd = 1000 + Math.random() * 500; });
      });
    });
  }
  combo() {
    this.st = 'wind'; this.spr.stop(); this.spr.setFrame(2);
    this.warn(380);
    const n = this.phase === 2 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      this.later(380 + i * 200, () => {
        this.spr.setFrame(i % 2 ? 2 : 3);
        this.face(this.dx);
        this.body.setVelocityX(this.facing * 120);
        this.bs.fx.slash(this.spr.x + this.facing * 26, this.spr.y - 24, this.facing, 0xff3a5a, { scale: 1, angle: i % 2 ? 0.5 : -0.5, thin: 0.5 });
        sfx(this.bs, 'swing', { rate: 0.9 });
        this.attackBox(this.facing * 28, -24, 48, 40, 100, 0.8, { kbx: 120 });
      });
    }
    this.later(380 + n * 200 + 300, () => { this.body.setVelocityX(0); this.st = 'move'; this.cd = 900 + Math.random() * 600; });
  }
}

// ---------------------------------------------------------------- Elderwood (World 1 boss)
export class Elderwood extends Boss {
  arms: Phaser.GameObjects.Sprite[] = [];
  armHome: { x: number; y: number }[] = [];
  last = '';
  summonCd = 8000;
  constructor(bs: BattleScene, x: number, lv: number) {
    super(bs, 'tree', x, 'boss_tree', Math.round(6200 * (1 + 0.1 * (lv - 6))), 22, 56, 100, '고목왕 엘더우드');
    this.spr.play('tree_idle');
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.spr.y = GROUND_Y + 2;
    this.body.reset(x, GROUND_Y + 2);
    this.shadow.setScale(5, 2);
    for (const side of [-1, 1]) {
      const a = bs.add.sprite(x + side * 58, GROUND_Y - 70, 'boss_arm', 0).setDepth(26).setFlipX(side > 0);
      a.setOrigin(side < 0 ? 0.85 : 0.15, 0.2);
      this.arms.push(a);
      this.armHome.push({ x: a.x, y: a.y });
      bs.tweens.add({ targets: a, y: a.y - 4, duration: 900 + side * 100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.cd = 1500;
  }
  facesRightByDefault() { return true; }
  face() { /* trees do not turn */ }
  rect() { return new Phaser.Geom.Rectangle(this.spr.x - 28, this.spr.y - 110, 56, 100); }
  get y() { return this.spr.y - 70; }
  update(dt: number) {
    if (!this.alive) return;
    this.summonCd -= dt;
    super.update(dt);
    this.body.setVelocity(0, 0);
  }
  think() {
    if (this.st !== 'move') return;
    if (this.phase === 1 && this.hpRatio() < 0.6) { this.enrage(); return; }
    if (this.cd > 0) return;
    const opts = ['roots', 'slam', 'seeds'];
    if (this.summonCd <= 0 && this.bs.enemies.filter((e) => e.alive && !e.isBoss).length < 2) opts.push('summon', 'summon');
    if (this.phase === 2) opts.push('sweep', 'roots');
    let pick = Phaser.Utils.Array.GetRandom(opts);
    if (pick === this.last && Math.random() < 0.7) pick = Phaser.Utils.Array.GetRandom(opts);
    this.last = pick;
    this.st = 'atk';
    const done = (cd: number) => { this.st = 'move'; this.cd = cd * (this.phase === 2 ? 0.7 : 1); };
    if (pick === 'roots') this.roots(done);
    else if (pick === 'slam') this.slam(done);
    else if (pick === 'seeds') this.seeds(done);
    else if (pick === 'sweep') this.sweep(done);
    else this.summon(done);
  }
  enrage() {
    this.phase = 2;
    this.st = 'atk';
    this.spr.stop(); this.spr.setFrame(2);
    this.bs.fx.flash(0xff3a3a, 0.4, 400);
    this.bs.fx.shake(0.02, 800);
    this.bs.fx.ring(this.spr.x, this.y, 0xff5a3a, 20, 300, 700);
    this.bs.fx.label(this.spr.x, this.spr.y - 150, '고목왕이 분노했다!', 0xff5a3a);
    this.arms.forEach((a) => a.setFrame(1));
    sfx(this.bs, 'bigBoom', { rate: 0.5 });
    this.bs.fx.burst(this.spr.x, this.spr.y - 100, { tex: 'leaf', n: 50, color: [0xc8502a, 0xe8783a, 0xffd166], speed: [80, 300], add: false, gravity: 200, life: [600, 1200] });
    this.later(1200, () => { this.spr.play('tree_rage'); this.st = 'move'; this.cd = 500; });
  }
  roots(done: (cd: number) => void) {
    const n = this.phase === 2 ? 5 : 3;
    const b = this.bs.arenaBounds();
    const xs = [this.player.x];
    for (let i = 1; i < n; i++) xs.push(Phaser.Math.Clamp(this.player.x + (Math.random() - 0.5) * 360, b.left + 20, this.spr.x - 70));
    const wind = this.phase === 2 ? 650 : 850;
    sfx(this.bs, 'fall', { rate: 0.6 });
    this.bs.fx.shake(0.003, wind);
    for (const x of xs) {
      const m = this.bs.add.image(x, GROUND_Y - 1, 'shadowOval').setTint(0xff3a3a).setDepth(19).setScale(1.4, 1.2).setAlpha(0.3);
      this.bs.tweens.add({ targets: m, alpha: 0.9, duration: 120, yoyo: true, repeat: -1 });
      const em = this.bs.fx.trail({ x, y: GROUND_Y - 2 }, { tex: 'p2', color: [0x6a4630, 0xff5a3a], freq: 50, speed: [20, 60], angle: [250, 290], gravity: 300, add: false });
      this.later(wind, () => {
        m.destroy(); em.stop();
        const th = this.bs.add.image(x, GROUND_Y + 30, 'pr_thorn').setOrigin(0.5, 1).setDepth(27).setScale(2, 2.6);
        this.bs.tweens.add({ targets: th, y: GROUND_Y + 4, duration: 90, ease: 'Back.easeOut', onComplete: () => this.bs.tweens.add({ targets: th, y: GROUND_Y + 70, delay: 500, duration: 300, onComplete: () => th.destroy() }) });
        this.bs.fx.dust(x, GROUND_Y - 1, 5);
        this.bs.combat.add({ team: 'e', x, y: GROUND_Y - 30, w: 22, h: 60, dmg: this.dmg, life: 300, kbx: 120, kby: -340, stun: 400, color: 0xff5a3a });
      });
    }
    this.later(wind, () => sfx(this.bs, 'boom', { rate: 1.3 }));
    this.later(wind + 700, () => done(1300));
  }
  slam(done: (cd: number) => void) {
    const arm = this.arms[0];
    const b = this.bs.arenaBounds();
    const tx = Phaser.Math.Clamp(this.player.x, b.left + 30, this.spr.x - 60);
    const wind = this.phase === 2 ? 600 : 800;
    this.bs.tweens.killTweensOf(arm);
    const mark = this.bs.add.image(tx, GROUND_Y - 1, 'shadowOval').setTint(0x000000).setDepth(19).setScale(0.5, 1).setAlpha(0.2);
    this.bs.tweens.add({ targets: mark, scaleX: 2.6, alpha: 0.6, duration: wind });
    this.bs.tweens.add({ targets: arm, x: tx + 40, y: GROUND_Y - 170, angle: -30, duration: wind, ease: 'Sine.easeInOut' });
    sfx(this.bs, 'swingHeavy', { rate: 0.5 });
    this.later(wind, () => {
      this.bs.tweens.add({ targets: arm, y: GROUND_Y - 34, angle: 20, duration: 110, ease: 'Quad.easeIn', onComplete: () => {
        mark.destroy();
        this.bs.fx.groundSlam(tx, GROUND_Y - 1, 0xffb060, 2);
        this.bs.fx.shake(0.02, 300);
        sfx(this.bs, 'bigBoom', { rate: 0.9 });
        this.bs.combat.add({ team: 'e', x: tx, y: GROUND_Y - 22, w: 70, h: 44, dmg: this.dmg * 1.3, life: 120, kbx: 260, kby: -240, stun: 400, color: 0xffb060 });
        shockwave(this.bs, tx, -1, this.dmg * 0.8, 260);
        if (this.phase === 2) shockwave(this.bs, tx, 1, this.dmg * 0.8, 260);
        this.later(500, () => this.returnArm(0));
      } });
    });
    this.later(wind + 900, () => done(1000));
  }
  returnArm(i: number) {
    const a = this.arms[i], h = this.armHome[i];
    this.bs.tweens.add({ targets: a, x: h.x, y: h.y, angle: 0, duration: 500, ease: 'Sine.easeOut', onComplete: () => this.bs.tweens.add({ targets: a, y: h.y - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) });
  }
  seeds(done: (cd: number) => void) {
    this.spr.stop(); this.spr.setFrame(2);
    this.warn(600, 0xffd166);
    const n = this.phase === 2 ? 10 : 6;
    this.later(600, () => {
      for (let i = 0; i < n; i++) {
        this.later(i * 90, () => {
          const tx = this.player.x + (Math.random() - 0.5) * 240;
          const T = 1.0 + Math.random() * 0.3;
          const sx = this.spr.x - 10, sy = this.spr.y - 40;
          const vx = (tx - sx) / T, vy = ((GROUND_Y - 6) - sy - 0.5 * 600 * T * T) / T;
          const o = this.bs.add.image(sx, sy, 'pr_seed').setDepth(54).setScale(1.4).setTint(this.phase === 2 ? 0xff8a5a : 0xffffff);
          sfx(this.bs, 'shoot', { rate: 0.6 + Math.random() * 0.3, vol: 0.4 });
          this.bs.addProj({ team: 'e', obj: o, vx, vy, gravity: 600, life: 3000, w: 12, h: 12, dmg: this.dmg * 0.7, kbx: 120, stun: 250, hitGround: true, spin: 500, color: 0xc8e05a,
            onEnd: (x, y) => { this.bs.fx.burst(x, y, { tex: 'p2', n: 8, color: [0xc8e05a, 0xff8a5a], speed: [40, 120], angle: [200, 340], add: false }); this.bs.combat.add({ team: 'e', x, y: y - 6, w: 26, h: 14, dmg: this.dmg * 0.5, life: 60, kbx: 80, stun: 200 }); } });
        });
      }
      this.later(n * 90 + 300, () => this.spr.play(this.phase === 2 ? 'tree_rage' : 'tree_idle'));
    });
    this.later(600 + n * 90 + 600, () => done(1200));
  }
  sweep(done: (cd: number) => void) {
    const arm = this.arms[0];
    const b = this.bs.arenaBounds();
    this.bs.tweens.killTweensOf(arm);
    this.warn(800);
    this.bs.tweens.add({ targets: arm, x: this.spr.x - 40, y: GROUND_Y - 30, angle: 60, duration: 800, ease: 'Sine.easeInOut' });
    const glow = this.bs.add.image(arm.x, arm.y, 'glow').setBlendMode(ADD).setTint(0xff3a3a).setDepth(27);
    this.bs.tweens.add({ targets: glow, scale: 1.8, alpha: 0.4, duration: 150, yoyo: true, repeat: 4 });
    this.later(820, () => {
      glow.destroy();
      sfx(this.bs, 'swingHeavy', { rate: 0.4 });
      const hb = this.bs.combat.add({ team: 'e', x: 0, y: 0, follow: arm, offX: -20, offY: 14, w: 40, h: 30, dmg: this.dmg * 1.2, life: 700, kbx: 280, kby: -200, stun: 400, dir: -1, color: 0xff5a3a });
      const ev = this.bs.time.addEvent({ delay: 40, loop: true, callback: () => this.bs.fx.dust(arm.x - 20, GROUND_Y - 1, 1, 1) });
      this.bs.tweens.add({ targets: arm, x: b.left + 10, duration: 650, ease: 'Quad.easeIn', onComplete: () => { ev.remove(); hb.dead = true; this.returnArm(0); } });
    });
    this.later(1900, () => done(900));
  }
  summon(done: (cd: number) => void) {
    this.summonCd = 15000;
    this.spr.stop(); this.spr.setFrame(2);
    this.bs.fx.label(this.spr.x, this.spr.y - 150, '숲이여, 일어나라!', 0x8de05a);
    sfx(this.bs, 'reveal', { rate: 0.5 });
    const b = this.bs.arenaBounds();
    const kinds: ('sprout' | 'moth')[] = this.phase === 2 ? ['sprout', 'moth'] : ['sprout', 'sprout'];
    kinds.forEach((k, i) => this.later(300 + i * 200, () => this.bs.addEnemy(spawnEnemy(this.bs, k, b.left + 80 + i * 160, this.bs.stage.lv, this.phase === 2))));
    this.later(900, () => { this.spr.play(this.phase === 2 ? 'tree_rage' : 'tree_idle'); done(1200); });
  }
  onFlinch() {
    this.spr.setTintFill(0xffffff);
    this.bs.time.delayedCall(50, () => this.alive && this.spr.clearTint());
  }
  die(h: HitInfo) {
    this.arms.forEach((a) => { this.bs.tweens.killTweensOf(a); this.bs.tweens.add({ targets: a, alpha: 0, y: a.y + 40, duration: 800, onComplete: () => a.destroy() }); });
    super.die({ ...h, dir: 0 });
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
  }
}

export function spawnBoss(bs: BattleScene, t: import('../data/stages').BossType, x: number, lv: number): Boss {
  switch (t) {
    case 'bigsprout': return new BigSprout(bs, x, lv);
    case 'golem': return new Golem(bs, x, lv);
    case 'mantis': return new Mantis(bs, x, lv);
    case 'tree': return new Elderwood(bs, x, lv);
  }
}
