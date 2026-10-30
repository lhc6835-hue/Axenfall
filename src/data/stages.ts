export type EnemyType = 'sprout' | 'moth' | 'spore' | 'beetle';
export type BossType = 'bigsprout' | 'golem' | 'mantis' | 'tree';

export interface Spawn { t: EnemyType; n: number; elite?: boolean }
export interface Arena {
  x: number; // left edge of the locked arena (camera width = 640)
  waves: Spawn[][];
  boss?: BossType;
  label?: string;
}
export interface StageDef {
  id: string;
  world: number;
  idx: number;
  name: string;
  desc: string;
  length: number;
  lv: number; // enemy level, scales hp/damage
  arenas: Arena[];
  platforms: [number, number, number][]; // x, y, width(tiles)
  gold: number;
  gems: number;
  firstGems: number;
  map: [number, number]; // node position on stage-select map
}

export interface WorldDef { id: number; name: string; en: string; theme: string; desc: string; locked?: boolean; color: number }

export const WORLDS: WorldDef[] = [
  { id: 1, name: '이끼베일 숲', en: 'MOSSVEIL FOREST', theme: 'forest', desc: '오래된 나무들이 속삭이는 숲. 숲의 왕이 깨어났다.', color: 0x6cc24a },
  { id: 2, name: '잿불 황야', en: 'EMBER WASTES', theme: 'dusk', desc: '불씨가 꺼지지 않는 붉은 땅.', locked: true, color: 0xff7b3a },
  { id: 3, name: '서리 첨탑', en: 'FROST SPIRE', theme: 'night', desc: '하늘 끝까지 얼어붙은 탑.', locked: true, color: 0x8fd8ff },
];

const P = (x: number, y: number, w: number): [number, number, number] => [x, y, w];

export const STAGES: StageDef[] = [
  {
    id: '1-1', world: 1, idx: 1, name: '숲의 입구', desc: '새싹들이 길을 막고 있다.', length: 2700, lv: 1,
    arenas: [
      { x: 300, waves: [[{ t: 'sprout', n: 3 }], [{ t: 'sprout', n: 2 }, { t: 'moth', n: 1 }]] },
      { x: 1100, waves: [[{ t: 'sprout', n: 3 }, { t: 'moth', n: 2 }]] },
      { x: 1950, waves: [[{ t: 'sprout', n: 2 }]], boss: 'bigsprout', label: '중간 보스' },
    ],
    platforms: [P(520, 230, 4), P(1300, 220, 5), P(2150, 225, 4)],
    gold: 120, gems: 20, firstGems: 200, map: [60, 250],
  },
  {
    id: '1-2', world: 1, idx: 2, name: '포자 골짜기', desc: '꽃이 씨앗을 쏘아댄다. 엄폐하며 접근하라.', length: 3000, lv: 2,
    arenas: [
      { x: 300, waves: [[{ t: 'moth', n: 3 }], [{ t: 'sprout', n: 2 }, { t: 'spore', n: 1 }]] },
      { x: 1200, waves: [[{ t: 'spore', n: 2 }, { t: 'sprout', n: 2 }], [{ t: 'moth', n: 3 }]] },
      { x: 2250, waves: [[{ t: 'sprout', n: 2 }, { t: 'spore', n: 1 }]], boss: 'golem', label: '중간 보스' },
    ],
    platforms: [P(480, 225, 3), P(760, 200, 3), P(1400, 215, 5), P(2400, 220, 4)],
    gold: 160, gems: 20, firstGems: 200, map: [130, 196],
  },
  {
    id: '1-3', world: 1, idx: 3, name: '딱정벌레 굴', desc: '단단한 껍질은 정면 공격을 튕겨낸다. 등 뒤를 노려라.', length: 3200, lv: 3,
    arenas: [
      { x: 300, waves: [[{ t: 'beetle', n: 1 }, { t: 'sprout', n: 2 }], [{ t: 'moth', n: 2 }, { t: 'spore', n: 1 }]] },
      { x: 1250, waves: [[{ t: 'beetle', n: 2 }, { t: 'moth', n: 2 }], [{ t: 'sprout', n: 3, elite: true }]] },
      { x: 2450, waves: [[{ t: 'spore', n: 2 }]], boss: 'mantis', label: '중간 보스' },
    ],
    platforms: [P(520, 225, 4), P(1450, 205, 4), P(1800, 230, 3), P(2650, 215, 5)],
    gold: 200, gems: 25, firstGems: 250, map: [200, 248],
  },
  {
    id: '1-4', world: 1, idx: 4, name: '안개 늪', desc: '정예 몬스터가 섞여 있다. 체력 관리에 주의.', length: 3400, lv: 4,
    arenas: [
      { x: 300, waves: [[{ t: 'moth', n: 3 }, { t: 'spore', n: 1 }], [{ t: 'beetle', n: 1, elite: true }, { t: 'sprout', n: 2 }]] },
      { x: 1300, waves: [[{ t: 'spore', n: 3 }, { t: 'moth', n: 2 }], [{ t: 'sprout', n: 3, elite: true }, { t: 'beetle', n: 1 }]] },
      { x: 2600, waves: [[{ t: 'moth', n: 2 }, { t: 'sprout', n: 2 }]], boss: 'golem', label: '중간 보스' },
    ],
    platforms: [P(500, 210, 3), P(820, 230, 3), P(1500, 215, 5), P(2000, 200, 3), P(2800, 220, 4)],
    gold: 240, gems: 25, firstGems: 250, map: [268, 186],
  },
  {
    id: '1-5', world: 1, idx: 5, name: '칼날 수풀', desc: '사마귀 기사가 왕의 숲을 지킨다.', length: 3600, lv: 5,
    arenas: [
      { x: 300, waves: [[{ t: 'beetle', n: 2 }, { t: 'spore', n: 1 }], [{ t: 'moth', n: 4 }]] },
      { x: 1400, waves: [[{ t: 'sprout', n: 3, elite: true }, { t: 'spore', n: 2 }], [{ t: 'beetle', n: 2, elite: true }]] },
      { x: 2750, waves: [[{ t: 'moth', n: 2, elite: true }]], boss: 'mantis', label: '중간 보스' },
    ],
    platforms: [P(520, 215, 4), P(1600, 205, 4), P(2100, 225, 3), P(2950, 210, 5)],
    gold: 300, gems: 30, firstGems: 300, map: [330, 246],
  },
  {
    id: '1-6', world: 1, idx: 6, name: '고목왕의 왕좌', desc: '숲의 주인, 고목왕 엘더우드가 기다린다.', length: 3000, lv: 6,
    arenas: [
      { x: 300, waves: [[{ t: 'sprout', n: 3, elite: true }, { t: 'moth', n: 2 }], [{ t: 'beetle', n: 2 }, { t: 'spore', n: 2 }]] },
      { x: 1250, waves: [[{ t: 'moth', n: 2 }]], boss: 'golem', label: '중간 보스' },
      { x: 2360, waves: [], boss: 'tree', label: '보스' },
    ],
    platforms: [P(500, 220, 4), P(1450, 215, 4), P(2440, 215, 3), P(2840, 215, 3)],
    gold: 500, gems: 50, firstGems: 500, map: [376, 150],
  },
];

export const stageById = (id: string) => STAGES.find((s) => s.id === id)!;

export function stageUnlocked(id: string, cleared: Record<string, number>) {
  const s = stageById(id);
  if (s.idx === 1) return true;
  const prev = STAGES.find((p) => p.world === s.world && p.idx === s.idx - 1);
  return !!prev && !!cleared[prev.id];
}
