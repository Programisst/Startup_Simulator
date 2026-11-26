// @vitest-environment jsdom
// Набор кода игроком: код в редакторе не кончается, а нажатие весит одинаково на любой скорости игры.
import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { Actions } from '../src/ui/apartment/laptop/actions';
import { repairPrefix } from '../src/ui/apartment/laptop/logic';
import { PROJECT_FILES, WRITTEN_FILES } from '../src/ui/apartment/laptop/project';
import { LaptopStore } from '../src/ui/apartment/laptop/store';
import { typedWeight } from '../src/ui/office/GameRoom';
import { DAY_MS } from '../src/ui/store';

describe('редактор кода: код не кончается', () => {
  it('каждое нажатие что-то печатает — и после 39-й строки, и после последнего файла', () => {
    const store = new LaptopStore();
    const actions = new Actions(store);
    actions.openFile(WRITTEN_FILES[0]!.i);
    const visited = new Set<number>();
    let restarts = 0;
    let longest = 0;
    for (let i = 0; i < 6000; i++) {
      const before = store.get();
      const total = before.texts.reduce((sum, t) => sum + t.length, 0);
      actions.typeCode();
      const after = store.get();
      visited.add(after.fileIndex);
      const now = after.texts.reduce((sum, t) => sum + t.length, 0);
      // Текста стало больше — или все файлы дописаны и работа началась заново.
      if (now < total) restarts++;
      else expect(now, `нажатие ${i}`).toBeGreaterThan(total);
      longest = Math.max(longest, (after.texts[after.fileIndex] ?? '').split('\n').length);
    }
    // Игрок прошёл все файлы, которые пишет основатель, и не один раз.
    expect([...visited].sort()).toEqual(WRITTEN_FILES.map(({ i }) => i).sort());
    expect(restarts).toBeGreaterThanOrEqual(2);
    expect(longest).toBeGreaterThanOrEqual(39);
  });

  it('файл дописан — следующее нажатие открывает недописанный файл и печатает уже в нём', () => {
    const store = new LaptopStore();
    const actions = new Actions(store);
    const first = WRITTEN_FILES[0]!;
    actions.openFile(first.i);
    store.set((s) => ({ texts: s.texts.map((t, i) => (i === first.i ? first.f.code : t)) }));
    const before = store.get().texts;
    actions.typeCode();
    const s = store.get();
    expect(s.fileIndex).not.toBe(first.i);
    expect(s.openFiles).toContain(s.fileIndex);
    expect((s.texts[s.fileIndex] ?? '').length).toBeGreaterThan((before[s.fileIndex] ?? '').length);
    // Дописанный файл остался как был.
    expect(repairPrefix(s.texts[first.i] ?? '', first.f.code)).toBe(first.f.code);
  });
});

describe('редактор кода: печатать всегда есть где', () => {
  it('открыт готовый файл или не открыт никакой — нажатие переходит к файлу, который пишет основатель', () => {
    for (const start of [PROJECT_FILES.findIndex((f) => f.static), -1]) {
      const store = new LaptopStore();
      const actions = new Actions(store);
      store.set({ fileIndex: start });
      const before = store.get().texts.reduce((sum, t) => sum + t.length, 0);
      actions.typeCode();
      const s = store.get();
      expect(WRITTEN_FILES.map(({ i }) => i)).toContain(s.fileIndex);
      expect(s.texts.reduce((sum, t) => sum + t.length, 0)).toBeGreaterThan(before);
    }
  });
});

describe('вес нажатия не зависит от скорости игры', () => {
  it('два нажатия в секунду дают полную дневную норму на любой скорости', () => {
    const norm = content.config.founder.typeCharsPerDay;
    for (const speed of [1, 2, 5]) {
      const secondsPerDay = DAY_MS / speed / 1000;
      const typed = 2 * secondsPerDay * typedWeight(speed);
      expect(typed, `скорость ${speed}`).toBeGreaterThanOrEqual(norm);
      // И не вдвое легче, чем на обычной скорости.
      expect(typed, `скорость ${speed}`).toBeLessThanOrEqual(norm * 1.01);
    }
  });

  it('на паузе нажатие весит как на обычной скорости', () => {
    expect(typedWeight(0)).toBe(1);
    expect(typedWeight(1)).toBe(1);
  });
});
