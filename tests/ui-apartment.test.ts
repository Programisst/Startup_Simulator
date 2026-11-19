// Квартира основателя в игре: одна пиксельная комната, все её тексты на месте, часы слушаются игры.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import room from '../src/content/ru/room.json';
import { advanceClock, LINKED_CLOCK_RATE, worksAtDesk } from '../src/ui/apartment/link';

const root = join(import.meta.dirname, '..');

/** Все файлы .tsx в папке и вложенных папках. */
function sources(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : [],
  );
}

function hasKey(obj: unknown, path: string[]): boolean {
  let cur = obj;
  for (const part of path) {
    if (cur === null || typeof cur !== 'object' || !(part in cur)) return false;
    cur = (cur as Record<string, unknown>)[part];
  }
  return true;
}

describe('в игре одна квартира — пиксельная', () => {
  it('старых комнат больше нет', () => {
    expect(existsSync(join(root, 'src/ui/room3d'))).toBe(false);
    expect(existsSync(join(root, 'src/ui/room'))).toBe(false);
    expect(existsSync(join(root, 'src/ui/office/OfficeScene.tsx'))).toBe(false);
    expect(existsSync(join(root, 'src/concepts/lumio'))).toBe(false);
  });

  it('экран «Офис» показывает пиксельную квартиру', () => {
    const office = readFileSync(join(root, 'src/ui/office/GameRoom.tsx'), 'utf-8');
    expect(office).toContain("'../apartment/Apartment'");
  });

  it('3D-библиотека игре больше не нужна', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies.three).toBeUndefined();
  });
});

describe('тексты квартиры', () => {
  it('каждый текст room.*, который показывает квартира, есть в файле перевода', () => {
    const files = [...sources('src/ui/apartment'), 'src/ui/office/RoomControls.tsx'];
    const keys = new Set<string>();
    for (const file of files) {
      const code = readFileSync(join(root, file), 'utf-8');
      for (const m of code.matchAll(/['`]room\.([A-Za-z.]+)['`]/g)) keys.add(m[1]!);
    }
    expect(keys.size).toBeGreaterThan(10);
    const missing = [...keys].filter((k) => !hasKey(room, k.split('.')));
    expect(missing).toEqual([]);
  });
});

describe('часы квартиры в игре', () => {
  it('идут быстрее реальных: сутки за две минуты', () => {
    expect(advanceClock(9 * 60, 1, { rate: LINKED_CLOCK_RATE, paused: false, sleeping: false })).toBe(9 * 60 + 12);
  });
  it('стоят на паузе и пока герой спит', () => {
    expect(advanceClock(600, 1, { rate: LINKED_CLOCK_RATE, paused: true, sleeping: false })).toBe(600);
    expect(advanceClock(600, 1, { rate: LINKED_CLOCK_RATE, paused: false, sleeping: true })).toBe(600);
  });
  it('без игры — минута в секунду', () => {
    expect(advanceClock(600, 2, { rate: 1, paused: false, sleeping: false })).toBe(602);
  });
});

describe('когда герой сам садится работать', () => {
  it('за продуктом и за подработкой — да; без дела и в кассовом разрыве — нет', () => {
    expect(worksAtDesk('building')).toBe(true);
    expect(worksAtDesk('sideJob')).toBe(true);
    expect(worksAtDesk('idle')).toBe(false);
    expect(worksAtDesk('broke')).toBe(false);
  });
});
