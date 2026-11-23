// Клавиатура на столе (вид из-за компьютера): настоящая раскладка, клавиши не налезают друг на друга и на корпус,
// а клавиша, которую игрок нажал на своей клавиатуре, находится на нарисованной.
import { describe, expect, it } from 'vitest';
import { KEYBOARD_H, keyAt, keyboardKeys } from '../src/ui/apartment/laptop/keyboardLayout';

const board = { x: 10, y: 20, w: 120, h: KEYBOARD_H };
const keys = keyboardKeys(board);
const overlap = (a: (typeof keys)[number], b: (typeof keys)[number]) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('клавиатура на столе', () => {
  it('пять рядов, в каждом не меньше 10 клавиш, кроме нижнего', () => {
    const rows = new Map<number, number>();
    for (const k of keys) rows.set(k.row, (rows.get(k.row) ?? 0) + 1);
    expect([...rows.keys()].sort()).toEqual([0, 1, 2, 3, 4]);
    for (const r of [0, 1, 2, 3]) expect(rows.get(r)!).toBeGreaterThanOrEqual(10);
  });

  it('все клавиши внутри корпуса, с отступом от краёв — нижний ряд не налезает на рамку', () => {
    for (const k of keys) {
      expect(k.x, k.code).toBeGreaterThanOrEqual(board.x + 2);
      expect(k.x + k.w, k.code).toBeLessThanOrEqual(board.x + board.w - 2);
      expect(k.y, k.code).toBeGreaterThanOrEqual(board.y + 2);
      expect(k.y + k.h, k.code).toBeLessThanOrEqual(board.y + board.h - 2);
    }
  });

  it('клавиши не налезают друг на друга и видны: у каждой есть верх и передняя грань', () => {
    for (let i = 0; i < keys.length; i++) {
      expect(keys[i]!.w, keys[i]!.code).toBeGreaterThanOrEqual(3);
      expect(keys[i]!.h).toBeGreaterThanOrEqual(3);
      for (let j = i + 1; j < keys.length; j++) expect(overlap(keys[i]!, keys[j]!), `${keys[i]!.code} / ${keys[j]!.code}`).toBe(false);
    }
  });

  it('пробел — самая длинная клавиша, в нижнем ряду', () => {
    const space = keys.find((k) => k.code === 'Space')!;
    expect(space.row).toBe(4);
    for (const k of keys) if (k !== space) expect(space.w).toBeGreaterThan(k.w);
  });

  it('нажатая буква находится на нарисованной клавиатуре по коду клавиши', () => {
    expect(keyAt(keys, 'KeyQ')!.row).toBe(1);
    expect(keyAt(keys, 'KeyA')!.row).toBe(2);
    expect(keyAt(keys, 'KeyZ')!.row).toBe(3);
    expect(keyAt(keys, 'Enter')!.row).toBe(2);
    expect(keyAt(keys, 'KeyQ')!.x).toBeLessThan(keyAt(keys, 'KeyP')!.x);
    expect(keyAt(keys, 'НетТакой')).toBeNull();
  });
});
