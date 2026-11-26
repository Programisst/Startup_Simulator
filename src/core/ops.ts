// Службы компании: поддержка, продажи, администрация, сопровождение продукта.
// Пока компания мала, всё это делает основатель и его команда. Когда доход вырастает,
// появляются люди, которых на экране команды нет, — и они стоят денег.
// Растут службы вслед за доходом (по среднему за три месяца), а сжимаются сами только медленно:
// люди уходят по своей воле. Быстро сжать их можно только сокращением — с пособиями и последствиями.
// Описание и сверка с жизнью — docs/02-economy.md, разделы 33 и 34.

import { DAYS_IN_MONTH, clamp } from './formulas';
import { createRng, nextFloat } from './rng';
import type { GameConfig, GameContent, GameState, NewsItem, OpsConfig, OpsCutDef, OpsCutId, OpsLineId, OpsState } from './types';

/** Сдвиг seed, чтобы исход сокращения не совпадал с остальной случайностью партии. */
const OPS_SEED_SALT = 0x4d7c1a2f;
/** Меньшую экономию сокращением не считаем: увольнять некого. */
const MIN_CUT_SAVING = 100;

const cents = (x: number): number => Math.round(x * 100) / 100;

function averageRevenue(s: GameState, days: number): number {
  const slice = s.recentDays.slice(-days);
  if (slice.length === 0) return 0;
  return (slice.reduce((sum, d) => sum + d.revenue, 0) / slice.length) * DAYS_IN_MONTH;
}

/** Устойчивый месячный доход: средний за последние дни (не больше окна), умноженный на 30. По нему службы растут. */
export function steadyRevenue(s: GameState, cfg: OpsConfig): number {
  return averageRevenue(s, cfg.windowDays);
}

/** Сегодняшний месячный доход: средний за последние 30 дней. */
export function currentRevenue(s: GameState): number {
  return averageRevenue(s, DAYS_IN_MONTH);
}

/** Под какой месячный доход сейчас набраны службы. В старых сохранениях — устойчивый доход. */
export function opsLevelOf(s: GameState, cfg: OpsConfig): number {
  return s.ops?.level ?? steadyRevenue(s, cfg);
}

/**
 * Под какой доход службы будут набраны завтра.
 * Вверх — вслед за устойчивым доходом, но не выше сегодняшнего: после падения старое среднее никого не нанимает.
 * Вниз — только естественной убылью: люди понемногу уходят сами.
 */
export function nextOpsLevel(s: GameState, cfg: OpsConfig): number {
  const level = opsLevelOf(s, cfg);
  const wanted = Math.min(steadyRevenue(s, cfg), currentRevenue(s));
  if (wanted >= level) return wanted;
  const keepPerDay = Math.pow(1 - clamp(cfg.attritionPerYear, 0, 0.99), 1 / 360);
  return Math.max(wanted, level * keepPerDay);
}

/** Шаг дня: пересчитывает, под какой доход набраны службы. Меняет черновик состояния. */
export function stepOps(s: GameState, config: GameConfig): void {
  const level = nextOpsLevel(s, config.ops);
  // Пока служб нет и не было, в сохранении о них ничего не хранится.
  if (!s.ops && level <= (config.ops.steps[0]?.from ?? 0)) return;
  s.ops = { ...s.ops, level };
}

/**
 * Сколько стоят службы в месяц, если они набраны под такой доход.
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
  return opsCostFor(opsLevelOf(s, config.ops), config.ops);
}

export type OpsCutBlock = 'nothing' | 'cooldown' | 'cash';

interface CutTerms {
  newLevel: number;
  /** Сколько в месяц перестанет уходить на службы */
  saving: number;
  severance: number;
}

function cutTerms(s: GameState, cfg: OpsConfig, def: OpsCutDef): CutTerms {
  const level = opsLevelOf(s, cfg);
  const newLevel = Math.min(level, level - Math.max(0, level - currentRevenue(s)) * def.depth);
  const saving = opsCostFor(level, cfg) - opsCostFor(newLevel, cfg);
  return { newLevel, saving, severance: Math.round(saving * def.severanceMonths) };
}

function cutBlock(s: GameState, cfg: OpsConfig, terms: CutTerms): OpsCutBlock | null {
  if (terms.saving < MIN_CUT_SAVING) return 'nothing';
  if (s.ops?.cutDay !== undefined && s.day - s.ops.cutDay < cfg.cutCooldownDays) return 'cooldown';
  if (s.cash < terms.severance) return 'cash';
  return null;
}

/** Срочно сократить службы: пособия сразу, удар по репутации и настрою, риск сократить лишнего. Возвращает null, если нельзя. */
export function cutOps(s: GameState, content: GameContent, cut: OpsCutId): GameState | null {
  const cfg = content.config.ops;
  const def = cfg.cuts.find((c) => c.id === cut);
  if (!def) return null;
  const terms = cutTerms(s, cfg, def);
  if (cutBlock(s, cfg, terms) !== null) return null;

  // Исход зависит только от партии и дня: перезагрузка сохранения его не меняет.
  const roll = nextFloat(createRng(s.seed ^ OPS_SEED_SALT ^ Math.imul(s.day + 1, 0x27d4eb2f)));
  const backfired = roll.value < def.riskChance;
  const ops: OpsState = { ...s.ops, level: terms.newLevel, cutDay: s.day, last: { day: s.day, cut, severance: terms.severance, saving: Math.round(terms.saving), backfired } };
  const tone: NewsItem['tone'] = backfired ? 'bad' : 'mixed';
  return {
    ...s,
    cash: cents(s.cash - terms.severance),
    ops,
    reputation: clamp(s.reputation + def.reputation, 0, 100),
    // Оставшиеся видят, как увольняют соседей: настрой падает у всех.
    team: s.team ? { ...s.team, employees: s.team.employees.map((e) => ({ ...e, motivation: clamp(e.motivation + def.motivation, 0, 100) })) } : s.team,
    modifiers: backfired ? [...s.modifiers, { target: 'churn', factor: def.riskChurn, untilDay: s.day + def.riskDays }] : s.modifiers,
    news: [...(s.news ?? []), { day: s.day, kind: 'opsCut' as const, id: backfired ? 'backfired' : 'done', tone, value: terms.severance }].slice(-40),
  };
}

export interface OpsCutView {
  id: OpsCutId;
  /** Сколько будут стоить службы после сокращения, в месяц */
  costAfter: number;
  /** Сколько в месяц перестанет уходить */
  saving: number;
  /** Пособия уволенным — платятся сразу */
  severance: number;
  /** За сколько месяцев экономия вернёт пособия */
  paybackMonths: number;
  reputation: number;
  motivation: number;
  /** Шанс, что сократили лишнего, в процентах; и что тогда будет */
  riskPct: number;
  riskChurnPct: number;
  riskDays: number;
  blocked: OpsCutBlock | null;
}

export interface OpsView {
  /** Службы уже появились: доход вышел за первый порог */
  active: boolean;
  /** Доход, с которого появляются службы, в месяц */
  startsAt: number;
  /** Доход, под который службы сейчас набраны, в месяц */
  steadyRevenue: number;
  /** Сегодняшний доход: средний за 30 дней, в месяц */
  currentRevenue: number;
  costPerMonth: number;
  /** Какую долю дохода, под который они набраны, съедают службы, в процентах */
  sharePct: number;
  /** Сколько центов с каждого следующего доллара дохода уйдёт на службы */
  nextCents: number;
  lines: { id: OpsLineId; costPerMonth: number }[];
  /** Сколько в месяц уходит на лишних людей: службы набраны под доход больше сегодняшнего */
  excessPerMonth: number;
  /** Какая доля людей уходит сама за год, в процентах */
  attritionPct: number;
  cuts: OpsCutView[];
  /** Сколько дней ждать до следующего сокращения */
  cutCooldownLeft: number;
  last: OpsState['last'] | null;
}

export function opsView(s: GameState, config: GameConfig): OpsView {
  const cfg = config.ops;
  const level = opsLevelOf(s, cfg);
  const current = currentRevenue(s);
  const costPerMonth = opsCostFor(level, cfg);
  const weights = cfg.lines.reduce((sum, l) => sum + l.weight, 0);
  const step = [...cfg.steps].reverse().find((st) => level > st.from);
  return {
    active: costPerMonth > 0,
    startsAt: cfg.steps[0]?.from ?? 0,
    steadyRevenue: level,
    currentRevenue: current,
    costPerMonth,
    sharePct: level > 0 ? Math.round((costPerMonth / level) * 100) : 0,
    nextCents: Math.round((step?.rate ?? 0) * 100),
    lines: cfg.lines.map((l) => ({ id: l.id, costPerMonth: weights > 0 ? (costPerMonth * l.weight) / weights : 0 })),
    excessPerMonth: Math.max(0, costPerMonth - opsCostFor(Math.min(level, current), cfg)),
    attritionPct: Math.round(cfg.attritionPerYear * 100),
    cuts: cfg.cuts.map((def) => {
      const terms = cutTerms(s, cfg, def);
      return {
        id: def.id,
        costAfter: costPerMonth - terms.saving,
        saving: terms.saving,
        severance: terms.severance,
        paybackMonths: def.severanceMonths,
        reputation: def.reputation,
        motivation: def.motivation,
        riskPct: Math.round(def.riskChance * 100),
        riskChurnPct: Math.round((def.riskChurn - 1) * 100),
        riskDays: def.riskDays,
        blocked: cutBlock(s, cfg, terms),
      };
    }),
    cutCooldownLeft: s.ops?.cutDay !== undefined ? Math.max(0, cfg.cutCooldownDays - (s.day - s.ops.cutDay)) : 0,
    last: s.ops?.last ?? null,
  };
}
