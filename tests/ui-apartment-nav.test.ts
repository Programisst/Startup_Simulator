// Ходьба по клику в пиксельной квартире: герой доходит до каждого предмета в обход мебели.
import { describe, expect, it } from 'vitest';
import { findPath, type Box } from '../src/ui/apartment/engine/nav';
import { HERO_START, PROPS, SPOTS, WALK } from '../src/ui/apartment/engine/scene';

// Так же, как в world.ts: сцена в пикселях, поиск пути — в единицах по 40 пикселей.
const U = 40;
const FOOT = 8 / U;
const solids: Box[] = PROPS.flatMap((p) => (p.solid ? [{ x: p.solid.x / U, y: p.solid.y / U, w: p.solid.w / U, h: p.solid.h / U }] : []));
const walk: Box = { x: WALK.x / U, y: WALK.y / U, w: WALK.w / U, h: WALK.h / U };
const start = { x: HERO_START.x / U, z: HERO_START.y / U };

function hitsFurniture(p: { x: number; z: number }): boolean {
  const h = FOOT / 2;
  return solids.some((b) => p.x + h > b.x && p.x - h < b.x + b.w && p.z + h > b.y && p.z - h < b.y + b.h);
}

describe('поиск пути в квартире', () => {
  it('герой стоит в начале на свободном полу', () => {
    expect(hitsFurniture(start)).toBe(false);
  });

  for (const spot of SPOTS) {
    it(`доходит до «${spot.id}» и нигде не проходит сквозь мебель`, () => {
      const to = { x: spot.at.x / U, z: spot.at.y / U };
      const path = findPath(start, to, solids, walk, FOOT);
      expect(path).not.toBeNull();
      const last = path![path!.length - 1]!;
      // Последняя точка — рядом с местом у предмета (в пикселях сцены — не дальше 8).
      expect(Math.hypot(last.x - to.x, last.z - to.z) * U).toBeLessThan(8);
      let prev = start;
      for (const p of path!) {
        for (let t = 0; t <= 1; t += 0.05) {
          expect(hitsFurniture({ x: prev.x + (p.x - prev.x) * t, z: prev.z + (p.z - prev.z) * t })).toBe(false);
        }
        prev = p;
      }
    });
  }
});
