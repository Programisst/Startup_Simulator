// Шаг дня: берёт состояние и возвращает состояние на следующий день.
// Формулы — в formulas.ts, их описание — в docs/02-economy.md.

import { rollEvent } from './events';
import {
  DAYS_IN_MONTH,
  churnMonthly,
  churnPayingMonthly,
  clamp,
  conversionMonthly,
  expectation,
  monthlyToDaily,
  organicPerDay,
  overload,
  paidPerDay,
  quality,
  reputationTarget,
  valuation,
  viralPerDay,
} from './formulas';
import { nextInt, nextRange, type RngState } from './rng';
import { marketingBoost, payrollPerMonth, sloppyDevelopers, stepTeam, teamOf, teamWorkPerDay } from './team';
import type { DayBreakdown, GameContent, GameState, ModifierTarget, Task } from './types';

const RECENT_DAYS = 90;

function cents(x: number): number {
  return Math.round(x * 100) / 100;
}

function modifierFactor(s: GameState, target: ModifierTarget): number {
  let factor = 1;
  for (const m of s.modifiers) if (m.target === target) factor *= m.factor;
  return factor;
}

/** Сумма ценности готовых функций. */
export function featureScore(s: GameState, content: GameContent): number {
  const defs = content.features[s.productType];
  let score = s.polish;
  for (const id of s.doneFeatures) score += defs.find((f) => f.id === id)?.value ?? 0;
  return score;
}

/** Качество продукта на текущий день. */
export function currentQuality(s: GameState, content: GameContent): number {
  const expected = expectation(s.market, content.config, s.day);
  return quality(featureScore(s, content), expected, s.debt, s.bugs);
}

/** Работа над задачами за день. Меняет черновик, возвращает состояние генератора. */
function develop(draft: GameState, content: GameContent, rng: RngState): RngState {
  const cfg = content.config;
  let r = rng;
  const team = teamOf(draft, content);
  // Основатель делит день с подработкой, команда работает полный день; спешка ускоряет всех.
  let work = (cfg.founderSkill * (1 - draft.sideJobShare) + teamWorkPerDay(team, cfg.team)) * (draft.rush ? cfg.rushSpeed : 1);
  const sloppy = sloppyDevelopers(team);
  const tasks: Task[] = draft.tasks.map((t) => ({ ...t }));

  // Ограничение на число проходов защищает от зацикливания при нулевых стоимостях.
  for (let guard = 0; guard < 50 && work > 0 && tasks.length > 0; guard++) {
    const task = tasks[0]!;
    if (task.kind === 'feature') {
      const def = content.features[draft.productType].find((f) => f.id === task.featureId);
      const need = (def?.cost ?? 0) - task.progress;
      if (work >= need) {
        work -= Math.max(0, need);
        tasks.shift();
        if (def) {
          draft.doneFeatures = [...draft.doneFeatures, def.id];
          const newBugs = nextInt(r, draft.rush ? 2 : 1, draft.rush ? 6 : 3);
          r = newBugs.next;
          draft.bugs += newBugs.value + sloppy;
          draft.debt = clamp(draft.debt + (draft.rush ? 8 : 2), 0, 100);
        }
      } else {
        task.progress += work;
        work = 0;
      }
    } else if (task.kind === 'bugfix') {
      if (draft.bugs <= 0) {
        tasks.shift();
        continue;
      }
      task.progress += work;
      work = 0;
      while (task.progress >= cfg.bugfixCost && draft.bugs > 0) {
        task.progress -= cfg.bugfixCost;
        draft.bugs -= 1;
      }
      if (draft.bugs <= 0) tasks.shift();
    } else if (task.kind === 'polish') {
      task.progress += work;
      work = 0;
      while (task.progress >= cfg.polishCost) {
        task.progress -= cfg.polishCost;
        draft.polish += cfg.polishValue;
      }
    } else {
      if (draft.debt <= 0) {
        tasks.shift();
        continue;
      }
      task.progress += work;
      work = 0;
      while (task.progress >= cfg.refactorCost && draft.debt > 0) {
        task.progress -= cfg.refactorCost;
        draft.debt = Math.max(0, draft.debt - 1);
      }
      if (draft.debt <= 0) tasks.shift();
    }
  }

  draft.tasks = tasks;
  return r;
}

export function tick(state: GameState, content: GameContent): GameState {
  // Пока игрок не ответил на событие или партия окончена, время стоит.
  if (state.status !== 'running' || state.pendingEvent !== null) return state;

  const cfg = content.config;
  const s: GameState = { ...state };
  let rng = s.rng;

  // 1. Разработка и качество
  rng = develop(s, content, rng);
  s.quality = currentQuality(s, content);

  // 2. Пользователи
  const m = s.market;
  const over = overload(s.users, s.capacity);
  const b: DayBreakdown = {
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
    salaryCost: 0,
    sideIncome: 0,
    expenses: 0,
  };
  const team = teamOf(s, content);

  let paymentRevenue = 0;
  let adRevenue = 0;

  if (s.launched) {
    // Реклама не идёт, если платить за неё нечем.
    const adSpend = s.cash > 0 ? s.adSpendPerDay : 0;
    b.adCost = adSpend;

    const noise = nextRange(rng, 0.9, 1.1);
    rng = noise.next;
    const boost = modifierFactor(s, 'acquisition') * noise.value * marketingBoost(team, cfg.team);
    b.paid = paidPerDay(m, s.users, adSpend) * boost;
    b.organic = organicPerDay(m, s.users, s.reputation) * boost;
    b.viral = viralPerDay(m, s.users, s.quality) * boost;
    b.newUsers = Math.min(b.paid + b.organic + b.viral, Math.max(0, m.marketSize - s.users));

    const churn = churnMonthly(m, s.quality, over, s.bugs) * modifierFactor(s, 'churn');
    const free = s.users - s.paying;
    const freeLeft = free * monthlyToDaily(churn);
    const payingLeft = s.paying * monthlyToDaily(churnPayingMonthly(churn, s.price, m.priceRef));
    b.churned = freeLeft + payingLeft;

    if (s.businessModel === 'subscription') {
      b.converted = (free - freeLeft) * monthlyToDaily(conversionMonthly(m, s.quality, s.price));
    }

    s.paying = Math.max(0, s.paying - payingLeft + b.converted);
    s.users = Math.max(0, s.users - b.churned + b.newUsers);
    s.paying = Math.min(s.paying, s.users);

    // 3. Доходы
    switch (s.businessModel) {
      case 'subscription':
        paymentRevenue = (s.paying * s.price) / DAYS_IN_MONTH;
        break;
      case 'ads':
        adRevenue = ((s.users * m.adRevenuePerUser) / DAYS_IN_MONTH) * (s.reputation / 100);
        break;
      case 'oneTime':
        paymentRevenue = b.newUsers * conversionMonthly(m, s.quality, s.price) * s.price;
        break;
      case 'commission':
        paymentRevenue = ((s.users * m.commissionPerUser) / DAYS_IN_MONTH) * (s.reputation / 100);
        break;
    }
  }
  b.revenue = paymentRevenue + adRevenue;

  // 4. Расходы
  b.serverCost = (s.capacity * m.serverCostPerUser) / DAYS_IN_MONTH;
  b.toolsCost = cfg.toolsCostPerMonth / DAYS_IN_MONTH;
  b.feeCost = paymentRevenue * cfg.paymentFee;
  s.loans = s.loans.filter((l) => l.untilDay > s.day);
  b.loanCost = s.loans.reduce((sum, l) => sum + l.dailyPayment, 0);
  b.livingCost = s.livingCostPerMonth / DAYS_IN_MONTH;
  b.salaryCost = payrollPerMonth(team) / DAYS_IN_MONTH;
  b.sideIncome = (s.sideJobIncomePerMonth * s.sideJobShare) / DAYS_IN_MONTH;
  b.expenses = b.serverCost + b.adCost + b.toolsCost + b.feeCost + b.loanCost + b.livingCost + b.salaryCost;

  s.cash = cents(s.cash + b.revenue + b.sideIncome - b.expenses);
  s.lastDay = b;

  // 5. Репутация
  s.scandal = s.scandal * 0.98;
  if (s.launched) {
    const target = reputationTarget(s.quality, over, s.scandal);
    s.reputation = clamp(s.reputation + (target - s.reputation) * 0.01, 0, 100);
  }

  // 5а. Команда: мотивация, уходы, новые кандидаты
  s.team = stepTeam(s, content);

  // 6. Кассовый разрыв и банкротство
  s.negativeCashDays = s.cash < 0 ? s.negativeCashDays + 1 : 0;
  if (s.negativeCashDays >= cfg.bankruptcyDays) s.status = 'bankrupt';

  // 7. Журналы и закрытие месяца
  s.monthRevenue += b.revenue;
  s.monthExpenses += b.expenses;
  s.monthSideIncome += b.sideIncome;
  s.recentDays = [
    ...s.recentDays.slice(-(RECENT_DAYS - 1)),
    { day: s.day, cash: s.cash, users: s.users, paying: s.paying, revenue: b.revenue, expenses: b.expenses },
  ];

  if ((s.day + 1) % DAYS_IN_MONTH === 0) {
    const profit = s.monthRevenue - s.monthExpenses;
    s.months = [
      ...s.months,
      {
        month: s.months.length,
        revenue: cents(s.monthRevenue),
        expenses: cents(s.monthExpenses),
        profit: cents(profit),
        sideIncome: cents(s.monthSideIncome),
        users: s.users,
        paying: s.paying,
        cash: s.cash,
      },
    ];
    s.profitableMonthsInRow = profit >= cfg.goalProfitPerMonth ? s.profitableMonthsInRow + 1 : 0;
    s.monthRevenue = 0;
    s.monthExpenses = 0;
    s.monthSideIncome = 0;
  }

  // 8. Победа
  if (s.status === 'running') {
    if (s.goal === 'profit' && s.profitableMonthsInRow >= cfg.goalProfitMonths) s.status = 'won';
    if (s.goal === 'valuation' && valuation(s.months, s.users, m) >= cfg.goalValuation) s.status = 'won';
  }

  // 9. Событие
  s.modifiers = s.modifiers.filter((mod) => mod.untilDay > s.day);
  if (s.status === 'running') {
    const rolled = rollEvent(s, content, rng);
    rng = rolled.rng;
    if (rolled.eventId !== null) {
      s.pendingEvent = rolled.eventId;
      s.lastEventDay = s.day;
      s.eventLog = [...s.eventLog, { day: s.day, eventId: rolled.eventId, choiceId: null, chanceResults: [] }];
    }
  }

  s.rng = rng;
  s.day += 1;
  return s;
}
