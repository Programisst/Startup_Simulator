import { describe, expect, it } from 'vitest';
import { applyCommand, tick, type GameState } from '../src/core';
import { content } from '../src/content';
import { advance, deepFreeze, launchedGame, newGame, run } from './helpers';

function playScript(seed: number): GameState {
  let s = launchedGame({ seed });
  s = run(s, { type: 'queueFeature', featureId: 'dashboard' });
  s = run(s, { type: 'setAdSpend', perDay: 20 });
  return advance(s, 200);
}

describe('повторяемость', () => {
  it('одинаковый seed и одинаковые команды дают одинаковую партию', () => {
    expect(playScript(7)).toEqual(playScript(7));
  });

  it('другой seed даёт другую партию', () => {
    expect(playScript(7).users).not.toBe(playScript(8).users);
  });

  it('шаг дня и команды не изменяют старое состояние', () => {
    let s = deepFreeze(launchedGame());
    s = deepFreeze(run(s, { type: 'queueFeature', featureId: 'dashboard' }));
    for (let i = 0; i < 120; i++) {
      if (s.pendingEvent !== null) {
        const def = content.events.find((e) => e.id === s.pendingEvent)!;
        s = deepFreeze(run(s, { type: 'chooseEvent', choiceId: def.choices[0]!.id }));
      }
      s = deepFreeze(tick(s, content));
    }
    expect(s.day).toBeGreaterThan(100);
  });

  it('сохранение в JSON и обратно не меняет дальнейший ход партии', () => {
    const mid = playScript(11);
    const restored = JSON.parse(JSON.stringify(mid)) as GameState;
    expect(restored).toEqual(mid);
    expect(advance(restored, 60)).toEqual(advance(mid, 60));
  });
});

describe('разработка', () => {
  it('функция готова через число дней, равное её стоимости', () => {
    let s = run(newGame(), { type: 'queueFeature', featureId: 'core' });
    s = advance(s, 24);
    expect(s.doneFeatures).toEqual([]);
    s = advance(s, 1);
    expect(s.doneFeatures).toEqual(['core']);
    expect(s.bugs).toBeGreaterThanOrEqual(1);
    expect(s.quality).toBeGreaterThan(0);
  });

  it('спешка быстрее, но даёт больше технического долга', () => {
    const normal = advance(run(newGame(), { type: 'queueFeature', featureId: 'core' }), 18);
    let rushed = run(newGame(), { type: 'setRush', rush: true });
    rushed = advance(run(rushed, { type: 'queueFeature', featureId: 'core' }), 18);
    expect(normal.doneFeatures).toEqual([]);
    expect(rushed.doneFeatures).toEqual(['core']);
    expect(rushed.debt).toBe(8);
  });

  it('починка убирает ошибки', () => {
    let s = advance(run(newGame(), { type: 'queueFeature', featureId: 'core' }), 25);
    const bugs = s.bugs;
    s = advance(run(s, { type: 'startBugfix' }), bugs * 2);
    expect(s.bugs).toBe(0);
    expect(s.tasks).toEqual([]);
  });

  it('без основы продукта нельзя запуститься и делать другие функции', () => {
    const s = newGame();
    expect(applyCommand(s, { type: 'launch' }, content)).toEqual({ ok: false, error: 'coreFeatureRequired' });
    expect(applyCommand(s, { type: 'queueFeature', featureId: 'api' }, content)).toEqual({
      ok: false,
      error: 'coreFeatureRequired',
    });
  });
});

describe('пользователи и деньги', () => {
  it('до запуска пользователей нет, деньги уходят на жизнь, серверы и инструменты', () => {
    const s = advance(newGame(), 30);
    expect(s.users).toBe(0);
    const expected = 3000 - 800 - 40 - 100 * 0.05;
    expect(s.cash).toBeCloseTo(expected, 0);
  });

  it('после запуска появляются пользователи, платящие и доход', () => {
    let s = launchedGame();
    s = run(s, { type: 'queueFeature', featureId: 'dashboard' });
    s = run(s, { type: 'queueFeature', featureId: 'teamAccounts' });
    s = advance(run(s, { type: 'setAdSpend', perDay: 15 }), 150);
    expect(s.users).toBeGreaterThan(10);
    expect(s.paying).toBeGreaterThan(0);
    expect(s.paying).toBeLessThanOrEqual(s.users);
    expect(s.lastDay.revenue).toBeGreaterThan(0);
    expect(s.months.length).toBeGreaterThanOrEqual(5);
  });

  it('плохой продукт с рекламой теряет больше пользователей, чем хороший', () => {
    const bad = advance(run(launchedGame(), { type: 'setAdSpend', perDay: 30 }), 60);
    let good = launchedGame();
    good = { ...good, doneFeatures: content.features.saas.map((f) => f.id), bugs: 0 };
    good = advance(run(good, { type: 'setAdSpend', perDay: 30 }), 60);
    const lossShare = (s: GameState) => s.lastDay.churned / s.users;
    expect(lossShare(bad)).toBeGreaterThan(lossShare(good) * 1.5);
  });

  it('перегрузка серверов роняет репутацию', () => {
    const base = { ...launchedGame(), users: 5000, reputation: 60 };
    const fine = advance(run(base, { type: 'setCapacity', capacity: 10_000 }), 30);
    const overloaded = advance(run(base, { type: 'setCapacity', capacity: 2000 }), 30);
    expect(overloaded.reputation).toBeLessThan(fine.reputation);
    expect(overloaded.users).toBeLessThan(fine.users);
  });

  it('некорректные значения команд отклоняются', () => {
    const s = newGame();
    expect(applyCommand(s, { type: 'setAdSpend', perDay: -5 }, content).ok).toBe(false);
    expect(applyCommand(s, { type: 'setAdSpend', perDay: Number.NaN }, content).ok).toBe(false);
    expect(applyCommand(s, { type: 'setCapacity', capacity: 123 }, content).ok).toBe(false);
    expect(applyCommand(s, { type: 'queueFeature', featureId: 'nope' }, content).ok).toBe(false);
  });
});

describe('подработка, улучшение продукта и сложность', () => {
  it('подработка приносит деньги и замедляет разработку', () => {
    let s = run(newGame(), { type: 'setSideJob', share: 0.5 });
    s = advance(run(s, { type: 'queueFeature', featureId: 'core' }), 30);
    expect(s.doneFeatures).toEqual([]);
    expect(s.cash).toBeCloseTo(3000 - 800 - 40 - 5 + 600, 0);
    expect(s.months[0]?.sideIncome).toBeCloseTo(600, 0);
    s = advance(s, 20);
    expect(s.doneFeatures).toEqual(['core']);
    expect(applyCommand(s, { type: 'setSideJob', share: 0.3 }, content).ok).toBe(false);
  });

  it('улучшение продукта повышает качество и не заканчивается само', () => {
    let s = launchedGame();
    const before = advance(s, 1).quality;
    s = advance(run(s, { type: 'startPolish' }), 50);
    expect(s.polish).toBe(10);
    expect(s.quality).toBeGreaterThan(before);
    expect(s.tasks[0]?.kind).toBe('polish');
  });

  it('сложность меняет стартовые условия', () => {
    const easy = newGame({ difficulty: 'easy' });
    const hard = newGame({ difficulty: 'hard' });
    expect(easy.cash).toBe(6000);
    expect(hard.cash).toBe(2000);
    expect(hard.livingCostPerMonth).toBeGreaterThan(easy.livingCostPerMonth);
    expect(hard.market.cacBase).toBeGreaterThan(easy.market.cacBase);
  });
});

describe('события, кассовый разрыв и конец партии', () => {
  it('при минусе на счёте сразу приходит событие о спасении, время стоит до ответа', () => {
    let s: GameState = { ...newGame(), cash: 1 };
    s = tick(s, content);
    expect(s.cash).toBeLessThan(0);
    expect(s.pendingEvent).toBe('cashCrisis');
    expect(tick(s, content)).toBe(s);
    s = run(s, { type: 'chooseEvent', choiceId: 'takeLoan' });
    expect(s.pendingEvent).toBeNull();
    expect(s.cash).toBeGreaterThan(4900);
    expect(s.loans).toHaveLength(1);
    expect(s.eventLog[0]?.choiceId).toBe('takeLoan');
  });

  it('заём возвращается с процентами', () => {
    let s: GameState = { ...newGame(), cash: 1 };
    s = run(tick(s, content), { type: 'chooseEvent', choiceId: 'takeLoan' });
    s = tick(s, content);
    expect(s.lastDay.loanCost).toBeCloseTo((5000 * 1.4) / 180, 6);
  });

  it('30 дней подряд с минусом — банкротство', () => {
    let s: GameState = { ...newGame(), cash: -100 };
    s = run(tick(s, content), { type: 'chooseEvent', choiceId: 'holdOn' });
    s = advance(s, 28);
    expect(s.status).toBe('running');
    s = advance(s, 1);
    expect(s.status).toBe('bankrupt');
    expect(tick(s, content)).toBe(s);
    expect(applyCommand(s, { type: 'setPrice', price: 10 }, content)).toEqual({ ok: false, error: 'gameOver' });
  });

  it('цель «прибыль» выполняется после трёх прибыльных месяцев подряд', () => {
    let s: GameState = { ...launchedGame({ goal: 'profit' }), users: 2000, paying: 1000, capacity: 2000 };
    s = { ...s, doneFeatures: content.features.saas.map((f) => f.id), bugs: 0 };
    s = advance(s, 150);
    expect(s.status).toBe('won');
    expect(s.profitableMonthsInRow).toBe(3);
    const cont = run(s, { type: 'continueAsSandbox' });
    expect(cont.status).toBe('running');
  });

  it('у каждого события есть тексты на русском и английском', async () => {
    const ru = (await import('../src/content/ru/events.json')).default as Record<string, { choices: Record<string, string> }>;
    const en = (await import('../src/content/en/events.json')).default as Record<string, { choices: Record<string, string> }>;
    for (const e of content.events) {
      for (const lang of [ru, en]) {
        expect(lang[e.id], `нет текста события ${e.id}`).toBeDefined();
        for (const c of e.choices) expect(lang[e.id]!.choices[c.id], `нет текста варианта ${e.id}.${c.id}`).toBeTruthy();
      }
    }
  });
});
