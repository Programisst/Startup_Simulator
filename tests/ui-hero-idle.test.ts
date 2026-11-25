// Живая стойка героя: руки висят прямо вниз от плеч и длинные — кисти у середины бедра, как у человека;
// стоя без дела, он дышит, моргает и иногда оглядывается.
import { describe, expect, it } from 'vitest';
import { HERO_FRAME_H, HERO_FRAME_W, HERO_PALETTE, heroFrames, idlePose } from '../src/ui/apartment/engine/heroPixels';

const f = heroFrames();
const FRONT = 3;
const BACK = 1;
const valid = (frame: string[]) => {
  expect(frame).toHaveLength(HERO_FRAME_H);
  for (const row of frame) {
    expect(row).toHaveLength(HERO_FRAME_W);
    for (const ch of row) if (ch !== '.') expect(HERO_PALETTE[ch], `буква «${ch}»`).toBeDefined();
  }
};
/** Строки ниже головы (с 20-й), где у левого края кадра (столбцы 0–3) есть кисть — буква кожи. */
const handRows = (frame: string[]) => frame.map((row, y) => (y >= 20 && /s/.test(row.slice(0, 4)) ? y : -1)).filter((y) => y >= 0);

describe('стойка героя', () => {
  it('лицом и спиной: руки прямо вниз — ничего не торчит в стороны на краю кадра', () => {
    for (const dir of [FRONT, BACK]) {
      const frame = f.idle[dir]![0]!;
      for (let y = 20; y < 28; y++) {
        expect(frame[y]![0], `направление ${dir}, строка ${y}`).toBe('.');
        expect(frame[y]![15]).toBe('.');
      }
    }
  });

  it('руки длинные: кисть ниже пояса, у бедра (строка 26), а не на поясе', () => {
    for (const dir of [FRONT, BACK]) expect(handRows(f.idle[dir]![0]!), `направление ${dir}`).toEqual([26]);
  });

  it('при ходьбе руки той же длины, одна кисть чуть выше — рука вынесена вперёд', () => {
    const rows = f.walk[FRONT]!.map(handRows).flat();
    expect(Math.max(...rows)).toBe(26);
    expect(Math.min(...rows)).toBe(25);
  });

  it('оглядывается: голова повёрнута вправо и влево, кадры правильные', () => {
    expect(f.look).toHaveLength(2);
    for (const frame of f.look) valid(frame);
    expect(f.look[0]!.join('\n')).not.toBe(f.idle[FRONT]![0]!.join('\n'));
    expect(f.look[1]!.join('\n')).not.toBe(f.look[0]!.join('\n'));
  });
});

describe('когда что делает', () => {
  it('первые секунды просто стоит и дышит', () => {
    for (const t of [0, 1, 2, 3, 3.9]) expect(idlePose(t, FRONT).kind).toBe('idle');
  });

  it('потом иногда оглядывается — и снова смотрит прямо', () => {
    const frames = new Set<number>();
    let sawIdleBetween = false;
    let last = 'idle';
    for (let t = 4; t < 60; t += 0.1) {
      const p = idlePose(t, FRONT);
      if (p.kind === 'look') frames.add(p.frame);
      if (last !== 'idle' && p.kind === 'idle') sawIdleBetween = true;
      last = p.kind;
    }
    expect(frames).toEqual(new Set([0, 1]));
    expect(sawIdleBetween).toBe(true);
  });

  it('спиной и в профиль только дышит', () => {
    for (let t = 0; t < 60; t += 0.5) {
      expect(idlePose(t, BACK).kind).toBe('idle');
      expect(idlePose(t, 0).kind).toBe('idle');
    }
  });

  it('номер кадра всегда внутри набора кадров', () => {
    for (let t = 0; t < 60; t += 0.05) {
      const p = idlePose(t, FRONT);
      const set = p.kind === 'look' ? f.look : f.idle[FRONT]!;
      expect(p.frame).toBeGreaterThanOrEqual(0);
      expect(p.frame).toBeLessThan(set.length);
    }
  });
});
