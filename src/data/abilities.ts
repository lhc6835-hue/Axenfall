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
  {
    id: 'stone', name: '스톤', en: 'STONE', grade: 'N', body: 0xa8a090, fx: 0xc8b89a, fx2: 0x8a7a60,
    basicName: '바위 주먹', basicDesc: '느리지만 묵직한 2연타. 두 번째 주먹은 땅을 울린다.',
    skills: ['stone_throw', 'stone_quake'], ult: 'stone_ult',
    lore: '굴러다니다 보니 단단해졌다.',
  },
  {
    id: 'bubble', name: '버블', en: 'BUBBLE', grade: 'N', body: 0x9ae0ff, fx: 0xbff0ff, fx2: 0x6ab8ff,
    basicName: '방울 탄', basicDesc: '둥실 떠가는 물방울을 쏜다. 맞으면 톡 터진다.',
    skills: ['bubble_jail', 'bubble_splash'], ult: 'bubble_ult',
    lore: '말을 할 때마다 방울이 나온다.',
  },
  {
    id: 'vine', name: '바인', en: 'VINE', grade: 'R', body: 0x6cc85a, fx: 0x8de05a, fx2: 0xd8f0a0,
    basicName: '덩굴 채찍', basicDesc: '긴 덩굴로 중거리를 후려친다.',
    skills: ['vine_roots', 'vine_drain'], ult: 'vine_ult',
    lore: '물만 주면 하루 종일 가만히 있는다.',
  },
  {
    id: 'iron', name: '아이언', en: 'IRON', grade: 'R', body: 0x8a96a8, fx: 0xd8e4f0, fx2: 0x6a7a90,
    basicName: '방패 치기', basicDesc: '방패로 밀어붙이는 3연타. 적을 크게 밀쳐낸다.',
    skills: ['iron_charge', 'iron_parry'], ult: 'iron_ult',
    lore: '네모는 원래 방패 모양이다.',
  },
  {
    id: 'poison', name: '포이즌', en: 'POISON', grade: 'R', body: 0xa86ad8, fx: 0xb8ff6a, fx2: 0x8a3ab8,
    basicName: '독침', basicDesc: '맞은 적에게 독을 남기는 침을 쏜다.',
    skills: ['poison_cloud', 'poison_fan'], ult: 'poison_ult',
    lore: '본인은 독이 있는 줄 모른다.',
  },
  {
    id: 'sonic', name: '소닉', en: 'SONIC', grade: 'SR', body: 0xffa8d8, fx: 0xffd0ec, fx2: 0x8ad8ff,
    basicName: '음파탄', basicDesc: '퍼져 나가는 음파 고리를 쏜다. 여러 적을 관통한다.',
    skills: ['sonic_boom', 'sonic_mark'], ult: 'sonic_ult',
    lore: '"아—" 하고 소리를 지르면 땅이 흔들린다.',
  },
  {
    id: 'crystal', name: '크리스탈', en: 'CRYSTAL', grade: 'SR', body: 0xc8b0ff, fx: 0xe8d8ff, fx2: 0x6ae8ff,
    basicName: '수정 베기', basicDesc: '수정 칼날 3연격. 마지막 타격에서 파편이 튄다.',
    skills: ['crystal_spikes', 'crystal_ray'], ult: 'crystal_ult',
    lore: '빛을 받으면 무지개 색으로 반짝인다.',
  },
  {
    id: 'magma', name: '마그마', en: 'MAGMA', grade: 'SR', body: 0xd84a2a, fx: 0xff7a2a, fx2: 0xffd04a,
    basicName: '용암 주먹', basicDesc: '맞은 자리에 잠시 용암 웅덩이를 남긴다.',
    skills: ['magma_geyser', 'magma_bombs'], ult: 'magma_ult',
    lore: '안아 주면 따뜻하다. 아주 많이.',
  },
  {
    id: 'chrono', name: '크로노', en: 'CHRONO', grade: 'SSR', body: 0xe8d8a0, fx: 0xffe08a, fx2: 0x6ad8ff,
    basicName: '시침 베기', basicDesc: '시곗바늘 칼날로 빠르게 4연타.',
    skills: ['chrono_stop', 'chrono_rewind'], ult: 'chrono_ult',
    lore: '항상 5분 늦는다.',
  },
  {
    id: 'dragon', name: '드래곤', en: 'DRAGON', grade: 'SSR', body: 0x3ab87a, fx: 0xff8a3a, fx2: 0xffe04a,
    basicName: '용조', basicDesc: '용의 발톱으로 3번 할퀸다. 마지막 타격에 불꽃이 인다.',
    skills: ['dragon_breath', 'dragon_dive'], ult: 'dragon_ult',
    lore: '자기가 용이라고 굳게 믿고 있다.',
  },
  {
    id: 'light', name: '라이트', en: 'LIGHT', grade: 'UR', body: 0xfff4d8, fx: 0xfff0a0, fx2: 0xffffff,
    basicName: '빛의 창', basicDesc: '빛의 창을 날린다. 관통하며 방어를 무시한다.',
    skills: ['light_sanctum', 'light_spear'], ult: 'light_ult',
    lore: '눈을 뜨면 주변이 밝아진다. 감으면 어두워진다.',
  },
  {
    id: 'chaos', name: '카오스', en: 'CHAOS', grade: 'UR', body: 0x3a2a4a, fx: 0xff4a8a, fx2: 0x4affd8,
    basicName: '혼돈 연격', basicDesc: '때릴 때마다 불·얼음·번개 속성이 무작위로 바뀐다.',
    skills: ['chaos_orb', 'chaos_entropy'], ult: 'chaos_ult',
    lore: '무슨 생각을 하는지 아무도 모른다. 본인도.',
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

  { id: 'stone_throw', ability: 'stone', name: '바위 던지기', kind: 'skill', cd: 4, power: 2.6, desc: '큰 바위를 포물선으로 던진다. 떨어진 자리에 파편이 튄다.' },
  { id: 'stone_quake', ability: 'stone', name: '대지 강타', kind: 'skill', cd: 7, power: 1.8, desc: '땅을 내리쳐 양쪽으로 지진파를 보낸다.' },
  { id: 'stone_ult', ability: 'stone', name: '산사태', kind: 'ult', cd: 0, power: 8, desc: '하늘에서 거대한 바위들이 쏟아진다.' },

  { id: 'bubble_jail', ability: 'bubble', name: '방울 감옥', kind: 'skill', cd: 7, power: 1.2, desc: '큰 방울에 적을 가둬 2초 동안 띄운다.' },
  { id: 'bubble_splash', ability: 'bubble', name: '물보라', kind: 'skill', cd: 5, power: 2.0, desc: '앞으로 물결을 일으켜 적을 밀어낸다.' },
  { id: 'bubble_ult', ability: 'bubble', name: '해일', kind: 'ult', cd: 0, power: 8, desc: '화면을 쓸어버리는 거대한 파도를 부른다.' },

  { id: 'vine_roots', ability: 'vine', name: '가시 덩굴', kind: 'skill', cd: 6, power: 1.4, desc: '앞쪽 땅에서 가시 덩굴이 연달아 솟는다.' },
  { id: 'vine_drain', ability: 'vine', name: '흡수', kind: 'skill', cd: 12, power: 1.6, desc: '주변 적의 생명력을 빨아들여 체력을 회복한다.' },
  { id: 'vine_ult', ability: 'vine', name: '대삼림', kind: 'ult', cd: 0, power: 8.5, desc: '거목들이 땅을 뚫고 솟아 모든 적을 찌르고 체력을 회복한다.' },

  { id: 'iron_charge', ability: 'iron', name: '방패 돌진', kind: 'skill', cd: 5, power: 2.2, desc: '방패를 앞세워 돌진한다. 돌진 중 무적.' },
  { id: 'iron_parry', ability: 'iron', name: '반격 태세', kind: 'skill', cd: 6, power: 4.0, desc: '1초 동안 받아치기 자세. 공격받으면 무효화하고 강하게 반격한다.' },
  { id: 'iron_ult', ability: 'iron', name: '강철 요새', kind: 'ult', cd: 0, power: 9, desc: '거대한 강철 방패를 연달아 내리찍고, 잠시 무적이 된다.' },

  { id: 'poison_cloud', ability: 'poison', name: '독구름', kind: 'skill', cd: 8, power: 0.35, desc: '오래 남는 독구름을 퍼뜨린다.' },
  { id: 'poison_fan', ability: 'poison', name: '독침 세례', kind: 'skill', cd: 5, power: 0.9, desc: '독침 7개를 부채꼴로 날린다.' },
  { id: 'poison_ult', ability: 'poison', name: '역병', kind: 'ult', cd: 0, power: 9, desc: '화면 안의 모든 적에게 맹독을 퍼뜨린다.' },

  { id: 'sonic_boom', ability: 'sonic', name: '음파 폭발', kind: 'skill', cd: 6, power: 2.0, desc: '주변으로 음파를 터뜨려 적을 날려 보낸다.' },
  { id: 'sonic_mark', ability: 'sonic', name: '공명', kind: 'skill', cd: 7, power: 3.0, desc: '가까운 적들에게 진동을 새긴 뒤 한꺼번에 터뜨린다.' },
  { id: 'sonic_ult', ability: 'sonic', name: '데시벨 맥스', kind: 'ult', cd: 0, power: 9, desc: '세상에서 가장 큰 소리를 지른다.' },

  { id: 'crystal_spikes', ability: 'crystal', name: '수정 가시', kind: 'skill', cd: 6, power: 1.5, desc: '앞쪽으로 수정 가시가 줄지어 솟는다.' },
  { id: 'crystal_ray', ability: 'crystal', name: '프리즘 광선', kind: 'skill', cd: 7, power: 0.6, desc: '무지개 광선을 1초 동안 발사한다.' },
  { id: 'crystal_ult', ability: 'crystal', name: '만화경', kind: 'ult', cd: 0, power: 9.5, desc: '거대한 프리즘이 회전하며 사방으로 광선을 쏜다.' },

  { id: 'magma_geyser', ability: 'magma', name: '용암 분출', kind: 'skill', cd: 7, power: 0.6, desc: '앞쪽 땅에서 용암이 솟구치고 한동안 끓어오른다.' },
  { id: 'magma_bombs', ability: 'magma', name: '화산탄', kind: 'skill', cd: 5, power: 1.6, desc: '용암 덩어리 3개를 높이 던진다.' },
  { id: 'magma_ult', ability: 'magma', name: '칼데라', kind: 'ult', cd: 0, power: 10, desc: '땅 전체가 끓어오르다 한꺼번에 폭발한다.' },

  { id: 'chrono_stop', ability: 'chrono', name: '시간 정지', kind: 'skill', cd: 14, power: 0.5, desc: '화면 안 모든 적의 시간을 2초 동안 멈춘다.' },
  { id: 'chrono_rewind', ability: 'chrono', name: '되감기', kind: 'skill', cd: 15, power: 0, desc: '최근 3초 동안 잃은 체력을 되돌리고 그 위치로 돌아간다.' },
  { id: 'chrono_ult', ability: 'chrono', name: '크로노 브레이크', kind: 'ult', cd: 0, power: 11, desc: '시간이 멈춘 세계에서 수십 번 벤 뒤 시간을 다시 흐르게 한다.' },

  { id: 'dragon_breath', ability: 'dragon', name: '용의 숨결', kind: 'skill', cd: 7, power: 0.45, desc: '앞쪽으로 불길을 1.2초 동안 내뿜는다.' },
  { id: 'dragon_dive', ability: 'dragon', name: '비상 강하', kind: 'skill', cd: 6, power: 3.0, desc: '높이 날아올랐다가 불꽃을 두르고 내리꽂힌다.' },
  { id: 'dragon_ult', ability: 'dragon', name: '용왕 강림', kind: 'ult', cd: 0, power: 11, desc: '거대한 용의 머리가 화면을 가로지르며 모든 것을 불태운다.' },

  { id: 'light_sanctum', ability: 'light', name: '성역', kind: 'skill', cd: 14, power: 0.4, desc: '빛의 영역을 펼쳐 적에게 피해를 주고 체력을 회복한다.' },
  { id: 'light_spear', ability: 'light', name: '심판의 창', kind: 'skill', cd: 7, power: 4.0, desc: '하늘에서 거대한 빛의 창이 가장 강한 적에게 꽂힌다.' },
  { id: 'light_ult', ability: 'light', name: '천상 강림', kind: 'ult', cd: 0, power: 12, desc: '하늘이 열리고 빛의 기둥이 쏟아진다. 체력도 회복한다.' },

  { id: 'chaos_orb', ability: 'chaos', name: '혼돈 구체', kind: 'skill', cd: 6, power: 0.8, desc: '이리저리 튕기며 무작위 속성 폭발을 일으키는 구체.' },
  { id: 'chaos_entropy', ability: 'chaos', name: '엔트로피', kind: 'skill', cd: 9, power: 1.0, desc: '무작위 원소 폭발 8번이 주변을 휩쓴다.' },
  { id: 'chaos_ult', ability: 'chaos', name: '빅뱅', kind: 'ult', cd: 0, power: 14, desc: '모든 것을 한 점으로 모았다가 우주를 새로 만든다.' },
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
