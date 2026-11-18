// Уровни сложности. Меняют стартовые условия, формулы остаются теми же.
import type { DifficultyDef, DifficultyId } from '../core/types';

export const difficulties: Record<DifficultyId, DifficultyDef> = {
  easy: { id: 'easy', startCash: 6000, livingCostPerMonth: 500, sideJobIncomePerMonth: 1500, marketHarshness: 0.85 },
  normal: { id: 'normal', startCash: 3000, livingCostPerMonth: 800, sideJobIncomePerMonth: 1200, marketHarshness: 1 },
  hard: { id: 'hard', startCash: 2000, livingCostPerMonth: 1100, sideJobIncomePerMonth: 1400, marketHarshness: 1.2 },
};
