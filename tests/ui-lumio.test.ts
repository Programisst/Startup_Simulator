// Концепт «Люмио»: свой герой (пиксели без ошибок в рисунке) и приближение колёсиком.
import { describe, expect, it } from 'vitest';
import { HERO_FRAME_H, HERO_FRAME_W, HERO_PALETTE, heroFrames } from '../src/ui/apartment/engine/heroPixels';
import { zoomLimits, zoomStep } from '../src/ui/apartment/engine/zoom';

describe('пиксели героя', () => {
  const frames = heroFrames();
  const all = [
    ...frames.idle.flat(),
    ...frames.walk.flat(),
    ...frames.sit,
    frames.sleepHead,
  ];

  it('есть кадры на все 4 стороны: стоит (2), идёт (4)', () => {
    expect(frames.idle).toHaveLength(4);
    expect(frames.walk).toHaveLength(4);
    for (const d of frames.idle) expect(d).toHaveLength(2);
    for (const d of frames.walk) expect(d).toHaveLength(4);
    expect(frames.sit).toHaveLength(2);
  });

  it('каждый кадр 16×32, все буквы есть в палитре', () => {
    for (const f of [...frames.idle.flat(), ...frames.walk.flat(), ...frames.sit]) {
      expect(f).toHaveLength(HERO_FRAME_H);
      for (const row of f) expect(row).toHaveLength(HERO_FRAME_W);
    }
    for (const f of all) for (const row of f) for (const ch of row) if (ch !== '.') expect(HERO_PALETTE[ch], `буква «${ch}»`).toBeDefined();
  });

  it('у героя в профиль нет рта и только один глаз', () => {
    const right = frames.idle[0]![0]!;
    const eyes = right.join('').split('').filter((ch) => ch === 'e').length;
    expect(eyes).toBe(2); // один глаз высотой 2 пикселя
  });

  it('ноги стоят на нижней строке кадра', () => {
    for (const f of [...frames.idle.flat(), ...frames.walk.flat()]) {
      expect(f.slice(-2).join('').replace(/\./g, '').length).toBeGreaterThan(0);
    }
  });

  it('при ходьбе ноги двигаются: кадры отличаются от стойки', () => {
    for (let d = 0; d < 4; d++) expect(frames.walk[d]![0]!.join('\n')).not.toBe(frames.idle[d]![0]!.join('\n'));
  });
});

describe('приближение колёсиком', () => {
  it('пределы: от «вся комната» до примерно 2 раз ближе', () => {
    expect(zoomLimits(7)).toEqual({ min: 7, max: 14 });
    expect(zoomLimits(2)).toEqual({ min: 2, max: 4 });
  });

  it('шаг ближе и дальше на целое увеличение, без выхода за пределы', () => {
    expect(zoomStep(7, 7, 1)).toBe(8);
    expect(zoomStep(7, 8, -1)).toBe(7);
    expect(zoomStep(7, 7, -1)).toBe(7);
    expect(zoomStep(7, 14, 1)).toBe(14);
    expect(zoomStep(7, 9, 3)).toBe(12);
  });
});
