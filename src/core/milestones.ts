// Цели на пути компании: что игроку делать дальше и что он получит.
// Цели идут строго по порядку; за день засчитывается не больше одной.

import { applyEffects, conditionHolds, revenue30 } from './events';
import type { GameContent, GameState, MilestoneDef, MilestoneMetric } from './types';

const doneIds = (s: GameState): string[] => (s.milestones ?? []).map((m) => m.id);

/** Ближайшая недостигнутая цель или null, если все пройдены. */
export function nextMilestone(s: GameState, content: GameContent): MilestoneDef | null {
  const done = doneIds(s);
  return content.milestones.find((m) => !done.includes(m.id)) ?? null;
}

function metricValue(s: GameState, metric: MilestoneMetric): number {
  if (metric === 'users') return s.users;
  if (metric === 'revenue30') return revenue30(s);
  if (metric === 'features') return s.doneFeatures.length;
  return s.team?.employees.length ?? 0;
}

/**
 * Шаг дня: если ближайшая цель достигнута, выдаёт награду и отмечает её. Меняет черновик состояния.
 * Возвращает id достигнутой цели или null.
 */
export function stepMilestones(draft: GameState, content: GameContent): string | null {
  const next = nextMilestone(draft, content);
  if (!next || !conditionHolds(next.condition, draft, content.config)) return null;
  // В наградах нет случайных исходов, поэтому генератор случайности не сдвигается.
  applyEffects(draft, next.effects, draft.rng, []);
  draft.milestones = [...(draft.milestones ?? []), { id: next.id, day: draft.day }];
  return next.id;
}

export interface MilestoneView {
  /** Ближайшая цель; null — все пройдены */
  current: { id: string; value: number; target: number; share: number; cashReward: number } | null;
  done: { id: string; day: number }[];
  total: number;
}

/** Сводка целей для интерфейса. Состояние не меняет. */
export function milestoneView(s: GameState, content: GameContent): MilestoneView {
  const next = nextMilestone(s, content);
  const value = next?.progress ? metricValue(s, next.progress.metric) : 0;
  const target = next?.progress?.target ?? 1;
  return {
    current: next
      ? {
          id: next.id,
          value,
          target,
          share: next.progress ? Math.max(0, Math.min(1, value / target)) : 0,
          cashReward: next.effects.reduce((sum, e) => (e.type === 'cash' ? sum + e.amount : sum), 0),
        }
      : null,
    done: s.milestones ?? [],
    total: content.milestones.length,
  };
}

export type BankruptcyCause = 'noProduct' | 'salaries' | 'ads' | 'servers' | 'loans' | 'rent' | 'slowGrowth';

/** Аренда записана в последнем дне партии: настройки игры здесь недоступны. */
const rentOf = (s: GameState): number => (s.lastDay.rentCost ?? 0) * 30;

/**
 * Почему кончились деньги: самая тяжёлая статья расходов, которую доход не покрывал.
 * Подсказка игроку после банкротства, а не точный расчёт.
 */
export function bankruptcyCause(s: GameState): BankruptcyCause {
  const monthly = {
    salaries: (s.team?.employees ?? []).reduce((sum, e) => sum + e.salary, 0),
    ads: s.adSpendPerDay * 30,
    servers: s.capacity * s.market.serverCostPerUser,
    rent: rentOf(s),
    loans: s.loans.reduce((sum, l) => sum + l.dailyPayment, 0) * 30,
  };
  const heaviest = (Object.keys(monthly) as (keyof typeof monthly)[]).reduce((a, b) => (monthly[b] > monthly[a] ? b : a));
  // Статья считается причиной, если она больше расходов на жизнь: иначе компанию убила не она.
  if (monthly[heaviest] > s.livingCostPerMonth) return heaviest;
  return s.launched ? 'slowGrowth' : 'noProduct';
}
