export const W = 640;
export const H = 360;
export const GROUND_Y = 300;

export const FONT = 'Galmuri11';
export const FONT_B = 'Galmuri11B';
export const FONT_S = 'Galmuri9';
export const FONT_L = 'Galmuri14';

// UI palette (deep navy + gold trim)
export const UI = {
  ink: 0x0b0714,
  panel: 0x1a1430,
  panel2: 0x251c45,
  panelHi: 0x3a2d68,
  line: 0x5b4a9a,
  gold: 0xffd166,
  goldDark: 0xb07a1e,
  text: 0xf4eefe,
  dim: 0x9a8fbf,
  red: 0xff4d6d,
  green: 0x5dffa0,
  cyan: 0x5ee7ff,
};

export type Grade = 'N' | 'R' | 'SR' | 'SSR' | 'UR';
export const GRADES: Grade[] = ['N', 'R', 'SR', 'SSR', 'UR'];
export const GRADE_INFO: Record<Grade, { name: string; color: number; glow: number; rate: number }> = {
  N: { name: '노멀', color: 0xb8c4d6, glow: 0x8aa0bf, rate: 0.45 },
  R: { name: '레어', color: 0x4fb8ff, glow: 0x2a7fff, rate: 0.3 },
  SR: { name: '에픽', color: 0xc070ff, glow: 0x9a3dff, rate: 0.17 },
  SSR: { name: '레전드', color: 0xffc23d, glow: 0xff8a00, rate: 0.065 },
  UR: { name: '신화', color: 0xff4fd8, glow: 0x00f0ff, rate: 0.015 },
};

export const TXT = (size: 'S' | 'M' | 'L' = 'M', color = UI.text, bold = false): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: size === 'S' ? FONT_S : size === 'L' ? FONT_L : bold ? FONT_B : FONT,
  fontSize: size === 'S' ? '10px' : size === 'L' ? '15px' : '12px',
  color: '#' + color.toString(16).padStart(6, '0'),
  resolution: 1,
});
