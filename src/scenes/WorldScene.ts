import { W, H, UI, FONT_B, FONT_L } from '../core/const';
import { sfx } from '../core/audio';
import { Save } from '../core/save';
import { Button, CurrencyBar, fadeIn, go, menuBackdrop, outlined, text, toast } from '../core/ui';
import { STAGES, WORLDS } from '../data/stages';
import { mix } from '../art/pixel';

export class WorldScene extends Phaser.Scene {
  constructor() { super('World'); }

  create() {
    fadeIn(this);
    menuBackdrop(this, 0x101030);
    outlined(this, 20, 14, '월드 선택', 'L', UI.gold, true);
    text(this, 20, 34, 'WORLD MAP', 'S', UI.dim);
    new CurrencyBar(this);
    new Button(this, 60, H - 24, '◀ 로비', () => go(this, 'Hub'), { w: 90 });

    const cw = 186, ch = 230;
    WORLDS.forEach((w, i) => {
      const x = W / 2 + (i - 1) * (cw + 14), y = H / 2 + 6;
      const card = this.add.container(x, y);
      // landscape preview, masked to the card window
      const view = this.add.container(0, 0);
      const th = w.theme;
      view.add(this.add.image(0, -40, `bg_sky_${th}`).setDisplaySize(cw - 12, 200).setCrop(0, 0, 640, 360));
      const far = this.add.tileSprite(0, 0, cw - 12, 120, `bg_far_${th}`).setTileScale(0.7);
      const mid = this.add.tileSprite(0, 20, cw - 12, 120, `bg_mid_${th}`).setTileScale(0.7);
      view.add([far, mid]);
      view.add(this.add.tileSprite(0, 76, cw - 12, 40, `ground_${th}`));
      const mshape = this.make.graphics({}, false).fillRect(x - cw / 2 + 6, y - ch / 2 + 6, cw - 12, ch - 74);
      view.setMask(mshape.createGeometryMask());
      const frame = this.add.nineslice(0, 0, w.locked ? 'ui_panel' : 'ui_panelGold', undefined, cw, ch, 8, 8, 8, 8);
      const inner = this.add.nineslice(0, -32, 'ui_slot', undefined, cw - 8, ch - 70, 6, 6, 6, 6).setAlpha(0.0);
      card.add([frame, view, inner]);
      // hero on the landscape
      if (!w.locked) {
        const hero = this.add.sprite(-20, 44, 'hero_' + Save.d.main).setOrigin(0.5, 1).play(`hero_${Save.d.main}_idle`);
        card.add(hero);
        const scroll = () => { far.tilePositionX += 0.15; mid.tilePositionX += 0.35; };
        this.events.on('update', scroll);
        this.events.once('shutdown', () => this.events.off('update', scroll));
      }
      const nameBg = this.add.rectangle(0, ch / 2 - 46, cw - 8, 1, mix(w.color, 0x000000, 0.3));
      const name = this.add.text(0, ch / 2 - 38, w.name, { fontFamily: FONT_L, fontSize: '15px', color: '#' + (w.locked ? 0x6a6488 : w.color).toString(16), stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0.5, 0);
      const en = text(this, 0, ch / 2 - 20, `WORLD ${w.id} · ${w.en}`, 'S', UI.dim).setOrigin(0.5, 0);
      card.add([nameBg, name, en]);
      const stages = STAGES.filter((s) => s.world === w.id);
      if (w.locked) {
        const veil = this.add.rectangle(0, -32, cw - 12, ch - 74, 0x07060d, 0.7);
        const lock = this.add.image(0, -44, 'ic_lock').setScale(2.5);
        const soon = this.add.text(0, -14, '준비 중', { fontFamily: FONT_B, fontSize: '12px', color: '#9a8fbf', stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0.5);
        card.add([veil, lock, soon]);
      } else {
        const stars = stages.reduce((s, st) => s + (Save.d.cleared[st.id] ?? 0), 0);
        const prog = this.add.container(0, -ch / 2 + 20);
        prog.add(this.add.nineslice(0, 0, 'ui_slot', undefined, 90, 20, 6, 6, 6, 6));
        prog.add(this.add.image(-28, 0, 'ic_star'));
        prog.add(text(this, 6, -6, `${stars} / ${stages.length * 3}`, 'S', UI.gold).setOrigin(0.5, 0));
        card.add(prog);
        const desc = text(this, 0, -ch / 2 + 40, w.desc, 'S', UI.text).setOrigin(0.5, 0).setWordWrapWidth(cw - 24).setAlign('center');
        desc.setShadow(1, 1, '#0b0714', 0, false, true);
        card.add(desc);
      }
      card.setSize(cw, ch).setInteractive({ useHandCursor: !w.locked });
      card.on('pointerover', () => { if (!w.locked) { sfx(this, 'hover'); this.tweens.add({ targets: card, scale: 1.04, duration: 100 }); } });
      card.on('pointerout', () => this.tweens.add({ targets: card, scale: 1, duration: 100 }));
      card.on('pointerdown', () => {
        if (w.locked) { sfx(this, 'cancel'); toast(this, '다음 업데이트에서 열립니다', UI.dim); return; }
        sfx(this, 'confirm');
        go(this, 'StageSelect', { world: w.id });
      });
      card.setAlpha(0).setY(y + 30);
      this.tweens.add({ targets: card, alpha: 1, y, duration: 400, delay: i * 90, ease: 'Back.easeOut' });
    });
  }
}
