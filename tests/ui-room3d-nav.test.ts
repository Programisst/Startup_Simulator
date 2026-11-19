// Ходьба по клику: герой ищет путь по квартире в обход мебели, а клик по предмету ведёт к нему.
import { describe, expect, it } from 'vitest';
import { findPath } from '../src/ui/room3d/nav';
import { COLLIDERS, findInteraction, interactionAt, WALK } from '../src/ui/room3d/layout';
import type { Box } from '../src/ui/room/engine/physics';

const FOOT = 0.34;

function hitsFurniture(p: { x: number; z: number }, boxes: Box[]): boolean {
  const h = FOOT / 2;
  return boxes.some((b) => p.x + h > b.x && p.x - h < b.x + b.w && p.z + h > b.y && p.z - h < b.y + b.h);
}

describe('поиск пути', () => {
  it('по свободному полу идёт почти по прямой', () => {
    const path = findPath({ x: 3.2, z: 3.6 }, { x: 4.4, z: 3.0 }, COLLIDERS, WALK, FOOT);
    expect(path).not.toBeNull();
    const last = path![path!.length - 1]!;
    expect(Math.hypot(last.x - 4.4, last.z - 3.0)).toBeLessThan(0.15);
    expect(path!.length).toBeLessThanOrEqual(3);
  });

  it('обходит кресло, а не идёт сквозь него', () => {
    const from = { x: 1.8, z: 3.3 };
    const to = { x: 3.4, z: 2.0 };
    const path = findPath(from, to, COLLIDERS, WALK, FOOT)!;
    expect(path).not.toBeNull();
    // Проверяем весь маршрут с мелким шагом: нигде нога не заходит в мебель.
    let prev = from;
    for (const p of path) {
      for (let t = 0; t <= 1; t += 0.05) {
        const q = { x: prev.x + (p.x - prev.x) * t, z: prev.z + (p.z - prev.z) * t };
        expect(hitsFurniture(q, COLLIDERS)).toBe(false);
      }
      prev = p;
    }
  });

  it('если кликнули прямо в мебель — идёт к ближайшему свободному месту рядом', () => {
    const path = findPath({ x: 3.2, z: 3.6 }, { x: 2.46, z: 2.6 }, COLLIDERS, WALK, FOOT);
    expect(path).not.toBeNull();
    const last = path![path!.length - 1]!;
    expect(hitsFurniture(last, COLLIDERS)).toBe(false);
    expect(Math.hypot(last.x - 2.46, last.z - 2.6)).toBeLessThan(0.9);
  });
});

describe('клик по предмету', () => {
  it('клик по столу или стулу — компьютер', () => {
    expect(interactionAt({ x: 4.6, y: 0.76, z: 0.4 })?.id).toBe('computer');
    expect(interactionAt({ x: 4.6, y: 0.5, z: 1.1 })?.id).toBe('computer');
  });
  it('клик по кофемашине — кофе, по кровати — сон, по окну — окно', () => {
    expect(interactionAt({ x: 0.3, y: 0.95, z: 3.0 })?.id).toBe('coffee');
    expect(interactionAt({ x: 0.8, y: 0.5, z: 1.0 })?.id).toBe('bed');
    expect(interactionAt({ x: 2.6, y: 1.6, z: 0.0 })?.id).toBe('window');
  });
  it('клик по пустому полу — не предмет', () => {
    expect(interactionAt({ x: 3.4, y: 0, z: 3.4 })).toBeNull();
  });
  const CLICKS = {
    computer: { x: 4.6, y: 0.76, z: 0.4 },
    coffee: { x: 0.3, y: 0.95, z: 3.0 },
    bed: { x: 0.8, y: 0.5, z: 1.0 },
    window: { x: 2.6, y: 1.6, z: 0 },
    lampDesk: { x: 4.05, y: 0.95, z: 0.27 },
    lampBed: { x: 1.84, y: 0.66, z: 0.2 },
    lampFloor: { x: 1.73, y: 1.5, z: 2.87 },
  } as const;

  it('клик по каждой из трёх ламп — своя лампа, а не стол или кровать', () => {
    expect(interactionAt(CLICKS.lampDesk)?.id).toBe('lampDesk');
    expect(interactionAt(CLICKS.lampBed)?.id).toBe('lampBed');
    expect(interactionAt(CLICKS.lampFloor)?.id).toBe('lampFloor');
    // Рядом с лампой на столе — всё ещё компьютер.
    expect(interactionAt({ x: 4.8, y: 0.76, z: 0.45 })?.id).toBe('computer');
  });

  it('у каждого предмета есть точка, откуда до него можно дотянуться', () => {
    for (const id of Object.keys(CLICKS) as (keyof typeof CLICKS)[]) {
      const it3 = interactionAt(CLICKS[id])!;
      expect(it3.id).toBe(id);
      expect(findInteraction(it3.approach)?.id).toBe(id);
      expect(hitsFurniture(it3.approach, COLLIDERS)).toBe(false);
    }
  });
});
