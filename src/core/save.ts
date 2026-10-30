import { ABILITIES, abilityById, MAX_STAR, shardsForStar } from '../data/abilities';
import type { Grade } from './const';

export interface OwnedAbility { level: number; star: number; shards: number }

export interface SaveData {
  v: number;
  gold: number;
  gems: number;
  owned: Record<string, OwnedAbility>;
  main: string; // equipped ability (basic attack + body color)
  slots: [string | null, string | null, string | null];
  ult: string | null;
  hpLv: number;
  atkLv: number;
  cleared: Record<string, number>; // stageId -> best stars (1..3)
  pity: number; // pulls since last SSR+
  totalPulls: number;
  sfx: number;
  bgm: number;
  seenIntro: boolean;
}

const KEY = 'axenfall.save.v1';

function fresh(): SaveData {
  return {
    v: 1,
    gold: 300,
    gems: 1000,
    owned: { blade: { level: 1, star: 1, shards: 0 } },
    main: 'blade',
    slots: ['blade_dash', 'blade_whirl', null],
    ult: 'blade_ult',
    hpLv: 1,
    atkLv: 1,
    cleared: {},
    pity: 0,
    totalPulls: 0,
    sfx: 0.8,
    bgm: 0.6,
    seenIntro: false,
  };
}

let data: SaveData = load();

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return fresh();
}

export const Save = {
  get d() { return data; },
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
  },
  reset() { data = fresh(); this.write(); },
  owns(id: string) { return !!data.owned[id]; },
  /** Adds an ability from gacha; returns whether it was new. */
  grant(id: string): { isNew: boolean; shard: boolean } {
    const o = data.owned[id];
    if (!o) { data.owned[id] = { level: 1, star: 1, shards: 0 }; return { isNew: true, shard: false }; }
    if (o.star >= MAX_STAR) { data.gold += 500; return { isNew: false, shard: false }; }
    o.shards++;
    return { isNew: false, shard: true };
  },
  canStarUp(id: string) {
    const o = data.owned[id];
    return !!o && o.star < MAX_STAR && o.shards >= shardsForStar(o.star);
  },
  starUp(id: string) {
    const o = data.owned[id];
    if (!this.canStarUp(id)) return false;
    o.shards -= shardsForStar(o.star);
    o.star++;
    this.write();
    return true;
  },
  gradeOf(id: string): Grade { return abilityById(id).grade; },
  ownedList() { return ABILITIES.filter((a) => data.owned[a.id]); },
  hpMax() { return 120 + (data.hpLv - 1) * 14; },
  atkBase() { return 10 + (data.atkLv - 1) * 1.6; },
  statCost(lv: number) { return Math.floor(150 * Math.pow(1.25, lv - 1)); },
};
