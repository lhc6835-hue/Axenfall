import { W, H, UI, FONT_B } from '../core/const';
import { playBgm, sfx } from '../core/audio';
import { go, fadeIn, outlined, text } from '../core/ui';
import { TITLE_WORD } from '../art/title';
import { ABILITIES } from '../data/abilities';

const ADD = Phaser.BlendModes.ADD;

export class TitleScene extends Phaser.Scene {
  ready = false;
  constructor() { super('Title'); }

  create() {
    fadeIn(this);
    this.ready = false;
    playBgm(this, 'title');
    // backdrop
    this.add.image(0, 0, 'bg_sky_night').setOrigin(0);
    const moon = this.add.image(W * 0.78, 70, 'glow').setBlendMode(ADD).setTint(0xd8e8ff).setScale(3).setAlpha(0.5);
    this.tweens.add({ targets: moon, scale: 3.3, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const far = this.add.tileSprite(0, H - 210, W, 200, 'bg_far_night').setOrigin(0);
    const mid = this.add.tileSprite(0, H - 190, W, 210, 'bg_mid_night').setOrigin(0);
    const ground = this.add.tileSprite(0, H - 40, W, 64, 'ground_night').setOrigin(0);
    const scroll = () => { far.tilePositionX += 0.1; mid.tilePositionX += 0.3; ground.tilePositionX += 0.9; };
    this.events.on('update', scroll);
    this.events.once('shutdown', () => this.events.off('update', scroll));
    this.add.particles(0, 0, 'p2', {
      x: { min: 0, max: W }, y: H + 4, lifespan: 7000, speedY: { min: -40, max: -12 }, speedX: { min: -10, max: 10 },
      alpha: { start: 0.9, end: 0 }, tint: [0xffd166, 0xff9aff, 0x5ee7ff], frequency: 90, blendMode: 'ADD',
    });
    // heroes parading along the bottom
    const parade = ['base', ...ABILITIES.map((a) => a.id)];
    parade.forEach((id, i) => {
      const s = this.add.sprite(-40 - i * 70, H - 40, 'hero_' + id).setOrigin(0.5, 1).play(`hero_${id}_run`);
      this.tweens.add({ targets: s, x: W + 60, duration: 9000, delay: i * 1100, repeat: -1, repeatDelay: parade.length * 1100 - 9000 + 3000 });
    });

    // ----- logo
    const letters: Phaser.GameObjects.Image[] = [];
    const widths = [...TITLE_WORD].map((ch) => this.textures.get('tl_' + ch).getSourceImage().width);
    const gap = -14;
    const total = widths.reduce((a, b) => a + b + gap, -gap);
    let x = W / 2 - total / 2;
    const logoY = 112;
    const logo = this.add.container(0, 0);
    [...TITLE_WORD].forEach((ch, i) => {
      const w = widths[i];
      const im = this.add.image(x + w / 2, logoY, 'tl_' + ch).setAlpha(0);
      x += w + gap;
      letters.push(im);
      logo.add(im);
      const targetY = logoY + (i % 2 ? 3 : 0);
      this.tweens.add({
        targets: im, y: { from: logoY - 140, to: targetY }, alpha: 1, angle: { from: (i % 2 ? 1 : -1) * 25, to: 0 },
        duration: 420, delay: 300 + i * 90, ease: 'Bounce.easeOut',
        onStart: () => sfx(this, 'drop', { rate: 0.9 + i * 0.05 }),
        onComplete: () => this.cameras.main.shake(60, 0.004),
      });
    });
    // big slash reveal
    this.time.delayedCall(300 + TITLE_WORD.length * 90 + 380, () => {
      sfx(this, 'swingHeavy', { rate: 0.7 });
      sfx(this, 'hitHeavy', { rate: 0.6 });
      const sl = this.add.image(-80, logoY, 'line').setBlendMode(ADD).setScale(3, 6).setRotation(-0.18);
      this.tweens.add({ targets: sl, x: W + 80, duration: 220, ease: 'Cubic.easeIn', onComplete: () => sl.destroy() });
      this.time.delayedCall(140, () => {
        const fl = this.add.rectangle(0, 0, W, H, 0xffffff, 0.8).setOrigin(0).setBlendMode(ADD);
        this.tweens.add({ targets: fl, alpha: 0, duration: 400, onComplete: () => fl.destroy() });
        this.cameras.main.shake(200, 0.01);
        const glow = this.add.image(W / 2, logoY, 'glow').setBlendMode(ADD).setTint(0xff8a3a).setScale(9, 2.2).setAlpha(0);
        logo.addAt(glow, 0);
        this.tweens.add({ targets: glow, alpha: 0.45, duration: 600 });
        this.tweens.add({ targets: glow, scaleX: 9.6, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.add.particles(W / 2, logoY, 'spark', {
          x: { min: -total / 2, max: total / 2 }, y: { min: -20, max: 20 }, lifespan: 900, speed: { min: 10, max: 40 },
          scale: { start: 1, end: 0 }, tint: [0xffffff, 0xffd166], frequency: 120, blendMode: 'ADD',
        });
        sub.setAlpha(1); this.tweens.add({ targets: sub, scaleX: { from: 0, to: 1 }, duration: 300, ease: 'Back.easeOut' });
        this.ready = true;
        this.tweens.add({ targets: prompt, alpha: 1, duration: 400 });
        this.tweens.add({ targets: prompt, alpha: 0.35, duration: 700, yoyo: true, repeat: -1, delay: 400 });
        this.shine(letters);
      });
    });
    // idle float
    this.tweens.add({ targets: logo, y: -3, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const sub = this.add.container(W / 2, logoY + 50).setAlpha(0);
    const bar = this.add.rectangle(0, 0, 250, 18, 0x0b0714, 0.75);
    const l1 = this.add.rectangle(0, -9, 250, 1, UI.gold), l2 = this.add.rectangle(0, 9, 250, 1, UI.gold);
    const st = this.add.text(0, -1, '네모 용사의 대모험', { fontFamily: FONT_B, fontSize: '12px', color: '#ffe9a8', resolution: 1 }).setOrigin(0.5);
    st.setLetterSpacing(2);
    sub.add([bar, l1, l2, st]);

    const prompt = outlined(this, W / 2, H - 98, 'PRESS ANY KEY  ·  클릭하여 시작', 'M', 0xffffff, true).setOrigin(0.5).setAlpha(0);
    text(this, 8, H - 14, 'v0.1  ·  SFX: Kenney (CC0)', 'S', UI.dim);
    text(this, W - 8, H - 14, '© 2026 AXENFALL', 'S', UI.dim).setOrigin(1, 0);

    const start = () => {
      if (!this.ready) return;
      this.ready = false;
      sfx(this, 'confirm');
      const fl = this.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0).setBlendMode(ADD);
      this.tweens.add({ targets: fl, fillAlpha: 0.7, duration: 120, yoyo: true });
      this.time.delayedCall(150, () => go(this, 'Hub'));
    };
    this.input.on('pointerdown', start);
    this.input.keyboard!.on('keydown', start);
    this.events.once('shutdown', () => { this.input.keyboard!.off('keydown', start); });
  }

  shine(letters: Phaser.GameObjects.Image[]) {
    const run = () => {
      letters.forEach((l, i) => {
        this.time.delayedCall(i * 60, () => {
          const s = this.add.image(l.x, l.y, l.texture.key).setTintFill(0xffffff).setBlendMode(ADD).setAlpha(0);
          this.tweens.add({ targets: s, alpha: 0.7, duration: 90, yoyo: true, onComplete: () => s.destroy() });
        });
      });
    };
    run();
    this.time.addEvent({ delay: 3200, loop: true, callback: run });
  }
}
