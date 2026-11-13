import { GUNS, SKINS, SWORDS, RARITY, RARITY_ORDER, ENHANCE_MAX, type Rarity } from './data';

export type ShopCat = 'sword' | 'gun' | 'skin';
export interface Slot {
  id: string;
  stock: number;
  max: number;
}

export interface Save {
  gold: number;
  /** weapon id -> enhance level (0 = just owned) */
  swords: Record<string, number>;
  guns: Record<string, number>;
  skins: string[];
  eq: { sword: string; gun: string; skin: string };
  shop: { sword: Slot[]; gun: Slot[]; skin: Slot[]; rerolls: number; restockAt: number; gen: number };
  best: { time: number; kills: number; level: number };
  runs: number;
  sound: boolean;
  music: boolean;
  fullscreen: boolean;
  sfxVol: number;
  musicVol: number;
}

const KEY = 'parrycube_save_v1';
export const SLOTS_PER_CAT = 6;
export const RESTOCK_MS = 15 * 60 * 1000;

function fresh(): Save {
  const s: Save = {
    gold: 250,
    swords: { s_dagger: 0 },
    guns: { g_pistol: 0 },
    skins: ['k_basic'],
    eq: { sword: 's_dagger', gun: 'g_pistol', skin: 'k_basic' },
    shop: { sword: [], gun: [], skin: [], rerolls: 0, restockAt: 0, gen: 0 },
    best: { time: 0, kills: 0, level: 0 },
    runs: 0,
    sound: true,
    music: true,
    fullscreen: true,
    sfxVol: 0.8,
    musicVol: 0.45,
  };
  restock(s);
  return s;
}

/** called after every save to disk (the cloud sync listens here) */
export const onPersist: (() => void)[] = [];

export let save: Save = load();
persist();

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Save;
      const f = fresh();
      return { ...f, ...s, eq: { ...f.eq, ...s.eq }, shop: { ...f.shop, ...s.shop }, best: { ...f.best, ...s.best } };
    }
  } catch {
    /* storage unavailable */
  }
  return fresh();
}

/** device settings stay on the device; everything else is progress */
const DEVICE_KEYS = ['sound', 'music', 'fullscreen', 'sfxVol', 'musicVol'] as const;
export function progressOf(s: Save): Partial<Save> {
  const out: Record<string, unknown> = { ...s };
  for (const k of DEVICE_KEYS) delete out[k];
  return JSON.parse(JSON.stringify(out));
}
/** take progress from elsewhere (the cloud) and keep this device's settings */
export function replaceProgress(p: Partial<Save>) {
  const f = fresh();
  const keep: Record<string, unknown> = {};
  for (const k of DEVICE_KEYS) keep[k] = save[k];
  save = { ...f, ...p, eq: { ...f.eq, ...p.eq }, shop: { ...f.shop, ...p.shop }, best: { ...f.best, ...p.best }, ...keep } as Save;
  persist();
}

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* ignore */
  }
  for (const f of onPersist) f();
}

export function resetSave() {
  save = fresh();
  persist();
}

// ---------------- shop stock ----------------
function rollRarity(): Rarity {
  let total = 0;
  for (const r of RARITY_ORDER) total += RARITY[r].weight;
  let x = Math.random() * total;
  for (const r of RARITY_ORDER) {
    x -= RARITY[r].weight;
    if (x <= 0) return r;
  }
  return 'common';
}

interface Item { id: string; rarity: Rarity; starter?: boolean }

export function catalog(cat: ShopCat): Item[] {
  const list: Item[] = cat === 'sword' ? SWORDS : cat === 'gun' ? GUNS : SKINS;
  return list.filter((i) => !i.starter);
}

/** can this item still be bought at all (not maxed / not owned skin)? */
export function purchasable(cat: ShopCat, id: string) {
  if (cat === 'skin') return !save.skins.includes(id);
  const lv = (cat === 'sword' ? save.swords : save.guns)[id];
  return lv === undefined || lv < ENHANCE_MAX;
}

function rollCategory(s: Save, cat: ShopCat): Slot[] {
  const items = catalog(cat);
  const chosen: Slot[] = [];
  let guard = 0;
  while (chosen.length < SLOTS_PER_CAT && guard++ < 200) {
    const rar = rollRarity();
    let pool = items.filter((i) => i.rarity === rar && !chosen.some((c) => c.id === i.id));
    // prefer things the player can still use (unowned skins etc.)
    const useful = pool.filter((i) => (cat === 'skin' ? !s.skins.includes(i.id) : true));
    if (useful.length) pool = useful;
    if (!pool.length) continue;
    const it = pool[Math.floor(Math.random() * pool.length)];
    const [a, b] = RARITY[it.rarity].stock;
    const stock = cat === 'skin' ? 1 : a + Math.floor(Math.random() * (b - a + 1));
    chosen.push({ id: it.id, stock, max: stock });
  }
  // order by rarity so the shelf reads cheap -> expensive
  chosen.sort((x, y) => RARITY_ORDER.indexOf(items.find((i) => i.id === x.id)!.rarity) - RARITY_ORDER.indexOf(items.find((i) => i.id === y.id)!.rarity));
  return chosen;
}

export function restock(s: Save = save) {
  s.shop.sword = rollCategory(s, 'sword');
  s.shop.gun = rollCategory(s, 'gun');
  s.shop.skin = rollCategory(s, 'skin');
  s.shop.rerolls = 0;
  s.shop.restockAt = Date.now() + RESTOCK_MS;
  s.shop.gen++;
}

export function checkTimedRestock() {
  if (Date.now() >= save.shop.restockAt) {
    restock();
    persist();
    return true;
  }
  return false;
}

export const rerollCost = () => 60 * (save.shop.rerolls + 1) * (save.shop.rerolls + 1);

export function reroll(): boolean {
  const c = rerollCost();
  if (save.gold < c) return false;
  save.gold -= c;
  const n = save.shop.rerolls + 1;
  const at = save.shop.restockAt;
  restock();
  save.shop.rerolls = n;
  save.shop.restockAt = at;
  persist();
  return true;
}

export function priceOf(cat: ShopCat, id: string) {
  const it = (cat === 'sword' ? SWORDS : cat === 'gun' ? GUNS : SKINS).find((i) => i.id === id)!;
  return it.price;
}

export type BuyResult = 'ok' | 'gold' | 'stock' | 'owned';

export function buy(cat: ShopCat, slot: Slot): BuyResult {
  if (slot.stock <= 0) return 'stock';
  if (!purchasable(cat, slot.id)) return 'owned';
  const price = priceOf(cat, slot.id);
  if (save.gold < price) return 'gold';
  save.gold -= price;
  slot.stock--;
  if (cat === 'skin') save.skins.push(slot.id);
  else {
    const book = cat === 'sword' ? save.swords : save.guns;
    book[slot.id] = book[slot.id] === undefined ? 0 : book[slot.id] + 1;
  }
  persist();
  return 'ok';
}
