// Движение героя по комнате: стены и мебель не пускают, вдоль них можно скользить.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Сдвигает ступни героя (прямоугольник foot с левым верхним углом в pos) на dx, dy.
 * Оси двигаются по очереди — так герой скользит вдоль стола, а не застревает.
 */
export function moveWithCollision(
  pos: Point,
  dx: number,
  dy: number,
  foot: { w: number; h: number },
  solids: Box[],
  bounds: Box,
): Point {
  let x = clamp(pos.x + dx, bounds.x, bounds.x + bounds.w - foot.w);
  for (const s of solids) {
    if (!overlaps({ x, y: pos.y, ...foot }, s)) continue;
    x = dx > 0 ? s.x - foot.w : dx < 0 ? s.x + s.w : pos.x;
  }

  let y = clamp(pos.y + dy, bounds.y, bounds.y + bounds.h - foot.h);
  for (const s of solids) {
    if (!overlaps({ x, y, ...foot }, s)) continue;
    y = dy > 0 ? s.y - foot.h : dy < 0 ? s.y + s.h : pos.y;
  }
  return { x, y };
}
