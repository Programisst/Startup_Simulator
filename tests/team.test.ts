import { describe, expect, it } from 'vitest';
import { roomView, teamOf, teamView, tick, type Employee, type GameState, type TraitId } from '../src/core';
import { content } from '../src/content';
import { advance, deepFreeze, launchedGame, newGame, run } from './helpers';

const cfg = content.config.team;
const coreFeature = content.features.saas.find((f) => f.core)!;

function employee(over: Partial<Employee> = {}): Employee {
  return { id: 900, role: 'developer', skill: 1, trait: 'calm', salaryAsk: 3000, salary: 3000, nameSeed: 1, hiredDay: 0, motivation: cfg.startMotivation, ...over };
}

/** Партия с заданной командой. */
function withTeam(s: GameState, employees: Employee[]): GameState {
  return { ...s, team: { ...teamOf(s, content), employees } };
}

const rich = (s: GameState): GameState => ({ ...s, cash: 1_000_000 });

describe('кандидаты', () => {
  it('в начале партии есть список кандидатов, команда пуста', () => {
    const v = teamView(newGame(), content);
    expect(v.candidates).toHaveLength(cfg.candidatesShown);
    expect(v.members).toHaveLength(0);
    expect(v.payrollPerMonth).toBe(0);
    expect(v.canHire).toBe(true);
  });

  it('одинаковый seed даёт одинаковых кандидатов, разный — разных', () => {
    expect(teamView(newGame({ seed: 7 }), content).candidates).toEqual(teamView(newGame({ seed: 7 }), content).candidates);
    expect(teamView(newGame({ seed: 7 }), content).candidates).not.toEqual(teamView(newGame({ seed: 8 }), content).candidates);
  });

  it('навык и зарплата в разумных пределах, сильные стоят непропорционально дорого', () => {
    const all = Array.from({ length: 60 }, (_, seed) => teamView(newGame({ seed }), content).candidates).flat();
    for (const c of all) {
      expect(c.skill).toBeGreaterThanOrEqual(cfg.skillMin);
      expect(c.skill).toBeLessThanOrEqual(cfg.skillMax);
      expect(c.salaryAsk % 50).toBe(0);
      expect(c.salaryAsk).toBeGreaterThan(0);
    }
    expect(new Set(all.map((c) => c.role))).toEqual(new Set(['developer', 'marketer']));
    expect(new Set(all.map((c) => c.trait)).size).toBe(4);
    const devs = all.filter((c) => c.role === 'developer');
    const perSkill = (list: typeof devs) => list.reduce((sum, c) => sum + c.salaryAsk / c.skill, 0) / list.length;
    expect(perSkill(devs.filter((c) => c.skill > 1.2))).toBeGreaterThan(perSkill(devs.filter((c) => c.skill < 0.8)) * 1.2);
  });

  it('список обновляется раз в месяц, номера кандидатов не повторяются', () => {
    const s = newGame();
    const before = teamView(s, content);
    expect(before.daysToNewCandidates).toBe(cfg.candidatesEveryDays);
    const almost = advance(s, cfg.candidatesEveryDays - 1);
    expect(teamView(almost, content).candidates.map((c) => c.id)).toEqual(before.candidates.map((c) => c.id));
    const after = teamView(advance(almost, 1), content);
    expect(after.candidates).toHaveLength(cfg.candidatesShown);
    for (const c of after.candidates) expect(before.candidates.map((b) => b.id)).not.toContain(c.id);
  });

  it('наём не сдвигает случайность рынка и событий', () => {
    const plain = advance(rich(launchedGame()), 60);
    let hiring = rich(launchedGame());
    hiring = run(hiring, { type: 'hire', candidateId: teamView(hiring, content).candidates[0]!.id });
    hiring = run(hiring, { type: 'fire', employeeId: teamView(hiring, content).members[0]!.id });
    expect(advance(hiring, 60).rng).toBe(plain.rng);
  });
});

describe('наём и увольнение', () => {
  it('нанятый переходит из кандидатов в команду на свою зарплату', () => {
    const s = newGame();
    const c = teamView(s, content).candidates[0]!;
    const after = teamView(run(s, { type: 'hire', candidateId: c.id }), content);
    expect(after.members).toHaveLength(1);
    expect(after.members[0]).toMatchObject({ id: c.id, role: c.role, skill: c.skill, salary: c.salaryAsk, motivation: cfg.startMotivation });
    expect(after.candidates.map((x) => x.id)).not.toContain(c.id);
    expect(after.payrollPerMonth).toBe(c.salaryAsk);
    expect(after.log.at(-1)).toMatchObject({ kind: 'hired', employeeId: c.id });
  });

  it('зарплата списывается каждый день и попадает в расходы', () => {
    let s = newGame();
    const before = tick(s, content).lastDay.expenses;
    const c = teamView(s, content).candidates[0]!;
    s = tick(run(s, { type: 'hire', candidateId: c.id }), content);
    expect(s.lastDay.salaryCost).toBeCloseTo(c.salaryAsk / 30, 6);
    expect(s.lastDay.expenses).toBeCloseTo(before + c.salaryAsk / 30, 6);
  });

  it('нельзя нанять несуществующего и нельзя превысить размер команды', () => {
    const s = withTeam(newGame(), Array.from({ length: cfg.maxSize }, (_, i) => employee({ id: 900 + i })));
    const id = teamView(s, content).candidates[0]!.id;
    expect(teamView(s, content).canHire).toBe(false);
    expect(() => run(s, { type: 'hire', candidateId: id })).toThrow('teamFull');
    expect(() => run(newGame(), { type: 'hire', candidateId: 123456 })).toThrow('noSuchCandidate');
  });

  it('увольнение стоит выходного пособия и убирает зарплату', () => {
    const s = withTeam(newGame(), [employee({ salary: 3000 })]);
    const after = run(s, { type: 'fire', employeeId: 900 });
    expect(after.cash).toBe(s.cash - 3000 * cfg.severanceMonths);
    expect(teamView(after, content).members).toHaveLength(0);
    expect(teamView(after, content).log.at(-1)).toMatchObject({ kind: 'fired', employeeId: 900 });
    expect(() => run(after, { type: 'fire', employeeId: 900 })).toThrow('noSuchEmployee');
  });

  it('зарплату можно менять, недопустимые значения отклоняются', () => {
    const s = withTeam(newGame(), [employee()]);
    expect(teamView(run(s, { type: 'setSalary', employeeId: 900, salary: 3500 }), content).payrollPerMonth).toBe(3500);
    expect(() => run(s, { type: 'setSalary', employeeId: 900, salary: -1 })).toThrow('invalidValue');
    expect(() => run(s, { type: 'setSalary', employeeId: 900, salary: Number.NaN })).toThrow('invalidValue');
    expect(() => run(s, { type: 'setSalary', employeeId: 1, salary: 100 })).toThrow('noSuchEmployee');
  });

  it('команды не меняют исходное состояние', () => {
    const s = deepFreeze(withTeam(newGame(), [employee()]));
    run(s, { type: 'hire', candidateId: teamView(s, content).candidates[0]!.id });
    run(s, { type: 'fire', employeeId: 900 });
    run(s, { type: 'setSalary', employeeId: 900, salary: 1 });
    tick(s, content);
  });
});

describe('вклад команды в работу', () => {
  const queued = () => run(rich(newGame()), { type: 'queueFeature', featureId: coreFeature.id });

  it('разработчик с навыком 1 удваивает скорость основателя', () => {
    const solo = queued();
    const pair = withTeam(queued(), [employee()]);
    expect(teamView(pair, content).workPerDay).toBeCloseTo(teamView(solo, content).workPerDay * 2, 6);
    expect(roomView(pair, content).task!.daysLeft).toBe(Math.ceil(roomView(solo, content).task!.daysLeft! / 2));
    const days = roomView(pair, content).task!.daysLeft!;
    expect(advance(pair, days - 1).doneFeatures).not.toContain(coreFeature.id);
    expect(advance(pair, days).doneFeatures).toContain(coreFeature.id);
  });

  it('маркетолог продукт не строит, а приток пользователей поднимает', () => {
    const s = withTeam(queued(), [employee({ role: 'marketer' })]);
    expect(teamView(s, content).workPerDay).toBe(teamView(queued(), content).workPerDay);
    expect(teamView(s, content).marketingBoost).toBeCloseTo(1 + cfg.marketingPerPoint, 6);
    const base = rich(launchedGame());
    const plain = advance(base, 90);
    const boosted = advance(withTeam(base, [employee({ role: 'marketer' })]), 90);
    expect(boosted.users).toBeGreaterThan(plain.users * 1.1);
  });

  it('прибавка от маркетологов ограничена потолком', () => {
    const many = withTeam(newGame(), [1, 2, 3].map((i) => employee({ id: 900 + i, role: 'marketer', skill: 1.6 })));
    expect(teamView(many, content).marketingBoost).toBeCloseTo(1 + cfg.marketingCap, 6);
  });

  it('основатель на подработке не работает, а команда — работает', () => {
    const s = run(withTeam(queued(), [employee()]), { type: 'setSideJob', share: 1 });
    expect(teamView(s, content).founderWorkPerDay).toBe(0);
    expect(teamView(s, content).workPerDay).toBeCloseTo(1, 6);
    expect(roomView(s, content).task!.daysLeft).toBe(coreFeature.cost);
  });

  it('спешка ускоряет всю команду', () => {
    const s = withTeam(queued(), [employee()]);
    const rushed = run(s, { type: 'setRush', rush: true });
    expect(teamView(rushed, content).workPerDay).toBeCloseTo(teamView(s, content).workPerDay * content.config.rushSpeed, 6);
  });

  it('черты: старательный делает больше, небрежный добавляет ошибки', () => {
    const work = (trait: TraitId) => teamView(withTeam(queued(), [employee({ trait })]), content).workPerDay;
    expect(work('diligent')).toBeCloseTo(1 + 1 + cfg.diligentBonus, 6);
    expect(work('sloppy')).toBeCloseTo(work('calm'), 6);
    const bugsAfter = (trait: TraitId) => advance(withTeam(queued(), [employee({ trait })]), coreFeature.cost).bugs;
    expect(bugsAfter('sloppy')).toBe(bugsAfter('calm') + 1);
  });
});

describe('мотивация', () => {
  // Мотивация проверяется без событий: событие о человеке само меняет её и мешает увидеть формулу.
  const quiet = { ...content, events: [] };
  const calm = (s: GameState, days: number) => {
    let x = s;
    for (let i = 0; i < days; i++) x = tick(x, quiet);
    return x;
  };
  const settle = (s: GameState, days = 200) => teamView(calm(s, days), content).members[0];

  it('при честной зарплате держится на исходном уровне', () => {
    expect(settle(withTeam(rich(newGame()), [employee()]))!.motivation).toBeCloseTo(cfg.startMotivation, 0);
  });

  it('недоплата снижает мотивацию и выработку, прибавка — повышает', () => {
    const under = settle(withTeam(rich(newGame()), [employee({ salary: 2400, trait: 'loyal' })]))!;
    const over = settle(withTeam(rich(newGame()), [employee({ salary: 3600 })]))!;
    expect(under.motivation).toBeLessThan(cfg.startMotivation - 5);
    expect(over.motivation).toBeGreaterThan(cfg.startMotivation + 10);
    expect(over.motivationFactor).toBeGreaterThan(1);
    // Прибавка к мотивации от денег ограничена: вдвое больше платить бессмысленно.
    const lavish = settle(withTeam(rich(newGame()), [employee({ salary: 9000 })]))!;
    expect(lavish.motivation).toBeCloseTo(over.motivation, 0);
  });

  it('спешка давит на всех, кроме спокойных', () => {
    const rushed = (trait: TraitId) => settle(run(withTeam(rich(newGame()), [employee({ trait })]), { type: 'setRush', rush: true }))!.motivation;
    expect(rushed('diligent')).toBeCloseTo(cfg.startMotivation - cfg.rushPenalty, 0);
    expect(rushed('calm')).toBeCloseTo(cfg.startMotivation, 0);
  });

  it('мотивация меняется постепенно, а не за день', () => {
    const s = run(withTeam(rich(newGame()), [employee({ trait: 'diligent' })]), { type: 'setRush', rush: true });
    const day1 = teamView(tick(s, content), content).members[0]!.motivation;
    expect(day1).toBeLessThan(cfg.startMotivation);
    expect(day1).toBeGreaterThan(cfg.startMotivation - 1);
  });

  it('когда платить нечем, люди уходят сами', () => {
    // Счёт в минусе и спешка: мотивация падает ниже порога, сотрудник уходит.
    let s = withTeam({ ...newGame({ goal: 'sandbox' }), cash: -1 }, [employee({ trait: 'diligent', salary: 1 })]);
    s = { ...run({ ...s, cash: 1 }, { type: 'setRush', rush: true }), cash: -1 };
    expect(teamView(s, content).members[0]!.mayQuit).toBe(true);
    let quitDay = -1;
    for (let i = 0; i < 400 && quitDay < 0; i++) {
      // Держим партию живой: нас интересует уход, а не банкротство.
      s = { ...tick({ ...s, pendingEvent: null }, content), status: 'running', negativeCashDays: 0, cash: -1 };
      if (teamOf(s, content).employees.length === 0) quitDay = i;
    }
    expect(quitDay).toBeGreaterThan(20);
    expect(teamOf(s, content).log.at(-1)).toMatchObject({ kind: 'quit', employeeId: 900 });
    expect(tick({ ...s, pendingEvent: null }, content).lastDay.salaryCost).toBe(0);
  });

  it('при нормальных условиях никто не уходит', () => {
    const s = calm(withTeam(rich(newGame()), [employee(), employee({ id: 901, trait: 'sloppy' })]), 720);
    expect(teamView(s, content).members).toHaveLength(2);
  });
});

describe('деньги и старые сохранения', () => {
  it('ранний наём без дохода приближает банкротство', () => {
    const lifetime = (s: GameState) => {
      let x = s;
      for (let i = 0; i < 3000 && x.status === 'running'; i++) x = advance(x, 1);
      return x.day;
    };
    const idle = newGame({ goal: 'profit' });
    const cheapest = [...teamView(idle, content).candidates].sort((a, b) => a.salaryAsk - b.salaryAsk)[0]!;
    expect(lifetime(run(idle, { type: 'hire', candidateId: cheapest.id }))).toBeLessThan(lifetime(idle));
  });

  it('сохранение без команды открывается и получает пустую команду с кандидатами', () => {
    const old: GameState = { ...advance(launchedGame(), 45) };
    delete old.team;
    const v = teamView(old, content);
    expect(v.members).toHaveLength(0);
    expect(v.candidates).toHaveLength(cfg.candidatesShown);
    const next = tick(old, content);
    expect(next.team).toBeDefined();
    expect(next.lastDay.salaryCost).toBe(0);
    const hired = run(old, { type: 'hire', candidateId: v.candidates[0]!.id });
    expect(teamView(hired, content).members).toHaveLength(1);
  });

  it('сводка команды не меняет состояние', () => {
    const s = deepFreeze(withTeam(newGame(), [employee()]));
    expect(teamView(s, content)).toEqual(teamView(s, content));
  });
});

describe('предупреждение перед наймом', () => {
  it('без дохода любой найм опасен: денег хватит меньше чем на три месяца', () => {
    const v = teamView(newGame(), content);
    for (const c of v.candidates) {
      expect(c.risky).toBe(true);
      // $3 000 при расходах «жизнь + инструменты + серверы + зарплата».
      const burn = 800 + content.config.toolsCostPerMonth + content.config.startCapacity * newGame().market.serverCostPerUser + c.salaryAsk;
      expect(c.cashDaysIfHired).toBe(Math.floor((3000 / burn) * 30));
    }
  });

  it('прогноз сбывается: после найма счёт уходит в минус примерно в названный день', () => {
    const s = newGame({ goal: 'sandbox' });
    const c = teamView(s, content).candidates[0]!;
    let x = run(s, { type: 'hire', candidateId: c.id });
    const quiet = { ...content, events: [], milestones: [] };
    let days = 0;
    while (x.cash >= 0 && days < 1000) {
      x = tick(x, quiet);
      days += 1;
    }
    expect(Math.abs(days - c.cashDaysIfHired!)).toBeLessThanOrEqual(2);
  });

  it('когда денег много или доход покрывает зарплату, найм не опасен', () => {
    expect(teamView({ ...newGame(), cash: 1_000_000 }, content).candidates.every((c) => !c.risky)).toBe(true);
    const earning = { ...newGame(), recentDays: Array.from({ length: 30 }, (_, day) => ({ day, cash: 0, users: 0, paying: 0, revenue: 400, expenses: 0 })) };
    for (const c of teamView(earning, content).candidates) {
      expect(c.cashDaysIfHired).toBeNull();
      expect(c.risky).toBe(false);
    }
  });
});
