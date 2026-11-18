// Формулы экономической модели. Описание — в docs/02-economy.md.
// Каждая функция чистая: одинаковые входы дают одинаковый результат.

import type { GameConfig, Market, MonthReport } from './types';

export const DAYS_IN_MONTH = 30;

export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/** Переводит месячную ставку (долю) в дневную. */
export function monthlyToDaily(monthly: number): number {
  const m = clamp(monthly, 0, 0.95);
  return 1 - Math.pow(1 - m, 1 / DAYS_IN_MONTH);
}

/** Стоимость привлечения одного пользователя рекламой. */
export function cac(market: Market, users: number): number {
  const saturation = 1 + 3 * Math.pow(clamp(users / market.marketSize, 0, 1), 2);
  return (market.cacBase * (1 + market.competition) * saturation) / market.fit;
}

/** Пользователи за день от платной рекламы. */
export function paidPerDay(market: Market, users: number, adSpend: number): number {
  return adSpend <= 0 ? 0 : adSpend / cac(market, users);
}

/** Пользователи за день, которые нашли продукт сами. */
export function organicPerDay(market: Market, users: number, reputation: number): number {
  const remaining = Math.max(0, market.marketSize - users);
  return (remaining * market.organicBase * (reputation / 100) * market.fit) / DAYS_IN_MONTH;
}

/** Пользователи за день по рекомендациям. Качество — в квадрате. */
export function viralPerDay(market: Market, users: number, quality: number): number {
  const room = Math.max(0, 1 - users / market.marketSize);
  return (users * market.viralBase * Math.pow(quality / 100, 2) * room) / DAYS_IN_MONTH;
}

/** Перегрузка серверов: 0 — всё в порядке, 1 — пользователей вдвое больше мощности. */
export function overload(users: number, capacity: number): number {
  if (users <= 0) return 0;
  if (capacity <= 0) return 2;
  return clamp(users / capacity - 1, 0, 2);
}

/** Месячный отток обычных пользователей. */
export function churnMonthly(market: Market, quality: number, over: number, bugs: number): number {
  const bugsPenalty = Math.min(1, bugs / 20);
  return market.churnBase * (2 - (1.5 * quality) / 100) * (1 + over) * (1 + bugsPenalty);
}

/** Месячный отток платящих: ниже обычного, но растёт при завышенной цене. */
export function churnPayingMonthly(churn: number, price: number, priceRef: number): number {
  return churn * 0.6 * Math.max(1, price / priceRef);
}

/** Доля бесплатных пользователей, которые за месяц начинают платить. */
export function conversionMonthly(market: Market, quality: number, price: number): number {
  const raw = market.convBase * (quality / 100) * Math.exp(1 - price / market.priceRef);
  return clamp(raw, 0, 3 * market.convBase);
}

/** Чего рынок ждёт от продукта на данный день: растёт со временем. */
export function expectation(market: Market, config: GameConfig, day: number): number {
  return market.expectation0 * Math.pow(1 + config.expectationGrowthPerMonth, day / DAYS_IN_MONTH);
}

/** Качество продукта 0…100. */
export function quality(featureScore: number, expected: number, debt: number, bugs: number): number {
  const raw = 100 * (1 - Math.exp(-featureScore / expected));
  return clamp(raw * (1 - (0.5 * debt) / 100) - Math.min(30, bugs * 1.5), 0, 100);
}

/** К какому значению стремится репутация. */
export function reputationTarget(q: number, over: number, scandal: number): number {
  return clamp(q - Math.min(30, over * 30) - scandal, 0, 100);
}

/** Оценка компании по закрытым месяцам. */
export function valuation(months: MonthReport[], users: number, market: Market): number {
  const last = months[months.length - 1];
  if (!last) return 0;
  const before = months[months.length - 4];
  let growth = 0.5; // пока истории мало, считаем рост средним
  if (before && before.revenue > 0) growth = clamp(last.revenue / before.revenue - 1, 0, 1);
  else if (before) growth = last.revenue > 0 ? 1 : 0;
  const multiple = 3 + 12 * growth;
  return last.revenue * 12 * multiple + users * market.userValue;
}
