// Характеры сотрудников и банк.
import { describe, expect, it } from 'vitest';
import { applyCommand, bankView, debtLeft, loanLimit, loanTerms, motivationTarget, teamOf, teamView, tick, type DriverId, type Employee, type GameContent, type GameState } from '../src/core';
import { content } from '../src/content';
import ru from '../src/content/ru/ui.json';
import { deepFreeze, launchedGame, newGame, run } from './helpers';

const cfg = content.config;
const quiet: GameContent = { ...content, events: [], milestones: [] };
const person = (over: Partial<Employee> = {}): Employee => ({ id: 900, role: 'developer', skill: 1, trait: 'diligent', salaryAsk: 3000, salary: 3000, nameSeed: 5, hiredDay: 0, motivation: 70, driver: 'money', ...over });
const withTeam = (s: GameState, employees: Employee[]): GameState => ({ ...s, team: { ...teamOf(s, content), employees } });
const mood: { rush: boolean; cash: number; months: GameState['months']; reputation: number; teamSize: number } = { rush: false, cash: 1000, months: [], reputation: 30, teamSize: 1 };
const target = (driver: DriverId, over: Partial<Employee> = {}, ctx: Partial<typeof mood> = {}) =>
  motivationTarget(person({ driver, ...over }), { ...mood, ...ctx }, cfg.team);
const month = (users: number, profit = -100) => ({ month: 0, revenue: 0, expenses: 0, profit, sideIncome: 0, users, paying: 0, cash: 0 });

describe('что движет сотрудником', () => {
  it('у кандидатов встречаются все пять движущих сил, у каждой есть название, подсказка и реплики', () => {
    const drivers = new Set(Array.from({ length: 80 }, (_, seed) => teamView(newGame({ seed }), content).candidates.map((c) => c.driver)).flat());
    expect([...drivers].sort()).toEqual(['growth', 'mission', 'money', 'peace', 'people']);
    const texts = ru.team as unknown as { drivers: Record<string, { name: string; hint: string }>; quotes: Record<string, Record<string, string>>; bios: string[]; quirks: string[] };
    for (const d of drivers) {
      expect(texts.drivers[d as string]!.name.length).toBeGreaterThan(3);
      expect(texts.drivers[d as string]!.hint.length).toBeGreaterThan(10);
      for (const band of ['high', 'mid', 'low']) expect(texts.quotes[d as string]![band]!.length, `${d}/${band}`).toBeGreaterThan(10);
    }
    expect(texts.bios.length).toBeGreaterThanOrEqual(12);
    expect(texts.quirks.length).toBeGreaterThanOrEqual(12);
  });

  it('«за деньги»: недоплата бьёт сильнее, чем по остальным', () => {
    expect(target('money', { salary: 2700 })).toBeLessThan(target('growth', { salary: 2700 }));
    expect(target('mission', { salary: 2700 })).toBeGreaterThan(target('growth', { salary: 2700 }));
  });

  it('«за ростом»: радуется, когда пользователей прибавилось, и гаснет в застое', () => {
    const growing = target('growth', {}, { months: [month(100), month(200)] });
    const flat = target('growth', {}, { months: [month(100), month(100)] });
    expect(growing - flat).toBe(16);
    expect(target('money', {}, { months: [month(100), month(200)] })).toBe(target('money', {}, { months: [month(100), month(100)] }));
  });

  it('«за спокойствием»: спешка бьёт вдвое, без спешки — небольшой плюс', () => {
    expect(target('peace')).toBe(target('money') + 5);
    expect(target('money') - target('money', {}, { rush: true })).toBe(cfg.team.rushPenalty);
    expect(target('peace') - target('peace', {}, { rush: true })).toBe(cfg.team.rushPenalty * 2 + 5);
  });

  it('«за идею»: держится на репутации продукта', () => {
    expect(target('mission', {}, { reputation: 60 }) - target('mission', {}, { reputation: 10 })).toBe(15);
  });

  it('«за людей»: в одиночку грустит, в команде оживает', () => {
    expect(target('people', {}, { teamSize: 1 })).toBe(target('money') - 8);
    expect(target('people', {}, { teamSize: 4 })).toBe(target('money') + 9);
    expect(target('people', {}, { teamSize: 30 })).toBe(target('money') + 9);
  });

  it('человек из старого сохранения без движущей силы считается «за деньги»', () => {
    const old = person();
    delete old.driver;
    expect(motivationTarget(old, mood, cfg.team)).toBe(target('money'));
    expect(teamView(withTeam(newGame(), [old]), content).members[0]!.driver).toBe('money');
  });

  it('настроение для реплики зависит от мотивации', () => {
    const moods = [90, 60, 20].map((motivation) => teamView(withTeam(newGame(), [person({ motivation })]), content).members[0]!.mood);
    expect(moods).toEqual(['high', 'mid', 'low']);
  });
});

describe('разговор один на один', () => {
  const base = withTeam(newGame(), [person({ motivation: 50 })]);

  it('поднимает мотивацию, стоит сил основателю и требует перерыва', () => {
    const after = run(base, { type: 'talk', employeeId: 900 });
    expect(teamOf(after, content).employees[0]).toMatchObject({ motivation: 50 + cfg.team.talkBoost, lastTalkDay: 0 });
    expect(after.energy).toBe(100 - cfg.team.talkEnergy);
    expect(applyCommand(after, { type: 'talk', employeeId: 900 }, content)).toEqual({ ok: false, error: 'talkTooSoon' });
    expect(teamView(after, content).members[0]).toMatchObject({ canTalk: false, talkInDays: cfg.team.talkCooldownDays });
  });

  it('через положенное число дней можно говорить снова', () => {
    let s = run(base, { type: 'talk', employeeId: 900 });
    for (let i = 0; i < cfg.team.talkCooldownDays; i++) s = tick(s, quiet);
    expect(teamView(s, content).members[0]!.canTalk).toBe(true);
    expect(applyCommand(s, { type: 'talk', employeeId: 900 }, content).ok).toBe(true);
  });

  it('с несуществующим сотрудником поговорить нельзя; мотивация не выходит за 100', () => {
    expect(applyCommand(base, { type: 'talk', employeeId: 1 }, content)).toEqual({ ok: false, error: 'noSuchEmployee' });
    const happy = run(withTeam(newGame(), [person({ motivation: 98 })]), { type: 'talk', employeeId: 900 });
    expect(teamOf(happy, content).employees[0]!.motivation).toBe(100);
  });

  it('команда не меняет исходное состояние', () => {
    run(deepFreeze(base), { type: 'talk', employeeId: 900 });
  });
});

describe('банк: кредит', () => {
  const bank = cfg.bank;

  it('без дохода дают немного, с доходом — в несколько месячных доходов', () => {
    expect(loanLimit(newGame(), bank)).toBe(bank.baseLimit);
    const earning = { ...launchedGame(), recentDays: Array.from({ length: 30 }, (_, day) => ({ day, cash: 0, users: 0, paying: 0, revenue: 100, expenses: 0 })) };
    expect(loanLimit(earning, bank)).toBe(bank.baseLimit + bank.revenueMultiple * 3000);
  });

  it('кредит: деньги сразу, возврат с процентами равными долями', () => {
    const s = newGame();
    const after = run(s, { type: 'takeLoan', amount: 2000 });
    const terms = loanTerms(2000, bank);
    expect(after.cash).toBe(s.cash + 2000);
    expect(terms.total).toBeCloseTo(2000 * (1 + bank.loanRateYear), 6);
    expect(debtLeft(after)).toBeCloseTo(terms.total, 2);
    expect(tick(after, quiet).lastDay.loanCost).toBeCloseTo(terms.total / bank.loanTermDays, 6);
    expect(bankView(after, bank)).toMatchObject({ debt: terms.total, paymentsPerMonth: terms.perMonth, loanLimit: 600 });
  });

  it('больше предела и меньше минимума не дают; долг уменьшает предел', () => {
    expect(applyCommand(newGame(), { type: 'takeLoan', amount: bank.baseLimit + 100 }, content)).toEqual({ ok: false, error: 'overLoanLimit' });
    expect(applyCommand(newGame(), { type: 'takeLoan', amount: bank.minLoan - 1 }, content)).toEqual({ ok: false, error: 'invalidValue' });
    const after = run(newGame(), { type: 'takeLoan', amount: bank.baseLimit });
    expect(loanLimit(after, bank)).toBe(0);
    expect(applyCommand(after, { type: 'takeLoan', amount: bank.minLoan }, content)).toEqual({ ok: false, error: 'overLoanLimit' });
  });

  it('по истечении срока кредит выплачен полностью', () => {
    let s = run({ ...newGame({ goal: 'sandbox' }), cash: 1e6 }, { type: 'takeLoan', amount: 2000 });
    for (let i = 0; i < bank.loanTermDays + 1; i++) s = tick(s, quiet);
    expect(debtLeft(s)).toBe(0);
    expect(s.loans).toEqual([]);
    expect(bankView(s, bank).loans).toEqual([]);
  });
});

describe('банк: вклад', () => {
  const bank = cfg.bank;
  const rich = (): GameState => ({ ...newGame({ goal: 'sandbox' }), cash: 100_000 });

  it('положить и снять: деньги переходят между счётом и вкладом', () => {
    const put = run(rich(), { type: 'deposit', amount: 60_000 });
    expect(put).toMatchObject({ cash: 40_000, deposit: 60_000 });
    const back = run(put, { type: 'withdraw', amount: 25_000 });
    expect(back).toMatchObject({ cash: 65_000, deposit: 35_000 });
  });

  it('нельзя положить больше, чем есть, и снять больше, чем лежит', () => {
    expect(applyCommand(rich(), { type: 'deposit', amount: 100_001 }, content)).toEqual({ ok: false, error: 'notEnoughCash' });
    expect(applyCommand(rich(), { type: 'withdraw', amount: 1 }, content)).toEqual({ ok: false, error: 'invalidValue' });
    expect(applyCommand(rich(), { type: 'deposit', amount: -5 }, content)).toEqual({ ok: false, error: 'invalidValue' });
  });

  it('вклад растёт на проценты: за год — примерно ставка', () => {
    let s = run(rich(), { type: 'deposit', amount: 50_000 });
    for (let i = 0; i < 360; i++) s = tick(s, quiet);
    expect(s.deposit! / 50_000 - 1).toBeGreaterThan(bank.depositRateYear * 0.98);
    expect(s.deposit! / 50_000 - 1).toBeLessThan(bank.depositRateYear * 1.06);
    expect(bankView(s, bank).depositIncomePerMonth).toBeCloseTo((s.deposit! * bank.depositRateYear) / 12, 2);
  });

  it('если счёт уходит в минус, банк сам закрывает его деньгами со вклада — банкротства нет', () => {
    let s = run({ ...newGame({ goal: 'sandbox' }), cash: 5000 }, { type: 'deposit', amount: 4990 });
    for (let i = 0; i < 60; i++) s = tick(s, quiet);
    expect(s.cash).toBeGreaterThanOrEqual(0);
    expect(s.negativeCashDays).toBe(0);
    expect(s.deposit!).toBeLessThan(4990);
    expect(s.status).toBe('running');
  });

  it('старое сохранение без вклада работает как раньше', () => {
    const old = { ...launchedGame() };
    delete old.deposit;
    expect(bankView(old, bank).deposit).toBe(0);
    expect(tick(old, quiet).deposit).toBeUndefined();
  });

  it('у банка есть все тексты', () => {
    const texts = (ru as unknown as { bank: Record<string, unknown> }).bank;
    for (const key of ['title', 'account', 'deposit', 'debt', 'limit', 'loanTitle', 'take', 'depositTitle', 'put', 'withdrawAll']) expect(texts[key], key).toBeDefined();
  });
});
