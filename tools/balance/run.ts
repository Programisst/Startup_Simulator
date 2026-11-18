// Прогон баланса: много автоматических партий, итоговая таблица.
// Запуск: npm run balance            (200 партий на сочетание)
//         npm run balance -- 1000    (1000 партий на сочетание)

import { applyCommand, createGame, tick, valuation, type BusinessModel, type DifficultyId, type GameState, type ProductTypeId } from '../../src/core';
import { content } from '../../src/content';
import { strategies, type Strategy } from './strategies';

const GAMES = Number(process.argv[2] ?? 200);
const DIFFICULTY = (process.argv[3] ?? 'normal') as DifficultyId;
const MAX_DAYS = 5 * 360;

const defaultModel: Record<ProductTypeId, BusinessModel> = {
  saas: 'subscription',
  social: 'ads',
  mobile: 'subscription',
  ai: 'subscription',
  marketplace: 'commission',
  devtools: 'subscription',
};

function play(productType: ProductTypeId, strategy: Strategy, seed: number): GameState {
  let s = createGame(
    {
      seed,
      companyName: 'Bot Inc',
      productType,
      audienceId: content.productTypes[productType].audiences[0]!.id,
      businessModel: defaultModel[productType],
      goal: 'profit',
      difficulty: DIFFICULTY,
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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

const rows: Record<string, string | number>[] = [];
for (const productType of Object.keys(content.productTypes) as ProductTypeId[]) {
  for (const [name, strategy] of Object.entries(strategies)) {
    const results: GameState[] = [];
    for (let i = 0; i < GAMES; i++) results.push(play(productType, strategy, 1000 + i));
    const pct = (status: string) => Math.round((100 * results.filter((r) => r.status === status).length) / GAMES);
    rows.push({
      тип: productType,
      стратегия: name,
      'победа %': pct('won'),
      'банкрот %': pct('bankrupt'),
      'не успел %': pct('running'),
      'день конца': median(results.map((r) => r.day)),
      пользователи: Math.round(median(results.map((r) => r.users))),
      'прибыль/мес': Math.round(median(results.map((r) => r.months[r.months.length - 1]?.profit ?? 0))),
      качество: Math.round(median(results.map((r) => r.quality))),
      'оценка $тыс': Math.round(median(results.map((r) => valuation(r.months, r.users, r.market))) / 1000),
    });
  }
}
console.table(rows);
