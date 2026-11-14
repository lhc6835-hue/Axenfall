import { Gfx } from './engine/gfx';
import { Input, isTyping } from './engine/input';
import { cloud, initCloud } from './net/cloud';
import { sfx } from './engine/audio';
import { clamp } from './engine/math';
import { GUNS, SWORDS, gunById, skinById, swordById, type GunDef, type SkinDef, type SwordDef } from './game/data';
import { persist, restock, save } from './game/save';
import { Run, type Loadout, type RunResult } from './game/run';
import { drawHud, type Banner } from './ui/hud';
import { WORLDS, worldById } from './game/worlds';
import { UI, tickPreviews } from './ui/ui';
import { openFromBlack, slash, wiping } from './ui/transition';
import { enterFullscreen, onFullscreenChange } from './ui/fullscreen';

const H = 200;
const HUD_H = 270;
const stage = document.getElementById('stage')!;
const world = document.getElementById('world') as HTMLCanvasElement;
const hud = document.getElementById('hud') as HTMLCanvasElement;
const wctx = world.getContext('2d')!;
const hctx = hud.getContext('2d')!;
const touchLayer = document.getElementById('touch')!;

let W = 480;
let scale = 2;
let dpr = 1;
const g = new Gfx(W, H);
const input = new Input();
input.bindStage(stage);
input.bindTouch();
const isTouch = matchMedia('(pointer: coarse)').matches;

function layout() {
  const vw = innerWidth, vh = innerHeight;
  W = Math.round(clamp((H * vw) / vh, 300, 460));
  scale = Math.min(vw / W, vh / H);
  dpr = Math.min(2, devicePixelRatio || 1);
  if (g.w !== W) g.resize(W, H);
  world.width = W;
  world.height = H;
  const cw = W * scale, ch = H * scale;
  for (const c of [world, hud]) {
    c.style.width = cw + 'px';
    c.style.height = ch + 'px';
  }
  stage.style.width = cw + 'px';
  stage.style.height = ch + 'px';
  hud.width = Math.round(cw * dpr);
  hud.height = Math.round(ch * dpr);
  wctx.imageSmoothingEnabled = false;
}
addEventListener('resize', layout);
layout();

function mouseWorld(): [number, number] {
  const r = world.getBoundingClientRect();
  const x = ((input.mouseX - r.left) / r.width) * W;
  const y = ((input.mouseY - r.top) / r.height) * H;
  return [x - g.ox, y - g.oy];
}

// ---------------- app state ----------------
type Mode = 'lobby' | 'play';
let mode: Mode = 'lobby';
let run: Run;
let paused = false;
let banner: Banner | null = null;
let previewOv: { gun?: GunDef; sword?: SwordDef; skin?: SkinDef } | null = null;
let panelSide: 'none' | 'right' = 'none';

function loadout(): Loadout {
  return {
    gun: previewOv?.gun ?? gunById(save.eq.gun),
    gunLvl: previewOv?.gun ? 0 : save.guns[save.eq.gun] ?? 0,
    sword: previewOv?.sword ?? swordById(save.eq.sword),
    swordLvl: previewOv?.sword ? 0 : save.swords[save.eq.sword] ?? 0,
    skin: previewOv?.skin ?? skinById(save.eq.skin),
    world: unlockedWorld(save.world),
  };
}

/** a world can be played once the one before it has been beaten */
function unlockedWorld(id: number) {
  return id <= save.cleared + 1 && WORLDS.some((w) => w.id === id) ? id : 1;
}

function newDemo() {
  run = new Run(g, loadout(), input, null, true, mouseWorld);
}

const ui = new UI({
  startRun,
  preview(o) {
    previewOv = o;
    newDemo();
  },
  refreshDemo() {
    previewOv = null;
    newDemo();
  },
  pickWorld(id) {
    save.world = unlockedWorld(id);
    persist();
    previewOv = null;
    newDemo();
  },
  setPanelSide(s) {
    panelSide = s;
  },
  resume() {
    paused = false;
    ui.clear();
  },
  quitRun() {
    paused = false;
    run.endRun(false);
    run.overT = 0;
  },
});

function startRun() {
  if (wiping() || mode === 'play') return;
  // the lobby is cut away and the arena slides in
  slash(beginRun);
}

function beginRun() {
  previewOv = null;
  mode = 'play';
  paused = false;
  ui.clear();
  input.clearPresses();
  run = new Run(g, loadout(), input, {
    levelUp(choices) {
      input.clearPresses();
      ui.levelUp(choices, run.upLv, (u) => {
        run.applyUpgrade(u);
        input.clearPresses();
      });
    },
    over: finishRun,
    banner(text, sub = '', color = '#ffffff') {
      banner = { text, sub, color, t: 2.4 };
    },
  }, false, mouseWorld);
  const wd = run.world;
  banner = { text: `월드 ${wd.id} · ${wd.name}`, sub: '10분 생존 또는 최종 보스 처치', color: wd.id === 2 ? '#ffb070' : '#ffe46a', t: 2.4 };
  touchLayer.classList.toggle('on', isTouch);
  sfx.music(wd.music.battle);
  sfx.runStart();
}

function finishRun(r: RunResult) {
  const wd = worldById(r.world);
  const bonus = Math.round((Math.floor(r.time / 10) * 2 + (r.won ? 800 : 0) + r.perfects * 3) * wd.gold);
  let note = '';
  if (r.won && r.world > save.cleared) {
    save.cleared = r.world;
    const next = WORLDS.find((w) => w.id === r.world + 1);
    if (next) {
      note = `월드 ${next.id} · ${next.name} 해금`;
      save.world = next.id;
    }
  }
  save.gold += r.gold + bonus;
  save.runs++;
  if (r.time > save.best.time) save.best.time = r.time;
  if (r.kills > save.best.kills) save.best.kills = r.kills;
  if (r.level > save.best.level) save.best.level = r.level;
  restock();
  persist();
  touchLayer.classList.remove('on');
  sfx.music(null);
  if (r.won) sfx.victory();
  else sfx.defeat();
  ui.result(r, bonus, note, () =>
    slash(() => {
      mode = 'lobby';
      sfx.music('lobby');
      newDemo();
      ui.lobby();
    }),
  );
}

// ---------------- loop ----------------
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (mode === 'play') {
    if (input.take('pause') && !run.choosing && !run.over) {
      paused = !paused;
      if (paused) ui.pause();
      else ui.clear();
    }
    if (!paused) run.update(dt);
    else input.clearPresses();
  } else {
    // the lobby cube takes the slash button (parry practice) exactly as a run does: a press made
    // during a hit-stop is kept until the world moves again. Every other button is ignored here.
    run.update(dt);
    input.take('dash');
    input.take('reload');
    input.take('pause');
    // keep the showcase cube in the free part of the screen
    const off = panelSide === 'right' ? W * 0.27 : 0;
    run.camX = off;
    run.camY = panelSide === 'right' ? 2 : -4;
  }
  if (banner) banner.t -= dt;
  if (mode === 'play' && !run.over) {
    const M = run.world.music;
    sfx.music(run.boss ? (run.boss.type === run.world.boss2.type ? M.boss2 : M.boss1) : M.battle);
  }
  sfx.update(dt);

  run.render(wctx);
  hctx.setTransform(1, 0, 0, 1, 0, 0);
  hctx.clearRect(0, 0, hud.width, hud.height);
  // the HUD has its own virtual resolution so text stays a sensible size
  const hs = (H * scale) / HUD_H;
  hctx.setTransform(hs * dpr, 0, 0, hs * dpr, 0, 0);
  drawHud(hctx, run, (W * scale) / hs, HUD_H, scale / hs, mode === 'play' ? banner : null, mode === 'play');
  tickPreviews(dt);
  if (import.meta.env.DEV) {
    (window as any).__run = run;
    (window as any).__swords = SWORDS;
    (window as any).__guns = GUNS;
  }
  requestAnimationFrame(frame);
}

// audio needs a user gesture
const unlock = () => sfx.init();
addEventListener('pointerdown', unlock);
addEventListener('keydown', unlock);
addEventListener('touchstart', unlock);

// any click (or key) in the game goes fullscreen, unless turned off in settings
const goFull = (e: Event) => {
  if (!save.fullscreen) return;
  if (e instanceof KeyboardEvent && (e.code === 'Escape' || e.repeat || isTyping(e))) return;
  if ((e.target as HTMLElement | null)?.closest?.('.acct-modal')) return;
  enterFullscreen();
};
addEventListener('pointerup', goFull);
addEventListener('touchend', goFull);
addEventListener('keydown', goFull);
// leaving fullscreen mid-run (Esc, swipe) pauses so nothing is lost
onFullscreenChange((on) => {
  if (!on && mode === 'play' && !paused && !run.over && !run.choosing) {
    paused = true;
    ui.pause();
  }
});
sfx.setVolume(save.sfxVol);
sfx.setMusicVolume(save.musicVol);
sfx.setEnabled(save.sound);
sfx.setMusic(save.music);
sfx.music('lobby');

document.fonts?.ready.then(() => undefined);
newDemo();
ui.lobby();
openFromBlack();

// accounts: progress pulled from the cloud redraws the lobby; disagreements are put to the player
cloud.setConflictHandler((c) => ui.conflict(c));
addEventListener('parrycube:progress', () => {
  if (mode !== 'lobby') return;
  previewOv = null;
  newDemo();
  if (ui.current === 'lobby') ui.lobby();
  else if (ui.current === 'shop') ui.shop();
  else if (ui.current === 'loadout') ui.loadout();
});
initCloud();
requestAnimationFrame(frame);
