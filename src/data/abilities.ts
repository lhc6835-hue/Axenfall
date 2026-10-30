import type { Grade } from '../core/const';

export type SkillKind = 'skill' | 'ult';

export interface SkillDef {
  id: string;
  ability: string;
  name: string;
  kind: SkillKind;
  cd: number; // seconds (ult: gauge cost instead, cd ignored)
  power: number; // multiplier shown in UI
  desc: string;
}

export interface AbilityDef {
  id: string;
  name: string;
  en: string;
  grade: Grade;
  body: number; // hero body color while equipped
  fx: number; // primary effect color
  fx2: number; // secondary effect color
  basicName: string;
  basicDesc: string;
  skills: [string, string];
  ult: string;
  lore: string;
}

export const ABILITIES: AbilityDef[] = [
  {
    id: 'blade', name: '블레이드', en: 'BLADE', grade: 'N', body: 0xd9e4f2, fx: 0x8fe6ff, fx2: 0xffffff,
    basicName: '삼연참', basicDesc: '빠른 3연속 베기. 마지막 타격은 적을 밀쳐낸다.',
    skills: ['blade_dash', 'blade_whirl'], ult: 'blade_ult',
    lore: '모든 상자는 처음에 칼 한 자루로 시작한다.',
  },
  {
    id: 'flame', name: '플레임', en: 'FLAME', grade: 'R', body: 0xff7b3a, fx: 0xff9a2e, fx2: 0xfff06a,
    basicName: '화염권', basicDesc: '불꽃 주먹 3연타. 마지막 타격이 폭발한다.',
    skills: ['flame_ball', 'flame_pillar'], ult: 'flame_ult',
    lore: '네모난 몸 속에 작은 태양이 들어 있다.',
  },
  {
    id: 'frost', name: '프로스트', en: 'FROST', grade: 'R', body: 0x8fd8ff, fx: 0xaef4ff, fx2: 0x4f9dff,
    basicName: '얼음 파편', basicDesc: '얼음 조각을 연속으로 던진다. 원거리 공격.',
    skills: ['frost_lance', 'frost_nova'], ult: 'frost_ult',
    lore: '숨을 내쉴 때마다 공기가 얼어붙는다.',
  },
  {
    id: 'volt', name: '볼트', en: 'VOLT', grade: 'SR', body: 0xffe45c, fx: 0xfff27a, fx2: 0x6ae8ff,
    basicName: '전격 연타', basicDesc: '번개처럼 빠른 4연타. 타격 시 전기가 튄다.',
    skills: ['volt_chain', 'volt_dash'], ult: 'volt_ult',
    lore: '한 번 움직이면 천둥이 뒤늦게 따라온다.',
  },
  {
    id: 'gale', name: '게일', en: 'GALE', grade: 'SR', body: 0x7fffb8, fx: 0xb8ffe0, fx2: 0x3fd4a0,
    basicName: '바람 칼날', basicDesc: '중거리까지 닿는 바람 칼날을 날린다.',
    skills: ['gale_tornado', 'gale_rise'], ult: 'gale_ult',
    lore: '발이 짧아도 바람을 타면 누구보다 빠르다.',
  },
  {
    id: 'shadow', name: '섀도우', en: 'SHADOW', grade: 'SSR', body: 0x6a4bb8, fx: 0xc08aff, fx2: 0xff4f7a,
    basicName: '쌍단검', basicDesc: '눈에 보이지 않는 4연속 단검 공격. 치명타율이 높다.',
    skills: ['shadow_star', 'shadow_strike'], ult: 'shadow_ult',
    lore: '그림자 속에서 두 개의 눈만 빛난다.',
  },
  {
    id: 'star', name: '스타폴', en: 'STARFALL', grade: 'SSR', body: 0xffd36e, fx: 0xffe9a8, fx2: 0xff8ad8,
    basicName: '별빛 탄환', basicDesc: '적을 추적하는 별빛 탄환을 발사한다.',
    skills: ['star_meteor', 'star_const'], ult: 'star_ult',
    lore: '밤하늘에서 떨어진 별을 삼킨 상자.',
  },
  {
    id: 'void', name: '보이드', en: 'VOID', grade: 'UR', body: 0x1c1430, fx: 0xff3df0, fx2: 0x3dfff0,
    basicName: '공간 찢기', basicDesc: '공간 자체를 할퀴어 찢는다. 방어를 무시한다.',
    skills: ['void_hole', 'void_cut'], ult: 'void_ult',
    lore: '상자의 안쪽은 우주보다 넓다.',
  },
];

export const SKILLS: SkillDef[] = [
  { id: 'blade_dash', ability: 'blade', name: '질풍참', kind: 'skill', cd: 5, power: 2.2, desc: '전방으로 돌진하며 경로상의 모든 적을 벤다. 돌진 중 무적.' },
  { id: 'blade_whirl', ability: 'blade', name: '회전베기', kind: 'skill', cd: 7, power: 0.7, desc: '칼을 휘두르며 회전해 주변 적을 6회 연속 벤다.' },
  { id: 'blade_ult', ability: 'blade', name: '천검난무', kind: 'ult', cd: 0, power: 9, desc: '시간이 멈춘 사이 수십 번의 참격을 새긴 뒤 한 번에 터뜨린다.' },

  { id: 'flame_ball', ability: 'flame', name: '화염구', kind: 'skill', cd: 4, power: 2.4, desc: '거대한 화염구를 던진다. 명중 시 주변에 폭발 피해.' },
  { id: 'flame_pillar', ability: 'flame', name: '불기둥', kind: 'skill', cd: 8, power: 1.6, desc: '전방으로 불기둥이 3단계로 솟구치며 적을 띄운다.' },
  { id: 'flame_ult', ability: 'flame', name: '태양 낙하', kind: 'ult', cd: 0, power: 10, desc: '하늘에서 작은 태양을 떨어뜨려 화면 전체를 불태운다.' },

  { id: 'frost_lance', ability: 'frost', name: '빙결창', kind: 'skill', cd: 5, power: 2.6, desc: '적을 관통하는 얼음창. 맞은 적은 잠시 둔화된다.' },
  { id: 'frost_nova', ability: 'frost', name: '서리 결계', kind: 'skill', cd: 10, power: 1.4, desc: '주변을 얼려 적을 1.6초 동안 빙결시킨다.' },
  { id: 'frost_ult', ability: 'frost', name: '절대영도', kind: 'ult', cd: 0, power: 8, desc: '화면 전체에 눈보라를 일으켜 연속 피해 후 모두 얼려 부순다.' },

  { id: 'volt_chain', ability: 'volt', name: '연쇄 번개', kind: 'skill', cd: 6, power: 2.0, desc: '가장 가까운 적부터 최대 6명에게 번개가 튀어 다닌다.' },
  { id: 'volt_dash', ability: 'volt', name: '뇌신 섬광', kind: 'skill', cd: 5, power: 2.4, desc: '번개가 되어 순간이동하고 지나간 자리에 낙뢰가 떨어진다.' },
  { id: 'volt_ult', ability: 'volt', name: '천둥 심판', kind: 'ult', cd: 0, power: 9.5, desc: '모든 적에게 거대한 낙뢰가 연속으로 내리꽂힌다.' },

  { id: 'gale_tornado', ability: 'gale', name: '회오리', kind: 'skill', cd: 7, power: 0.5, desc: '적을 빨아들이며 전진하는 회오리를 날린다.' },
  { id: 'gale_rise', ability: 'gale', name: '돌풍 도약', kind: 'skill', cd: 5, power: 2.0, desc: '상승 기류로 주변 적을 높이 띄우고 함께 솟구친다.' },
  { id: 'gale_ult', ability: 'gale', name: '폭풍의 눈', kind: 'ult', cd: 0, power: 9, desc: '거대한 폭풍을 만들어 모든 적을 중심으로 끌어당겨 갈아버린다.' },

  { id: 'shadow_star', ability: 'shadow', name: '그림자 표창', kind: 'skill', cd: 4, power: 1.5, desc: '부채꼴로 표창 5개를 던진다. 표창은 적을 관통한다.' },
  { id: 'shadow_strike', ability: 'shadow', name: '암영 습격', kind: 'skill', cd: 6, power: 3.2, desc: '가장 가까운 적의 등 뒤로 순간이동해 확정 치명타를 넣는다.' },
  { id: 'shadow_ult', ability: 'shadow', name: '월식', kind: 'ult', cd: 0, power: 10, desc: '붉은 달이 뜨고 그림자 분신들이 모든 적을 난도질한다.' },

  { id: 'star_meteor', ability: 'star', name: '유성우', kind: 'skill', cd: 8, power: 1.2, desc: '전방에 유성 8개를 쏟아붓는다.' },
  { id: 'star_const', ability: 'star', name: '별자리 결계', kind: 'skill', cd: 9, power: 3.0, desc: '주변 적들을 별자리로 이은 뒤 한꺼번에 폭발시킨다.' },
  { id: 'star_ult', ability: 'star', name: '초신성', kind: 'ult', cd: 0, power: 11, desc: '별 하나를 붕괴시켜 거대한 폭발을 일으킨다.' },

  { id: 'void_hole', ability: 'void', name: '블랙홀', kind: 'skill', cd: 10, power: 0.45, desc: '모든 것을 빨아들이는 블랙홀을 만든 뒤 붕괴시킨다.' },
  { id: 'void_cut', ability: 'void', name: '차원 절단', kind: 'skill', cd: 6, power: 3.5, desc: '화면을 가로지르는 균열을 새기고 잠시 후 공간째로 벤다.' },
  { id: 'void_ult', ability: 'void', name: '종언', kind: 'ult', cd: 0, power: 13, desc: '세계의 색을 뒤집고 모든 것을 무(無)로 되돌린다.' },
];

export const abilityById = (id: string) => ABILITIES.find((a) => a.id === id)!;
export const skillById = (id: string) => SKILLS.find((s) => s.id === id)!;

export const GRADE_POWER: Record<Grade, number> = { N: 1, R: 1.12, SR: 1.27, SSR: 1.44, UR: 1.65 };
export const MAX_STAR = 5;
export const MAX_LEVEL = 20;
export const shardsForStar = (star: number) => [0, 1, 2, 3, 5][star] ?? 99; // dupes needed to go star -> star+1
export const levelCost = (lv: number) => Math.floor(120 * Math.pow(1.22, lv - 1));

export function abilityPower(grade: Grade, level: number, star: number) {
  return GRADE_POWER[grade] * (1 + 0.07 * (level - 1)) * (1 + 0.14 * (star - 1));
}
