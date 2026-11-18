import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, nextRange } from '../src/core/rng';

function sequence(seed: number, count: number): number[] {
  let state = createRng(seed);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const r = nextFloat(state);
    out.push(r.value);
    state = r.next;
  }
  return out;
}

describe('генератор случайности', () => {
  it('одинаковый seed даёт одинаковую последовательность', () => {
    expect(sequence(42, 100)).toEqual(sequence(42, 100));
  });

  it('разные seed дают разные последовательности', () => {
    expect(sequence(1, 20)).not.toEqual(sequence(2, 20));
  });

  it('числа лежат от 0 до 1 и в среднем около 0.5', () => {
    const values = sequence(7, 10000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it('nextRange и nextInt не выходят за границы', () => {
    let state = createRng(99);
    for (let i = 0; i < 1000; i++) {
      const a = nextRange(state, 0.9, 1.1);
      expect(a.value).toBeGreaterThanOrEqual(0.9);
      expect(a.value).toBeLessThan(1.1);
      const b = nextInt(a.next, 1, 6);
      expect(Number.isInteger(b.value)).toBe(true);
      expect(b.value).toBeGreaterThanOrEqual(1);
      expect(b.value).toBeLessThanOrEqual(6);
      state = b.next;
    }
  });
});
