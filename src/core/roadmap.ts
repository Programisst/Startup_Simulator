// Запросы рынка: работа над продуктом, которая не кончается.
// Когда все функции готовы, раз в полтора месяца приходят три запроса: что просят пользователи,
// что заказал крупный клиент и что придумала команда. Всё сразу не успеть — игрок выбирает.
// Сработает ли сделанное, заранее неизвестно; спрос можно проверить, прежде чем строить.
// Описание и сверка с жизнью — docs/02-economy.md, раздел 35.

import { revenue30 } from './events';
import { featuresOf } from './features';
import { clamp, expectation } from './formulas';
import { founderWorkPerDay } from './founder';
import { createRng, nextFloat, nextInt } from './rng';
import { teamOf, teamWorkPerDay } from './team';
import type { GameConfig, GameContent, GameState, NewsItem, RequestEffect, RequestOutcome, RequestSource, RequestSourceDef, RoadmapState, Task } from './types';

/** Сдвиг seed, чтобы запросы не совпадали с остальной случайностью партии. */
const ROADMAP_SEED_SALT = 0x3b9d64a1;

const cents = (x: number): number => Math.round(x * 100) / 100;
const round100 = (x: number): number => Math.round(x / 100) * 100;

type RequestTask = Extract<Task, { kind: 'request' }>;

const windowOf = (s: GameState, cfg: GameConfig): number => Math.floor(s.day / cfg.roadmap.periodDays);

/** Состояние запросов на текущий период: отметки прошлого периода в новом не действуют. */
export function roadmapOf(s: GameState, cfg: GameConfig): RoadmapState {
  const st = s.roadmap ?? { wave: -1, taken: [], check: null, built: 0, hits: 0, flops: 0, churnHits: 0, last: null };
  const wave = windowOf(s, cfg);
  return st.wave === wave ? st : { ...st, wave, taken: [], check: null };
}

/** Запросы приходят, когда продукт собран: все его функции готовы и он на рынке. */
function unlocked(s: GameState, content: GameContent): boolean {
  return s.launched && featuresOf(s, content).every((f) => s.doneFeatures.includes(f.id));
}

/** Запрос периода: зависит только от партии, номера периода и источника. */
export function requestOfWindow(seed: number, wave: number, def: RequestSourceDef, cfg: GameConfig): { days: number; name: number; works: boolean } {
  const index = cfg.roadmap.sources.findIndex((x) => x.id === def.id);
  const start = createRng(seed ^ ROADMAP_SEED_SALT ^ Math.imul(wave + 1, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca6b));
  const days = nextInt(start, def.minDays, def.maxDays);
  const name = nextInt(days.next, 0, Math.max(0, cfg.roadmap.names - 1));
  const works = nextFloat(name.next);
  return { days: days.value, name: name.value, works: works.value < def.chance };
}

/** Чем больше компания, тем дороже каждая переделка: больше людей пользуются, больше связей в коде. */
function scaleOf(s: GameState, cfg: GameConfig): number {
  return clamp(revenue30(s) / cfg.roadmap.revenuePerScale, 1, cfg.roadmap.maxScale);
}

/** Сколько работы команда делает за день прямо сейчас — тот же расчёт, что в шаге дня. */
function workPerDay(s: GameState, content: GameContent): number {
  const cfg = content.config;
  return (founderWorkPerDay(s, cfg) + teamWorkPerDay(teamOf(s, content), cfg.team)) * (s.rush ? cfg.rushSpeed : 1);
}

/**
 * Ставит задачу в очередь перед «улучшением продукта»: оно не кончается само,
 * и всё, что стоит за ним, никогда бы не началось. Улучшение — работа на то время, когда больше делать нечего.
 */
export function beforePolish(tasks: Task[], task: Task): Task[] {
  const polish = tasks.findIndex((t) => t.kind === 'polish');
  return polish < 0 ? [...tasks, task] : [...tasks.slice(0, polish), task, ...tasks.slice(polish)];
}

const sourceDef = (cfg: GameConfig, source: RequestSource): RequestSourceDef | undefined => cfg.roadmap.sources.find((x) => x.id === source);

function checkCost(s: GameState, cfg: GameConfig): number {
  return Math.max(100, round100(revenue30(s) * cfg.roadmap.checkCostShare));
}

/** Взять запрос в работу: он встаёт в очередь задач. Возвращает null, если нельзя. */
export function takeRequest(s: GameState, content: GameContent, source: RequestSource): GameState | null {
  const cfg = content.config;
  const def = sourceDef(cfg, source);
  const st = roadmapOf(s, cfg);
  if (!def || !unlocked(s, content) || st.taken.includes(source)) return null;
  const offer = requestOfWindow(s.seed, st.wave, def, cfg);
  const task: RequestTask = { kind: 'request', wave: st.wave, source, name: offer.name, progress: 0, cost: Math.round(offer.days * scaleOf(s, cfg) * 10) / 10 };
  if (def.deadlineDays !== undefined) {
    task.dueDay = s.day + def.deadlineDays;
    task.reward = Math.max(100, round100(revenue30(s) * (def.reward ?? 0)));
  }
  return { ...s, tasks: beforePolish(s.tasks, task), roadmap: { ...st, taken: [...st.taken, source] } };
}

export type RequestCheckBlock = 'sure' | 'used' | 'cash';

function checkBlock(s: GameState, cfg: GameConfig, st: RoadmapState, def: RequestSourceDef): RequestCheckBlock | null {
  if (def.chance >= 1) return 'sure';
  if (st.check) return 'used';
  if (s.cash < checkCost(s, cfg)) return 'cash';
  return null;
}

/** Проверить спрос: стоит денег и нескольких дней, зато станет известно, сработает ли запрос. Одна проверка на период. */
export function checkRequest(s: GameState, content: GameContent, source: RequestSource): GameState | null {
  const cfg = content.config;
  const def = sourceDef(cfg, source);
  const st = roadmapOf(s, cfg);
  if (!def || !unlocked(s, content) || checkBlock(s, cfg, st, def) !== null) return null;
  return { ...s, cash: cents(s.cash - checkCost(s, cfg)), roadmap: { ...st, check: { source, readyDay: s.day + cfg.roadmap.checkDays } } };
}

function applyEffect(s: GameState, content: GameContent, e: RequestEffect, st: RoadmapState): RoadmapState {
  const cfg = content.config;
  s.polish += e.value * expectation(s.market, cfg, s.day);
  s.debt = clamp(s.debt + e.debt, 0, 100);
  s.reputation = clamp(s.reputation + e.reputation, 0, 100);
  let next = st;
  if (e.churn !== 1 && st.churnHits < cfg.roadmap.maxChurnHits) {
    s.market = { ...s.market, churnBase: s.market.churnBase * e.churn };
    next = { ...next, churnHits: st.churnHits + 1 };
  }
  if (e.market !== 1) s.market = { ...s.market, marketSize: s.market.marketSize * e.market };
  if (e.boost) s.modifiers = [...s.modifiers, { target: 'acquisition', factor: e.boost.factor, untilDay: s.day + e.boost.days }];
  return next;
}

/** Запрос доделан: выясняется, сработал ли он. Меняет черновик состояния. */
export function completeRequest(s: GameState, content: GameContent, task: RequestTask): void {
  const cfg = content.config;
  const def = sourceDef(cfg, task.source);
  if (!def) return;
  // Счётчики общие для всей партии; отметки периода (что взято, что проверено) остаются как были.
  let st: RoadmapState = s.roadmap ?? roadmapOf(s, cfg);
  let outcome: RequestOutcome;
  let cash = 0;
  if (def.deadlineDays !== undefined) {
    // Заказ клиента: деньги — только если успели к сроку.
    const onTime = task.dueDay === undefined || s.day <= task.dueDay;
    outcome = onTime ? 'paid' : 'late';
    st = applyEffect(s, content, def.hit, st);
    if (onTime) {
      cash = task.reward ?? 0;
      s.cash = cents(s.cash + cash);
    } else {
      s.reputation = clamp(s.reputation + (def.lateReputation ?? 0), 0, 100);
    }
  } else {
    const works = requestOfWindow(s.seed, task.wave, def, cfg).works;
    outcome = works ? 'hit' : 'flop';
    st = applyEffect(s, content, works ? def.hit : def.flop, st);
  }
  const good = outcome === 'hit' || outcome === 'paid';
  s.roadmap = { ...st, built: st.built + 1, hits: st.hits + (good ? 1 : 0), flops: st.flops + (good ? 0 : 1), last: { day: s.day, source: task.source, name: task.name, outcome, cash } };
  const tone: NewsItem['tone'] = good ? 'good' : 'bad';
  s.news = [...(s.news ?? []), { day: s.day, kind: 'request' as const, id: `${task.source}:${outcome}`, tone, value: cash, variant: task.name }].slice(-40);
}

/** Запрос сняли с очереди. Клиенту обещали — отказ бьёт по репутации. Меняет черновик состояния. */
export function dropRequest(s: GameState, content: GameContent, task: RequestTask): void {
  const def = sourceDef(content.config, task.source);
  if (def?.deadlineDays === undefined) return;
  s.reputation = clamp(s.reputation + (def.lateReputation ?? 0), 0, 100);
  s.news = [...(s.news ?? []), { day: s.day, kind: 'request' as const, id: `${task.source}:late`, tone: 'bad' as const, value: 0, variant: task.name }].slice(-40);
}

export interface RequestView {
  source: RequestSource;
  /** Номер названия в списке источника */
  name: number;
  /** Сколько работы стоит и за сколько дней команда сделает это одна, без других задач; null — работать некому */
  cost: number;
  days: number | null;
  /** Шанс, что сработает, в процентах; 100 — исход известен заранее */
  chancePct: number;
  /** Что показала проверка спроса; null — не проверяли или ответа ещё нет */
  known: 'hit' | 'flop' | null;
  hit: { churnPct: number; marketPct: number; reputation: number; boostPct: number; boostDays: number };
  flopDebt: number;
  /** Заказ клиента: сколько заплатит, сколько дней даёт и успеет ли команда */
  reward: number;
  deadlineDays: number;
  tooSlow: boolean;
  debt: number;
  lateReputation: number;
  /** Уже взят в работу в этом периоде */
  taken: boolean;
  check: { state: 'none' | 'running' | 'done'; daysLeft: number; blocked: RequestCheckBlock | null };
}

export interface RoadmapView {
  /** Запросы открыты: продукт собран */
  unlocked: boolean;
  featuresDone: number;
  featuresTotal: number;
  /** Через сколько дней придут новые запросы */
  nextInDays: number;
  /** Сколько работы команда делает за день */
  workPerDay: number;
  checkCost: number;
  checkDays: number;
  requests: RequestView[];
  /** Запросы в очереди задач: что, сколько сделано и сколько дней до срока клиента */
  inWork: { source: RequestSource; name: number; progress: number; daysToDeadline: number | null; reward: number }[];
  built: number;
  hits: number;
  flops: number;
  last: RoadmapState['last'];
}

const pct = (factor: number): number => Math.round(Math.abs(factor - 1) * 100);

/** Всё, что экрану нужно знать о запросах. Состояние не меняет. */
export function roadmapView(s: GameState, content: GameContent): RoadmapView {
  const cfg = content.config;
  const r = cfg.roadmap;
  const st = roadmapOf(s, cfg);
  const open = unlocked(s, content);
  const defs = featuresOf(s, content);
  const speed = workPerDay(s, content);
  const scale = scaleOf(s, cfg);
  const month = revenue30(s);

  const requests: RequestView[] = !open
    ? []
    : r.sources.map((def) => {
        const offer = requestOfWindow(s.seed, st.wave, def, cfg);
        const cost = Math.round(offer.days * scale * 10) / 10;
        const days = speed > 0 ? Math.max(1, Math.ceil(cost / speed)) : null;
        const checked = st.check?.source === def.id ? st.check : null;
        const ready = checked !== null && s.day >= checked.readyDay;
        return {
          source: def.id,
          name: offer.name,
          cost,
          days,
          chancePct: Math.round(def.chance * 100),
          known: ready ? (offer.works ? 'hit' : 'flop') : null,
          hit: { churnPct: pct(def.hit.churn), marketPct: pct(def.hit.market), reputation: def.hit.reputation, boostPct: def.hit.boost ? pct(def.hit.boost.factor) : 0, boostDays: def.hit.boost?.days ?? 0 },
          flopDebt: def.flop.debt,
          reward: def.deadlineDays !== undefined ? Math.max(100, round100(month * (def.reward ?? 0))) : 0,
          deadlineDays: def.deadlineDays ?? 0,
          tooSlow: def.deadlineDays !== undefined && (days === null || days > def.deadlineDays),
          debt: def.hit.debt,
          lateReputation: def.lateReputation ?? 0,
          taken: st.taken.includes(def.id),
          check: { state: !checked ? 'none' : ready ? 'done' : 'running', daysLeft: checked ? Math.max(0, checked.readyDay - s.day) : 0, blocked: checked ? null : checkBlock(s, cfg, st, def) },
        };
      });

  return {
    unlocked: open,
    featuresDone: defs.filter((f) => s.doneFeatures.includes(f.id)).length,
    featuresTotal: defs.length,
    nextInDays: r.periodDays - (s.day % r.periodDays),
    workPerDay: speed,
    checkCost: checkCost(s, cfg),
    checkDays: r.checkDays,
    requests,
    inWork: s.tasks
      .filter((t): t is RequestTask => t.kind === 'request')
      .map((t) => ({ source: t.source, name: t.name, progress: t.cost > 0 ? clamp(t.progress / t.cost, 0, 1) : 1, daysToDeadline: t.dueDay !== undefined ? t.dueDay - s.day : null, reward: t.reward ?? 0 })),
    built: st.built,
    hits: st.hits,
    flops: st.flops,
    last: st.last,
  };
}
