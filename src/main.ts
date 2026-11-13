import { Gfx } from './engine/gfx';
import { Input } from './engine/input';
import { sfx } from './engine/audio';
import { clamp } from './engine/math';
import { gunById, skinById, swordById, type GunDef, type SkinDef, type SwordDef } from './game/data';
import { persist, restock, save } from './game/save';
import { Run, type Loadout, type RunResult } from './game/run';
import { drawHud, type Banner } from './ui/hud';
import { UI, tickPreviews } from './ui/ui';

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
  };
}

function newDemo() {
  run = new Run(g, loadout(), null, null, true, mouseWorld);
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
  banner = { text: '출격!', sub: '10분을 버티거나 최종 보스를 쓰러뜨려요', color: '#ffe46a', t: 2.4 };
  touchLayer.classList.toggle('on', isTouch);
}

function finishRun(r: RunResult) {
  const bonus = Math.floor(r.time / 10) * 2 + (r.won ? 800 : 0) + r.perfects * 3;
  save.gold += r.gold + bonus;
  save.runs++;
  if (r.time > save.best.time) save.best.time = r.time;
  if (r.kills > save.best.kills) save.best.kills = r.kills;
  if (r.level > save.best.level) save.best.level = r.level;
  restock();
  persist();
  touchLayer.classList.remove('on');
  ui.result(r, bonus, () => {
    mode = 'lobby';
    newDemo();
    ui.lobby();
  });
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
    input.clearPresses();
    run.update(dt);
    // keep the showcase cube in the free part of the screen
    const off = panelSide === 'right' ? W * 0.27 : 0;
    run.camX = off;
    run.camY = panelSide === 'right' ? 2 : -4;
  }
  if (banner) banner.t -= dt;

  run.render(wctx);
  hctx.setTransform(1, 0, 0, 1, 0, 0);
  hctx.clearRect(0, 0, hud.width, hud.height);
  // the HUD has its own virtual resolution so text stays a sensible size
  const hs = (H * scale) / HUD_H;
  hctx.setTransform(hs * dpr, 0, 0, hs * dpr, 0, 0);
  drawHud(hctx, run, (W * scale) / hs, HUD_H, scale / hs, mode === 'play' ? banner : null, mode === 'play');
  tickPreviews(dt);
  if (import.meta.env.DEV) (window as any).__run = run;
  requestAnimationFrame(frame);
}

// audio needs a user gesture
const unlock = () => sfx.init();
addEventListener('pointerdown', unlock);
addEventListener('keydown', unlock);
addEventListener('touchstart', unlock);
sfx.setEnabled(save.sound);

document.fonts?.ready.then(() => undefined);
newDemo();
ui.lobby();
requestAnimationFrame(frame);
