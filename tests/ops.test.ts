// Службы большой компании: расход появляется только с ростом дохода, считается ступенями, растёт вслед за доходом с опозданием,
// а сжимается сам только медленно — быстро его сжимает сокращение с пособиями и последствиями.
import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { applyCommand, bankruptcyCause, currentRevenue, opsCostFor, opsCostPerMonth, opsLevelOf, opsView, steadyRevenue, tick, type GameState } from '../src/core';
import { launchedGame, newGame, run } from './helpers';

const cfg = content.config.ops;
const quiet = { ...content, events: [] };

/** Партия, в которой продукт уже days дней подряд приносит perMonth в месяц. */
function earning(perMonth: number, days = 90, base: GameState = launchedGame()): GameState {
  return {
    ...base,
    cash: 1e9,
    recentDays: Array.from({ length: days }, (_, i) => ({ day: base.day - days + i, cash: 1e9, users: 1000, paying: 100, revenue: perMonth / 30, expenses: 0 })),
  };
}

describe('сколько стоят службы', () => {
  it('маленькой компании службы не стоят ничего', () => {
    expect(opsCostFor(0, cfg)).toBe(0);
    expect(opsCostFor(cfg.steps[0]!.from, cfg)).toBe(0);
    expect(opsCostPerMonth(newGame(), content.config)).toBe(0);
    expect(tick(newGame(), quiet).lastDay.opsCost).toBe(0);
  });

  it('ставка берётся только с части дохода выше порога', () => {
    const [first, second] = cfg.steps as [{ from: number; rate: number }, { from: number; rate: number }];
    expect(opsCostFor(first.from + 10_000, cfg)).toBeCloseTo(10_000 * first.rate, 6);
    const below = (second.from - first.from) * first.rate;
    expect(opsCostFor(second.from + 50_000, cfg)).toBeCloseTo(below + 50_000 * second.rate, 6);
  });

  it('с каждого следующего доллара дохода прибыль растёт: ни одна ставка не доходит до 100%', () => {
    for (const step of cfg.steps) expect(step.rate).toBeLessThan(0.9);
    let previous = 0;
    for (let revenue = 0; revenue <= 3_000_000; revenue += 5_000) {
      const left = revenue - opsCostFor(revenue, cfg);
      expect(left).toBeGreaterThanOrEqual(previous);
      previous = left;
    }
  });

  it('у большой компании службы съедают около двух третей дохода — как в жизни', () => {
    const top = cfg.steps[cfg.steps.length - 1]!.rate;
    expect(top).toBeGreaterThanOrEqual(0.55);
    expect(top).toBeLessThanOrEqual(0.75);
    expect(opsCostFor(10_000_000, cfg) / 10_000_000).toBeGreaterThan(0.6);
    // Ставка складывается из долей четырёх служб.
    expect(cfg.lines.reduce((sum, l) => sum + l.weight, 0) / 100).toBeCloseTo(top, 6);
  });
});

describe('службы в ходе партии', () => {
  it('расход попадает в день и в общий итог расходов', () => {
    const s = tick(earning(500_000), quiet);
    const expected = opsCostFor(500_000, cfg) / 30;
    expect(s.lastDay.opsCost).toBeCloseTo(expected, 6);
    const b = s.lastDay;
    expect(b.expenses).toBeCloseTo(b.serverCost + b.adCost + b.toolsCost + b.feeCost + b.loanCost + b.livingCost + b.salaryCost + b.rentCost + expected, 6);
  });

  it('службы отстают от дохода: считаются по среднему за три месяца, а не по вчерашнему дню', () => {
    const base = earning(600_000);
    // Доход вчера упал вдвое — расход почти не изменился.
    const dropped = { ...base, recentDays: base.recentDays.map((d, i, all) => (i === all.length - 1 ? { ...d, revenue: d.revenue / 2 } : d)) };
    expect(steadyRevenue(dropped, cfg)).toBeGreaterThan(590_000);
    expect(opsCostPerMonth(dropped, content.config)).toBeGreaterThan(opsCostPerMonth(base, content.config) * 0.98);
    // Через три месяца низкого дохода службы сжались до него.
    expect(steadyRevenue(earning(300_000), cfg)).toBeCloseTo(300_000, 6);
  });

  it('после падения дохода компания какое-то время работает в убыток', () => {
    const base = earning(600_000);
    const fallen = { ...base, recentDays: base.recentDays.map((d, i) => (i >= 60 ? { ...d, revenue: d.revenue * 0.4 } : d)) };
    const revenue30 = fallen.recentDays.slice(-30).reduce((sum, d) => sum + d.revenue, 0);
    expect(opsCostPerMonth(fallen, content.config)).toBeGreaterThan(revenue30);
  });

  it('старое сохранение без поля служб открывается, а причина банкротства называет службы, когда они тяжелее всего', () => {
    const old = earning(500_000);
    delete (old.lastDay as { opsCost?: number }).opsCost;
    expect(bankruptcyCause({ ...old, status: 'bankrupt' })).not.toBe('ops');
    const next = tick(old, quiet);
    expect(next.lastDay.opsCost).toBeGreaterThan(0);
    expect(bankruptcyCause({ ...next, status: 'bankrupt' })).toBe('ops');
  });
});

describe('сводка для экрана', () => {
  it('маленькой компании показывает порог, большой — расход по четырём службам', () => {
    const small = opsView(newGame(), content.config);
    expect(small.active).toBe(false);
    expect(small.startsAt).toBe(cfg.steps[0]!.from);

    const big = opsView(earning(1_000_000), content.config);
    expect(big.active).toBe(true);
    expect(big.lines.map((l) => l.id)).toEqual(['support', 'sales', 'admin', 'upkeep']);
    expect(big.lines.reduce((sum, l) => sum + l.costPerMonth, 0)).toBeCloseTo(big.costPerMonth, 6);
    expect(big.sharePct).toBeGreaterThan(55);
    expect(big.nextCents).toBe(Math.round(cfg.steps[cfg.steps.length - 1]!.rate * 100));
  });
});

/** Компания, у которой службы набраны под level в месяц, а доход последние 30 дней — now в месяц. */
function fallen(level: number, now: number, base: GameState = launchedGame()): GameState {
  const s = earning(level, 90, base);
  return { ...s, ops: { level }, recentDays: s.recentDays.map((d, i) => (i >= 60 ? { ...d, revenue: now / 30 } : d)) };
}

describe('службы сжимаются сами только медленно', () => {
  it('пока доход растёт или стоит, службы набраны под устойчивый доход — как раньше', () => {
    const s = tick(earning(600_000), quiet);
    expect(s.ops?.level).toBeCloseTo(600_000, 6);
    expect(opsLevelOf(s, cfg)).toBeCloseTo(600_000, 6);
  });

  it('у маленькой компании о службах в сохранении ничего нет', () => {
    expect(tick(earning(10_000), quiet).ops).toBeUndefined();
  });

  it('старое сохранение без поля служб открывается: службы набраны под устойчивый доход', () => {
    const old = earning(500_000);
    expect(old.ops).toBeUndefined();
    expect(opsLevelOf(old, cfg)).toBeCloseTo(steadyRevenue(old, cfg), 6);
    expect(opsView(old, content.config).cuts.every((c) => c.blocked === 'nothing')).toBe(true);
  });

  it('доход упал — за три месяца службы почти не сжались: за год сами уходят около 15% людей', () => {
    let s = tick(earning(600_000), quiet);
    // Дальше идёт настоящая партия: доход у неё крошечный по сравнению с прежним.
    for (let i = 0; i < 90; i++) s = tick(s, quiet);
    expect(currentRevenue(s)).toBeLessThan(60_000);
    const kept = (s.ops?.level ?? 0) / 600_000;
    expect(kept).toBeGreaterThan(0.94);
    expect(kept).toBeLessThan(0.98);
    // За год — те самые 15%.
    expect(Math.pow(kept, 4)).toBeCloseTo(1 - cfg.attritionPerYear, 1);
    // Расход остался почти прежним, хотя доход упал в разы.
    expect(s.lastDay.opsCost! * 30).toBeGreaterThan(opsCostFor(600_000, cfg) * 0.93);
  });

  it('доход вернулся — службы снова растут вслед за ним', () => {
    const s = tick({ ...earning(600_000), ops: { level: 300_000 } }, quiet);
    expect(s.ops?.level).toBeCloseTo(600_000, 6);
  });
});

describe('срочное сокращение', () => {
  it('пока лишних людей нет, сокращать некого', () => {
    const s: GameState = { ...earning(600_000), ops: { level: 600_000 } };
    expect(opsView(s, content.config).excessPerMonth).toBe(0);
    expect(opsView(s, content.config).cuts.map((c) => c.blocked)).toEqual(['nothing', 'nothing']);
    expect(applyCommand(s, { type: 'cutOps', cut: 'full' }, content)).toEqual({ ok: false, error: 'opsCutUnavailable' });
  });

  it('экран видит, сколько стоят лишние люди и что даст каждое сокращение', () => {
    const view = opsView(fallen(600_000, 300_000), content.config);
    const saving = opsCostFor(600_000, cfg) - opsCostFor(300_000, cfg);
    expect(view.steadyRevenue).toBe(600_000);
    expect(view.currentRevenue).toBeCloseTo(300_000, 6);
    expect(view.excessPerMonth).toBeCloseTo(saving, 6);
    const [part, full] = view.cuts as [(typeof view.cuts)[number], (typeof view.cuts)[number]];
    expect(full.saving).toBeCloseTo(saving, 6);
    expect(part.saving).toBeCloseTo(saving / 2, 6);
    // Пособие — два месяца расходов на уволенных: в жизни, когда его платят, это 10–16 недель.
    expect(full.severance).toBe(Math.round(saving * 2));
    expect(full.paybackMonths).toBe(2);
    expect(full.blocked).toBeNull();
    // Глубокое сокращение бьёт сильнее и рискованнее.
    expect(full.riskPct).toBeGreaterThan(part.riskPct);
    expect(full.reputation).toBeLessThan(part.reputation);
    expect(full.motivation).toBeLessThan(part.motivation);
  });

  it('полное сокращение: пособия сразу, службы — под сегодняшний доход, репутация и настрой команды падают', () => {
    const before = fallen(600_000, 300_000);
    const withTeam: GameState = { ...before, team: before.team ? { ...before.team, employees: [{ ...before.team.candidates[0]!, salary: 3000, hiredDay: 0, motivation: 80, lastTalkDay: -999 } as never] } : before.team };
    const view = opsView(withTeam, content.config).cuts[1]!;
    const after = run(withTeam, { type: 'cutOps', cut: 'full' });
    expect(after.cash).toBeCloseTo(withTeam.cash - view.severance, 2);
    expect(after.ops?.level).toBeCloseTo(300_000, 6);
    expect(opsCostPerMonth(after, content.config)).toBeCloseTo(opsCostFor(300_000, cfg), 6);
    expect(after.reputation).toBeCloseTo(Math.max(0, withTeam.reputation - 4), 6);
    expect(after.team?.employees[0]?.motivation).toBe(70);
    expect(after.news?.at(-1)).toMatchObject({ kind: 'opsCut', value: view.severance });
    expect(after.ops?.last).toMatchObject({ cut: 'full', severance: view.severance });
  });

  it('половинное сокращение убирает половину лишних', () => {
    const after = run(fallen(600_000, 300_000), { type: 'cutOps', cut: 'part' });
    expect(after.ops?.level).toBeCloseTo(450_000, 6);
  });

  it('после сокращения службы не возвращаются сами: старое среднее никого не нанимает', () => {
    const cut = run(fallen(600_000, 300_000), { type: 'cutOps', cut: 'full' });
    // Устойчивое среднее за три месяца всё ещё выше сегодняшнего дохода.
    expect(steadyRevenue(cut, cfg)).toBeGreaterThan(450_000);
    const next = tick(cut, quiet);
    expect(next.ops!.level).toBeLessThanOrEqual(300_000);
  });

  it('второе сокращение подряд нельзя, как и сокращение без денег на пособия', () => {
    const cut = run(fallen(600_000, 300_000), { type: 'cutOps', cut: 'part' });
    expect(opsView(cut, content.config).cuts.map((c) => c.blocked)).toEqual(['cooldown', 'cooldown']);
    expect(opsView(cut, content.config).cutCooldownLeft).toBe(cfg.cutCooldownDays);
    expect(applyCommand(cut, { type: 'cutOps', cut: 'full' }, content).ok).toBe(false);
    const later = { ...cut, day: cut.day + cfg.cutCooldownDays };
    expect(opsView(later, content.config).cuts[1]!.blocked).toBeNull();

    const poor = { ...fallen(600_000, 300_000), cash: 1000 };
    expect(opsView(poor, content.config).cuts.map((c) => c.blocked)).toEqual(['cash', 'cash']);
    expect(applyCommand(poor, { type: 'cutOps', cut: 'full' }, content).ok).toBe(false);
  });

  it('риск: иногда сокращают лишнего, и пользователи уходят чаще; исход не меняется от перезагрузки', () => {
    const base = fallen(600_000, 300_000);
    let backfired = 0;
    const DAYS = 400;
    for (let i = 0; i < DAYS; i++) {
      const s = { ...base, day: base.day + i };
      const a = run(s, { type: 'cutOps', cut: 'full' });
      const b = run(s, { type: 'cutOps', cut: 'full' });
      expect(a.ops?.last?.backfired).toBe(b.ops?.last?.backfired);
      const mod = a.modifiers.find((m) => m.target === 'churn' && m.factor === 1.2);
      if (a.ops?.last?.backfired) {
        backfired++;
        expect(mod?.untilDay).toBe(s.day + 60);
        expect(a.news?.at(-1)).toMatchObject({ kind: 'opsCut', id: 'backfired', tone: 'bad' });
      } else {
        expect(mod).toBeUndefined();
        expect(a.news?.at(-1)).toMatchObject({ kind: 'opsCut', id: 'done' });
      }
    }
    // Шанс 35% — как и обещано игроку на экране.
    expect(backfired / DAYS).toBeGreaterThan(0.27);
    expect(backfired / DAYS).toBeLessThan(0.43);
  });
});
