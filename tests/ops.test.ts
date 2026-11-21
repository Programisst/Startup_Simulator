// Службы большой компании: расход появляется только с ростом дохода, считается ступенями и отстаёт от дохода на три месяца.
import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { bankruptcyCause, opsCostFor, opsCostPerMonth, opsView, steadyRevenue, tick, type GameState } from '../src/core';
import { launchedGame, newGame } from './helpers';

const cfg = content.config.ops;
const quiet = { ...content, events: [] };

/** Партия, в которой продукт уже days дней подряд приносит perMonth в месяц. */
function earning(perMonth: number, days = 90, base: GameState = launchedGame()): GameState {
  return {
    ...base,
    cash: 1e9,
    recentDays: Array.from({ length: days }, (_, i) => ({ day: base.day - days + i, cash: 1e9, users: 1000, paying: 100, revenue: perMonth / 30, expenses: 0 })),
  };
}

describe('сколько стоят службы', () => {
  it('маленькой компании службы не стоят ничего', () => {
    expect(opsCostFor(0, cfg)).toBe(0);
    expect(opsCostFor(cfg.steps[0]!.from, cfg)).toBe(0);
    expect(opsCostPerMonth(newGame(), content.config)).toBe(0);
    expect(tick(newGame(), quiet).lastDay.opsCost).toBe(0);
  });

  it('ставка берётся только с части дохода выше порога', () => {
    const [first, second] = cfg.steps as [{ from: number; rate: number }, { from: number; rate: number }];
    expect(opsCostFor(first.from + 10_000, cfg)).toBeCloseTo(10_000 * first.rate, 6);
    const below = (second.from - first.from) * first.rate;
    expect(opsCostFor(second.from + 50_000, cfg)).toBeCloseTo(below + 50_000 * second.rate, 6);
  });

  it('с каждого следующего доллара дохода прибыль растёт: ни одна ставка не доходит до 100%', () => {
    for (const step of cfg.steps) expect(step.rate).toBeLessThan(0.9);
    let previous = 0;
    for (let revenue = 0; revenue <= 3_000_000; revenue += 5_000) {
      const left = revenue - opsCostFor(revenue, cfg);
      expect(left).toBeGreaterThanOrEqual(previous);
      previous = left;
    }
  });

  it('у большой компании службы съедают около двух третей дохода — как в жизни', () => {
    const top = cfg.steps[cfg.steps.length - 1]!.rate;
    expect(top).toBeGreaterThanOrEqual(0.55);
    expect(top).toBeLessThanOrEqual(0.75);
    expect(opsCostFor(10_000_000, cfg) / 10_000_000).toBeGreaterThan(0.6);
    // Ставка складывается из долей четырёх служб.
    expect(cfg.lines.reduce((sum, l) => sum + l.weight, 0) / 100).toBeCloseTo(top, 6);
  });
});

describe('службы в ходе партии', () => {
  it('расход попадает в день и в общий итог расходов', () => {
    const s = tick(earning(500_000), quiet);
    const expected = opsCostFor(500_000, cfg) / 30;
    expect(s.lastDay.opsCost).toBeCloseTo(expected, 6);
    const b = s.lastDay;
    expect(b.expenses).toBeCloseTo(b.serverCost + b.adCost + b.toolsCost + b.feeCost + b.loanCost + b.livingCost + b.salaryCost + b.rentCost + expected, 6);
  });

  it('службы отстают от дохода: считаются по среднему за три месяца, а не по вчерашнему дню', () => {
    const base = earning(600_000);
    // Доход вчера упал вдвое — расход почти не изменился.
    const dropped = { ...base, recentDays: base.recentDays.map((d, i, all) => (i === all.length - 1 ? { ...d, revenue: d.revenue / 2 } : d)) };
    expect(steadyRevenue(dropped, cfg)).toBeGreaterThan(590_000);
    expect(opsCostPerMonth(dropped, content.config)).toBeGreaterThan(opsCostPerMonth(base, content.config) * 0.98);
    // Через три месяца низкого дохода службы сжались до него.
    expect(steadyRevenue(earning(300_000), cfg)).toBeCloseTo(300_000, 6);
  });

  it('после падения дохода компания какое-то время работает в убыток', () => {
    const base = earning(600_000);
    const fallen = { ...base, recentDays: base.recentDays.map((d, i) => (i >= 60 ? { ...d, revenue: d.revenue * 0.4 } : d)) };
    const revenue30 = fallen.recentDays.slice(-30).reduce((sum, d) => sum + d.revenue, 0);
    expect(opsCostPerMonth(fallen, content.config)).toBeGreaterThan(revenue30);
  });

  it('старое сохранение без поля служб открывается, а причина банкротства называет службы, когда они тяжелее всего', () => {
    const old = earning(500_000);
    delete (old.lastDay as { opsCost?: number }).opsCost;
    expect(bankruptcyCause({ ...old, status: 'bankrupt' })).not.toBe('ops');
    const next = tick(old, quiet);
    expect(next.lastDay.opsCost).toBeGreaterThan(0);
    expect(bankruptcyCause({ ...next, status: 'bankrupt' })).toBe('ops');
  });
});

describe('сводка для экрана', () => {
  it('маленькой компании показывает порог, большой — расход по четырём службам', () => {
    const small = opsView(newGame(), content.config);
    expect(small.active).toBe(false);
    expect(small.startsAt).toBe(cfg.steps[0]!.from);

    const big = opsView(earning(1_000_000), content.config);
    expect(big.active).toBe(true);
    expect(big.lines.map((l) => l.id)).toEqual(['support', 'sales', 'admin', 'upkeep']);
    expect(big.lines.reduce((sum, l) => sum + l.costPerMonth, 0)).toBeCloseTo(big.costPerMonth, 6);
    expect(big.sharePct).toBeGreaterThan(55);
    expect(big.nextCents).toBe(Math.round(cfg.steps[cfg.steps.length - 1]!.rate * 100));
  });
});
