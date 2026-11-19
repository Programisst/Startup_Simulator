// Рекламные каналы: цена пользователя, выгорание, разброс и накопленные статьи.
import { describe, expect, it } from 'vitest';
import { applyCommand, channelEfficiency, channelSpend, contentBoost, marketingView, tick, totalAdSpend, type ChannelId, type GameContent, type GameState } from '../src/core';
import { content } from '../src/content';
import ru from '../src/content/ru/ui.json';
import { deepFreeze, launchedGame, newGame, run } from './helpers';

const mk = content.config.marketing;
const quiet: GameContent = { ...content, events: [], milestones: [] };
const def = (id: ChannelId) => mk.channels.find((c) => c.id === id)!;
const live = (over: Partial<GameState> = {}): GameState => ({ ...launchedGame(), cash: 1e6, capacity: 1e6, users: 1000, modifiers: [], ...over });
const consumer = (): GameState => live({ productType: 'mobile' });
const spend = (s: GameState, channel: ChannelId, perDay: number) => run(s, { type: 'setChannelSpend', channel, perDay });
const days = (s: GameState, n: number) => {
  let x = s;
  for (let i = 0; i < n; i++) x = tick(x, quiet);
  return x;
};

describe('каналы', () => {
  it('их четыре, у каждого есть название и пояснение', () => {
    expect(mk.channels.map((c) => c.id)).toEqual(['search', 'feeds', 'bloggers', 'content']);
    const texts = (ru as unknown as { marketing: { channels: Record<string, { name: string; hint: string }> } }).marketing.channels;
    for (const c of mk.channels) {
      expect(texts[c.id]!.name.length, c.id).toBeGreaterThan(3);
      expect(texts[c.id]!.hint.length, c.id).toBeGreaterThan(20);
      expect(c.halfAt).toBeGreaterThan(0);
    }
  });

  it('поиск — прежний рекламный бюджет: старая команда и старые сохранения работают как раньше', () => {
    const viaOld = run(live(), { type: 'setAdSpend', perDay: 40 });
    const viaNew = spend(live(), 'search', 40);
    expect(viaNew).toEqual(viaOld);
    expect(channelSpend(viaNew, 'search')).toBe(40);
    const old = live({ adSpendPerDay: 40 });
    delete old.adChannels;
    delete old.contentStock;
    expect(totalAdSpend(old)).toBe(40);
    expect(tick(old, quiet).lastDay.adCost).toBe(40);
  });

  it('бюджеты каналов складываются в расход на рекламу', () => {
    let s = spend(live(), 'search', 20);
    s = spend(s, 'feeds', 30);
    s = spend(s, 'content', 10);
    expect(totalAdSpend(s)).toBe(60);
    expect(tick(s, quiet).lastDay.adCost).toBe(60);
    expect(marketingView(s, content.config)).toMatchObject({ totalPerDay: 60, totalPerMonth: 1800 });
  });

  it('недопустимые значения и неизвестный канал отклоняются', () => {
    for (const perDay of [-1, Number.NaN, 1e9]) expect(applyCommand(live(), { type: 'setChannelSpend', channel: 'feeds', perDay }, content)).toEqual({ ok: false, error: 'invalidValue' });
    expect(applyCommand(live(), { type: 'setChannelSpend', channel: 'tv' as ChannelId, perDay: 10 }, content)).toEqual({ ok: false, error: 'invalidValue' });
  });

  it('когда платить нечем, не идёт ни один канал', () => {
    let s = spend(live({ cash: -5 }), 'feeds', 50);
    s = spend(s, 'content', 50);
    const day = tick(s, quiet);
    expect(day.lastDay.adCost).toBe(0);
    expect(day.lastDay.paid).toBe(0);
    expect(day.contentStock).toBe(0);
  });
});

describe('цена пользователя', () => {
  it('лента дешевле поиска для массового продукта и дороже для делового', () => {
    const cost = (s: GameState, id: ChannelId) => marketingView(s, content.config).channels.find((c) => c.id === id)!.baseCostPerUser!;
    expect(cost(consumer(), 'feeds')).toBeLessThan(cost(consumer(), 'search') * 0.8);
    expect(cost(live(), 'feeds')).toBeGreaterThan(cost(live(), 'search') * 1.3);
    expect(marketingView(consumer(), content.config).channels.find((c) => c.id === 'feeds')!.fit).toBe('good');
    expect(marketingView(live(), content.config).channels.find((c) => c.id === 'feeds')!.fit).toBe('poor');
  });

  it('чем больше льёшь в один канал, тем дороже каждый следующий пользователь', () => {
    expect(channelEfficiency(0, def('feeds'))).toBe(1);
    expect(channelEfficiency(def('feeds').halfAt, def('feeds'))).toBeCloseTo(0.5, 6);
    const view = (perDay: number) => marketingView(spend(consumer(), 'feeds', perDay), content.config).channels.find((c) => c.id === 'feeds')!;
    expect(view(240).costPerUser!).toBeGreaterThan(view(20).costPerUser! * 2);
    expect(view(240).usersPerDay).toBeGreaterThan(view(20).usersPerDay);
  });

  it('поделить бюджет между каналами выгоднее, чем вылить всё в один', () => {
    const paid = (s: GameState) => tick(s, quiet).lastDay.paid;
    const oneChannel = spend(live(), 'search', 400);
    const split = spend(spend(live(), 'search', 200), 'bloggers', 200);
    // У блогеров результат гуляет, поэтому сравниваем среднее за много дней с разными seed.
    const avg = (make: (seed: number) => GameState) => Array.from({ length: 40 }, (_, i) => paid(make(i + 1))).reduce((a, b) => a + b, 0) / 40;
    expect(avg((seed) => ({ ...split, rng: seed * 7919 }))).toBeGreaterThan(avg((seed) => ({ ...oneChannel, rng: seed * 7919 })) * 1.15);
  });

  it('сводка сходится с расчётом дня для предсказуемого канала', () => {
    const s = spend(consumer(), 'search', 50);
    const expected = marketingView(s, content.config).channels[0]!.usersPerDay;
    const noNoise: GameContent = { ...quiet, config: { ...content.config, pace: { ...content.config.pace, acquisition: 1 } } };
    // В шаге дня есть общий разброс притока ±10%.
    const got = tick(s, noNoise).lastDay.paid;
    expect(got / expected).toBeGreaterThan(0.89);
    expect(got / expected).toBeLessThan(1.11);
  });
});

describe('блогеры: как повезёт', () => {
  it('результат гуляет изо дня в день сильнее, чем у поиска', () => {
    const spread = (channel: ChannelId) => {
      let s = spend(live(), channel, 100);
      const values: number[] = [];
      for (let i = 0; i < 60; i++) {
        s = { ...tick(s, quiet), users: 1000, paying: 0 };
        values.push(s.lastDay.paid);
      }
      return (Math.max(...values) - Math.min(...values)) / (values.reduce((a, b) => a + b, 0) / values.length);
    };
    expect(spread('bloggers')).toBeGreaterThan(spread('search') * 2);
    expect(marketingView(live(), content.config).channels.find((c) => c.id === 'bloggers')!.unpredictable).toBe(true);
  });

  it('пока в непредсказуемые каналы ничего не вложено, случайность партии идёт как раньше', () => {
    const plain = days(spend(live(), 'search', 50), 30);
    const withContent = days(spend(spend(live(), 'search', 50), 'content', 20), 30);
    expect(withContent.rng).toBe(plain.rng);
    expect(days(spend(live(), 'bloggers', 20), 30).rng).not.toBe(days(live(), 30).rng);
  });
});

describe('статьи и гайды', () => {
  it('сегодня людей не приводят, но копятся и поднимают приток «нашли сами»', () => {
    const s = spend(live(), 'content', 100);
    const first = tick(s, quiet);
    expect(first.lastDay.paid).toBe(0);
    expect(first.contentStock).toBeGreaterThan(0);
    const later = days(s, 90);
    expect(contentBoost(later, mk)).toBeGreaterThan(1.3);
    const organic = (x: GameState) => tick({ ...x, users: 1000, reputation: 50 }, quiet).lastDay.organic;
    expect(organic(later) / organic({ ...later, contentStock: 0 })).toBeCloseTo(contentBoost(later, mk), 2);
  });

  it('прибавка ограничена потолком, а без вложений запас устаревает', () => {
    const huge = live({ contentStock: 1e9 });
    expect(contentBoost(huge, mk)).toBe(1 + mk.contentCap);
    const stocked = live({ contentStock: mk.contentPerDouble });
    expect(contentBoost(stocked, mk)).toBeCloseTo(2, 6);
    const afterYear = days(stocked, 360);
    expect(afterYear.contentStock!).toBeLessThan(mk.contentPerDouble * 0.05);
    expect(marketingView(stocked, content.config)).toMatchObject({ contentStock: mk.contentPerDouble, contentBoost: 1, contentCap: mk.contentCap });
  });

  it('до запуска продукта статьи не пишутся и деньги не тратятся', () => {
    const s = spend({ ...newGame(), cash: 1e6 }, 'content', 100);
    const day = tick(s, quiet);
    expect(day.lastDay.adCost).toBe(0);
    expect(day.contentStock ?? 0).toBe(0);
  });
});

describe('надёжность', () => {
  it('команда и сводка не меняют исходное состояние', () => {
    const s = deepFreeze(live());
    spend(s, 'feeds', 10);
    expect(marketingView(s, content.config)).toEqual(marketingView(s, content.config));
    tick(s, quiet);
  });
});
