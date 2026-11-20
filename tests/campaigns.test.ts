// Маркетинговые акции: разовая ставка с риском вместо ровного бюджета.
import { describe, expect, it } from 'vitest';
import { applyCommand, campaignCost, campaignOdds, campaignsView, tick, type CampaignDef, type CampaignOutcome, type GameContent, type GameState } from '../src/core';
import { content } from '../src/content';
import ru from '../src/content/ru/ui.json';
import { deepFreeze, launchedGame, newGame, run } from './helpers';

const mk = content.config.marketing;
const quiet: GameContent = { ...content, events: [], milestones: [] };
const def = (id: string): CampaignDef => mk.campaigns.find((c) => c.id === id)!;
const live = (over: Partial<GameState> = {}): GameState => ({ ...launchedGame(), cash: 100_000, capacity: 1e6, users: 1000, quality: 60, modifiers: [], ...over });
const start = (s: GameState, campaignId: string): GameState => run(s, { type: 'runCampaign', campaignId });
const days = (s: GameState, n: number): GameState => {
  let x = s;
  for (let i = 0; i < n; i++) x = tick(x, quiet);
  return x;
};
/** Доводит акцию до результата. */
const finish = (s: GameState, id: string): GameState => days(start(s, id), def(id).days + 1);
const view = (s: GameState, id: string) => campaignsView(s, content.config).list.find((c) => c.id === id)!;

describe('список акций', () => {
  it('у каждой есть название, пояснение и исходы «сработает» и «выстрелит»', () => {
    const texts = (ru as unknown as { marketing: { campaigns: { items: Record<string, { name: string; hint: string }> } } }).marketing.campaigns.items;
    expect(mk.campaigns.length).toBeGreaterThanOrEqual(5);
    for (const c of mk.campaigns) {
      expect(texts[c.id]!.name.length, c.id).toBeGreaterThan(3);
      expect(texts[c.id]!.hint.length, c.id).toBeGreaterThan(20);
      expect(c.results.ok!.factor!, c.id).toBeGreaterThan(1);
      expect(c.results.hit!.factor!, c.id).toBeGreaterThan(c.results.ok!.factor!);
      expect(c.days, c.id).toBeGreaterThan(0);
      expect(c.cooldownDays, c.id).toBeGreaterThan(c.days);
    }
  });

  it('шансы в сводке — целые проценты, в сумме ровно 100', () => {
    for (const quality of [5, 40, 60, 99]) {
      for (const c of campaignsView(live({ quality }), content.config).list) {
        expect(c.odds.fail + c.odds.ok + c.odds.hit, c.id).toBe(100);
        for (const o of ['fail', 'ok', 'hit'] as CampaignOutcome[]) expect(c.odds[o], c.id).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('запуск', () => {
  it('деньги уходят сразу, результат — позже', () => {
    const s = live();
    const cost = campaignCost(s, def('blogger'));
    const started = start(s, 'blogger');
    expect(started.cash).toBe(s.cash - cost);
    expect(campaignsView(started, content.config).active).toMatchObject({ id: 'blogger', daysLeft: def('blogger').days, cost });
    expect(started.campaigns!.last).toBeNull();
    expect(days(started, def('blogger').days - 1).campaigns!.active).not.toBeNull();
    const done = days(started, def('blogger').days + 1);
    expect(done.campaigns!.active).toBeNull();
    expect(done.campaigns!.last).toMatchObject({ id: 'blogger' });
  });

  it('одновременно идёт только одна акция', () => {
    const started = start(live(), 'blogger');
    expect(view(started, 'giveaway').blocked).toBe('busy');
    expect(applyCommand(started, { type: 'runCampaign', campaignId: 'giveaway' }, content)).toEqual({ ok: false, error: 'campaignUnavailable' });
  });

  it('ту же акцию нельзя повторить сразу, другую — можно', () => {
    const done = finish(live(), 'blogger');
    expect(view(done, 'blogger').blocked).toBe('cooldown');
    expect(view(done, 'blogger').cooldownDaysLeft).toBeGreaterThan(30);
    expect(view(done, 'giveaway').blocked).toBeNull();
    expect(view(days(done, def('blogger').cooldownDays), 'blogger').blocked).toBeNull();
  });

  it('до запуска продукта, без денег, с плохим продуктом и без сил — нельзя', () => {
    expect(view({ ...newGame(), cash: 1e6 }, 'blogger').blocked).toBe('notLaunched');
    expect(view(live({ cash: 10 }), 'blogger').blocked).toBe('cash');
    expect(view(live({ quality: def('showcase').minQuality! - 1 }), 'showcase').blocked).toBe('quality');
    expect(view(live({ energy: 5 }), 'showcase').blocked).toBe('energy');
    expect(applyCommand(live(), { type: 'runCampaign', campaignId: 'нет такой' }, content)).toEqual({ ok: false, error: 'campaignUnavailable' });
  });

  it('витрина новинок стоит сил, а не денег', () => {
    const s = live({ energy: 80 });
    const started = start(s, 'showcase');
    expect(started.cash).toBe(s.cash);
    expect(started.energy).toBe(80 - def('showcase').energyCost!);
  });

  it('у выросшей компании акция дороже', () => {
    const small = live();
    const big = live({ recentDays: Array.from({ length: 30 }, (_, i) => ({ day: i, cash: 0, users: 0, paying: 0, revenue: 10_000, expenses: 0 })) });
    expect(campaignCost(small, def('blogger'))).toBe(def('blogger').baseCost);
    expect(campaignCost(big, def('blogger'))).toBe(300_000 * def('blogger').revenueShare);
  });
});

describe('шансы', () => {
  it('чем лучше продукт, тем реже провал и чаще успех', () => {
    const bad = campaignOdds(live({ quality: 20 }), def('blogger'), mk);
    const good = campaignOdds(live({ quality: 90 }), def('blogger'), mk);
    expect(good.fail).toBeLessThan(bad.fail);
    expect(good.hit).toBeGreaterThan(bad.hit);
  });

  it('блогер лучше для массового продукта, конференция — для делового', () => {
    const consumer = live({ productType: 'mobile' });
    const business = live({ productType: 'saas' });
    expect(campaignOdds(consumer, def('blogger'), mk).hit).toBeGreaterThan(campaignOdds(business, def('blogger'), mk).hit);
    expect(campaignOdds(business, def('conference'), mk).hit).toBeGreaterThan(campaignOdds(consumer, def('conference'), mk).hit);
    expect(view(consumer, 'blogger').fit).toBe('good');
    expect(view(consumer, 'conference').fit).toBe('poor');
  });

  it('на многих партиях исходы выпадают примерно с обещанной частотой', () => {
    const count: Record<CampaignOutcome, number> = { fail: 0, ok: 0, hit: 0 };
    const N = 400;
    for (let seed = 1; seed <= N; seed++) count[finish(live({ seed: seed * 7919 }), 'stunt').campaigns!.last!.outcome]++;
    // Жребий бросается в день результата — по качеству продукта на тот момент.
    const odds = campaignOdds(days(live(), def('stunt').days), def('stunt'), mk);
    for (const o of ['fail', 'ok', 'hit'] as CampaignOutcome[]) expect(Math.abs(count[o] / N - odds[o]), o).toBeLessThan(0.08);
  });
});

describe('исход', () => {
  /** Партия, где акция закончилась нужным исходом (перебором seed). */
  const withOutcome = (id: string, outcome: CampaignOutcome): { before: GameState; after: GameState } => {
    for (let seed = 1; seed < 500; seed++) {
      const before = live({ seed });
      const after = finish(before, id);
      if (after.campaigns!.last!.outcome === outcome) return { before, after };
    }
    throw new Error(`исход ${outcome} не выпал`);
  };

  it('«выстрелило» — приток вырастает в разы, растёт репутация, в ленте новость', () => {
    const { after } = withOutcome('stunt', 'hit');
    const boost = after.modifiers.find((m) => m.target === 'acquisition');
    expect(boost?.factor).toBe(def('stunt').results.hit!.factor);
    const item = (after.news ?? []).find((n) => n.kind === 'campaign');
    expect(item).toMatchObject({ id: 'stunt', tone: 'good', value: (def('stunt').results.hit!.factor! - 1) * 100 });
  });

  it('пока действует успех, людей приходит заметно больше', () => {
    const { after } = withOutcome('blogger', 'hit');
    const calm: GameState = { ...after, modifiers: [] };
    expect(tick(after, quiet).lastDay.newUsers).toBeGreaterThan(tick(calm, quiet).lastDay.newUsers * 2);
    const later = days(after, def('blogger').results.hit!.days! + 2);
    expect(later.modifiers.filter((m) => m.target === 'acquisition')).toHaveLength(0);
  });

  it('провал ролика бьёт по репутации, провал обзора — просто потерянные деньги', () => {
    const stunt = withOutcome('stunt', 'fail');
    expect(stunt.after.modifiers).toHaveLength(0);
    expect((stunt.after.news ?? []).find((n) => n.kind === 'campaign')).toMatchObject({ tone: 'bad' });
    const same = days(stunt.before, def('stunt').days + 1);
    expect(stunt.after.reputation).toBeLessThan(same.reputation - 2);
    expect(withOutcome('blogger', 'fail').after.modifiers).toHaveLength(0);
  });
});

describe('надёжность', () => {
  it('исходы акций не сдвигают остальную случайность партии', () => {
    const plain = days(live(), 30);
    const withCampaign = days(start(live(), 'giveaway'), 30);
    expect(withCampaign.rng).toBe(plain.rng);
  });

  it('одинаковая партия даёт одинаковый исход', () => {
    expect(finish(live({ seed: 42 }), 'blogger').campaigns).toEqual(finish(live({ seed: 42 }), 'blogger').campaigns);
  });

  it('старое сохранение без акций открывается; сводка и запуск не меняют исходное состояние', () => {
    const old = live();
    delete old.campaigns;
    expect(campaignsView(old, content.config)).toMatchObject({ active: null, last: null });
    expect(tick(old, quiet).campaigns).toBeUndefined();
    const frozen = deepFreeze(live());
    campaignsView(frozen, content.config);
    start(frozen, 'blogger');
  });
});
