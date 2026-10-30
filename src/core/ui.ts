import { TXT, UI, W, H, GRADE_INFO, type Grade } from './const';
import { sfx } from './audio';
import { Save } from './save';

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, key = 'ui_panel') {
  return scene.add.nineslice(x, y, key, undefined, w, h, 8, 8, 8, 8).setOrigin(0, 0);
}

export function text(scene: Phaser.Scene, x: number, y: number, s: string, size: 'S' | 'M' | 'L' = 'M', color = UI.text, bold = false) {
  return scene.add.text(x, y, s, TXT(size, color, bold));
}

/** Text with a 1px dark drop outline for readability over art. */
export function outlined(scene: Phaser.Scene, x: number, y: number, s: string, size: 'S' | 'M' | 'L' = 'M', color = UI.text, bold = false) {
  const t = text(scene, x, y, s, size, color, bold);
  t.setShadow(1, 1, '#0b0714', 0, false, true);
  t.setStroke('#0b0714', 3);
  return t;
}

export interface ButtonOpts {
  w?: number; h?: number; size?: 'S' | 'M' | 'L'; gold?: boolean; disabled?: boolean; icon?: string; sound?: string;
}

export class Button extends Phaser.GameObjects.Container {
  bg: Phaser.GameObjects.NineSlice;
  label: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
  private _disabled = false;
  private hover = false;
  private base: string;

  constructor(scene: Phaser.Scene, x: number, y: number, str: string, private onClick: () => void, o: ButtonOpts = {}) {
    super(scene, x, y);
    const w = o.w ?? 120, h = o.h ?? 28;
    this.base = o.gold ? 'ui_btnGold' : 'ui_btn';
    this.bg = scene.add.nineslice(0, 0, this.base, undefined, w, h, 8, 8, 8, 8);
    this.label = scene.add.text(0, -1, str, TXT(o.size ?? 'M', UI.text, true)).setOrigin(0.5);
    this.label.setShadow(1, 1, '#0b0714', 0, false, true);
    this.add([this.bg, this.label]);
    if (o.icon) {
      this.icon = scene.add.image(-w / 2 + 14, 0, o.icon);
      this.add(this.icon);
      this.label.x += 8;
    }
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => { if (this._disabled) return; this.hover = true; this.refresh(); sfx(scene, 'hover'); scene.tweens.add({ targets: this, scale: 1.05, duration: 90 }); });
    this.on('pointerout', () => { this.hover = false; this.refresh(); scene.tweens.add({ targets: this, scale: 1, duration: 90 }); });
    this.on('pointerdown', () => {
      if (this._disabled) { sfx(scene, 'cancel'); scene.tweens.add({ targets: this, x: this.x + 3, duration: 40, yoyo: true, repeat: 2 }); return; }
      sfx(scene, o.sound ?? 'click');
      scene.tweens.add({ targets: this, scale: 0.94, duration: 60, yoyo: true, onComplete: () => this.onClick() });
    });
    this.setDisabled(!!o.disabled);
    scene.add.existing(this);
  }
  setDisabled(d: boolean) { this._disabled = d; this.refresh(); return this; }
  get disabled() { return this._disabled; }
  setText(s: string) { this.label.setText(s); return this; }
  private refresh() {
    const key = this._disabled ? 'ui_btnDis' : this.hover ? (this.base === 'ui_btnGold' ? 'ui_btnGold' : 'ui_btnHi') : this.base;
    this.bg.setTexture(key);
    this.label.setColor(this._disabled ? '#6a6488' : '#f4eefe');
    this.icon?.setAlpha(this._disabled ? 0.4 : 1);
  }
}

/** Gold/gem counters in the top-right. */
export class CurrencyBar extends Phaser.GameObjects.Container {
  gold: Phaser.GameObjects.Text;
  gems: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene, x = W - 8, y = 8) {
    super(scene, x, y);
    const p1 = scene.add.nineslice(-200, 0, 'ui_slot', undefined, 96, 20, 6, 6, 6, 6).setOrigin(0, 0);
    const p2 = scene.add.nineslice(-98, 0, 'ui_slot', undefined, 98, 20, 6, 6, 6, 6).setOrigin(0, 0);
    const i1 = scene.add.image(-190, 10, 'ic_gold');
    const i2 = scene.add.image(-88, 10, 'ic_gem');
    this.gold = text(scene, -108, 4, '', 'M', UI.gold).setOrigin(1, 0);
    this.gems = text(scene, -6, 4, '', 'M', 0xff9aff).setOrigin(1, 0);
    this.add([p1, p2, i1, i2, this.gold, this.gems]);
    this.refresh();
    scene.add.existing(this);
  }
  refresh() {
    this.gold.setText(Save.d.gold.toLocaleString());
    this.gems.setText(Save.d.gems.toLocaleString());
  }
}

export function gradeBadge(scene: Phaser.Scene, x: number, y: number, g: Grade) {
  const c = scene.add.container(x, y);
  const b = scene.add.image(0, 0, 'badge_' + g);
  const t = scene.add.text(0, -1, g, TXT('S', 0x0b0714, true)).setOrigin(0.5);
  c.add([b, t]);
  return c;
}

export function gradeColor(g: Grade) { return GRADE_INFO[g].color; }

/** Screen fade transition helper. */
export function go(scene: Phaser.Scene, key: string, data?: object) {
  if ((scene as unknown as { _leaving?: boolean })._leaving) return;
  (scene as unknown as { _leaving?: boolean })._leaving = true;
  scene.cameras.main.fadeOut(220, 7, 6, 13);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}

export function fadeIn(scene: Phaser.Scene) {
  (scene as unknown as { _leaving?: boolean })._leaving = false;
  scene.cameras.main.fadeIn(260, 7, 6, 13);
}

export function toast(scene: Phaser.Scene, msg: string, color = UI.text) {
  const t = outlined(scene, W / 2, H / 2 - 40, msg, 'M', color, true).setOrigin(0.5).setDepth(1000).setAlpha(0);
  scene.tweens.add({ targets: t, alpha: 1, y: t.y - 10, duration: 180, hold: 900, yoyo: true, onComplete: () => t.destroy() });
}

/** Scrolling animated starfield-ish backdrop for menus. */
export function menuBackdrop(scene: Phaser.Scene, tint = 0x2a1f5a) {
  scene.add.image(0, 0, 'bg_sky_night').setOrigin(0).setTint(0xffffff);
  const far = scene.add.tileSprite(0, H - 200, W, 200, 'bg_far_night').setOrigin(0).setAlpha(0.8);
  const mid = scene.add.tileSprite(0, H - 210, W, 210, 'bg_mid_night').setOrigin(0).setAlpha(0.9);
  const shade = scene.add.rectangle(0, 0, W, H, tint, 0.35).setOrigin(0);
  const em = scene.add.particles(0, 0, 'p2', {
    x: { min: 0, max: W }, y: H + 4, lifespan: 6000, speedY: { min: -40, max: -15 }, speedX: { min: -8, max: 8 },
    alpha: { start: 0.8, end: 0 }, tint: [0xffd166, 0xff9aff, 0x5ee7ff], frequency: 160, blendMode: 'ADD',
  });
  const tick = () => { far.tilePositionX += 0.08; mid.tilePositionX += 0.2; };
  scene.events.on('update', tick);
  scene.events.once('shutdown', () => scene.events.off('update', tick));
  return { far, mid, shade, em };
}
