import { W, H, UI, FONT_B, FONT_L } from '../core/const';
import { sfx } from '../core/audio';
import { Save } from '../core/save';
import { Button, CurrencyBar, fadeIn, go, outlined, panel, text } from '../core/ui';
import { STAGES, WORLDS, stageUnlocked, type StageDef } from '../data/stages';

const ADD = Phaser.BlendModes.ADD;
const ENEMY_NAMES: Record<string, [string, string]> = {
  sprout: ['새싹병', 'en_sprout'], moth: ['가루나방', 'en_moth'], spore: ['포자꽃', 'en_spore'], beetle: ['방패벌레', 'en_beetle'],
  bigsprout: ['거대 새싹 대장', 'en_sprout'], golem: ['이끼 골렘', 'mb_golem'], mantis: ['칼날 사마귀', 'mb_mantis'], tree: ['고목왕 엘더우드', 'boss_tree'],
};

export class StageSelectScene extends Phaser.Scene {
  world = 1;
  sel!: StageDef;
  info!: Phaser.GameObjects.Container;
  hero!: Phaser.GameObjects.Sprite;
  nodes: Phaser.GameObjects.Container[] = [];
  playBtn!: Button;

  constructor() { super('StageSelect'); }
  init(d: { world?: number }) { this.world = d.world ?? 1; this.nodes = []; }

  create() {
    fadeIn(this);
    const w = WORLDS.find((x) => x.id === this.world)!;
    const th = w.theme;
    this.add.image(0, 0, `bg_sky_${th}`).setOrigin(0);
    this.add.tileSprite(0, H - 250, W, 200, `bg_far_${th}`).setOrigin(0);
    this.add.tileSprite(0, H - 230, W, 210, `bg_mid_${th}`).setOrigin(0).setTint(0xb8c8b8);
    this.add.tileSprite(0, H - 70, W, 70, `ground_${th}`).setOrigin(0);
    this.add.rectangle(0, 0, W, H, 0x0b0714, 0.25).setOrigin(0);
    this.add.particles(0, 0, 'leaf', { x: { min: 0, max: W }, y: -5, lifespan: 7000, speedY: { min: 15, max: 35 }, speedX: { min: -25, max: 10 }, rotate: { min: 0, max: 360 }, tint: [0x6cc24a, 0x8de05a, 0xffd166], frequency: 400 });

    outlined(this, 20, 14, `${w.name}`, 'L', w.color, true);
    text(this, 20, 34, `WORLD ${w.id} · ${w.en}`, 'S', UI.dim);
    new CurrencyBar(this);
    new Button(this, 60, H - 24, '◀ 월드', () => go(this, 'World'), { w: 90 });
    new Button(this, 160, H - 24, '캐릭터', () => go(this, 'Character', { back: 'StageSelect' }), { w: 90 });

    const stages = STAGES.filter((s) => s.world === this.world);
    // path
    const g = this.add.graphics();
    for (let i = 0; i < stages.length - 1; i++) {
      const [x1, y1] = stages[i].map, [x2, y2] = stages[i + 1].map;
      const steps = Math.floor(Math.hypot(x2 - x1, y2 - y1) / 8);
      const done = !!Save.d.cleared[stages[i].id];
      for (let k = 1; k < steps; k++) {
        const t = k / steps;
        const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * 14;
        g.fillStyle(0x0b0714, 1).fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
        g.fillStyle(done ? UI.gold : 0x8a80b0, 1).fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
    }
    // nodes
    let firstOpen = stages[0];
    stages.forEach((s, i) => {
      const [x, y] = s.map;
      const open = stageUnlocked(s.id, Save.d.cleared);
      const stars = Save.d.cleared[s.id] ?? 0;
      if (open) firstOpen = s;
      const boss = i === stages.length - 1;
      const n = this.add.container(x, y);
      const r = boss ? 20 : 15;
      if (open && !stars) {
        const pulse = this.add.image(0, 0, 'ring').setBlendMode(ADD).setTint(UI.gold).setScale(r / 40);
        this.tweens.add({ targets: pulse, scale: r / 24, alpha: 0, duration: 1000, repeat: -1 });
        n.add(pulse);
      }
      const base = this.add.image(0, 0, 'disc').setScale((r + 2) / 32).setTint(0x0b0714);
      const fill = this.add.image(0, 0, 'disc').setScale(r / 32).setTint(!open ? 0x3a3456 : boss ? 0xc8402a : stars ? 0xd8901e : 0x4a3a88);
      const hi = this.add.image(-r * 0.3, -r * 0.35, 'disc').setScale(r / 110).setTint(0xffffff).setAlpha(open ? 0.5 : 0.15);
      n.add([base, fill, hi]);
      if (open) n.add(this.add.text(0, -1, boss ? 'BOSS' : `${s.idx}`, { fontFamily: boss ? FONT_B : FONT_L, fontSize: boss ? '10px' : '15px', color: '#ffffff', stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0.5));
      else n.add(this.add.image(0, 0, 'ic_lock'));
      for (let k = 0; k < 3; k++) n.add(this.add.image((k - 1) * 11, r + 7, k < stars ? 'ic_star' : 'ic_starOff'));
      n.setSize(r * 2 + 6, r * 2 + 6).setInteractive({ useHandCursor: true });
      n.on('pointerover', () => this.tweens.add({ targets: n, scale: 1.15, duration: 90 }));
      n.on('pointerout', () => this.tweens.add({ targets: n, scale: 1, duration: 90 }));
      n.on('pointerdown', () => { if (!open) { sfx(this, 'cancel'); return; } sfx(this, 'click'); this.select(s); });
      this.nodes.push(n);
    });
    this.hero = this.add.sprite(firstOpen.map[0], firstOpen.map[1] - 22, 'hero_' + Save.d.main).setOrigin(0.5, 1).play(`hero_${Save.d.main}_idle`);
    this.info = this.add.container(0, 0);
    this.select(firstOpen, true);
    this.input.keyboard!.on('keydown-ENTER', () => this.playBtn && !this.playBtn.disabled && this.launch());
    this.events.once('shutdown', () => this.input.keyboard!.removeAllListeners('keydown-ENTER'));
  }

  select(s: StageDef, instant = false) {
    this.sel = s;
    const [x, y] = s.map;
    this.tweens.killTweensOf(this.hero);
    if (instant) this.hero.setPosition(x, y - 22);
    else {
      this.hero.setFlipX(x < this.hero.x).play(`hero_${Save.d.main}_run`);
      const d = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, x, y - 22);
      this.tweens.add({ targets: this.hero, x, y: y - 22, duration: Math.max(150, d * 3), ease: 'Sine.easeInOut', onComplete: () => this.hero.play(`hero_${Save.d.main}_idle`) });
    }
    this.info.removeAll(true);
    this.playBtn?.destroy();
    const px = W - 220, py = 54, pw = 210, ph = 250;
    const c = this.info;
    c.add(panel(this, px, py, pw, ph, 'ui_panelGold'));
    c.add(outlined(this, px + 12, py + 10, `STAGE ${s.id}`, 'S', UI.dim, true));
    c.add(outlined(this, px + 12, py + 24, s.name, 'L', UI.gold, true));
    c.add(text(this, px + 12, py + 46, s.desc, 'S', UI.text).setWordWrapWidth(pw - 24));
    c.add(this.add.rectangle(px + pw / 2, py + 80, pw - 20, 1, UI.line));
    c.add(text(this, px + 12, py + 86, '출현 적', 'S', UI.dim));
    const types = new Set<string>();
    s.arenas.forEach((a) => { a.waves.flat().forEach((sp) => types.add(sp.t)); if (a.boss) types.add(a.boss); });
    [...types].forEach((t, i) => {
      const [nm, tex] = ENEMY_NAMES[t];
      const isBoss = ['bigsprout', 'golem', 'mantis', 'tree'].includes(t);
      const ix = px + 26 + (i % 4) * 46, iy = py + 118 + Math.floor(i / 4) * 44;
      c.add(this.add.nineslice(ix, iy, 'ui_slot', undefined, 40, 34, 6, 6, 6, 6));
      const im = this.add.image(ix, iy, tex, 0);
      im.setScale(Math.min(1, 30 / Math.max(im.width, im.height)));
      if (t === 'bigsprout') im.setTint(0xffc0a0);
      c.add(im);
      c.add(text(this, ix, iy + 18, nm.length > 4 ? nm.slice(0, 4) : nm, 'S', isBoss ? UI.red : UI.dim).setOrigin(0.5, 0).setFontSize(9));
    });
    c.add(this.add.rectangle(px + pw / 2, py + 196, pw - 20, 1, UI.line));
    const first = !Save.d.cleared[s.id];
    c.add(text(this, px + 12, py + 202, first ? '첫 클리어 보상' : '반복 보상', 'S', UI.dim));
    c.add(this.add.image(px + 20, py + 224, 'ic_gold'));
    c.add(text(this, px + 30, py + 218, `${s.gold}+`, 'M', UI.gold));
    c.add(this.add.image(px + 100, py + 224, 'ic_gem'));
    c.add(text(this, px + 110, py + 218, `${first ? s.firstGems : s.gems}`, 'M', 0xff9aff));
    c.add(text(this, px + pw - 12, py + 202, `권장 Lv.${s.lv}`, 'S', s.lv >= 5 ? UI.red : UI.dim).setOrigin(1, 0));
    this.playBtn = new Button(this, px + pw / 2, py + ph + 22, '출 격', () => this.launch(), { w: pw, h: 32, gold: true, size: 'L', sound: 'confirm' });
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 200 });
  }

  launch() {
    sfx(this, 'confirm2');
    this.hero.play(`hero_${Save.d.main}_jump`);
    this.tweens.add({ targets: this.hero, y: this.hero.y - 30, duration: 200, yoyo: true });
    go(this, 'Battle', { stageId: this.sel.id });
  }
}
