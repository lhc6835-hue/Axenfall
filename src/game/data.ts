export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'transcendent';

export const RARITY: Record<Rarity, { name: string; color: string; weight: number; stock: [number, number] }> = {
  common: { name: '일반', color: '#c9cbd6', weight: 51, stock: [2, 3] },
  uncommon: { name: '고급', color: '#5fdc84', weight: 27, stock: [1, 2] },
  rare: { name: '희귀', color: '#4aa8ff', weight: 13, stock: [1, 2] },
  epic: { name: '영웅', color: '#b672ff', weight: 6, stock: [1, 1] },
  legendary: { name: '전설', color: '#ffb32e', weight: 2, stock: [1, 1] },
  mythic: { name: '신화', color: '#ff4a5e', weight: 0.75, stock: [1, 1] },
  transcendent: { name: '초월', color: '#7af6ff', weight: 0.25, stock: [1, 1] },
};
export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'transcendent'];

// ---------------- guns ----------------
export type GunKind =
  | 'pistol' | 'revolver' | 'smg' | 'shotgun' | 'sniper' | 'minigun' | 'railgun'
  | 'derringer' | 'lever' | 'rifle' | 'laser' | 'dbarrel' | 'cannon' | 'musket' | 'launcher';
/** how a gun looks: its own art, while `kind` picks the handling, reload and sound it shares */
export type GunLook =
  | GunKind
  | 'mpistol' | 'flare' | 'nailgun' | 'crossbow' | 'harpoon' | 'blunder' | 'tesla' | 'drum' | 'dragon' | 'nova' | 'void';

export interface GunDef {
  id: string;
  kind: GunKind;
  look?: GunLook;
  /** hits arc on to nearby enemies (chain lightning, rebounding rounds) */
  bounce?: number;
  name: string;
  rarity: Rarity;
  price: number;
  desc: string;
  hold: string;
  dmg: number;
  /** shots per second */
  rate: number;
  mag: number;
  reload: number;
  range: number;
  spread: number;
  pellets: number;
  pierce: number;
  crit: number;
  knock: number;
  /** hit-stop on kill */
  stop: number;
  shake: number;
  tracer: number;
  starter?: boolean;
  /** rounds per trigger pull */
  burst?: number;
  /** explosion radius at the impact point */
  splash?: number;
  /** no magazine: overheats and vents instead */
  heat?: boolean;
}

export const GUNS: GunDef[] = [
  {
    id: 'g_pistol', kind: 'pistol', name: '정비공 권총', rarity: 'common', price: 0, starter: true,
    desc: '손에 익은 반자동 권총. 빈 탄창을 털어내고 슬라이드를 당겨 장전한다.', hold: '한 손 · 슬라이드 장전',
    dmg: 8, rate: 3.2, mag: 12, reload: 1.05, range: 170, spread: 0.05, pellets: 1, pierce: 0, crit: 0.08, knock: 40, stop: 0.012, shake: 1.2, tracer: 0xffe9a8,
  },
  {
    id: 'g_revolver', kind: 'revolver', name: '황야의 리볼버', rarity: 'common', price: 380,
    desc: '여섯 발들이 리볼버. 실린더를 비우고 총을 두 바퀴 돌려 장전한다. 치명타 확률이 높다.', hold: '한 손 · 총 돌리기 장전',
    dmg: 17, rate: 2.1, mag: 6, reload: 1.25, range: 195, spread: 0.02, pellets: 1, pierce: 1, crit: 0.2, knock: 70, stop: 0.03, shake: 2.2, tracer: 0xffd27a,
  },
  {
    id: 'g_smg', kind: 'smg', name: '벌집 SMG', rarity: 'uncommon', price: 1250,
    desc: '탄을 비처럼 흩뿌리는 기관단총. 옆으로 눕혀 긴 탄창을 교체한다.', hold: '한 손 · 옆으로 눕혀 사격',
    dmg: 5.5, rate: 11, mag: 34, reload: 1.45, range: 150, spread: 0.16, pellets: 1, pierce: 0, crit: 0.05, knock: 22, stop: 0.008, shake: 0.7, tracer: 0xfff3c4,
  },
  {
    id: 'g_shotgun', kind: 'shotgun', name: '펌프 액션 샷건', rarity: 'rare', price: 3300,
    desc: '산탄 7발. 사격마다 펌프를 당기고, 장전은 한 발씩 밀어 넣는다.', hold: '두 손 · 펌프 액션',
    dmg: 7, rate: 1.35, mag: 6, reload: 0.32, range: 120, spread: 0.42, pellets: 7, pierce: 0, crit: 0.06, knock: 140, stop: 0.04, shake: 4, tracer: 0xffc070,
  },
  {
    id: 'g_sniper', kind: 'sniper', name: '볼트액션 롱보어', rarity: 'epic', price: 7800,
    desc: '일직선의 적을 꿰뚫는다. 사격마다 노리쇠를 젖혀 탄피를 배출한다.', hold: '두 손 · 개머리판 견착',
    dmg: 62, rate: 0.95, mag: 5, reload: 2.0, range: 340, spread: 0, pellets: 1, pierce: 5, crit: 0.35, knock: 160, stop: 0.06, shake: 5, tracer: 0xffffff,
  },
  {
    id: 'g_minigun', kind: 'minigun', name: '회전포 MG-6', rarity: 'legendary', price: 17500,
    desc: '총열이 회전할수록 연사가 빨라진다. 사격 중 이동 속도 감소.', hold: '허리 견착 · 두 손잡이',
    dmg: 6.5, rate: 24, mag: 180, reload: 2.8, range: 175, spread: 0.18, pellets: 1, pierce: 0, crit: 0.06, knock: 26, stop: 0.006, shake: 0.9, tracer: 0xffe18a,
  },
  {
    id: 'g_railgun', kind: 'railgun', name: '아크 레일건', rarity: 'legendary', price: 26000,
    desc: '충전 후 모든 것을 관통하는 전자기 빔. 장전 시 배터리를 뽑아 열을 배출한다.', hold: '두 손 · 충전 사격',
    dmg: 130, rate: 0.75, mag: 4, reload: 2.3, range: 420, spread: 0, pellets: 1, pierce: 999, crit: 0.2, knock: 220, stop: 0.08, shake: 7, tracer: 0x8ff3ff,
  },
  {
    id: 'g_derringer', kind: 'derringer', name: '포켓 데린저', rarity: 'common', price: 260,
    desc: '손바닥만 한 2연발. 총신을 젖혀 올리고 엄지로 두 발을 밀어 넣는다.', hold: '한 손 · 손바닥에 숨기기',
    dmg: 15, rate: 3.6, mag: 2, reload: 0.7, range: 120, spread: 0.06, pellets: 1, pierce: 0, crit: 0.28, knock: 50, stop: 0.02, shake: 1.4, tracer: 0xffe0b0,
  },
  {
    id: 'g_lever', kind: 'lever', name: '레버액션 카빈', rarity: 'uncommon', price: 1400,
    desc: '사격마다 총을 한 바퀴 돌려 레버를 당긴다. 측면 게이트로 한 발씩 장전.', hold: '한 손 · 스핀콕',
    dmg: 24, rate: 1.6, mag: 8, reload: 0.26, range: 220, spread: 0.02, pellets: 1, pierce: 1, crit: 0.15, knock: 90, stop: 0.03, shake: 2.4, tracer: 0xffd890,
  },
  {
    id: 'g_rifle', kind: 'rifle', name: '3점사 소총', rarity: 'uncommon', price: 1650,
    desc: '방아쇠 한 번에 세 발. 탄창 교체 후 바닥을 쳐서 고정한다.', hold: '두 손 · 견착 점사',
    dmg: 9.5, rate: 2.3, mag: 30, reload: 1.55, range: 210, spread: 0.05, pellets: 1, pierce: 0, crit: 0.08, knock: 35, stop: 0.012, shake: 1.2, tracer: 0xfff0b8, burst: 3,
  },
  {
    id: 'g_dbarrel', kind: 'dbarrel', name: '소드오프 쌍발', rarity: 'rare', price: 3100,
    desc: '짧게 자른 쌍발 산탄총. 총신을 꺾어 탄피를 튕겨내고 손목으로 닫는다.', hold: '한 손 · 중절식',
    dmg: 8, rate: 2.2, mag: 2, reload: 0.95, range: 95, spread: 0.6, pellets: 8, pierce: 0, crit: 0.05, knock: 200, stop: 0.045, shake: 4.5, tracer: 0xffb860,
  },
  {
    id: 'g_laser', kind: 'laser', name: '광자 블래스터', rarity: 'rare', price: 3700,
    desc: '탄창이 없다. 연사하면 과열되어 냉각판을 열고 증기를 배출한다.', hold: '한 손 · 과열 냉각',
    dmg: 9, rate: 7, mag: 24, reload: 1.3, range: 200, spread: 0.04, pellets: 1, pierce: 1, crit: 0.1, knock: 30, stop: 0.01, shake: 0.8, tracer: 0xff6ad8, heat: true,
  },
  {
    id: 'g_cannon', kind: 'cannon', name: '핸드 캐논 .50', rarity: 'epic', price: 8200,
    desc: '대구경 권총. 사격마다 총구가 크게 튀어 오른다.', hold: '한 손 · 대구경',
    dmg: 78, rate: 1.1, mag: 7, reload: 1.4, range: 240, spread: 0.01, pellets: 1, pierce: 2, crit: 0.3, knock: 260, stop: 0.07, shake: 6, tracer: 0xffe8a0,
  },
  {
    id: 'g_musket', kind: 'musket', name: '플린트락 머스킷', rarity: 'epic', price: 7400,
    desc: '부싯돌이 튀고 한 박자 뒤에 발사된다. 꽂을대로 화약을 다져 장전한다.', hold: '두 손 · 꽂을대 장전',
    dmg: 150, rate: 0.6, mag: 1, reload: 2.1, range: 300, spread: 0, pellets: 1, pierce: 3, crit: 0.25, knock: 300, stop: 0.09, shake: 7, tracer: 0xfff4d8,
  },
  {
    id: 'g_launcher', kind: 'launcher', name: '회전식 유탄발사기', rarity: 'legendary', price: 21500,
    desc: '착탄 지점에서 폭발한다. 사격마다 드럼 탄창이 한 칸씩 회전한다.', hold: '두 손 · 허리 견착',
    dmg: 70, rate: 1.15, mag: 6, reload: 0.34, range: 210, spread: 0.02, pellets: 1, pierce: 0, crit: 0.05, knock: 120, stop: 0.07, shake: 6, tracer: 0xffa040, splash: 38,
  },
  // ---- second armoury ----
  {
    id: 'g_mpistol', kind: 'pistol', look: 'mpistol', name: '기관권총 M9', rarity: 'uncommon', price: 1100,
    desc: '연사로 개조한 권총. 긴 탄창을 꽂고 가볍게 흩뿌린다.', hold: '한 손 · 연사',
    dmg: 5, rate: 9, mag: 24, reload: 1.15, range: 150, spread: 0.12, pellets: 1, pierce: 0, crit: 0.06, knock: 20, stop: 0.008, shake: 0.7, tracer: 0xfff0c0,
  },
  {
    id: 'g_flare', kind: 'derringer', look: 'flare', name: '신호탄총', rarity: 'uncommon', price: 1500,
    desc: '굵은 신호탄 한 발. 맞은 자리가 불꽃과 함께 터진다. 총신을 꺾어 장전한다.', hold: '한 손 · 중절식',
    dmg: 32, rate: 1.3, mag: 1, reload: 0.75, range: 170, spread: 0.03, pellets: 1, pierce: 0, crit: 0.1, knock: 90, stop: 0.03, shake: 2.4, tracer: 0xff6a3a, splash: 24,
  },
  {
    id: 'g_nail', kind: 'smg', look: 'nailgun', name: '공업용 네일건', rarity: 'rare', price: 2900,
    desc: '쇠못을 연발로 박아 넣는다. 못은 적 두 마리를 꿰뚫는다.', hold: '한 손 · 못 띠 교체',
    dmg: 9, rate: 7, mag: 40, reload: 1.6, range: 160, spread: 0.08, pellets: 1, pierce: 2, crit: 0.08, knock: 40, stop: 0.012, shake: 1, tracer: 0xd8dce8,
  },
  {
    id: 'g_crossbow', kind: 'sniper', look: 'crossbow', name: '연발 석궁', rarity: 'rare', price: 3500,
    desc: '사격마다 시위를 당겨 건다. 화살은 적 세 마리를 관통한다.', hold: '두 손 · 시위 장전',
    dmg: 44, rate: 1.15, mag: 4, reload: 1.7, range: 260, spread: 0, pellets: 1, pierce: 3, crit: 0.25, knock: 120, stop: 0.04, shake: 2.6, tracer: 0xe8d8b0,
  },
  {
    id: 'g_harpoon', kind: 'musket', look: 'harpoon', name: '포경 작살총', rarity: 'epic', price: 7600,
    desc: '거대한 작살을 쏜다. 맞은 적은 멀리 날아간다. 작살을 총구에 밀어 넣어 장전한다.', hold: '두 손 · 작살 장전',
    dmg: 125, rate: 0.7, mag: 1, reload: 1.9, range: 260, spread: 0, pellets: 1, pierce: 2, crit: 0.2, knock: 520, stop: 0.08, shake: 6, tracer: 0xd8c8a0,
  },
  {
    id: 'g_blunder', kind: 'musket', look: 'blunder', name: '나팔총', rarity: 'epic', price: 6800,
    desc: '나팔처럼 벌어진 총구로 쇳조각을 한 움큼 뿌린다. 가까울수록 무섭다.', hold: '두 손 · 꽂을대 장전',
    dmg: 10, rate: 0.85, mag: 1, reload: 1.7, range: 105, spread: 0.85, pellets: 11, pierce: 0, crit: 0.05, knock: 220, stop: 0.06, shake: 6, tracer: 0xffc070,
  },
  {
    id: 'g_tesla', kind: 'laser', look: 'tesla', name: '테슬라 코일건', rarity: 'legendary', price: 18500,
    desc: '번개를 쏜다. 맞은 적에게서 근처의 적 셋에게 연쇄로 튄다. 과열되면 코일을 식힌다.', hold: '한 손 · 연쇄 번개',
    dmg: 11, rate: 5, mag: 22, reload: 1.4, range: 180, spread: 0.03, pellets: 1, pierce: 0, crit: 0.08, knock: 30, stop: 0.012, shake: 1, tracer: 0x9fe0ff, heat: true, bounce: 3,
  },
  {
    id: 'g_drum', kind: 'rifle', look: 'drum', name: '드럼 산탄총', rarity: 'legendary', price: 16000,
    desc: '둥근 드럼 탄창을 단 자동 산탄총. 산탄 6발을 쉬지 않고 퍼붓는다.', hold: '두 손 · 드럼 교체',
    dmg: 6.5, rate: 3.4, mag: 20, reload: 1.9, range: 125, spread: 0.4, pellets: 6, pierce: 0, crit: 0.05, knock: 110, stop: 0.03, shake: 2.6, tracer: 0xffc888,
  },
  {
    id: 'g_dragon', kind: 'minigun', look: 'dragon', name: '용의 숨결', rarity: 'mythic', price: 46000,
    desc: '불을 머금은 회전포. 달군 탄이 적 둘을 꿰뚫는다. 연료통을 갈아 끼운다.', hold: '허리 견착 · 두 손잡이',
    dmg: 9, rate: 24, mag: 200, reload: 2.6, range: 185, spread: 0.16, pellets: 1, pierce: 2, crit: 0.08, knock: 30, stop: 0.006, shake: 1, tracer: 0xff7a2a,
  },
  {
    id: 'g_nova', kind: 'railgun', look: 'nova', name: '성운포', rarity: 'mythic', price: 42000,
    desc: '작은 별을 충전해 쏜다. 빔이 닿은 자리가 크게 폭발한다.', hold: '두 손 · 충전 사격',
    dmg: 150, rate: 0.7, mag: 4, reload: 2.4, range: 360, spread: 0, pellets: 1, pierce: 0, crit: 0.2, knock: 260, stop: 0.09, shake: 7, tracer: 0xff9af0, splash: 60,
  },
  {
    id: 'g_void', kind: 'sniper', look: 'void', name: '차원 저격총 0', rarity: 'transcendent', price: 88000,
    desc: '공간째로 꿰뚫는 탄. 모든 것을 관통하고 맞힌 적에게서 두 번 더 튄다.', hold: '두 손 · 노리쇠',
    dmg: 140, rate: 1.05, mag: 6, reload: 1.8, range: 420, spread: 0, pellets: 1, pierce: 999, crit: 0.4, knock: 200, stop: 0.07, shake: 5, tracer: 0xc89aff, bounce: 2,
  },
];

// ---------------- swords ----------------
export type SwordKind =
  | 'dagger' | 'longsword' | 'rapier' | 'katana' | 'greatsword' | 'scythe'
  | 'saber' | 'cleaver' | 'katar' | 'spear' | 'nodachi' | 'twinblade' | 'whip' | 'plasma';
/** how a blade looks: its own art, while `kind` picks the combo, carry and parry handling it shares */
export type SwordLook =
  | SwordKind
  | 'tanto' | 'gladius' | 'axe' | 'halberd' | 'hammer' | 'flamberge' | 'chainsword' | 'glaive' | 'voidblade' | 'starblade';

export interface SwordDef {
  id: string;
  kind: SwordKind;
  look?: SwordLook;
  /** each cut also lets loose something for this share of the blade's damage */
  wave?: number;
  /** what it lets loose: a delayed rift that splits the space ahead, or homing star shards */
  waveKind?: 'rift' | 'stars';
  name: string;
  rarity: Rarity;
  price: number;
  desc: string;
  hold: string;
  dmg: number;
  reach: number;
  /** total swept arc (radians) */
  arc: number;
  windup: number;
  swing: number;
  hold_: number;
  recover: number;
  cooldown: number;
  /** parry window (s) */
  parry: number;
  knock: number;
  stop: number;
  color: number;
  starter?: boolean;
}

export const SWORDS: SwordDef[] = [
  {
    id: 's_dagger', kind: 'dagger', name: '녹슨 단검', rarity: 'common', price: 0, starter: true,
    desc: '역수로 쥐고 손안에서 돌린다. 빠르지만 사거리가 짧다.', hold: '역수 · 손 안에서 돌리기',
    dmg: 11, reach: 21, arc: 2.0, windup: 0.025, swing: 0.07, hold_: 0.02, recover: 0.1, cooldown: 0.3, parry: 0.15, knock: 60, stop: 0.03, color: 0xd9dde8,
  },
  {
    id: 's_longsword', kind: 'longsword', name: '기사의 롱소드', rarity: 'common', price: 320,
    desc: '내려베기와 올려베기를 잇고 찌르기로 마무리한다. 표준적인 패리 판정.', hold: '정수 · 좌우 연속 베기',
    dmg: 19, reach: 27, arc: 2.6, windup: 0.05, swing: 0.09, hold_: 0.03, recover: 0.18, cooldown: 0.42, parry: 0.17, knock: 110, stop: 0.045, color: 0xe8eef7,
  },
  {
    id: 's_rapier', kind: 'rapier', name: '은빛 레이피어', rarity: 'uncommon', price: 1100,
    desc: '길게 찌르는 세검. 패리 판정이 가장 넉넉하다.', hold: '앙가르드 · 찌르기',
    dmg: 17, reach: 38, arc: 0.8, windup: 0.05, swing: 0.05, hold_: 0.05, recover: 0.13, cooldown: 0.3, parry: 0.24, knock: 80, stop: 0.04, color: 0xf2f4ff,
  },
  {
    id: 's_katana', kind: 'katana', name: '월광 카타나', rarity: 'rare', price: 2700,
    desc: '발도와 함께 크게 베어 올리고, 회전베기로 마무리한다.', hold: '허리 칼집 · 발도술',
    dmg: 36, reach: 33, arc: 3.6, windup: 0.02, swing: 0.055, hold_: 0.14, recover: 0.3, cooldown: 0.62, parry: 0.19, knock: 130, stop: 0.065, color: 0xcfe8ff,
  },
  {
    id: 's_greatsword', kind: 'greatsword', name: '파성 대검', rarity: 'epic', price: 6900,
    desc: '어깨에 걸쳐 두었다가 내리찍는다. 맞은 적은 멀리 날아간다.', hold: '어깨 걸침 · 양손 내려치기',
    dmg: 64, reach: 39, arc: 3.4, windup: 0.13, swing: 0.13, hold_: 0.05, recover: 0.32, cooldown: 0.95, parry: 0.22, knock: 300, stop: 0.09, color: 0xb9c3d6,
  },
  {
    id: 's_scythe', kind: 'scythe', name: '사신의 낫', rarity: 'legendary', price: 19500,
    desc: '몸을 감아 돌며 주변을 모두 벤다. 모든 방향 패리.', hold: '등 뒤 · 회전 베기',
    dmg: 46, reach: 42, arc: Math.PI * 2, windup: 0.08, swing: 0.26, hold_: 0.02, recover: 0.25, cooldown: 0.85, parry: 0.24, knock: 160, stop: 0.06, color: 0xc49bff,
  },
  {
    id: 's_saber', kind: 'saber', name: '기병 세이버', rarity: 'common', price: 280,
    desc: '한 번 휘둘러 왕복으로 두 번 벤다.', hold: '한 손 · 왕복 베기',
    dmg: 12, reach: 25, arc: 2.2, windup: 0.04, swing: 0.16, hold_: 0.02, recover: 0.16, cooldown: 0.46, parry: 0.16, knock: 70, stop: 0.035, color: 0xe4ecf6,
  },
  {
    id: 's_cleaver', kind: 'cleaver', name: '정육 클리버', rarity: 'common', price: 340,
    desc: '높이 들어 묵직하게 내리찍는다. 치명타 확률이 높다.', hold: '한 손 · 내려찍기',
    dmg: 27, reach: 20, arc: 1.5, windup: 0.09, swing: 0.06, hold_: 0.06, recover: 0.2, cooldown: 0.52, parry: 0.14, knock: 160, stop: 0.07, color: 0xc8ccd6,
  },
  {
    id: 's_katar', kind: 'katar', name: '카타르', rarity: 'uncommon', price: 950,
    desc: '주먹에 끼우는 단검. 빠르게 세 번 찌른다.', hold: '주먹 · 연속 찌르기',
    dmg: 9, reach: 23, arc: 0.7, windup: 0.03, swing: 0.18, hold_: 0.02, recover: 0.1, cooldown: 0.36, parry: 0.2, knock: 45, stop: 0.025, color: 0xf0e0c0,
  },
  {
    id: 's_spear', kind: 'spear', name: '장창', rarity: 'uncommon', price: 1300,
    desc: '창을 한 바퀴 돌려 기세를 실은 뒤 길게 찌른다. 일직선의 적을 꿰뚫는다.', hold: '두 손 · 회전 후 찌르기',
    dmg: 23, reach: 48, arc: 0.5, windup: 0.14, swing: 0.06, hold_: 0.06, recover: 0.2, cooldown: 0.62, parry: 0.2, knock: 140, stop: 0.05, color: 0xd8dce8,
  },
  {
    id: 's_nodachi', kind: 'nodachi', name: '노다치', rarity: 'rare', price: 3400,
    desc: '등에 멘 장도. 어깨 너머로 뽑아 넓게 휩쓴다.', hold: '등 · 어깨 너머 발도',
    dmg: 40, reach: 44, arc: 4.4, windup: 0.08, swing: 0.13, hold_: 0.08, recover: 0.32, cooldown: 0.95, parry: 0.2, knock: 180, stop: 0.07, color: 0xd6e8ff,
  },
  {
    id: 's_twinblade', kind: 'twinblade', name: '쌍날검', rarity: 'rare', price: 3800,
    desc: '양끝에 날이 달린 봉. 손안에서 회전시켜 앞을 갈아낸다.', hold: '두 손 · 손안 회전',
    dmg: 16, reach: 22, arc: Math.PI * 2, windup: 0.04, swing: 0.3, hold_: 0.02, recover: 0.18, cooldown: 0.7, parry: 0.22, knock: 90, stop: 0.035, color: 0xffb070,
  },
  {
    id: 's_whip', kind: 'whip', name: '사복검', rarity: 'epic', price: 8800,
    desc: '마디로 갈라진 칼날이 채찍처럼 뻗었다가 다시 맞물린다.', hold: '한 손 · 채찍 베기',
    dmg: 30, reach: 60, arc: 2.4, windup: 0.07, swing: 0.2, hold_: 0.05, recover: 0.26, cooldown: 0.85, parry: 0.18, knock: 120, stop: 0.055, color: 0x9ff0c8,
  },
  {
    id: 's_plasma', kind: 'plasma', name: '플라즈마 블레이드', rarity: 'legendary', price: 21500,
    desc: '평소엔 손잡이뿐. 벨 때만 빛의 날이 켜진다.', hold: '허리 · 점화 베기',
    dmg: 42, reach: 34, arc: 3.2, windup: 0.03, swing: 0.07, hold_: 0.04, recover: 0.2, cooldown: 0.42, parry: 0.22, knock: 120, stop: 0.05, color: 0x7af6ff,
  },
  // ---- second armoury ----
  {
    id: 's_tanto', kind: 'dagger', look: 'tanto', name: '탄토', rarity: 'common', price: 300,
    desc: '짧고 곧은 단도. 단검처럼 손안에서 돌리며 빠르게 벤다.', hold: '역수 · 손 안에서 돌리기',
    dmg: 13, reach: 22, arc: 2.0, windup: 0.025, swing: 0.07, hold_: 0.02, recover: 0.1, cooldown: 0.32, parry: 0.16, knock: 65, stop: 0.032, color: 0xe4e8f2,
  },
  {
    id: 's_gladius', kind: 'longsword', look: 'gladius', name: '글라디우스', rarity: 'common', price: 360,
    desc: '넓고 짧은 투사의 검. 롱소드보다 짧지만 묵직하다.', hold: '정수 · 좌우 연속 베기',
    dmg: 22, reach: 24, arc: 2.5, windup: 0.05, swing: 0.085, hold_: 0.03, recover: 0.18, cooldown: 0.42, parry: 0.17, knock: 130, stop: 0.05, color: 0xdfe6f0,
  },
  {
    id: 's_axe', kind: 'cleaver', look: 'axe', name: '전투 도끼', rarity: 'uncommon', price: 1150,
    desc: '도끼날로 높이 들어 내리찍는다. 치명타가 잘 나고 적을 크게 밀어낸다.', hold: '한 손 · 내려찍기',
    dmg: 34, reach: 23, arc: 1.6, windup: 0.09, swing: 0.065, hold_: 0.06, recover: 0.2, cooldown: 0.56, parry: 0.15, knock: 220, stop: 0.075, color: 0xc8ccd8,
  },
  {
    id: 's_halberd', kind: 'spear', look: 'halberd', name: '미늘창', rarity: 'rare', price: 3200,
    desc: '도끼날과 창끝을 함께 단 장병기. 장창보다 무겁고 강하다.', hold: '두 손 · 회전 후 찌르기',
    dmg: 34, reach: 50, arc: 0.6, windup: 0.15, swing: 0.065, hold_: 0.06, recover: 0.22, cooldown: 0.7, parry: 0.21, knock: 200, stop: 0.06, color: 0xd0d6e4,
  },
  {
    id: 's_hammer', kind: 'greatsword', look: 'hammer', name: '전쟁 망치', rarity: 'epic', price: 7200,
    desc: '쇠뭉치를 머리 위에서 내려친다. 맞은 적은 아주 멀리 날아간다.', hold: '어깨 걸침 · 양손 내려치기',
    dmg: 72, reach: 34, arc: 3.0, windup: 0.14, swing: 0.13, hold_: 0.06, recover: 0.34, cooldown: 1.0, parry: 0.22, knock: 460, stop: 0.11, color: 0xa8b0c4,
  },
  {
    id: 's_flamberge', kind: 'longsword', look: 'flamberge', name: '플랑베르주', rarity: 'epic', price: 8000,
    desc: '불꽃처럼 물결치는 칼날. 길고 날카로워 치명상을 남긴다.', hold: '정수 · 좌우 연속 베기',
    dmg: 38, reach: 34, arc: 2.8, windup: 0.055, swing: 0.1, hold_: 0.03, recover: 0.2, cooldown: 0.5, parry: 0.18, knock: 140, stop: 0.06, color: 0xffb070,
  },
  {
    id: 's_chainsword', kind: 'saber', look: 'chainsword', name: '체인소드', rarity: 'legendary', price: 18000,
    desc: '톱니가 쉴 새 없이 돈다. 한 번 휘두르면 왕복으로 갈아낸다.', hold: '한 손 · 왕복 베기',
    dmg: 26, reach: 28, arc: 2.4, windup: 0.04, swing: 0.15, hold_: 0.02, recover: 0.16, cooldown: 0.42, parry: 0.17, knock: 80, stop: 0.04, color: 0xff6a4a,
  },
  {
    id: 's_glaive', kind: 'scythe', look: 'glaive', name: '달빛 글레이브', rarity: 'legendary', price: 20000,
    desc: '초승달 같은 날을 단 장병기. 몸을 감아 돌며 주변을 벤다.', hold: '등 뒤 · 회전 베기',
    dmg: 50, reach: 44, arc: Math.PI * 2, windup: 0.08, swing: 0.25, hold_: 0.02, recover: 0.24, cooldown: 0.82, parry: 0.24, knock: 170, stop: 0.06, color: 0x9fd8ff,
  },
  {
    id: 's_void', kind: 'katana', look: 'voidblade', name: '공허의 검', rarity: 'mythic', price: 44000,
    desc: '벨 때마다 앞쪽 공간에 균열이 생겼다가 한 박자 뒤에 찢어지며 그 선 위의 적을 모두 벤다.', hold: '허리 칼집 · 발도술',
    dmg: 52, reach: 35, arc: 3.6, windup: 0.02, swing: 0.055, hold_: 0.14, recover: 0.28, cooldown: 0.62, parry: 0.2, knock: 150, stop: 0.07, color: 0xb08aff, wave: 0.9, waveKind: 'rift',
  },
  {
    id: 's_star', kind: 'plasma', look: 'starblade', name: '별의 검', rarity: 'transcendent', price: 90000,
    desc: '별빛으로 된 칼날. 벨 때마다 별 조각 세 개가 흩어졌다가 각자 적을 쫓아간다.', hold: '허리 · 점화 베기',
    dmg: 60, reach: 38, arc: 3.2, windup: 0.03, swing: 0.07, hold_: 0.04, recover: 0.2, cooldown: 0.4, parry: 0.24, knock: 140, stop: 0.06, color: 0xfff0a8, wave: 0.45, waveKind: 'stars',
  },
];

// ---------------- skins ----------------
export type SkinKind = 'flat' | 'checker' | 'stripe' | 'neon' | 'jelly' | 'gold' | 'lava' | 'galaxy' | 'prism';
export interface SkinDef {
  id: string;
  name: string;
  rarity: Rarity;
  price: number;
  kind: SkinKind;
  a: number;
  b: number;
  desc: string;
  starter?: boolean;
}

export const SKINS: SkinDef[] = [
  { id: 'k_basic', name: '기본 큐브', rarity: 'common', price: 0, kind: 'flat', a: 0xeeeef4, b: 0xa9aabb, desc: '기본 흰색 큐브.', starter: true },
  { id: 'k_mint', name: '민트 큐브', rarity: 'common', price: 160, kind: 'flat', a: 0x8ff0c8, b: 0x3fae8c, desc: '산뜻한 민트색.' },
  { id: 'k_coral', name: '코랄 큐브', rarity: 'common', price: 160, kind: 'flat', a: 0xff9a86, b: 0xc8594e, desc: '따뜻한 산호색.' },
  { id: 'k_slate', name: '슬레이트', rarity: 'common', price: 220, kind: 'flat', a: 0x7d8aa8, b: 0x48526d, desc: '차분한 돌 색.' },
  { id: 'k_checker', name: '체커보드', rarity: 'uncommon', price: 650, kind: 'checker', a: 0xf3f3f3, b: 0x2c2c38, desc: '흑백 바둑판 무늬.' },
  { id: 'k_stripe', name: '경고 줄무늬', rarity: 'uncommon', price: 720, kind: 'stripe', a: 0xffd23a, b: 0x262230, desc: '노랑과 검정의 사선 경고 무늬.' },
  { id: 'k_neon', name: '네온 프레임', rarity: 'rare', price: 1900, kind: 'neon', a: 0x3df2ff, b: 0x0d1424, desc: '빛나는 네온 테두리.' },
  { id: 'k_jelly', name: '젤리 큐브', rarity: 'rare', price: 2300, kind: 'jelly', a: 0xff6fb5, b: 0xa8327a, desc: '반투명하게 출렁이는 젤리 질감.' },
  { id: 'k_gold', name: '황금 큐브', rarity: 'epic', price: 5600, kind: 'gold', a: 0xffd25a, b: 0xb07a1c, desc: '표면에 빛이 흐르는 순금.' },
  { id: 'k_lava', name: '용암 코어', rarity: 'epic', price: 6200, kind: 'lava', a: 0xff7a1a, b: 0x2a1410, desc: '갈라진 틈으로 용암이 흐른다.' },
  { id: 'k_galaxy', name: '은하 큐브', rarity: 'legendary', price: 14500, kind: 'galaxy', a: 0x8a6bff, b: 0x120a2e, desc: '내부에서 별이 반짝인다.' },
  { id: 'k_prism', name: '프리즘', rarity: 'legendary', price: 16500, kind: 'prism', a: 0xffffff, b: 0x888888, desc: '무지갯빛으로 변하며 잔상을 남긴다.' },
  { id: 'k_crimson', name: '진홍 왕관', rarity: 'mythic', price: 38000, kind: 'gold', a: 0xff4a5e, b: 0x7a1020, desc: '피처럼 붉은 금속에 빛이 흐른다.' },
  { id: 'k_aurora', name: '오로라', rarity: 'transcendent', price: 75000, kind: 'galaxy', a: 0x7af6ff, b: 0x0a2a3a, desc: '극지의 하늘을 담은 큐브. 빛의 띠가 흐른다.' },
];

export const ENHANCE_MAX = 5;
export const ENHANCE_BONUS = 0.08;

// ---------------- in-run upgrades ----------------
export interface Mods {
  gunDmg: number;
  fireRate: number;
  reloadSpd: number;
  mag: number;
  pierce: number;
  crit: number;
  extra: number;
  ricochet: number;
  swordDmg: number;
  reach: number;
  swordCd: number;
  parryWin: number;
  parryWave: number;
  parryReload: number;
  speed: number;
  maxHp: number;
  regen: number;
  magnet: number;
  dashCd: number;
  goldMul: number;
}

export const baseMods = (): Mods => ({
  gunDmg: 1, fireRate: 1, reloadSpd: 1, mag: 1, pierce: 0, crit: 0, extra: 0, ricochet: 0,
  swordDmg: 1, reach: 1, swordCd: 1, parryWin: 0, parryWave: 0, parryReload: 0,
  speed: 1, maxHp: 100, regen: 0, magnet: 38, dashCd: 1, goldMul: 1,
});

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  max: number;
  tag: '총' | '검' | '몸';
  apply: (m: Mods) => void;
}

export const UPGRADES: Upgrade[] = [
  { id: 'gd', tag: '총', name: '강화 탄두', desc: '총 피해 +18%', max: 6, apply: (m) => (m.gunDmg += 0.18) },
  { id: 'fr', tag: '총', name: '가벼운 방아쇠', desc: '연사 속도 +14%', max: 5, apply: (m) => (m.fireRate += 0.14) },
  { id: 'rl', tag: '총', name: '빠른 손', desc: '재장전 속도 +18%', max: 4, apply: (m) => (m.reloadSpd += 0.18) },
  { id: 'mg', tag: '총', name: '확장 탄창', desc: '탄창 +30%', max: 4, apply: (m) => (m.mag += 0.3) },
  { id: 'pc', tag: '총', name: '철갑탄', desc: '관통 +1', max: 3, apply: (m) => (m.pierce += 1) },
  { id: 'cr', tag: '총', name: '급소 사격', desc: '치명타 확률 +8%', max: 4, apply: (m) => (m.crit += 0.08) },
  { id: 'ex', tag: '총', name: '쌍발 사격', desc: '한 번에 탄 +1발', max: 2, apply: (m) => (m.extra += 1) },
  { id: 'rc', tag: '총', name: '도탄', desc: '명중한 탄이 근처 적에게 도탄 +1', max: 3, apply: (m) => (m.ricochet += 1) },
  { id: 'sd', tag: '검', name: '숫돌', desc: '검 피해 +22%', max: 6, apply: (m) => (m.swordDmg += 0.22) },
  { id: 'sr', tag: '검', name: '긴 칼날', desc: '검 사거리 +12%', max: 4, apply: (m) => (m.reach += 0.12) },
  { id: 'sc', tag: '검', name: '검술 수련', desc: '검 쿨타임 -10%', max: 4, apply: (m) => (m.swordCd -= 0.1) },
  { id: 'pw', tag: '검', name: '간파', desc: '패리 판정 시간 +0.035초', max: 3, apply: (m) => (m.parryWin += 0.035) },
  { id: 'pv', tag: '검', name: '반격 파동', desc: '패리 성공 시 주변에 충격파', max: 3, apply: (m) => (m.parryWave += 1) },
  { id: 'pr', tag: '검', name: '패리 리로드', desc: '패리 성공 시 즉시 재장전 + 다음 3발 치명타', max: 1, apply: (m) => (m.parryReload = 1) },
  { id: 'mv', tag: '몸', name: '가벼운 발', desc: '이동 속도 +9%', max: 4, apply: (m) => (m.speed += 0.09) },
  { id: 'hp', tag: '몸', name: '단단한 몸', desc: '최대 체력 +25 (회복)', max: 5, apply: (m) => (m.maxHp += 25) },
  { id: 'rg', tag: '몸', name: '재생', desc: '초당 체력 +0.6 회복', max: 4, apply: (m) => (m.regen += 0.6) },
  { id: 'mn', tag: '몸', name: '자석', desc: '줍기 범위 +35%', max: 3, apply: (m) => (m.magnet *= 1.35) },
  { id: 'dc', tag: '몸', name: '순보', desc: '대시 쿨타임 -18%', max: 3, apply: (m) => (m.dashCd -= 0.18) },
  { id: 'gm', tag: '몸', name: '탐욕', desc: '골드 획득 +20%', max: 3, apply: (m) => (m.goldMul += 0.2) },
];

export const gunLook = (d: GunDef): GunLook => d.look ?? d.kind;
export const swordLook = (d: SwordDef): SwordLook => d.look ?? d.kind;

export const gunById = (id: string) => GUNS.find((g) => g.id === id) ?? GUNS[0];
export const swordById = (id: string) => SWORDS.find((s) => s.id === id) ?? SWORDS[0];
export const skinById = (id: string) => SKINS.find((s) => s.id === id) ?? SKINS[0];
