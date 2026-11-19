// Тесты баланса: проверяют не отдельные формулы, а то, как игра ведёт себя в целом.
// Цели взяты из docs/01-GDD.md (раздел 8) и docs/02-economy.md.
import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import type { DifficultyId } from '../src/core';
import { runAll, summarize } from '../tools/balance/simulate';
import { carefulHirer, expert, idle, novice, recklessHirer, sensible, sideJobOnly } from '../tools/balance/strategies';
import { advance, newGame, run } from './helpers';

const DIFFICULTIES: DifficultyId[] = ['easy', 'normal', 'hard'];
const GAMES_PER_TYPE = 20;

describe('давление денег', () => {
  it.each(DIFFICULTIES)('%s: подработка на полный день не покрывает даже жизнь основателя', (id) => {
    const d = content.difficulties[id];
    expect(d.sideJobIncomePerMonth).toBeLessThan(d.livingCostPerMonth);
  });

  it.each(DIFFICULTIES)('%s: без продукта деньги убывают каждый месяц даже при полной подработке', (id) => {
    let s = run(newGame({ difficulty: id }), { type: 'setSideJob', share: 1 });
    let previous = s.cash;
    for (let m = 0; m < 6; m++) {
      s = advance(s, 30);
      expect(s.cash).toBeLessThan(previous);
      previous = s.cash;
    }
  });

  it.each(DIFFICULTIES)('%s: «ничего не делать» и «только подработка» всегда разоряются', (id) => {
    for (const strategy of [idle, sideJobOnly]) {
      const s = summarize(runAll(strategy, id, 5));
      expect(s.bankrupt).toBe(1);
    }
  });

  it('подработка оттягивает конец: с ней компания живёт дольше, чем без неё', () => {
    const without = summarize(runAll(idle, 'normal', 5)).medianBankruptDay!;
    const withJob = summarize(runAll(sideJobOnly, 'normal', 5)).medianBankruptDay!;
    expect(withJob).toBeGreaterThan(without * 1.5);
  });

  it('заём в кризис дают не чаще раза в год', () => {
    const crisis = content.events.find((e) => e.id === 'cashCrisis')!;
    expect(crisis.cooldownDays).toBeGreaterThanOrEqual(360);
  });
});

describe('сложность партии', () => {
  it('обычная: разумная стратегия выживает в 30–60% партий', () => {
    const s = summarize(runAll(sensible, 'normal', GAMES_PER_TYPE));
    expect(s.survived).toBeGreaterThanOrEqual(0.3);
    expect(s.survived).toBeLessThanOrEqual(0.6);
  });

  it('обычная: новичок обычно разоряется на 6–10 месяце', () => {
    const s = summarize(runAll(novice, 'normal', GAMES_PER_TYPE));
    expect(s.bankrupt).toBeGreaterThanOrEqual(0.7);
    expect(s.medianBankruptDay! / 30).toBeGreaterThanOrEqual(6);
    expect(s.medianBankruptDay! / 30).toBeLessThanOrEqual(10);
  });

  it('три сложности заметно отличаются: шаг не меньше 15 процентных пунктов', () => {
    const easy = summarize(runAll(sensible, 'easy', GAMES_PER_TYPE)).survived;
    const normal = summarize(runAll(sensible, 'normal', GAMES_PER_TYPE)).survived;
    const hard = summarize(runAll(sensible, 'hard', GAMES_PER_TYPE)).survived;
    expect(easy - normal).toBeGreaterThanOrEqual(0.15);
    expect(normal - hard).toBeGreaterThanOrEqual(0.15);
  });

  it('лёгкая: у новичка есть шанс, но победа не гарантирована', () => {
    const s = summarize(runAll(novice, 'easy', GAMES_PER_TYPE));
    expect(s.survived).toBeGreaterThanOrEqual(0.2);
    expect(s.survived).toBeLessThanOrEqual(0.8);
  });

  it('сложная: проходима только хорошей игрой — опытный иногда выживает, новичок никогда', () => {
    const good = summarize(runAll(expert, 'hard', GAMES_PER_TYPE)).survived;
    expect(good).toBeGreaterThan(0.05);
    expect(good).toBeLessThanOrEqual(0.5);
    expect(summarize(runAll(novice, 'hard', GAMES_PER_TYPE)).survived).toBe(0);
  });

  it('решения важнее удачи: ранний выход на рынок заметно повышает шансы', () => {
    const late = summarize(runAll(sensible, 'normal', GAMES_PER_TYPE)).survived;
    const early = summarize(runAll(expert, 'normal', GAMES_PER_TYPE)).survived;
    expect(early - late).toBeGreaterThanOrEqual(0.2);
  });
});

describe('наём и деньги', () => {
  it.each(DIFFICULTIES)('%s: нанять сильного разработчика в первый день — верное банкротство за полгода', (id) => {
    const s = summarize(runAll(recklessHirer, id, GAMES_PER_TYPE));
    expect(s.bankrupt).toBe(1);
    expect(s.medianBankruptDay).toBeLessThanOrEqual(6 * 30);
  });

  it('тот же игрок без найма живёт дольше: команда не по карману ускоряет конец', () => {
    const reckless = summarize(runAll(recklessHirer, 'hard', GAMES_PER_TYPE));
    const plain = summarize(runAll(expert, 'hard', GAMES_PER_TYPE));
    expect(plain.survived).toBeGreaterThan(reckless.survived);
  });

  it.each(DIFFICULTIES)('%s: осторожный наём на прибыль не ухудшает шансы', (id) => {
    const hiring = summarize(runAll(carefulHirer, id, GAMES_PER_TYPE)).survived;
    const plain = summarize(runAll(expert, id, GAMES_PER_TYPE)).survived;
    expect(hiring).toBeGreaterThanOrEqual(plain - 0.05);
  });
});
