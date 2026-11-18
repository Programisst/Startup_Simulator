// Прогон баланса: много автоматических партий, итоговые таблицы.
// Запуск: npm run balance                 (200 партий на сочетание, обычная сложность)
//         npm run balance -- 1000 hard    (1000 партий, сложная)
//         npm run balance -- 200 all      (сводка по всем трём сложностям)

import { valuation, type DifficultyId, type GameState } from '../../src/core';
import { PRODUCT_TYPES, median, play, runAll, summarize } from './simulate';
import { strategies } from './strategies';

const GAMES = Number(process.argv[2] ?? 200);
const MODE = process.argv[3] ?? 'normal';
const pct = (x: number) => Math.round(x * 100);
const month = (day: number | null) => (day === null ? '—' : Math.round(day / 30));

function overview(difficulty: DifficultyId) {
  const rows: Record<string, string | number>[] = [];
  const perType = Math.max(1, Math.round(GAMES / PRODUCT_TYPES.length));
  for (const [name, strategy] of Object.entries(strategies)) {
    const s = summarize(runAll(strategy, difficulty, perType));
    rows.push({
      сложность: difficulty,
      стратегия: name,
      'победа %': pct(s.won),
      'выжила %': pct(s.survived),
      'банкрот %': pct(s.bankrupt),
      'месяц банкротства': month(s.medianBankruptDay),
    });
  }
  return rows;
}

if (MODE === 'all') {
  console.log(`Сводка по всем типам продукта, ${GAMES} партий на стратегию`);
  console.table([...overview('easy'), ...overview('normal'), ...overview('hard')]);
} else {
  const difficulty = MODE as DifficultyId;
  const rows: Record<string, string | number>[] = [];
  for (const productType of PRODUCT_TYPES) {
    for (const [name, strategy] of Object.entries(strategies)) {
      const results: GameState[] = [];
      for (let i = 0; i < GAMES; i++) results.push(play(productType, strategy, 1000 + i, difficulty));
      const s = summarize(results);
      rows.push({
        тип: productType,
        стратегия: name,
        'победа %': pct(s.won),
        'выжила %': pct(s.survived),
        'банкрот %': pct(s.bankrupt),
        'месяц банкротства': month(s.medianBankruptDay),
        пользователи: Math.round(median(results.map((r) => r.users))),
        качество: Math.round(median(results.map((r) => r.quality))),
        'оценка $тыс': Math.round(median(results.map((r) => valuation(r.months, r.users, r.market))) / 1000),
      });
    }
  }
  console.log(`Сложность: ${difficulty}, ${GAMES} партий на сочетание`);
  console.table(rows);
  console.table(overview(difficulty));
}
