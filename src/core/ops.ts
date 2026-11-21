// Службы компании: поддержка, продажи, администрация, сопровождение продукта.
// Пока компания мала, всё это делает основатель и его команда. Когда доход вырастает,
// появляются люди, которых на экране команды нет, — и они стоят денег.
// Службы растут вслед за доходом и так же медленно сжимаются: считаются по среднему доходу за три месяца.
// Описание и сверка с жизнью — docs/02-economy.md, раздел 33.

import { DAYS_IN_MONTH } from './formulas';
import type { GameConfig, GameState, OpsConfig, OpsLineId } from './types';

/** Месячный доход, под который набраны службы: средний за последние дни (не больше окна), умноженный на 30. */
export function steadyRevenue(s: GameState, cfg: OpsConfig): number {
  const days = s.recentDays.slice(-cfg.windowDays);
  if (days.length === 0) return 0;
  return (days.reduce((sum, d) => sum + d.revenue, 0) / days.length) * DAYS_IN_MONTH;
}

/**
 * Сколько стоят службы в месяц при таком устойчивом доходе.
 * Считается ступенями, как налог: ставка ступени берётся только с части дохода выше её порога.
 * Поэтому прибыль от роста дохода всегда растёт.
 */
export function opsCostFor(revenue: number, cfg: OpsConfig): number {
  let cost = 0;
  for (let i = 0; i < cfg.steps.length; i++) {
    const step = cfg.steps[i]!;
    const upTo = cfg.steps[i + 1]?.from ?? Infinity;
    if (revenue > step.from) cost += (Math.min(revenue, upTo) - step.from) * step.rate;
  }
  return cost;
}

/** Расход на службы за месяц на сегодня. */
export function opsCostPerMonth(s: GameState, config: GameConfig): number {
  return opsCostFor(steadyRevenue(s, config.ops), config.ops);
}

export interface OpsView {
  /** Службы уже появились: доход вышел за первый порог */
  active: boolean;
  /** Доход, с которого появляются службы, в месяц */
  startsAt: number;
  /** Устойчивый доход, по которому они сейчас посчитаны, в месяц */
  steadyRevenue: number;
  costPerMonth: number;
  /** Какую долю устойчивого дохода съедают службы, в процентах */
  sharePct: number;
  /** Сколько центов с каждого следующего доллара дохода уйдёт на службы */
  nextCents: number;
  lines: { id: OpsLineId; costPerMonth: number }[];
}

export function opsView(s: GameState, config: GameConfig): OpsView {
  const cfg = config.ops;
  const steady = steadyRevenue(s, cfg);
  const costPerMonth = opsCostFor(steady, cfg);
  const weights = cfg.lines.reduce((sum, l) => sum + l.weight, 0);
  const step = [...cfg.steps].reverse().find((st) => steady > st.from);
  return {
    active: costPerMonth > 0,
    startsAt: cfg.steps[0]?.from ?? 0,
    steadyRevenue: steady,
    costPerMonth,
    sharePct: steady > 0 ? Math.round((costPerMonth / steady) * 100) : 0,
    nextCents: Math.round((step?.rate ?? 0) * 100),
    lines: cfg.lines.map((l) => ({ id: l.id, costPerMonth: weights > 0 ? (costPerMonth * l.weight) / weights : 0 })),
  };
}
