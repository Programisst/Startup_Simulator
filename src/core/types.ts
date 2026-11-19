// Описание состояния игры, команд игрока и игрового контента.
// ОБЩИЙ ФАЙЛ: от него зависят и ядро, и интерфейс. Менять только по договорённости.

import type { RngState } from './rng';

export type ProductTypeId = 'saas' | 'social' | 'mobile' | 'ai' | 'marketplace' | 'devtools';
export type BusinessModel = 'subscription' | 'ads' | 'oneTime' | 'commission';
export type GoalId = 'profit' | 'valuation' | 'sandbox';
export type GameStatus = 'running' | 'won' | 'bankrupt';
export type DifficultyId = 'easy' | 'normal' | 'hard';

// ---------- Контент (данные игры) ----------

/** Аудитория: поправки к рынку для выбранного типа продукта. */
export interface AudienceDef {
  id: string;
  /** Насколько продукт подходит аудитории, 0.5…1.5 */
  fit: number;
  /** Множитель размера рынка */
  marketFactor: number;
  /** Множитель цены-ориентира */
  priceFactor: number;
}

/** Параметры типа продукта. Все ставки — месячные. */
export interface ProductTypeDef {
  id: ProductTypeId;
  marketSize: number;
  cacBase: number;
  churnBase: number;
  convBase: number;
  priceRef: number;
  viralBase: number;
  organicBase: number;
  serverCostPerUser: number;
  adRevenuePerUser: number;
  commissionPerUser: number;
  /** Давление конкурентов, 0…1 */
  competition: number;
  /** Сколько «очков функций» рынок ждёт от продукта в начале игры */
  expectation0: number;
  /** Сколько долларов оценки даёт один пользователь */
  userValue: number;
  audiences: AudienceDef[];
}

export interface FeatureDef {
  id: string;
  /** Стоимость в единицах работы (1 единица = день работы основателя) */
  cost: number;
  /** Ценность для пользователей */
  value: number;
  /** Основа продукта: без неё нельзя запуститься и делать другие функции */
  core?: boolean;
}

export interface EventCondition {
  launched?: boolean;
  minDay?: number;
  minUsers?: number;
  maxUsers?: number;
  minQuality?: number;
  maxQuality?: number;
  minCash?: number;
  maxCash?: number;
  minBugs?: number;
  minDebt?: number;
  overloaded?: boolean;
  cashNegative?: boolean;
  /** Силы основателя не выше этого числа */
  maxEnergy?: number;
  /** Номер офиса не ниже этого: 0 — комната основателя, 1 — коворкинг и так далее */
  minOffice?: number;
  /** Сколько функций готово, считая основу */
  minFeatures?: number;
  /** Доход продукта за последние 30 дней */
  minRevenue30?: number;
  /** Прибыль последнего закрытого месяца (доход продукта минус все расходы) */
  minMonthProfit?: number;
  /** Сколько человек в команде, не считая основателя */
  minTeam?: number;
  maxTeam?: number;
  /** Включена ли спешка */
  rush?: boolean;
  /** Событие про конкретного сотрудника: без подходящего человека оно не случается */
  subject?: EventSubject;
}

/** Кого из команды касается событие. */
export interface EventSubject {
  /** Кого выбрать, если подходят несколько */
  pick: 'lowestMotivation' | 'highestSkill' | 'newest';
  role?: EmployeeRole;
  minSkill?: number;
  minMotivation?: number;
  maxMotivation?: number;
  /** Сколько дней он уже работает в компании */
  minDaysHired?: number;
}

export type ModifierTarget = 'acquisition' | 'churn';

export type Effect =
  | { type: 'cash'; amount: number }
  | { type: 'reputation'; amount: number }
  /** Скандал: временный штраф к репутации, затухает сам */
  | { type: 'scandal'; amount: number }
  | { type: 'usersPct'; pct: number }
  | { type: 'bugs'; amount: number }
  | { type: 'debt'; amount: number }
  | { type: 'modifier'; target: ModifierTarget; factor: number; days: number }
  /** Заём: деньги сейчас, возврат amount × repayFactor равными долями за days дней */
  | { type: 'loan'; amount: number; repayFactor: number; days: number }
  /** Инвестиция: деньги сейчас в обмен на долю компании (0.1 = 10%) */
  | { type: 'invest'; amount: number; share: number }
  /** Силы основателя */
  | { type: 'energy'; amount: number }
  /** Работа над текущей функцией: плюс — продвинулись, минус — откатились */
  | { type: 'taskProgress'; amount: number }
  /** Очки качества продукта */
  | { type: 'polish'; amount: number }
  /** Мотивация всей команды */
  | { type: 'teamMotivation'; amount: number }
  /** Последствия для сотрудника, о котором событие */
  | { type: 'subjectMotivation'; amount: number }
  /** Прибавка к зарплате и к ожиданиям, доля (0.15 = +15%) */
  | { type: 'subjectRaise'; pct: number }
  | { type: 'subjectSkill'; amount: number }
  | { type: 'subjectLeaves' }
  | { type: 'chance'; probability: number; then: Effect[]; otherwise?: Effect[] };

/**
 * Цель на пути компании. Цели идут по порядку: игрок всегда видит одну ближайшую.
 * Достиг — получает награду, открывается следующая.
 */
export interface MilestoneDef {
  id: string;
  condition: EventCondition;
  /** Награда. Случайных исходов здесь быть не должно. */
  effects: Effect[];
  /** По какому числу показывать прогресс и сколько нужно набрать */
  progress?: { metric: MilestoneMetric; target: number };
}
export type MilestoneMetric = 'users' | 'revenue30' | 'features' | 'team';

/** Офис: сколько человек вмещает и сколько стоит. Офисы идут по порядку, переезд — только в следующий. */
export interface OfficeDef {
  id: string;
  /** Мест для сотрудников, не считая основателя */
  seats: number;
  /** Разовая плата за переезд */
  moveCost: number;
  rentPerMonth: number;
}

export interface EventChoiceDef {
  id: string;
  effects: Effect[];
}

export interface EventDef {
  id: string;
  /** Чем больше вес, тем чаще событие выбирается среди подходящих */
  weight: number;
  /** Сколько дней событие не может повториться */
  cooldownDays: number;
  once?: boolean;
  /** Срочное: случается сразу, как только выполнено условие */
  urgent?: boolean;
  /** Радостное событие: показывается празднично */
  mood?: 'good';
  /** Развилка во время разработки: возникает на середине работы над функцией, а не случайно */
  dev?: boolean;
  condition: EventCondition;
  choices: EventChoiceDef[];
}

/** Уровень сложности: меняет стартовые условия, но не формулы. */
export interface DifficultyDef {
  id: DifficultyId;
  startCash: number;
  /** Расходы основателя на жизнь в месяц */
  livingCostPerMonth: number;
  /** Сколько приносит подработка при полной занятости, в месяц */
  sideJobIncomePerMonth: number;
  /** Множитель цены рекламы и оттока: больше 1 — рынок жёстче */
  marketHarshness: number;
}

export type EmployeeRole = 'developer' | 'marketer';
/** Черта характера: старательный, спокойный, преданный, небрежный. */
export type TraitId = 'diligent' | 'calm' | 'loyal' | 'sloppy';

/** Настройки найма и команды. */
export interface TeamConfig {
  /** Сколько сотрудников помещается (пока офис один — комната основателя) */
  maxSize: number;
  candidatesShown: number;
  /** Раз во сколько дней список кандидатов обновляется */
  candidatesEveryDays: number;
  skillMin: number;
  skillMax: number;
  /** Зарплата в месяц при навыке 1 */
  salaryBase: Record<EmployeeRole, number>;
  /** Насколько круто зарплата растёт с навыком */
  salaryExponent: number;
  /** Разброс зарплатных ожиданий, доля (0.15 = ±15%) */
  salarySpread: number;
  /** Доля разработчиков среди кандидатов */
  developerShare: number;
  /** Выходное пособие при увольнении, в месячных зарплатах */
  severanceMonths: number;
  startMotivation: number;
  /** Какую часть пути к целевой мотивации сотрудник проходит за день */
  motivationSpeed: number;
  rushPenalty: number;
  brokePenalty: number;
  profitBonus: number;
  loyalBonus: number;
  /** Ниже этой мотивации сотрудник может уйти сам */
  quitBelow: number;
  quitDailyChance: number;
  /** Прибавка к выработке старательного */
  diligentBonus: number;
  /** Прибавка к притоку пользователей за единицу навыка маркетолога и её потолок */
  marketingPerPoint: number;
  marketingCap: number;
}

/** Силы основателя: как он устаёт и отдыхает. */
export interface FounderConfig {
  /** Сколько сил уходит за рабочий день */
  drainPerDay: number;
  /** Во сколько раз быстрее уходят силы при спешке */
  rushDrain: number;
  /** Сколько сил возвращается за день без дел */
  idleRecovery: number;
  /** Сколько сил возвращает день отдыха */
  restGain: number;
  /** Ниже этого уровня основатель работает медленнее */
  tiredBelow: number;
  /** Во сколько раз медленнее он работает при нуле сил */
  minFactor: number;
  /** Ниже этого уровня к каждой готовой функции добавляется ошибка */
  exhaustedBelow: number;
  /** Во сколько раз кофе ускоряет работу и на сколько дней */
  coffeeBoost: number;
  coffeeDays: number;
  /** Через сколько дней можно снова */
  coffeeCooldownDays: number;
  /** Сколько сил кофе отнимает сразу: рывок в долг */
  coffeeCost: number;
  /** Развилка возникает только у функций не короче этого числа дней работы */
  dilemmaMinCost: number;
  /** Сколько знаков кода игрок должен набрать сам, чтобы сосредоточенность стала полной */
  focusChars: number;
  /** На сколько полная сосредоточенность ускоряет работу основателя (0.5 = +50%) */
  focusBonus: number;
  /** Какая часть сосредоточенности уходит за день */
  focusDecayPerDay: number;
}

export interface GameConfig {
  startReputation: number;
  startCapacity: number;
  capacityTiers: number[];
  toolsCostPerMonth: number;
  paymentFee: number;
  founderSkill: number;
  rushSpeed: number;
  bugfixCost: number;
  refactorCost: number;
  /** Сколько работы стоит один шаг улучшения продукта и сколько очков он даёт */
  polishCost: number;
  polishValue: number;
  /** Допустимые доли времени основателя на подработку */
  sideJobShares: number[];
  expectationGrowthPerMonth: number;
  eventMinGapDays: number;
  eventDailyChance: number;
  bankruptcyDays: number;
  goalProfitPerMonth: number;
  goalProfitMonths: number;
  goalValuation: number;
  /** Насколько рынок каждой партии случайно отличается от базового, доля (0.15 = ±15%) */
  marketVariation: number;
  team: TeamConfig;
  founder: FounderConfig;
  /** Темп партии: во сколько раз быстрее приходят пользователи и деньги, чем в «честной» модели */
  pace: { acquisition: number; revenue: number; /** Интерес к новинке: во сколько раз больше людей приходит первые дни после запуска */ launchBoost: number; launchDays: number };
  offices: OfficeDef[];
}

export interface GameContent {
  config: GameConfig;
  difficulties: Record<DifficultyId, DifficultyDef>;
  productTypes: Record<ProductTypeId, ProductTypeDef>;
  features: Record<ProductTypeId, FeatureDef[]>;
  events: EventDef[];
  milestones: MilestoneDef[];
}

// ---------- Состояние партии ----------

/** Параметры рынка этой партии: тип продукта с поправками аудитории (позже — и AI). */
export interface Market {
  marketSize: number;
  cacBase: number;
  churnBase: number;
  convBase: number;
  priceRef: number;
  viralBase: number;
  organicBase: number;
  serverCostPerUser: number;
  adRevenuePerUser: number;
  commissionPerUser: number;
  competition: number;
  fit: number;
  expectation0: number;
  userValue: number;
}

export type Task =
  | { kind: 'feature'; featureId: string; progress: number; /** Развилка по этой функции уже была */ asked?: boolean }
  | { kind: 'bugfix'; progress: number }
  | { kind: 'refactor'; progress: number }
  /** Улучшение продукта: повторяемая задача, идёт, пока её не снимут */
  | { kind: 'polish'; progress: number };

export interface Modifier {
  target: ModifierTarget;
  factor: number;
  untilDay: number;
}

export interface Loan {
  dailyPayment: number;
  untilDay: number;
}

/** Заметное событие дня для ленты: мир откликается на то, что делает игрок. */
export interface NewsItem {
  day: number;
  kind: 'users' | 'paying' | 'featureDone' | 'overload' | 'monthProfit' | 'monthLoss' | 'review' | 'tired' | 'office' | 'invest';
  /** Число, о котором новость: пользователей, платящих, долларов */
  value?: number;
  /** Для готовой функции — её id */
  id?: string;
  /** Для отзыва: тон и номер текста */
  tone?: 'good' | 'mixed' | 'bad';
  variant?: number;
}

export interface EventLogEntry {
  day: number;
  eventId: string;
  /** null — событие ещё ждёт выбора игрока */
  choiceId: string | null;
  /** Как выпали случайные исходы внутри выбранного варианта */
  chanceResults: boolean[];
  /** Для событий о сотруднике: по этому числу интерфейс подбирает его имя */
  subjectNameSeed?: number;
  /** Для развилок разработки: функция, над которой шла работа */
  featureId?: string;
}

/** Кандидат на найм. Имя и внешность интерфейс подбирает сам по nameSeed. */
export interface Candidate {
  id: number;
  role: EmployeeRole;
  /** Навык: 1 — как основатель */
  skill: number;
  trait: TraitId;
  /** Зарплата в месяц, на которую он согласен */
  salaryAsk: number;
  nameSeed: number;
}

export interface Employee extends Candidate {
  /** Сколько ему платят сейчас, в месяц */
  salary: number;
  hiredDay: number;
  /** Мотивация 0…100 */
  motivation: number;
}

export interface TeamLogEntry {
  day: number;
  kind: 'hired' | 'fired' | 'quit';
  employeeId: number;
  nameSeed: number;
  role: EmployeeRole;
}

/** Команда и рынок труда этой партии. */
export interface TeamState {
  /** Отдельный генератор случайности: наём не сдвигает случайность рынка и событий */
  rng: RngState;
  nextId: number;
  /** День, когда список кандидатов обновлялся в последний раз */
  refreshedDay: number;
  employees: Employee[];
  candidates: Candidate[];
  log: TeamLogEntry[];
}

/** Из чего сложился последний день — для объяснения показателей игроку. */
export interface DayBreakdown {
  paid: number;
  organic: number;
  viral: number;
  newUsers: number;
  churned: number;
  converted: number;
  revenue: number;
  serverCost: number;
  adCost: number;
  toolsCost: number;
  feeCost: number;
  loanCost: number;
  livingCost: number;
  /** Аренда офиса за день */
  rentCost: number;
  /** Зарплаты команды за день */
  salaryCost: number;
  /** Доход от подработки основателя — не входит в доход продукта */
  sideIncome: number;
  expenses: number;
}

export interface DayPoint {
  day: number;
  cash: number;
  users: number;
  paying: number;
  revenue: number;
  expenses: number;
}

export interface MonthReport {
  month: number;
  revenue: number;
  expenses: number;
  /** Прибыль продукта: доход минус расходы, без подработки */
  profit: number;
  sideIncome: number;
  users: number;
  paying: number;
  cash: number;
}

export interface GameState {
  /** Версия формата сохранения */
  version: 1;
  seed: number;
  rng: RngState;
  /** Номер дня с начала партии, начиная с 0. В месяце 30 дней. */
  day: number;
  status: GameStatus;
  goal: GoalId;
  difficulty: DifficultyId;
  livingCostPerMonth: number;
  sideJobIncomePerMonth: number;
  /** Доля времени основателя на подработку, 0…1 */
  sideJobShare: number;

  companyName: string;
  /** Идея продукта словами игрока. Необязательное поле: в старых сохранениях его нет. */
  idea?: string;
  productType: ProductTypeId;
  audienceId: string;
  businessModel: BusinessModel;
  market: Market;

  cash: number;
  users: number;
  paying: number;
  quality: number;
  reputation: number;
  scandal: number;
  debt: number;
  bugs: number;
  capacity: number;
  price: number;
  adSpendPerDay: number;

  launched: boolean;
  launchDay: number | null;
  doneFeatures: string[];
  /** Очки качества, набранные улучшением продукта */
  polish: number;
  tasks: Task[];
  rush: boolean;
  /** Офис компании (id из настроек); нет поля — комната основателя */
  office?: string;
  /** Доля основателя в компании, 1 = 100%; уменьшается с каждой инвестицией */
  founderShare?: number;
  /** Силы основателя 0…100. Необязательные поля ниже: в старых сохранениях их нет. */
  energy?: number;
  /** До какого дня действует кофе и с какого дня можно снова */
  coffeeUntilDay?: number;
  coffeeReadyDay?: number;
  /** Сегодня основатель отдыхает и не работает */
  resting?: boolean;
  /** Сосредоточенность 0…1: растёт, когда игрок сам набирает код, и ускоряет работу основателя */
  focus?: number;
  /** Лента: последние заметные события */
  news?: NewsItem[];
  /** Достигнутые цели: id и день. Необязательное поле: в старых сохранениях его нет. */
  milestones?: { id: string; day: number }[];
  /** Команда. Необязательное поле: в старых сохранениях его нет, ядро создаёт его само. */
  team?: TeamState;

  modifiers: Modifier[];
  loans: Loan[];

  negativeCashDays: number;
  profitableMonthsInRow: number;

  pendingEvent: string | null;
  /** Номер сотрудника, о котором ждущее событие (если оно о человеке) */
  pendingSubject?: number | null;
  lastEventDay: number;
  eventLog: EventLogEntry[];

  lastDay: DayBreakdown;
  /** Последние 90 дней — для графиков */
  recentDays: DayPoint[];
  monthRevenue: number;
  monthExpenses: number;
  monthSideIncome: number;
  months: MonthReport[];
}

// ---------- Команды игрока ----------

export interface NewGameSetup {
  seed: number;
  companyName: string;
  /** Идея продукта словами игрока */
  idea?: string;
  productType: ProductTypeId;
  audienceId: string;
  businessModel: BusinessModel;
  goal: GoalId;
  difficulty: DifficultyId;
}

export type Command =
  | { type: 'setAdSpend'; perDay: number }
  | { type: 'setPrice'; price: number }
  | { type: 'setCapacity'; capacity: number }
  | { type: 'queueFeature'; featureId: string }
  | { type: 'startBugfix' }
  | { type: 'startRefactor' }
  | { type: 'startPolish' }
  | { type: 'setSideJob'; share: number }
  | { type: 'removeTask'; index: number }
  | { type: 'setRush'; rush: boolean }
  | { type: 'launch' }
  /** День отдыха: основатель не работает и восстанавливает силы */
  | { type: 'rest' }
  | { type: 'coffee' }
  /** Игрок сам набрал столько знаков кода в редакторе */
  | { type: 'typeCode'; chars: number }
  /** Переезд в следующий по порядку офис */
  | { type: 'moveOffice' }
  | { type: 'hire'; candidateId: number }
  | { type: 'fire'; employeeId: number }
  | { type: 'setSalary'; employeeId: number; salary: number }
  | { type: 'chooseEvent'; choiceId: string }
  | { type: 'continueAsSandbox' };

export type CommandError =
  | 'gameOver'
  | 'invalidValue'
  | 'unknownFeature'
  | 'featureAlreadyDone'
  | 'featureAlreadyQueued'
  | 'coreFeatureRequired'
  | 'nothingToFix'
  | 'alreadyQueued'
  | 'noSuchTask'
  | 'alreadyLaunched'
  | 'coffeeTooSoon'
  | 'notEnoughCash'
  | 'noBiggerOffice'
  | 'noSuchCandidate'
  | 'noSuchEmployee'
  | 'teamFull'
  | 'noEvent'
  | 'unknownChoice'
  | 'eventPending';

export type CommandResult =
  | { ok: true; state: GameState }
  | { ok: false; error: CommandError };
