// Цели на пути компании: что игроку делать дальше и что он получит.
// Цель засчитывается в тот день, когда выполнена, — даже если более ранняя ещё не пройдена:
// иначе одна застрявшая цель держит остальные, и потом они закрываются пачкой.
// За день засчитывается не больше одной; «ближайшей» игроку показывается самая ранняя из непройденных.

import { applyEffects, conditionHolds, revenue30 } from './events';
import { totalAdSpend } from './marketing';
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
 * Шаг дня: самая ранняя из выполненных, но ещё не отмеченных целей получает награду и отметку. Меняет черновик состояния.
 * Возвращает id достигнутой цели или null.
 */
export function stepMilestones(draft: GameState, content: GameContent): string | null {
  const done = doneIds(draft);
  const next = content.milestones.find((m) => !done.includes(m.id) && conditionHolds(m.condition, draft, content.config));
  if (!next) return null;
  // В наградах нет случайных исходов, поэтому генератор случайности не сдвигается.
  applyEffects(draft, next.effects, draft.rng, []);
  draft.milestones = [...(draft.milestones ?? []), { id: next.id, day: draft.day }];
  // Закрыта последняя непройденная цель главы — в ленту идёт запись о пройденной главе.
  const chapter = content.chapters.find((c) => c.milestones.includes(next.id) && c.milestones.every((id) => id === next.id || done.includes(id)));
  if (chapter) draft.news = [...(draft.news ?? []), { day: draft.day, kind: 'chapter' as const, id: chapter.id }].slice(-40);
  return next.id;
}

export interface MilestoneView {
  /** Ближайшая цель; null — все пройдены */
  current: { id: string; value: number; target: number; share: number; cashReward: number } | null;
  done: { id: string; day: number }[];
  total: number;
  /** Текущая глава; когда все цели пройдены — последняя */
  chapter: ChapterView;
  chapters: ChapterView[];
}

export interface ChapterView {
  id: string;
  /** Номер главы с нуля */
  index: number;
  total: number;
  /** Сколько целей главы пройдено и сколько в ней всего */
  goalsDone: number;
  goalsTotal: number;
  done: boolean;
  current: boolean;
}

/** Сводка целей для интерфейса. Состояние не меняет. */
export function milestoneView(s: GameState, content: GameContent): MilestoneView {
  const next = nextMilestone(s, content);
  const value = next?.progress ? metricValue(s, next.progress.metric) : 0;
  const target = next?.progress?.target ?? 1;
  const doneSet = new Set(doneIds(s));
  const currentChapter = content.chapters.findIndex((c) => next !== null && c.milestones.includes(next.id));
  const chapters: ChapterView[] = content.chapters.map((c, index) => {
    const goalsDone = c.milestones.filter((id) => doneSet.has(id)).length;
    return { id: c.id, index, total: content.chapters.length, goalsDone, goalsTotal: c.milestones.length, done: goalsDone === c.milestones.length, current: index === currentChapter };
  });
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
    chapter: chapters.find((c) => c.current) ?? chapters[chapters.length - 1]!,
    chapters,
  };
}

export type BankruptcyCause = 'noProduct' | 'salaries' | 'ads' | 'servers' | 'loans' | 'rent' | 'ops' | 'slowGrowth';

/** Аренда записана в последнем дне партии: настройки игры здесь недоступны. */
const rentOf = (s: GameState): number => (s.lastDay.rentCost ?? 0) * 30;

/**
 * Почему кончились деньги: самая тяжёлая статья расходов, которую доход не покрывал.
 * Подсказка игроку после банкротства, а не точный расчёт.
 */
export function bankruptcyCause(s: GameState): BankruptcyCause {
  const monthly = {
    salaries: (s.team?.employees ?? []).reduce((sum, e) => sum + e.salary, 0),
    ads: totalAdSpend(s) * 30,
    servers: s.capacity * s.market.serverCostPerUser,
    rent: rentOf(s),
    // Службы записаны в последнем дне партии: настройки игры здесь недоступны.
    ops: (s.lastDay.opsCost ?? 0) * 30,
    loans: s.loans.reduce((sum, l) => sum + l.dailyPayment, 0) * 30,
  };
  const heaviest = (Object.keys(monthly) as (keyof typeof monthly)[]).reduce((a, b) => (monthly[b] > monthly[a] ? b : a));
  // Статья считается причиной, если она больше расходов на жизнь: иначе компанию убила не она.
  if (monthly[heaviest] > s.livingCostPerMonth) return heaviest;
  return s.launched ? 'slowGrowth' : 'noProduct';
}
