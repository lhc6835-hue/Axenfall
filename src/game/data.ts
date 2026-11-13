export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export const RARITY: Record<Rarity, { name: string; color: string; weight: number; stock: [number, number] }> = {
  common: { name: '일반', color: '#c9cbd6', weight: 52, stock: [2, 3] },
  uncommon: { name: '고급', color: '#5fdc84', weight: 27, stock: [1, 2] },
  rare: { name: '희귀', color: '#4aa8ff', weight: 13, stock: [1, 2] },
  epic: { name: '영웅', color: '#b672ff', weight: 6, stock: [1, 1] },
  legendary: { name: '전설', color: '#ffb32e', weight: 2, stock: [1, 1] },
};
export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// ---------------- guns ----------------
export type GunKind =
  | 'pistol' | 'revolver' | 'smg' | 'shotgun' | 'sniper' | 'minigun' | 'railgun'
  | 'derringer' | 'lever' | 'rifle' | 'laser' | 'dbarrel' | 'cannon' | 'musket' | 'launcher';

export interface GunDef {
  id: string;
  kind: GunKind;
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
    desc: '무난한 반자동 권총. 탄창을 털어내고 슬라이드를 당겨 장전해요.', hold: '한 손 · 슬라이드 장전',
    dmg: 8, rate: 3.2, mag: 12, reload: 1.05, range: 170, spread: 0.05, pellets: 1, pierce: 0, crit: 0.08, knock: 40, stop: 0.012, shake: 1.2, tracer: 0xffe9a8,
  },
  {
    id: 'g_revolver', kind: 'revolver', name: '황야의 리볼버', rarity: 'common', price: 380,
    desc: '6연발. 실린더를 털고 총을 두 바퀴 돌리며 장전해요. 치명타가 잘 터져요.', hold: '한 손 · 총 돌리기 장전',
    dmg: 17, rate: 2.1, mag: 6, reload: 1.25, range: 195, spread: 0.02, pellets: 1, pierce: 1, crit: 0.2, knock: 70, stop: 0.03, shake: 2.2, tracer: 0xffd27a,
  },
  {
    id: 'g_smg', kind: 'smg', name: '벌집 SMG', rarity: 'uncommon', price: 1250,
    desc: '탄을 비처럼 뿌려요. 옆으로 눕혀 긴 탄창을 갈아 끼워요.', hold: '한 손 · 옆으로 눕혀 사격',
    dmg: 5.5, rate: 11, mag: 34, reload: 1.45, range: 150, spread: 0.16, pellets: 1, pierce: 0, crit: 0.05, knock: 22, stop: 0.008, shake: 0.7, tracer: 0xfff3c4,
  },
  {
    id: 'g_shotgun', kind: 'shotgun', name: '펌프 액션 샷건', rarity: 'rare', price: 3300,
    desc: '산탄 7발. 쏠 때마다 펌프질, 장전은 한 발씩 쑤셔 넣어요.', hold: '두 손 · 펌프 액션',
    dmg: 7, rate: 1.35, mag: 6, reload: 0.32, range: 120, spread: 0.42, pellets: 7, pierce: 0, crit: 0.06, knock: 140, stop: 0.04, shake: 4, tracer: 0xffc070,
  },
  {
    id: 'g_sniper', kind: 'sniper', name: '볼트액션 롱보어', rarity: 'epic', price: 7800,
    desc: '일직선의 적을 꿰뚫어요. 매 발 노리쇠를 젖혀 탄피를 튕겨내요.', hold: '두 손 · 개머리판 견착',
    dmg: 62, rate: 0.95, mag: 5, reload: 2.0, range: 340, spread: 0, pellets: 1, pierce: 5, crit: 0.35, knock: 160, stop: 0.06, shake: 5, tracer: 0xffffff,
  },
  {
    id: 'g_minigun', kind: 'minigun', name: '회전포 MG-6', rarity: 'legendary', price: 17500,
    desc: '총열이 돌수록 빨라져요. 쏘는 동안은 조금 느려져요.', hold: '허리 견착 · 두 손잡이',
    dmg: 6.5, rate: 24, mag: 180, reload: 2.8, range: 175, spread: 0.18, pellets: 1, pierce: 0, crit: 0.06, knock: 26, stop: 0.006, shake: 0.9, tracer: 0xffe18a,
  },
  {
    id: 'g_railgun', kind: 'railgun', name: '아크 레일건', rarity: 'legendary', price: 26000,
    desc: '충전 후 모든 것을 관통하는 전자기 빔. 배터리를 뽑아 증기를 빼요.', hold: '두 손 · 충전 사격',
    dmg: 130, rate: 0.75, mag: 4, reload: 2.3, range: 420, spread: 0, pellets: 1, pierce: 999, crit: 0.2, knock: 220, stop: 0.08, shake: 7, tracer: 0x8ff3ff,
  },
  {
    id: 'g_derringer', kind: 'derringer', name: '포켓 데린저', rarity: 'common', price: 260,
    desc: '손바닥만 한 2연발. 총신을 위로 꺾어 두 발을 엄지로 밀어 넣어요.', hold: '한 손 · 손바닥에 숨기기',
    dmg: 15, rate: 3.6, mag: 2, reload: 0.7, range: 120, spread: 0.06, pellets: 1, pierce: 0, crit: 0.28, knock: 50, stop: 0.02, shake: 1.4, tracer: 0xffe0b0,
  },
  {
    id: 'g_lever', kind: 'lever', name: '레버액션 카빈', rarity: 'uncommon', price: 1400,
    desc: '쏠 때마다 총을 한 바퀴 돌려 레버를 당겨요. 장전은 옆구리 게이트로 한 발씩.', hold: '한 손 · 스핀콕',
    dmg: 24, rate: 1.6, mag: 8, reload: 0.26, range: 220, spread: 0.02, pellets: 1, pierce: 1, crit: 0.15, knock: 90, stop: 0.03, shake: 2.4, tracer: 0xffd890,
  },
  {
    id: 'g_rifle', kind: 'rifle', name: '3점사 소총', rarity: 'uncommon', price: 1650,
    desc: '방아쇠 한 번에 세 발. 탄창을 갈고 바닥을 툭 쳐서 확인해요.', hold: '두 손 · 견착 점사',
    dmg: 9.5, rate: 2.3, mag: 30, reload: 1.55, range: 210, spread: 0.05, pellets: 1, pierce: 0, crit: 0.08, knock: 35, stop: 0.012, shake: 1.2, tracer: 0xfff0b8, burst: 3,
  },
  {
    id: 'g_dbarrel', kind: 'dbarrel', name: '소드오프 쌍발', rarity: 'rare', price: 3100,
    desc: '짧게 자른 쌍발 산탄. 총신을 꺾어 탄피를 튕기고 손목으로 탁 닫아요.', hold: '한 손 · 중절식',
    dmg: 8, rate: 2.2, mag: 2, reload: 0.95, range: 95, spread: 0.6, pellets: 8, pierce: 0, crit: 0.05, knock: 200, stop: 0.045, shake: 4.5, tracer: 0xffb860,
  },
  {
    id: 'g_laser', kind: 'laser', name: '광자 블래스터', rarity: 'rare', price: 3700,
    desc: '탄창 없음. 계속 쏘면 과열돼서 냉각판을 열고 증기를 뿜어요.', hold: '한 손 · 과열 냉각',
    dmg: 9, rate: 7, mag: 24, reload: 1.3, range: 200, spread: 0.04, pellets: 1, pierce: 1, crit: 0.1, knock: 30, stop: 0.01, shake: 0.8, tracer: 0xff6ad8, heat: true,
  },
  {
    id: 'g_cannon', kind: 'cannon', name: '핸드 캐논 .50', rarity: 'epic', price: 8200,
    desc: '대구경 권총. 쏠 때마다 총구가 하늘로 튀어 올라요.', hold: '한 손 · 대구경',
    dmg: 78, rate: 1.1, mag: 7, reload: 1.4, range: 240, spread: 0.01, pellets: 1, pierce: 2, crit: 0.3, knock: 260, stop: 0.07, shake: 6, tracer: 0xffe8a0,
  },
  {
    id: 'g_musket', kind: 'musket', name: '플린트락 머스킷', rarity: 'epic', price: 7400,
    desc: '부싯돌이 칙 하고 튄 다음 펑. 꽂을대로 화약을 다져 넣어요.', hold: '두 손 · 꽂을대 장전',
    dmg: 150, rate: 0.6, mag: 1, reload: 2.1, range: 300, spread: 0, pellets: 1, pierce: 3, crit: 0.25, knock: 300, stop: 0.09, shake: 7, tracer: 0xfff4d8,
  },
  {
    id: 'g_launcher', kind: 'launcher', name: '회전식 유탄발사기', rarity: 'legendary', price: 21500,
    desc: '맞은 곳이 폭발해요. 드럼 탄창이 한 칸씩 돌아가요.', hold: '두 손 · 허리 견착',
    dmg: 70, rate: 1.15, mag: 6, reload: 0.34, range: 210, spread: 0.02, pellets: 1, pierce: 0, crit: 0.05, knock: 120, stop: 0.07, shake: 6, tracer: 0xffa040, splash: 38,
  },
];

// ---------------- swords ----------------
export type SwordKind =
  | 'dagger' | 'longsword' | 'rapier' | 'katana' | 'greatsword' | 'scythe'
  | 'saber' | 'cleaver' | 'katar' | 'spear' | 'nodachi' | 'twinblade' | 'whip' | 'plasma';

export interface SwordDef {
  id: string;
  kind: SwordKind;
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
    desc: '역수로 쥐고 손안에서 빙글빙글 돌려요. 빠르지만 짧아요.', hold: '역수 · 손 안에서 돌리기',
    dmg: 11, reach: 21, arc: 2.0, windup: 0.025, swing: 0.07, hold_: 0.02, recover: 0.1, cooldown: 0.3, parry: 0.15, knock: 60, stop: 0.03, color: 0xd9dde8,
  },
  {
    id: 's_longsword', kind: 'longsword', name: '기사의 롱소드', rarity: 'common', price: 320,
    desc: '좌우로 번갈아 크게 베요. 표준적인 패리 판정.', hold: '정수 · 좌우 연속 베기',
    dmg: 19, reach: 27, arc: 2.6, windup: 0.05, swing: 0.09, hold_: 0.03, recover: 0.18, cooldown: 0.42, parry: 0.17, knock: 110, stop: 0.045, color: 0xe8eef7,
  },
  {
    id: 's_rapier', kind: 'rapier', name: '은빛 레이피어', rarity: 'uncommon', price: 1100,
    desc: '앞으로 길게 찔러요. 패리 판정이 가장 넉넉해요.', hold: '앙가르드 · 찌르기',
    dmg: 17, reach: 38, arc: 0.8, windup: 0.05, swing: 0.05, hold_: 0.05, recover: 0.13, cooldown: 0.3, parry: 0.24, knock: 80, stop: 0.04, color: 0xf2f4ff,
  },
  {
    id: 's_katana', kind: 'katana', name: '월광 카타나', rarity: 'rare', price: 2700,
    desc: '칼집에서 뽑으며 한 번에 크게 베고, 천천히 칼집에 되돌려요.', hold: '허리 칼집 · 발도술',
    dmg: 36, reach: 33, arc: 3.6, windup: 0.02, swing: 0.055, hold_: 0.14, recover: 0.3, cooldown: 0.62, parry: 0.19, knock: 130, stop: 0.065, color: 0xcfe8ff,
  },
  {
    id: 's_greatsword', kind: 'greatsword', name: '파성 대검', rarity: 'epic', price: 6900,
    desc: '어깨에 걸쳤다가 크게 뒤로 젖혀 내려쳐요. 맞으면 날아가요.', hold: '어깨 걸침 · 양손 내려치기',
    dmg: 64, reach: 39, arc: 3.4, windup: 0.13, swing: 0.13, hold_: 0.05, recover: 0.32, cooldown: 0.95, parry: 0.22, knock: 300, stop: 0.09, color: 0xb9c3d6,
  },
  {
    id: 's_scythe', kind: 'scythe', name: '사신의 낫', rarity: 'legendary', price: 19500,
    desc: '몸을 한 바퀴 휘감아 주변 전부를 베어요. 패리도 모든 방향.', hold: '등 뒤 · 회전 베기',
    dmg: 46, reach: 42, arc: Math.PI * 2, windup: 0.08, swing: 0.26, hold_: 0.02, recover: 0.25, cooldown: 0.85, parry: 0.24, knock: 160, stop: 0.06, color: 0xc49bff,
  },
  {
    id: 's_saber', kind: 'saber', name: '기병 세이버', rarity: 'common', price: 280,
    desc: '한 번 휘두를 때 갔다가 돌아오며 두 번 베어요.', hold: '한 손 · 왕복 베기',
    dmg: 12, reach: 25, arc: 2.2, windup: 0.04, swing: 0.16, hold_: 0.02, recover: 0.16, cooldown: 0.46, parry: 0.16, knock: 70, stop: 0.035, color: 0xe4ecf6,
  },
  {
    id: 's_cleaver', kind: 'cleaver', name: '정육 클리버', rarity: 'common', price: 340,
    desc: '높이 들었다가 묵직하게 내려찍어요. 치명타가 잘 나요.', hold: '한 손 · 내려찍기',
    dmg: 27, reach: 20, arc: 1.5, windup: 0.09, swing: 0.06, hold_: 0.06, recover: 0.2, cooldown: 0.52, parry: 0.14, knock: 160, stop: 0.07, color: 0xc8ccd6,
  },
  {
    id: 's_katar', kind: 'katar', name: '카타르', rarity: 'uncommon', price: 950,
    desc: '주먹에 끼운 단검. 빠르게 세 번 찔러요.', hold: '주먹 · 연속 찌르기',
    dmg: 9, reach: 23, arc: 0.7, windup: 0.03, swing: 0.18, hold_: 0.02, recover: 0.1, cooldown: 0.36, parry: 0.2, knock: 45, stop: 0.025, color: 0xf0e0c0,
  },
  {
    id: 's_spear', kind: 'spear', name: '장창', rarity: 'uncommon', price: 1300,
    desc: '창을 한 바퀴 돌려 기세를 모은 다음 길게 찔러요. 일직선을 꿰뚫어요.', hold: '두 손 · 회전 후 찌르기',
    dmg: 23, reach: 48, arc: 0.5, windup: 0.14, swing: 0.06, hold_: 0.06, recover: 0.2, cooldown: 0.62, parry: 0.2, knock: 140, stop: 0.05, color: 0xd8dce8,
  },
  {
    id: 's_nodachi', kind: 'nodachi', name: '노다치', rarity: 'rare', price: 3400,
    desc: '등에 멘 긴 칼을 어깨 너머로 뽑아 크게 휩쓸어요.', hold: '등 · 어깨 너머 발도',
    dmg: 40, reach: 44, arc: 4.4, windup: 0.08, swing: 0.13, hold_: 0.08, recover: 0.32, cooldown: 0.95, parry: 0.2, knock: 180, stop: 0.07, color: 0xd6e8ff,
  },
  {
    id: 's_twinblade', kind: 'twinblade', name: '쌍날검', rarity: 'rare', price: 3800,
    desc: '양끝에 날이 달린 봉을 손에서 빙빙 돌려 앞을 갈아버려요.', hold: '두 손 · 손안 회전',
    dmg: 16, reach: 22, arc: Math.PI * 2, windup: 0.04, swing: 0.3, hold_: 0.02, recover: 0.18, cooldown: 0.7, parry: 0.22, knock: 90, stop: 0.035, color: 0xffb070,
  },
  {
    id: 's_whip', kind: 'whip', name: '사복검', rarity: 'epic', price: 8800,
    desc: '칼날이 마디로 갈라져 채찍처럼 뻗었다가 다시 붙어요.', hold: '한 손 · 채찍 베기',
    dmg: 30, reach: 60, arc: 2.4, windup: 0.07, swing: 0.2, hold_: 0.05, recover: 0.26, cooldown: 0.85, parry: 0.18, knock: 120, stop: 0.055, color: 0x9ff0c8,
  },
  {
    id: 's_plasma', kind: 'plasma', name: '플라즈마 블레이드', rarity: 'legendary', price: 21500,
    desc: '평소엔 손잡이뿐. 벨 때 빛의 날이 켜졌다가 꺼져요.', hold: '허리 · 점화 베기',
    dmg: 42, reach: 34, arc: 3.2, windup: 0.03, swing: 0.07, hold_: 0.04, recover: 0.2, cooldown: 0.42, parry: 0.22, knock: 120, stop: 0.05, color: 0x7af6ff,
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
  { id: 'k_basic', name: '기본 큐브', rarity: 'common', price: 0, kind: 'flat', a: 0xeeeef4, b: 0xa9aabb, desc: '평범한 하얀 네모.', starter: true },
  { id: 'k_mint', name: '민트 큐브', rarity: 'common', price: 160, kind: 'flat', a: 0x8ff0c8, b: 0x3fae8c, desc: '상큼한 민트색.' },
  { id: 'k_coral', name: '코랄 큐브', rarity: 'common', price: 160, kind: 'flat', a: 0xff9a86, b: 0xc8594e, desc: '따뜻한 산호색.' },
  { id: 'k_slate', name: '슬레이트', rarity: 'common', price: 220, kind: 'flat', a: 0x7d8aa8, b: 0x48526d, desc: '차분한 돌 색.' },
  { id: 'k_checker', name: '체커보드', rarity: 'uncommon', price: 650, kind: 'checker', a: 0xf3f3f3, b: 0x2c2c38, desc: '흑백 바둑판 무늬.' },
  { id: 'k_stripe', name: '경고 줄무늬', rarity: 'uncommon', price: 720, kind: 'stripe', a: 0xffd23a, b: 0x262230, desc: '공사장 느낌 사선 줄무늬.' },
  { id: 'k_neon', name: '네온 프레임', rarity: 'rare', price: 1900, kind: 'neon', a: 0x3df2ff, b: 0x0d1424, desc: '빛나는 네온 테두리.' },
  { id: 'k_jelly', name: '젤리 큐브', rarity: 'rare', price: 2300, kind: 'jelly', a: 0xff6fb5, b: 0xa8327a, desc: '말랑말랑 반투명하게 출렁여요.' },
  { id: 'k_gold', name: '황금 큐브', rarity: 'epic', price: 5600, kind: 'gold', a: 0xffd25a, b: 0xb07a1c, desc: '빛이 스윽 지나가는 순금.' },
  { id: 'k_lava', name: '용암 코어', rarity: 'epic', price: 6200, kind: 'lava', a: 0xff7a1a, b: 0x2a1410, desc: '갈라진 틈으로 용암이 흘러요.' },
  { id: 'k_galaxy', name: '은하 큐브', rarity: 'legendary', price: 14500, kind: 'galaxy', a: 0x8a6bff, b: 0x120a2e, desc: '안에서 별이 반짝여요.' },
  { id: 'k_prism', name: '프리즘', rarity: 'legendary', price: 16500, kind: 'prism', a: 0xffffff, b: 0x888888, desc: '무지갯빛으로 변하며 잔상을 남겨요.' },
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
  { id: 'rc', tag: '총', name: '도탄', desc: '맞은 탄이 근처 적에게 튕겨요 +1', max: 3, apply: (m) => (m.ricochet += 1) },
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

export const gunById = (id: string) => GUNS.find((g) => g.id === id) ?? GUNS[0];
export const swordById = (id: string) => SWORDS.find((s) => s.id === id) ?? SWORDS[0];
export const skinById = (id: string) => SKINS.find((s) => s.id === id) ?? SKINS[0];
