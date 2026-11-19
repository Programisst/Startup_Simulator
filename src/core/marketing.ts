// Рекламные каналы: куда уходит бюджет и что он приносит. Описание — docs/02-economy.md, раздел 24.

import { cac } from './formulas';
import type { ChannelDef, ChannelId, GameConfig, GameState, MarketingConfig } from './types';

/** Бюджет канала в день. Поиск хранится в прежнем поле adSpendPerDay — так старые сохранения и команды работают без изменений. */
export function channelSpend(s: GameState, id: ChannelId): number {
  return id === 'search' ? s.adSpendPerDay : (s.adChannels?.[id] ?? 0);
}

export function totalAdSpend(s: Pick<GameState, 'adSpendPerDay' | 'adChannels'>): number {
  return s.adSpendPerDay + Object.values(s.adChannels ?? {}).reduce((sum, v) => sum + (v ?? 0), 0);
}

/** Какая часть бюджета работает: чем больше льёшь в один канал, тем хуже отдача. При бюджете halfAt — половина. */
export function channelEfficiency(spend: number, def: ChannelDef): number {
  return spend <= 0 ? 1 : 1 / (1 + spend / def.halfAt);
}

/** Во сколько раз пользователь из канала дороже или дешевле обычного для этого типа продукта. */
export function channelCostFactor(s: Pick<GameState, 'productType'>, def: ChannelDef, cfg: MarketingConfig): number {
  return cfg.businessTypes.includes(s.productType) ? def.costFactor.business : def.costFactor.consumer;
}

/** Сколько пользователей в день канал приводит в среднем (без случайного разброса и общих множителей притока). */
export function channelUsersPerDay(s: GameState, def: ChannelDef, cfg: MarketingConfig, spend = channelSpend(s, def.id)): number {
  if (def.kind !== 'direct' || spend <= 0) return 0;
  return (spend * channelEfficiency(spend, def)) / (cac(s.market, s.users) * channelCostFactor(s, def, cfg));
}

/** Множитель притока «нашли сами» от накопленных статей: 1 — статей нет. */
export function contentBoost(s: GameState, cfg: MarketingConfig): number {
  return 1 + Math.min(cfg.contentCap, (s.contentStock ?? 0) / cfg.contentPerDouble);
}

/** Запас статей на завтра: вложенное сегодня добавляется (с убывающей отдачей), старое понемногу устаревает. */
export function contentStockAfterDay(s: GameState, cfg: MarketingConfig, spendToday: number): number {
  const def = cfg.channels.find((c) => c.kind === 'content');
  const added = def ? spendToday * channelEfficiency(spendToday, def) : 0;
  return Math.max(0, ((s.contentStock ?? 0) + added) * (1 - cfg.contentDecayPerDay));
}

export interface ChannelView {
  id: ChannelId;
  kind: ChannelDef['kind'];
  spendPerDay: number;
  /** Доля бюджета, которая работает, 0…1 */
  efficiency: number;
  /** Сколько людей в день приводит при нынешнем бюджете (для статей — 0: они работают через запас) */
  usersPerDay: number;
  /** Во что обходится один пользователь при нынешнем бюджете; null — канал не приводит людей напрямую или выключен */
  costPerUser: number | null;
  /** Цена пользователя при самом маленьком бюджете — чтобы сравнивать каналы до того, как в них вложились */
  baseCostPerUser: number | null;
  /** Насколько канал подходит этому продукту: дешевле обычного, как обычно, дороже */
  fit: 'good' | 'ok' | 'poor';
  /** Сильно ли результат гуляет изо дня в день */
  unpredictable: boolean;
}

export interface MarketingView {
  channels: ChannelView[];
  totalPerDay: number;
  totalPerMonth: number;
  /** Запас статей в долларах вложений и прибавка к «нашли сами», которую он даёт сейчас (0.4 = +40%) */
  contentStock: number;
  contentBoost: number;
  contentCap: number;
}

/** Всё, что экрану маркетинга нужно знать о каналах. Состояние не меняет. */
export function marketingView(s: GameState, config: GameConfig): MarketingView {
  const cfg = config.marketing;
  const base = cac(s.market, s.users);
  const channels: ChannelView[] = cfg.channels.map((def) => {
    const spend = channelSpend(s, def.id);
    const factor = channelCostFactor(s, def, cfg);
    const users = channelUsersPerDay(s, def, cfg);
    const direct = def.kind === 'direct';
    return {
      id: def.id,
      kind: def.kind,
      spendPerDay: spend,
      efficiency: channelEfficiency(spend, def),
      usersPerDay: users,
      costPerUser: direct && users > 0 ? spend / users : null,
      baseCostPerUser: direct ? base * factor : null,
      fit: factor < 0.9 ? 'good' : factor > 1.1 ? 'poor' : 'ok',
      unpredictable: def.noise >= 0.3,
    };
  });
  const totalPerDay = totalAdSpend(s);
  return { channels, totalPerDay, totalPerMonth: totalPerDay * 30, contentStock: s.contentStock ?? 0, contentBoost: contentBoost(s, cfg) - 1, contentCap: cfg.contentCap };
}
