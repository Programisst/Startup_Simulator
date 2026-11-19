// Быстрый вход для разработчиков: ссылка ?skip сразу ведёт в квартиру, а в переписке подставлены прошлые ответы.
// Без своих ответов ?skip берёт простой образец. Обычный игрок этого не видит (только при разработке).
import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { createGame } from '../src/core';
import i18n from '../src/ui/i18n';
import { lastAnswers, quickSetup, rememberAnswer, sampleAnswers, wantsSkip } from '../src/ui/opening/quick';

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
  it('?skip в ссылке — пропустить заставку и переписку', () => {
    expect(wantsSkip('?skip')).toBe(true);
    expect(wantsSkip('?skip=1')).toBe(true);
    expect(wantsSkip('')).toBe(false);
    expect(wantsSkip('?lang=ru')).toBe(false);
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
  });

  it('свои ответы важнее образца', () => {
    const setup = quickSetup({ idea: 'Мобильное приложение-трекер привычек: сон, вода, зарядка', name: 'Привычка' }, sampleAnswers(i18n.t.bind(i18n)), 1);
    expect(setup.companyName).toBe('Привычка');
    expect(setup.idea).toContain('трекер');
    expect(setup.productType).toBe('mobile');
  });
});
