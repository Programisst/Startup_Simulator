import { describe, expect, it } from 'vitest';
import {
  cac,
  churnMonthly,
  churnPayingMonthly,
  conversionMonthly,
  monthlyToDaily,
  organicPerDay,
  overload,
  quality,
  valuation,
  viralPerDay,
  type Market,
  type MonthReport,
} from '../src/core';

const market: Market = {
  marketSize: 100_000,
  cacBase: 10,
  churnBase: 0.1,
  convBase: 0.04,
  priceRef: 20,
  viralBase: 0.3,
  organicBase: 0.001,
  serverCostPerUser: 0.05,
  adRevenuePerUser: 0.1,
  commissionPerUser: 1,
  competition: 0.5,
  fit: 1,
  expectation0: 40,
  userValue: 5,
};

describe('формулы', () => {
  it('месячная ставка переводится в дневную: 30 дней дают исходную ставку', () => {
    const d = monthlyToDaily(0.1);
    expect(1 - Math.pow(1 - d, 30)).toBeCloseTo(0.1, 10);
    expect(monthlyToDaily(0)).toBe(0);
  });

  it('стоимость привлечения растёт с конкуренцией и насыщением рынка', () => {
    expect(cac(market, 0)).toBeCloseTo(15, 10);
    expect(cac(market, 50_000)).toBeCloseTo(15 * 1.75, 10);
    expect(cac({ ...market, fit: 1.5 }, 0)).toBeCloseTo(10, 10);
  });

  it('органический рост зависит от репутации, вирусный — от квадрата качества', () => {
    expect(organicPerDay(market, 0, 50)).toBeCloseTo((100_000 * 0.001 * 0.5) / 30, 10);
    expect(organicPerDay(market, 0, 0)).toBe(0);
    const low = viralPerDay(market, 1000, 40);
    const high = viralPerDay(market, 1000, 80);
    expect(high / low).toBeCloseTo(4, 10);
    expect(viralPerDay(market, 100_000, 100)).toBe(0);
  });

  it('отток вдвое ниже базового при качестве 100 и вдвое выше при качестве 0', () => {
    expect(churnMonthly(market, 100, 0, 0)).toBeCloseTo(0.05, 10);
    expect(churnMonthly(market, 0, 0, 0)).toBeCloseTo(0.2, 10);
  });

  it('перегрузка и ошибки увеличивают отток', () => {
    expect(overload(150, 100)).toBeCloseTo(0.5, 10);
    expect(overload(50, 100)).toBe(0);
    expect(churnMonthly(market, 100, 0.5, 0)).toBeCloseTo(0.075, 10);
    expect(churnMonthly(market, 100, 0, 20)).toBeCloseTo(0.1, 10);
  });

  it('завышенная цена повышает отток платящих и снижает конверсию', () => {
    expect(churnPayingMonthly(0.1, 20, 20)).toBeCloseTo(0.06, 10);
    expect(churnPayingMonthly(0.1, 40, 20)).toBeCloseTo(0.12, 10);
    expect(conversionMonthly(market, 100, 20)).toBeCloseTo(0.04, 10);
    expect(conversionMonthly(market, 100, 40)).toBeLessThan(0.04);
    expect(conversionMonthly(market, 100, 0)).toBeLessThanOrEqual(0.12);
    expect(conversionMonthly(market, 0, 20)).toBe(0);
  });

  it('качество растёт с функциями и падает от долга и ошибок', () => {
    expect(quality(0, 40, 0, 0)).toBe(0);
    expect(quality(40, 40, 0, 0)).toBeCloseTo(100 * (1 - Math.exp(-1)), 10);
    expect(quality(40, 40, 100, 0)).toBeCloseTo(50 * (1 - Math.exp(-1)), 10);
    expect(quality(40, 40, 0, 10)).toBeCloseTo(100 * (1 - Math.exp(-1)) - 15, 10);
    expect(quality(40, 80, 0, 0)).toBeLessThan(quality(40, 40, 0, 0));
  });

  it('оценка компании выше при быстром росте дохода', () => {
    const month = (revenue: number): MonthReport => ({
      month: 0, revenue, expenses: 0, profit: revenue, sideIncome: 0, users: 0, paying: 0, cash: 0,
    });
    expect(valuation([], 1000, market)).toBe(0);
    const flat = valuation([month(1000), month(1000), month(1000), month(1000)], 0, market);
    const growing = valuation([month(500), month(700), month(900), month(1000)], 0, market);
    expect(flat).toBeCloseTo(1000 * 12 * 3, 6);
    expect(growing).toBeCloseTo(1000 * 12 * 15, 6);
  });
});
