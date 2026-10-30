import { W, H, UI, FONT_B, GRADE_INFO } from '../core/const';
import { playBgm, sfx, setBgmVolume } from '../core/audio';
import { Save } from '../core/save';
import { Button, CurrencyBar, fadeIn, go, menuBackdrop, outlined, panel, text, toast } from '../core/ui';
import { abilityById } from '../data/abilities';
import { STAGES } from '../data/stages';

const ADD = Phaser.BlendModes.ADD;

export class HubScene extends Phaser.Scene {
  constructor() { super('Hub'); }

  create() {
    fadeIn(this);
    playBgm(this, 'menu');
    menuBackdrop(this, 0x1a1040);
    const a = abilityById(Save.d.main);
    // hero showcase on a pedestal
    const cx = W * 0.62, cy = H * 0.6;
    const rays = this.add.image(cx, cy - 20, 'glow').setBlendMode(ADD).setTint(a.fx).setScale(5).setAlpha(0.35);
    this.tweens.add({ targets: rays, scale: 5.6, alpha: 0.5, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const ring = this.add.image(cx, cy + 50, 'ring').setBlendMode(ADD).setTint(a.fx).setScale(2.2, 0.5).setAlpha(0.7);
    this.tweens.add({ targets: ring, angle: 360, duration: 8000, repeat: -1 });
    this.add.image(cx, cy + 52, 'shadowOval').setTint(0x000000).setAlpha(0.5).setScale(4, 2);
    const hero = this.add.image(cx, cy, 'heroBig_' + a.id).setOrigin(0.5, 0.5);
    this.tweens.add({ targets: hero, y: cy - 6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.particles(cx, cy + 40, 'p2', { x: { min: -60, max: 60 }, speedY: { min: -60, max: -20 }, lifespan: 1600, alpha: { start: 1, end: 0 }, tint: [a.fx, a.fx2], frequency: 60, blendMode: 'ADD' });
    // blink the eyes now and then by squashing the image a touch
    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.tweens.add({ targets: hero, scaleY: 0.94, scaleX: 1.04, duration: 80, yoyo: true }) });

    const gi = GRADE_INFO[a.grade];
    const tag = this.add.container(cx, cy + 82);
    tag.add(this.add.nineslice(0, 0, 'ui_panel', undefined, 180, 30, 8, 8, 8, 8));
    tag.add(this.add.text(0, -1, `${a.name}  ·  ${gi.name}`, { fontFamily: FONT_B, fontSize: '12px', color: '#' + gi.color.toString(16), stroke: '#0b0714', strokeThickness: 3, resolution: 1 }).setOrigin(0.5));

    // small logo top-left
    const logo = this.add.container(16, 14);
    'AXENFALL'.split('').forEach((ch, i) => logo.add(this.add.image(i * 22, 0, 'tl_' + ch).setOrigin(0, 0).setScale(0.42)));
    new CurrencyBar(this);

    // menu
    const cleared = Object.keys(Save.d.cleared).length;
    const items: [string, string, string, () => void][] = [
      ['모험', `월드 ${cleared}/${STAGES.length} 클리어`, 'ic_sword', () => go(this, 'World')],
      ['소환', `보석 ${Save.d.gems}`, 'ic_gem', () => go(this, 'Gacha')],
      ['캐릭터', '능력 · 스킬 편성 · 강화', 'ic_star', () => go(this, 'Character')],
      ['설정', '소리 · 데이터', 'ic_lock', () => this.settings()],
    ];
    items.forEach(([label, sub, icon, fn], i) => {
      const y = 92 + i * 52;
      const b = new Button(this, 120, y, label, fn, { w: 200, h: 42, size: 'L', icon, gold: i === 0, sound: 'confirm' });
      b.label.setX(-30).setOrigin(0, 0.5).setY(-6);
      const st = text(this, -30, 8, sub, 'S', UI.dim);
      b.add(st);
      b.setAlpha(0).setX(60);
      this.tweens.add({ targets: b, alpha: 1, x: 120, duration: 350, delay: 100 + i * 70, ease: 'Back.easeOut' });
    });
    if (!Save.d.seenIntro) {
      Save.d.seenIntro = true; Save.write();
      this.time.delayedCall(600, () => this.intro());
    }
    text(this, 8, H - 14, '능력 8 / 월드 1 · 1단계 빌드', 'S', UI.dim);
  }

  intro() {
    const c = this.add.container(0, 0).setDepth(100);
    c.add(this.add.rectangle(0, 0, W, H, 0x07060d, 0.7).setOrigin(0).setInteractive());
    c.add(panel(this, W / 2 - 170, H / 2 - 80, 340, 160, 'ui_panelGold'));
    c.add(outlined(this, W / 2, H / 2 - 66, '환영합니다, 네모 용사!', 'L', UI.gold, true).setOrigin(0.5, 0));
    const lines = ['기본 능력 「블레이드」가 지급되었습니다.', '시작 선물로 보석 1000개를 드려요.', '소환에서 새로운 능력을 뽑고,', '캐릭터 화면에서 스킬을 편성해 보세요.'];
    lines.forEach((l, i) => c.add(text(this, W / 2, H / 2 - 34 + i * 16, l, 'M', UI.text).setOrigin(0.5, 0)));
    const ok = new Button(this, W / 2, H / 2 + 56, '확인', () => { c.destroy(); ok.destroy(); }, { w: 100 });
    ok.setDepth(101);
  }

  settings() {
    const c = this.add.container(0, 0).setDepth(100);
    const close: Button[] = [];
    c.add(this.add.rectangle(0, 0, W, H, 0x07060d, 0.7).setOrigin(0).setInteractive());
    c.add(panel(this, W / 2 - 150, H / 2 - 100, 300, 200, 'ui_panelGold'));
    c.add(outlined(this, W / 2, H / 2 - 88, '설정', 'L', UI.gold, true).setOrigin(0.5, 0));
    const row = (y: number, label: string, get: () => number, set: (v: number) => void) => {
      c.add(text(this, W / 2 - 130, y - 6, label, 'M', UI.text));
      const val = text(this, W / 2 + 130, y - 6, '', 'M', UI.gold).setOrigin(1, 0);
      c.add(val);
      const upd = () => val.setText(`${Math.round(get() * 100)}%`);
      upd();
      close.push(new Button(this, W / 2 - 10, y, '−', () => { set(Math.max(0, Math.round((get() - 0.1) * 10) / 10)); upd(); Save.write(); }, { w: 30, h: 22 }));
      close.push(new Button(this, W / 2 + 30, y, '+', () => { set(Math.min(1, Math.round((get() + 0.1) * 10) / 10)); upd(); Save.write(); sfx(this, 'coin'); }, { w: 30, h: 22 }));
    };
    row(H / 2 - 50, '효과음', () => Save.d.sfx, (v) => (Save.d.sfx = v));
    row(H / 2 - 20, '배경음', () => Save.d.bgm, (v) => { Save.d.bgm = v; setBgmVolume(v); });
    c.add(text(this, W / 2, H / 2 + 6, this.cache.json.get('bgmManifest') && Object.keys(this.cache.json.get('bgmManifest')).length ? '' : '※ 배경음 파일이 아직 없습니다 (네트워크 허용 후 추가 예정)', 'S', UI.dim).setOrigin(0.5, 0));
    let armed = false;
    const reset = new Button(this, W / 2 - 60, H / 2 + 50, '데이터 초기화', () => {
      if (!armed) { armed = true; reset.setText('한 번 더 누르세요'); return; }
      Save.reset(); toast(this, '초기화되었습니다', UI.red); this.time.delayedCall(500, () => this.scene.restart());
    }, { w: 110 });
    close.push(reset);
    close.push(new Button(this, W / 2 + 70, H / 2 + 50, '닫기', () => { c.destroy(); close.forEach((b) => b.destroy()); }, { w: 90, gold: true }));
    close.forEach((b) => b.setDepth(101));
  }
}
