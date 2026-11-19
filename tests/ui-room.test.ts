// Проверки «мозгов» пробной квартиры: подсветка кода, столкновения, время суток, печать кода.
import { describe, expect, it } from 'vitest';
import { highlightLine } from '../src/ui/room/laptop/highlight';
import { buildTypingScript, applyTypingSteps } from '../src/ui/room/laptop/typing';
import { moveWithCollision, type Box } from '../src/ui/room/engine/physics';
import { skyAt } from '../src/ui/room/engine/sky';

describe('подсветка кода', () => {
  it('не теряет и не добавляет символы', () => {
    const line = `export async function load(id: string): Promise<User> { return db.get('users', id); } // 42`;
    expect(highlightLine(line).map((t) => t.text).join('')).toBe(line);
  });

  it('узнаёт ключевые слова, строки, числа, типы, функции и комментарии', () => {
    const tokens = highlightLine(`const total = sum(items, 30) as Price; // итог`);
    const kindOf = (text: string) => tokens.find((t) => t.text === text)?.kind;
    expect(kindOf('const')).toBe('keyword');
    expect(kindOf('sum')).toBe('function');
    expect(kindOf('30')).toBe('number');
    expect(kindOf('Price')).toBe('type');
    expect(kindOf('// итог')).toBe('comment');
    expect(highlightLine(`const a = 'текст';`).find((t) => t.kind === 'string')?.text).toBe(`'текст'`);
  });

  it('не принимает слово внутри строки за ключевое', () => {
    const tokens = highlightLine(`log("return if const")`);
    expect(tokens.filter((t) => t.kind === 'keyword')).toEqual([]);
  });
});

describe('печать кода', () => {
  const source = `import { db } from './db';\n\nexport function find(id: string) {\n  return db.users.get(id);\n}\n`;

  it('после всех шагов на экране ровно исходный код, даже с опечатками', () => {
    for (const seed of [1, 2, 3, 99, 1234]) {
      const steps = buildTypingScript(source, seed);
      expect(applyTypingSteps(steps)).toBe(source);
    }
  });

  it('иногда ошибается и стирает лишнее, как живой человек', () => {
    const steps = buildTypingScript(source.repeat(6), 7);
    expect(steps.some((s) => s.type === 'backspace')).toBe(true);
  });

  it('один и тот же seed даёт одну и ту же печать', () => {
    expect(buildTypingScript(source, 5)).toEqual(buildTypingScript(source, 5));
  });
});

describe('движение по комнате', () => {
  const bounds: Box = { x: 0, y: 0, w: 100, h: 100 };
  const table: Box = { x: 40, y: 40, w: 20, h: 20 };
  const foot = { w: 10, h: 4 };

  it('не проходит сквозь мебель', () => {
    const next = moveWithCollision({ x: 20, y: 45 }, 30, 0, foot, [table], bounds);
    expect(next.x + foot.w).toBeLessThanOrEqual(table.x);
  });

  it('скользит вдоль препятствия, если идёт по диагонали', () => {
    const next = moveWithCollision({ x: 25, y: 45 }, 10, 5, foot, [table], bounds);
    expect(next.x).toBe(30);
    expect(next.y).toBe(50);
  });

  it('не выходит за стены', () => {
    const next = moveWithCollision({ x: 5, y: 5 }, -20, -20, foot, [], bounds);
    expect(next).toEqual({ x: 0, y: 0 });
  });
});

describe('время суток', () => {
  it('днём светло, ночью темно', () => {
    expect(skyAt(12 * 60).darkness).toBe(0);
    expect(skyAt(0).darkness).toBeGreaterThan(0.5);
    expect(skyAt(23 * 60).stars).toBe(true);
    expect(skyAt(13 * 60).stars).toBe(false);
  });

  it('рассвет плавный, без скачков', () => {
    for (let m = 0; m < 24 * 60; m += 5) {
      expect(Math.abs(skyAt(m + 5).darkness - skyAt(m).darkness)).toBeLessThan(0.08);
    }
  });
});
