// Поиск пути по квартире: пол делится на клетки по 10 см, герой идёт по свободным клеткам
// в обход мебели, а потом маршрут выпрямляется — остаются только точки поворота.
import type { Box } from '../room/engine/physics';

export interface FloorPoint {
  x: number;
  z: number;
}

const CELL = 0.1;

function blocked(p: FloorPoint, colliders: Box[], walk: Box, foot: number): boolean {
  const h = foot / 2 + 0.01;
  if (p.x - h < walk.x || p.x + h > walk.x + walk.w || p.z - h < walk.y || p.z + h > walk.y + walk.h) return true;
  return colliders.some((b) => p.x + h > b.x && p.x - h < b.x + b.w && p.z + h > b.y && p.z - h < b.y + b.h);
}

function clearLine(a: FloorPoint, b: FloorPoint, colliders: Box[], walk: Box, foot: number): boolean {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.04);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (blocked({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, colliders, walk, foot)) return false;
  }
  return true;
}

/**
 * Маршрут от `from` до `to`: список точек (без стартовой). Если `to` внутри мебели —
 * ведёт к ближайшему свободному месту. null — дойти нельзя.
 */
export function findPath(from: FloorPoint, to: FloorPoint, colliders: Box[], walk: Box, foot: number): FloorPoint[] | null {
  const cols = Math.ceil(walk.w / CELL);
  const rows = Math.ceil(walk.h / CELL);
  const center = (c: number, r: number): FloorPoint => ({ x: walk.x + (c + 0.5) * CELL, z: walk.y + (r + 0.5) * CELL });
  const free = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) free[r * cols + c] = blocked(center(c, r), colliders, walk, foot) ? 0 : 1;

  const nearestFree = (p: FloorPoint): number => {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < free.length; i++) {
      if (!free[i]) continue;
      const q = center(i % cols, Math.floor(i / cols));
      const d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  const start = nearestFree(from);
  const goalFree = !blocked(to, colliders, walk, foot);
  const goal = nearestFree(to);
  if (start < 0 || goal < 0) return null;

  // A* по восьми направлениям; срезать углы мебели нельзя.
  const g = new Float32Array(free.length).fill(Infinity);
  const came = new Int32Array(free.length).fill(-1);
  const open: number[] = [start];
  const inOpen = new Uint8Array(free.length);
  g[start] = 0;
  inOpen[start] = 1;
  const gc = goal % cols;
  const gr = Math.floor(goal / cols);
  const hcost = (i: number) => Math.hypot((i % cols) - gc, Math.floor(i / cols) - gr);
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (g[open[k]!]! + hcost(open[k]!) < g[open[bi]!]! + hcost(open[bi]!)) bi = k;
    const cur = open.splice(bi, 1)[0]!;
    inOpen[cur] = 0;
    if (cur === goal) break;
    const c = cur % cols;
    const r = Math.floor(cur / cols);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const n = nr * cols + nc;
        if (!free[n]) continue;
        if (dr && dc && (!free[r * cols + nc] || !free[nr * cols + c])) continue;
        const cost = g[cur]! + (dr && dc ? Math.SQRT2 : 1);
        if (cost < g[n]!) {
          g[n] = cost;
          came[n] = cur;
          if (!inOpen[n]) {
            inOpen[n] = 1;
            open.push(n);
          }
        }
      }
    }
  }
  if (goal !== start && came[goal] === -1) return null;

  const cells: FloorPoint[] = [];
  for (let i = goal; i !== -1 && i !== start; i = came[i]!) cells.push(center(i % cols, Math.floor(i / cols)));
  cells.reverse();
  if (goalFree) cells[cells.length - 1] = { ...to };
  if (!cells.length) return goalFree ? [{ ...to }] : [center(goal % cols, Math.floor(goal / cols))];

  // Выпрямляем: от текущей точки прыгаем к самой дальней, до которой видно по прямой.
  const out: FloorPoint[] = [];
  let anchor = from;
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !clearLine(anchor, cells[j]!, colliders, walk, foot)) j--;
    out.push(cells[j]!);
    anchor = cells[j]!;
    i = j + 1;
  }
  return out;
}
