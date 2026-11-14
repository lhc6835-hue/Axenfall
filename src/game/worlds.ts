// Worlds: each one has its own floor, enemy mix, two bosses and music.
import type { EType } from './enemies';
import type { Track } from '../engine/audio';

export interface WorldDef {
  id: number;
  name: string;
  sub: string;
  /** enemy hp multiplier on top of the time scaling */
  hp: number;
  /** gold multiplier for drops and the clear bonus */
  gold: number;
  boss1: { type: EType; name: string; color: string; bar: string; hp: number };
  boss2: { type: EType; name: string; color: string; bar: string; hp: number };
  music: { battle: Track; boss1: Track; boss2: Track };
  /** spawn weights by time: [type, start time, base weight, growth per 100s] */
  pool: [EType, number, number, number][];
  elites: (t: number) => EType[];
  swarm: [EType, EType];
  floor: { a: number; b: number; line: number; hi: number; seam: number; glow: number };
}

export const WORLDS: WorldDef[] = [
  {
    id: 1,
    name: '자정 회랑',
    sub: '보라빛 석판 위의 첫 출격',
    hp: 1,
    gold: 1,
    boss1: { type: 'warden', name: '감시자 큐브', color: '#8adfff', bar: '#6aa8ff', hp: 2200 },
    boss2: { type: 'overlord', name: '붉은 군주', color: '#ff8aa0', bar: '#ff4a6a', hp: 5600 },
    music: { battle: 'battle', boss1: 'boss1', boss2: 'boss2' },
    pool: [
      ['grunt', 0, 10, 0],
      ['runner', 20, 6, 0],
      ['archer', 50, 2, 0.5],
      ['dasher', 90, 2, 0.5],
      ['brute', 130, 0.8, 0.33],
      ['caster', 200, 0.8, 0.33],
    ],
    elites: (t) => (t > 200 ? ['brute', 'dasher', 'caster', 'archer'] : t > 100 ? ['dasher', 'archer', 'grunt'] : ['grunt', 'runner']),
    swarm: ['grunt', 'runner'],
    floor: { a: 0x17152a, b: 0x1a1830, line: 0x121020, hi: 0x23203c, seam: 0, glow: 0 },
  },
  {
    id: 2,
    name: '용광로 심층',
    sub: '쇳물이 흐르는 주조소 밑바닥',
    hp: 1.45,
    gold: 1.7,
    boss1: { type: 'golem', name: '용광로 골렘', color: '#ffb070', bar: '#ff7a2a', hp: 3400 },
    boss2: { type: 'duelist', name: '황혼 검객', color: '#d8c8ff', bar: '#a88aff', hp: 7200 },
    music: { battle: 'battle2', boss1: 'boss3', boss2: 'boss4' },
    pool: [
      ['splitter', 0, 8, 0],
      ['runner', 0, 4, 0],
      ['lancer', 25, 5, 0.6],
      ['shield', 60, 2.5, 0.6],
      ['mortar', 90, 1.6, 0.5],
      ['sniper', 140, 1.2, 0.4],
      ['brute', 200, 0.7, 0.3],
    ],
    elites: (t) => (t > 200 ? ['shield', 'lancer', 'mortar', 'sniper', 'brute'] : t > 90 ? ['lancer', 'shield', 'splitter'] : ['splitter', 'lancer']),
    swarm: ['splitter', 'lancer'],
    floor: { a: 0x1c1614, b: 0x201916, line: 0x0e0a09, hi: 0x2c221d, seam: 0xff6a20, glow: 0xff7a2a },
  },
];

export const worldById = (id: number) => WORLDS.find((w) => w.id === id) ?? WORLDS[0];
