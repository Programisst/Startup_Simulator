// Монитор в квартире: тот же код, что в компьютере, печатается вживую; длинные строки переносятся, а не обрезаются.
import { describe, expect, it } from 'vitest';
import { MonitorTyping, textAmount, wrapLine } from '../src/ui/apartment/engine/monitor';
import { zoomLimits } from '../src/ui/apartment/engine/zoom';
import { WRITTEN_FILES } from '../src/ui/apartment/laptop/project';

describe('перенос строк', () => {
  const line = '  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * DAY_MS);';

  it('ни один кусок не длиннее ширины экрана, а вместе — ровно исходная строка', () => {
    for (const cols of [8, 20, 33, 80]) {
      const parts = wrapLine(line, cols);
      for (const p of parts) expect(p.length).toBeLessThanOrEqual(cols);
      expect(parts.join('')).toBe(line);
    }
  });

  it('переносит по словам, если можно', () => {
    const parts = wrapLine(line, 30);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]!.endsWith(' ')).toBe(true);
  });

  it('короткая и пустая строка остаются одной строкой', () => {
    expect(wrapLine('return x;', 40)).toEqual(['return x;']);
    expect(wrapLine('', 40)).toEqual(['']);
  });
});

describe('сколько видно настоящего текста', () => {
  const base = 7;
  const { min, max } = zoomLimits(base);

  it('издалека — пиксели, вблизи — текст', () => {
    expect(textAmount(min, base, false)).toBe(0);
    expect(textAmount(max, base, false)).toBe(1);
  });

  it('переход плавный и только в одну сторону', () => {
    let prev = 0;
    for (let s = min; s <= max; s += 0.1) {
      const a = textAmount(s, base, false);
      expect(a).toBeGreaterThanOrEqual(prev);
      expect(a - prev).toBeLessThan(0.2);
      prev = a;
    }
  });

  it('на каждом шаге колёсика — либо пиксели, либо текст, без наложения', () => {
    for (let s = min; s <= max; s++) expect([0, 1]).toContain(textAmount(s, base, false));
  });

  it('в режиме «текст всегда» текст виден и издалека', () => {
    expect(textAmount(min, base, true)).toBe(1);
  });
});

describe('печать кода на мониторе', () => {
  const first = WRITTEN_FILES[0]!.f;

  it('начинает с уже написанной части первого файла', () => {
    const m = new MonitorTyping();
    expect(m.fileName).toBe(first.name);
    expect(m.text).toBe(first.code.split('\n').slice(0, first.writtenLines).join('\n') + '\n');
  });

  it('за время печати доходит до конца файла, потом берётся за следующий', () => {
    const m = new MonitorTyping();
    let sawFull = false;
    for (let i = 0; i < 20000 && m.fileName === first.name; i++) {
      m.advance(0.05);
      if (m.text === first.code) sawFull = true;
    }
    expect(sawFull).toBe(true);
    expect(m.fileName).toBe(WRITTEN_FILES[1]!.f.name);
  });

  it('пока печатает, текст растёт, а не прыгает', () => {
    const m = new MonitorTyping();
    const start = m.text.length;
    m.advance(3);
    expect(m.text.length).toBeGreaterThan(start);
    expect(first.code.startsWith(m.text.replace(/[^\n]*$/, ''))).toBe(true);
  });

  it('экран: не больше заданных строк, нет обрезанных строк, видна строка с курсором', () => {
    const m = new MonitorTyping();
    m.advance(20);
    const rows = m.rows(28, 9);
    expect(rows.length).toBeLessThanOrEqual(9);
    for (const r of rows) expect(r.indent + r.tokens.reduce((n, t) => n + t.text.length, 0)).toBeLessThanOrEqual(28);
    expect(rows.some((r) => r.caret !== null)).toBe(true);
    // Номера строк идут по порядку; у перенесённого продолжения номера нет.
    const numbers = rows.flatMap((r) => (r.number === null ? [] : [r.number]));
    for (let i = 1; i < numbers.length; i++) expect(numbers[i]).toBe(numbers[i - 1]! + 1);
  });

  it('продолжение перенесённой строки сдвинуто под её начало, как в редакторе', () => {
    const m = new MonitorTyping();
    m.text = '    tokenHash: await hashToken(token),\n';
    const rows = m.rows(20, 9, 0);
    const cont = rows.find((r) => r.number === null)!;
    expect(cont).toBeDefined();
    expect(cont.indent).toBeGreaterThanOrEqual(4);
  });

  it('без запаса снизу экран заполнен до строки с курсором', () => {
    const m = new MonitorTyping();
    m.advance(30);
    const rows = m.rows(16, 5, 0);
    expect(rows.length).toBe(5);
    expect(rows[4]!.caret).not.toBeNull();
  });
});
