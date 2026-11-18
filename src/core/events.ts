// События с выбором: проверка условий, выбор очередного события, применение последствий.

import { clamp, overload } from './formulas';
import { nextFloat, type RngState } from './rng';
import type { Effect, EventCondition, EventDef, GameContent, GameState } from './types';

export function conditionHolds(c: EventCondition, s: GameState): boolean {
  if (c.launched !== undefined && c.launched !== s.launched) return false;
  if (c.minDay !== undefined && s.day < c.minDay) return false;
  if (c.minUsers !== undefined && s.users < c.minUsers) return false;
  if (c.maxUsers !== undefined && s.users > c.maxUsers) return false;
  if (c.minQuality !== undefined && s.quality < c.minQuality) return false;
  if (c.maxQuality !== undefined && s.quality > c.maxQuality) return false;
  if (c.minCash !== undefined && s.cash < c.minCash) return false;
  if (c.maxCash !== undefined && s.cash > c.maxCash) return false;
  if (c.minBugs !== undefined && s.bugs < c.minBugs) return false;
  if (c.minDebt !== undefined && s.debt < c.minDebt) return false;
  if (c.overloaded !== undefined && c.overloaded !== overload(s.users, s.capacity) > 0) return false;
  if (c.cashNegative !== undefined && c.cashNegative !== s.cash < 0) return false;
  return true;
}

function isAvailable(def: EventDef, s: GameState): boolean {
  let lastDay = -Infinity;
  for (const entry of s.eventLog) {
    if (entry.eventId === def.id) lastDay = Math.max(lastDay, entry.day);
  }
  if (def.once && lastDay > -Infinity) return false;
  if (s.day - lastDay < def.cooldownDays) return false;
  return conditionHolds(def.condition, s);
}

/**
 * Решает, случится ли сегодня событие. Возвращает его id или null.
 * Срочные события случаются сразу; обычные — с заданной вероятностью и не чаще,
 * чем раз в eventMinGapDays дней.
 */
export function rollEvent(
  s: GameState,
  content: GameContent,
  rng: RngState,
): { eventId: string | null; rng: RngState } {
  const available = content.events.filter((e) => isAvailable(e, s));

  const urgent = available.find((e) => e.urgent);
  if (urgent) return { eventId: urgent.id, rng };

  if (s.day - s.lastEventDay < content.config.eventMinGapDays) return { eventId: null, rng };

  const roll = nextFloat(rng);
  if (roll.value >= content.config.eventDailyChance) return { eventId: null, rng: roll.next };

  const regular = available.filter((e) => !e.urgent);
  const total = regular.reduce((sum, e) => sum + e.weight, 0);
  if (total <= 0) return { eventId: null, rng: roll.next };

  const pick = nextFloat(roll.next);
  let threshold = pick.value * total;
  for (const e of regular) {
    threshold -= e.weight;
    if (threshold < 0) return { eventId: e.id, rng: pick.next };
  }
  return { eventId: regular[regular.length - 1]?.id ?? null, rng: pick.next };
}

/**
 * Применяет последствия к черновику состояния (draft — свежая копия, её можно менять).
 * Возвращает новое состояние генератора; исходы случайных веток пишет в chanceResults.
 */
export function applyEffects(
  draft: GameState,
  effects: Effect[],
  rng: RngState,
  chanceResults: boolean[],
): RngState {
  let r = rng;
  for (const e of effects) {
    switch (e.type) {
      case 'cash':
        draft.cash = Math.round((draft.cash + e.amount) * 100) / 100;
        break;
      case 'reputation':
        draft.reputation = clamp(draft.reputation + e.amount, 0, 100);
        break;
      case 'scandal':
        draft.scandal = clamp(draft.scandal + e.amount, 0, 60);
        break;
      case 'usersPct': {
        const factor = Math.max(0, 1 + e.pct / 100);
        draft.users = draft.users * factor;
        draft.paying = Math.min(draft.users, draft.paying * factor);
        break;
      }
      case 'bugs':
        draft.bugs = Math.max(0, draft.bugs + e.amount);
        break;
      case 'debt':
        draft.debt = clamp(draft.debt + e.amount, 0, 100);
        break;
      case 'modifier':
        draft.modifiers = [
          ...draft.modifiers,
          { target: e.target, factor: e.factor, untilDay: draft.day + e.days },
        ];
        break;
      case 'loan':
        draft.cash = Math.round((draft.cash + e.amount) * 100) / 100;
        draft.loans = [
          ...draft.loans,
          { dailyPayment: (e.amount * e.repayFactor) / e.days, untilDay: draft.day + e.days },
        ];
        break;
      case 'chance': {
        const roll = nextFloat(r);
        r = roll.next;
        const hit = roll.value < e.probability;
        chanceResults.push(hit);
        r = applyEffects(draft, hit ? e.then : (e.otherwise ?? []), r, chanceResults);
        break;
      }
    }
  }
  return r;
}
