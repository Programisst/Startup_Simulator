// Город, где основана компания. Настоящие цифры города — сколько там программистов, какие зарплаты,
// сколько стоит жизнь и офис, сколько денег вкладывают инвесторы — решают, что в нём возможно:
// кого можно нанять и за сколько, во что обходится каждый месяц, как охотно слушают инвесторы.
// Данные — src/content/cities.ts; описание и источники — docs/02-economy.md, раздел 36.

import { clamp } from './formulas';
import type { CityDef, CityState, EmployeeRole, GameContent, GameState } from './types';

/** Партия без города (старые сохранения, прогоны баланса): всё как в среднем по стране. */
const NOWHERE: CityState = { id: '', living: 1, rent: 1, salary: { developer: 1, marketer: 1 }, talent: 0, skill: 0, investors: 1 };

const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Как город меняет игру: всё считается из настоящих цифр города относительно страны. */
export function cityFactors(def: CityDef, content: GameContent): CityState {
  const base = content.country;
  const cfg = content.config.cities;
  // Каждое удвоение числа программистов против «обычного города» — ещё один кандидат в списке и чуть сильнее лучшие из них.
  const talent = clamp(Math.round(Math.log2(def.devJobs / cfg.referenceDevJobs)), cfg.talentMin, cfg.talentMax);
  return {
    id: def.id,
    living: round2(def.priceLevel / 100),
    rent: round2(def.officeRent / base.officeRent),
    salary: { developer: round2(def.devWage / base.devWage), marketer: round2(def.marketerWage / base.marketerWage) },
    talent,
    skill: round2(Math.max(0, talent) * cfg.skillPerTalent),
    // Денег инвесторов в столицах в десятки раз больше, но шанс получить их растёт куда медленнее.
    investors: round2(clamp(Math.pow(def.venture / cfg.referenceVenture, cfg.investorPower), cfg.investorMin, cfg.investorMax)),
  };
}

/** Город партии; если его нет — «нигде»: все множители равны единице. */
export function cityOf(s: Pick<GameState, 'city'>): CityState {
  return s.city ?? NOWHERE;
}

/** Город по id для новой партии; неизвестный id — партия без города. */
export function cityFor(cityId: string | undefined, content: GameContent): CityState | null {
  const def = content.cities.find((c) => c.id === cityId);
  return def ? cityFactors(def, content) : null;
}

export interface CityView {
  id: string;
  /** Настоящие цифры */
  devJobs: number;
  devWage: number;
  priceLevel: number;
  officeRent: number;
  venture: number;
  /** Что они значат в игре, в процентах к среднему по стране (−8 = на 8% дешевле) */
  livingPct: number;
  rentPct: number;
  salaryPct: Record<EmployeeRole, number>;
  investorsPct: number;
  /** На сколько больше (или меньше) кандидатов в списке и на сколько сильнее лучшие из них */
  extraCandidates: number;
  skillBonus: number;
}

const pct = (factor: number): number => Math.round((factor - 1) * 100);

/** Все города для экрана выбора. */
export function citiesView(content: GameContent): CityView[] {
  return content.cities.map((def) => {
    const f = cityFactors(def, content);
    return {
      id: def.id,
      devJobs: def.devJobs,
      devWage: def.devWage,
      priceLevel: def.priceLevel,
      officeRent: def.officeRent,
      venture: def.venture,
      livingPct: pct(f.living),
      rentPct: pct(f.rent),
      salaryPct: { developer: pct(f.salary.developer), marketer: pct(f.salary.marketer) },
      investorsPct: pct(f.investors),
      extraCandidates: f.talent,
      skillBonus: f.skill,
    };
  });
}
