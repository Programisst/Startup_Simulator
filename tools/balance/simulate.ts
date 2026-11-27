// Общий код прогонов: одна автоматическая партия и сводка по многим партиям.
// Используется и командой npm run balance, и тестами баланса.
import { applyCommand, createGame, tick, type BusinessModel, type DifficultyId, type GameState, type ProductTypeId } from '../../src/core';
import { content } from '../../src/content';
import type { Strategy } from './strategies';

export const MAX_DAYS = 5 * 360;
export const PRODUCT_TYPES = Object.keys(content.productTypes) as ProductTypeId[];

export const defaultModel: Record<ProductTypeId, BusinessModel> = {
  saas: 'subscription',
  social: 'ads',
  mobile: 'subscription',
  ai: 'subscription',
  marketplace: 'commission',
  devtools: 'subscription',
  game: 'ads',
};

/** cityId — город партии; без него всё как в среднем по стране (так настроен баланс). */
export function play(productType: ProductTypeId, strategy: Strategy, seed: number, difficulty: DifficultyId, cityId?: string): GameState {
  let s = createGame(
    {
      seed,
      companyName: 'Bot Inc',
      productType,
      audienceId: content.productTypes[productType].audiences[0]!.id,
      businessModel: defaultModel[productType],
      goal: 'profit',
      difficulty,
      // Темы идут по кругу: баланс проверяется на всех, а не на «партии без темы».
      themeId: content.themes[Math.abs(seed) % content.themes.length]?.id,
      ...(cityId ? { cityId } : {}),
    },
    content,
  );
  while (s.status === 'running' && s.day < MAX_DAYS) {
    for (const cmd of strategy(s, content)) {
      const result = applyCommand(s, cmd, content);
      if (result.ok) s = result.state;
    }
    s = tick(s, content);
  }
  return s;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

export interface Summary {
  games: number;
  /** Доля партий, где цель достигнута */
  won: number;
  /** Доля партий, закончившихся банкротством */
  bankrupt: number;
  /** Доля партий, где компания не обанкротилась за 5 лет (победа или ещё жива) */
  survived: number;
  /** Медианный день банкротства среди обанкротившихся; null, если таких нет */
  medianBankruptDay: number | null;
}

export function summarize(results: GameState[]): Summary {
  const games = results.length;
  const bankruptDays = results.filter((r) => r.status === 'bankrupt').map((r) => r.day);
  const won = results.filter((r) => r.status === 'won').length;
  return {
    games,
    won: won / games,
    bankrupt: bankruptDays.length / games,
    survived: 1 - bankruptDays.length / games,
    medianBankruptDay: bankruptDays.length > 0 ? median(bankruptDays) : null,
  };
}

/** Прогон стратегии по всем типам продукта: gamesPerType партий на каждый тип. */
export function runAll(strategy: Strategy, difficulty: DifficultyId, gamesPerType: number, cityId?: string): GameState[] {
  const results: GameState[] = [];
  for (const productType of PRODUCT_TYPES) {
    for (let i = 0; i < gamesPerType; i++) results.push(play(productType, strategy, 1000 + i, difficulty, cityId));
  }
  return results;
}
