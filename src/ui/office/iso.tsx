// Изометрическая отрисовка: перевод координат комнаты в точки на экране и объёмные блоки.
// Координаты комнаты: x — вправо-вниз, y — влево-вниз, z — вверх. Единица — одна плитка пола.

export const TILE_W = 64;
export const TILE_H = 32;
export const Z_UNIT = 44;

export type Point = readonly [number, number];

/** Точка комнаты → точка на экране. */
export function project(x: number, y: number, z = 0): Point {
  return [((x - y) * TILE_W) / 2, ((x + y) * TILE_H) / 2 - z * Z_UNIT];
}

export function points(...list: Point[]): string {
  return list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
}

/** Делает цвет вида #rrggbb темнее (factor < 1) или светлее (factor > 1). */
export function shade(hex: string, factor: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * factor)));
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

interface BoxProps {
  x: number;
  y: number;
  z?: number;
  /** размер по x */
  w: number;
  /** размер по y */
  d: number;
  /** высота */
  h: number;
  color: string;
  className?: string;
}

/** Объёмный блок: видны верх и две ближние к зрителю стороны. */
export function Box({ x, y, z = 0, w, d, h, color, className }: BoxProps) {
  const top = points(project(x, y, z + h), project(x + w, y, z + h), project(x + w, y + d, z + h), project(x, y + d, z + h));
  const left = points(project(x, y + d, z + h), project(x + w, y + d, z + h), project(x + w, y + d, z), project(x, y + d, z));
  const right = points(project(x + w, y, z + h), project(x + w, y + d, z + h), project(x + w, y + d, z), project(x + w, y, z));
  return (
    <g className={className}>
      <polygon points={left} fill={shade(color, 0.82)} />
      <polygon points={right} fill={shade(color, 0.62)} />
      <polygon points={top} fill={color} />
    </g>
  );
}

/** Плоская фигура на полу. */
export function FloorRect({ x, y, w, d, color, z = 0.005 }: { x: number; y: number; w: number; d: number; color: string; z?: number }) {
  return <polygon points={points(project(x, y, z), project(x + w, y, z), project(x + w, y + d, z), project(x, y + d, z))} fill={color} />;
}

/** Прямоугольник на правой задней стене (плоскость y = 0). */
export function onBackWall(x1: number, x2: number, z1: number, z2: number): string {
  return points(project(x1, 0, z1), project(x2, 0, z1), project(x2, 0, z2), project(x1, 0, z2));
}

/** Прямоугольник на левой задней стене (плоскость x = 0). */
export function onSideWall(y1: number, y2: number, z1: number, z2: number): string {
  return points(project(0, y1, z1), project(0, y2, z1), project(0, y2, z2), project(0, y1, z2));
}
