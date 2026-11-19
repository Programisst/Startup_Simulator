// Тесты баланса: проверяют не отдельные формулы, а то, как игра ведёт себя в целом.
// Цели взяты из docs/01-GDD.md (раздел 8) и docs/02-economy.md.
import { describe, expect, it, vi } from 'vitest';
import { content } from '../src/content';
import type { DifficultyId } from '../src/core';
import { runAll, summarize } from '../tools/balance/simulate';
import { carefulHirer, expert, idle, novice, recklessHirer, sensible, sideJobOnly } from '../tools/balance/strategies';
import { advance, newGame, run } from './helpers';

// Эти тесты проигрывают сотни партий. На сервере проверок GitHub они идут в несколько раз медленнее,
// чем на компьютере разработчика, и в обычные 5 секунд не укладываются.
vi.setConfig({ testTimeout: 120_000 });

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

// Цели сложности пересмотрены 19 ноября 2026 после живых партий: прежняя настройка
// («разумный выживает в 30–60%, новичок разоряется на 6–10 месяце») давала медленное угасание без роста.
// Теперь игра про рост: грамотный игрок растёт уверенно, а разоряются те, кто играет плохо или рискует.
describe('сложность партии', () => {
  const survived = (strategy: typeof novice, id: DifficultyId) => summarize(runAll(strategy, id, GAMES_PER_TYPE)).survived;

  it('обычная: грамотный игрок почти всегда выживает, новичок — чаще да, чем нет, но не всегда', () => {
    expect(survived(sensible, 'normal')).toBeGreaterThanOrEqual(0.9);
    const beginner = survived(novice, 'normal');
    expect(beginner).toBeGreaterThanOrEqual(0.5);
    expect(beginner).toBeLessThanOrEqual(0.97);
  });

  it('лёгкая: новичок почти всегда выживает', () => {
    expect(survived(novice, 'easy')).toBeGreaterThanOrEqual(0.9);
  });

  it('сложная: проходима только хорошей игрой', () => {
    expect(survived(novice, 'hard')).toBeLessThanOrEqual(0.6);
    expect(survived(sensible, 'hard')).toBeLessThanOrEqual(0.6);
    expect(survived(expert, 'hard')).toBeGreaterThanOrEqual(0.7);
  });

  it('сложности идут по возрастанию, сложная заметно жёстче обычной', () => {
    const easy = survived(novice, 'easy');
    const normal = survived(novice, 'normal');
    const hard = survived(novice, 'hard');
    expect(easy).toBeGreaterThanOrEqual(normal);
    expect(normal - hard).toBeGreaterThanOrEqual(0.15);
  });

  it('решения важнее удачи: на сложной ранний выход на рынок решает исход', () => {
    expect(survived(expert, 'hard') - survived(sensible, 'hard')).toBeGreaterThanOrEqual(0.2);
  });

  it('разорившийся новичок успевает поиграть: не раньше пятого месяца', () => {
    const s = summarize(runAll(novice, 'normal', GAMES_PER_TYPE));
    expect(s.medianBankruptDay! / 30).toBeGreaterThanOrEqual(5);
  });
});

describe('наём и деньги', () => {
  it.each(DIFFICULTIES)('%s: нанять сильного разработчика в первый день — почти верное банкротство за полгода', (id) => {
    const s = summarize(runAll(recklessHirer, id, GAMES_PER_TYPE));
    expect(s.bankrupt).toBeGreaterThanOrEqual(0.7);
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
