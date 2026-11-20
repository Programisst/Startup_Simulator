// Покупка компаний: готовые пользователи и новый рынок за деньги — если внутри не пустышка.
import { describe, expect, it } from 'vitest';
import { acquisitionsView, applyCommand, targetNow, targetOfWindow, tick, type GameContent, type GameState, type TargetDef, type TargetHealth } from '../src/core';
import { content } from '../src/content';
import { deepFreeze, launchedGame, newGame, run } from './helpers';

const cfg = content.config;
const a = cfg.acquisitions;
const quiet: GameContent = { ...content, events: [], milestones: [] };
const sizeDef = (id: TargetDef['size']) => a.sizes.find((x) => x.id === id)!;
const healthDef = (id: TargetHealth) => a.health.find((x) => x.id === id)!;
const round100 = (x: number) => Math.round(x / 100) * 100;

const earning = (s: GameState, perDay: number): GameState => ({
  ...s,
  recentDays: Array.from({ length: 30 }, (_, i) => ({ day: s.day - 30 + i, cash: s.cash, users: s.users, paying: s.paying, revenue: perDay, expenses: 0 })),
});

/** Крепкая компания в первый день периода: на продажу кто-то выставлен. Доход за 30 дней — $60 000. */
const live = (over: Partial<GameState> = {}): GameState => {
  const base = launchedGame();
  const day = Math.ceil(base.day / a.periodDays) * a.periodDays;
  return earning({ ...base, day, cash: 5e6, users: 10_000, paying: 1000, capacity: 1e6, bugs: 0, debt: 0, reputation: 50, modifiers: [], ...over }, 2000);
};

/** Партия, в которой на продажу выставлена компания с нужным нутром (и, если задано, размером). */
const withTarget = (health: TargetHealth, size?: TargetDef['size'], over: Partial<GameState> = {}): GameState => {
  for (let seed = 1; seed < 500; seed++) {
    const s = { ...live(over), seed };
    const t = targetNow(s, cfg)!;
    if (t.health === health && (!size || t.size === size)) return s;
  }
  throw new Error('не нашлось подходящей партии');
};
const days = (s: GameState, n: number): GameState => {
  let x = s;
  for (let i = 0; i < n; i++) x = tick(x, quiet);
  return x;
};
const buy = (s: GameState): GameState => run(s, { type: 'buyTarget', offer: 'full' });

describe('компания на продажу', () => {
  it('зависит только от партии и периода; встречаются все размеры и все три «нутра» примерно с обещанной частотой', () => {
    const seen = { small: 0, medium: 0, large: 0, solid: 0, messy: 0, hollow: 0 };
    const n = 2000;
    for (let w = 0; w < n; w++) {
      const t = targetOfWindow(11, w, cfg);
      expect(targetOfWindow(11, w, cfg)).toEqual(t);
      expect(t.companySeed).toBeLessThan(a.companies);
      seen[t.size] += 1;
      seen[t.health] += 1;
    }
    expect(Math.abs(seen.solid / n - 0.45)).toBeLessThan(0.04);
    expect(Math.abs(seen.messy / n - 0.35)).toBeLessThan(0.04);
    expect(Math.abs(seen.hollow / n - 0.2)).toBeLessThan(0.04);
    expect(Math.abs(seen.small / n - 0.5)).toBeLessThan(0.04);
    expect(seen.large).toBeGreaterThan(0);
  });

  it('цена — год вашего дохода с такого числа пользователей; что внутри, сводка не выдаёт', () => {
    const s = withTarget('hollow', 'medium');
    const view = acquisitionsView(s, content);
    expect(view).toMatchObject({ unlocked: true, blocked: null, nextInDays: null });
    const t = view.target!;
    expect(t).toMatchObject({ size: 'medium', users: 1500, price: round100(60_000 * 0.15 * a.priceMonths), health: null, daysLeft: a.visibleDays, canBuyFull: true, overload: false });
    expect(t.lowPrice).toBe(round100(t.price * a.lowOffer));
    expect(t.check).toMatchObject({ state: 'none', cost: round100(t.price * a.checkCostShare), days: a.checkDays, blocked: null });
    expect(t.outcomes.map((o) => [o.health, o.oddsPct, o.users])).toEqual([
      ['solid', 45, 1500],
      ['messy', 35, 750],
      ['hollow', 20, 150],
    ]);
    expect(t.outcomes.map((o) => o.hiddenDebt)).toEqual([0, 0, round100(t.price * healthDef('hollow').hiddenDebt)]);
    expect(t.outcomes[0]!.market).toBe(1500 * a.marketPerUser);
    expect(JSON.stringify({ ...view, target: { ...t, outcomes: [] } })).not.toContain('hollow');
  });

  it('ждёт ограниченное время; маленькой компании никого не предлагают', () => {
    const s = live();
    expect(acquisitionsView({ ...s, day: s.day + a.visibleDays - 1 }, content).target).not.toBeNull();
    expect(acquisitionsView({ ...s, day: s.day + a.visibleDays }, content)).toMatchObject({ target: null, blocked: 'waiting', nextInDays: a.periodDays - a.visibleDays });
    const small = earning(live(), 100);
    expect(acquisitionsView(small, content)).toMatchObject({ unlocked: false, target: null, blocked: 'locked', nextInDays: null });
    expect(applyCommand(small, { type: 'buyTarget', offer: 'full' }, content)).toEqual({ ok: false, error: 'acquisitionUnavailable' });
    expect(acquisitionsView({ ...newGame(), cash: 1e7 }, content).unlocked).toBe(false);
  });

  it('предупреждает, если серверы не выдержат новых людей', () => {
    expect(acquisitionsView(live({ capacity: 10_100 }), content).target!.overload).toBe(true);
  });

  it('предупреждает, если продукт ещё не оправился от прошлых проблем', () => {
    expect(acquisitionsView(live(), content).target!.strained).toBe(false);
    expect(acquisitionsView(live({ bugs: a.strainBugs }), content).target!.strained).toBe(true);
    expect(acquisitionsView(live({ debt: a.strainDebt }), content).target!.strained).toBe(true);
  });
});

describe('проверка', () => {
  it('стоит денег и времени, зато показывает, что внутри', () => {
    const s = withTarget('messy');
    const cost = acquisitionsView(s, content).target!.check.cost;
    const ordered = run(s, { type: 'checkTarget' });
    expect(ordered.cash).toBe(s.cash - cost);
    expect(acquisitionsView(ordered, content).target).toMatchObject({ health: null, check: { state: 'running', daysLeft: a.checkDays } });
    expect(applyCommand(ordered, { type: 'checkTarget' }, content).ok).toBe(false);
    const ready = days(ordered, a.checkDays);
    const t = acquisitionsView(earning(ready, 2000), content).target!;
    expect(t).toMatchObject({ health: 'messy', check: { state: 'done' } });
    // Владельцы компании с проблемами сговорчивее с тем, кто о проблемах знает.
    expect(t.lowChancePct).toBe(Math.round(a.lowChanceWeak * 100));
    expect(acquisitionsView(s, content).target!.lowChancePct).toBe(Math.round(a.lowChance * 100));
  });

  it('здоровую компанию проверка сговорчивее не делает', () => {
    const ready = days(run(withTarget('solid'), { type: 'checkTarget' }), a.checkDays);
    expect(acquisitionsView(earning(ready, 2000), content).target).toMatchObject({ health: 'solid', lowChancePct: Math.round(a.lowChance * 100) });
  });

  it('нельзя заказать без денег и когда она уже не успеет', () => {
    const poor = live({ cash: 10 });
    expect(acquisitionsView(poor, content).target!.check.blocked).toBe('cash');
    expect(applyCommand(poor, { type: 'checkTarget' }, content).ok).toBe(false);
    const late = { ...live(), day: live().day + a.visibleDays - a.checkDays };
    expect(acquisitionsView(late, content).target!.check.blocked).toBe('late');
    expect(applyCommand(late, { type: 'checkTarget' }, content).ok).toBe(false);
  });
});

describe('покупка', () => {
  it('деньги уходят сразу, пользователи приходят после присоединения', () => {
    const s = withTarget('solid', 'medium');
    const price = acquisitionsView(s, content).target!.price;
    const bought = buy(s);
    expect(bought.cash).toBe(s.cash - price);
    expect(bought.users).toBe(s.users);
    expect(acquisitionsView(bought, content)).toMatchObject({ target: null, blocked: 'integrating', integrating: { users: 1500, price, daysLeft: a.integrationDays } });
    expect(applyCommand(bought, { type: 'buyTarget', offer: 'full' }, content).ok).toBe(false);
    expect(days(bought, a.integrationDays - 1).acquisitions!.integrating).not.toBeNull();
  });

  const outcome = (health: TargetHealth, size: TargetDef['size'] = 'medium') => {
    const s = withTarget(health, size);
    const plain = days(s, a.integrationDays);
    const done = days(buy(s), a.integrationDays);
    return { s, plain, done };
  };

  it('здоровая компания: все пользователи переходят, платящих и рынка становится больше, репутация растёт', () => {
    const { s, plain, done } = outcome('solid');
    expect(done.users - plain.users).toBeCloseTo(1500, 0);
    // Платящие переходят в той же доле, что у нас на день присоединения (она успевает немного вырасти).
    expect(done.paying - plain.paying).toBeGreaterThan(145);
    expect(done.paying - plain.paying).toBeLessThan(170);
    expect(done.market.marketSize - s.market.marketSize).toBe(1500 * a.marketPerUser);
    expect(done.bugs - plain.bugs).toBe(healthDef('solid').bugs);
    expect(done.cash - plain.cash).toBeCloseTo(-acquisitionsView(s, content).target!.price, -2);
    expect(done.reputation - plain.reputation).toBeCloseTo(healthDef('solid').reputation, 6);
    expect(done.acquisitions).toMatchObject({ integrating: null, bought: 1, last: { kind: 'joined', health: 'solid', users: 1500 } });
    expect((done.news ?? []).find((n) => n.kind === 'acquisition')).toMatchObject({ id: 'solid', tone: 'good', value: 1500 });
  });

  it('компания с проблемами: переходит часть людей, прибавляются ошибки и долг', () => {
    const { plain, done } = outcome('messy');
    expect(done.users - plain.users).toBeCloseTo(750, 0);
    expect(done.bugs - plain.bugs).toBe(healthDef('messy').bugs);
    expect(done.debt - plain.debt).toBeCloseTo(healthDef('messy').debt, 6);
    expect((done.news ?? []).find((n) => n.kind === 'acquisition')).toMatchObject({ id: 'messy', tone: 'mixed', value: 750 });
  });

  it('пустышка: людей почти нет, репутация падает, всплывают чужие долги', () => {
    const { s, plain, done } = outcome('hollow');
    expect(done.users - plain.users).toBeCloseTo(150, 0);
    const price = acquisitionsView(s, content).target!.price;
    expect(plain.cash - done.cash).toBeCloseTo(price * (1 + healthDef('hollow').hiddenDebt), -2);
    expect(done.reputation - plain.reputation).toBeCloseTo(healthDef('hollow').reputation, 6);
    expect(done.market.marketSize - s.market.marketSize).toBe(150 * a.marketPerUser);
    expect((done.news ?? []).find((n) => n.kind === 'acquisition')).toMatchObject({ id: 'hollow', tone: 'bad', value: 150 });
  });

  it('у крупной компании и хлопот больше', () => {
    const big = outcome('messy', 'large');
    expect(big.done.bugs - big.plain.bugs).toBe(Math.round(healthDef('messy').bugs * sizeDef('large').trouble));
    expect(big.done.users - big.plain.users).toBeCloseTo(3500 * healthDef('messy').keep, 0);
  });

  it('новым людям на упёршемся в потолок рынке есть куда расти', () => {
    const s = withTarget('solid', 'large');
    const full = { ...s, market: { ...s.market, marketSize: s.users } };
    const stuck = days(full, a.integrationDays + 5);
    const grown = days(buy(full), a.integrationDays + 5);
    expect(stuck.users).toBeLessThanOrEqual(full.users);
    // Рынок стал шире — и новых людей в день приходит заметно больше, чем на прежнем потолке.
    expect(grown.lastDay.newUsers).toBeGreaterThan(stuck.lastDay.newUsers * 1.5);
  });

  it('после покупки следующую компанию предложат только в новом периоде', () => {
    const s = withTarget('solid');
    const done = days(buy(s), a.integrationDays);
    expect(acquisitionsView(earning(done, 2000), content)).toMatchObject({ target: null, blocked: 'waiting' });
    const next = { ...earning(done, 2000), day: s.day + a.periodDays };
    expect(acquisitionsView(next, content).target).not.toBeNull();
  });

  it('без денег купить нельзя', () => {
    const poor = live({ cash: 10 });
    expect(acquisitionsView(poor, content).target).toMatchObject({ canBuyFull: false, canBuyLow: false });
    expect(applyCommand(poor, { type: 'buyTarget', offer: 'full' }, content).ok).toBe(false);
    expect(applyCommand(poor, { type: 'buyTarget', offer: 'low' }, content).ok).toBe(false);
    expect(applyCommand(live(), { type: 'buyTarget', offer: 'даром' as 'low' }, content).ok).toBe(false);
  });
});

describe('предложить меньше', () => {
  it('согласились — покупка дешевле; обиделись — компания снята с продажи, деньги целы', () => {
    let accepted = 0;
    const games = 400;
    for (let seed = 1; seed <= games; seed++) {
      const s = { ...live(), seed };
      const t = acquisitionsView(s, content).target!;
      const after = run(s, { type: 'buyTarget', offer: 'low' });
      if (after.acquisitions!.integrating) {
        accepted += 1;
        expect(after.cash).toBe(s.cash - t.lowPrice);
        expect(after.acquisitions!.integrating.price).toBe(t.lowPrice);
      } else {
        expect(after.cash).toBe(s.cash);
        expect(acquisitionsView(after, content)).toMatchObject({ target: null, blocked: 'waiting', last: { kind: 'refused', companySeed: t.companySeed } });
        expect((after.news ?? []).at(-1)).toMatchObject({ kind: 'acquisition', id: 'refused', tone: 'bad' });
      }
    }
    expect(Math.abs(accepted / games - a.lowChance)).toBeLessThan(0.07);
  });

  it('после проверки, нашедшей проблемы, соглашаются заметно чаще', () => {
    let accepted = 0;
    let games = 0;
    for (let seed = 1; seed <= 1200 && games < 300; seed++) {
      const s = { ...live(), seed };
      if (targetNow(s, cfg)!.health === 'solid') continue;
      games += 1;
      const ready = earning(days(run(s, { type: 'checkTarget' }), a.checkDays), 2000);
      if (run(ready, { type: 'buyTarget', offer: 'low' }).acquisitions!.integrating) accepted += 1;
    }
    expect(Math.abs(accepted / games - a.lowChanceWeak)).toBeLessThan(0.08);
  });
});

describe('надёжность', () => {
  it('партия без покупок идёт точно как раньше, поле в сохранении не появляется', () => {
    const s = days(live(), 70);
    expect(s.acquisitions).toBeUndefined();
  });

  it('проверка и отказ продавца не сдвигают случайность партии', () => {
    const s = live();
    const checked = run(s, { type: 'checkTarget' });
    expect(checked.rng).toBe(s.rng);
    expect(run(s, { type: 'buyTarget', offer: 'low' }).rng).toBe(s.rng);
    expect(days(checked, 5).rng).toBe(days(s, 5).rng);
  });

  it('старое сохранение открывается; сводка и команды не меняют исходное состояние', () => {
    const old = live();
    delete old.acquisitions;
    expect(acquisitionsView(old, content)).toMatchObject({ integrating: null, last: null, bought: 0 });
    const frozen = deepFreeze(live());
    acquisitionsView(frozen, content);
    run(frozen, { type: 'checkTarget' });
    deepFreeze(buy(frozen));
  });
});
