// Проверки компьютера в квартире: подсветка кода и печать кода.
import { describe, expect, it } from 'vitest';
import { highlightLine } from '../src/ui/apartment/laptop/highlight';
import { buildTypingScript, applyTypingSteps } from '../src/ui/apartment/laptop/typing';

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
