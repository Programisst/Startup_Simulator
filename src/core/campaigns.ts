// Маркетинговые акции: разовая ставка с риском. Описание — docs/02-economy.md, раздел 26.

import { clamp } from './formulas';
import { energyOf } from './founder';
import { createRng, nextFloat } from './rng';
import type { CampaignDef, CampaignOutcome, CampaignsState, GameConfig, GameState, MarketingConfig, NewsItem } from './types';

/** Сдвиг seed, чтобы исходы акций не совпадали с остальной случайностью партии. */
const CAMPAIGN_SEED_SALT = 0x51ed270b;
const OUTCOMES: CampaignOutcome[] = ['fail', 'ok', 'hit'];

/** Состояние акций; в старых сохранениях и до первой акции его нет. */
export function campaignsOf(s: GameState): CampaignsState {
  return s.campaigns ?? { rng: createRng(s.seed ^ CAMPAIGN_SEED_SALT), active: null, finishedDay: {}, last: null };
}

/** Цена акции сейчас: у выросшей компании охват больше, и стоит он дороже. */
export function campaignCost(s: GameState, def: CampaignDef): number {
  const revenue = s.recentDays.slice(-30).reduce((sum, d) => sum + d.revenue, 0);
  return Math.max(def.baseCost, Math.round((revenue * def.revenueShare) / 50) * 50);
}

/** Шансы исходов для этой партии, в долях (в сумме 1): плохой продукт и неподходящая акция чаще проваливаются. */
export function campaignOdds(s: GameState, def: CampaignDef, cfg: MarketingConfig): Record<CampaignOutcome, number> {
  const fit = cfg.businessTypes.includes(s.productType) ? def.fit.business : def.fit.consumer;
  const skill = clamp(s.quality / cfg.campaignQualityRef, 0.4, 1.5) * fit;
  const w = { fail: def.weights.fail / skill, ok: def.weights.ok, hit: def.weights.hit * skill };
  const total = w.fail + w.ok + w.hit;
  return total > 0 ? { fail: w.fail / total, ok: w.ok / total, hit: w.hit / total } : { fail: 1, ok: 0, hit: 0 };
}

export type CampaignBlock = 'notLaunched' | 'busy' | 'cooldown' | 'quality' | 'cash' | 'energy';

/** Почему акцию нельзя запустить прямо сейчас; null — можно. */
export function campaignBlock(s: GameState, def: CampaignDef): CampaignBlock | null {
  const st = campaignsOf(s);
  if (!s.launched) return 'notLaunched';
  if (st.active) return 'busy';
  const finished = st.finishedDay[def.id];
  if (finished !== undefined && s.day < finished + def.cooldownDays) return 'cooldown';
  if (s.quality < (def.minQuality ?? 0)) return 'quality';
  if (s.cash < campaignCost(s, def)) return 'cash';
  if (energyOf(s) < (def.energyCost ?? 0)) return 'energy';
  return null;
}

/** Запускает акцию: деньги и силы уходят сразу. Возвращает null, если запустить нельзя. */
export function startCampaign(s: GameState, def: CampaignDef): GameState | null {
  if (campaignBlock(s, def) !== null) return null;
  const cost = campaignCost(s, def);
  const st = campaignsOf(s);
  return {
    ...s,
    cash: Math.round((s.cash - cost) * 100) / 100,
    ...(def.energyCost ? { energy: Math.max(0, energyOf(s) - def.energyCost) } : {}),
    campaigns: { ...st, active: { id: def.id, endsDay: s.day + def.days, cost } },
  };
}

/** Шаг дня: если акция закончилась — бросаем жребий и применяем исход. Меняет черновик состояния. */
export function stepCampaigns(s: GameState, config: GameConfig): void {
  const st = s.campaigns;
  if (!st?.active || s.day < st.active.endsDay) return;
  const def = config.marketing.campaigns.find((c) => c.id === st.active!.id);
  const next: CampaignsState = { ...st, active: null, finishedDay: { ...st.finishedDay, [st.active.id]: s.day } };
  s.campaigns = next;
  if (!def) return;

  const odds = campaignOdds(s, def, config.marketing);
  const roll = nextFloat(st.rng);
  next.rng = roll.next;
  const outcome: CampaignOutcome = roll.value < odds.fail ? 'fail' : roll.value < odds.fail + odds.ok ? 'ok' : 'hit';
  next.last = { id: def.id, day: s.day, outcome };

  const result = def.results[outcome] ?? {};
  if (result.factor && result.days) s.modifiers = [...s.modifiers, { target: 'acquisition', factor: result.factor, untilDay: s.day + result.days }];
  if (result.reputation) s.reputation = clamp(s.reputation + result.reputation, 0, 100);
  const tone: NewsItem['tone'] = outcome === 'hit' ? 'good' : outcome === 'ok' ? 'mixed' : 'bad';
  s.news = [...(s.news ?? []), { day: s.day, kind: 'campaign' as const, id: def.id, tone, value: Math.round(((result.factor ?? 1) - 1) * 100) }].slice(-40);
}

export interface CampaignView {
  id: string;
  cost: number;
  energyCost: number;
  days: number;
  /** Шансы в процентах, в сумме 100 */
  odds: Record<CampaignOutcome, number>;
  /** Что даёт каждый исход: прибавка к притоку в процентах, на сколько дней, сдвиг репутации */
  results: Record<CampaignOutcome, { boostPct: number; days: number; reputation: number }>;
  fit: 'good' | 'ok' | 'poor';
  blocked: CampaignBlock | null;
  /** Сколько дней ждать до повторного запуска (0 — можно) */
  cooldownDaysLeft: number;
  minQuality: number;
}

export interface CampaignsView {
  list: CampaignView[];
  active: { id: string; daysLeft: number; cost: number } | null;
  last: { id: string; day: number; outcome: CampaignOutcome } | null;
}

/** Всё, что экрану нужно знать об акциях. Состояние не меняет. */
export function campaignsView(s: GameState, config: GameConfig): CampaignsView {
  const cfg = config.marketing;
  const st = campaignsOf(s);
  const business = cfg.businessTypes.includes(s.productType);
  const list = cfg.campaigns.map((def): CampaignView => {
    const odds = campaignOdds(s, def, cfg);
    const fail = Math.round(odds.fail * 100);
    const hit = Math.round(odds.hit * 100);
    const fit = business ? def.fit.business : def.fit.consumer;
    const finished = st.finishedDay[def.id];
    const results = Object.fromEntries(
      OUTCOMES.map((o) => {
        const r = def.results[o] ?? {};
        return [o, { boostPct: Math.round(((r.factor ?? 1) - 1) * 100), days: r.days ?? 0, reputation: r.reputation ?? 0 }];
      }),
    ) as CampaignView['results'];
    return {
      id: def.id,
      cost: campaignCost(s, def),
      energyCost: def.energyCost ?? 0,
      days: def.days,
      odds: { fail, hit, ok: 100 - fail - hit },
      results,
      fit: fit > 1.1 ? 'good' : fit < 0.9 ? 'poor' : 'ok',
      blocked: campaignBlock(s, def),
      cooldownDaysLeft: finished === undefined ? 0 : Math.max(0, finished + def.cooldownDays - s.day),
      minQuality: def.minQuality ?? 0,
    };
  });
  return { list, active: st.active ? { id: st.active.id, daysLeft: Math.max(0, st.active.endsDay - s.day), cost: st.active.cost } : null, last: st.last };
}
