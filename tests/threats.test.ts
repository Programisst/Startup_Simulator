// Угрозы большой компании: спад рынка и сильный конкурент.
// Маленькой компании они не грозят; большой — раз в квартал может выпасть угроза, на которую игрок отвечает один раз.
import { describe, expect, it } from 'vitest';
import { content } from '../src/content';
import { applyCommand, revenue30Of, threatOfWindow, threatPressure, threatView, tick, type GameState, type ThreatKind, type ThreatResponseId } from '../src/core';
import { advance, launchedGame, run } from './helpers';

const cfg = content.config.threats;
const quiet = { ...content, events: content.events.filter((e) => e.threat) };
const kindOf = (id: ThreatKind) => cfg.kinds.find((k) => k.id === id)!;

/** Большая компания: продукт days дней подряд приносит perMonth в месяц, службы набраны под этот доход. */
function big(perMonth = 600_000, base: GameState = launchedGame()): GameState {
  return {
    ...base,
    cash: 1e9,
    users: 50_000,
    paying: 5000,
    capacity: 100_000,
    ops: { level: perMonth },
    recentDays: Array.from({ length: 90 }, (_, i) => ({ day: base.day - 90 + i, cash: 1e9, users: 50_000, paying: 5000, revenue: perMonth / 30, expenses: 0 })),
  };
}

/** Первый период партии, в котором выпадает такая угроза. */
function windowWith(seed: number, kind: ThreatKind): number {
  for (let w = 1; w < 5000; w++) if (threatOfWindow(seed, w, content.config)?.kind === kind) return w;
  throw new Error('угроза не нашлась');
}

/** Большая компания в первый день угрозы: сообщение о ней уже прочитано. */
function under(kind: ThreatKind, seed = 42): GameState {
  const base = big(600_000, launchedGame({ seed }));
  const started = tick({ ...base, day: windowWith(seed, kind) * cfg.periodDays, pendingEvent: null }, quiet);
  expect(started.threats?.active?.kind).toBe(kind);
  return run(started, { type: 'chooseEvent', choiceId: 'ok' });
}

describe('когда приходит угроза', () => {
  it('частота — как в жизни: спад раз в шесть с небольшим лет, длится 8–18 месяцев', () => {
    const seen: Record<ThreatKind, number> = { downturn: 0, rival: 0 };
    const WINDOWS = 20_000;
    for (let w = 0; w < WINDOWS; w++) {
      const t = threatOfWindow(7, w, content.config);
      if (!t) continue;
      seen[t.kind]++;
      const def = kindOf(t.kind);
      expect(t.days).toBeGreaterThanOrEqual(def.minDays);
      expect(t.days).toBeLessThanOrEqual(def.maxDays);
    }
    expect(seen.downturn / WINDOWS).toBeCloseTo(kindOf('downturn').chance, 2);
    expect(seen.rival / WINDOWS).toBeCloseTo(kindOf('rival').chance, 2);
    // Спад: в жизни цикл — около 75 месяцев, то есть 25 кварталов.
    const quartersBetween = 1 / kindOf('downturn').chance;
    expect(quartersBetween).toBeGreaterThanOrEqual(20);
    expect(quartersBetween).toBeLessThanOrEqual(30);
    expect(kindOf('downturn').minDays).toBe(8 * 30);
    expect(kindOf('downturn').maxDays).toBe(18 * 30);
  });

  it('маленькой компании угрозы не грозят, сколько бы она ни жила', () => {
    let s = launchedGame();
    s = advance({ ...s, cash: 1e9 }, 3 * 360);
    expect(s.threats).toBeUndefined();
    expect(s.eventLog.some((e) => e.eventId.startsWith('threat'))).toBe(false);
    expect(threatView(s, content).unlocked).toBe(false);
  });

  it('большой компании в «свой» квартал приходит угроза: игра останавливается и сообщает о ней', () => {
    for (const kind of ['downturn', 'rival'] as const) {
      const base = big();
      const window = windowWith(base.seed, kind);
      const days = threatOfWindow(base.seed, window, content.config)!.days;
      const s = tick({ ...base, day: window * cfg.periodDays }, quiet);
      expect(s.threats?.active).toMatchObject({ kind, startDay: window * cfg.periodDays, untilDay: window * cfg.periodDays + days, response: null, success: null });
      expect(s.threats?.count).toBe(1);
      expect(s.pendingEvent).toBe(kind === 'downturn' ? 'threatDownturn' : 'threatRival');
      expect(s.news?.at(-1)).toMatchObject({ kind: 'threat', id: kind, tone: 'bad' });
      // Пока сообщение не прочитано, время стоит.
      expect(tick(s, quiet)).toBe(s);
    }
  });

  it('в спокойный квартал и не в первый день квартала ничего не начинается', () => {
    const base = big();
    const window = windowWith(base.seed, 'downturn');
    expect(tick({ ...base, day: window * cfg.periodDays + 1 }, quiet).threats).toBeUndefined();
    let calm = 1;
    while (threatOfWindow(base.seed, calm, content.config)) calm++;
    expect(tick({ ...base, day: calm * cfg.periodDays }, quiet).threats).toBeUndefined();
  });

  it('сообщения об угрозах случайно не выпадают', () => {
    const s = advance({ ...launchedGame(), cash: 1e9 }, 2 * 360);
    expect(s.eventLog.length).toBeGreaterThan(5);
    expect(s.eventLog.some((e) => e.eventId === 'threatDownturn' || e.eventId === 'threatRival')).toBe(false);
  });
});

describe('что угроза делает с компанией', () => {
  it('без угрозы давления нет, и старое сохранение открывается', () => {
    const s = big();
    expect(s.threats).toBeUndefined();
    expect(threatPressure(s, content.config)).toEqual({ acquisition: 1, churn: 1, revenue: 1 });
    const view = threatView(s, content);
    expect(view.unlocked).toBe(true);
    expect(view.active).toBeNull();
    // Шансы за год игрок видит заранее.
    expect(view.yearlyChancePct).toEqual([
      { kind: 'downturn', pct: 15 },
      { kind: 'rival', pct: 22 },
    ]);
  });

  it('в спад людей приходит меньше, а уходит больше — доход при этом сам не режется', () => {
    const hit = under('downturn');
    const calm: GameState = { ...hit, threats: { ...hit.threats!, active: null } };
    const a = tick(hit, quiet).lastDay;
    const b = tick(calm, quiet).lastDay;
    const def = kindOf('downturn').pressure;
    expect(a.organic / b.organic).toBeCloseTo(def.acquisition, 6);
    expect(a.churned / b.churned).toBeCloseTo(def.churn, 1);
    expect(a.churned).toBeGreaterThan(b.churned * 1.3);
    expect(def.revenue).toBe(1);
  });

  it('экран видит, что происходит и сколько это обычно длится', () => {
    const view = threatView(under('rival'), content).active!;
    expect(view.kind).toBe('rival');
    expect(view.fewerUsersPct).toBe(25);
    expect(view.moreChurnPct).toBe(30);
    expect(view.lessRevenuePct).toBe(0);
    expect([view.monthsFrom, view.monthsTo]).toEqual([12, 24]);
    expect(view.responses.map((r) => r.id)).toEqual(['priceWar', 'outbuild']);
  });

  it('угроза кончается в свой срок, и полгода после неё новая не начинается', () => {
    const hit = under('downturn');
    const until = hit.threats!.active!.untilDay;
    const ended = tick({ ...hit, day: until }, quiet);
    expect(ended.threats).toMatchObject({ active: null, endedDay: until, count: 1 });
    expect(ended.threats?.last).toMatchObject({ kind: 'downturn', endDay: until, response: null });
    expect(ended.news?.at(-1)).toMatchObject({ kind: 'threat', id: 'downturnEnded', tone: 'good' });
    expect(threatPressure(ended, content.config).churn).toBe(1);

    // Найдём «опасный» квартал сразу после конца угрозы — он пройдёт спокойно, а такой же через полгода — нет.
    const window = windowWith(hit.seed, 'rival');
    const day = window * cfg.periodDays;
    const soon = tick({ ...ended, day, threats: { ...ended.threats!, endedDay: day - cfg.graceDays + 1 } }, quiet);
    expect(soon.threats?.active).toBeNull();
    const later = tick({ ...ended, day, threats: { ...ended.threats!, endedDay: day - cfg.graceDays } }, quiet);
    expect(later.threats?.active?.kind).toBe('rival');
  });
});

describe('ответ игрока', () => {
  it('скидки в спад: исход известен заранее — люди остаются, доход ниже', () => {
    const hit = under('downturn');
    const option = threatView(hit, content).active!.responses.find((r) => r.id === 'discount')!;
    expect(option).toMatchObject({ cost: 0, chancePct: 100, blocked: null });
    expect(option.success.lessRevenuePct).toBe(10);
    expect(option.success.lessRevenuePerMonth).toBe(Math.round(revenue30Of(hit) * 0.1));
    expect(option.success.lessRevenuePerMonth).toBeGreaterThan(55_000);

    const after = run(hit, { type: 'respondThreat', response: 'discount' });
    expect(after.cash).toBe(hit.cash);
    expect(after.threats?.active).toMatchObject({ response: 'discount', success: true, paid: 0 });
    expect(threatPressure(after, content.config)).toEqual(kindOf('downturn').responses[0]!.success);
    // Доход за день стал ниже на десятую часть, уходит людей меньше.
    const withDiscount = tick(after, quiet).lastDay;
    const without = tick(hit, quiet).lastDay;
    expect(withDiscount.revenue / without.revenue).toBeCloseTo(0.9, 2);
    expect(withDiscount.churned).toBeLessThan(without.churned * 0.85);
  });

  it('ответить можно один раз, и только на ту угрозу, что идёт', () => {
    const hit = under('downturn');
    expect(applyCommand(hit, { type: 'respondThreat', response: 'priceWar' }, content)).toEqual({ ok: false, error: 'threatUnavailable' });
    const after = run(hit, { type: 'respondThreat', response: 'discount' });
    expect(applyCommand(after, { type: 'respondThreat', response: 'attack' }, content).ok).toBe(false);
    expect(threatView(after, content).active!.responses.every((r) => r.blocked === 'answered')).toBe(true);
    expect(applyCommand(big(), { type: 'respondThreat', response: 'discount' }, content).ok).toBe(false);
  });

  it('рискованный ответ стоит денег сразу; без денег он недоступен', () => {
    const hit = under('downturn');
    const option = threatView(hit, content).active!.responses.find((r) => r.id === 'attack')!;
    // Половина дохода за последние 30 дней, округлённая до сотни.
    const cost = Math.round((revenue30Of(hit) * 0.5) / 100) * 100;
    expect(option.cost).toBe(cost);
    expect(cost).toBeGreaterThan(280_000);
    expect(option.chancePct).toBe(50);
    const after = run(hit, { type: 'respondThreat', response: 'attack' });
    expect(after.cash).toBe(hit.cash - cost);
    expect(after.threats?.active?.paid).toBe(cost);

    const poor = { ...hit, cash: 1000 };
    expect(threatView(poor, content).active!.responses.find((r) => r.id === 'attack')!.blocked).toBe('cash');
    expect(applyCommand(poor, { type: 'respondThreat', response: 'attack' }, content).ok).toBe(false);
  });

  it('у рискованного ответа бывают оба исхода, их доля — как обещано, и перезагрузка исход не меняет', () => {
    const outcomes = (response: ThreatResponseId, kind: ThreatKind, quality: number) => {
      let won = 0;
      const SEEDS = 120;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const hit = { ...under(kind, seed), quality };
        const a = run(hit, { type: 'respondThreat', response });
        const b = run(hit, { type: 'respondThreat', response });
        expect(a.threats?.active?.success).toBe(b.threats?.active?.success);
        if (a.threats?.active?.success) won++;
      }
      return won / SEEDS;
    };
    const attack = outcomes('attack', 'downturn', 70);
    expect(attack).toBeGreaterThan(0.36);
    expect(attack).toBeLessThan(0.64);
    // Обогнать продуктом легче тому, у кого продукт лучше.
    expect(outcomes('outbuild', 'rival', 95)).toBeGreaterThan(outcomes('outbuild', 'rival', 20) + 0.25);
  });

  it('обогнали продуктом — конкурент отступает за два месяца; не вышло — деньги потеряны и вырос долг', () => {
    let won: GameState | null = null;
    let lost: GameState | null = null;
    for (let seed = 1; seed <= 200 && !(won && lost); seed++) {
      const hit = { ...under('rival', seed), quality: 60, debt: 5 };
      const after = run(hit, { type: 'respondThreat', response: 'outbuild' });
      const a = after.threats!.active!;
      if (a.success && !won) {
        won = after;
        expect(a.untilDay).toBe(Math.min(hit.threats!.active!.untilDay, hit.day + 60));
        expect(after.debt).toBe(5);
        expect(threatPressure(after, content.config)).toEqual(kindOf('rival').responses[1]!.success);
        expect(threatView(after, content).active!.endsInDays).toBe(60);
        expect(after.news?.at(-1)).toMatchObject({ kind: 'threat', id: 'outbuildWon', tone: 'good' });
      }
      if (!a.success && !lost) {
        lost = after;
        expect(a.untilDay).toBe(hit.threats!.active!.untilDay);
        expect(after.debt).toBe(15);
        // Давление осталось прежним.
        expect(threatPressure(after, content.config)).toEqual(kindOf('rival').pressure);
        expect(after.news?.at(-1)).toMatchObject({ kind: 'threat', id: 'outbuildLost', tone: 'bad' });
      }
      // Цена — 60% дохода за последние 30 дней.
      expect(after.cash).toBe(hit.cash - Math.round((revenue30Of(hit) * 0.6) / 100) * 100);
    }
    expect(won).not.toBeNull();
    expect(lost).not.toBeNull();
  });
});
