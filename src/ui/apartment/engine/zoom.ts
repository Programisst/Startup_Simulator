// Приближение колёсиком. Увеличение всегда целое — так пиксели остаются ровными и чёткими.

/** От «вся комната на экране» (base) до примерно в 2 раза ближе. */
export function zoomLimits(base: number): { min: number; max: number } {
  return { min: base, max: Math.max(base + 2, Math.round(base * 2)) };
}

/** Следующее увеличение: steps > 0 — ближе, < 0 — дальше. */
export function zoomStep(base: number, current: number, steps: number): number {
  const { min, max } = zoomLimits(base);
  return Math.min(max, Math.max(min, Math.round(current) + steps));
}
