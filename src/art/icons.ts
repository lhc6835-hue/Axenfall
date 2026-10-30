// UI frames and icons.
import { ABILITIES, SKILLS, abilityById } from '../data/abilities';
import { GRADE_INFO, UI } from '../core/const';
import { addTex, bayer, makeCanvas, mix, paintShapes, px, ramp } from './pixel';

function frame(scene: Phaser.Scene, key: string, fill: number, trim: number, hi: number) {
  const S = 24;
  const [cv, ctx] = makeCanvas(S, S);
  px(ctx, 2, 0, UI.ink, S - 4, S); px(ctx, 0, 2, UI.ink, S, S - 4); px(ctx, 1, 1, UI.ink, S - 2, S - 2);
  px(ctx, 2, 1, trim, S - 4, S - 2); px(ctx, 1, 2, trim, S - 2, S - 4);
  px(ctx, 2, 1, mix(trim, 0xffffff, 0.45), S - 4, 1);
  px(ctx, 2, S - 2, mix(trim, 0x000000, 0.4), S - 4, 1);
  px(ctx, 3, 3, UI.ink, S - 6, S - 6);
  for (let y = 4; y < S - 4; y++) px(ctx, 4, y, mix(hi, fill, Math.min(1, (y - 4) / 6 + bayer(0, y) * 0.1)), S - 8, 1);
  px(ctx, 4, 4, mix(hi, 0xffffff, 0.2), S - 8, 1);
  // corner rivets
  for (const [x, y] of [[2, 2], [S - 3, 2], [2, S - 3], [S - 3, S - 3]]) px(ctx, x, y, mix(trim, 0xffffff, 0.7));
  addTex(scene, key, cv);
}

const SYM: Record<string, string[]> = {
  sword: ['..........##', '.........###', '........###.', '.......###..', '......###...', '.#...###....', '.##.###.....', '..####......', '..###.......', '.##.##......', '##...#......', '#...........'],
  spin: ['....####....', '..##....##..', '.#........#.', '.#...##...#.', '#...#..#...#', '#...#..#...#', '#....##....#', '.#.........#', '.#.......##.', '..##..####..', '....####....', '............'],
  fire: ['.....#......', '....##......', '....###..#..', '...####.##..', '..########..', '..###.####..', '.###...####.', '.###....###.', '.###....###.', '..###..###..', '...######...', '............'],
  pillar: ['....####....', '...######...', '...##..##...', '....####....', '....#..#....', '....####....', '...##..##...', '...######...', '..###..###..', '..########..', '############', '............'],
  sun: ['.....##.....', '.#...##...#.', '..#......#..', '....####....', '...######...', '##.######.##', '##.######.##', '...######...', '....####....', '..#......#..', '.#...##...#.', '.....##.....'],
  lance: ['...........#', '..........##', '.........##.', '........##..', '.......##...', '......##....', '....###.....', '...##.#.....', '..##........', '.##.........', '##..........', '#...........'],
  snow: ['.....##.....', '..#..##..#..', '...#.##.#...', '....####....', '.#..####..#.', '############', '############', '.#..####..#.', '....####....', '...#.##.#...', '..#..##..#..', '.....##.....'],
  bolt: ['......####..', '.....####...', '....####....', '...####.....', '..########..', '.....####...', '....####....', '...####.....', '..###.......', '.##.........', '#...........', '............'],
  chain: ['##..........', '###.........', '.###....##..', '..###..####.', '...######.#.', '....####....', '...######...', '.#.####..##.', '.####...###.', '..##.....###', '..........##', '............'],
  tornado: ['############', '.##########.', '..########..', '...######...', '...#####....', '....####....', '....###.....', '.....###....', '.....##.....', '....##......', '.....#......', '............'],
  wind: ['.......###..', '.........##.', '#######..#..', '.......##...', '............', '##########..', '..........#.', '.......###..', '............', '#####.......', '.....##.....', '......#.....'],
  star: ['.....##.....', '.....##.....', '....####....', '############', '.##########.', '..########..', '...######...', '..########..', '..###..###..', '.##......##.', '.#........#.', '............'],
  shuriken: ['.....#......', '....###.....', '....###.....', '...##.##....', '.###...####.', '####.#.#####', '.####...###.', '....##.##...', '.....###....', '.....###....', '......#.....', '............'],
  dagger: ['#...........', '##..........', '.##.........', '..##........', '...##.......', '....##......', '.....###....', '......####..', '.....######.', '.......##...', '.......#.#..', '...........#'],
  moon: ['....####....', '..######....', '.#####......', '.####.......', '####........', '####........', '####........', '####........', '.####.......', '.#####......', '..######....', '....####....'],
  meteor: ['#...........', '.#..#.......', '..#..#......', '.#.#..#.....', '..#.#..###..', '...#..#####.', '.....######.', '....#######.', '....#######.', '.....#####..', '......###...', '............'],
  const: ['#...........', '##.......#..', '#.#.....###.', '...#....#...', '....#..#....', '.....##.....', '.....##.....', '....#..#....', '...#....###.', '..#.....###.', '.###.....#..', '.###........'],
  hole: ['....####....', '..##....##..', '.#..####..#.', '.#.#....#.#.', '#.#..##..#.#', '#.#.####.#.#', '#.#.####.#.#', '#.#..##..#.#', '.#.#....#.#.', '.#..####..#.', '..##....##..', '....####....'],
  cut: ['...........#', '..........#.', '.........#..', '........#...', '.......#....', '.#####...##.', '.##...#####.', '....#.......', '...#........', '..#.........', '.#..........', '#...........'],
  end: ['#..........#', '.#........#.', '..#......#..', '...#....#...', '....####....', '....#..#....', '....#..#....', '....####....', '...#....#...', '..#......#..', '.#........#.', '#..........#'],
  fist: ['............', '..########..', '.##########.', '.##.##.##.#.', '.##########.', '.##########.', '.##########.', '..########..', '...######...', '...######...', '...######...', '............'],
  shard: ['............', '.......##...', '......####..', '.....####...', '....####....', '...####.....', '..####......', '...##.......', '...........#', '.......#.##.', '.......###..', '........#...'],
};

const SKILL_SYM: Record<string, string> = {
  blade_dash: 'sword', blade_whirl: 'spin', blade_ult: 'sword',
  flame_ball: 'fire', flame_pillar: 'pillar', flame_ult: 'sun',
  frost_lance: 'lance', frost_nova: 'snow', frost_ult: 'snow',
  volt_chain: 'chain', volt_dash: 'bolt', volt_ult: 'bolt',
  gale_tornado: 'tornado', gale_rise: 'wind', gale_ult: 'tornado',
  shadow_star: 'shuriken', shadow_strike: 'dagger', shadow_ult: 'moon',
  star_meteor: 'meteor', star_const: 'const', star_ult: 'star',
  void_hole: 'hole', void_cut: 'cut', void_ult: 'end',
};
const BASIC_SYM: Record<string, string> = { blade: 'sword', flame: 'fist', frost: 'shard', volt: 'bolt', gale: 'wind', shadow: 'dagger', star: 'star', void: 'cut' };

function iconBase(ctx: CanvasRenderingContext2D, S: number, c1: number, c2: number, ult: boolean) {
  const r = ramp(c1);
  px(ctx, 1, 0, UI.ink, S - 2, S); px(ctx, 0, 1, UI.ink, S, S - 2);
  for (let y = 1; y < S - 1; y++) {
    const t = y / S;
    const c = mix(mix(r[3], r[1], t), c2, ult ? 0.25 * Math.sin(t * Math.PI) : 0);
    px(ctx, 1, y, Math.floor(t * 6 + bayer(1, y)) % 2 ? c : mix(c, r[2], 0.5), S - 2, 1);
  }
  px(ctx, 1, 1, mix(r[4], 0xffffff, 0.4), S - 2, 1);
  px(ctx, 1, S - 2, r[0], S - 2, 1);
  if (ult) {
    px(ctx, 1, 1, 0xffd166, S - 2, 1); px(ctx, 1, S - 2, 0xffd166, S - 2, 1);
    px(ctx, 1, 1, 0xffd166, 1, S - 2); px(ctx, S - 2, 1, 0xffd166, 1, S - 2);
  }
}

function drawSym(ctx: CanvasRenderingContext2D, sym: string, ox: number, oy: number, s: number, c: number, shadow: number) {
  const rows = SYM[sym];
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (rows[y][x] === '#') px(ctx, ox + x * s + s, oy + y * s + s, shadow, s, s);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (rows[y][x] === '#') px(ctx, ox + x * s, oy + y * s, c, s, s);
}

export function buildUi(scene: Phaser.Scene) {
  frame(scene, 'ui_panel', UI.panel, UI.line, UI.panel2);
  frame(scene, 'ui_panelGold', UI.panel, UI.goldDark, UI.panelHi);
  frame(scene, 'ui_btn', 0x2a2050, UI.line, 0x4a3a88);
  frame(scene, 'ui_btnHi', 0x3a2a70, UI.gold, 0x6a54c0);
  frame(scene, 'ui_btnGold', 0x7a4a10, UI.gold, 0xd8901e);
  frame(scene, 'ui_btnDis', 0x1e1a2a, 0x3a3450, 0x2a2440);
  frame(scene, 'ui_slot', 0x120e22, 0x3a2d68, 0x1a1430);

  // skill icons 28x28
  for (const sk of SKILLS) {
    const a = abilityById(sk.ability);
    const S = 28;
    const [cv, ctx] = makeCanvas(S, S);
    iconBase(ctx, S, a.fx, a.fx2, sk.kind === 'ult');
    drawSym(ctx, SKILL_SYM[sk.id], 2, 2, 2, 0xffffff, ramp(a.fx)[0]);
    addTex(scene, 'ic_' + sk.id, cv);
  }
  for (const a of ABILITIES) {
    const S = 28;
    const [cv, ctx] = makeCanvas(S, S);
    iconBase(ctx, S, a.body === 0x1c1430 ? 0x5a3a8a : a.body, a.fx, false);
    drawSym(ctx, BASIC_SYM[a.id], 2, 2, 2, 0xffffff, 0x0b0714);
    addTex(scene, 'ic_basic_' + a.id, cv);
  }
  // currency + misc icons (painted)
  const icon = (key: string, w: number, h: number, fn: (ctx: CanvasRenderingContext2D) => void) => {
    const [cv, ctx] = makeCanvas(w, h); fn(ctx); addTex(scene, key, cv);
  };
  icon('ic_gold', 14, 14, (c) => {
    paintShapes(c, 0, 0, 14, 14, [{ k: 'ell', x: 7, y: 7, rx: 6, ry: 6, c: 0xffc23d }, { k: 'ell', x: 7, y: 7, rx: 3.5, ry: 3.5, c: 0xe8a020, z: 1 }]);
    px(c, 6, 4, 0xfff4b0, 2, 6);
  });
  icon('ic_gem', 14, 14, (c) => {
    const rows = ['....######....', '...#hhhhhh#...', '..#hhwhhhhh#..', '.#hhwhhhhhhh#.', '##############', '#mmmmmmmmmmmm#', '.#mmmmmmmmmm#.', '..#mmmmmmmm#..', '...#mmmmmm#...', '....#mmmm#....', '.....#mm#.....', '......##......'];
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      const col = ch === '#' ? 0x3a0a5a : ch === 'h' ? 0xff9aff : ch === 'w' ? 0xffffff : ch === 'm' ? (x < 7 ? 0xd040ff : 0x9a20d8) : -1;
      if (col >= 0) px(c, x, y + 1, col);
    }));
  });
  icon('ic_star', 11, 11, (c) => {
    const rows = ['.....#.....', '....###....', '....###....', '###########', '.#########.', '..#######..', '..#######..', '.####.####.', '.###...###.', '.#.......#.', '...........'];
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') px(c, x, y, y < 4 ? 0xfff4b0 : 0xffc23d); }));
  });
  icon('ic_starOff', 11, 11, (c) => {
    const rows = ['.....#.....', '....###....', '....###....', '###########', '.#########.', '..#######..', '..#######..', '.####.####.', '.###...###.', '.#.......#.', '...........'];
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') px(c, x, y, 0x3a3456); }));
  });
  icon('ic_lock', 12, 14, (c) => {
    px(c, 3, 0, 0xb8b0d8, 6, 2); px(c, 2, 1, 0xb8b0d8, 2, 5); px(c, 8, 1, 0xb8b0d8, 2, 5);
    px(c, 0, 6, 0x0b0714, 12, 8); px(c, 1, 7, 0xffc23d, 10, 6); px(c, 1, 7, 0xfff4b0, 10, 1); px(c, 5, 9, 0x0b0714, 2, 3);
  });
  icon('ic_heart', 11, 10, (c) => {
    const rows = ['.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'];
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') px(c, x + 1, y + 1, y < 2 ? 0xff9ab0 : 0xff4d6d); }));
  });
  icon('ic_sword', 12, 12, (c) => drawSym(c, 'sword', 0, 0, 1, 0xffffff, 0x3a2d68));

  // grade badges
  for (const g of Object.keys(GRADE_INFO) as (keyof typeof GRADE_INFO)[]) {
    const gi = GRADE_INFO[g];
    const w = 26, h = 12;
    const [cv, ctx] = makeCanvas(w, h);
    px(ctx, 1, 0, UI.ink, w - 2, h); px(ctx, 0, 1, UI.ink, w, h - 2);
    for (let y = 1; y < h - 1; y++) px(ctx, 1, y, mix(mix(gi.color, 0xffffff, 0.3), gi.glow, y / h), w - 2, 1);
    px(ctx, 1, 1, 0xffffff, w - 2, 1);
    addTex(scene, 'badge_' + g, cv);
  }
}
