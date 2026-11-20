// Раунды инвестиций: игрок зовёт инвестора и торгуется за цену доли — с риском, что тот уйдёт.
import { describe, expect, it } from 'vitest';
import { applyCommand, fundingPosition, fundingView, tick, valuation, type Command, type GameContent, type GameState, type MonthReport } from '../src/core';
import { content } from '../src/content';
import { deepFreeze, launchedGame, newGame, run } from './helpers';

const cfg = content.config.funding;
const quiet: GameContent = { ...content, events: [], milestones: [] };
const investor = (id: string) => cfg.investors.find((i) => i.id === id)!;
const counter = (id: 'ask' | 'press') => cfg.counters.find((c) => c.id === id)!;
const round100 = (x: number) => Math.round(x / 100) * 100;

const month = (i: number, revenue: number, users: number, profit = 0): MonthReport => ({ month: i, revenue, expenses: revenue - profit, profit, sideIncome: 0, users, paying: 0, cash: 0 });
const earning = (s: GameState, perDay: number): GameState => ({
  ...s,
  recentDays: Array.from({ length: 30 }, (_, i) => ({ day: s.day - 30 + i, cash: s.cash, users: s.users, paying: s.paying, revenue: perDay, expenses: 0 })),
});

/** Запущенная компания с ровной историей: позиция на переговорах обычная, без плюсов и минусов. */
const live = (over: Partial<GameState> = {}): GameState =>
  earning({ ...launchedGame(), cash: 50_000, users: 1000, energy: 100, reputation: 50, modifiers: [], months: [month(0, 30_000, 1000), month(1, 30_000, 1000)], ...over }, 1000);

/** Настройки, в которых торг всегда удаётся или всегда проваливается: исход не зависит от удачи. */
const rigged = (succeed: boolean): GameContent => ({
  ...quiet,
  config: { ...content.config, funding: { ...cfg, chanceMin: 0, chanceMax: 1, counters: cfg.counters.map((c) => ({ ...c, chance: succeed ? 5 : -5 })) } },
});
const send = (s: GameState, cmd: Command, c: GameContent = content): GameState => {
  const result = applyCommand(s, cmd, c);
  if (!result.ok) throw new Error(`Команда ${cmd.type} отклонена: ${result.error}`);
  return result.state;
};
/** Настройки, в которых инвестор всегда заинтересован или всегда отказывает: встреча не зависит от удачи. */
const mood = (interested: boolean): GameContent => ({
  ...quiet,
  config: { ...content.config, funding: { ...cfg, interestMin: 0, interestMax: 1, investors: cfg.investors.map((i) => ({ ...i, interest: interested ? 5 : -5 })) } },
});
/** Встреча, на которой инвестор точно делает предложение. */
const open = (s: GameState, id: string): GameState => send(s, { type: 'openRound', investorId: id }, mood(true));
const v = (s: GameState) => valuation(s.months, s.users, s.market);

describe('инвесторы', () => {
  it('три инвестора: ангелы берут мало и терпеливы, фонд требует роста, корпорация платит меньше, но приводит клиентов', () => {
    const view = fundingView(live(), content);
    expect(view.blocked).toBeNull();
    const [angels, fund, strategic] = view.investors;
    expect(angels).toMatchObject({ id: 'angels', perk: null, promise: null, blocked: null });
    expect(fund).toMatchObject({ id: 'fund', perk: null, promise: { growthPct: 100, days: 360, penaltyPct: 5 } });
    expect(strategic).toMatchObject({ id: 'strategic', promise: null, perk: { boostPct: 30, days: 120 } });
    expect(angels!.sharePct).toBeLessThan(fund!.sharePct);
    expect(fund!.sharePct).toBeLessThanOrEqual(strategic!.sharePct);
    // Ангелы соглашаются чаще фонда, фонд — чаще корпорации; но чаще всего отказывают все.
    expect(angels!.interestPct).toBeGreaterThan(fund!.interestPct);
    expect(fund!.interestPct).toBeGreaterThan(strategic!.interestPct);
    expect(angels!.interestPct).toBeLessThan(50);
    expect(angels!.patience).toBeGreaterThan(fund!.patience);
    expect(strategic!.pricePct).toBeLessThan(fund!.pricePct);
    expect(fund!.offer).toBe(round100(v(live()) * investor('fund').share * investor('fund').price));
    expect(fund!.shareAfterPct).toBe(80);
    expect(fund!.promise!.target).toBeCloseTo(30_000 * 2, 6);
  });

  it('до запуска и с маленькой оценкой инвесторы не разговаривают', () => {
    const early = { ...newGame(), cash: 1e6 };
    expect(fundingView(early, content).blocked).toBe('notLaunched');
    expect(applyCommand(early, { type: 'openRound', investorId: 'angels' }, content)).toEqual({ ok: false, error: 'fundingUnavailable' });
    const tiny = live({ months: [month(0, 100, 10), month(1, 100, 10)], users: 10 });
    expect(v(tiny)).toBeLessThan(cfg.minValuation);
    expect(fundingView(tiny, content).blocked).toBe('valuation');
    expect(applyCommand(live(), { type: 'openRound', investorId: 'банк' }, content).ok).toBe(false);
  });

  it('нельзя отдать слишком много: у основателя должна остаться заметная доля', () => {
    const diluted = live({ founderShare: 0.24 });
    const view = fundingView(diluted, content);
    expect(view.investors.map((i) => i.blocked)).toEqual([null, 'share', 'share']);
    expect(applyCommand(diluted, { type: 'openRound', investorId: 'strategic' }, content).ok).toBe(false);
  });
});

describe('позиция на переговорах', () => {
  it('ровная компания — обычная позиция; растущая прибыльная с репутацией — сильная', () => {
    expect(fundingPosition(live())).toMatchObject({ score: 0, level: 'normal', reasons: [] });
    const strong = live({ months: [month(0, 30_000, 1000), month(1, 30_000, 1500, 5000)], reputation: 80 });
    expect(fundingPosition(strong)).toMatchObject({ score: 3, level: 'strong' });
    expect(fundingPosition(strong).reasons.map((r) => r.id)).toEqual(['growth', 'profit', 'reputation']);
  });

  it('кончаются деньги, падают пользователи, плохая репутация — слабая', () => {
    const weak = live({ months: [month(0, 30_000, 1000), month(1, 30_000, 900, -40_000)], cash: 50_000, reputation: 30 });
    const pos = fundingPosition(weak);
    expect(pos).toMatchObject({ score: -2, level: 'weak' });
    expect(pos.reasons).toEqual([
      { id: 'growth', sign: -1 },
      { id: 'runway', sign: -1 },
      { id: 'reputation', sign: -1 },
    ]);
    // С запасом денег тот же убыток позицию не портит.
    expect(fundingPosition({ ...weak, cash: 1e6 }).reasons.some((r) => r.id === 'runway')).toBe(false);
  });

  it('сильная позиция — щедрее первое предложение и выше шанс уступки', () => {
    const base = live();
    const strong = live({ reputation: 80, months: [month(0, 30_000, 1000), month(1, 30_000, 1000, 5000)] });
    expect(fundingPosition(strong).score).toBe(2);
    const offerOf = (s: GameState) => fundingView(s, content).investors[1]!.pricePct;
    expect(offerOf(strong)).toBe(Math.round(100 * (1 + 2 * cfg.positionPrice)));
    expect(offerOf(base)).toBe(100);
    const chanceOf = (s: GameState) => fundingView(open(s, 'fund'), content).talks!.counters[0]!.chancePct;
    expect(chanceOf(strong) - chanceOf(base)).toBe(Math.round(2 * cfg.positionChance * 100));
  });
});

describe('встреча', () => {
  it('чаще всего инвестор отказывает: силы потрачены, предложения нет, новая встреча — не сразу', () => {
    const s = live();
    const declined = send(s, { type: 'openRound', investorId: 'fund' }, mood(false));
    expect(declined.energy).toBe(100 - cfg.energyCost);
    expect(declined.cash).toBe(s.cash);
    expect(declined.reputation).toBe(s.reputation);
    expect(fundingView(declined, content)).toMatchObject({ talks: null, blocked: 'cooldown', cooldownDaysLeft: cfg.cooldownDeclined, last: { kind: 'declined', investor: 'fund' }, rounds: 0 });
  });

  it('предложение делают примерно с обещанной частотой', () => {
    const shown = fundingView(live(), content).investors[0]!.interestPct / 100;
    let offers = 0;
    const games = 400;
    for (let seed = 1; seed <= games; seed++) {
      if (run({ ...live(), seed }, { type: 'openRound', investorId: 'angels' }).funding!.talks) offers += 1;
    }
    expect(Math.abs(offers / games - shown)).toBeLessThan(0.07);
  });

  it('сильной компании отказывают реже, слабой — почти всегда', () => {
    const interest = (s: GameState) => fundingView(s, content).investors[1]!.interestPct;
    const strong = live({ months: [month(0, 30_000, 1000), month(1, 30_000, 1500, 5000)], reputation: 80 });
    const weak = live({ months: [month(0, 30_000, 1000), month(1, 30_000, 900, -40_000)], reputation: 30 });
    expect(interest(live())).toBe(Math.round(investor('fund').interest * 100));
    expect(interest(strong)).toBe(Math.round((investor('fund').interest + 3 * cfg.positionInterest) * 100));
    expect(interest(weak)).toBe(Math.round(cfg.interestMin * 100));
  });
});

describe('переговоры', () => {
  it('начало стоит сил; инвестор называет первую цену; второго инвестора параллельно позвать нельзя', () => {
    const s = live();
    const shown = fundingView(s, content).investors[0]!;
    const talking = open(s, 'angels');
    expect(talking.energy).toBe(100 - cfg.energyCost);
    expect(talking.cash).toBe(s.cash);
    const view = fundingView(talking, content);
    expect(view.talks).toMatchObject({ investor: 'angels', offer: shown.offer, patience: investor('angels').patience, daysLeft: cfg.talkDays, lastChance: false, lastCounter: null });
    expect(view.blocked).toBe('talks');
    expect(applyCommand(talking, { type: 'openRound', investorId: 'fund' }, content).ok).toBe(false);
    expect(applyCommand(live({ energy: cfg.energyCost - 1 }), { type: 'openRound', investorId: 'fund' }, content).ok).toBe(false);
    expect(fundingView(live({ energy: cfg.energyCost - 1 }), content).blocked).toBe('energy');
  });

  it('два способа торговаться: «попросить больше» — скромнее и надёжнее, «давить» — больше и рискованнее', () => {
    const view = fundingView(open(live(), 'fund'), content).talks!;
    const [ask, press] = view.counters;
    expect(ask).toMatchObject({ stance: 'ask', offer: round100(view.offer * (1 + counter('ask').raise)), chancePct: Math.round(counter('ask').chance * 100), atMax: false });
    expect(press).toMatchObject({ stance: 'press', offer: round100(view.offer * (1 + counter('press').raise)), chancePct: Math.round(counter('press').chance * 100) });
    // Ангелы сговорчивее, корпорация жёстче.
    const chance = (id: string) => fundingView(open(live(), id), content).talks!.counters[0]!.chancePct;
    expect(chance('angels')).toBeGreaterThan(chance('fund'));
    expect(chance('fund')).toBeGreaterThan(chance('strategic'));
  });

  it('инвестор уступил: предложение выросло, но следующая уступка даётся труднее', () => {
    const talking = open(live(), 'fund');
    const before = fundingView(talking, content).talks!;
    const raised = send(talking, { type: 'counterOffer', stance: 'ask' }, rigged(true));
    const after = fundingView(raised, content).talks!;
    expect(after).toMatchObject({ offer: before.counters[0]!.offer, patience: before.patience, lastCounter: { stance: 'ask', ok: true } });
    expect(after.pricePct).toBe(Math.round(100 * (1 + counter('ask').raise)));
    expect(after.counters[0]!.chancePct).toBe(before.counters[0]!.chancePct - Math.round(cfg.raisePenalty * 100));
    expect(raised.cash).toBe(talking.cash);
  });

  it('выше потолка инвестор не заплатит', () => {
    let s = open(live(), 'fund');
    for (let i = 0; i < 6; i++) {
      const next = applyCommand(s, { type: 'counterOffer', stance: 'press' }, rigged(true));
      if (!next.ok) break;
      s = next.state;
    }
    const view = fundingView(s, content).talks!;
    expect(view.offer).toBe(round100(v(live()) * investor('fund').share * cfg.maxPrice));
    expect(view.counters.every((c) => c.atMax)).toBe(true);
    expect(applyCommand(s, { type: 'counterOffer', stance: 'ask' }, rigged(true)).ok).toBe(false);
  });

  it('инвестор отказал: предложение прежнее, терпения меньше; кончилось терпение — ушёл, репутация упала', () => {
    const talking = open(live(), 'fund');
    const offer = fundingView(talking, content).talks!.offer;
    const once = send(talking, { type: 'counterOffer', stance: 'press' }, rigged(false));
    expect(fundingView(once, content).talks).toMatchObject({ offer, patience: 1, lastChance: true, lastCounter: { stance: 'press', ok: false } });
    expect(once.reputation).toBe(50);
    const gone = send(once, { type: 'counterOffer', stance: 'ask' }, rigged(false));
    const view = fundingView(gone, content);
    expect(view).toMatchObject({ talks: null, blocked: 'cooldown', cooldownDaysLeft: cfg.cooldownWalked, last: { kind: 'walked', investor: 'fund' }, rounds: 0 });
    expect(gone.reputation).toBe(50 + cfg.walkedReputation);
    expect(gone.cash).toBe(talking.cash);
    expect(gone.founderShare ?? 1).toBe(1);
    expect((gone.news ?? []).at(-1)).toMatchObject({ kind: 'funding', id: 'walked', tone: 'bad' });
    expect(applyCommand(gone, { type: 'counterOffer', stance: 'ask' }, content).ok).toBe(false);
  });

  it('уступки случаются примерно с обещанной частотой', () => {
    let ok = 0;
    const games = 400;
    for (let seed = 1; seed <= games; seed++) {
      const after = run(open({ ...live(), seed }, 'fund'), { type: 'counterOffer', stance: 'ask' });
      if (after.funding!.talks!.lastCounter!.ok) ok += 1;
    }
    expect(Math.abs(ok / games - counter('ask').chance)).toBeLessThan(0.07);
  });

  it('можно уйти самому — без обид; предложение без ответа сгорает', () => {
    const talking = open(live(), 'angels');
    const left = run(talking, { type: 'leaveRound' });
    expect(fundingView(left, content)).toMatchObject({ talks: null, cooldownDaysLeft: cfg.cooldownLeft, last: { kind: 'left' } });
    expect(left.reputation).toBe(talking.reputation);
    let s = talking;
    for (let i = 0; i < cfg.talkDays - 1; i++) s = tick(s, quiet);
    expect(s.funding!.talks).not.toBeNull();
    s = tick(s, quiet);
    expect(s.funding).toMatchObject({ talks: null, last: { kind: 'expired' } });
    expect(applyCommand(live(), { type: 'leaveRound' }, content).ok).toBe(false);
    expect(applyCommand(live(), { type: 'closeRound' }, content).ok).toBe(false);
  });
});

describe('сделка', () => {
  it('деньги на счёте, доля — инвестору, в ленте новость, следующий раунд не скоро', () => {
    const talking = send(open(live(), 'angels'), { type: 'counterOffer', stance: 'ask' }, rigged(true));
    const offer = fundingView(talking, content).talks!.offer;
    const done = run(talking, { type: 'closeRound' });
    expect(done.cash).toBe(talking.cash + offer);
    expect(done.founderShare).toBeCloseTo(1 - investor('angels').share, 6);
    expect(fundingView(done, content)).toMatchObject({ talks: null, rounds: 1, promise: null, blocked: 'cooldown', cooldownDaysLeft: cfg.cooldownClosed, last: { kind: 'closed', amount: offer, share: investor('angels').share } });
    expect((done.news ?? []).at(-1)).toMatchObject({ kind: 'invest', value: offer });
    expect(done.modifiers).toHaveLength(0);
  });

  it('торг окупается: за ту же долю — больше денег', () => {
    const plain = run(open(live(), 'fund'), { type: 'closeRound' });
    const pushed = run(send(open(live(), 'fund'), { type: 'counterOffer', stance: 'press' }, rigged(true)), { type: 'closeRound' });
    expect(pushed.founderShare).toBe(plain.founderShare);
    expect(pushed.cash - live().cash).toBeCloseTo((plain.cash - live().cash) * (1 + counter('press').raise), -3);
  });

  it('корпорация приводит клиентов: приток растёт на несколько месяцев', () => {
    const done = run(open(live(), 'strategic'), { type: 'closeRound' });
    expect(done.modifiers).toEqual([{ target: 'acquisition', factor: investor('strategic').perk!.factor, untilDay: done.day + investor('strategic').perk!.days }]);
    expect(done.founderShare).toBeCloseTo(0.8, 6);
  });

  it('доли от нескольких раундов перемножаются', () => {
    const first = run(open(live(), 'fund'), { type: 'closeRound' });
    const later = { ...first, day: first.day + cfg.cooldownClosed, energy: 100 };
    const second = run(open(later, 'angels'), { type: 'closeRound' });
    expect(second.founderShare).toBeCloseTo((1 - investor('fund').share) * (1 - investor('angels').share), 4);
    expect(fundingView(second, content).rounds).toBe(2);
  });
});

describe('обещание фонду', () => {
  const promised = (): GameState => run(open(live(), 'fund'), { type: 'closeRound' });

  it('после сделки с фондом видно обещание: какой нужен доход и к какому сроку', () => {
    const s = promised();
    expect(fundingView(s, content).promise).toMatchObject({ investor: 'fund', now: 30_000, target: 60_000, progress: 0, daysLeft: 360, penaltyPct: 5 });
    expect(fundingView(earning(s, 1500), content).promise!.progress).toBeCloseTo(0.5, 6);
    // Пока обещание не выполнено, второй фонд не позвать — даже когда перерыв прошёл.
    const later = { ...s, day: s.day + cfg.cooldownClosed, energy: 100 };
    expect(fundingView(later, content).investors.map((i) => i.blocked)).toEqual([null, 'promise', null]);
  });

  it('доход вырос до обещанного — обещание выполнено: репутация растёт, позиция на переговорах сильнее', () => {
    const s = promised();
    const kept = tick(earning(s, 2000), quiet);
    const same = tick(earning({ ...s, funding: { ...s.funding!, promise: null } }, 2000), quiet);
    expect(kept.funding).toMatchObject({ promise: null, kept: 1, broken: 0 });
    expect(kept.reputation - same.reputation).toBeCloseTo(investor('fund').promise!.keptReputation, 6);
    expect(kept.founderShare).toBe(s.founderShare);
    expect((kept.news ?? []).some((n) => n.kind === 'funding' && n.id === 'promiseKept')).toBe(true);
    expect(fundingPosition(kept).reasons).toContainEqual({ id: 'promises', sign: 1 });
  });

  it('срок вышел, а дохода нет — фонд забирает часть доли, репутация падает, позиция слабее', () => {
    const s = promised();
    const due = s.funding!.promise!.dueDay;
    const before = tick({ ...s, day: due - 2 }, quiet);
    expect(before.funding!.promise).not.toBeNull();
    const broken = tick({ ...s, day: due - 1 }, quiet);
    const same = tick({ ...s, day: due - 1, funding: { ...s.funding!, promise: null } }, quiet);
    expect(broken.funding).toMatchObject({ promise: null, kept: 0, broken: 1 });
    expect(broken.founderShare).toBeCloseTo(s.founderShare! * (1 - investor('fund').promise!.penaltyShare), 4);
    expect(broken.reputation - same.reputation).toBeCloseTo(investor('fund').promise!.brokenReputation, 6);
    expect((broken.news ?? []).find((n) => n.kind === 'funding')).toMatchObject({ id: 'promiseBroken', tone: 'bad', value: 5 });
    expect(fundingPosition(broken).reasons).toContainEqual({ id: 'promises', sign: -1 });
  });
});

describe('выкуп доли', () => {
  it('долю можно выкупить обратно — дороже оценки', () => {
    const sold = { ...run(open(live(), 'fund'), { type: 'closeRound' }), cash: 1e6 };
    const view = fundingView(sold, content).buyback;
    expect(view.options.map((o) => o.sharePct)).toEqual([1, 5]);
    expect(view.options[0]).toMatchObject({ cost: round100(v(sold) * cfg.buybackPrice * 0.01), blocked: null });
    const back = run(sold, { type: 'buyBack', share: 0.05 });
    expect(back.founderShare).toBeCloseTo(0.85, 6);
    expect(back.cash).toBe(sold.cash - view.options[1]!.cost);
    expect((back.news ?? []).at(-1)).toMatchObject({ kind: 'funding', id: 'buyback', value: 5 });
  });

  it('продать и тут же выкупить — не заработать, даже после самого удачного торга', () => {
    let s = open({ ...live(), cash: 1e6 }, 'strategic');
    for (let i = 0; i < 6; i++) {
      const next = applyCommand(s, { type: 'counterOffer', stance: 'press' }, rigged(true));
      if (next.ok) s = next.state;
    }
    let after = run(s, { type: 'closeRound' });
    for (let i = 0; i < 4; i++) after = run(after, { type: 'buyBack', share: 0.05 });
    expect(after.founderShare).toBe(1);
    expect(after.cash).toBeLessThanOrEqual(1e6);
  });

  it('больше ста процентов не выкупить; без денег, во время переговоров и произвольной частью — нельзя', () => {
    expect(fundingView(live(), content).buyback.options.every((o) => o.blocked === 'full')).toBe(true);
    expect(applyCommand(live(), { type: 'buyBack', share: 0.01 }, content).ok).toBe(false);
    const almost = { ...live({ founderShare: 0.98 }), cash: 1e7 };
    expect(fundingView(almost, content).buyback.options[1]).toMatchObject({ sharePct: 2 });
    expect(run(almost, { type: 'buyBack', share: 0.05 }).founderShare).toBe(1);
    const poor = live({ founderShare: 0.8, cash: 10 });
    expect(fundingView(poor, content).buyback.options.map((o) => o.blocked)).toEqual(['cash', 'cash']);
    expect(applyCommand(poor, { type: 'buyBack', share: 0.01 }, content).ok).toBe(false);
    expect(applyCommand({ ...almost, founderShare: 0.5 }, { type: 'buyBack', share: 0.3 }, content).ok).toBe(false);
    const talking = open({ ...live({ founderShare: 0.8 }), cash: 1e7 }, 'angels');
    expect(fundingView(talking, content).buyback.options[0]!.blocked).toBe('talks');
    expect(applyCommand(talking, { type: 'buyBack', share: 0.01 }, content).ok).toBe(false);
  });
});

describe('надёжность', () => {
  it('партия без раундов идёт точно как раньше, поле в сохранении не появляется', () => {
    let s = live();
    for (let i = 0; i < 40; i++) s = tick(s, quiet);
    expect(s.funding).toBeUndefined();
  });

  it('торг не сдвигает случайность партии', () => {
    const s = live();
    const talked = run(run(open(s, 'angels'), { type: 'counterOffer', stance: 'press' }), { type: 'leaveRound' });
    expect(talked.rng).toBe(s.rng);
    expect(tick({ ...talked, energy: s.energy }, quiet).rng).toBe(tick(s, quiet).rng);
  });

  it('старое сохранение открывается; сводка и команды не меняют исходное состояние', () => {
    const old = live();
    delete old.funding;
    delete old.founderShare;
    expect(fundingView(old, content)).toMatchObject({ founderSharePct: 100, talks: null, promise: null, last: null, rounds: 0, kept: 0, broken: 0 });
    expect(fundingView(old, content).stakeValue).toBe(v(old));
    const frozen = deepFreeze(live());
    fundingView(frozen, content);
    const talking = deepFreeze(open(frozen, 'fund'));
    run(talking, { type: 'counterOffer', stance: 'ask' });
    run(talking, { type: 'closeRound' });
  });
});
