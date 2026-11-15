import { Gfx, Xf } from '../engine/gfx';
import { sfx } from '../engine/audio';
import { BLADE_LEN, MUZZLE, blankPose, drawCube, drawGun, drawSword } from '../game/art';
import {
  ENHANCE_BONUS, ENHANCE_MAX, GUNS, RARITY, RARITY_ORDER, SKINS, SWORDS, UPGRADES,
  gunById, gunLook, skinById, swordById, swordLook, type GunDef, type SkinDef, type SwordDef, type Upgrade,
} from '../game/data';
import { buy, catalog, checkTimedRestock, persist, priceOf, purchasable, rerollCost, reroll, resetSave, save, type ShopCat, type Slot } from '../game/save';
import type { RunResult } from '../game/run';
import { WORLDS } from '../game/worlds';
import { canFullscreen, enterFullscreen, exitFullscreen } from './fullscreen';
import { cloud, errorText, signIn, signOut, syncNow, type ConflictChoice, type Summary, type SwitchInfo } from '../net/cloud';

export interface AppApi {
  startRun(): void;
  preview(o: { gun?: GunDef; sword?: SwordDef; skin?: SkinDef } | null): void;
  refreshDemo(): void;
  pickWorld(id: number): void;
  setPanelSide(side: 'none' | 'right'): void;
  resume(): void;
  quitRun(): void;
}

const root = () => document.getElementById('screens')!;
const fmt = (n: number) => n.toLocaleString('ko-KR');

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

// ---------------- item previews ----------------
const PV_W = 46, PV_H = 22;
const pvG = new Gfx(PV_W, PV_H);
pvG.vignette = 0;
pvG.buildVignette();

type Item = { cat: ShopCat; id: string };
const animated: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; item: Item }[] = [];
// only cards that are actually on screen keep animating
const onScreen = new WeakSet<Element>();
const watcher =
  typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target))))
    : null;

/** the card canvas is written straight with putImageData (a CPU-side canvas, no GPU round trip per card) */
function cardCtx(c: HTMLCanvasElement) {
  return c.getContext('2d', { willReadFrequently: true })!;
}

function paintPreview(ctx: CanvasRenderingContext2D, item: Item, time: number) {
  const g = pvG;
  g.ox = 0;
  g.oy = 0;
  g.clear(0x15121f);
  for (let x = 0; x < PV_W; x += 4) g.rect(x, PV_H - 3, 2, 1, 0x1f1a2e);
  if (item.cat === 'gun') {
    const def = gunById(item.id);
    const look = gunLook(def);
    const L = MUZZLE[look][0];
    const x = new Xf(g, PV_W / 2 - L / 2 + 3, PV_H / 2 + 3, 0, 1);
    drawGun(x, look, blankPose(), time);
  } else if (item.cat === 'sword') {
    const def = swordById(item.id);
    const k = swordLook(def);
    const L = BLADE_LEN[k];
    // long polearms sit diagonally so the whole weapon fits the card
    const diag = k === 'spear' || k === 'twinblade' || k === 'nodachi' || k === 'halberd' || k === 'flamberge' || k === 'hammer';
    const ang = k === 'scythe' || k === 'glaive' ? 0.35 : diag ? -0.4 : -0.25;
    const cx =
      k === 'spear' || k === 'halberd' ? PV_W / 2 - 5
      : k === 'twinblade' ? PV_W / 2
      : k === 'nodachi' || k === 'flamberge' ? PV_W / 2 - 9
      : k === 'hammer' ? PV_W / 2 - 7
      : k === 'glaive' ? PV_W / 2 - 3
      : PV_W / 2 - L / 2 + 1;
    const x = new Xf(g, cx, PV_H / 2 + (diag ? 1 : 0), ang, 1);
    drawSword(x, k, def.color, time, false);
  } else {
    const def = skinById(item.id);
    drawCube(g, def, PV_W / 2, PV_H / 2, 12, Math.sin(time * 1.5) * 0.12, time);
  }
  g.present(ctx);
}

function previewCanvas(item: Item) {
  const c = el('canvas', 'pv');
  c.width = PV_W;
  c.height = PV_H;
  const ctx = cardCtx(c);
  paintPreview(ctx, item, 0);
  if (item.cat === 'skin' || item.cat === 'sword') {
    animated.push({ canvas: c, ctx, item });
    if (watcher) watcher.observe(c);
    else onScreen.add(c);
  }
  return c;
}

let animT = 0;
let animAcc = 0;
/** card previews are little loops: 15 frames a second is plenty, and only for cards in view */
export function tickPreviews(dt: number) {
  animT += dt;
  animAcc += dt;
  if (animAcc < 1 / 15) return;
  animAcc = 0;
  for (let i = animated.length - 1; i >= 0; i--) {
    const a = animated[i];
    if (!a.canvas.isConnected) {
      watcher?.unobserve(a.canvas);
      animated.splice(i, 1);
    } else if (onScreen.has(a.canvas)) paintPreview(a.ctx, a.item, animT);
  }
}

// ---------------- stat lines ----------------
function gunStats(d: GunDef, lvl = 0) {
  const dmg = d.dmg * (1 + lvl * ENHANCE_BONUS);
  return [
    ['피해', d.pellets > 1 ? `${dmg.toFixed(0)}×${d.pellets}` : dmg.toFixed(0)],
    ['연사', `${d.rate}/초`],
    ['탄창', `${d.mag}`],
    ['사거리', `${d.range}`],
    d.pierce > 0 ? ['관통', d.pierce > 100 ? '무한' : `${d.pierce}`] : ['치명', `${Math.round(d.crit * 100)}%`],
    ...(d.splash ? [['폭발', `${d.splash}`]] : []),
    ...(d.bounce ? [['연쇄', `${d.bounce}회`]] : []),
  ];
}
function swordStats(d: SwordDef, lvl = 0) {
  return [
    ['피해', (d.dmg * (1 + lvl * ENHANCE_BONUS)).toFixed(0)],
    ['사거리', `${d.reach}`],
    ['쿨타임', `${d.cooldown}초`],
    ['패리', `${d.parry.toFixed(2)}초`],
    ...(d.wave ? [[d.waveKind === 'rift' ? '균열' : d.waveKind === 'stars' ? '별 조각' : '검기', `${Math.round(d.wave * 100)}%${d.waveKind === 'stars' ? '×3' : ''}`]] : []),
  ];
}
const statHtml = (rows: string[][]) => `<div class="stats">${rows.map(([k, v]) => `<span><i>${k}</i>${v}</span>`).join('')}</div>`;

function defOf(cat: ShopCat, id: string): GunDef | SwordDef | SkinDef {
  return cat === 'gun' ? gunById(id) : cat === 'sword' ? swordById(id) : skinById(id);
}

function bindVolume(m: HTMLElement) {
  m.querySelectorAll<HTMLInputElement>('input[data-v]').forEach((inp) => {
    const out = inp.parentElement!.querySelector('b')!;
    inp.oninput = () => {
      const v = Number(inp.value) / 100;
      out.textContent = inp.value;
      if (inp.dataset.v === 'sfx') {
        save.sfxVol = v;
        sfx.setVolume(v);
      } else {
        save.musicVol = v;
        sfx.setMusicVolume(v);
      }
    };
    // play a sample parry at the new level so the change can be heard
    inp.onchange = () => {
      persist();
      if (inp.dataset.v === 'sfx') sfx.parry(false);
    };
  });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// ---------------- title decoration ----------------
/** crossed katana and revolver, drawn with the game's own pixel art, keyed to transparent */
function paintEmblem(c: HTMLCanvasElement) {
  const g = new Gfx(c.width, c.height);
  g.vignette = 0;
  g.buildVignette();
  g.ox = 0;
  g.oy = 0;
  const KEY = 0x010203;
  g.clear(KEY);
  const cx = c.width / 2, cy = c.height / 2;
  const kat = swordById('s_katana');
  drawSword(new Xf(g, cx - 13, cy + 11, -0.62, 1), 'katana', kat.color, 0);
  drawGun(new Xf(g, cx + 9, cy + 8, Math.PI + 0.62, -1), 'revolver', blankPose(), 0);
  const ctx = c.getContext('2d')!;
  g.present(ctx);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) if (d[i] === 1 && d[i + 1] === 2 && d[i + 2] === 3) d[i + 3] = 0;
  ctx.putImageData(img, 0, 0);
}

function decorateLogo(w: HTMLElement) {
  const em = w.querySelector<HTMLCanvasElement>('.logo-emblem');
  if (em) paintEmblem(em);
  // sparks thrown off the cut when PARRY is sliced
  const burst = w.querySelector<HTMLElement>('.logo-burst');
  if (burst)
    for (let i = 0; i < 14; i++) {
      const sp = document.createElement('i');
      const a = -0.35 + (Math.random() - 0.5) * 2.6 + (i % 2 ? Math.PI : 0);
      const r = 40 + Math.random() * 90;
      sp.style.setProperty('--dx', `${Math.cos(a) * r}px`);
      sp.style.setProperty('--dy', `${Math.sin(a) * r * 0.7}px`);
      sp.style.animationDelay = `${0.38 + Math.random() * 0.06}s`;
      sp.style.animationDuration = `${0.45 + Math.random() * 0.35}s`;
      if (i % 3 === 0) sp.className = 'w';
      burst.appendChild(sp);
    }
  // embers drifting up around the title
  const embers = w.querySelector<HTMLElement>('.logo-embers');
  if (embers)
    for (let i = 0; i < 16; i++) {
      const e = document.createElement('i');
      e.style.left = `${4 + Math.random() * 92}%`;
      e.style.animationDelay = `${-Math.random() * 7}s`;
      e.style.animationDuration = `${5 + Math.random() * 4}s`;
      e.style.setProperty('--sway', `${(Math.random() - 0.5) * 40}px`);
      if (i % 3 === 0) e.className = 'v';
      embers.appendChild(e);
    }
}

// =====================================================================
export class UI {
  shopTab: ShopCat = 'gun';
  levelKeys: ((e: KeyboardEvent) => void) | null = null;
  private restockTimer = 0;
  current: 'lobby' | 'shop' | 'loadout' | 'none' = 'none';

  constructor(private app: AppApi) {}

  clear() {
    root().innerHTML = '';
    if (this.levelKeys) removeEventListener('keydown', this.levelKeys);
    this.levelKeys = null;
    clearInterval(this.restockTimer);
  }

  goldChip() {
    return `<div class="gold"><b class="coin"></b>${fmt(save.gold)}</div>`;
  }

  // ---------------- lobby ----------------
  lobby() {
    this.clear();
    this.current = 'lobby';
    this.app.preview(null);
    this.app.setPanelSide('none');
    const eq = save.eq;
    const w = el('div', 'lobby');
    w.innerHTML = `
      <div class="topbar"><span class="acct-slot"></span>${this.goldChip()}</div>
      <div class="title logo">
        <div class="logo-aura" aria-hidden="true"></div>
        <canvas class="logo-emblem" width="84" height="44" aria-hidden="true"></canvas>
        <div class="logo-embers" aria-hidden="true"></div>
        <h1 class="logo-parry" aria-label="PARRY CUBE">
          <span class="half top">PARRY</span><span class="half bot">PARRY</span>
          <svg class="cut" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="cutg" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".25" stop-color="#fff" stop-opacity=".9"/><stop offset=".75" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
            <line x1="-6" y1="76" x2="106" y2="34" stroke="url(#cutg)" vector-effect="non-scaling-stroke" />
            <line class="glint" x1="-6" y1="76" x2="106" y2="34" vector-effect="non-scaling-stroke" />
          </svg>
          <span class="logo-burst" aria-hidden="true"></span>
        </h1>
        <div class="logo-cube" aria-hidden="true"><b>C</b><b>U</b><b>B</b><b>E</b><span class="cc"></span><span class="cc"></span><span class="cc"></span></div>
        <p class="logo-sub"><i></i>패리 큐브 · 검 하나, 총 하나<i></i></p>
      </div>
      <div class="eqline">
        <span class="tag gun">${gunById(eq.gun).name}</span>
        <span class="tag sword">${swordById(eq.sword).name}</span>
        <span class="tag skin">${skinById(eq.skin).name}</span>
      </div>
      <div class="worlds">${WORLDS.map((wd) => {
        const locked = wd.id > save.cleared + 1;
        const sel = !locked && wd.id === (save.world <= save.cleared + 1 ? save.world : 1);
        const done = wd.id <= save.cleared;
        return `<button class="world w${wd.id}${sel ? ' sel' : ''}${locked ? ' locked' : ''}" data-w="${wd.id}"${locked ? ' disabled' : ''}>
          <i>WORLD ${wd.id}</i><b>${wd.name}</b><small>${locked ? `월드 ${wd.id - 1} 클리어 시 해금` : done ? '클리어' : wd.sub}</small></button>`;
      }).join('')}</div>
      <div class="menu">
        <button class="btn primary" data-a="go">출격</button>
        <button class="btn" data-a="shop">상점</button>
        <button class="btn" data-a="loadout">장비</button>
        <button class="btn ghost" data-a="opt">설정</button>
      </div>
      <div class="best">최고 기록 ${Math.floor(save.best.time / 60)}분 ${Math.floor(save.best.time % 60)}초 · 처치 ${save.best.kills} · 출격 ${save.runs}회</div>
      <div class="help">
        <b>이동</b> WASD · <b>베기/패리</b> 스페이스 · 마우스 클릭 · <b>대시</b> Shift · <b>재장전</b> R · <b>일시정지</b> Esc<br>
        총은 자동 사격 · 적의 <em>!</em> 신호에 맞춰 베면 패리 · 공격 직전에 베면 <em>PERFECT</em>
      </div>`;
    w.querySelector<HTMLElement>('[data-a=go]')!.onclick = () => { sfx.ui(); this.app.startRun(); };
    w.querySelectorAll<HTMLButtonElement>('.world').forEach((b) => {
      b.onclick = () => {
        if (b.disabled || b.classList.contains('sel')) return;
        sfx.ui();
        this.app.pickWorld(Number(b.dataset.w));
        w.querySelectorAll('.world').forEach((o) => o.classList.toggle('sel', o === b));
      };
    });
    w.querySelector<HTMLElement>('[data-a=shop]')!.onclick = () => { sfx.ui(); this.shop(); };
    w.querySelector<HTMLElement>('[data-a=loadout]')!.onclick = () => { sfx.ui(); this.loadout(); };
    w.querySelector<HTMLElement>('[data-a=opt]')!.onclick = () => { sfx.ui(); this.options(); };
    root().appendChild(w);
    decorateLogo(w);
    this.mountAccount(w);
  }

  options() {
    const m = el('div', 'modal');
    m.innerHTML = `<div class="box small">
      <h2>설정</h2>
      <button class="btn" data-a="snd">효과음: ${save.sound ? '켜짐' : '꺼짐'}</button>
      <button class="btn" data-a="bgm">배경음: ${save.music ? '켜짐' : '꺼짐'}</button>
      <label class="vol"><span>효과음 크기</span><input type="range" min="0" max="100" step="5" data-v="sfx" value="${Math.round(save.sfxVol * 100)}"><b>${Math.round(save.sfxVol * 100)}</b></label>
      <label class="vol"><span>배경음 크기</span><input type="range" min="0" max="100" step="5" data-v="music" value="${Math.round(save.musicVol * 100)}"><b>${Math.round(save.musicVol * 100)}</b></label>
      ${canFullscreen() ? `<button class="btn" data-a="fs">전체화면: ${save.fullscreen ? '자동' : '끔'}</button>` : ''}
      <button class="btn ghost danger" data-a="reset">저장 데이터 초기화</button>
      <button class="btn" data-a="close">닫기</button>
      <p class="credits">음악 Komiku (CC0) · 총기 녹음 Free Firearm Sound Library (CC0) · 효과음 Kenney (CC0), Beatscribe (CC0),
      "Oculus Audio Pack 01" by Oculus VR, LLC (CC BY 4.0)</p>
    </div>`;
    m.querySelector<HTMLElement>('[data-a=snd]')!.onclick = (e) => {
      save.sound = !save.sound;
      sfx.setEnabled(save.sound);
      persist();
      (e.target as HTMLElement).textContent = `효과음: ${save.sound ? '켜짐' : '꺼짐'}`;
    };
    m.querySelector<HTMLElement>('[data-a=bgm]')!.onclick = (e) => {
      save.music = !save.music;
      sfx.setMusic(save.music);
      persist();
      (e.target as HTMLElement).textContent = `배경음: ${save.music ? '켜짐' : '꺼짐'}`;
    };
    bindVolume(m);
    const fsBtn = m.querySelector<HTMLElement>('[data-a=fs]');
    if (fsBtn)
      fsBtn.onclick = (e) => {
        save.fullscreen = !save.fullscreen;
        persist();
        if (save.fullscreen) enterFullscreen();
        else exitFullscreen();
        (e.target as HTMLElement).textContent = `전체화면: ${save.fullscreen ? '자동' : '끔'}`;
      };
    m.querySelector<HTMLElement>('[data-a=reset]')!.onclick = () => {
      if (confirm('골드, 무기, 스킨이 모두 삭제됩니다. 초기화하시겠습니까?')) {
        resetSave();
        this.app.refreshDemo();
        this.lobby();
      }
    };
    m.querySelector<HTMLElement>('[data-a=close]')!.onclick = () => m.remove();
    root().appendChild(m);
  }

  // ---------------- shop ----------------
  shop(tab: ShopCat = this.shopTab) {
    checkTimedRestock();
    const prev = this.current === 'shop' ? document.querySelector<HTMLElement>('.panel') : null;
    const keepScroll = prev && tab === this.shopTab ? prev.scrollTop : 0;
    this.clear();
    this.current = 'shop';
    this.shopTab = tab;
    this.app.setPanelSide('right');
    const w = el('div', 'panel-wrap');
    const p = el('div', 'panel');
    const odds = RARITY_ORDER.map((r) => `<span style="color:${RARITY[r].color}">${RARITY[r].name} ${RARITY[r].weight}%</span>`).join(' · ');
    p.innerHTML = `
      <div class="phead">
        <button class="btn back" data-a="back">← 로비</button>
        <h2>상점</h2>
        ${this.goldChip()}
      </div>
      <div class="tabs">
        <button data-t="gun" class="${tab === 'gun' ? 'on' : ''}">총</button>
        <button data-t="sword" class="${tab === 'sword' ? 'on' : ''}">검</button>
        <button data-t="skin" class="${tab === 'skin' ? 'on' : ''}">큐브 스킨</button>
      </div>
      <div class="grid"></div>
      <div class="pfoot">
        <div class="restock"></div>
        <button class="btn small" data-a="reroll">새로고침 <b class="coin"></b>${fmt(rerollCost())}</button>
      </div>
      <div class="odds">입고 확률 ${odds}</div>
      <div class="hint">카드를 선택하면 큐브가 시연 · 보유한 무기를 다시 구매하면 강화(+${Math.round(ENHANCE_BONUS * 100)}% 피해, 최대 +${ENHANCE_MAX})</div>`;
    const grid = p.querySelector('.grid')!;
    const slots: Slot[] = save.shop[tab];
    slots.forEach((slot) => grid.appendChild(this.shopCard(tab, slot)));
    p.querySelectorAll<HTMLElement>('[data-t]').forEach((b) => (b.onclick = () => { sfx.ui(); this.shop(b.dataset.t as ShopCat); }));
    p.querySelector<HTMLElement>('[data-a=back]')!.onclick = () => { sfx.ui(); this.lobby(); };
    p.querySelector<HTMLElement>('[data-a=reroll]')!.onclick = () => {
      if (reroll()) {
        sfx.buy();
        this.shop(tab);
      } else {
        sfx.deny();
        this.toast('골드 부족');
      }
    };
    const rs = p.querySelector<HTMLElement>('.restock')!;
    const upd = () => {
      if (checkTimedRestock()) {
        this.shop(this.shopTab);
        return;
      }
      const ms = Math.max(0, save.shop.restockAt - Date.now());
      const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
      rs.innerHTML = `다음 입고 <b>${m}:${String(s).padStart(2, '0')}</b> 또는 출격 후`;
    };
    upd();
    this.restockTimer = window.setInterval(upd, 1000);
    w.appendChild(p);
    root().appendChild(w);
    if (prev) {
      // redrawn in place (a purchase, a reroll): no slide-in, same scroll position
      p.style.animation = 'none';
      p.scrollTop = keepScroll;
    }
  }

  shopCard(cat: ShopCat, slot: Slot) {
    const def = defOf(cat, slot.id);
    const r = RARITY[def.rarity];
    const card = el('div', `card r-${def.rarity}`);
    const soldOut = slot.stock <= 0;
    const canBuy = purchasable(cat, slot.id);
    let owned = '';
    if (cat === 'skin') owned = save.skins.includes(slot.id) ? '보유 중' : '';
    else {
      const lv = (cat === 'sword' ? save.swords : save.guns)[slot.id];
      if (lv !== undefined) owned = lv >= ENHANCE_MAX ? '최대 강화' : `보유 · 강화 +${lv}`;
    }
    if (soldOut) card.classList.add('soldout');
    const hold = cat === 'skin' ? (def as SkinDef).desc : (def as GunDef | SwordDef).hold;
    const stats = cat === 'gun' ? statHtml(gunStats(def as GunDef)) : cat === 'sword' ? statHtml(swordStats(def as SwordDef)) : `<div class="stats"><span>${(def as SkinDef).desc}</span></div>`;
    card.innerHTML = `
      <div class="rar" style="color:${r.color}">${r.name}</div>
      <div class="pvbox"></div>
      <div class="nm">${def.name}</div>
      <div class="hold">${cat === 'skin' ? '큐브 스킨' : hold}</div>
      ${stats}
      <div class="meta">
        <span class="stock ${soldOut ? 'none' : ''}">${soldOut ? '재고 없음' : `재고 ${slot.stock}/${slot.max}`}</span>
        <span class="own">${owned}</span>
      </div>
      <button class="buy" ${soldOut || !canBuy ? 'disabled' : ''}>${soldOut ? '재고 없음' : !canBuy ? owned : `<b class="coin"></b>${fmt(priceOf(cat, slot.id))}${owned && cat !== 'skin' ? ' · 강화' : ''}`}</button>
      ${soldOut ? '<div class="stamp">재고 없음</div>' : ''}`;
    card.querySelector('.pvbox')!.appendChild(previewCanvas({ cat, id: slot.id }));
    card.onclick = (e) => {
      if ((e.target as HTMLElement).closest('.buy')) return;
      sfx.ui();
      document.querySelectorAll('.card.sel').forEach((c) => c.classList.remove('sel'));
      card.classList.add('sel');
      this.app.preview(cat === 'gun' ? { gun: def as GunDef } : cat === 'sword' ? { sword: def as SwordDef } : { skin: def as SkinDef });
    };
    card.querySelector<HTMLButtonElement>('.buy')!.onclick = () => {
      const res = buy(cat, slot);
      if (res === 'ok') {
        sfx.buy();
        // first copy gets equipped right away, which is what people expect
        if (cat === 'gun' && save.guns[slot.id] === 0) save.eq.gun = slot.id;
        if (cat === 'sword' && save.swords[slot.id] === 0) save.eq.sword = slot.id;
        if (cat === 'skin') save.eq.skin = slot.id;
        persist();
        this.toast(`${def.name} 구매 완료`);
        this.app.preview(null);
        this.app.refreshDemo();
        this.shop(cat);
      } else {
        sfx.deny();
        this.toast(res === 'gold' ? '골드 부족' : res === 'stock' ? '재고 없음' : '구매 불가');
      }
    };
    return card;
  }

  // ---------------- loadout ----------------
  loadout() {
    this.clear();
    this.current = 'loadout';
    this.app.preview(null);
    this.app.setPanelSide('right');
    const w = el('div', 'panel-wrap');
    const p = el('div', 'panel');
    p.innerHTML = `
      <div class="phead">
        <button class="btn back" data-a="back">← 로비</button>
        <h2>장비</h2>
        ${this.goldChip()}
      </div>
      <h3>총</h3><div class="list" data-c="gun"></div>
      <h3>검</h3><div class="list" data-c="sword"></div>
      <h3>큐브 스킨</h3><div class="list" data-c="skin"></div>
      <div class="hint">상점에서 구매한 장비만 표시 · 총 ${GUNS.length}종 · 검 ${SWORDS.length}종 · 스킨 ${SKINS.length}종</div>`;
    const fill = (cat: ShopCat) => {
      const list = p.querySelector(`[data-c=${cat}]`)!;
      const all = cat === 'gun' ? GUNS : cat === 'sword' ? SWORDS : SKINS;
      const ownedIds = cat === 'skin' ? save.skins : Object.keys(cat === 'gun' ? save.guns : save.swords);
      const eqId = cat === 'gun' ? save.eq.gun : cat === 'sword' ? save.eq.sword : save.eq.skin;
      for (const d of all) {
        const has = ownedIds.includes(d.id);
        const row = el('div', `row r-${d.rarity} ${d.id === eqId ? 'eq' : ''} ${has ? '' : 'locked'}`);
        const lv = cat === 'gun' ? save.guns[d.id] : cat === 'sword' ? save.swords[d.id] : undefined;
        row.innerHTML = `<div class="pvbox"></div><div class="rinfo"><div class="nm"><span style="color:${RARITY[d.rarity].color}">${RARITY[d.rarity].name}</span> ${has ? d.name : '???'}${lv ? ` <em>+${lv}</em>` : ''}</div>
          <div class="hold">${has ? (cat === 'skin' ? (d as SkinDef).desc : (d as GunDef | SwordDef).hold) : '상점에서 구매 가능'}</div></div>
          <div class="eqmark">${d.id === eqId ? '장착 중' : has ? '장착' : ''}</div>`;
        if (has) row.querySelector('.pvbox')!.appendChild(previewCanvas({ cat, id: d.id }));
        else row.querySelector('.pvbox')!.innerHTML = '<div class="lockbox">?</div>';
        if (has)
          row.onclick = () => {
            sfx.ui();
            if (cat === 'gun') save.eq.gun = d.id;
            else if (cat === 'sword') save.eq.sword = d.id;
            else save.eq.skin = d.id;
            persist();
            this.app.refreshDemo();
            // mark the new pick in place: the list stays where it was scrolled
            list.querySelectorAll<HTMLElement>('.row.eq').forEach((r) => {
              r.classList.remove('eq');
              r.querySelector('.eqmark')!.textContent = '장착';
            });
            row.classList.add('eq');
            row.querySelector('.eqmark')!.textContent = '장착 중';
          };
        list.appendChild(row);
      }
    };
    fill('gun');
    fill('sword');
    fill('skin');
    p.querySelector<HTMLElement>('[data-a=back]')!.onclick = () => { sfx.ui(); this.lobby(); };
    w.appendChild(p);
    root().appendChild(w);
  }

  // ---------------- in-run overlays ----------------
  levelUp(choices: Upgrade[], upLv: Record<string, number>, pick: (u: Upgrade) => void) {
    this.clear();
    this.current = 'none';
    const m = el('div', 'modal lv');
    m.innerHTML = `<div class="box wide"><h2>레벨 업!</h2><p class="sub">강화 하나 선택 (1 · 2 · 3)</p><div class="choices"></div></div>`;
    const box = m.querySelector('.choices')!;
    const choose = (u: Upgrade) => {
      sfx.ui();
      this.clear();
      pick(u);
    };
    choices.forEach((u, i) => {
      const lv = upLv[u.id] ?? 0;
      const c = el('button', `choice t-${u.tag === '총' ? 'gun' : u.tag === '검' ? 'sword' : 'body'}`);
      const dots = Array.from({ length: u.max }, (_, k) => `<i class="${k < lv ? 'on' : k === lv ? 'next' : ''}"></i>`).join('');
      c.innerHTML = `<div class="key">${i + 1}</div><div class="tg">${u.tag}</div><div class="nm">${u.name}</div><div class="ds">${u.desc}</div><div class="dots">${dots}</div>`;
      c.onclick = () => choose(u);
      box.appendChild(c);
    });
    // brief input lock so a held slash key doesn't pick by accident
    m.style.pointerEvents = 'none';
    setTimeout(() => (m.style.pointerEvents = ''), 250);
    const keys = (e: KeyboardEvent) => {
      const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (n >= 0 && choices[n]) choose(choices[n]);
    };
    setTimeout(() => {
      if (m.isConnected) {
        this.levelKeys = keys;
        addEventListener('keydown', keys);
      }
    }, 250);
    root().appendChild(m);
    void UPGRADES;
  }

  pause() {
    this.clear();
    const m = el('div', 'modal');
    m.innerHTML = `<div class="box small">
      <h2>일시정지</h2>
      <button class="btn primary" data-a="resume">계속하기</button>
      <button class="btn" data-a="snd">효과음: ${save.sound ? '켜짐' : '꺼짐'}</button>
      <button class="btn" data-a="bgm">배경음: ${save.music ? '켜짐' : '꺼짐'}</button>
      <label class="vol"><span>효과음 크기</span><input type="range" min="0" max="100" step="5" data-v="sfx" value="${Math.round(save.sfxVol * 100)}"><b>${Math.round(save.sfxVol * 100)}</b></label>
      <label class="vol"><span>배경음 크기</span><input type="range" min="0" max="100" step="5" data-v="music" value="${Math.round(save.musicVol * 100)}"><b>${Math.round(save.musicVol * 100)}</b></label>
      ${canFullscreen() ? `<button class="btn" data-a="fs">전체화면: ${save.fullscreen ? '자동' : '끔'}</button>` : ''}
      <button class="btn ghost danger" data-a="quit">포기하고 로비로 (획득 골드 유지)</button>
    </div>`;
    m.querySelector<HTMLElement>('[data-a=resume]')!.onclick = () => this.app.resume();
    m.querySelector<HTMLElement>('[data-a=snd]')!.onclick = (e) => {
      save.sound = !save.sound;
      sfx.setEnabled(save.sound);
      persist();
      (e.target as HTMLElement).textContent = `효과음: ${save.sound ? '켜짐' : '꺼짐'}`;
    };
    m.querySelector<HTMLElement>('[data-a=bgm]')!.onclick = (e) => {
      save.music = !save.music;
      sfx.setMusic(save.music);
      persist();
      (e.target as HTMLElement).textContent = `배경음: ${save.music ? '켜짐' : '꺼짐'}`;
    };
    bindVolume(m);
    const fsBtn = m.querySelector<HTMLElement>('[data-a=fs]');
    if (fsBtn)
      fsBtn.onclick = (e) => {
        save.fullscreen = !save.fullscreen;
        persist();
        if (save.fullscreen) enterFullscreen();
        else exitFullscreen();
        (e.target as HTMLElement).textContent = `전체화면: ${save.fullscreen ? '자동' : '끔'}`;
      };
    m.querySelector<HTMLElement>('[data-a=quit]')!.onclick = () => this.app.quitRun();
    root().appendChild(m);
  }

  result(r: RunResult, bonus: number, note: string, onDone: () => void) {
    this.clear();
    const m = el('div', 'modal');
    const t = `${Math.floor(r.time / 60)}분 ${Math.floor(r.time % 60)}초`;
    m.innerHTML = `<div class="box">
      <h2 class="${r.won ? 'win' : 'lose'}">${r.won ? '승리' : '패배'}</h2>
      <div class="res">
        <div><i>생존 시간</i><b>${t}</b></div>
        <div><i>처치</i><b>${r.kills}</b></div>
        <div><i>레벨</i><b>${r.level}</b></div>
        <div><i>패리 / 퍼펙트</i><b>${r.parries} / ${r.perfects}</b></div>
        <div><i>주운 골드</i><b>${fmt(r.gold)}</b></div>
        <div><i>보너스</i><b>+${fmt(bonus)}</b></div>
      </div>
      <div class="total"><b class="coin"></b> +${fmt(r.gold + bonus)} <span>보유 ${fmt(save.gold)}</span></div>
      ${note ? `<p class="unlock">${note}</p>` : ''}
      <p class="sub">상점에 새 물품 입고</p>
      <button class="btn primary" data-a="ok">로비로</button>
    </div>`;
    m.querySelector<HTMLElement>('[data-a=ok]')!.onclick = () => {
      sfx.ui();
      onDone();
    };
    root().appendChild(m);
  }

  // ---------------- account ----------------
  private mountAccount(w: HTMLElement) {
    const slot = w.querySelector<HTMLElement>('.acct-slot');
    if (!slot) return;
    const paint = () => {
      if (!slot.isConnected) return unsub();
      const st = cloud.status;
      if (st === 'off' || st === 'checking') {
        slot.innerHTML = '';
        return;
      }
      const label = st === 'nodb' ? '서버 미연결' : cloud.user ? cloud.user : '로그인';
      const dot = st === 'syncing' ? 'sync' : st === 'error' || st === 'nodb' ? 'err' : cloud.user ? 'ok' : '';
      slot.innerHTML = `<button class="acct ${dot}"><i></i>${escapeHtml(label)}</button>`;
      slot.querySelector<HTMLElement>('button')!.onclick = () => {
        sfx.ui();
        if (cloud.user) this.accountPanel();
        else if (st !== 'nodb') this.loginPanel('login');
      };
    };
    const unsub = cloud.subscribe(paint);
    paint();
  }

  loginPanel(mode: 'login' | 'signup') {
    document.querySelector('.modal.acct-modal')?.remove();
    const m = el('div', 'modal acct-modal');
    const signup = mode === 'signup';
    m.innerHTML = `<form class="box small acct-form" autocomplete="on">
      <div class="tabs acct-tabs">
        <button type="button" data-m="login" class="${signup ? '' : 'on'}">로그인</button>
        <button type="button" data-m="signup" class="${signup ? 'on' : ''}">회원가입</button>
      </div>
      <label class="field"><span>아이디</span><input name="id" maxlength="16" autocomplete="username" spellcheck="false" autocapitalize="off" required></label>
      <label class="field"><span>비밀번호</span><input name="pw" type="password" maxlength="64" autocomplete="${signup ? 'new-password' : 'current-password'}" required></label>
      ${signup ? '<label class="field"><span>비밀번호 확인</span><input name="pw2" type="password" maxlength="64" autocomplete="new-password" required></label>' : ''}
      <p class="form-note">${signup ? '아이디: 영문·숫자·밑줄 3~16자 (대소문자 구분 없음) · 비밀번호: 6자 이상' : '로그인하면 진행 상황이 클라우드에 저장된다'}</p>
      <p class="form-warn">${signup ? '새 계정은 <b>처음부터</b> 시작한다. 이 기기에 쌓인 골드·무기·스킨·기록은 사라진다.' : '로그인하면 이 기기의 진행이 <b>계정에 저장된 진행</b>으로 바뀐다. 이 기기에만 있던 골드·무기·기록은 사라진다.'}</p>
      <p class="form-err" role="alert"></p>
      <button class="btn primary" type="submit">${signup ? '가입하기' : '로그인'}</button>
      <button class="btn ghost" type="button" data-a="close">닫기</button>
    </form>`;
    const form = m.querySelector('form')!;
    const err = m.querySelector<HTMLElement>('.form-err')!;
    m.querySelectorAll<HTMLElement>('[data-m]').forEach((b) => (b.onclick = () => this.loginPanel(b.dataset.m as 'login' | 'signup')));
    m.querySelector<HTMLElement>('[data-a=close]')!.onclick = () => m.remove();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const id = String(fd.get('id') ?? '').trim();
      const pw = String(fd.get('pw') ?? '');
      if (signup && pw !== String(fd.get('pw2') ?? '')) {
        err.textContent = '비밀번호 확인 불일치';
        return;
      }
      const btn = form.querySelector<HTMLButtonElement>('button[type=submit]')!;
      btn.disabled = true;
      err.textContent = '';
      try {
        const how = await signIn(mode, id, pw, (info) => this.confirmSwitch(info));
        sfx.buy();
        m.remove();
        this.toast(signup ? `${cloud.user} 가입 완료 · 처음부터 시작` : how === 'loaded' ? `${cloud.user} 로그인 · 계정 진행 불러옴` : `${cloud.user} 로그인 · 저장된 진행 없음, 처음부터 시작`);
      } catch (x) {
        sfx.deny();
        err.textContent = errorText(x);
        btn.disabled = false;
      }
    };
    root().appendChild(m);
    m.querySelector<HTMLInputElement>('input[name=id]')!.focus();
  }

  /** the last word before this device's progress is thrown away */
  private confirmSwitch(info: SwitchInfo): Promise<boolean> {
    return new Promise((resolve) => {
      const m = el('div', 'modal acct-modal confirm-switch');
      const line = (s: Summary) =>
        `골드 ${fmt(s.gold)} · 무기 ${s.weapons}개 · 스킨 ${s.skins}개 · 출격 ${s.runs}회 · 최고 ${Math.floor(s.bestTime / 60)}분 ${Math.floor(s.bestTime % 60)}초`;
      const signup = info.mode === 'signup';
      m.innerHTML = `<div class="box small">
        <h2 class="lose">주의</h2>
        <p class="warn-big">${signup ? '새 계정은 처음부터 시작한다.' : info.account ? '이 기기의 진행이 계정에 저장된 진행으로 바뀐다.' : '이 계정에는 저장된 진행이 없다. 처음부터 시작한다.'}</p>
        <div class="acct-info"><span>사라지는 진행 (이 기기)</span></div>
        <p class="sum lose-sum">${line(info.local)}</p>
        ${info.account ? `<div class="acct-info"><span>불러올 진행 (계정)</span></div><p class="sum">${line(info.account)}</p>` : ''}
        <button class="btn primary" data-a="go">계속</button>
        <button class="btn ghost" data-a="no">취소</button>
      </div>`;
      const done = (v: boolean) => {
        sfx.ui();
        m.remove();
        resolve(v);
      };
      m.querySelector<HTMLElement>('[data-a=go]')!.onclick = () => done(true);
      m.querySelector<HTMLElement>('[data-a=no]')!.onclick = () => done(false);
      root().appendChild(m);
    });
  }

  accountPanel() {
    document.querySelector('.modal.acct-modal')?.remove();
    const m = el('div', 'modal acct-modal');
    const when = cloud.lastSync ? new Date(cloud.lastSync).toLocaleString('ko-KR', { hour12: false }) : '-';
    m.innerHTML = `<div class="box small">
      <h2>계정</h2>
      <div class="acct-info"><span>아이디</span><b>${escapeHtml(cloud.user)}</b></div>
      <div class="acct-info"><span>마지막 동기화</span><b class="when">${when}</b></div>
      <button class="btn" data-a="sync">지금 동기화</button>
      <button class="btn ghost danger" data-a="out">로그아웃</button>
      <button class="btn" data-a="close">닫기</button>
    </div>`;
    m.querySelector<HTMLElement>('[data-a=close]')!.onclick = () => m.remove();
    m.querySelector<HTMLElement>('[data-a=sync]')!.onclick = async () => {
      sfx.ui();
      try {
        await syncNow();
        this.toast('동기화 완료');
        m.remove();
      } catch (x) {
        this.toast(errorText(x));
      }
    };
    m.querySelector<HTMLElement>('[data-a=out]')!.onclick = async () => {
      sfx.ui();
      await signOut();
      this.toast('로그아웃');
      m.remove();
    };
    root().appendChild(m);
  }

  /** this device and the cloud disagree: let the player pick which progress to keep */
  conflict(c: ConflictChoice) {
    document.querySelector('.modal.acct-modal')?.remove();
    const m = el('div', 'modal acct-modal');
    const card = (title: string, s: Summary, k: 'local' | 'cloud') => `
      <button class="pick" data-k="${k}">
        <b>${title}</b>
        <span><i>골드</i>${fmt(s.gold)}</span>
        <span><i>무기</i>${s.weapons}</span>
        <span><i>스킨</i>${s.skins}</span>
        <span><i>출격</i>${s.runs}</span>
        <span><i>최고 기록</i>${Math.floor(s.bestTime / 60)}분 ${Math.floor(s.bestTime % 60)}초</span>
        ${s.updated ? `<em>${new Date(s.updated).toLocaleString('ko-KR', { hour12: false })}</em>` : '<em>현재 기기</em>'}
      </button>`;
    m.innerHTML = `<div class="box">
      <h2>저장 데이터 선택</h2>
      <p class="sub">이 기기와 클라우드의 진행 상황이 다르다. 남길 쪽을 선택하면 다른 쪽은 덮어쓴다.</p>
      <div class="picks">${card('이 기기', c.local, 'local')}${card('클라우드', c.cloud, 'cloud')}</div>
    </div>`;
    m.querySelectorAll<HTMLElement>('.pick').forEach(
      (b) =>
        (b.onclick = async () => {
          sfx.ui();
          m.remove();
          await c.choose(b.dataset.k as 'local' | 'cloud');
          this.toast(b.dataset.k === 'cloud' ? '클라우드 저장 적용' : '이 기기 저장으로 덮어씀');
        }),
    );
    root().appendChild(m);
  }

  toast(msg: string) {
    const t = el('div', 'toast', msg);
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('out'), 1300);
    setTimeout(() => t.remove(), 1700);
  }
}

export { catalog };
