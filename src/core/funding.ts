// Раунды инвестиций: игрок сам зовёт инвестора и торгуется за цену доли — с риском, что тот уйдёт.
// Описание — docs/02-economy.md, раздел 28.

import { revenue30 } from './events';
import { clamp, valuation } from './formulas';
import { energyOf } from './founder';
import { createRng, nextFloat } from './rng';
import type { CounterDef, FundingConfig, FundingState, GameContent, GameState, InvestorDef, NewsItem } from './types';

/** Сдвиг seed, чтобы торг не совпадал с остальной случайностью партии. */
const FUNDING_SEED_SALT = 0x1f0d5a17;

const cents = (x: number): number => Math.round(x * 100) / 100;
const round100 = (x: number): number => Math.round(x / 100) * 100;
const shareOf = (s: GameState): number => s.founderShare ?? 1;
const valuationOf = (s: GameState): number => valuation(s.months, s.users, s.market);

/** Состояние раундов; до первых переговоров его нет. */
export function fundingOf(s: GameState): FundingState {
  return s.funding ?? { rng: createRng(s.seed ^ FUNDING_SEED_SALT), talks: null, readyDay: 0, promise: null, last: null, rounds: 0, kept: 0, broken: 0 };
}

function addNews(s: GameState, item: Omit<NewsItem, 'day'>): NewsItem[] {
  return [...(s.news ?? []), { day: s.day, ...item }].slice(-40);
}

/** Из чего складывается переговорная позиция: знак показывает, помогает это или мешает. */
export interface PositionReason {
  id: 'growth' | 'profit' | 'runway' | 'reputation' | 'promises';
  sign: 1 | -1;
}

/**
 * Переговорная позиция: чем она сильнее, тем щедрее первое предложение и тем охотнее инвестор уступает.
 * Растущая прибыльная компания с хорошей репутацией торгуется с позиции силы; та, у которой кончаются деньги, — нет.
 */
export function fundingPosition(s: GameState): { score: number; level: 'weak' | 'normal' | 'strong'; reasons: PositionReason[] } {
  const reasons: PositionReason[] = [];
  const last = s.months[s.months.length - 1];
  const prev = s.months[s.months.length - 2];
  if (last && prev) {
    if (last.users > prev.users * 1.1) reasons.push({ id: 'growth', sign: 1 });
    else if (last.users < prev.users) reasons.push({ id: 'growth', sign: -1 });
  }
  if (last && last.profit > 0) reasons.push({ id: 'profit', sign: 1 });
  // Денег меньше чем на три месяца убытков: инвестор видит, что вам некуда деваться.
  if (last && last.profit < 0 && s.cash < -last.profit * 3) reasons.push({ id: 'runway', sign: -1 });
  if (s.reputation >= 70) reasons.push({ id: 'reputation', sign: 1 });
  else if (s.reputation < 40) reasons.push({ id: 'reputation', sign: -1 });
  const st = fundingOf(s);
  if (st.kept > st.broken) reasons.push({ id: 'promises', sign: 1 });
  else if (st.broken > st.kept) reasons.push({ id: 'promises', sign: -1 });
  const score = clamp(
    reasons.reduce((sum, r) => sum + r.sign, 0),
    -2,
    3,
  );
  return { score, level: score <= -1 ? 'weak' : score >= 2 ? 'strong' : 'normal', reasons };
}

/** Первое предложение инвестора в деньгах. */
function firstOffer(s: GameState, def: InvestorDef, cfg: FundingConfig): number {
  const price = clamp(def.price * (1 + cfg.positionPrice * fundingPosition(s).score), 0, cfg.maxPrice);
  return round100(valuationOf(s) * def.share * price);
}

export type FundingBlock = 'notLaunched' | 'valuation' | 'talks' | 'cooldown' | 'share' | 'promise' | 'energy';

/** Почему нельзя начать переговоры (с этим инвестором, если он назван); null — можно. */
export function fundingBlock(s: GameState, content: GameContent, def?: InvestorDef): FundingBlock | null {
  const cfg = content.config.funding;
  const st = fundingOf(s);
  if (!s.launched) return 'notLaunched';
  if (st.talks) return 'talks';
  if (valuationOf(s) < cfg.minValuation) return 'valuation';
  if (s.day < st.readyDay) return 'cooldown';
  if (energyOf(s) < cfg.energyCost) return 'energy';
  if (def) {
    if (shareOf(s) * (1 - def.share) < cfg.minFounderShare) return 'share';
    if (def.promise && st.promise) return 'promise';
  }
  return null;
}

/** Начинает переговоры: инвестор называет первую цену. Возвращает null, если нельзя. */
export function openRound(s: GameState, content: GameContent, investorId: string): GameState | null {
  const cfg = content.config.funding;
  const def = cfg.investors.find((i) => i.id === investorId);
  if (!def || fundingBlock(s, content, def) !== null) return null;
  return {
    ...s,
    energy: Math.max(0, energyOf(s) - cfg.energyCost),
    funding: {
      ...fundingOf(s),
      talks: { investor: def.id, share: def.share, offer: firstOffer(s, def, cfg), valuation: valuationOf(s), patience: def.patience, raises: 0, untilDay: s.day + cfg.talkDays },
    },
  };
}

type Talks = NonNullable<FundingState['talks']>;

/** Больше этого инвестор не заплатит. */
const offerCap = (talks: Talks, cfg: FundingConfig): number => round100(talks.valuation * talks.share * cfg.maxPrice);

/** Что будет, если торговаться так: новая сумма и шанс, что инвестор уступит. */
function counterTerms(s: GameState, talks: Talks, counter: CounterDef, content: GameContent): { offer: number; chance: number } {
  const cfg = content.config.funding;
  const def = cfg.investors.find((i) => i.id === talks.investor);
  const chance = clamp(counter.chance + (def?.flexibility ?? 0) + cfg.positionChance * fundingPosition(s).score - cfg.raisePenalty * talks.raises, cfg.chanceMin, cfg.chanceMax);
  return { offer: Math.min(offerCap(talks, cfg), round100(talks.offer * (1 + counter.raise))), chance };
}

/** Торг: инвестор либо уступает, либо теряет терпение; кончилось терпение — уходит, и раунд сорван. */
export function counterOffer(s: GameState, content: GameContent, stance: CounterDef['id']): GameState | null {
  const cfg = content.config.funding;
  const st = fundingOf(s);
  const counter = cfg.counters.find((c) => c.id === stance);
  const talks = st.talks;
  if (!talks || !counter) return null;
  const terms = counterTerms(s, talks, counter, content);
  if (terms.offer <= talks.offer) return null;

  const roll = nextFloat(st.rng);
  if (roll.value < terms.chance) {
    return { ...s, funding: { ...st, rng: roll.next, talks: { ...talks, offer: terms.offer, raises: talks.raises + 1, lastCounter: { stance, ok: true } } } };
  }
  if (talks.patience > 1) {
    return { ...s, funding: { ...st, rng: roll.next, talks: { ...talks, patience: talks.patience - 1, lastCounter: { stance, ok: false } } } };
  }
  return {
    ...s,
    reputation: clamp(s.reputation + cfg.walkedReputation, 0, 100),
    news: addNews(s, { kind: 'funding', id: 'walked', tone: 'bad' }),
    funding: { ...st, rng: roll.next, talks: null, readyDay: s.day + cfg.cooldownWalked, last: { day: s.day, kind: 'walked', investor: talks.investor, amount: 0, share: 0 } },
  };
}

/** Согласиться на нынешнее предложение: деньги на счёт, доля — инвестору, его условия вступают в силу. */
export function closeRound(s: GameState, content: GameContent): GameState | null {
  const cfg = content.config.funding;
  const st = fundingOf(s);
  const talks = st.talks;
  if (!talks) return null;
  const def = cfg.investors.find((i) => i.id === talks.investor);
  const now = revenue30(s);
  const promise = def?.promise
    ? { investor: talks.investor, from: now, target: Math.max(1, now) * def.promise.growth, dueDay: s.day + def.promise.days, penaltyShare: def.promise.penaltyShare }
    : st.promise;
  return {
    ...s,
    cash: cents(s.cash + talks.offer),
    founderShare: Math.round(shareOf(s) * (1 - talks.share) * 10_000) / 10_000,
    ...(def?.perk ? { modifiers: [...s.modifiers, { target: 'acquisition' as const, factor: def.perk.factor, untilDay: s.day + def.perk.days }] } : {}),
    news: addNews(s, { kind: 'invest', value: talks.offer }),
    funding: {
      ...st,
      talks: null,
      promise,
      readyDay: s.day + cfg.cooldownClosed,
      rounds: st.rounds + 1,
      last: { day: s.day, kind: 'closed', investor: talks.investor, amount: talks.offer, share: talks.share },
    },
  };
}

/** Уйти с переговоров самому: без обид, но и без денег. */
export function leaveRound(s: GameState, content: GameContent): GameState | null {
  const st = fundingOf(s);
  if (!st.talks) return null;
  return {
    ...s,
    funding: { ...st, talks: null, readyDay: s.day + content.config.funding.cooldownLeft, last: { day: s.day, kind: 'left', investor: st.talks.investor, amount: 0, share: 0 } },
  };
}

/** Цена выкупа доли обратно: дороже оценки — инвесторы просто так не уходят. */
function buybackCost(s: GameState, share: number, cfg: FundingConfig): number {
  return round100(valuationOf(s) * cfg.buybackPrice * share);
}

/** Выкупить часть доли у инвесторов. Возвращает null, если нельзя. */
export function buyBack(s: GameState, content: GameContent, share: number): GameState | null {
  const cfg = content.config.funding;
  if (!cfg.buybackSteps.includes(share) || fundingOf(s).talks) return null;
  const step = Math.min(share, Math.round((1 - shareOf(s)) * 10_000) / 10_000);
  const cost = buybackCost(s, step, cfg);
  if (step <= 0 || cost <= 0 || s.cash < cost) return null;
  return {
    ...s,
    cash: cents(s.cash - cost),
    founderShare: Math.round((shareOf(s) + step) * 10_000) / 10_000,
    news: addNews(s, { kind: 'funding', id: 'buyback', tone: 'good', value: Math.round(step * 1000) / 10 }),
  };
}

/** Шаг дня: предложение сгорает по сроку; обещание инвестору сдержано или сорвано. Меняет черновик состояния. */
export function stepFunding(s: GameState, content: GameContent): void {
  const st = s.funding;
  if (!st) return;
  const cfg = content.config.funding;
  let next = st;

  if (next.talks && s.day >= next.talks.untilDay - 1) {
    next = { ...next, talks: null, readyDay: s.day + cfg.cooldownLeft, last: { day: s.day, kind: 'expired', investor: next.talks.investor, amount: 0, share: 0 } };
  }

  const p = next.promise;
  if (p) {
    const terms = cfg.investors.find((i) => i.id === p.investor)?.promise;
    if (revenue30(s) >= p.target) {
      next = { ...next, promise: null, kept: next.kept + 1 };
      s.reputation = clamp(s.reputation + (terms?.keptReputation ?? 0), 0, 100);
      s.news = addNews(s, { kind: 'funding', id: 'promiseKept', tone: 'good' });
    } else if (s.day >= p.dueDay - 1) {
      next = { ...next, promise: null, broken: next.broken + 1 };
      // Инвестор забирает ещё часть компании — из доли основателя.
      s.founderShare = Math.round(shareOf(s) * (1 - p.penaltyShare) * 10_000) / 10_000;
      s.reputation = clamp(s.reputation + (terms?.brokenReputation ?? 0), 0, 100);
      s.news = addNews(s, { kind: 'funding', id: 'promiseBroken', tone: 'bad', value: Math.round(p.penaltyShare * 100) });
    }
  }

  if (next !== st) s.funding = next;
}

export interface InvestorView {
  id: string;
  /** Какую долю компании покупает, в процентах */
  sharePct: number;
  /** Первое предложение в деньгах и во сколько процентов от честной цены доли оно выходит */
  offer: number;
  pricePct: number;
  patience: number;
  /** Сколько процентов компании останется у основателя после сделки */
  shareAfterPct: number;
  perk: { boostPct: number; days: number } | null;
  /** Обещание роста: на сколько процентов, за сколько дней, до какого дохода, и сколько процентов доли стоит срыв */
  promise: { growthPct: number; days: number; target: number; penaltyPct: number } | null;
  blocked: FundingBlock | null;
}

export interface FundingView {
  valuation: number;
  /** Доля основателя в процентах и сколько она стоит */
  founderSharePct: number;
  stakeValue: number;
  position: ReturnType<typeof fundingPosition>;
  blocked: FundingBlock | null;
  minValuation: number;
  cooldownDaysLeft: number;
  energyCost: number;
  investors: InvestorView[];
  talks: {
    investor: string;
    sharePct: number;
    offer: number;
    pricePct: number;
    patience: number;
    daysLeft: number;
    shareAfterPct: number;
    /** Как можно торговаться: новая сумма и шанс, что уступит; atMax — выше инвестор не заплатит */
    counters: { stance: CounterDef['id']; offer: number; chancePct: number; atMax: boolean }[];
    /** Последний отказ уведёт инвестора */
    lastChance: boolean;
    lastCounter: { stance: CounterDef['id']; ok: boolean } | null;
  } | null;
  promise: { investor: string; now: number; target: number; progress: number; daysLeft: number; penaltyPct: number } | null;
  last: FundingState['last'];
  rounds: number;
  kept: number;
  broken: number;
  /** Выкуп доли обратно: шаги в процентах, цена и почему нельзя */
  buyback: { pricePct: number; options: { share: number; sharePct: number; cost: number; blocked: 'full' | 'cash' | 'talks' | null }[] };
}

/** Всё, что экрану нужно знать о раундах. Состояние не меняет. */
export function fundingView(s: GameState, content: GameContent): FundingView {
  const cfg = content.config.funding;
  const st = fundingOf(s);
  const v = valuationOf(s);
  const mine = shareOf(s);
  const pct = (x: number) => Math.round(x * 1000) / 10;
  const fair = (share: number, base = v) => Math.max(1, base * share);
  const now = revenue30(s);

  const investors = cfg.investors.map((def): InvestorView => {
    const offer = firstOffer(s, def, cfg);
    return {
      id: def.id,
      sharePct: pct(def.share),
      offer,
      pricePct: Math.round((offer / fair(def.share)) * 100),
      patience: def.patience,
      shareAfterPct: pct(mine * (1 - def.share)),
      perk: def.perk ? { boostPct: Math.round((def.perk.factor - 1) * 100), days: def.perk.days } : null,
      promise: def.promise ? { growthPct: Math.round((def.promise.growth - 1) * 100), days: def.promise.days, target: Math.max(1, now) * def.promise.growth, penaltyPct: pct(def.promise.penaltyShare) } : null,
      blocked: fundingBlock(s, content, def),
    };
  });

  const t = st.talks;
  return {
    valuation: v,
    founderSharePct: pct(mine),
    stakeValue: v * mine,
    position: fundingPosition(s),
    blocked: fundingBlock(s, content),
    minValuation: cfg.minValuation,
    cooldownDaysLeft: Math.max(0, st.readyDay - s.day),
    energyCost: cfg.energyCost,
    investors,
    talks: t
      ? {
          investor: t.investor,
          sharePct: pct(t.share),
          offer: t.offer,
          pricePct: Math.round((t.offer / fair(t.share, t.valuation)) * 100),
          patience: t.patience,
          daysLeft: Math.max(0, t.untilDay - s.day),
          shareAfterPct: pct(mine * (1 - t.share)),
          counters: cfg.counters.map((c) => {
            const terms = counterTerms(s, t, c, content);
            return { stance: c.id, offer: terms.offer, chancePct: Math.round(terms.chance * 100), atMax: terms.offer <= t.offer };
          }),
          lastChance: t.patience <= 1,
          lastCounter: t.lastCounter ?? null,
        }
      : null,
    promise: st.promise
      ? {
          investor: st.promise.investor,
          now,
          target: st.promise.target,
          progress: clamp((now - st.promise.from) / Math.max(1, st.promise.target - st.promise.from), 0, 1),
          daysLeft: Math.max(0, st.promise.dueDay - s.day),
          penaltyPct: pct(st.promise.penaltyShare),
        }
      : null,
    last: st.last,
    rounds: st.rounds,
    kept: st.kept,
    broken: st.broken,
    buyback: {
      pricePct: Math.round(cfg.buybackPrice * 100),
      options: cfg.buybackSteps.map((share) => {
        const step = Math.min(share, Math.round((1 - mine) * 10_000) / 10_000);
        const cost = buybackCost(s, step, cfg);
        return { share, sharePct: pct(step), cost, blocked: st.talks ? ('talks' as const) : step <= 0 || cost <= 0 ? ('full' as const) : s.cash < cost ? ('cash' as const) : null };
      }),
    },
  };
}
