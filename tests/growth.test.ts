// Рост компании: офисы, инвестиции за долю, ускоренный темп.
import { describe, expect, it } from 'vitest';
import { applyCommand, bankruptcyCause, officeView, teamOf, teamView, tick, type Employee, type GameContent, type GameState } from '../src/core';
import { content } from '../src/content';
import ru from '../src/content/ru/ui.json';
import { deepFreeze, launchedGame, newGame, run } from './helpers';

const cfg = content.config;
const quiet: GameContent = { ...content, events: [], milestones: [] };
const worker = (id: number): Employee => ({ id, role: 'developer', skill: 1, trait: 'calm', salaryAsk: 1000, salary: 1000, nameSeed: id, hiredDay: 0, motivation: 70 });
const withTeam = (s: GameState, n: number): GameState => ({ ...s, team: { ...teamOf(s, content), employees: Array.from({ length: n }, (_, i) => worker(900 + i)) } });

describe('офисы', () => {
  it('партия начинается в комнате основателя на три места, без аренды', () => {
    const v = officeView(newGame(), cfg);
    expect(v.current).toMatchObject({ id: 'home', seats: 3, rentPerMonth: 0 });
    expect(v.next!.id).toBe('coworking');
    expect(tick(newGame(), quiet).lastDay.rentCost).toBe(0);
  });

  it('каждый следующий офис больше и дороже, у каждого есть название', () => {
    const names = ru.office.tiers as Record<string, string>;
    for (let i = 1; i < cfg.offices.length; i++) {
      expect(cfg.offices[i]!.seats).toBeGreaterThan(cfg.offices[i - 1]!.seats);
      expect(cfg.offices[i]!.moveCost).toBeGreaterThan(cfg.offices[i - 1]!.moveCost);
      expect(cfg.offices[i]!.rentPerMonth).toBeGreaterThan(cfg.offices[i - 1]!.rentPerMonth);
    }
    for (const o of cfg.offices) expect(names[o.id]?.length ?? 0, o.id).toBeGreaterThan(3);
    expect(cfg.offices.at(-1)!.seats).toBeGreaterThanOrEqual(50);
  });

  it('переезд стоит денег сразу, даёт места и добавляет аренду', () => {
    const s = { ...newGame(), cash: 10_000 };
    const moved = run(s, { type: 'moveOffice' });
    expect(moved.office).toBe('coworking');
    expect(moved.cash).toBe(10_000 - 2000);
    expect(teamView(moved, content).maxSize).toBe(6);
    expect(moved.news?.at(-1)).toMatchObject({ kind: 'office', id: 'coworking' });
    const day = tick(moved, quiet).lastDay;
    expect(day.rentCost).toBeCloseTo(600 / 30, 6);
    expect(day.expenses).toBeCloseTo(tick(s, quiet).lastDay.expenses + 600 / 30, 6);
  });

  it('без денег переехать нельзя; из самого большого офиса ехать некуда', () => {
    expect(applyCommand({ ...newGame(), cash: 500 }, { type: 'moveOffice' }, content)).toEqual({ ok: false, error: 'notEnoughCash' });
    const top = { ...newGame(), cash: 1e9, office: cfg.offices.at(-1)!.id };
    expect(applyCommand(top, { type: 'moveOffice' }, content)).toEqual({ ok: false, error: 'noBiggerOffice' });
    expect(officeView(top, cfg).next).toBeNull();
  });

  it('в комнате основателя четвёртого не нанять, в коворкинге — можно', () => {
    const full = withTeam({ ...newGame(), cash: 1e6 }, 3);
    const candidate = teamView(full, content).candidates[0]!.id;
    expect(applyCommand(full, { type: 'hire', candidateId: candidate }, content)).toEqual({ ok: false, error: 'teamFull' });
    const moved = run(full, { type: 'moveOffice' });
    expect(teamView(moved, content).canHire).toBe(true);
    expect(teamOf(run(moved, { type: 'hire', candidateId: candidate }), content).employees).toHaveLength(4);
  });

  it('в большом офисе кандидатов приходит больше', () => {
    let s: GameState = { ...newGame(), cash: 1e9, office: 'smallOffice' };
    for (let i = 0; i < cfg.team.candidatesEveryDays; i++) s = tick(s, quiet);
    expect(teamView(s, content).candidates).toHaveLength(cfg.team.candidatesShown + 2);
  });

  it('старое сохранение без офиса — это комната основателя', () => {
    const old = { ...launchedGame() };
    delete old.office;
    expect(officeView(old, cfg).current.id).toBe('home');
    expect(tick(old, quiet).lastDay.rentCost).toBe(0);
  });

  it('аренда не по карману называется причиной банкротства', () => {
    const s = tick({ ...launchedGame(), office: 'office', cash: 100 }, quiet);
    expect(bankruptcyCause(s)).toBe('rent');
    expect((ru.end.cause as Record<string, string>).rent!.length).toBeGreaterThan(40);
  });

  it('команда переезда не меняет исходное состояние', () => {
    run(deepFreeze({ ...newGame(), cash: 10_000 }), { type: 'moveOffice' });
  });
});

describe('инвестиции', () => {
  const offer = (id: string, s: GameState = launchedGame()): GameState => ({ ...s, pendingEvent: id, eventLog: [...s.eventLog, { day: s.day, eventId: id, choiceId: null, chanceResults: [] }] });

  it('деньги приходят сразу, доля основателя уменьшается, в ленте появляется запись', () => {
    const before = offer('angelOffer');
    const after = run(before, { type: 'chooseEvent', choiceId: 'takeMoney' });
    expect(after.cash).toBe(before.cash + 25_000);
    expect(after.founderShare).toBeCloseTo(0.92, 6);
    expect(after.news?.at(-1)).toMatchObject({ kind: 'invest', value: 25_000 });
  });

  it('доли раундов перемножаются, а не вычитаются', () => {
    let s = run(offer('angelOffer'), { type: 'chooseEvent', choiceId: 'takeMoney' });
    s = run(offer('seedRound', s), { type: 'chooseEvent', choiceId: 'takeMoney' });
    expect(s.founderShare).toBeCloseTo(0.92 * 0.85, 4);
    expect(s.cash).toBeGreaterThan(170_000);
  });

  it('отказ оставляет долю целой', () => {
    const after = run(offer('seedRound'), { type: 'chooseEvent', choiceId: 'decline' });
    expect(after.founderShare ?? 1).toBe(1);
  });

  it('каждый раунд бывает один раз, и следующий крупнее предыдущего', () => {
    const rounds = ['angelOffer', 'seedRound', 'seriesA'].map((id) => content.events.find((e) => e.id === id)!);
    const amounts = rounds.map((r) => {
      const e = r.choices[0]!.effects[0]!;
      return e.type === 'invest' ? e.amount : 0;
    });
    for (const r of rounds) {
      expect(r.once, r.id).toBe(true);
      expect(r.mood, r.id).toBe('good');
    }
    expect(amounts[1]!).toBeGreaterThan(amounts[0]! * 3);
    expect(amounts[2]!).toBeGreaterThan(amounts[1]! * 3);
  });
});

describe('темп партии', () => {
  it('ускорение роста и дохода задано одной настройкой и действует на расчёт', () => {
    const base = { ...launchedGame(), users: 1000, paying: 100, capacity: 10_000, reputation: 50 };
    const slow: GameContent = { ...quiet, config: { ...cfg, pace: { ...cfg.pace, acquisition: 1, revenue: 1 } } };
    const fast: GameContent = { ...quiet, config: { ...cfg, pace: { ...cfg.pace, acquisition: 2, revenue: 3 } } };
    const a = tick(base, slow).lastDay;
    const b = tick(base, fast).lastDay;
    expect(b.newUsers).toBeCloseTo(a.newUsers * 2, 4);
    expect(b.revenue).toBeCloseTo(a.revenue * 3, 4);
  });

  it('первые недели после запуска людей приходит втрое больше, потом всплеск проходит', () => {
    let s = run(newGame(), { type: 'queueFeature', featureId: 'core' });
    s = { ...s, doneFeatures: ['core'], tasks: [], cash: 1e6 };
    const launched = run(s, { type: 'launch' });
    expect(launched.modifiers).toContainEqual({ target: 'acquisition', factor: cfg.pace.launchBoost, untilDay: launched.day + cfg.pace.launchDays });
    const hyped = tick(launched, quiet).lastDay.organic;
    const calm = tick({ ...launched, modifiers: [] }, quiet).lastDay.organic;
    expect(hyped).toBeCloseTo(calm * cfg.pace.launchBoost, 4);
    let later = launched;
    for (let i = 0; i < cfg.pace.launchDays + 1; i++) later = tick(later, quiet);
    expect(later.modifiers).toEqual([]);
  });

  it('цель «прибыль» требует настоящей компании, а не первых денег', () => {
    expect(cfg.goalProfitPerMonth).toBeGreaterThanOrEqual(20_000);
  });
});
