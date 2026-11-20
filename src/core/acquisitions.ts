// Покупка компаний: готовые пользователи и новый рынок за деньги — если внутри не пустышка.
// Описание — docs/02-economy.md, раздел 29.

import { revenue30 } from './events';
import { clamp } from './formulas';
import { createRng, nextFloat, nextInt } from './rng';
import type { AcquisitionsConfig, AcquisitionsState, GameConfig, GameContent, GameState, NewsItem, TargetDef, TargetHealth } from './types';

/** Сдвиг seed, чтобы компании на продажу не совпадали с остальной случайностью партии. */
const ACQUISITION_SEED_SALT = 0x2c1b3e59;

const cents = (x: number): number => Math.round(x * 100) / 100;
const round100 = (x: number): number => Math.round(x / 100) * 100;

/** Состояние покупок; до первой проверки или покупки его нет. */
export function acquisitionsOf(s: GameState): AcquisitionsState {
  return s.acquisitions ?? { rng: createRng(s.seed ^ ACQUISITION_SEED_SALT), window: null, check: null, integrating: null, last: null, bought: 0 };
}

const windowOf = (s: GameState, cfg: AcquisitionsConfig): number => Math.floor(s.day / cfg.periodDays);

function pick<T extends { weight: number }>(list: T[], roll: number): T {
  const total = list.reduce((sum, x) => sum + x.weight, 0);
  let left = roll * total;
  for (const x of list) {
    left -= x.weight;
    if (left < 0) return x;
  }
  return list[list.length - 1]!;
}

/** Компания периода: зависит только от партии и номера периода, поэтому до покупки в сохранении ничего не хранится. */
export function targetOfWindow(seed: number, window: number, cfg: GameConfig): TargetDef {
  const a = cfg.acquisitions;
  const start = createRng(seed ^ ACQUISITION_SEED_SALT ^ Math.imul(window + 1, 0x85ebca6b));
  const sizeRoll = nextFloat(start);
  const healthRoll = nextFloat(sizeRoll.next);
  const companyRoll = nextInt(healthRoll.next, 0, Math.max(0, a.companies - 1));
  return { size: pick(a.sizes, sizeRoll.value).id, health: pick(a.health, healthRoll.value).id, companySeed: companyRoll.value };
}

/** Компании начинают предлагать, когда своя твёрдо стоит на ногах. */
function unlocked(s: GameState, cfg: GameConfig): boolean {
  return s.launched && revenue30(s) >= cfg.acquisitions.minRevenue30;
}

/** Компания, которую сейчас можно купить, или null. */
export function targetNow(s: GameState, cfg: GameConfig): TargetDef | null {
  const a = cfg.acquisitions;
  const st = acquisitionsOf(s);
  const window = windowOf(s, a);
  if (!unlocked(s, cfg) || st.integrating || st.window === window || s.day % a.periodDays >= a.visibleDays) return null;
  return targetOfWindow(s.seed, window, cfg);
}

/** Сколько у компании пользователей (по её словам) и сколько она стоит: год вашего дохода с такого числа людей. */
function termsOf(s: GameState, target: TargetDef, a: AcquisitionsConfig): { users: number; price: number; lowPrice: number; checkCost: number } {
  const share = a.sizes.find((x) => x.id === target.size)?.share ?? 0;
  const price = Math.max(1000, round100(revenue30(s) * share * a.priceMonths));
  return { users: Math.round(s.users * share), price, lowPrice: round100(price * a.lowOffer), checkCost: Math.max(100, round100(price * a.checkCostShare)) };
}

/** Что проверка узнала о компании; null — проверки не было или она ещё идёт. */
function knownHealth(s: GameState, target: TargetDef, a: AcquisitionsConfig): TargetHealth | null {
  const check = acquisitionsOf(s).check;
  return check && check.window === windowOf(s, a) && s.day >= check.readyDay ? target.health : null;
}

export type AcquisitionBlock = 'locked' | 'waiting' | 'integrating';

/** Почему сейчас нечего покупать; null — компания на продажу есть. */
export function acquisitionBlock(s: GameState, cfg: GameConfig): AcquisitionBlock | null {
  if (!unlocked(s, cfg)) return 'locked';
  if (acquisitionsOf(s).integrating) return 'integrating';
  return targetNow(s, cfg) ? null : 'waiting';
}

/** Заказать проверку: стоит денег и времени, зато покажет, что у компании внутри. Возвращает null, если нельзя. */
export function checkTarget(s: GameState, content: GameContent): GameState | null {
  const a = content.config.acquisitions;
  const target = targetNow(s, content.config);
  const st = acquisitionsOf(s);
  const window = windowOf(s, a);
  if (!target || st.check?.window === window) return null;
  // Проверка должна успеть, пока компания ещё продаётся.
  if (a.visibleDays - (s.day % a.periodDays) <= a.checkDays) return null;
  const cost = termsOf(s, target, a).checkCost;
  if (s.cash < cost) return null;
  return { ...s, cash: cents(s.cash - cost), acquisitions: { ...st, check: { window, readyDay: s.day + a.checkDays } } };
}

/** Купить компанию: за полную цену — наверняка, за меньшую — если владельцы согласятся. Возвращает null, если нельзя. */
export function buyTarget(s: GameState, content: GameContent, offer: 'full' | 'low'): GameState | null {
  const a = content.config.acquisitions;
  const target = targetNow(s, content.config);
  if (!target || (offer !== 'full' && offer !== 'low')) return null;
  const st = acquisitionsOf(s);
  const terms = termsOf(s, target, a);
  const amount = offer === 'full' ? terms.price : terms.lowPrice;
  if (s.cash < amount) return null;
  const window = windowOf(s, a);

  let rng = st.rng;
  if (offer === 'low') {
    // Владельцы охотнее уступают тому, кто знает их слабые места.
    const known = knownHealth(s, target, a);
    const roll = nextFloat(rng);
    rng = roll.next;
    if (roll.value >= (known && known !== 'solid' ? a.lowChanceWeak : a.lowChance)) {
      return {
        ...s,
        news: [...(s.news ?? []), { day: s.day, kind: 'acquisition' as const, id: 'refused', tone: 'bad' as const, value: target.companySeed }].slice(-40),
        acquisitions: { ...st, rng, window, last: { day: s.day, kind: 'refused', health: null, users: 0, companySeed: target.companySeed } },
      };
    }
  }
  return {
    ...s,
    cash: cents(s.cash - amount),
    acquisitions: { ...st, rng, window, integrating: { target, users: terms.users, price: amount, doneDay: s.day + a.integrationDays } },
  };
}

/** Шаг дня: купленная компания присоединилась — выясняется, что у неё было внутри. Меняет черновик состояния. */
export function stepAcquisitions(s: GameState, content: GameContent): void {
  const st = s.acquisitions;
  const deal = st?.integrating;
  if (!st || !deal || s.day < deal.doneDay - 1) return;
  const a = content.config.acquisitions;
  const health = a.health.find((h) => h.id === deal.target.health);
  const trouble = a.sizes.find((x) => x.id === deal.target.size)?.trouble ?? 1;
  const kept = Math.round(deal.users * (health?.keep ?? 0));

  // Платящие переходят в той же доле, что и у нас: иначе купленные люди годами не приносили бы денег.
  const payingShare = s.users > 0 ? s.paying / s.users : 0;
  s.users += kept;
  s.paying += kept * payingShare;
  // Вместе с людьми приходит их рынок: расти снова есть куда.
  s.market = { ...s.market, marketSize: s.market.marketSize + kept * a.marketPerUser };
  s.bugs += Math.round((health?.bugs ?? 0) * trouble);
  s.debt = clamp(s.debt + (health?.debt ?? 0) * trouble, 0, 100);
  s.reputation = clamp(s.reputation + (health?.reputation ?? 0), 0, 100);
  // У пустышки всплывают долги, о которых продавец молчал: платить их теперь нам.
  if (health?.hiddenDebt) s.cash = cents(s.cash - round100(deal.price * health.hiddenDebt));

  const tone: NewsItem['tone'] = deal.target.health === 'solid' ? 'good' : deal.target.health === 'messy' ? 'mixed' : 'bad';
  s.news = [...(s.news ?? []), { day: s.day, kind: 'acquisition' as const, id: deal.target.health, tone, value: kept }].slice(-40);
  s.acquisitions = {
    ...st,
    integrating: null,
    bought: st.bought + 1,
    last: { day: s.day, kind: 'joined', health: deal.target.health, users: kept, companySeed: deal.target.companySeed },
  };
}

export interface AcquisitionsView {
  unlocked: boolean;
  minRevenue30: number;
  blocked: AcquisitionBlock | null;
  target: {
    companySeed: number;
    size: TargetDef['size'];
    /** Сколько пользователей у компании по её словам */
    users: number;
    price: number;
    lowPrice: number;
    /** Шанс, что владельцы согласятся на меньшую цену, в процентах */
    lowChancePct: number;
    daysLeft: number;
    /** Проверка: не заказана, идёт, готова; сколько стоит и почему её нельзя заказать */
    check: { state: 'none' | 'running' | 'done'; cost: number; days: number; daysLeft: number; blocked: 'cash' | 'late' | null };
    /** Что внутри — известно только после проверки */
    health: TargetHealth | null;
    /** Что принесёт покупка в каждом из трёх случаев и как часто он встречается */
    outcomes: { health: TargetHealth; oddsPct: number; users: number; market: number; bugs: number; debt: number; reputation: number; hiddenDebt: number }[];
    canBuyFull: boolean;
    canBuyLow: boolean;
    /** Серверы не выдержат новых людей: мощность стоит поднять заранее */
    overload: boolean;
    /** Продукт ещё не оправился от прошлых проблем: новые ошибки и долг уронят качество */
    strained: boolean;
  } | null;
  integrating: { companySeed: number; users: number; price: number; daysLeft: number } | null;
  last: AcquisitionsState['last'];
  bought: number;
  /** Через сколько дней появится следующая компания; null — она уже здесь или покупки закрыты */
  nextInDays: number | null;
}

/** Всё, что экрану нужно знать о покупке компаний. Состояние не меняет. */
export function acquisitionsView(s: GameState, content: GameContent): AcquisitionsView {
  const cfg = content.config;
  const a = cfg.acquisitions;
  const st = acquisitionsOf(s);
  const target = targetNow(s, cfg);
  const open = unlocked(s, cfg);
  const dayInWindow = s.day % a.periodDays;
  const window = windowOf(s, a);

  let view: AcquisitionsView['target'] = null;
  if (target) {
    const terms = termsOf(s, target, a);
    const trouble = a.sizes.find((x) => x.id === target.size)?.trouble ?? 1;
    const health = knownHealth(s, target, a);
    const check = st.check?.window === window ? st.check : null;
    const daysLeft = a.visibleDays - dayInWindow;
    const total = a.health.reduce((sum, h) => sum + h.weight, 0);
    view = {
      companySeed: target.companySeed,
      size: target.size,
      users: terms.users,
      price: terms.price,
      lowPrice: terms.lowPrice,
      lowChancePct: Math.round((health && health !== 'solid' ? a.lowChanceWeak : a.lowChance) * 100),
      daysLeft,
      check: {
        state: !check ? 'none' : health ? 'done' : 'running',
        cost: terms.checkCost,
        days: a.checkDays,
        daysLeft: check ? Math.max(0, check.readyDay - s.day) : 0,
        blocked: check ? null : daysLeft <= a.checkDays ? 'late' : s.cash < terms.checkCost ? 'cash' : null,
      },
      health,
      outcomes: a.health.map((h) => {
        const kept = Math.round(terms.users * h.keep);
        return { health: h.id, oddsPct: Math.round((h.weight / total) * 100), users: kept, market: Math.round(kept * a.marketPerUser), bugs: Math.round(h.bugs * trouble), debt: Math.round(h.debt * trouble), reputation: h.reputation, hiddenDebt: round100(terms.price * h.hiddenDebt) };
      }),
      canBuyFull: s.cash >= terms.price,
      canBuyLow: s.cash >= terms.lowPrice,
      overload: s.users + terms.users > s.capacity,
      strained: s.bugs >= a.strainBugs || s.debt >= a.strainDebt,
    };
  }

  return {
    unlocked: open,
    minRevenue30: a.minRevenue30,
    blocked: acquisitionBlock(s, cfg),
    target: view,
    integrating: st.integrating
      ? { companySeed: st.integrating.target.companySeed, users: st.integrating.users, price: st.integrating.price, daysLeft: Math.max(0, st.integrating.doneDay - s.day) }
      : null,
    last: st.last,
    bought: st.bought,
    nextInDays: open && !target && !st.integrating ? a.periodDays - dayInWindow : null,
  };
}
