import { Save } from './save';

// All sound files are CC0 assets from Kenney (see public/audio/CREDITS.md).
export const SFX_FILES = [
  'blaster', 'blaster_repeater', 'break', 'coin', 'enemy_attack', 'enemy_destroy', 'enemy_hurt', 'fall',
  'impact', 'jump_a', 'land', 'placement-a', 'placement-c', 'removal-a', 'rotate', 'skid',
  'tile-land', 'tile-match', 'tile-swap', 'toggle', 'weapon_change',
];

// Semantic names -> file + default playback shaping
const MAP: Record<string, { f: string; v?: number; r?: number; jitter?: number }> = {
  hit: { f: 'enemy_hurt', v: 0.55, jitter: 0.12 },
  hitHeavy: { f: 'impact', v: 0.7, r: 0.9, jitter: 0.08 },
  kill: { f: 'enemy_destroy', v: 0.6, jitter: 0.1 },
  swing: { f: 'skid', v: 0.25, r: 2.2, jitter: 0.2 },
  swingHeavy: { f: 'skid', v: 0.35, r: 1.5, jitter: 0.1 },
  shoot: { f: 'blaster', v: 0.35, r: 1.2, jitter: 0.15 },
  zap: { f: 'blaster_repeater', v: 0.4, r: 1.4, jitter: 0.15 },
  boom: { f: 'impact', v: 0.85, r: 0.7, jitter: 0.05 },
  bigBoom: { f: 'impact', v: 1, r: 0.5 },
  shatter: { f: 'break', v: 0.7, jitter: 0.1 },
  jump: { f: 'jump_a', v: 0.35, r: 1.2 },
  land: { f: 'land', v: 0.3 },
  dash: { f: 'skid', v: 0.4, r: 1.8 },
  hurt: { f: 'enemy_attack', v: 0.7, r: 0.8 },
  enemyAtk: { f: 'enemy_attack', v: 0.4, r: 1.1, jitter: 0.1 },
  coin: { f: 'coin', v: 0.5, jitter: 0.08 },
  click: { f: 'toggle', v: 0.5 },
  hover: { f: 'rotate', v: 0.25, r: 1.3 },
  confirm: { f: 'placement-a', v: 0.6 },
  confirm2: { f: 'placement-c', v: 0.6 },
  cancel: { f: 'removal-a', v: 0.5 },
  equip: { f: 'weapon_change', v: 0.6 },
  flip: { f: 'tile-swap', v: 0.6 },
  reveal: { f: 'tile-match', v: 0.7 },
  drop: { f: 'tile-land', v: 0.6 },
  fall: { f: 'fall', v: 0.5 },
};

export function sfx(scene: Phaser.Scene, name: string, opts: { rate?: number; vol?: number } = {}) {
  const m = MAP[name];
  if (!m || Save.d.sfx <= 0) return;
  if (!scene.cache.audio.exists(m.f)) return;
  const j = m.jitter ?? 0;
  const rate = (opts.rate ?? 1) * (m.r ?? 1) * (1 + (Math.random() * 2 - 1) * j);
  try {
    scene.sound.play(m.f, { volume: (m.v ?? 1) * (opts.vol ?? 1) * Save.d.sfx, rate });
  } catch { /* audio locked */ }
}

// ---- BGM: tracks are listed in public/audio/bgm/bgm.json (may be empty).
let current: Phaser.Sound.BaseSound | null = null;
let currentKey = '';

export function playBgm(scene: Phaser.Scene, key: string) {
  if (currentKey === key && current?.isPlaying) return;
  stopBgm(scene);
  if (!scene.cache.audio.exists('bgm_' + key)) { currentKey = ''; return; }
  currentKey = key;
  current = scene.sound.add('bgm_' + key, { loop: true, volume: 0 });
  current.play();
  scene.tweens.add({ targets: current, volume: Save.d.bgm * 0.5, duration: 800 });
}

export function stopBgm(scene: Phaser.Scene) {
  if (!current) return;
  const s = current;
  current = null; currentKey = '';
  scene.tweens.add({ targets: s, volume: 0, duration: 400, onComplete: () => s.destroy() });
}

export function setBgmVolume(v: number) {
  if (current) (current as Phaser.Sound.WebAudioSound).setVolume(v * 0.5);
}
