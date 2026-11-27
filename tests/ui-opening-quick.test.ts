// Быстрый вход для разработчиков: при `npm run dev` игра сразу ведёт в квартиру (переписка — по ссылке ?story),
// а в переписке подставлены прошлые ответы. Без своих ответов берётся простой образец. Обычный игрок этого не видит.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { createGame } from '../src/core';
import i18n from '../src/ui/i18n';
import { lastAnswers, quickSetup, rememberAnswer, sampleAnswers, wantedCity, wantsSkip } from '../src/ui/opening/quick';

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

const broken = {
  getItem: () => {
    throw new Error('нет доступа');
  },
  setItem: () => {
    throw new Error('нет доступа');
  },
} as unknown as Storage;

describe('быстрый вход для тестов', () => {
  it('при разработке заставка и переписка пропускаются всегда; ?story — показать их', () => {
    expect(wantsSkip('')).toBe(true);
    expect(wantsSkip('?skip')).toBe(true);
    expect(wantsSkip('?lang=ru')).toBe(true);
    expect(wantsSkip('?story')).toBe(false);
    expect(wantsSkip('?story=1&lang=ru')).toBe(false);
  });

  it('пропуск — только в режиме разработки: в собранной игре переписка на месте', () => {
    const root = readFileSync(join(__dirname, '../src/ui/Root.tsx'), 'utf-8');
    expect(root).toContain('import.meta.env.DEV && wantsSkip(');
  });

  it('ответы в переписке запоминаются и подставляются в следующий раз', () => {
    const store = memory();
    expect(lastAnswers(store)).toEqual({});
    rememberAnswer('idea', 'Сервис для кафе', store);
    rememberAnswer('name', 'Счётчик', store);
    expect(lastAnswers(store)).toEqual({ idea: 'Сервис для кафе', name: 'Счётчик' });
  });

  it('хранилище недоступно — ничего не ломается', () => {
    expect(lastAnswers(broken)).toEqual({});
    expect(() => rememberAnswer('idea', 'x', broken)).not.toThrow();
  });

  it('образец — простая идея, тексты есть в переводе', () => {
    const sample = sampleAnswers(i18n.t.bind(i18n));
    expect(sample.name).toBe('Соседская кухня');
    expect(sample.idea.length).toBeGreaterThan(12);
    expect(sample.audience.length).toBeGreaterThan(12);
  });

  it('без своих ответов партия собирается из образца: площадка, средний бюджет, цель — прибыль', () => {
    const setup = quickSetup({}, sampleAnswers(i18n.t.bind(i18n)), 7);
    expect(setup.companyName).toBe('Соседская кухня');
    expect(setup.productType).toBe('marketplace');
    expect(setup.difficulty).toBe('normal');
    expect(content.difficulties[setup.difficulty].startCash).toBe(3000);
    expect(setup.goal).toBe('profit');
    expect(setup.seed).toBe(7);
    expect(() => createGame(setup, content)).not.toThrow();
    // Город — обычный (первый в списке): партия идёт уже с городом.
    expect(setup.cityId).toBe(content.cities[0]!.id);
    expect(createGame(setup, content).city?.id).toBe(content.cities[0]!.id);
  });

  it('город можно назвать в ссылке (?city=sanJose); неизвестный город — обычный', () => {
    const sample = sampleAnswers(i18n.t.bind(i18n));
    expect(wantedCity('?city=sanJose')).toBe('sanJose');
    expect(wantedCity('?story')).toBeUndefined();
    expect(quickSetup({}, sample, 7, 'sanJose').cityId).toBe('sanJose');
    const fallback = quickSetup({}, sample, 7, 'atlantis');
    expect(fallback.cityId).toBe(content.cities[0]!.id);
    expect(fallback.goal).toBe('profit');
  });

  it('свои ответы важнее образца', () => {
    const setup = quickSetup({ idea: 'Мобильное приложение-трекер привычек: сон, вода, зарядка', name: 'Привычка' }, sampleAnswers(i18n.t.bind(i18n)), 1);
    expect(setup.companyName).toBe('Привычка');
    expect(setup.idea).toContain('трекер');
    expect(setup.productType).toBe('mobile');
  });
});
