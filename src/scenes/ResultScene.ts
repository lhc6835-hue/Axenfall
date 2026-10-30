import { W, H, UI, FONT_L } from '../core/const';
import { sfx } from '../core/audio';
import { isFullscreen, toggleFullscreen } from '../core/fullscreen';
import { Button, outlined, panel, text } from '../core/ui';
import { STAGES, stageById } from '../data/stages';

interface ResultData { win: boolean; stars: number; gold: number; gems: number; first: boolean; time: number; par: number; kills: number; combo: number; hp: number; stageId: string }

export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  create(d: ResultData) {
    const dim = this.add.rectangle(0, 0, W, H, 0x07060d, 0).setOrigin(0);
    this.tweens.add({ targets: dim, fillAlpha: 0.75, duration: 400 });
    const title = d.win ? 'STAGE CLEAR' : 'DEFEATED';
    const col = d.win ? '#ffd166' : '#ff4d6d';
    const letters: Phaser.GameObjects.Text[] = [];
    const spacing = 22;
    [...title].forEach((ch, i) => {
      const t = this.add.text(W / 2 + (i - (title.length - 1) / 2) * spacing, 52, ch, { fontFamily: FONT_L, fontSize: '15px', color: col, stroke: '#0b0714', strokeThickness: 5, resolution: 1 })
        .setOrigin(0.5).setScale(2.4).setAlpha(0);
      letters.push(t);
      this.tweens.add({ targets: t, alpha: 1, y: { from: 20, to: 52 }, duration: 300, delay: 200 + i * 45, ease: 'Back.easeOut' });
    });
    if (d.win) {
      this.add.particles(W / 2, 52, 'p2', { speed: { min: 40, max: 160 }, lifespan: 900, alpha: { start: 1, end: 0 }, tint: [0xffd166, 0xffffff, 0xff9aff], emitting: false, blendMode: 'ADD' }).explode(40);
    }
    const p = panel(this, W / 2 - 170, 92, 340, 200, 'ui_panelGold');
    p.setAlpha(0);
    this.tweens.add({ targets: p, alpha: 1, duration: 300, delay: 300 });
    // stars
    for (let i = 0; i < 3; i++) {
      const on = i < d.stars;
      const s = this.add.image(W / 2 + (i - 1) * 46, 122, on ? 'ic_star' : 'ic_starOff').setScale(0).setAngle(-90);
      this.tweens.add({ targets: s, scale: 3, angle: 0, duration: 380, delay: 700 + i * 260, ease: 'Back.easeOut', onStart: () => { if (on) { sfx(this, 'reveal', { rate: 1 + i * 0.2 }); const g = this.add.image(s.x, s.y, 'glow').setTint(0xffd166).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: g, scale: 2.5, alpha: 0, duration: 500, onComplete: () => g.destroy() }); } } });
    }
    const conds = d.win ? [`클리어`, `HP 50% 이상 (${Math.round(d.hp * 100)}%)`, `${d.par}초 안에 클리어 (${d.time}초)`] : [];
    conds.forEach((c, i) => text(this, W / 2 - 150, 146 + i * 13, (i < d.stars ? '★ ' : '☆ ') + c, 'S', i < d.stars ? UI.gold : UI.dim));
    const rows: [string, string][] = [['처치', `${d.kills}`], ['최대 콤보', `${d.combo}`], ['시간', `${Math.floor(d.time / 60)}:${String(d.time % 60).padStart(2, '0')}`]];
    rows.forEach(([k, v], i) => { text(this, W / 2 + 40, 146 + i * 13, k, 'S', UI.dim); text(this, W / 2 + 150, 146 + i * 13, v, 'S', UI.text).setOrigin(1, 0); });
    // rewards count up
    const ry = 200;
    this.add.rectangle(W / 2, ry - 6, 300, 1, UI.line);
    outlined(this, W / 2, ry, d.win ? '획득 보상' : '회수한 골드 (50%)', 'S', UI.dim).setOrigin(0.5, 0);
    this.add.image(W / 2 - 80, ry + 28, 'ic_gold').setScale(1.4);
    const gT = outlined(this, W / 2 - 66, ry + 21, '0', 'L', UI.gold, true);
    this.add.image(W / 2 + 30, ry + 28, 'ic_gem').setScale(1.4);
    const mT = outlined(this, W / 2 + 44, ry + 21, '0', 'L', 0xff9aff, true);
    this.tweens.addCounter({ from: 0, to: d.gold, duration: 800, delay: 1300, onUpdate: (tw) => { gT.setText(String(Math.round(tw.getValue() ?? 0))); }, onStart: () => sfx(this, 'coin') });
    this.tweens.addCounter({ from: 0, to: d.gems, duration: 800, delay: 1450, onUpdate: (tw) => { mT.setText(String(Math.round(tw.getValue() ?? 0))); } });
    if (d.first && d.win) {
      const f = outlined(this, W / 2 + 120, ry + 22, '첫 클리어!', 'S', UI.green, true).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: f, alpha: 1, scale: { from: 2, to: 1 }, delay: 1700, duration: 300, ease: 'Back.easeOut' });
    }
    if (!d.win) {
      text(this, W / 2, ry + 50, 'TIP: 캐릭터 화면에서 능력 레벨과 기본 능력치를 올려 보세요.', 'S', UI.dim).setOrigin(0.5);
    }
    // buttons
    const by = H - 40;
    const stage = stageById(d.stageId);
    const next = STAGES.find((s) => s.world === stage.world && s.idx === stage.idx + 1);
    const leave = () => this.leave('StageSelect', { world: stage.world });
    const btns: Button[] = [];
    btns.push(new Button(this, W / 2 - 140, by, '스테이지 선택', leave, { w: 120 }));
    btns.push(new Button(this, W / 2, by, '다시 하기', () => this.leave('Battle', { stageId: d.stageId }), { w: 120 }));
    if (d.win && next) btns.push(new Button(this, W / 2 + 140, by, '다음 스테이지 ▶', () => this.leave('Battle', { stageId: next.id }), { w: 130, gold: true, sound: 'confirm' }));
    else if (!d.win) btns.push(new Button(this, W / 2 + 140, by, '캐릭터 강화', () => this.leave('Character', {}), { w: 120, gold: true }));
    else btns.push(new Button(this, W / 2 + 140, by, '월드 맵', () => this.leave('World', {}), { w: 120, gold: true }));
    btns.forEach((b, i) => { b.setAlpha(0); this.tweens.add({ targets: b, alpha: 1, y: { from: by + 20, to: by }, delay: 1200 + i * 100, duration: 300, ease: 'Back.easeOut' }); });
    letters.length = 0;
  }

  leave(key: string, data: object) {
    this.scene.stop('Hud');
    this.scene.stop('Battle');
    this.scene.start(key, data);
  }
}

export class PauseScene extends Phaser.Scene {
  constructor() { super('Pause'); }
  create(d: { stageId: string }) {
    this.add.rectangle(0, 0, W, H, 0x07060d, 0.7).setOrigin(0);
    panel(this, W / 2 - 110, H / 2 - 100, 220, 200, 'ui_panelGold');
    outlined(this, W / 2, H / 2 - 86, '일시 정지', 'L', UI.gold, true).setOrigin(0.5, 0);
    const resume = () => { this.scene.stop(); this.scene.resume('Battle'); this.scene.resume('Hud'); };
    new Button(this, W / 2, H / 2 - 40, '계속하기', resume, { w: 160 });
    new Button(this, W / 2, H / 2 - 8, '다시 시작', () => { this.scene.stop('Hud'); this.scene.stop('Battle'); this.scene.start('Battle', { stageId: d.stageId }); }, { w: 160 });
    new Button(this, W / 2, H / 2 + 24, isFullscreen() ? '전체화면 끄기' : '전체화면 켜기', () => { toggleFullscreen(); this.scene.restart(d); }, { w: 160 });
    new Button(this, W / 2, H / 2 + 56, '포기하고 나가기', () => { this.scene.stop('Hud'); this.scene.stop('Battle'); this.scene.start('StageSelect', { world: 1 }); }, { w: 160 });
    this.input.keyboard!.once('keydown-ESC', resume);
  }
}
