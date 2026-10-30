import Phaser from 'phaser';
import { W, H } from './core/const';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { HubScene } from './scenes/HubScene';
import { WorldScene } from './scenes/WorldScene';
import { StageSelectScene } from './scenes/StageSelectScene';
import { CharacterScene } from './scenes/CharacterScene';
import { GachaScene } from './scenes/GachaScene';
import { BattleScene } from './scenes/BattleScene';
import { HudScene } from './scenes/HudScene';
import { ResultScene, PauseScene } from './scenes/ResultScene';
import { setupFullscreen } from './core/fullscreen';

(window as unknown as { Phaser: typeof Phaser }).Phaser = Phaser;

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#07060d',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 900 }, debug: false } },
  input: { gamepad: false },
  fps: { target: 60, smoothStep: true },
  scene: [BootScene, TitleScene, HubScene, WorldScene, StageSelectScene, CharacterScene, GachaScene, BattleScene, HudScene, ResultScene, PauseScene],
});

setupFullscreen(game);
(window as unknown as { game: Phaser.Game }).game = game;
