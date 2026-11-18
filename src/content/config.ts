// Общие настройки игры. Числа подбираются прогоном баланса (npm run balance).
import type { GameConfig } from '../core/types';

export const config: GameConfig = {
  startReputation: 20,
  startCapacity: 100,
  capacityTiers: [
    100, 250, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000,
    2_000_000, 5_000_000, 10_000_000, 20_000_000,
  ],
  toolsCostPerMonth: 40,
  paymentFee: 0.03,
  founderSkill: 1,
  rushSpeed: 1.4,
  bugfixCost: 2,
  refactorCost: 1.5,
  polishCost: 10,
  polishValue: 2,
  sideJobShares: [0, 0.25, 0.5, 0.75, 1],
  expectationGrowthPerMonth: 0.015,
  eventMinGapDays: 10,
  eventDailyChance: 0.08,
  bankruptcyDays: 30,
  goalProfitPerMonth: 3000,
  goalProfitMonths: 3,
  goalValuation: 10_000_000,
  marketVariation: 0.15,
};
