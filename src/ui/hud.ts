import { clamp, ease } from '../engine/math';
import { BOSS1_AT, BOSS2_AT, type Run } from '../game/run';

const FONT = "'Galmuri11', 'Galmuri9', monospace";

export interface Banner {
  text: string;
  sub: string;
  color: string;
  t: number;
}

function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', outline = true) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineWidth = Math.max(1.5, size * 0.28);
    ctx.strokeStyle = 'rgba(8,6,16,0.95)';
    ctx.lineJoin = 'round';
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number, fg: string, bg = '#1a1426', edge = '#06040c') {
  ctx.fillStyle = edge;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, Math.round(w * clamp(k, 0, 1)), h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, y, Math.round(w * clamp(k, 0, 1)), 1);
}

const mmss = (t: number) => {
  t = Math.max(0, Math.floor(t));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export function drawHud(ctx: CanvasRenderingContext2D, run: Run, W: number, H: number, k: number, banner: Banner | null, showStats: boolean) {
  const toS = (x: number, y: number): [number, number] => {
    const [sx, sy] = run.toScreen(x, y);
    return [sx * k, sy * k];
  };
  // world-anchored pops (damage numbers, PARRY!)
  for (const p of run.fx.pops) {
    const [sx, sy] = toS(p.x, p.y);
    const lk = p.life / p.max;
    const appear = 1 - clamp((p.max - p.life) / 0.08, 0, 1);
    const size = (p.big ? 9 : 6) * p.size * (1 + appear * 0.6) * (p.big ? 1 + ease.outBack(1 - Math.min(1, (p.max - p.life) / 0.2)) * 0.2 : 1);
    ctx.globalAlpha = Math.min(1, lk * 2.5);
    txt(ctx, p.text, sx, sy, size, p.color, 'center');
    ctx.globalAlpha = 1;
  }
  if (run.demo) return;
  const p = run.player;
  const m = run.mods;

  // reload / charge bar under the cube
  const [px, py] = toS(p.x, p.y);
  if (p.gun.reloading) {
    bar(ctx, px - 10, py + 13, 20, 2, p.gun.rt / p.gun.rdur, '#ffd25a');
  }

  // XP strip across the very top
  bar(ctx, 0, 0, W, 3, run.xp / run.xpNeed, '#5ac8ff', '#0f0c1c', '#0f0c1c');
  txt(ctx, `Lv ${run.level}`, 4, 9, 7, '#bfe8ff');

  // HP
  bar(ctx, 4, 16, 74, 6, p.hp / m.maxHp, p.hp / m.maxHp < 0.3 ? '#ff4a5a' : '#ff6a7a');
  txt(ctx, `${Math.ceil(p.hp)} / ${m.maxHp}`, 41, 19.5, 5.5, '#ffffff', 'center');

  // timer + next event
  if (run.tutorial) {
    // the lesson card sits at the top; no clock or boss countdown
    txt(ctx, '튜토리얼', W / 2, 11, 7, '#8ff3ff', 'center');
  } else txt(ctx, mmss(run.time), W / 2, 11, 10, '#ffffff', 'center');
  let next = '';
  if (!run.bossDone[0] && run.time < BOSS1_AT) next = `보스까지 ${mmss(BOSS1_AT - run.time)}`;
  else if (!run.bossDone[1] && run.time < BOSS2_AT && !run.boss) next = `최종 보스까지 ${mmss(BOSS2_AT - run.time)}`;
  if (next && !run.tutorial) txt(ctx, next, W / 2, 21, 5.5, '#a89ccf', 'center');

  // gold & kills
  ctx.fillStyle = '#ffc23a';
  ctx.beginPath();
  ctx.arc(W - 46, 10, 3, 0, Math.PI * 2);
  ctx.fill();
  txt(ctx, `${run.gold}`, W - 40, 10.5, 7, '#ffe08a');
  txt(ctx, `처치 ${run.kills}`, W - 4, 21, 5.5, '#c8c0e0', 'right');

  // weapons panel bottom-left
  const g = p.gun, s = p.sword;
  const by = H - 30;
  ctx.fillStyle = 'rgba(10,8,20,0.6)';
  ctx.fillRect(3, by - 3, 96, 30);
  txt(ctx, g.def.name, 7, by + 3, 5.5, '#ffe9a8');
  const mag = g.magSize();
  if (mag <= 12) {
    for (let i = 0; i < mag; i++) {
      ctx.fillStyle = i < g.ammo ? '#ffd25a' : '#3a3050';
      ctx.fillRect(7 + i * 4, by + 7, 3, 4);
    }
  } else {
    bar(ctx, 7, by + 8, 50, 3, g.ammo / mag, '#ffd25a');
    txt(ctx, `${g.ammo}/${mag}`, 60, by + 9.5, 5, '#ffe9a8');
  }
  if (g.reloading) txt(ctx, '장전 중', 95, by + 3, 5, '#ffd25a', 'right');
  txt(ctx, s.def.name, 7, by + 16, 5.5, '#d8e4ff');
  const cdk = 1 - clamp(s.cd / (s.def.cooldown * Math.max(0.35, m.swordCd)), 0, 1);
  bar(ctx, 7, by + 21, 50, 2, cdk, cdk >= 1 ? '#bfe8ff' : '#5a6a9a');
  const dk = 1 - clamp(p.dashCd / (1.1 * Math.max(0.3, m.dashCd)), 0, 1);
  txt(ctx, '대시', 62, by + 21.5, 4.5, dk >= 1 ? '#bfffd8' : '#5a7a6a');
  bar(ctx, 75, by + 21, 20, 2, dk, '#6affa8');

  // boss bar
  if (run.boss && !run.boss.dead) {
    const b = run.boss;
    const w = Math.min(220, W - 120);
    const info = b.type === run.world.boss1.type ? run.world.boss1 : run.world.boss2;
    txt(ctx, info.name, W / 2, H - 22, 6.5, info.color, 'center');
    bar(ctx, W / 2 - w / 2, H - 15, w, 5, b.hp / b.max, info.bar);
  }

  // parry stats
  if (showStats) txt(ctx, `패리 ${run.parries}  퍼펙트 ${run.perfects}`, W - 4, H - 6, 5, '#9a90c0', 'right');

  // banner
  if (banner && banner.t > 0) {
    const life = 2.4 - banner.t;
    const kk = Math.min(1, life / 0.18);
    const fade = Math.min(1, banner.t / 0.4);
    ctx.globalAlpha = fade;
    const sc = 1 + (1 - ease.outBack(kk)) * 0.6;
    txt(ctx, banner.text, W / 2, H * 0.32, 18 * sc, banner.color, 'center');
    if (banner.sub) txt(ctx, banner.sub, W / 2, H * 0.32 + 15, 7, '#ffffff', 'center');
    ctx.globalAlpha = 1;
  }
}
