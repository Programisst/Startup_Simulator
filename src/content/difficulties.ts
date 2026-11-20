// Уровни сложности. Меняют стартовые условия, формулы остаются теми же.
// Правило для всех уровней: подработка на полный день приносит меньше, чем стоит жизнь.
// Без продукта компания всегда умирает, подработка только оттягивает конец.
// Числа подобраны прогонами (npm run balance -- 200 all), объяснение — docs/02-economy.md, разделы 15 и 32.
// «Сложная» настроена как в жизни: у грамотного игрока разоряется примерно каждая вторая компания.
import type { DifficultyDef, DifficultyId } from '../core/types';

export const difficulties: Record<DifficultyId, DifficultyDef> = {
  easy: { id: 'easy', startCash: 5000, livingCostPerMonth: 700, sideJobIncomePerMonth: 600, marketHarshness: 0.95 },
  normal: { id: 'normal', startCash: 3000, livingCostPerMonth: 800, sideJobIncomePerMonth: 700, marketHarshness: 1 },
  hard: { id: 'hard', startCash: 1800, livingCostPerMonth: 900, sideJobIncomePerMonth: 740, marketHarshness: 1.9, marketVariation: 0.5 },
};
