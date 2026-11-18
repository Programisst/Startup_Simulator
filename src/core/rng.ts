// Генератор случайных чисел с начальным числом (seed).
// Единственный источник случайности в ядре: Math.random в src/core запрещён.
// Одинаковое состояние всегда даёт одинаковую последовательность чисел,
// поэтому партии повторяемы, а состояние генератора хранится в сохранении.

/** Состояние генератора — одно целое число. Хранится внутри состояния игры. */
export type RngState = number;

export interface RngResult<T> {
  value: T;
  next: RngState;
}

/** Создаёт начальное состояние генератора из seed. */
export function createRng(seed: number): RngState {
  return seed >>> 0;
}

/** Случайное число от 0 (включительно) до 1 (не включая). Алгоритм mulberry32. */
export function nextFloat(state: RngState): RngResult<number> {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, next };
}

/** Случайное число в диапазоне от min до max. */
export function nextRange(state: RngState, min: number, max: number): RngResult<number> {
  const r = nextFloat(state);
  return { value: min + r.value * (max - min), next: r.next };
}

/** Случайное целое от min до max включительно. */
export function nextInt(state: RngState, min: number, max: number): RngResult<number> {
  const r = nextFloat(state);
  return { value: min + Math.floor(r.value * (max - min + 1)), next: r.next };
}
