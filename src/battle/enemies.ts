import { GROUND_Y, FONT_B } from '../core/const';
import { sfx } from '../core/audio';
import type { BattleScene } from '../scenes/BattleScene';
import type { Fighter, HitInfo } from './combat';
import type { EnemyType, BossType } from '../data/stages';

const ADD = Phaser.BlendModes.ADD;

interface Stats { hp: number; dmg: number; speed: number; w: number; h: number; tex: string; gold: number; fly?: boolean; ox?: number }
const BASE: Record<EnemyType, Stats> = {
  sprout: { hp: 70, dmg: 12, speed: 60, w: 18, h: 18, tex: 'en_sprout', gold: 6 },
  moth: { hp: 52, dmg: 11, speed: 75, w: 20, h: 14, tex: 'en_moth', gold: 6, fly: true },
  spore: { hp: 64, dmg: 11, speed: 28, w: 18, h: 24, tex: 'en_spore', gold: 8 },
  beetle: { hp: 160, dmg: 17, speed: 42, w: 28, h: 18, tex: 'en_beetle', gold: 12 },
};

type St = 'move' | 'wind' | 'atk' | 'recover' | 'hurt' | 'dead' | 'spawn' | 'stun';

export class Enemy implements Fighter {
  team = 'e' as const;
  spr: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Image;
  hp: number; maxHp: number; dmg: number; speed: number;
  alive = true;
  isBoss = false;
  st: St = 'spawn';
  t = 0;
  cd = 0;
  facing = -1;
  frozen = 0; slowed = 0;
  superArmor = false; // bosses: no flinch from light hits
  poise = 0;
  w: number; h: number;
  name = '';
  private bar?: Phaser.GameObjects.Graphics;
  private barT = 0;
  private iceFx?: Phaser.GameObjects.Image;
  private aura?: Phaser.GameObjects.Image;
  protected warnMark?: Phaser.GameObjects.Text;

  constructor(public bs: BattleScene, public type: EnemyType | BossType, x: number, y: number, public lv: number, public elite = false, stats?: Stats) {
    const s = stats ?? BASE[type as EnemyType];
    const lvH = 1 + 0.32 * (lv - 1), lvD = 1 + 0.16 * (lv - 1);
    this.maxHp = this.hp = Math.round(s.hp * (stats ? 1 : lvH) * (elite ? 2.2 : 1));
    this.dmg = s.dmg * (stats ? 1 : lvD) * (elite ? 1.3 : 1);
    this.speed = s.speed * (elite ? 1.15 : 1);
    this.w = s.w; this.h = s.h;
    this.shadow = bs.add.image(x, GROUND_Y, 'shadowOval').setTint(0x000000).setAlpha(0.3).setDepth(21);
    this.spr = bs.physics.add.sprite(x, y, s.tex, 0).setOrigin(0.5, 1).setDepth(25);
    const body = this.spr.body as Phaser.Physics.Arcade.Body;
    body.setSize(s.w, s.h).setOffset((this.spr.width - s.w) / 2, this.spr.height - s.h);
    body.setAllowGravity(!s.fly);
    body.setCollideWorldBounds(true);
    if (elite) {
      this.spr.setScale(1.18);
      this.aura = bs.add.image(x, y, 'glow').setBlendMode(ADD).setTint(0xff3a5a).setAlpha(0.35).setDepth(24);
    }
    this.shadow.setScale(s.w / 22, 1);
    // spawn: drop in with a puff
    this.spr.setAlpha(0);
    bs.tweens.add({ targets: this.spr, alpha: 1, duration: 250 });
    bs.fx.burst(x, y - 10, { tex: 'smoke', n: 8, color: 0xc8b8e8, speed: [30, 80], add: false, alpha: [0.7, 0], life: [300, 500] });
    this.t = 400;
  }

  get x() { return this.spr.x; }
  get y() { return this.spr.y - this.h * this.spr.scaleY * 0.55; }
  get body() { return this.spr.body as Phaser.Physics.Arcade.Body; }
  rect() {
    const sw = this.w * this.spr.scaleX, sh = this.h * this.spr.scaleY;
    return new Phaser.Geom.Rectangle(this.spr.x - sw / 2, this.spr.y - sh, sw, sh);
  }
  invulnerable() { return !this.alive || this.st === 'spawn'; }
  get player() { return this.bs.player; }
  get dx() { return this.player.x - this.spr.x; }
  get rate() { return this.slowed > 0 ? 0.5 : 1; }

  face(dir: number) { if (dir) { this.facing = Math.sign(dir); this.spr.setFlipX(this.facing > 0 !== this.facesRightByDefault()); } }
  facesRightByDefault() { return true; }

  update(dt: number) {
    if (!this.alive) return;
    this.shadow.setPosition(this.spr.x, GROUND_Y);
    this.aura?.setPosition(this.spr.x, this.spr.y - this.h * 0.6).setScale(0.9 + Math.sin(this.bs.time.now / 150) * 0.08);
    if (this.bar && this.barT > 0) { this.barT -= dt; this.drawBar(); if (this.barT <= 0) this.bar.clear(); }
    if (this.slowed > 0) { this.slowed -= dt; this.spr.anims.timeScale = 0.5; if (this.slowed <= 0) { this.spr.anims.timeScale = 1; if (this.frozen <= 0) this.spr.clearTint(); } else if (this.frozen <= 0) this.spr.setTint(0xa8d8ff); }
    if (this.frozen > 0) {
      this.frozen -= dt;
      this.body.setVelocity(0, this.body.allowGravity ? this.body.velocity.y : 0);
      this.iceFx?.setPosition(this.spr.x, this.spr.y - this.h * 0.5);
      if (this.frozen <= 0) this.unfreeze();
      return;
    }
    const sepTargets = this.bs.enemies;
    for (const o of sepTargets) {
      if (o === this || !o.alive) continue;
      const d = this.spr.x - o.x;
      if (Math.abs(d) < 14 && !this.isBoss && !o.isBoss) this.spr.x += Math.sign(d || Math.random() - 0.5) * 0.4;
    }
    this.t -= dt * this.rate;
    if (this.cd > 0) this.cd -= dt * this.rate;
    if (this.st === 'hurt' || this.st === 'stun') {
      if (this.body.blocked.down || !this.body.allowGravity) this.body.setVelocityX(this.body.velocity.x * 0.85);
      if (this.t <= 0) this.st = 'move';
      return;
    }
    if (this.st === 'spawn') { if (this.t <= 0) this.st = 'move'; return; }
    this.think(dt);
  }

  think(_dt: number) { /* override */ }

  warn(ms: number, color = 0xff3a5a) {
    this.warnMark?.destroy();
    const m = this.bs.add.text(this.spr.x, this.spr.y - this.h * this.spr.scaleY - 14, '!', { fontFamily: FONT_B, fontSize: '15px', color: '#' + color.toString(16).padStart(6, '0'), stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0.5).setDepth(700);
    this.warnMark = m;
    m.setScale(0.2);
    this.bs.tweens.add({ targets: m, scale: 1.2, duration: 120, ease: 'Back.easeOut' });
    const ev = this.bs.time.addEvent({ delay: 16, loop: true, callback: () => { if (m.active) m.setPosition(this.spr.x, this.spr.y - this.h * this.spr.scaleY - 14); } });
    this.bs.time.delayedCall(ms, () => { ev.remove(); m.destroy(); });
    this.spr.setTintFill(color);
    this.bs.time.delayedCall(70, () => this.alive && this.frozen <= 0 && this.spr.clearTint());
  }

  attackBox(dx: number, dy: number, w: number, h: number, life: number, mult = 1, extra: Partial<import('./combat').HitboxOpts> = {}) {
    return this.bs.combat.add({ team: 'e', x: 0, y: 0, follow: this.spr, offX: dx, offY: dy, w, h, dmg: this.dmg * mult, life, dir: this.facing, kbx: 160, stun: 300, color: 0xff4d6d, ...extra });
  }

  takeHit(h: HitInfo) {
    if (!this.alive) return false;
    let dmg = h.dmg;
    let blocked = false;
    if (this.type === 'beetle' && !h.pierce && this.frozen <= 0 && this.st !== 'stun') {
      const fromFront = Math.sign(h.srcX - this.spr.x) === this.facing;
      if (fromFront && !h.skill) { dmg = Math.max(1, Math.round(dmg * 0.15)); blocked = true; }
      else if (fromFront && h.skill) dmg = Math.round(dmg * 0.6);
    }
    this.hp -= dmg;
    this.bs.fx.number(this.spr.x + (Math.random() - 0.5) * 10, this.spr.y - this.h * this.spr.scaleY - 6, dmg, h.crit, blocked ? 0x8a8aa0 : 0xffffff);
    if (blocked) {
      this.bs.fx.burst(this.spr.x + this.facing * 12, this.y, { tex: 'p2', n: 8, color: [0xc0d8ff, 0xffffff], speed: [60, 160] });
      sfx(this.bs, 'land', { rate: 2 });
      if (Math.random() < 0.3) this.bs.fx.label(this.spr.x, this.spr.y - 34, '막힘!', 0x8ec4ff);
    }
    if (this.frozen > 0 && h.dmg > 0) {
      // frozen enemies take a bonus shatter hit when struck hard
      if (h.heavy) { this.hp -= Math.round(dmg * 0.5); this.unfreeze(); this.bs.fx.burst(this.x, this.y, { tex: 'shard', n: 10, color: [0xaef4ff, 0xffffff], speed: [80, 200], rotate: true }); sfx(this.bs, 'shatter', { vol: 0.5 }); }
    }
    if (!this.isBoss) { this.barT = 2000; if (!this.bar) this.bar = this.bs.add.graphics().setDepth(600); this.drawBar(); }
    if (h.freeze > 0) this.freeze(h.freeze);
    if (h.slow > 0) this.slowed = Math.max(this.slowed, h.slow);
    if (this.hp <= 0) { this.die(h); return true; }
    // flash
    if (this.frozen <= 0) {
      this.spr.setTintFill(0xffffff);
      this.bs.time.delayedCall(60, () => { if (this.alive && this.frozen <= 0) this.slowed > 0 ? this.spr.setTint(0xa8d8ff) : this.spr.clearTint(); });
    }
    if (blocked) return true;
    const flinch = !this.superArmor || h.heavy || (this.poise += dmg) > this.maxHp * 0.08;
    if (flinch && this.frozen <= 0) {
      if (this.superArmor) this.poise = 0;
      const kbMul = this.isBoss ? 0.15 : 1;
      this.body.setVelocityX(h.dir * h.kbx * kbMul);
      if (h.kby && !this.isBoss) { this.body.setVelocityY(h.kby * (this.body.allowGravity ? 1 : 0.3)); }
      if (!this.isBoss || h.heavy) {
        this.interrupt();
        this.st = 'hurt';
        this.t = this.isBoss ? Math.min(h.stun, 250) : h.stun;
      }
      this.onFlinch();
    }
    return true;
  }

  onFlinch() { /* override for hurt frames */ }
  interrupt() { /* cancel pending attacks */ }

  freeze(ms: number) {
    if (this.isBoss) ms *= 0.35;
    this.frozen = Math.max(this.frozen, ms);
    this.spr.setTint(0x9fe0ff);
    this.spr.anims.pause();
    if (!this.iceFx) {
      this.iceFx = this.bs.add.image(this.spr.x, this.y, 'glow').setBlendMode(ADD).setTint(0x8fd8ff).setScale(this.w / 30 + 0.3).setAlpha(0.6).setDepth(26);
    }
  }
  unfreeze() {
    this.frozen = 0;
    this.spr.anims.resume();
    this.spr.clearTint();
    this.iceFx?.destroy(); this.iceFx = undefined;
  }

  pullTo(x: number, y: number, str: number) {
    if (!this.alive || this.frozen > 0) return;
    const d = x - this.spr.x;
    if (Math.abs(d) > 6) this.body.setVelocityX(Phaser.Math.Clamp(d * 4, -str, str));
    if (!this.body.allowGravity) this.body.setVelocityY(Phaser.Math.Clamp((y - this.y) * 3, -str, str));
    this.st = 'stun'; this.t = Math.max(this.t, 150);
  }

  drawBar() {
    if (!this.bar) return;
    const w = 24, x = this.spr.x - w / 2, y = this.spr.y - this.h * this.spr.scaleY - 8;
    this.bar.clear();
    this.bar.fillStyle(0x0b0714, 1).fillRect(x - 1, y - 1, w + 2, 4);
    this.bar.fillStyle(this.elite ? 0xff9a3a : 0xff4d6d, 1).fillRect(x, y, Math.max(0, (this.hp / this.maxHp) * w), 2);
  }

  die(h: HitInfo) {
    this.alive = false;
    this.hp = 0;
    this.st = 'dead';
    this.iceFx?.destroy();
    this.aura?.destroy();
    this.bar?.destroy();
    this.warnMark?.destroy();
    this.bs.onEnemyDead(this);
    sfx(this.bs, 'kill');
    this.body.setAllowGravity(true);
    this.body.setVelocity(h.dir * 160, -200);
    this.body.setCollideWorldBounds(false);
    this.spr.setTintFill(0xffffff);
    this.bs.tweens.add({ targets: this.spr, angle: h.dir * 200, alpha: 0, duration: 450, onComplete: () => this.destroy() });
    this.bs.tweens.add({ targets: this.shadow, alpha: 0, duration: 300 });
    this.bs.time.delayedCall(250, () => {
      this.bs.fx.burst(this.spr.x, this.spr.y - 10, { tex: 'smoke', n: 10, color: [0xffffff, 0xd8c8f0], speed: [40, 120], add: false, alpha: [0.8, 0], life: [300, 600] });
      this.bs.fx.burst(this.spr.x, this.spr.y - 10, { tex: 'p2', n: 12, color: [0xffd166, 0xffffff], speed: [60, 200] });
    });
  }

  destroy() { this.spr.destroy(); this.shadow.destroy(); }
}

// ------------------------------------------------------------------ mobs

export class Sprout extends Enemy {
  constructor(bs: BattleScene, x: number, y: number, lv: number, elite: boolean) { super(bs, 'sprout', x, y, lv, elite); this.spr.play('sprout_walk'); }
  think() {
    const dx = this.dx;
    if (this.st === 'move') {
      this.face(dx);
      if (this.spr.anims.currentAnim?.key !== 'sprout_walk' || !this.spr.anims.isPlaying) this.spr.play('sprout_walk');
      if (Math.abs(dx) < 54 && this.cd <= 0 && Math.abs(this.player.y - this.y) < 50) {
        this.st = 'wind'; this.t = this.elite ? 380 : 480; this.body.setVelocityX(0);
        this.spr.stop(); this.spr.setFrame(4);
        this.warn(this.t);
      } else this.body.setVelocityX(Math.sign(dx) * this.speed * this.rate);
    } else if (this.st === 'wind') {
      if (this.t <= 0) {
        this.st = 'atk'; this.t = 260; this.spr.setFrame(5);
        this.body.setVelocityX(this.facing * 270);
        sfx(this.bs, 'enemyAtk');
        this.attackBox(this.facing * 12, -10, 26, 18, 220);
      }
    } else if (this.st === 'atk') {
      if (this.t <= 0) { this.st = 'recover'; this.t = 380; this.body.setVelocityX(0); this.spr.setFrame(0); }
    } else if (this.st === 'recover') {
      if (this.t <= 0) { this.st = 'move'; this.cd = 900 + Math.random() * 700; }
    }
  }
  onFlinch() { this.spr.stop(); this.spr.setFrame(6); }
}

export class Moth extends Enemy {
  baseY: number;
  phase = Math.random() * 10;
  tx = 0; ty = 0;
  constructor(bs: BattleScene, x: number, y: number, lv: number, elite: boolean) {
    super(bs, 'moth', x, y, lv, elite);
    this.baseY = GROUND_Y - 58 - Math.random() * 26;
    this.spr.y = this.baseY;
    this.spr.play('moth_fly');
  }
  get y() { return this.spr.y - 9; }
  think(dt: number) {
    this.phase += dt / 1000;
    if (this.st === 'move') {
      if (!this.spr.anims.isPlaying) this.spr.play('moth_fly');
      const want = this.player.x - Math.sign(this.dx || 1) * 70;
      this.face(this.dx);
      this.body.setVelocityX(Phaser.Math.Clamp((want - this.spr.x) * 1.5, -this.speed, this.speed) * this.rate);
      this.body.setVelocityY(((this.baseY + Math.sin(this.phase * 3) * 10) - this.spr.y) * 3);
      if (this.cd <= 0 && Math.abs(this.dx) < 150) {
        this.st = 'wind'; this.t = 550; this.body.setVelocity(0, -30);
        this.warn(this.t);
      }
    } else if (this.st === 'wind') {
      this.face(this.dx);
      if (this.t <= 0) {
        this.st = 'atk'; this.t = 520; this.spr.stop(); this.spr.setFrame(3);
        this.tx = this.player.x; this.ty = this.player.spr.y - 6;
        const ang = Math.atan2(this.ty - this.spr.y, this.tx - this.spr.x);
        this.body.setVelocity(Math.cos(ang) * 330, Math.sin(ang) * 330);
        sfx(this.bs, 'enemyAtk', { rate: 1.4 });
        this.attackBox(0, -8, 20, 16, 480);
      }
    } else if (this.st === 'atk') {
      if (this.spr.y > GROUND_Y - 6) this.body.setVelocityY(-40);
      if (this.t <= 0) { this.st = 'recover'; this.t = 500; this.spr.play('moth_fly'); }
    } else if (this.st === 'recover') {
      this.body.setVelocityY((this.baseY - this.spr.y) * 3);
      this.body.setVelocityX(this.body.velocity.x * 0.9);
      if (this.t <= 0) { this.st = 'move'; this.cd = 1400 + Math.random() * 900; }
    }
  }
  onFlinch() { this.spr.stop(); this.spr.setFrame(4); this.body.setVelocityY(-60); }
}

export class Spore extends Enemy {
  constructor(bs: BattleScene, x: number, y: number, lv: number, elite: boolean) { super(bs, 'spore', x, y, lv, elite); this.spr.play('spore_idle'); this.cd = 900 + Math.random() * 900; }
  facesRightByDefault() { return false; }
  think() {
    const dx = this.dx;
    if (this.st === 'move') {
      this.face(dx);
      if (!this.spr.anims.isPlaying) this.spr.play('spore_idle');
      const dist = Math.abs(dx);
      if (dist < 110) this.body.setVelocityX(-Math.sign(dx) * this.speed * this.rate);
      else if (dist > 260) this.body.setVelocityX(Math.sign(dx) * this.speed * this.rate);
      else this.body.setVelocityX(0);
      if (this.cd <= 0 && dist < 340) {
        this.st = 'wind'; this.t = 650; this.body.setVelocityX(0); this.spr.stop(); this.spr.setFrame(2);
        this.warn(this.t, 0xffd166);
      }
    } else if (this.st === 'wind') {
      if (this.t <= 0) {
        this.st = 'atk'; this.t = 300; this.spr.setFrame(3);
        sfx(this.bs, 'shoot', { rate: 0.7, vol: 0.5 });
        const n = this.elite ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const dist = Math.abs(this.dx) * (0.75 + i * 0.25);
          const T = 0.9;
          const vx = (Math.sign(this.dx) * dist) / T, vy = -0.5 * 600 * T + (this.y - (GROUND_Y - 6)) / T * 0;
          const o = this.bs.add.image(this.spr.x, this.spr.y - 22, 'pr_seed').setDepth(54);
          this.bs.addProj({ team: 'e', obj: o, vx, vy, gravity: 600, life: 2000, w: 10, h: 10, dmg: this.dmg, kbx: 100, stun: 250, hitGround: true, spin: 600, color: 0xc8e05a,
            onEnd: (x, y) => this.bs.fx.burst(x, y, { tex: 'p2', n: 6, color: [0xc8e05a, 0x6cc24a], speed: [30, 90], angle: [200, 340], add: false }) });
        }
      }
    } else if (this.st === 'atk') {
      if (this.t <= 0) { this.st = 'move'; this.cd = 1700 + Math.random() * 900; this.spr.play('spore_idle'); }
    }
  }
  onFlinch() { this.spr.stop(); this.spr.setFrame(4); }
}

export class Beetle extends Enemy {
  constructor(bs: BattleScene, x: number, y: number, lv: number, elite: boolean) { super(bs, 'beetle', x, y, lv, elite); this.spr.play('beetle_walk'); }
  think() {
    const dx = this.dx;
    if (this.st === 'move') {
      this.face(dx);
      if (!this.spr.anims.isPlaying) this.spr.play('beetle_walk');
      this.body.setVelocityX(Math.sign(dx) * this.speed * this.rate);
      if (this.cd <= 0 && Math.abs(dx) < 200) {
        this.st = 'wind'; this.t = 650; this.body.setVelocityX(-this.facing * 30); this.spr.stop(); this.spr.setFrame(2);
        this.warn(this.t);
        this.bs.fx.dust(this.spr.x - this.facing * 10, GROUND_Y - 1, 4, -this.facing);
      }
    } else if (this.st === 'wind') {
      if (this.t <= 0) {
        this.st = 'atk'; this.t = 650;
        this.body.setVelocityX(this.facing * 320);
        sfx(this.bs, 'enemyAtk', { rate: 0.7 });
        this.attackBox(this.facing * 14, -9, 26, 18, 620, 1, { kbx: 260 });
      } else if (Math.floor(this.t / 80) % 2) this.bs.fx.dust(this.spr.x - this.facing * 12, GROUND_Y - 1, 1, -this.facing);
    } else if (this.st === 'atk') {
      if (Math.floor(this.t / 60) % 2) this.bs.fx.dust(this.spr.x - this.facing * 12, GROUND_Y - 1, 1, -this.facing);
      if (this.t <= 0 || this.body.blocked.left || this.body.blocked.right) {
        this.st = 'stun'; this.t = 900; this.body.setVelocityX(0); this.spr.setFrame(3);
        this.bs.fx.label(this.spr.x, this.spr.y - 30, '빈틈!', 0xffd166);
      }
    } else if (this.st === 'stun') {
      if (this.t <= 0) { this.st = 'move'; this.cd = 1500 + Math.random() * 800; }
    }
  }
  update(dt: number) {
    // stun state for beetle means "exposed" — not the generic hurt stun
    if (this.st === 'stun' && this.alive && this.frozen <= 0) {
      this.t -= dt;
      this.shadow.setPosition(this.spr.x, GROUND_Y);
      this.body.setVelocityX(this.body.velocity.x * 0.85);
      if (this.t <= 0) { this.st = 'move'; this.cd = 1500 + Math.random() * 800; }
      return;
    }
    super.update(dt);
  }
  onFlinch() { this.spr.stop(); this.spr.setFrame(4); }
}

export function spawnEnemy(bs: BattleScene, t: EnemyType, x: number, lv: number, elite = false): Enemy {
  const y = t === 'moth' ? GROUND_Y - 120 : GROUND_Y - 40;
  switch (t) {
    case 'sprout': return new Sprout(bs, x, y, lv, elite);
    case 'moth': return new Moth(bs, x, y, lv, elite);
    case 'spore': return new Spore(bs, x, y, lv, elite);
    case 'beetle': return new Beetle(bs, x, y, lv, elite);
  }
}
