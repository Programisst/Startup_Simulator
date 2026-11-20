// Охота за звёздами: сильного человека из чужой компании можно переманить — с шансом и с риском ответного удара.
// Описание — docs/02-economy.md, раздел 27.

import { eventSubject, revenue30 } from './events';
import { clamp } from './formulas';
import { energyOf } from './founder';
import { officeOf } from './office';
import { createRng, nextFloat, nextInt, nextRange } from './rng';
import { addStar, cashDaysAfterHire, RISKY_HIRE_DAYS, starAura, teamOf } from './team';
import type { DriverId, EmployeeRole, GameConfig, GameContent, GameState, HeadhuntOfferDef, HeadhuntOfferId, HeadhuntState, NewsItem, StarDef, TraitId } from './types';

/** Сдвиг seed, чтобы звёзды и их ответы не совпадали с остальной случайностью партии. */
const HEADHUNT_SEED_SALT = 0x57a4b0d1;
/** Небрежных среди звёзд не бывает. */
const STAR_TRAITS: TraitId[] = ['diligent', 'calm', 'loyal'];
const DRIVERS: DriverId[] = ['money', 'growth', 'peace', 'mission', 'people'];

const round50 = (x: number): number => Math.max(50, Math.round(x / 50) * 50);

/** Состояние охоты; до первого предложения его нет. */
export function headhuntOf(s: GameState): HeadhuntState {
  return s.headhunt ?? { rng: createRng(s.seed ^ HEADHUNT_SEED_SALT), window: null, pending: null, last: null, joined: 0 };
}

const windowOf = (s: GameState, cfg: GameConfig): number => Math.floor(s.day / cfg.headhunt.periodDays);

/** Звезда периода: зависит только от партии и номера периода, поэтому до предложения в сохранении ничего не хранится. */
export function starOfWindow(seed: number, window: number, cfg: GameConfig): StarDef {
  const h = cfg.headhunt;
  const start = createRng(seed ^ HEADHUNT_SEED_SALT ^ Math.imul(window + 1, 0x9e3779b1));
  const roleRoll = nextFloat(start);
  const role: EmployeeRole = roleRoll.value < cfg.team.developerShare ? 'developer' : 'marketer';
  const skillRoll = nextRange(roleRoll.next, h.skillMin, h.skillMax);
  const skill = Math.round(skillRoll.value * 10) / 10;
  const traitRoll = nextInt(skillRoll.next, 0, STAR_TRAITS.length - 1);
  const driverRoll = nextInt(traitRoll.next, 0, DRIVERS.length - 1);
  const nameRoll = nextInt(driverRoll.next, 0, 9999);
  const companyRoll = nextInt(nameRoll.next, 0, Math.max(0, h.companies - 1));
  return {
    nameSeed: nameRoll.value,
    role,
    skill,
    trait: STAR_TRAITS[traitRoll.value]!,
    driver: DRIVERS[driverRoll.value]!,
    salaryNow: round50(cfg.team.salaryBase[role] * skill ** cfg.team.salaryExponent),
    companySeed: companyRoll.value,
  };
}

/** Компанию замечают сильные люди: продукт на рынке и приносит заметные деньги. */
function unlocked(s: GameState, cfg: GameConfig): boolean {
  return s.launched && revenue30(s) >= cfg.headhunt.minRevenue30;
}

/** Звезда, которой сейчас можно сделать предложение, или null. */
export function starNow(s: GameState, cfg: GameConfig): StarDef | null {
  const h = cfg.headhunt;
  const st = headhuntOf(s);
  const window = windowOf(s, cfg);
  if (!unlocked(s, cfg) || st.pending || st.window === window || s.day % h.periodDays >= h.visibleDays) return null;
  return starOfWindow(s.seed, window, cfg);
}

/** Подходит ли компания человеку по тому, что им движет. */
export type StarFit = 'good' | 'neutral' | 'bad';

/** Как компания выглядит глазами звезды. Тому, кто работает за деньги, важен размер предложения. */
export function starFit(s: GameState, star: StarDef, offer: HeadhuntOfferDef, content: GameContent): StarFit {
  const team = teamOf(s, content).employees;
  switch (star.driver) {
    case 'money':
      return offer.id === 'lavish' ? 'good' : offer.id === 'modest' ? 'bad' : 'neutral';
    case 'mission':
      return s.reputation >= 60 ? 'good' : s.reputation < 35 ? 'bad' : 'neutral';
    case 'growth': {
      const last = s.months[s.months.length - 1];
      const prev = s.months[s.months.length - 2];
      if (!last || !prev) return 'neutral';
      return last.users > prev.users * 1.05 ? 'good' : 'bad';
    }
    case 'people': {
      if (team.length < 2) return 'bad';
      const mood = team.reduce((sum, e) => sum + e.motivation, 0) / team.length;
      return mood >= 70 ? 'good' : mood < 50 ? 'bad' : 'neutral';
    }
    case 'peace':
      return s.rush ? 'bad' : 'good';
  }
}

/** Шанс, что звезда согласится, доля. */
export function headhuntChance(s: GameState, star: StarDef, offer: HeadhuntOfferDef, content: GameContent): number {
  const h = content.config.headhunt;
  const fit = starFit(s, star, offer, content);
  const byFit = fit === 'good' ? h.fitGood : fit === 'bad' ? -h.fitBad : 0;
  const byReputation = ((s.reputation - 50) / 100) * h.reputationWeight;
  return clamp(offer.chance + byFit + byReputation, h.chanceMin, h.chanceMax);
}

function terms(star: StarDef, offer: HeadhuntOfferDef): { salary: number; bonus: number } {
  const salary = round50(star.salaryNow * offer.salary);
  return { salary, bonus: salary * offer.bonusMonths };
}

export type HeadhuntBlock = 'locked' | 'waiting' | 'pending' | 'teamFull' | 'energy' | 'cash';

/** Почему предложение нельзя сделать прямо сейчас; null — можно. */
export function headhuntBlock(s: GameState, content: GameContent, offerId?: HeadhuntOfferId): HeadhuntBlock | null {
  const cfg = content.config;
  if (!unlocked(s, cfg)) return 'locked';
  if (headhuntOf(s).pending) return 'pending';
  const star = starNow(s, cfg);
  if (!star) return 'waiting';
  if (teamOf(s, content).employees.length >= officeOf(s, cfg).seats) return 'teamFull';
  if (energyOf(s) < cfg.headhunt.energyCost) return 'energy';
  const offer = cfg.headhunt.offers.find((o) => o.id === offerId);
  if (offer && s.cash < terms(star, offer).bonus) return 'cash';
  return null;
}

/** Делает предложение: силы уходят сразу, ответ придёт через несколько дней. Возвращает null, если нельзя. */
export function makeOffer(s: GameState, content: GameContent, offerId: HeadhuntOfferId): GameState | null {
  const cfg = content.config;
  const offer = cfg.headhunt.offers.find((o) => o.id === offerId);
  const star = starNow(s, cfg);
  if (!offer || !star || headhuntBlock(s, content, offerId) !== null) return null;
  return {
    ...s,
    energy: Math.max(0, energyOf(s) - cfg.headhunt.energyCost),
    headhunt: {
      ...headhuntOf(s),
      window: windowOf(s, cfg),
      // Шанс фиксируется в день предложения: игрок видел именно его.
      pending: { star, offer: offer.id, ...terms(star, offer), chance: headhuntChance(s, star, offer, content), resolveDay: s.day + cfg.headhunt.answerDays },
    },
  };
}

/** Шаг дня: ответ звезды и, если чужая компания обиделась, её ответный удар. Меняет черновик состояния. */
export function stepHeadhunt(s: GameState, content: GameContent): void {
  const st = s.headhunt;
  if (!st) return;
  const cfg = content.config;
  const h = cfg.headhunt;
  let next: HeadhuntState = st;

  const p = st.pending;
  // Ответ приходит к утру назначенного дня: шаг считает день, который сейчас заканчивается.
  if (p && s.day >= p.resolveDay - 1) {
    const answer = nextFloat(st.rng);
    const anger = nextFloat(answer.next);
    const team = teamOf(s, content);
    // Если за дни ожидания место заняли, звезде некуда сесть — переход срывается.
    const joined = answer.value < p.chance && team.employees.length < officeOf(s, cfg).seats;
    const retaliation = anger.value < (joined ? h.retaliationOnJoin : h.retaliationOnDecline);
    if (joined) {
      const offer = h.offers.find((o) => o.id === p.offer);
      s.team = addStar(
        team,
        p.star,
        { salary: p.salary, salaryAsk: round50(p.star.salaryNow * h.fairSalary), aura: h.aura, jealousy: offer?.jealousy ?? 0, jealousBelow: h.jealousBelow },
        s.day,
        cfg.team,
      );
      s.cash = Math.round((s.cash - p.bonus) * 100) / 100;
    }
    next = {
      ...st,
      rng: anger.next,
      pending: null,
      last: { day: s.day, outcome: joined ? 'joined' : 'declined', nameSeed: p.star.nameSeed, role: p.star.role, retaliation },
      joined: st.joined + (joined ? 1 : 0),
      ...(retaliation ? { raid: true } : {}),
    };
    const tone: NewsItem['tone'] = joined ? 'good' : 'bad';
    s.news = [...(s.news ?? []), { day: s.day, kind: 'headhunt' as const, id: joined ? 'joined' : 'declined', tone, value: p.star.nameSeed }].slice(-40);
  }

  // Ответный удар приходит обычным событием «зовут в другую компанию» — про самого сильного из ваших.
  if (next.raid && s.pendingEvent === null && s.status === 'running') {
    const def = content.events.find((e) => e.id === h.retaliationEvent);
    const person = def ? eventSubject({ pick: 'highestSkill', minDaysHired: h.retaliationMinDaysHired }, s) : null;
    if (def && person) {
      s.pendingEvent = def.id;
      s.pendingSubject = person.id;
      s.lastEventDay = s.day;
      s.eventLog = [...s.eventLog, { day: s.day, eventId: def.id, choiceId: null, chanceResults: [], subjectNameSeed: person.nameSeed }];
    }
    const { raid: _raid, ...rest } = next;
    // Прийти не за кем — удара не будет, и в сводке его не показываем.
    next = person || !rest.last ? rest : { ...rest, last: { ...rest.last, retaliation: false } };
  }

  if (next !== st) s.headhunt = next;
}

export interface HeadhuntOfferView {
  id: HeadhuntOfferId;
  /** Зарплата в месяц и разовая выплата при переходе */
  salary: number;
  bonus: number;
  /** Шанс согласия, в процентах */
  chancePct: number;
  fit: StarFit;
  /** Скольким коллегам станет обидно и на сколько упадёт их мотивация */
  jealousCount: number;
  jealousy: number;
  /** Довольна ли звезда такой зарплатой: меньше справедливой — мотивация будет падать */
  underpaid: boolean;
  /** На сколько дней хватит денег с такой зарплатой; null — хватает */
  cashDays: number | null;
  risky: boolean;
  blocked: HeadhuntBlock | null;
}

export interface HeadhuntView {
  /** Сильные люди уже замечают компанию */
  unlocked: boolean;
  minRevenue30: number;
  blocked: HeadhuntBlock | null;
  star: (StarDef & { daysLeft: number; auraPct: number; offers: HeadhuntOfferView[] }) | null;
  /** Предложение сделано, ждём ответа */
  pending: { nameSeed: number; role: EmployeeRole; companySeed: number; offer: HeadhuntOfferId; salary: number; bonus: number; chancePct: number; daysLeft: number } | null;
  last: HeadhuntState['last'];
  /** Через сколько дней появится следующая звезда; null — она уже здесь или охота закрыта */
  nextInDays: number | null;
  energyCost: number;
  /** Шанс ответного удара, в процентах: после перехода и после отказа */
  retaliationPct: { joined: number; declined: number };
  /** Звёзды в команде и на сколько они ускоряют коллег, в процентах */
  stars: number;
  auraPct: Record<EmployeeRole, number>;
  auraCapPct: number;
  joined: number;
}

/** Всё, что экрану нужно знать об охоте за звёздами. Состояние не меняет. */
export function headhuntView(s: GameState, content: GameContent): HeadhuntView {
  const cfg = content.config;
  const h = cfg.headhunt;
  const st = headhuntOf(s);
  const team = teamOf(s, content);
  const star = starNow(s, cfg);
  const open = unlocked(s, cfg);
  const dayInWindow = s.day % h.periodDays;
  const pct = (x: number) => Math.round(x * 100);

  const offers: HeadhuntOfferView[] = star
    ? h.offers.map((offer) => {
        const t = terms(star, offer);
        const cashDays = cashDaysAfterHire(s, t.salary, content);
        return {
          id: offer.id,
          ...t,
          chancePct: pct(headhuntChance(s, star, offer, content)),
          fit: starFit(s, star, offer, content),
          jealousCount: offer.jealousy > 0 ? team.employees.filter((e) => e.role === star.role && e.salary < t.salary * h.jealousBelow).length : 0,
          jealousy: offer.jealousy,
          underpaid: offer.salary < h.fairSalary,
          cashDays,
          risky: cashDays !== null && cashDays < RISKY_HIRE_DAYS,
          blocked: headhuntBlock(s, content, offer.id),
        };
      })
    : [];

  return {
    unlocked: open,
    minRevenue30: h.minRevenue30,
    blocked: headhuntBlock(s, content),
    star: star ? { ...star, daysLeft: h.visibleDays - dayInWindow, auraPct: pct(h.aura), offers } : null,
    pending: st.pending
      ? {
          nameSeed: st.pending.star.nameSeed,
          role: st.pending.star.role,
          companySeed: st.pending.star.companySeed,
          offer: st.pending.offer,
          salary: st.pending.salary,
          bonus: st.pending.bonus,
          chancePct: pct(st.pending.chance),
          daysLeft: Math.max(0, st.pending.resolveDay - s.day),
        }
      : null,
    last: st.last,
    nextInDays: open && !star && !st.pending ? h.periodDays - dayInWindow : null,
    energyCost: h.energyCost,
    retaliationPct: { joined: pct(h.retaliationOnJoin), declined: pct(h.retaliationOnDecline) },
    stars: team.employees.filter((e) => e.star).length,
    auraPct: { developer: pct(starAura(team, 'developer', cfg.team)), marketer: pct(starAura(team, 'marketer', cfg.team)) },
    auraCapPct: pct(cfg.team.starAuraCap),
    joined: st.joined,
  };
}
