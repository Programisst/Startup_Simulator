// Опасности большой компании: спад рынка и сильный конкурент.
// Пока компания мала, их нет. Когда появляются службы, раз в квартал может начаться угроза:
// людей приходит меньше, уходит больше. Игрок может ответить — уступить в цене или рискнуть деньгами.
// Описание и сверка с жизнью — docs/02-economy.md, раздел 34.

import { revenue30 } from './events';
import { clamp } from './formulas';
import { opsLevelOf } from './ops';
import { createRng, nextFloat, nextInt } from './rng';
import type { ActiveThreat, GameConfig, GameContent, GameState, NewsItem, ThreatKind, ThreatKindDef, ThreatPressure, ThreatResponseDef, ThreatResponseId, ThreatsState } from './types';

/** Сдвиг seed, чтобы угрозы не совпадали с остальной случайностью партии. */
const THREAT_SEED_SALT = 0x5f3a9c17;
const NO_PRESSURE: ThreatPressure = { acquisition: 1, churn: 1, revenue: 1 };

const cents = (x: number): number => Math.round(x * 100) / 100;
const round100 = (x: number): number => Math.round(x / 100) * 100;

/** Событие-сообщение, которым игра показывает начало угрозы. */
export const threatEventId = (kind: ThreatKind): string => (kind === 'downturn' ? 'threatDownturn' : 'threatRival');

/** Состояние угроз; до первой угрозы его нет. */
export function threatsOf(s: GameState): ThreatsState {
  return s.threats ?? { active: null, endedDay: null, last: null, count: 0 };
}

/** Угрозы касаются только большой компании: той, у которой уже есть службы. */
function unlocked(s: GameState, cfg: GameConfig): boolean {
  return s.launched && opsLevelOf(s, cfg.ops) > (cfg.ops.steps[0]?.from ?? 0);
}

/** Угроза периода: зависит только от партии и номера периода. null — период спокойный. */
export function threatOfWindow(seed: number, window: number, cfg: GameConfig): { kind: ThreatKind; days: number } | null {
  const start = createRng(seed ^ THREAT_SEED_SALT ^ Math.imul(window + 1, 0x9e3779b1));
  const roll = nextFloat(start);
  let left = roll.value;
  for (const def of cfg.threats.kinds) {
    left -= def.chance;
    if (left < 0) return { kind: def.id, days: nextInt(roll.next, def.minDays, def.maxDays).value };
  }
  return null;
}

const kindDef = (cfg: GameConfig, kind: ThreatKind): ThreatKindDef | undefined => cfg.threats.kinds.find((k) => k.id === kind);

/** Как угроза сейчас давит на компанию. Без угрозы — никак. */
export function threatPressure(s: GameState, cfg: GameConfig): ThreatPressure {
  const active = s.threats?.active;
  if (!active) return NO_PRESSURE;
  const def = kindDef(cfg, active.kind);
  if (!def) return NO_PRESSURE;
  const response = active.success ? def.responses.find((r) => r.id === active.response) : undefined;
  return response ? response.success : def.pressure;
}

function news(s: GameState, id: string, tone: NewsItem['tone']): NewsItem[] {
  return [...(s.news ?? []), { day: s.day, kind: 'threat' as const, id, tone }].slice(-40);
}

/** Шаг дня: угроза кончается в свой срок; раз в период может начаться новая. Меняет черновик состояния. */
export function stepThreats(s: GameState, content: GameContent): void {
  const cfg = content.config;
  const t = cfg.threats;
  const st = threatsOf(s);

  if (st.active) {
    if (s.day < st.active.untilDay) return;
    const a = st.active;
    s.threats = { ...st, active: null, endedDay: s.day, last: { kind: a.kind, startDay: a.startDay, endDay: s.day, response: a.response, success: a.success } };
    s.news = news(s, `${a.kind}Ended`, 'good');
    return;
  }

  if (s.day % t.periodDays !== 0 || !unlocked(s, cfg)) return;
  if (st.endedDay !== null && s.day - st.endedDay < t.graceDays) return;
  const rolled = threatOfWindow(s.seed, Math.floor(s.day / t.periodDays), cfg);
  if (!rolled) return;

  s.threats = { ...st, count: st.count + 1, active: { kind: rolled.kind, startDay: s.day, untilDay: s.day + rolled.days, response: null, success: null, paid: 0 } };
  s.news = news(s, rolled.kind, 'bad');
  // Игра останавливается и сообщает об угрозе — если уже не ждёт ответа на другое событие.
  const eventId = threatEventId(rolled.kind);
  if (s.status === 'running' && s.pendingEvent === null && content.events.some((e) => e.id === eventId)) {
    s.pendingEvent = eventId;
    s.pendingSubject = null;
    s.lastEventDay = s.day;
    s.eventLog = [...s.eventLog, { day: s.day, eventId, choiceId: null, chanceResults: [] }];
  }
}

function responseCost(s: GameState, def: ThreatResponseDef): number {
  return def.costRevenueShare > 0 ? Math.max(100, round100(revenue30(s) * def.costRevenueShare)) : 0;
}

function responseChance(s: GameState, def: ThreatResponseDef): number {
  if (def.chance >= 1) return 1;
  return clamp(def.chance + s.quality * def.chancePerQuality, 0.05, 0.95);
}

export type ThreatResponseBlock = 'answered' | 'cash';

function responseBlock(s: GameState, active: ActiveThreat, def: ThreatResponseDef): ThreatResponseBlock | null {
  if (active.response !== null) return 'answered';
  if (s.cash < responseCost(s, def)) return 'cash';
  return null;
}

/** Ответить на угрозу. Ответ один на угрозу; у рискованного исход решает случай. Возвращает null, если нельзя. */
export function respondThreat(s: GameState, content: GameContent, id: ThreatResponseId): GameState | null {
  const cfg = content.config;
  const st = threatsOf(s);
  const active = st.active;
  const def = active ? kindDef(cfg, active.kind)?.responses.find((r) => r.id === id) : undefined;
  if (!active || !def || responseBlock(s, active, def) !== null) return null;

  const cost = responseCost(s, def);
  // Исход зависит только от партии и дня начала угрозы: перезагрузка сохранения его не меняет.
  const roll = nextFloat(createRng(s.seed ^ THREAT_SEED_SALT ^ Math.imul(active.startDay + 7, 0x85ebca6b)));
  const success = roll.value < responseChance(s, def);
  const untilDay = success && def.successEndsInDays > 0 ? Math.min(active.untilDay, s.day + def.successEndsInDays) : active.untilDay;
  const next: GameState = {
    ...s,
    cash: cents(s.cash - cost),
    debt: success ? s.debt : clamp(s.debt + def.failDebt, 0, 100),
    threats: { ...st, active: { ...active, response: id, success, paid: cost, untilDay } },
  };
  // У ответа без риска исход известен заранее — в ленте о нём пишется спокойно.
  next.news = news(next, `${id}${success ? 'Won' : 'Lost'}`, def.chance >= 1 ? 'mixed' : success ? 'good' : 'bad');
  return next;
}

export interface ThreatResponseView {
  id: ThreatResponseId;
  cost: number;
  /** Шанс удачи в процентах; 100 — исход известен заранее */
  chancePct: number;
  /** Что будет при удаче: на сколько процентов меньше людей придёт, больше уйдёт и меньше дохода, чем без угрозы */
  success: { fewerUsersPct: number; moreChurnPct: number; lessRevenuePct: number; lessRevenuePerMonth: number; endsInDays: number };
  /** Что прибавится к техническому долгу при неудаче */
  failDebt: number;
  blocked: ThreatResponseBlock | null;
}

export interface ThreatView {
  /** Угрозы касаются компании: службы уже есть */
  unlocked: boolean;
  /** Шанс, что угроза начнётся в течение года, в процентах */
  yearlyChancePct: { kind: ThreatKind; pct: number }[];
  active: {
    kind: ThreatKind;
    daysIn: number;
    /** Обычный срок такой угрозы, в месяцах: точный срок игроку неизвестен */
    monthsFrom: number;
    monthsTo: number;
    /** Давление сейчас: на сколько процентов меньше людей приходит, больше уходит и меньше дохода */
    fewerUsersPct: number;
    moreChurnPct: number;
    lessRevenuePct: number;
    response: ThreatResponseId | null;
    success: boolean | null;
    paid: number;
    /** Удачный ответ уже гонит угрозу прочь: сколько дней осталось */
    endsInDays: number | null;
    responses: ThreatResponseView[];
  } | null;
  last: ThreatsState['last'];
  count: number;
}

/** На сколько процентов множитель больше единицы и на сколько меньше. */
const pct = (factor: number): number => Math.round((factor - 1) * 100);
const lessPct = (factor: number): number => Math.round((1 - factor) * 100);

/** Всё, что экрану нужно знать об угрозах. Состояние не меняет. */
export function threatView(s: GameState, content: GameContent): ThreatView {
  const cfg = content.config;
  const st = threatsOf(s);
  const a = st.active;
  const def = a ? kindDef(cfg, a.kind) : undefined;
  const now = threatPressure(s, cfg);
  const periodsPerYear = 360 / cfg.threats.periodDays;
  return {
    unlocked: unlocked(s, cfg),
    yearlyChancePct: cfg.threats.kinds.map((k) => ({ kind: k.id, pct: Math.round((1 - Math.pow(1 - k.chance, periodsPerYear)) * 100) })),
    active:
      a && def
        ? {
            kind: a.kind,
            daysIn: s.day - a.startDay,
            monthsFrom: Math.round(def.minDays / 30),
            monthsTo: Math.round(def.maxDays / 30),
            fewerUsersPct: lessPct(now.acquisition),
            moreChurnPct: pct(now.churn),
            lessRevenuePct: lessPct(now.revenue),
            response: a.response,
            success: a.success,
            paid: a.paid,
            endsInDays: a.success && (def.responses.find((r) => r.id === a.response)?.successEndsInDays ?? 0) > 0 ? Math.max(0, a.untilDay - s.day) : null,
            responses: def.responses.map((r) => ({
              id: r.id,
              cost: responseCost(s, r),
              chancePct: Math.round(responseChance(s, r) * 100),
              success: {
                fewerUsersPct: lessPct(r.success.acquisition),
                moreChurnPct: pct(r.success.churn),
                lessRevenuePct: lessPct(r.success.revenue),
                lessRevenuePerMonth: Math.round(revenue30(s) * (1 - r.success.revenue)),
                endsInDays: r.successEndsInDays,
              },
              failDebt: r.failDebt,
              blocked: responseBlock(s, a, r),
            })),
          }
        : null,
    last: st.last,
    count: st.count,
  };
}
