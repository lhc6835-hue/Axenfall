import { W, H, UI, FONT, FONT_B, FONT_S, FONT_L } from '../core/const';
import { SFX_FILES } from '../core/audio';
import { buildHeroSheets, buildHeroBig } from '../art/hero';
import { buildFx } from '../art/fx';
import { buildEnemies } from '../art/enemies';
import { buildBackground, THEMES } from '../art/bg';
import { buildTitle } from '../art/title';
import { buildUi } from '../art/icons';

/** In the single-file build every asset is embedded as a data URI in window.__ASSETS. */
const asset = (path: string) => (window as unknown as { __ASSETS?: Record<string, string> }).__ASSETS?.[path] ?? path;

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const bar = this.add.rectangle(W / 2 - 120, H / 2, 0, 6, UI.gold).setOrigin(0, 0.5);
    this.add.rectangle(W / 2, H / 2, 244, 10).setStrokeStyle(1, UI.line);
    this.load.on('progress', (v: number) => (bar.width = 240 * v));
    for (const f of SFX_FILES) this.load.audio(f, asset(`audio/sfx/${f}.ogg`));
    this.load.json('bgmManifest', asset('audio/bgm/bgm.json'));
    this.load.on('filecomplete-json-bgmManifest', (_k: string, _t: string, data: Record<string, string>) => {
      for (const [key, file] of Object.entries(data ?? {})) this.load.audio('bgm_' + key, asset(`audio/bgm/${file}`));
    });
  }

  async create() {
    try {
      await Promise.all([FONT, FONT_B, FONT_S, FONT_L].map((f) => document.fonts.load(`12px ${f}`, '가A')));
    } catch { /* fonts optional */ }
    buildFx(this);
    buildUi(this);
    buildHeroSheets(this);
    buildHeroBig(this);
    buildEnemies(this);
    for (const th of Object.values(THEMES)) buildBackground(this, th);
    buildTitle(this);
    this.scene.start('Title');
  }
}
