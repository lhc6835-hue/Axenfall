import { W, H, UI, GRADE_INFO, GRADES, FONT_B, FONT_L, type Grade } from '../core/const';
import { sfx } from '../core/audio';
import { Save } from '../core/save';
import { Button, CurrencyBar, fadeIn, go, gradeBadge, menuBackdrop, outlined, panel, text, toast } from '../core/ui';
import { ABILITIES, type AbilityDef } from '../data/abilities';
import { addTex, makeCanvas, mix, paintShapes, px } from '../art/pixel';

const ADD = Phaser.BlendModes.ADD;
const COST1 = 100, COST10 = 1000, PITY = 50;
const rank = (g: Grade) => GRADES.indexOf(g);

interface Pull { a: AbilityDef; isNew: boolean; shard: boolean }

function rollGrade(forceMin?: Grade): Grade {
  const min = forceMin ? rank(forceMin) : 0;
  const pool = GRADES.filter((g) => rank(g) >= min);
  const total = pool.reduce((s, g) => s + GRADE_INFO[g].rate, 0);
  let r = Math.random() * total;
  for (const g of pool) { r -= GRADE_INFO[g].rate; if (r <= 0) return g; }
  return pool[pool.length - 1];
}

export function doPulls(n: number): Pull[] {
  const out: Pull[] = [];
  let hasSR = false;
  for (let i = 0; i < n; i++) {
    let g: Grade;
    if (Save.d.pity >= PITY - 1) g = rollGrade('SSR');
    else if (n === 10 && i === 9 && !hasSR) g = rollGrade('SR');
    else g = rollGrade();
    if (rank(g) >= rank('SR')) hasSR = true;
    if (rank(g) >= rank('SSR')) Save.d.pity = 0; else Save.d.pity++;
    const pool = ABILITIES.filter((a) => a.grade === g);
    const a = Phaser.Utils.Array.GetRandom(pool);
    const res = Save.grant(a.id);
    out.push({ a, ...res });
    Save.d.totalPulls++;
  }
  Save.write();
  return out;
}

export class GachaScene extends Phaser.Scene {
  ui!: Phaser.GameObjects.Container;
  uiButtons: Button[] = [];
  bar!: CurrencyBar;
  busy = false;
  constructor() { super('Gacha'); }

  create() {
    fadeIn(this);
    this.time.timeScale = 1; this.tweens.timeScale = 1;
    this.busy = false;
    this.uiButtons = [];
    this.buildTextures();
    menuBackdrop(this, 0x200a40);
    // rotating god-rays behind banner
    const rays = this.add.container(W / 2 + 70, 150);
    for (let i = 0; i < 12; i++) {
      const r = this.add.image(0, 0, 'beam').setOrigin(0.5, 1).setDisplaySize(26, 260).setRotation((i / 12) * Math.PI * 2).setBlendMode(ADD).setTint(i % 2 ? 0xff9aff : 0xffd166).setAlpha(0.12);
      rays.add(r);
    }
    this.tweens.add({ targets: rays, angle: 360, duration: 30000, repeat: -1 });
    this.bar = new CurrencyBar(this);
    this.ui = this.add.container(0, 0);
    this.drawIdle();
  }

  buildTextures() {
    if (this.textures.exists('cube')) return;
    // mystery cube: a wide box like the hero, but sealed with glowing runes
    {
      const [cv, ctx] = makeCanvas(72, 52);
      paintShapes(ctx, 0, 0, 72, 52, [
        { k: 'rect', x: 4, y: 6, w: 64, h: 42, c: 0x3a2d68, r: 4 },
        { k: 'rect', x: 4, y: 22, w: 64, h: 8, c: 0xd8901e, z: 1, r: 1 },
        { k: 'rect', x: 31, y: 6, w: 10, h: 42, c: 0xd8901e, z: 1, r: 1 },
        { k: 'ell', x: 36, y: 26, rx: 9, ry: 8, c: 0xffd166, z: 2 },
      ]);
      px(ctx, 34, 23, 0xffffff, 4, 6); px(ctx, 32, 25, 0xffffff, 8, 2);
      addTex(this, 'cube', cv);
    }
    // card back
    {
      const [cv, ctx] = makeCanvas(56, 76);
      px(ctx, 0, 0, 0x0b0714, 56, 76);
      px(ctx, 2, 2, 0xd8901e, 52, 72);
      px(ctx, 4, 4, 0x1a1430, 48, 68);
      for (let y = 6; y < 70; y += 4) for (let x = 6 + ((y / 4) % 2) * 2; x < 50; x += 4) px(ctx, x, y, 0x251c45, 2, 2);
      for (let y = 0; y < 13; y++) { const w = 12 - Math.abs(6 - y) * 2; px(ctx, 28 - w / 2, 32 + y - 6, 0xffd166, w, 1); }
      px(ctx, 27, 31, 0xffffff, 2, 2);
      addTex(this, 'cardBack', cv);
    }
  }

  drawIdle() {
    this.ui.removeAll(true);
    this.uiButtons.forEach((b) => b.destroy());
    this.uiButtons = [];
    const c = this.ui;
    c.add(outlined(this, 20, 14, '소환', 'L', UI.gold, true));
    c.add(text(this, 20, 34, 'SUMMON', 'S', UI.dim));
    // banner
    const bx = 150, by = 52, bw = 440, bh = 210;
    c.add(panel(this, bx, by, bw, bh, 'ui_panelGold'));
    const bgg = this.add.graphics();
    for (let y = 0; y < bh - 12; y++) { bgg.fillStyle(mix(0x3a1060, 0x0b0714, y / bh), 1).fillRect(bx + 6, by + 6 + y, bw - 12, 1); }
    c.add(bgg);
    const feat: [string, number, number, number][] = [['void', bx + 300, by + 118, 1], ['star', bx + 188, by + 136, 0.75], ['shadow', bx + 390, by + 140, 0.7]];
    feat.forEach(([id, x, y, s], i) => {
      const a = ABILITIES.find((q) => q.id === id)!;
      const g = this.add.image(x, y, 'glow').setBlendMode(ADD).setTint(a.fx).setScale(2.2 * s + 0.6).setAlpha(0.6);
      const h = this.add.image(x, y, 'heroBig_' + id).setScale(s * 0.9);
      this.tweens.add({ targets: h, y: y - 6, duration: 1400 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: g, alpha: 0.9, duration: 900 + i * 200, yoyo: true, repeat: -1 });
      c.add([g, h]);
    });
    c.add(this.add.particles(bx + 300, by + 110, 'star4', { x: { min: -140, max: 130 }, y: { min: -60, max: 80 }, lifespan: 1200, scale: { start: 0.7, end: 0 }, tint: [0xffd166, 0xff9aff, 0x3dfff0], frequency: 90, blendMode: 'ADD' }));
    c.add(this.add.text(bx + 18, by + 16, '별빛 소환', { fontFamily: FONT_L, fontSize: '15px', color: '#ffd166', stroke: '#0b0714', strokeThickness: 4, resolution: 1 }).setScale(2));
    c.add(text(this, bx + 18, by + 46, 'STARLIGHT SUMMON', 'S', 0xff9aff));
    const lines = ['신화 「보이드」', '레전드 「스타폴」「섀도우」', '획득 확률 UP 없음 · 상시 소환'];
    lines.forEach((l, i) => c.add(outlined(this, bx + 18, by + 64 + i * 15, l, 'S', i === 0 ? GRADE_INFO.UR.color : i === 1 ? GRADE_INFO.SSR.color : UI.dim, i < 2)));
    // rates
    GRADES.slice().reverse().forEach((g, i) => {
      const y = by + 124 + i * 15;
      c.add(gradeBadge(this, bx + 32, y + 6, g));
      c.add(text(this, bx + 50, y, `${(GRADE_INFO[g].rate * 100).toFixed(1)}%`, 'S', UI.text));
    });
    const left = PITY - Save.d.pity;
    c.add(outlined(this, bx + bw / 2, by + bh - 16, `레전드 이상 확정까지 ${left}회`, 'S', UI.gold, true).setOrigin(0.5));
    // buttons
    const b1 = new Button(this, W / 2 - 90, H - 58, `1회 소환`, () => this.summon(1), { w: 150, h: 36, size: 'L', icon: 'ic_gem', disabled: Save.d.gems < COST1 });
    const b10 = new Button(this, W / 2 + 90, H - 58, `10회 소환`, () => this.summon(10), { w: 150, h: 36, size: 'L', icon: 'ic_gem', gold: true, disabled: Save.d.gems < COST10 });
    this.uiButtons.push(b1, b10);
    c.add(text(this, W / 2 - 90, H - 34, `◆ ${COST1}`, 'S', 0xff9aff).setOrigin(0.5, 0));
    c.add(text(this, W / 2 + 90, H - 34, `◆ ${COST10} · 에픽 이상 1개 확정`, 'S', 0xff9aff).setOrigin(0.5, 0));
    this.uiButtons.push(new Button(this, 60, H - 22, '◀ 로비', () => go(this, 'Hub'), { w: 90 }));
    this.uiButtons.push(new Button(this, 60, 86, '능력 목록', () => go(this, 'Character', { back: 'Gacha' }), { w: 90, h: 24, size: 'S' }));
  }

  summon(n: number) {
    if (this.busy) return;
    const cost = n === 10 ? COST10 : COST1;
    if (Save.d.gems < cost) { toast(this, '보석이 부족합니다', UI.red); return; }
    Save.d.gems -= cost;
    const res = doPulls(n);
    this.bar.refresh();
    this.busy = true;
    this.uiButtons.forEach((b) => b.destroy());
    this.uiButtons = [];
    this.tweens.add({ targets: this.ui, alpha: 0, duration: 250, onComplete: () => { this.ui.removeAll(true); this.ui.setAlpha(1); this.play(res); } });
  }

  // ------------------------------------------------------------------ the show
  play(res: Pull[]) {
    const best = res.reduce((m, r) => Math.max(m, rank(r.a.grade)), 0);
    const stage = this.add.container(0, 0).setDepth(10);
    const dark = this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0);
    stage.add(dark);
    this.tweens.add({ targets: dark, fillAlpha: 0.75, duration: 300 });
    let skip = false;
    const skipBtn = new Button(this, W - 50, H - 20, '스킵 ▶▶', () => { skip = true; this.time.timeScale = 4; this.tweens.timeScale = 4; }, { w: 80, h: 22, size: 'S' });
    skipBtn.setDepth(60);
    const cx = W / 2, cy = H / 2 - 10;
    const cube = this.add.image(cx, -60, 'cube').setScale(1.4);
    const aura = this.add.image(cx, cy, 'glow').setBlendMode(ADD).setTint(GRADE_INFO.R.color).setScale(0).setAlpha(0.8);
    stage.add([aura, cube]);
    const trail = this.add.particles(0, 0, 'p2', { follow: cube, speed: { min: 10, max: 50 }, lifespan: 400, tint: [0xffd166, 0xffffff], frequency: 15, blendMode: 'ADD', alpha: { start: 1, end: 0 } });
    stage.add(trail);
    sfx(this, 'fall');
    this.tweens.add({
      targets: cube, y: cy, angle: 360, duration: 700, ease: 'Quad.easeIn',
      onComplete: () => {
        trail.stop();
        sfx(this, 'drop'); sfx(this, 'hitHeavy', { rate: 0.6 });
        this.cameras.main.shake(150, 0.01);
        this.ringFx(cx, cy + 30, 0xffd166, 10, 200, 400, stage);
        this.tweens.add({ targets: cube, scaleX: 1.7, scaleY: 1.1, duration: 80, yoyo: true });
        this.charge(stage, cube, aura, best, () => this.burst(stage, cube, aura, res, best, skipBtn, () => skip));
      },
    });
  }

  ringFx(x: number, y: number, col: number, from: number, to: number, dur: number, parent?: Phaser.GameObjects.Container, inward = false) {
    const r = this.add.image(x, y, 'ring').setBlendMode(ADD).setTint(col).setScale((inward ? to : from) / 48).setAlpha(inward ? 0 : 1);
    parent?.add(r);
    this.tweens.add({ targets: r, scale: (inward ? from : to) / 48, alpha: inward ? 1 : 0, duration: dur, ease: inward ? 'Cubic.easeIn' : 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  charge(stage: Phaser.GameObjects.Container, cube: Phaser.GameObjects.Image, aura: Phaser.GameObjects.Image, best: number, done: () => void) {
    const cx = cube.x, cy = cube.y;
    const steps: Grade[] = ['R'];
    if (best >= rank('SR')) steps.push('SR');
    if (best >= rank('SSR')) steps.push('SSR');
    if (best >= rank('UR')) steps.push('UR');
    const suck = this.add.particles(cx, cy, 'p2', {
      emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 170) } as Phaser.Types.GameObjects.Particles.EmitZoneData,
      moveToX: cx, moveToY: cy, lifespan: 450, frequency: 10, quantity: 2, tint: GRADE_INFO.R.color, blendMode: 'ADD', scale: { start: 1.5, end: 0.5 },
    });
    stage.add(suck);
    this.tweens.add({ targets: aura, scale: 2.5, duration: 400 });
    const shake = this.tweens.add({ targets: cube, x: { from: cx - 1, to: cx + 1 }, duration: 40, yoyo: true, repeat: -1 });
    let t = 0;
    const stepDur = 750;
    steps.forEach((g, i) => {
      this.time.delayedCall(t, () => {
        const col = GRADE_INFO[g].color;
        aura.setTint(col);
        suck.setParticleTint(col);
        this.ringFx(cx, cy, col, 20, 200, 500, stage, true);
        if (i > 0) {
          sfx(this, 'reveal', { rate: 0.8 + i * 0.2 });
          const fl = this.add.rectangle(0, 0, W, H, col, 0.5).setOrigin(0).setBlendMode(ADD);
          stage.add(fl);
          this.tweens.add({ targets: fl, alpha: 0, duration: 300, onComplete: () => fl.destroy() });
          this.cameras.main.shake(200, 0.006 * i);
          this.tweens.add({ targets: aura, scale: 2.5 + i * 0.9, duration: 200, ease: 'Back.easeOut' });
          shake.timeScale = 1 + i;
          const lbl = this.add.text(cx, cy - 70, ['', '!', '!!', '!!!'][i], { fontFamily: FONT_L, fontSize: '15px', color: '#' + col.toString(16), stroke: '#0b0714', strokeThickness: 4, resolution: 1 }).setOrigin(0.5).setScale(3);
          stage.add(lbl);
          this.tweens.add({ targets: lbl, scale: 2, alpha: 0, y: cy - 90, duration: 600, onComplete: () => lbl.destroy() });
        } else sfx(this, 'rotate', { rate: 0.6 });
        if (g === 'UR') {
          // rainbow cycling + lightning arcs
          const cyc = this.time.addEvent({ delay: 70, loop: true, callback: () => { const h = (this.time.now / 4) % 360; const c = Phaser.Display.Color.HSVToRGB(h / 360, 0.7, 1) as Phaser.Types.Display.ColorObject; aura.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b)); } });
          const g2 = this.add.graphics().setBlendMode(ADD);
          stage.add(g2);
          const bolt = this.time.addEvent({ delay: 60, loop: true, callback: () => {
            g2.clear();
            for (let k = 0; k < 3; k++) {
              const a = Math.random() * Math.PI * 2;
              let x = cx, y = cy;
              g2.lineStyle(2, Math.random() < 0.5 ? 0xff4fd8 : 0x3dfff0, 1).beginPath().moveTo(x, y);
              for (let s = 0; s < 6; s++) { x += Math.cos(a) * 18 + (Math.random() - 0.5) * 16; y += Math.sin(a) * 18 + (Math.random() - 0.5) * 16; g2.lineTo(x, y); }
              g2.strokePath();
            }
          } });
          this.time.delayedCall(stepDur, () => { cyc.remove(); bolt.remove(); g2.destroy(); });
        }
      });
      t += stepDur;
    });
    // cracks just before the burst
    this.time.delayedCall(t - 300, () => {
      const g = this.add.graphics();
      stage.add(g);
      g.lineStyle(1, 0xffffff, 1);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        g.beginPath().moveTo(cx, cy);
        let x = cx, y = cy;
        for (let s = 0; s < 3; s++) { x += Math.cos(a + (Math.random() - 0.5)) * 9; y += Math.sin(a + (Math.random() - 0.5)) * 7; g.lineTo(x, y); }
        g.strokePath();
      }
      sfx(this, 'shatter', { rate: 1.3, vol: 0.5 });
      this.time.delayedCall(300, () => g.destroy());
    });
    this.time.delayedCall(t, () => { suck.stop(); shake.stop(); done(); });
  }

  burst(stage: Phaser.GameObjects.Container, cube: Phaser.GameObjects.Image, aura: Phaser.GameObjects.Image, res: Pull[], best: number, skipBtn: Button, skipped: () => boolean) {
    const cx = cube.x, cy = cube.y;
    const col = GRADE_INFO[GRADES[best]].color;
    sfx(this, 'boom');
    sfx(this, 'hitHeavy', { rate: 0.5 });
    const fl = this.add.rectangle(0, 0, W, H, 0xffffff, 1).setOrigin(0).setBlendMode(ADD);
    stage.add(fl);
    this.tweens.add({ targets: fl, alpha: 0, duration: 500, onComplete: () => fl.destroy() });
    this.cameras.main.shake(250, 0.015);
    cube.destroy();
    this.tweens.add({ targets: aura, scale: 6, alpha: 0, duration: 600 });
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 80, () => this.ringFx(cx, cy, i === 1 ? 0xffffff : col, 10, 360, 600, stage));
    const em = this.add.particles(cx, cy, 'star4', { speed: { min: 100, max: 400 }, lifespan: 900, scale: { start: 1.2, end: 0 }, tint: [col, 0xffffff, 0xffd166], emitting: false, blendMode: 'ADD' });
    stage.add(em);
    em.explode(60);
    // deal the cards
    const n = res.length;
    const cards: Phaser.GameObjects.Container[] = [];
    const flipped: boolean[] = res.map(() => false);
    const pos = (i: number) => n === 1 ? { x: cx, y: cy, s: 1.6 } : { x: W / 2 + ((i % 5) - 2) * 76, y: H / 2 - 52 + Math.floor(i / 5) * 102, s: 1 };
    res.forEach((r, i) => {
      const p = pos(i);
      const card = this.add.container(cx, cy).setScale(0.2).setAlpha(0);
      const gi = GRADE_INFO[r.a.grade];
      const edge = this.add.image(0, 0, 'glow').setBlendMode(ADD).setTint(gi.glow).setScale(1.9, 2.3).setAlpha(rank(r.a.grade) >= 2 ? 0.9 : 0.25);
      if (rank(r.a.grade) >= 2) this.tweens.add({ targets: edge, alpha: 0.4, duration: 300, yoyo: true, repeat: -1 });
      const back = this.add.image(0, 0, 'cardBack');
      const front = this.cardFront(r);
      front.setVisible(false);
      card.add([edge, back, front]);
      card.setData({ back, front, edge });
      card.setSize(56, 76).setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => flip(i));
      stage.add(card);
      cards.push(card);
      this.tweens.add({ targets: card, x: p.x, y: p.y, scale: p.s, alpha: 1, angle: { from: 180, to: 0 }, duration: 380, delay: 300 + i * 70, ease: 'Back.easeOut', onStart: () => sfx(this, 'flip', { rate: 1 + i * 0.05, vol: 0.5 }) });
    });
    let busyFlip = false;
    let openAllBtn: Button | null = null;
    const finish = () => {
      if (!flipped.every(Boolean)) return;
      openAllBtn?.destroy();
      skipBtn.destroy();
      this.time.timeScale = 1; this.tweens.timeScale = 1;
      const newOnes = res.filter((r) => r.isNew).length;
      const sum = outlined(this, W / 2, n === 1 ? H - 80 : H - 74, newOnes ? `새로운 능력 ${newOnes}개 획득!` : '중복 능력은 조각으로 전환되었습니다', 'M', newOnes ? UI.green : UI.dim, true).setOrigin(0.5);
      stage.add(sum);
      const okBtn = new Button(this, W / 2 - 80, H - 40, '확인', () => { okBtn.destroy(); again.destroy(); stage.destroy(); this.busy = false; this.bar.refresh(); this.drawIdle(); }, { w: 120 });
      const again = new Button(this, W / 2 + 80, H - 40, n === 10 ? '10회 더' : '1회 더', () => { okBtn.destroy(); again.destroy(); stage.destroy(); this.busy = false; this.summon(n); }, { w: 120, gold: true, icon: 'ic_gem', disabled: Save.d.gems < (n === 10 ? COST10 : COST1) });
      okBtn.setDepth(60); again.setDepth(60);
    };
    const flip = (i: number, auto = false) => {
      if (flipped[i] || (busyFlip && !auto)) return;
      const card = cards[i], r = res[i];
      const g = rank(r.a.grade);
      flipped[i] = true;
      if (g >= rank('SSR') && !skipped()) {
        busyFlip = true;
        this.special(stage, card, r, () => { busyFlip = false; finish(); });
        return;
      }
      this.doFlip(card, r);
      finish();
    };
    this.time.delayedCall(300 + n * 70 + 400, () => {
      if (n === 1) { flip(0); return; }
      openAllBtn = new Button(this, W / 2, H - 22, '모두 열기', () => {
        openAllBtn?.destroy(); openAllBtn = null;
        let k = 0;
        const next = () => {
          while (k < n && flipped[k]) k++;
          if (k >= n) return;
          if (busyFlip) { this.time.delayedCall(150, next); return; }
          flip(k, true); k++;
          this.time.delayedCall(130, next);
        };
        next();
      }, { w: 120, gold: true });
      openAllBtn.setDepth(60);
    });
  }

  cardFront(r: Pull) {
    const gi = GRADE_INFO[r.a.grade];
    const c = this.add.container(0, 0);
    const g = this.add.graphics();
    g.fillStyle(0x0b0714).fillRect(-28, -38, 56, 76);
    g.fillStyle(gi.color).fillRect(-27, -37, 54, 74);
    for (let y = 0; y < 70; y++) g.fillStyle(mix(mix(gi.glow, 0x0b0714, 0.35), 0x0b0714, y / 80), 1).fillRect(-25, -35 + y, 50, 1);
    c.add(g);
    c.add(this.add.image(0, -10, 'glow').setBlendMode(ADD).setTint(r.a.fx).setScale(1.1).setAlpha(0.6));
    c.add(this.add.image(0, -8, 'heroBig_' + r.a.id).setScale(0.36));
    c.add(gradeBadge(this, -12, -30, r.a.grade));
    c.add(this.add.text(0, 18, r.a.name, { fontFamily: FONT_B, fontSize: '10px', color: '#ffffff', stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0.5));
    const tag = r.isNew ? 'NEW!' : r.shard ? '+1 조각' : '+500G';
    const t = this.add.text(0, 30, tag, { fontFamily: FONT_B, fontSize: '10px', color: r.isNew ? '#5dffa0' : '#ffd166', stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0.5);
    c.add(t);
    if (r.isNew) this.tweens.add({ targets: t, scale: 1.2, duration: 300, yoyo: true, repeat: -1 });
    return c;
  }

  doFlip(card: Phaser.GameObjects.Container, r: Pull, quiet = false) {
    const back = card.getData('back') as Phaser.GameObjects.Image, front = card.getData('front') as Phaser.GameObjects.Container;
    const sx = card.scaleX;
    const g = rank(r.a.grade);
    this.tweens.add({ targets: card, scaleX: 0, duration: 90, ease: 'Quad.easeIn', onComplete: () => {
      back.setVisible(false); front.setVisible(true);
      this.tweens.add({ targets: card, scaleX: sx, duration: 120, ease: 'Back.easeOut' });
      if (!quiet) sfx(this, g >= 2 ? 'reveal' : 'flip', { rate: 1 + g * 0.1 });
      const col = GRADE_INFO[r.a.grade].color;
      const p = this.add.particles(card.x, card.y, g >= 2 ? 'star4' : 'p2', { speed: { min: 40, max: 120 + g * 40 }, lifespan: 500, scale: { start: g >= 2 ? 0.8 : 1, end: 0 }, tint: [col, 0xffffff], emitting: false, blendMode: 'ADD' }).setDepth(20);
      p.explode(8 + g * 6);
      this.time.delayedCall(600, () => p.destroy());
    } });
  }

  special(stage: Phaser.GameObjects.Container, card: Phaser.GameObjects.Container, r: Pull, done: () => void) {
    const gi = GRADE_INFO[r.a.grade];
    const ur = r.a.grade === 'UR';
    const home = { x: card.x, y: card.y, s: card.scaleX };
    stage.bringToTop(card);
    const veil = this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0);
    stage.add(veil);
    stage.bringToTop(card);
    this.tweens.add({ targets: veil, fillAlpha: 0.7, duration: 250 });
    this.tweens.add({ targets: card, x: W / 2, y: H / 2, scale: 2.2, duration: 400, ease: 'Cubic.easeOut' });
    const sh = this.tweens.add({ targets: card, angle: { from: -3, to: 3 }, duration: 50, yoyo: true, repeat: 12, delay: 400 });
    sfx(this, 'rotate', { rate: 0.5 });
    this.time.delayedCall(1050, () => {
      sh.stop(); card.setAngle(0);
      this.doFlip(card, r, true);
      sfx(this, 'hitHeavy', { rate: 0.5 }); sfx(this, 'reveal', { rate: 0.7 });
      const fl = this.add.rectangle(0, 0, W, H, ur ? 0xffffff : gi.color, 0.9).setOrigin(0).setBlendMode(ADD);
      stage.add(fl);
      this.tweens.add({ targets: fl, alpha: 0, duration: 500, onComplete: () => fl.destroy() });
      this.cameras.main.shake(300, 0.012);
      for (let i = 0; i < 4; i++) this.time.delayedCall(i * 90, () => this.ringFx(W / 2, H / 2, i % 2 ? 0xffffff : gi.color, 20, 420, 700, stage));
      // cut-in band
      const band = this.add.container(0, H / 2);
      const b1 = this.add.rectangle(W / 2, 0, W + 40, 120, mix(gi.glow, 0x0b0714, 0.5), 0.95);
      const b2 = this.add.rectangle(W / 2, -62, W + 40, 4, gi.color), b3 = this.add.rectangle(W / 2, 62, W + 40, 4, gi.color);
      band.add([b1, b2, b3]);
      const hero = this.add.image(-120, H / 2 + 4, 'heroBig_' + r.a.id).setScale(1.1);
      const big = this.add.text(W + 200, H / 2 - 22, ur ? 'MYTHIC!!' : 'LEGEND!', { fontFamily: FONT_L, fontSize: '15px', color: '#' + gi.color.toString(16), stroke: '#0b0714', strokeThickness: 5, resolution: 1 }).setOrigin(0.5).setScale(3);
      const nm = this.add.text(W + 200, H / 2 + 22, `${r.a.name}  ·  ${r.a.en}`, { fontFamily: FONT_B, fontSize: '12px', color: '#ffffff', stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0.5).setScale(1.4);
      const cutin = this.add.container(0, 0, [band, hero, big, nm]);
      stage.add(cutin);
      band.setScale(1, 0);
      this.tweens.add({ targets: band, scaleY: 1, duration: 200, delay: 250, ease: 'Back.easeOut' });
      this.tweens.add({ targets: hero, x: W * 0.28, duration: 350, delay: 300, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: [big, nm], x: W * 0.66, duration: 350, delay: 380, ease: 'Cubic.easeOut' });
      const em = this.add.particles(W / 2, H / 2, 'star4', { x: { min: -W / 2, max: W / 2 }, y: { min: -60, max: 60 }, speedX: { min: -300, max: -100 }, lifespan: 900, scale: { start: 1, end: 0 }, tint: ur ? [0xff4fd8, 0x3dfff0, 0xffffff, 0xffd166] : [gi.color, 0xffffff], frequency: 15, blendMode: 'ADD' });
      stage.add(em);
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        em.stop();
        this.tweens.add({ targets: cutin, alpha: 0, duration: 250, onComplete: () => { cutin.destroy(); em.destroy(); } });
        this.tweens.add({ targets: veil, fillAlpha: 0, duration: 300, onComplete: () => veil.destroy() });
        this.tweens.add({ targets: card, x: home.x, y: home.y, scale: home.s, duration: 350, ease: 'Cubic.easeInOut', onComplete: done });
      };
      this.time.delayedCall(700, () => { veil.setInteractive().once('pointerdown', close); });
      this.time.delayedCall(2600, close);
    });
  }
}
