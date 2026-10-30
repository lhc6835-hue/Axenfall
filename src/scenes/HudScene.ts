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
    const keys = ['Q', 'E', 'R', 'F'];
    const sx = W / 2 - (4 * 40) / 2 + 20;
    this.add.nineslice(W / 2, H - 30, 'ui_panel', undefined, 4 * 40 + 52, 46, 8, 8, 8, 8).setAlpha(0.92);
    const basic = this.add.container(sx - 44, H - 33);
    basic.add([this.add.nineslice(0, 0, 'ui_slot', undefined, 30, 30, 6, 6, 6, 6), this.add.image(0, 0, 'ic_basic_' + a.id).setScale(0.86), outlined(this, 0, 13, this.isTouch ? '' : '클릭', 'S', UI.dim).setOrigin(0.5, 0)]);
    basic.setScale(0.85);
    ids.forEach((id, i) => {
      const x = sx + i * 40 + (i === 3 ? 6 : 0), y = H - 33;
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
      // tap / click the icon to use the skill
      cont.setSize(38, 38).setInteractive();
      cont.on('pointerdown', () => this.bs.press((['s1', 's2', 's3', 'ult'] as const)[i]));
    });
    // ----- top right: gold
    const gy = this.isTouch ? 8 : H - 44, gx = this.isTouch ? W - 130 : W - 92;
    this.add.nineslice(gx, gy, 'ui_slot', undefined, 84, 20, 6, 6, 6, 6).setOrigin(0);
    this.add.image(gx + 10, gy + 10, 'ic_gold');
    this.goldT = text(this, gx + 78, gy + 4, '0', 'M', UI.gold).setOrigin(1, 0);
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
    if (this.isTouch) this.touchControls();
    if (this.bs.stage.id === '1-1') this.controlsHint();
  }

  /** Touch devices (or ?touch=1) get an on-screen joystick and buttons. */
  get isTouch() {
    return this.sys.game.device.input.touch || /[?&]touch=1/.test(location.search);
  }

  touchControls() {
    const t = this.bs.touch;
    this.input.addPointer(3);
    // ---- floating joystick on the left part of the screen
    const home = { x: 78, y: H - 78 };
    const base = this.add.circle(home.x, home.y, 34, 0x0b0714, 0.35).setStrokeStyle(2, 0xffffff, 0.35);
    const knob = this.add.circle(home.x, home.y, 15, 0xffffff, 0.45).setStrokeStyle(2, 0x0b0714, 0.6);
    const zone = this.add.zone(0, 60, W * 0.42, H - 60).setOrigin(0).setInteractive().setDepth(-10);
    let jid = -1;
    const R = 30;
    const reset = () => {
      jid = -1; t.dx = 0; t.down = false;
      this.tweens.add({ targets: [base, knob], x: home.x, y: home.y, duration: 120 });
      base.setAlpha(1); knob.setAlpha(1);
    };
    const move = (p: Phaser.Input.Pointer) => {
      const ox = Phaser.Math.Clamp(p.x - base.x, -R, R), oy = Phaser.Math.Clamp(p.y - base.y, -R, R);
      knob.setPosition(base.x + ox, base.y + oy);
      t.dx = ox / R; t.down = oy / R > 0.6;
    };
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (jid !== -1) return;
      jid = p.id;
      this.tweens.killTweensOf([base, knob]);
      base.setPosition(p.x, p.y); knob.setPosition(p.x, p.y);
      base.setAlpha(1.4); knob.setAlpha(1.4);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.id === jid) move(p); });
    // ---- action buttons on the right
    const held = new Map<number, () => void>();
    const btn = (x: number, y: number, r: number, label: string, color: number, down: () => void, up?: () => void) => {
      const c = this.add.container(x, y);
      const ring = this.add.circle(0, 0, r, color, 0.35).setStrokeStyle(2, color, 0.9);
      const tx = this.add.text(0, -1, label, { fontFamily: FONT_B, fontSize: '12px', color: '#ffffff', stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0.5);
      c.add([ring, tx]);
      c.setSize(r * 2 + 8, r * 2 + 8).setInteractive();
      c.on('pointerdown', (p: Phaser.Input.Pointer) => {
        down();
        c.setScale(0.88); ring.setFillStyle(color, 0.7);
        held.set(p.id, () => { c.setScale(1); ring.setFillStyle(color, 0.35); up?.(); });
      });
      return c;
    };
    btn(W - 56, H - 64, 32, '공격', 0xff6a5a, () => { this.bs.press('attack'); t.attackHeld = true; }, () => (t.attackHeld = false));
    btn(W - 128, H - 34, 22, '점프', 0x5ee7ff, () => { this.bs.press('jump'); t.jumpHeld = true; }, () => (t.jumpHeld = false));
    btn(W - 116, H - 102, 19, '대시', 0x9a6aff, () => this.bs.press('dash'));
    btn(W - 22, 22, 14, 'II', 0x9a8fbf, () => this.bs.pauseGame());
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.id === jid) reset();
      const h = held.get(p.id);
      if (h) { h(); held.delete(p.id); }
    });
    const onResume = () => { reset(); held.forEach((h) => h()); held.clear(); };
    this.events.on('resume', onResume);
    this.events.once('shutdown', () => { this.events.off('resume', onResume); this.input.off('pointermove'); this.input.off('pointerup'); t.dx = 0; t.down = false; t.attackHeld = false; t.jumpHeld = false; });
  }

  controlsHint() {
    const lines = this.isTouch ? ['왼쪽 화면을 끌어서 이동 (아래로 당기고 점프 = 발판 내려가기)', '오른쪽 버튼: 공격(꾹 누르면 연속) · 점프 · 대시   스킬 아이콘을 터치하면 발동'] : ['A D 이동   W·Space 점프 (2단)   마우스 왼쪽 클릭 공격 (꾹 누르면 연속)   Shift 대시', 'Q E R 스킬   F 궁극기 (게이지 100%)   S+점프 발판 내려가기   ESC 일시정지'];
    const c = this.add.container(W / 2, 92);
    const bg = this.add.nineslice(0, 0, 'ui_panel', undefined, 620, 40, 8, 8, 8, 8).setAlpha(0.9);
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

