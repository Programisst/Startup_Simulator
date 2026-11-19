// Инструменты пиксельной графики: всё рисуется по одному пикселю на маленьком холсте,
// а потом холст увеличивается без размытия.

export type Ctx = CanvasRenderingContext2D;

/** Цвет контура: тёмный сливовый, мягче чёрного. */
export const OUTLINE = '#2b1f2c';

export function rect(g: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  if (w <= 0 || h <= 0) return;
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function px(g: Ctx, x: number, y: number, color: string): void {
  rect(g, x, y, 1, 1, color);
}

/** Круг без сглаживания — ровные пиксельные края. */
export function disc(g: Ctx, cx: number, cy: number, r: number, color: string): void {
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35);
    g.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
}

/** Пиксельная линия (алгоритм Брезенхэма). */
export function line(g: Ctx, x0: number, y0: number, x1: number, y1: number, color: string): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  g.fillStyle = color;
  for (let guard = 0; guard < 512; guard++) {
    g.fillRect(x, y, 1, 1);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/**
 * Предмет в виде «коробки» в привычной для таких игр проекции 3/4:
 * сверху видна крышка, снизу — передняя стенка. (x, floorY, w, d) — место на полу.
 */
export function box(
  g: Ctx,
  x: number,
  floorY: number,
  w: number,
  d: number,
  h: number,
  top: string,
  front: string,
  outline = OUTLINE,
): void {
  const topY = floorY - h;
  rect(g, x - 1, topY - 1, w + 2, d + h + 2, outline);
  rect(g, x, topY, w, d, top);
  rect(g, x, topY + d, w, h, front);
  rect(g, x, topY + d, w, 1, shade(front, -0.18));
}

/** Мягкая тень на полу под предметом. */
export function floorShadow(g: Ctx, x: number, y: number, w: number, h: number, alpha = 0.18): void {
  g.fillStyle = `rgba(30, 16, 24, ${alpha})`;
  g.fillRect(Math.round(x + 1), Math.round(y), Math.round(w - 2), Math.round(h));
  g.fillRect(Math.round(x), Math.round(y + 1), Math.round(w), Math.max(0, Math.round(h - 2)));
}

/** Делает цвет светлее (amount > 0) или темнее (amount < 0). */
export function shade(color: string, amount: number): string {
  const n = parseInt(color.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount > 0 ? c + (255 - c) * amount : c * (1 + amount))));
  return `#${((1 << 24) | (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1)}`;
}

/** Картинка из строк: каждая буква — цвет из палитры, точка — пусто. */
export interface Sprite {
  w: number;
  h: number;
  runs: { x: number; y: number; w: number; key: string }[];
}

export function makeSprite(rows: string[]): Sprite {
  const w = rows[0]?.length ?? 0;
  const runs: Sprite['runs'] = [];
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Строка ${y} спрайта длиной ${row.length}, ожидалось ${w}: "${row}"`);
    let x = 0;
    while (x < row.length) {
      const key = row[x] ?? '.';
      let end = x + 1;
      while (end < row.length && row[end] === key) end++;
      if (key !== '.') runs.push({ x, y, w: end - x, key });
      x = end;
    }
  });
  return { w, h: rows.length, runs };
}

export function drawSprite(
  g: Ctx,
  sprite: Sprite,
  x: number,
  y: number,
  palette: Record<string, string>,
  flip = false,
  maxRows = Infinity,
): void {
  for (const run of sprite.runs) {
    if (run.y >= maxRows) continue;
    const color = palette[run.key];
    if (!color) continue;
    const rx = flip ? sprite.w - run.x - run.w : run.x;
    rect(g, x + rx, y + run.y, run.w, 1, color);
  }
}

/** Генератор случайных чисел с seed — чтобы узоры на полу не прыгали от кадра к кадру. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
