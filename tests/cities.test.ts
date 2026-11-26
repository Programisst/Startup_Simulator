// Города: настоящие цифры города решают, кого можно нанять и за сколько, во что обходится месяц и как слушают инвесторы.
import { describe, expect, it, vi } from 'vitest';
import { content } from '../src/content';
import ru from '../src/content/ru/ui.json';
import { citiesView, cityFactors, cityFor, cityOf, createGame, fundingView, officeView, teamOf, tick, type CityDef, type GameState } from '../src/core';
import { runAll, summarize } from '../tools/balance/simulate';
import { carefulHirer } from '../tools/balance/strategies';
import { baseSetup, newGame } from './helpers';

const cfg = content.config.cities;
const quiet = { ...content, events: [], milestones: [] };
const by = (pick: (c: CityDef) => number, dir: 1 | -1) => [...content.cities].sort((a, b) => dir * (pick(b) - pick(a)))[0]!;
const priciest = by((c) => c.priceLevel, 1);
const cheapest = by((c) => c.priceLevel, -1);
const biggest = by((c) => c.devJobs, 1);
const smallest = by((c) => c.devJobs, -1);
const richest = by((c) => c.venture, 1);
const game = (cityId?: string, seed = 42): GameState => createGame({ ...baseSetup, seed, ...(cityId ? { cityId } : {}) }, content);

describe('данные о городах', () => {
  it('городов около дюжины, цифры в правдоподобных пределах и у каждого есть название и описание', () => {
    expect(content.cities.length).toBeGreaterThanOrEqual(10);
    expect(content.cities.length).toBeLessThanOrEqual(14);
    expect(new Set(content.cities.map((c) => c.id)).size).toBe(content.cities.length);
    const texts = (ru as unknown as { cities: Record<string, { name: string; note: string }> }).cities;
    expect(Object.keys(texts).sort()).toEqual(content.cities.map((c) => c.id).sort());
    for (const c of content.cities) {
      expect(c.devJobs, c.id).toBeGreaterThan(5_000);
      expect(c.devJobs, c.id).toBeLessThan(400_000);
      expect(c.devWage, c.id).toBeGreaterThan(90_000);
      expect(c.devWage, c.id).toBeLessThan(260_000);
      expect(c.marketerWage, c.id).toBeGreaterThan(55_000);
      expect(c.marketerWage, c.id).toBeLessThan(170_000);
      expect(c.priceLevel, c.id).toBeGreaterThan(85);
      expect(c.priceLevel, c.id).toBeLessThan(130);
      expect(c.officeRent, c.id).toBeGreaterThan(15);
      expect(c.officeRent, c.id).toBeLessThan(120);
      expect(c.venture, c.id).toBeGreaterThan(0.1);
      expect(texts[c.id]!.name.length, c.id).toBeGreaterThan(2);
      expect(texts[c.id]!.note.length, c.id).toBeGreaterThan(15);
    }
    expect(content.country.devWage).toBeGreaterThan(100_000);
    expect(content.country.officeRent).toBeGreaterThan(20);
  });

  it('множители считаются из цифр города относительно страны', () => {
    for (const c of content.cities) {
      const f = cityFactors(c, content);
      expect(f.living, c.id).toBeCloseTo(c.priceLevel / 100, 2);
      expect(f.rent, c.id).toBeCloseTo(c.officeRent / content.country.officeRent, 2);
      expect(f.salary.developer, c.id).toBeCloseTo(c.devWage / content.country.devWage, 2);
      expect(f.salary.marketer, c.id).toBeCloseTo(c.marketerWage / content.country.marketerWage, 2);
      expect(f.talent, c.id).toBeGreaterThanOrEqual(cfg.talentMin);
      expect(f.talent, c.id).toBeLessThanOrEqual(cfg.talentMax);
      expect(f.investors, c.id).toBeGreaterThanOrEqual(cfg.investorMin);
      expect(f.investors, c.id).toBeLessThanOrEqual(cfg.investorMax);
    }
  });

  it('города действительно разные: где больше программистов и денег — там дороже', () => {
    const f = (c: CityDef) => cityFactors(c, content);
    expect(f(priciest).living).toBeGreaterThan(f(cheapest).living + 0.1);
    expect(f(biggest).talent).toBeGreaterThan(f(smallest).talent);
    expect(f(richest).investors).toBe(Math.max(...content.cities.map((c) => f(c).investors)));
    // Столица венчурных денег — не самый дешёвый город.
    expect(f(richest).living).toBeGreaterThan(1);
    expect(f(richest).salary.developer).toBeGreaterThan(1.1);
  });
});

describe('партия без города', () => {
  it('идёт как раньше: всё как в среднем по стране, в сохранении о городе ничего нет', () => {
    const s = newGame();
    expect(s.city).toBeUndefined();
    expect(cityOf(s)).toMatchObject({ living: 1, rent: 1, talent: 0, skill: 0, investors: 1, salary: { developer: 1, marketer: 1 } });
    expect(s.livingCostPerMonth).toBe(content.difficulties.normal.livingCostPerMonth);
    expect(s.sideJobIncomePerMonth).toBe(content.difficulties.normal.sideJobIncomePerMonth);
    expect(s.team!.candidates).toHaveLength(content.config.team.candidatesShown);
    expect(officeView({ ...s, office: 'coworking' }, content.config).current.rentPerMonth).toBe(content.config.offices[1]!.rentPerMonth);
    // Неизвестный город — тоже «без города».
    expect(game('atlantis').city).toBeUndefined();
    expect(cityFor('atlantis', content)).toBeNull();
  });
});

describe('что город меняет в партии', () => {
  it('жизнь стоит по ценам города, и подработка оплачивается по ним же', () => {
    const base = content.difficulties.normal;
    for (const c of [priciest, cheapest]) {
      const s = game(c.id);
      const f = cityFactors(c, content);
      expect(s.city).toEqual(f);
      expect(s.livingCostPerMonth).toBe(Math.round(base.livingCostPerMonth * f.living));
      expect(s.sideJobIncomePerMonth).toBe(Math.round(base.sideJobIncomePerMonth * f.living));
    }
    expect(game(priciest.id).livingCostPerMonth).toBeGreaterThan(game(cheapest.id).livingCostPerMonth);
    // Расход на жизнь попадает в день.
    expect(tick(game(priciest.id), quiet).lastDay.livingCost * 30).toBeCloseTo(game(priciest.id).livingCostPerMonth, 6);
  });

  it('кандидаты просят зарплату по меркам города', () => {
    const plain = game(undefined).team!.candidates;
    for (const c of content.cities) {
      const f = cityFactors(c, content);
      // При том же начальном числе первые кандидаты — те же люди, если потолок навыка не сдвинут.
      if (f.skill !== 0) continue;
      const here = game(c.id).team!.candidates;
      for (let i = 0; i < Math.min(plain.length, here.length); i++) {
        expect(here[i]!.role).toBe(plain[i]!.role);
        expect(here[i]!.skill).toBe(plain[i]!.skill);
        // Зарплата округляется до $50.
        expect(Math.abs(here[i]!.salaryAsk - plain[i]!.salaryAsk * f.salary[here[i]!.role]), c.id).toBeLessThanOrEqual(26 + 25 * f.salary[here[i]!.role]);
      }
    }
  });

  it('в городе, где много программистов, кандидатов больше и лучшие из них сильнее; в маленьком — меньше', () => {
    const shown = content.config.team.candidatesShown;
    const hub = cityFactors(biggest, content);
    const small = cityFactors(smallest, content);
    expect(game(biggest.id).team!.candidates).toHaveLength(shown + hub.talent);
    expect(game(smallest.id).team!.candidates).toHaveLength(Math.max(1, shown + small.talent));
    expect(hub.talent).toBeGreaterThan(0);
    expect(hub.skill).toBeCloseTo(hub.talent * cfg.skillPerTalent, 6);
    // Лучший кандидат за много партий в столице сильнее, чем где-либо без города.
    const best = (cityId?: string) => Math.max(...Array.from({ length: 300 }, (_, seed) => Math.max(...game(cityId, seed + 1).team!.candidates.map((x) => x.skill))));
    expect(best(biggest.id)).toBeGreaterThan(content.config.team.skillMax);
    expect(best(undefined)).toBeLessThanOrEqual(content.config.team.skillMax);
    // Список обновляется раз в месяц — и снова по меркам города.
    let s = game(biggest.id);
    for (let i = 0; i < content.config.team.candidatesEveryDays + 1; i++) s = tick(s, quiet);
    expect(teamOf(s, content).candidates).toHaveLength(shown + hub.talent);
  });

  it('аренда и переезд стоят по ценам города', () => {
    const offices = content.config.offices;
    for (const c of [priciest, cheapest, richest]) {
      const f = cityFactors(c, content);
      const view = officeView({ ...game(c.id), office: 'coworking' }, content.config);
      expect(view.current.rentPerMonth).toBe(Math.round((offices[1]!.rentPerMonth * f.rent) / 50) * 50);
      expect(view.next!.moveCost).toBe(Math.round((offices[2]!.moveCost * f.rent) / 50) * 50);
      expect(view.current.seats).toBe(offices[1]!.seats);
      const s = tick({ ...game(c.id), office: 'coworking' }, quiet);
      expect(s.lastDay.rentCost! * 30).toBeCloseTo(view.current.rentPerMonth, 6);
    }
  });

  it('там, где много венчурных денег, с основателем говорят раньше и за ту же долю дают больше', () => {
    const poorest = by((c) => c.venture, -1);
    const view = (cityId?: string) => fundingView({ ...game(cityId), launched: true }, content);
    const base = content.config.funding.minValuation;
    expect(view(undefined).minValuation).toBe(base);
    expect(view(richest.id).minValuation).toBe(Math.round(base / cityFactors(richest, content).investors / 100) * 100);
    expect(view(richest.id).minValuation).toBeLessThan(base);
    expect(view(poorest.id).minValuation).toBeGreaterThan(base);
  });

  it('там, где много венчурных денег, инвестора заинтересовать легче', () => {
    const interest = (cityId?: string) => fundingView({ ...game(cityId), launched: true }, content).investors.map((i) => i.interestPct);
    const plain = interest(undefined);
    const hub = interest(richest.id);
    const poor = interest(by((c) => c.venture, -1).id);
    for (let i = 0; i < plain.length; i++) {
      expect(hub[i]!).toBeGreaterThan(plain[i]!);
      expect(poor[i]!).toBeLessThanOrEqual(plain[i]!);
    }
  });
});

describe('экран выбора', () => {
  it('у каждого города настоящие цифры и то, что они значат в игре', () => {
    const view = citiesView(content);
    expect(view.map((c) => c.id)).toEqual(content.cities.map((c) => c.id));
    const top = view.find((c) => c.id === priciest.id)!;
    expect(top.devJobs).toBe(priciest.devJobs);
    expect(top.devWage).toBe(priciest.devWage);
    expect(top.livingPct).toBe(Math.round(priciest.priceLevel - 100));
    expect(top.livingPct).toBeGreaterThan(0);
    expect(view.find((c) => c.id === cheapest.id)!.livingPct).toBeLessThanOrEqual(0);
    expect(view.find((c) => c.id === biggest.id)!.extraCandidates).toBe(cityFactors(biggest, content).talent);
  });
});

describe('совместимость', () => {
  it('старое сохранение без города открывается и идёт как раньше', () => {
    const old = newGame();
    delete (old as { city?: unknown }).city;
    const next = tick(old, quiet);
    expect(next.city).toBeUndefined();
    expect(next.lastDay.livingCost * 30).toBeCloseTo(content.difficulties.normal.livingCostPerMonth, 6);
  });

  it('одна и та же партия в одном и том же городе начинается одинаково', () => {
    expect(game(richest.id, 7)).toEqual(game(richest.id, 7));
  });
});

describe('города в партиях автоматических игроков', () => {
  vi.setConfig({ testTimeout: 240_000 });

  it('обычная сложность: грамотный игрок выживает и в самом дорогом городе, и в самом дешёвом', () => {
    for (const c of [priciest, cheapest]) expect(summarize(runAll(carefulHirer, 'normal', 1, c.id)).bankrupt, c.id).toBe(0);
  });

  it('сложная: в дорогом городе начинать труднее, чем в дешёвом', () => {
    const hard = (cityId: string) => summarize(runAll(carefulHirer, 'hard', 3, cityId)).bankrupt;
    expect(hard(priciest.id)).toBeGreaterThan(hard(cheapest.id));
  });
});
