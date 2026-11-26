// Описание состояния игры, команд игрока и игрового контента.
// ОБЩИЙ ФАЙЛ: от него зависят и ядро, и интерфейс. Менять только по договорённости.

import type { RngState } from './rng';

export type ProductTypeId = 'saas' | 'social' | 'mobile' | 'ai' | 'marketplace' | 'devtools' | 'game';
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

/** Какие параметры рынка тема может сдвинуть. Каждое число — множитель: 1 — без изменений. */
export interface ThemeMarket {
  marketSize?: number;
  cac?: number;
  churn?: number;
  conv?: number;
  price?: number;
  viral?: number;
  organic?: number;
}

/**
 * Тема стартапа (деньги, здоровье, игры…): свои функции и свои особенности рынка.
 * Тип продукта отвечает на вопрос «что это», тема — «про что».
 */
export interface ThemeDef {
  id: string;
  /** Функции, которые есть только у этой темы */
  features: FeatureDef[];
  market: ThemeMarket;
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
  /** Событие с таким id уже случалось в партии (как бы игрок на него ни ответил) */
  eventSeen?: string;
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

/** Глава пути компании: несколько целей подряд. Главы идут по порядку и покрывают все цели. */
export interface ChapterDef {
  id: string;
  /** id целей этой главы, в том же порядке, что в общем списке */
  milestones: string[];
}

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
  /** Сообщение об угрозе большой компании: его показывает расчёт угроз, случайно оно не выпадает */
  threat?: boolean;
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
  /** Свой разброс рынка партии (попала идея в рынок или нет). Не задан — общий из настроек. */
  marketVariation?: number;
}

export type EmployeeRole = 'developer' | 'marketer';
/** Черта характера: старательный, спокойный, преданный, небрежный. */
export type TraitId = 'diligent' | 'calm' | 'loyal' | 'sloppy';
/** Что человеком движет: деньги, рост, спокойствие, идея, люди рядом. От этого зависит, что поднимает и роняет его мотивацию. */
export type DriverId = 'money' | 'growth' | 'peace' | 'mission' | 'people';

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
  /** Разговор один на один: прибавка к мотивации, цена в силах основателя и перерыв между разговорами */
  talkBoost: number;
  /** Как меняется мотивация, если разговор прошёл ни так ни сяк и если он прошёл плохо */
  talkSame: number;
  talkWorse: number;
  talkEnergy: number;
  talkCooldownDays: number;
  /** Прибавка к притоку пользователей за единицу навыка маркетолога и её потолок */
  marketingPerPoint: number;
  marketingCap: number;
  /** Потолок суммарной прибавки от звёзд одной роли, доля (0.45 = +45%) */
  starAuraCap: number;
}

/** Что на самом деле внутри компании, выставленной на продажу: здоровая, с проблемами, пустышка. */
export type TargetHealth = 'solid' | 'messy' | 'hollow';

export interface TargetSizeDef {
  id: 'small' | 'medium' | 'large';
  /** Сколько у неё пользователей — в долях от ваших */
  share: number;
  /** Как часто попадается (важны доли) */
  weight: number;
  /** Во сколько раз больше или меньше хлопот при присоединении */
  trouble: number;
}

export interface TargetHealthDef {
  id: TargetHealth;
  weight: number;
  /** Какая доля заявленных пользователей на самом деле перейдёт к вам */
  keep: number;
  /** Что приезжает вместе с ней: ошибки, технический долг, сдвиг репутации */
  bugs: number;
  debt: number;
  reputation: number;
  /** Скрытые долги купленной компании: доплата после присоединения, в долях от цены покупки */
  hiddenDebt: number;
}

/** Покупка компаний: готовые пользователи и новый рынок за деньги — если внутри не пустышка. */
export interface AcquisitionsConfig {
  sizes: TargetSizeDef[];
  health: TargetHealthDef[];
  /** Раз во сколько дней появляется компания на продажу и сколько дней она ждёт */
  periodDays: number;
  visibleDays: number;
  /** Доход за 30 дней, с которого вам начинают предлагать компании */
  minRevenue30: number;
  /** Цена: столько месяцев вашего дохода с такого числа пользователей */
  priceMonths: number;
  /** Проверка перед покупкой: доля от цены и сколько дней идёт */
  checkCostShare: number;
  checkDays: number;
  /** Через сколько дней после покупки пользователи переходят к вам */
  integrationDays: number;
  /** Предложить меньше: доля от цены и шанс согласия — обычный и когда проверка нашла проблемы */
  lowOffer: number;
  lowChance: number;
  lowChanceWeak: number;
  /** На сколько человек расширяется рынок за каждого перешедшего пользователя */
  marketPerUser: number;
  /** С какого числа ошибок или технического долга экран предупреждает: продукт не готов принять ещё одну компанию */
  strainBugs: number;
  strainDebt: number;
  /** Сколько выдуманных названий компаний в текстах */
  companies: number;
}

/** Компания, выставленная на продажу. Что у неё внутри, игрок узнаёт проверкой или после покупки. */
export interface TargetDef {
  size: TargetSizeDef['id'];
  health: TargetHealth;
  companySeed: number;
}

export interface AcquisitionsState {
  /** Отдельный генератор случайности: ответ продавца не сдвигает остальную партию */
  rng: RngState;
  /** Номер периода, с компанией которого уже всё решено */
  window: number | null;
  /** Проверка компании: какого периода и когда будет готова */
  check: { window: number; readyDay: number } | null;
  /** Купленная компания присоединяется */
  integrating: { target: TargetDef; users: number; price: number; doneDay: number } | null;
  last: { day: number; kind: 'joined' | 'refused'; health: TargetHealth | null; users: number; companySeed: number } | null;
  bought: number;
}

/** Инвестор: сколько компании хочет, как платит и чего требует взамен. */
export interface InvestorDef {
  id: string;
  /** Какую долю компании покупает, 0.15 = 15% */
  share: number;
  /** Первое предложение: во сколько раз дешевле или дороже оценки компании */
  price: number;
  /** Сколько отказов выдержит, прежде чем уйти */
  patience: number;
  /** Шанс, что он вообще сделает предложение, выслушав вас (до поправки на переговорную позицию) */
  interest: number;
  /** Поправка к шансу, что он уступит в торге: сговорчивый — плюс, жёсткий — минус */
  flexibility: number;
  /** Помощь с клиентами после сделки: множитель притока и на сколько дней */
  perk?: { factor: number; days: number };
  /** Обещание роста: во сколько раз должен вырасти доход за 30 дней и к какому сроку; что будет при успехе и при срыве */
  promise?: { growth: number; days: number; penaltyShare: number; keptReputation: number; brokenReputation: number };
}

/** Как торговаться: попросить больше или давить. */
export interface CounterDef {
  id: 'ask' | 'press';
  /** На сколько вырастет предложение, если инвестор уступит (0.15 = +15%) */
  raise: number;
  /** Шанс, что уступит, до поправок */
  chance: number;
}

/** Раунды инвестиций с торгом за цену доли. */
export interface FundingConfig {
  investors: InvestorDef[];
  counters: CounterDef[];
  /** Оценка компании, с которой инвесторы готовы разговаривать */
  minValuation: number;
  /** Меньше этой доли основателю оставить нельзя */
  minFounderShare: number;
  /** Сколько сил стоит начать переговоры и сколько дней предложение в силе */
  energyCost: number;
  talkDays: number;
  /** Насколько каждый пункт переговорной позиции сдвигает первое предложение и шанс уступки */
  positionPrice: number;
  positionChance: number;
  /** Насколько каждый пункт позиции сдвигает шанс, что инвестор заинтересуется, и границы этого шанса */
  positionInterest: number;
  interestMin: number;
  interestMax: number;
  /** Насколько каждая выторгованная уступка снижает шанс следующей */
  raisePenalty: number;
  chanceMin: number;
  chanceMax: number;
  /** Выше этой цены (в оценках компании) инвестор не заплатит */
  maxPrice: number;
  /** Перерыв до следующего раунда: после сделки, после ухода инвестора, после вашего ухода */
  cooldownClosed: number;
  cooldownWalked: number;
  cooldownLeft: number;
  /** Перерыв после того, как инвестор выслушал и отказал */
  cooldownDeclined: number;
  /** Удар по репутации, когда инвестор уходит, хлопнув дверью */
  walkedReputation: number;
  /** Выкуп доли обратно: во сколько раз дороже оценки и какими частями */
  buybackPrice: number;
  buybackSteps: number[];
}

export interface FundingState {
  /** Отдельный генератор случайности: торг не сдвигает остальную партию */
  rng: RngState;
  /** Идущие переговоры */
  talks: { investor: string; share: number; offer: number; valuation: number; patience: number; raises: number; untilDay: number; lastCounter?: { stance: CounterDef['id']; ok: boolean } } | null;
  /** С какого дня можно начать следующий раунд */
  readyDay: number;
  /** Обещание роста инвестору */
  promise: { investor: string; from: number; target: number; dueDay: number; penaltyShare: number } | null;
  last: { day: number; kind: 'closed' | 'walked' | 'left' | 'expired' | 'declined'; investor: string; amount: number; share: number } | null;
  rounds: number;
  /** Сдержанные и сорванные обещания: по ним инвесторы судят о вас */
  kept: number;
  broken: number;
}

/** Предложение звезде из чужой компании: скромное, щедрое, очень щедрое. */
export type HeadhuntOfferId = 'modest' | 'generous' | 'lavish';

export interface HeadhuntOfferDef {
  id: HeadhuntOfferId;
  /** Во сколько раз предложенная зарплата выше нынешней зарплаты звезды */
  salary: number;
  /** Разовая выплата при переходе, в предложенных месячных зарплатах */
  bonusMonths: number;
  /** Шанс согласия до поправок на характер и репутацию, доля */
  chance: number;
  /** На сколько падает мотивация коллег той же роли, которым платят заметно меньше */
  jealousy: number;
}

/** Охота за звёздами: сильные люди из чужих компаний, которых можно переманить. */
export interface HeadhuntConfig {
  offers: HeadhuntOfferDef[];
  /** Раз во сколько дней появляется новая звезда и сколько дней она ждёт предложения */
  periodDays: number;
  visibleDays: number;
  /** Через сколько дней после предложения приходит ответ */
  answerDays: number;
  /** Сколько сил основателя стоят переговоры */
  energyCost: number;
  /** Доход за 30 дней, с которого компанию замечают сильные люди */
  minRevenue30: number;
  skillMin: number;
  skillMax: number;
  /** Какую зарплату звезда считает справедливой при переходе, в долях от нынешней */
  fairSalary: number;
  /** На сколько звезда ускоряет коллег своей роли, доля */
  aura: number;
  /** Завидуют те, кто получает меньше этой доли от зарплаты звезды */
  jealousBelow: number;
  /** Поправка к шансу, когда компания подходит и не подходит человеку по характеру */
  fitGood: number;
  fitBad: number;
  /** Насколько репутация сдвигает шанс: (репутация − 50) / 100 × вес */
  reputationWeight: number;
  chanceMin: number;
  chanceMax: number;
  /** Шанс, что чужая компания в ответ придёт за вашим человеком: после перехода и после отказа */
  retaliationOnJoin: number;
  retaliationOnDecline: number;
  /** Событие, которым приходит ответный удар, и сколько дней человек должен проработать, чтобы за ним пришли */
  retaliationEvent: string;
  retaliationMinDaysHired: number;
  /** Сколько выдуманных компаний-конкурентов в текстах */
  companies: number;
}

/** Звезда из чужой компании. */
export interface StarDef {
  nameSeed: number;
  role: EmployeeRole;
  skill: number;
  trait: TraitId;
  driver: DriverId;
  /** Сколько ей платят сейчас, в месяц */
  salaryNow: number;
  /** Номер компании, где она работает: название подбирает интерфейс */
  companySeed: number;
}

export type HeadhuntOutcome = 'joined' | 'declined';

export interface HeadhuntState {
  /** Отдельный генератор случайности: ответ звезды не сдвигает остальную партию */
  rng: RngState;
  /** Номер периода, звезде которого уже сделали предложение */
  window: number | null;
  pending: { star: StarDef; offer: HeadhuntOfferId; salary: number; bonus: number; chance: number; resolveDay: number } | null;
  last: { day: number; outcome: HeadhuntOutcome; nameSeed: number; role: EmployeeRole; retaliation: boolean } | null;
  /** Чужая компания готовит ответный удар: событие придёт, как только игрок свободен */
  raid?: boolean;
  /** Сколько звёзд перешло за партию */
  joined: number;
}

/** Рекламный канал. Названия выдуманные: настоящие площадки в игре не упоминаются. */
export type ChannelId = 'search' | 'feeds' | 'bloggers' | 'content';

export interface ChannelDef {
  id: ChannelId;
  /**
   * Во сколько раз пользователь из канала дороже или дешевле обычного — отдельно для продуктов
   * «для людей» (соцсеть, приложение, игра, маркетплейс) и «для дела» (SaaS, AI, инструменты).
   */
  costFactor: { consumer: number; business: number };
  /** Бюджет в день, при котором отдача падает вдвое: канал «выгорает», если лить в него слишком много */
  halfAt: number;
  /** Разброс результата изо дня в день, доля (0.6 = от −60% до +60%). 0 — канал предсказуем. */
  noise: number;
  /**
   * 'direct' — деньги сразу приводят людей; 'content' — деньги копятся в «запас статей»,
   * который сам приводит людей и понемногу устаревает.
   */
  kind: 'direct' | 'content';
}

/** Настройки маркетинга. */
export interface MarketingConfig {
  channels: ChannelDef[];
  /** Какие типы продукта считаются «для дела»; остальные — «для людей» */
  businessTypes: ProductTypeId[];
  /** Сколько вложенных в статьи долларов дают +100% к тем, кто находит продукт сам, и потолок этой прибавки */
  contentPerDouble: number;
  contentCap: number;
  /** Какая доля запаса статей устаревает за день */
  contentDecayPerDay: number;
  /** Разовые акции: ставка с риском вместо ровного бюджета */
  campaigns: CampaignDef[];
  /** При каком качестве продукта шансы акции равны записанным; хуже продукт — чаще провал */
  campaignQualityRef: number;
}

export type CampaignOutcome = 'fail' | 'ok' | 'hit';

/** Что акция даёт при этом исходе: во сколько раз и на сколько дней растёт приток, как меняется репутация. */
export interface CampaignResult {
  factor?: number;
  days?: number;
  reputation?: number;
}

/** Разовая маркетинговая акция. Деньги уходят сразу, исход становится известен через days дней. */
export interface CampaignDef {
  id: string;
  /** Цена: не меньше baseCost, а у выросшей компании — доля дохода за 30 дней */
  baseCost: number;
  revenueShare: number;
  /** Сколько сил основателя уходит на подготовку */
  energyCost?: number;
  /** Через сколько дней виден результат */
  days: number;
  /** Сколько дней после результата эту акцию нельзя повторить */
  cooldownDays: number;
  /** С продуктом хуже этого акцию не запустить */
  minQuality?: number;
  /** Насколько акция подходит продуктам «для людей» и «для дела»: больше 1 — шансы лучше */
  fit: { consumer: number; business: number };
  /** Шансы исходов при качестве campaignQualityRef и обычном соответствии (в сумме любые, важны доли) */
  weights: Record<CampaignOutcome, number>;
  results: Partial<Record<CampaignOutcome, CampaignResult>>;
}

/** Банк: кредит и вклад. */
export interface BankConfig {
  /** Годовая ставка кредита и срок в днях */
  loanRateYear: number;
  loanTermDays: number;
  minLoan: number;
  /** Предел долга: столько дают без дохода плюс столько месячных доходов продукта */
  baseLimit: number;
  revenueMultiple: number;
  /** Годовая ставка по вкладу */
  depositRateYear: number;
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
  /** Сколько общих функций типа продукта попадает в партию (кроме основы); остальное — функции темы */
  genericFeaturesPerGame: number;
  /** Развилка возникает только у функций не короче этого числа дней работы */
  dilemmaMinCost: number;
  /** Сколько знаков кода игрок должен набрать сам, чтобы сосредоточенность стала полной */
  focusChars: number;
  /** На сколько полная сосредоточенность ускоряет работу основателя (0.5 = +50%) */
  focusBonus: number;
  /** Какая часть сосредоточенности уходит за день */
  focusDecayPerDay: number;
  /** Сколько нажатий в редакторе кода дают работу целого дня (всей команды) */
  typeCharsPerDay: number;
  /** Сколько дневных норм работы можно добавить набором за один игровой день (1 = работа идёт до двух раз быстрее) */
  typeBonusCap: number;
}

/** Размер обещанного обновления: сколько работы и что даёт выпуск в срок. */
export interface ReleaseSizeDef {
  id: 'small' | 'medium' | 'large';
  /** Объём работы в днях команды при обычном темпе */
  teamDays: number;
  /** Во сколько раз и на сколько дней вырастет приток после выпуска в срок */
  factor: number;
  days: number;
  /** Репутация за выпуск в срок и за сорванный срок */
  reputation: number;
  failReputation: number;
}

/** Каким срок обещан: с запасом, впритык или смело. */
export interface ReleaseDeadlineDef {
  id: 'safe' | 'exact' | 'bold';
  /** Срок относительно объёма работы: 0.75 — на четверть быстрее обычного темпа */
  time: number;
  /** Множители награды и наказания: смелое обещание ценнее, а срыв — больнее */
  reward: number;
  penalty: number;
}

export interface ReleaseConfig {
  sizes: ReleaseSizeDef[];
  deadlines: ReleaseDeadlineDef[];
  /** Сколько дней после исхода нельзя объявлять следующее обновление */
  cooldownDays: number;
  /** С таким числом ошибок выпуск считается сырым, и какая доля награды тогда остаётся */
  buggyAt: number;
  roughShare: number;
}

export type ReleaseOutcome = 'onTime' | 'rough' | 'missed';

export interface ReleaseState {
  active: { size: ReleaseSizeDef['id']; deadline: ReleaseDeadlineDef['id']; startDay: number; dueDay: number; need: number; done: number } | null;
  last: { size: ReleaseSizeDef['id']; deadline: ReleaseDeadlineDef['id']; day: number; outcome: ReleaseOutcome } | null;
  /** Сколько обновлений вышло в срок за партию */
  shipped: number;
}

export interface GameConfig {
  releases: ReleaseConfig;
  headhunt: HeadhuntConfig;
  funding: FundingConfig;
  acquisitions: AcquisitionsConfig;
  ops: OpsConfig;
  threats: ThreatsConfig;
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
  bank: BankConfig;
  marketing: MarketingConfig;
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
  chapters: ChapterDef[];
  themes: ThemeDef[];
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

export interface CampaignsState {
  /** Свой генератор случайности: исходы акций не сдвигают остальную случайность партии */
  rng: number;
  active: { id: string; endsDay: number; cost: number } | null;
  /** День, когда акция этого вида закончилась в последний раз */
  finishedDay: Record<string, number>;
  last: { id: string; day: number; outcome: CampaignOutcome } | null;
}

/** Заметное событие дня для ленты: мир откликается на то, что делает игрок. */
export interface NewsItem {
  day: number;
  kind: 'users' | 'paying' | 'featureDone' | 'overload' | 'monthProfit' | 'monthLoss' | 'review' | 'tired' | 'office' | 'invest' | 'chapter' | 'campaign' | 'release' | 'headhunt' | 'funding' | 'acquisition' | 'threat' | 'opsCut';
  /** Число, о котором новость: пользователей, платящих, долларов; для звезды — число, по которому подбирается имя */
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
  /** Что им движет. Необязательное: у людей из старых сохранений поля нет — считаются «за деньги». */
  driver?: DriverId;
}

export interface Employee extends Candidate {
  /** Сколько ему платят сейчас, в месяц */
  salary: number;
  hiredDay: number;
  /** Мотивация 0…100 */
  motivation: number;
  /** Номер места в офисе с нуля: выдаётся при найме и не меняется. У людей из старых сохранений поля нет. */
  seat?: number;
  /** День последнего разговора один на один */
  lastTalkDay?: number;
  /** Последние реплики разговоров — чтобы человек «помнил», о чём говорили */
  chat?: ChatLine[];
  /** Звезда, переманенная из чужой компании, и на сколько она ускоряет коллег своей роли (доля) */
  star?: boolean;
  aura?: number;
}

/** Чем кончился разговор: стало лучше, без изменений, стало хуже. */
export type TalkOutcome = 'better' | 'same' | 'worse';

/** Реплика разговора основателя с сотрудником. */
export interface ChatLine {
  from: 'founder' | 'employee';
  text: string;
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

/** Служба большой компании: поддержка пользователей, продажи, администрация, сопровождение продукта. */
export type OpsLineId = 'support' | 'sales' | 'admin' | 'upkeep';

/** Расходы, которые растут вместе с компанией. */
export interface OpsConfig {
  /** Ступени: с части устойчивого месячного дохода выше from на службы уходит доля rate. По возрастанию from. */
  steps: { from: number; rate: number }[];
  /** На что делится расход; weight — доля статьи (в жизни — процент от дохода) */
  lines: { id: OpsLineId; weight: number }[];
  /** За сколько последних дней усредняется доход: службы растут с этим опозданием */
  windowDays: number;
  /** Какая доля людей служб уходит сама за год: так службы сжимаются без сокращения */
  attritionPerYear: number;
  /** Срочное сокращение: варианты по глубине */
  cuts: OpsCutDef[];
  /** Сколько дней после сокращения нельзя сокращать снова */
  cutCooldownDays: number;
}

export type OpsCutId = 'part' | 'full';

/** Вариант срочного сокращения служб. */
export interface OpsCutDef {
  id: OpsCutId;
  /** Какую долю лишнего убрать: 1 — до сегодняшнего дохода */
  depth: number;
  /** Выходное пособие: сколько месячных расходов на уволенных */
  severanceMonths: number;
  /** Удар по репутации и по настрою команды (отрицательные числа) */
  reputation: number;
  motivation: number;
  /** Шанс, что сократили лишнего и пользователи это заметят */
  riskChance: number;
  /** Во сколько раз чаще уходят пользователи, если так случилось, и сколько дней */
  riskChurn: number;
  riskDays: number;
}

/** Состояние служб. Необязательное: в старых сохранениях его нет. */
export interface OpsState {
  /** Под какой месячный доход набраны службы */
  level: number;
  /** День последнего срочного сокращения */
  cutDay?: number;
  /** Последнее сокращение: чем кончилось */
  last?: { day: number; cut: OpsCutId; severance: number; saving: number; backfired: boolean };
}

export type ThreatKind = 'downturn' | 'rival';
export type ThreatResponseId = 'discount' | 'attack' | 'priceWar' | 'outbuild';

/** Как угроза давит на компанию: множители к притоку людей, уходу пользователей и доходу. */
export interface ThreatPressure {
  acquisition: number;
  churn: number;
  revenue: number;
}

/** Ответ игрока на угрозу. */
export interface ThreatResponseDef {
  id: ThreatResponseId;
  /** Цена: доля дохода за последние 30 дней, платится сразу */
  costRevenueShare: number;
  /** Шанс удачи; 1 — исход известен заранее */
  chance: number;
  /** К шансу прибавляется качество продукта, умноженное на это число (качество 0…100) */
  chancePerQuality: number;
  /** Давление угрозы при удаче */
  success: ThreatPressure;
  /** При удаче угроза кончается через столько дней (0 — идёт свой срок) */
  successEndsInDays: number;
  /** При неудаче к техническому долгу прибавляется столько */
  failDebt: number;
}

export interface ThreatKindDef {
  id: ThreatKind;
  /** Шанс, что угроза начнётся в очередном периоде */
  chance: number;
  /** Сколько дней длится: от и до */
  minDays: number;
  maxDays: number;
  /** Давление, пока игрок не ответил или ответил неудачно */
  pressure: ThreatPressure;
  responses: ThreatResponseDef[];
}

/** Опасности большой компании: спад рынка и сильный конкурент. */
export interface ThreatsConfig {
  /** Раз во сколько дней проверяется, не началась ли угроза */
  periodDays: number;
  /** Сколько дней после конца угрозы новая не начинается */
  graceDays: number;
  kinds: ThreatKindDef[];
}

export interface ActiveThreat {
  kind: ThreatKind;
  startDay: number;
  untilDay: number;
  /** Ответ игрока; null — пока не отвечал */
  response: ThreatResponseId | null;
  /** Удался ли ответ; null — ответа не было */
  success: boolean | null;
  /** Сколько заплачено за ответ */
  paid: number;
}

/** Состояние угроз. Необязательное: в старых сохранениях его нет. */
export interface ThreatsState {
  active: ActiveThreat | null;
  /** День, когда кончилась последняя угроза */
  endedDay: number | null;
  /** Последняя закончившаяся угроза */
  last: { kind: ThreatKind; startDay: number; endDay: number; response: ThreatResponseId | null; success: boolean | null } | null;
  /** Сколько угроз уже было */
  count: number;
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
  /** Службы компании за день: поддержка, продажи, администрация, сопровождение. В старых сохранениях поля нет. */
  opsCost?: number;
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
  /** Тема стартапа; нет поля — без темы, как в старых партиях */
  themeId?: string;
  /** Функции, доступные в этой партии, по порядку. Нет поля — все функции типа продукта. */
  featureIds?: string[];
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
  /** Обещанное обновление продукта: объявленное сейчас и последний исход. В старых сохранениях поля нет. */
  release?: ReleaseState;
  /** Охота за звёздами: сделанное предложение и последний ответ. Появляется с первым предложением. */
  headhunt?: HeadhuntState;
  /** Раунды инвестиций: переговоры, обещание инвестору, история. Появляется с первыми переговорами. */
  funding?: FundingState;
  /** Покупка компаний: проверка, идущее присоединение, последний исход. Появляется с первой проверкой или покупкой. */
  acquisitions?: AcquisitionsState;
  /** Маркетинговые акции: идущая сейчас, когда какую запускали, последний исход. В старых сохранениях поля нет. */
  campaigns?: CampaignsState;
  /** Бюджет в день по каналам, кроме поиска: поиск хранится в adSpendPerDay, как раньше */
  adChannels?: Partial<Record<ChannelId, number>>;
  /** Запас статей и гайдов в долларах вложений: приводит людей сам и понемногу устаревает */
  contentStock?: number;
  /** Деньги на вкладе в банке: приносят проценты, в расчёт «денег на счёте» не входят */
  deposit?: number;
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
  /** Набор кода: в какой день считали и какую долю дневной работы игрок уже добавил в этот день */
  typedDay?: number;
  typedToday?: number;
  /** Лента: последние заметные события */
  news?: NewsItem[];
  /** Службы большой компании: под какой доход набраны. Необязательное поле: в старых сохранениях его нет. */
  ops?: OpsState;
  /** Угрозы большой компании. Необязательное поле: в старых сохранениях его нет. */
  threats?: ThreatsState;
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
  /** Тема стартапа (id из настроек) */
  themeId?: string;
  productType: ProductTypeId;
  audienceId: string;
  businessModel: BusinessModel;
  goal: GoalId;
  difficulty: DifficultyId;
}

export type Command =
  | { type: 'setAdSpend'; perDay: number }
  /** Бюджет одного рекламного канала в день */
  | { type: 'setChannelSpend'; channel: ChannelId; perDay: number }
  | { type: 'runCampaign'; campaignId: string }
  | { type: 'announceRelease'; size: ReleaseSizeDef['id']; deadline: ReleaseDeadlineDef['id'] }
  /** Сделать предложение звезде из чужой компании */
  | { type: 'headhunt'; offer: HeadhuntOfferId }
  /** Раунд инвестиций: начать переговоры, торговаться, согласиться, уйти; выкупить долю обратно */
  | { type: 'openRound'; investorId: string }
  | { type: 'counterOffer'; stance: CounterDef['id'] }
  | { type: 'closeRound' }
  | { type: 'leaveRound' }
  | { type: 'buyBack'; share: number }
  /** Покупка компании: заказать проверку; купить за полную цену или предложить меньше */
  | { type: 'checkTarget' }
  | { type: 'buyTarget'; offer: 'full' | 'low' }
  /** Срочно сократить службы компании */
  | { type: 'cutOps'; cut: OpsCutId }
  /** Ответить на угрозу */
  | { type: 'respondThreat'; response: ThreatResponseId }
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
  /** Разговор с сотрудником один на один */
  /** outcome и lines приходят, когда разговор вела нейросеть; без них разговор считается удачным, как раньше */
  | { type: 'talk'; employeeId: number; outcome?: TalkOutcome; lines?: ChatLine[] }
  | { type: 'takeLoan'; amount: number }
  | { type: 'deposit'; amount: number }
  | { type: 'withdraw'; amount: number }
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
  | 'campaignUnavailable'
  | 'releaseUnavailable'
  | 'headhuntUnavailable'
  | 'fundingUnavailable'
  | 'acquisitionUnavailable'
  | 'opsCutUnavailable'
  | 'threatUnavailable'
  | 'notEnoughCash'
  | 'talkTooSoon'
  | 'overLoanLimit'
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
