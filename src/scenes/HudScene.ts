import { W, H, UI, FONT_B, FONT_L } from '../core/const';
import { skillById } from '../data/abilities';
import { outlined, text } from '../core/ui';
import type { BattleScene } from './BattleScene';
import type { Boss } from '../battle/bosses';

interface SlotUi { cont: Phaser.GameObjects.Container; cover: Phaser.GameObjects.Rectangle; cdText: Phaser.GameObjects.Text; ready: boolean; frame: Phaser.GameObjects.NineSlice; id: string | null }

export class HudScene extends Phaser.Scene {
  bs!: BattleScene;
  hpBar!: Phaser.GameObjects.Graphics;
  hpText!: Phaser.GameObjects.Text;
  ultBar!: Phaser.GameObjects.Graphics;
  slots: SlotUi[] = [];
  bossC!: Phaser.GameObjects.Container;
  bossBar!: Phaser.GameObjects.Graphics;
  bossName!: Phaser.GameObjects.Text;
  boss: Boss | null = null;
  bossTrail = 1;
  hpTrail = 1;
  comboT!: Phaser.GameObjects.Text;
  comboSub!: Phaser.GameObjects.Text;
  lastCombo = 0;
  goldT!: Phaser.GameObjects.Text;
  waveT!: Phaser.GameObjects.Text;
  ultReadyFx?: Phaser.Tweens.Tween;

  constructor() { super('Hud'); }

  init(d: { battle: BattleScene }) { this.bs = d.battle; this.slots = []; this.boss = null; this.bossTrail = 1; this.hpTrail = 1; this.lastCombo = 0; }

  create() {
    const p = this.bs.player;
    const a = p.ability;
    // ----- player panel
    this.add.nineslice(6, 6, 'ui_panelGold', undefined, 196, 46, 8, 8, 8, 8).setOrigin(0);
    this.add.nineslice(10, 10, 'ui_slot', undefined, 38, 38, 6, 6, 6, 6).setOrigin(0);
    this.add.image(29, 29, 'hero_' + a.id, 0).setScale(1.2);
    outlined(this, 54, 9, a.name, 'S', a.fx === 0xff3df0 ? 0xff9aff : 0xffffff, true);
    this.hpBar = this.add.graphics();
    this.hpText = text(this, 196, 9, '', 'S', UI.text).setOrigin(1, 0);
    this.ultBar = this.add.graphics();
    // ----- skills (bottom centre)
    const ids: (string | null)[] = [...p.slots, p.ultId];
    const keys = ['A', 'S', 'D', 'F'];
    const sx = W / 2 - (4 * 40) / 2 + 20;
    this.add.nineslice(W / 2, H - 26, 'ui_panel', undefined, 4 * 40 + 52, 46, 8, 8, 8, 8).setAlpha(0.92);
    const basic = this.add.container(sx - 44, H - 28);
    basic.add([this.add.nineslice(0, 0, 'ui_slot', undefined, 30, 30, 6, 6, 6, 6), this.add.image(0, 0, 'ic_basic_' + a.id).setScale(0.86), outlined(this, 0, 13, 'X', 'S', UI.dim).setOrigin(0.5, 0)]);
    basic.setScale(0.85);
    ids.forEach((id, i) => {
      const x = sx + i * 40 + (i === 3 ? 6 : 0), y = H - 28;
      const cont = this.add.container(x, y);
      const frame = this.add.nineslice(0, 0, i === 3 ? 'ui_panelGold' : 'ui_slot', undefined, 34, 34, 6, 6, 6, 6);
      cont.add(frame);
      if (id) cont.add(this.add.image(0, 0, 'ic_' + id));
      else cont.add(text(this, 0, 0, '—', 'S', UI.dim).setOrigin(0.5));
      const cover = this.add.rectangle(-14, 14, 28, 28, 0x0b0714, 0.72).setOrigin(0, 1);
      cover.height = 0;
      const cdText = outlined(this, 0, -1, '', 'M', UI.text, true).setOrigin(0.5);
      const key = outlined(this, 0, 14, keys[i], 'S', i === 3 ? UI.gold : UI.dim, true).setOrigin(0.5, 0);
      cont.add([cover, cdText, key]);
      this.slots.push({ cont, cover, cdText, ready: true, frame, id });
    });
    // ----- top right: gold
    this.add.nineslice(W - 92, H - 44, 'ui_slot', undefined, 84, 20, 6, 6, 6, 6).setOrigin(0);
    this.add.image(W - 82, H - 34, 'ic_gold');
    this.goldT = text(this, W - 14, H - 40, '0', 'M', UI.gold).setOrigin(1, 0);
    // ----- wave
    this.waveT = outlined(this, W / 2 + 60, 46, '', 'S', UI.dim, true).setOrigin(0.5, 0);
    // ----- combo
    this.comboT = this.add.text(W - 16, 110, '', { fontFamily: FONT_L, fontSize: '15px', color: '#ffd166', stroke: '#0b0714', strokeThickness: 4, resolution: 1 }).setOrigin(1, 0.5).setScale(1.6);
    this.comboSub = outlined(this, W - 16, 128, 'COMBO', 'S', 0xffffff, true).setOrigin(1, 0.5).setAlpha(0);
    // ----- boss bar
    this.bossC = this.add.container(W / 2 + 60, 26).setAlpha(0);
    const bp = this.add.nineslice(0, 0, 'ui_panelGold', undefined, 300, 30, 8, 8, 8, 8);
    this.bossName = this.add.text(-140, -16, '', { fontFamily: FONT_B, fontSize: '12px', color: '#ffd166', stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0, 0.5);
    this.bossBar = this.add.graphics();
    this.bossC.add([bp, this.bossBar, this.bossName]);

    this.bs.events.on('boss', this.onBoss, this);
    this.bs.events.on('skillUsed', this.onSkillUsed, this);
    this.bs.events.on('cdDenied', this.onDenied, this);
    this.bs.events.on('wave', this.onWave, this);
    this.events.once('shutdown', () => {
      this.bs.events.off('boss', this.onBoss, this);
      this.bs.events.off('skillUsed', this.onSkillUsed, this);
      this.bs.events.off('cdDenied', this.onDenied, this);
      this.bs.events.off('wave', this.onWave, this);
    });
    if (this.bs.stage.id === '1-1') this.controlsHint();
  }

  controlsHint() {
    const lines = ['← → 이동   C/Space 점프 (2단)   X 공격   Z/Shift 대시', 'A S D 스킬   F 궁극기 (게이지 100%)   ↓+점프 발판 내려가기   ESC 일시정지'];
    const c = this.add.container(W / 2, 92);
    const bg = this.add.nineslice(0, 0, 'ui_panel', undefined, 470, 40, 8, 8, 8, 8).setAlpha(0.9);
    c.add(bg);
    lines.forEach((l, i) => c.add(text(this, 0, -9 + i * 14, l, 'S', i ? UI.dim : UI.text).setOrigin(0.5)));
    this.tweens.add({ targets: c, alpha: 0, delay: 9000, duration: 800, onComplete: () => c.destroy() });
  }

  onBoss(b: Boss | null) {
    this.boss = b;
    this.bossTrail = 1;
    if (b) {
      this.bossName.setText(b.title);
      this.tweens.add({ targets: this.bossC, alpha: 1, y: { from: 6, to: 26 }, duration: 400, ease: 'Back.easeOut' });
    } else this.tweens.add({ targets: this.bossC, alpha: 0, duration: 400 });
  }
  onSkillUsed(i: number) {
    const s = this.slots[i];
    this.tweens.add({ targets: s.cont, scale: 1.25, duration: 70, yoyo: true });
  }
  onDenied(i: number) {
    const s = this.slots[i];
    this.tweens.add({ targets: s.cont, x: s.cont.x + 3, duration: 35, yoyo: true, repeat: 2 });
  }
  onWave(n: number, total: number) {
    this.waveT.setText(`WAVE ${n} / ${total}`);
    this.waveT.setScale(1.5);
    this.tweens.add({ targets: this.waveT, scale: 1, duration: 300, ease: 'Back.easeOut' });
  }

  update(_t: number, dt: number) {
    const p = this.bs.player;
    if (!p) return;
    // HP
    const ratio = p.hp / p.maxHp;
    this.hpTrail = this.hpTrail > ratio ? Math.max(ratio, this.hpTrail - dt / 1500) : ratio;
    const g = this.hpBar; g.clear();
    const bx = 54, by = 24, bw = 142;
    g.fillStyle(0x0b0714).fillRect(bx - 1, by - 1, bw + 2, 10);
    g.fillStyle(0x3a1a2a).fillRect(bx, by, bw, 8);
    g.fillStyle(0xffffff, 0.8).fillRect(bx, by, bw * this.hpTrail, 8);
    const hc = ratio > 0.5 ? 0x5dffa0 : ratio > 0.25 ? 0xffd166 : 0xff4d6d;
    g.fillStyle(hc).fillRect(bx, by, bw * ratio, 8);
    g.fillStyle(0xffffff, 0.35).fillRect(bx, by, bw * ratio, 2);
    for (let i = 1; i < 10; i++) g.fillStyle(0x0b0714, 0.35).fillRect(bx + (bw / 10) * i, by, 1, 8);
    this.hpText.setText(`${Math.ceil(p.hp)}/${p.maxHp}`);
    // ULT
    const u = this.ultBar; u.clear();
    const uy = 37;
    u.fillStyle(0x0b0714).fillRect(bx - 1, uy - 1, bw + 2, 7);
    u.fillStyle(0x221a3a).fillRect(bx, uy, bw, 5);
    const full = p.ult >= 100;
    const ucol = full ? (Math.floor(this.time.now / 120) % 2 ? 0xffffff : UI.gold) : 0x9a6aff;
    u.fillStyle(ucol).fillRect(bx, uy, bw * (p.ult / 100), 5);
    // slots
    this.slots.forEach((s, i) => {
      let r = 0, txt = '';
      if (i < 3) {
        const id = s.id;
        const total = id ? skillById(id).cd * 1000 : 1;
        r = id ? p.cds[i] / total : 0;
        txt = p.cds[i] > 0 ? (p.cds[i] / 1000).toFixed(p.cds[i] < 1000 ? 1 : 0) : '';
      } else {
        r = s.id ? 1 - p.ult / 100 : 0;
        txt = s.id && p.ult < 100 ? `${Math.floor(p.ult)}` : '';
      }
      s.cover.height = 28 * r;
      s.cover.y = 14;
      s.cdText.setText(txt).setFontSize(i === 3 ? 10 : 12);
      const ready = r <= 0 && !!s.id;
      if (ready && !s.ready) {
        this.tweens.add({ targets: s.cont, scale: 1.2, duration: 100, yoyo: true });
        const fl = this.add.image(s.cont.x, s.cont.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setScale(0.8).setTint(i === 3 ? UI.gold : 0xffffff);
        this.tweens.add({ targets: fl, alpha: 0, scale: 1.4, duration: 350, onComplete: () => fl.destroy() });
      }
      s.ready = ready;
      if (i === 3) s.frame.setTint(ready ? (Math.floor(this.time.now / 150) % 2 ? 0xffffff : 0xffe0a0) : 0xffffff);
    });
    // gold
    this.goldT.setText(String(this.bs.goldEarned));
    // combo
    const cmb = this.bs.combo;
    if (cmb >= 2) {
      if (cmb !== this.lastCombo) {
        this.comboT.setText(`${cmb} HIT`).setScale(2).setAlpha(1);
        this.tweens.add({ targets: this.comboT, scale: 1.4, duration: 120, ease: 'Back.easeOut' });
        this.comboSub.setAlpha(1);
        const col = cmb >= 50 ? '#ff4fd8' : cmb >= 25 ? '#ff8a3a' : cmb >= 10 ? '#ffd166' : '#ffffff';
        this.comboT.setColor(col);
      }
    } else if (this.lastCombo >= 2) {
      this.tweens.add({ targets: [this.comboT, this.comboSub], alpha: 0, duration: 300 });
    }
    this.lastCombo = cmb;
    // boss bar
    if (this.boss) {
      const b = this.boss;
      const r = Math.max(0, b.hp / b.maxHp);
      this.bossTrail = this.bossTrail > r ? Math.max(r, this.bossTrail - dt / 1200) : r;
      const bb = this.bossBar; bb.clear();
      const x = -140, y = -4, w = 280;
      bb.fillStyle(0x0b0714).fillRect(x - 1, y - 1, w + 2, 12);
      bb.fillStyle(0x2a1020).fillRect(x, y, w, 10);
      bb.fillStyle(0xffffff, 0.85).fillRect(x, y, w * this.bossTrail, 10);
      bb.fillStyle(b.phase === 2 ? 0xff3a3a : 0xff7a3a).fillRect(x, y, w * r, 10);
      bb.fillStyle(0xffffff, 0.3).fillRect(x, y, w * r, 3);
      const mark = b.type === 'tree' ? 0.6 : 0.5;
      bb.fillStyle(0xffd166).fillRect(x + w * mark, y - 2, 1, 14);
    }
  }
}

