// Создание новой партии.

import { pickFeatures, themeOf } from './features';
import { cleanIdea } from './idea';
import { createRng, nextRange } from './rng';
import { createTeam } from './team';
import type { DayBreakdown, GameContent, GameState, Market, NewGameSetup } from './types';

export const EMPTY_DAY: DayBreakdown = {
  paid: 0,
  organic: 0,
  viral: 0,
  newUsers: 0,
  churned: 0,
  converted: 0,
  revenue: 0,
  serverCost: 0,
  adCost: 0,
  toolsCost: 0,
  feeCost: 0,
  loanCost: 0,
  livingCost: 0,
  rentCost: 0,
  salaryCost: 0,
  sideIncome: 0,
  expenses: 0,
};

export function createGame(setup: NewGameSetup, content: GameContent): GameState {
  const type = content.productTypes[setup.productType];
  const audience = type.audiences.find((a) => a.id === setup.audienceId) ?? type.audiences[0];
  if (!audience) throw new Error(`У типа продукта ${type.id} нет ни одной аудитории`);

  // Рынок каждой партии немного отличается от базового: это часть seed, а не решений игрока.
  const difficulty = content.difficulties[setup.difficulty];
  const v = content.config.marketVariation;
  const fitRoll = nextRange(createRng(setup.seed), 1 - v, 1 + v);
  const cacRoll = nextRange(fitRoll.next, 1 - v, 1 + v);
  const churnRoll = nextRange(cacRoll.next, 1 - v, 1 + v);

  // Тема сдвигает рынок по-своему: где-то дороже привлекать, где-то чаще уходят.
  const theme = themeOf(setup.themeId, content);
  const tm = theme?.market ?? {};
  const market: Market = {
    marketSize: type.marketSize * audience.marketFactor * (tm.marketSize ?? 1),
    cacBase: type.cacBase * cacRoll.value * difficulty.marketHarshness * (tm.cac ?? 1),
    churnBase: type.churnBase * churnRoll.value * difficulty.marketHarshness * (tm.churn ?? 1),
    convBase: type.convBase * (tm.conv ?? 1),
    priceRef: type.priceRef * audience.priceFactor * (tm.price ?? 1),
    viralBase: type.viralBase * (tm.viral ?? 1),
    organicBase: type.organicBase * (tm.organic ?? 1),
    serverCostPerUser: type.serverCostPerUser,
    adRevenuePerUser: type.adRevenuePerUser,
    commissionPerUser: type.commissionPerUser,
    competition: type.competition,
    fit: audience.fit * fitRoll.value,
    expectation0: type.expectation0,
    userValue: type.userValue,
  };

  const idea = cleanIdea(setup.idea ?? '');
  const needsPrice = setup.businessModel === 'subscription' || setup.businessModel === 'oneTime';

  return {
    version: 1,
    seed: setup.seed,
    rng: churnRoll.next,
    day: 0,
    status: 'running',
    goal: setup.goal,
    difficulty: difficulty.id,
    livingCostPerMonth: difficulty.livingCostPerMonth,
    sideJobIncomePerMonth: difficulty.sideJobIncomePerMonth,
    sideJobShare: 0,
    companyName: setup.companyName,
    ...(idea ? { idea } : {}),
    ...(theme ? { themeId: theme.id, featureIds: pickFeatures(setup.seed, setup.productType, theme.id, content) } : {}),
    productType: setup.productType,
    audienceId: audience.id,
    businessModel: setup.businessModel,
    market,
    cash: difficulty.startCash,
    users: 0,
    paying: 0,
    quality: 0,
    reputation: content.config.startReputation,
    scandal: 0,
    debt: 0,
    bugs: 0,
    capacity: content.config.startCapacity,
    price: needsPrice ? market.priceRef : 0,
    adSpendPerDay: 0,
    launched: false,
    launchDay: null,
    doneFeatures: [],
    polish: 0,
    tasks: [],
    rush: false,
    team: createTeam(setup.seed, content),
    modifiers: [],
    loans: [],
    negativeCashDays: 0,
    profitableMonthsInRow: 0,
    pendingEvent: null,
    lastEventDay: 0,
    eventLog: [],
    lastDay: EMPTY_DAY,
    recentDays: [],
    monthRevenue: 0,
    monthExpenses: 0,
    monthSideIncome: 0,
    months: [],
  };
}
