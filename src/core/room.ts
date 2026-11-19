// Связка расчёта игры с квартирой основателя.
// Квартира (интерфейс) ничего не считает сама: она спрашивает здесь, чем занят основатель,
// что у него в работе и какие есть тревожные сигналы. Состояние игры эти функции не меняют.

import { featuresOf } from './features';
import { overload } from './formulas';
import { coffeeActive, coffeeReady, energyFactor, energyOf, focusOf, founderWorkPerDay } from './founder';
import { teamOf, teamWorkPerDay } from './team';
import type { GameContent, GameState, Task } from './types';

/** Чем сейчас занят основатель. */
export type FounderActivity = 'building' | 'sideJob' | 'idle' | 'broke';

/** Задача, над которой основатель работает прямо сейчас. */
export interface RoomTask {
  kind: Task['kind'];
  /** Для функции продукта — её id, для остальных работ — null */
  featureId: string | null;
  /** Готовность 0…1. У повторяемых работ (ошибки, долг, улучшение) — готовность текущего шага. */
  progress: number;
  /** Сколько игровых дней осталось при нынешнем темпе; null — работа стоит (весь день на подработке). */
  daysLeft: number | null;
}

export interface RoomCalendar {
  /** Номер дня с начала партии, с нуля */
  day: number;
  /** День месяца 1…30 */
  dayOfMonth: number;
  /** Месяц 1…12 */
  month: number;
  /** Год с единицы */
  year: number;
  /** День недели 0…6, где 0 — понедельник. Партия начинается в понедельник. */
  weekday: number;
}

export interface RoomAlerts {
  cashNegative: boolean;
  /** Сколько дней осталось до банкротства; null — счёт не в минусе */
  daysToBankruptcy: number | null;
  /** Пользователей больше, чем выдерживают серверы */
  overloaded: boolean;
  bugs: number;
  debt: number;
  /** id события, которое ждёт ответа игрока, или null */
  pendingEvent: string | null;
}

/** Цифры продукта для экрана ноутбука. */
export interface RoomProduct {
  users: number;
  paying: number;
  quality: number;
  reputation: number;
  /** Доход продукта за последние 30 дней */
  revenue30: number;
}

/** Состояние основателя: силы, темп, кофе. */
export interface RoomFounder {
  /** Силы 0…100 */
  energy: number;
  /** Во сколько раз он сейчас работает от полной силы (без кофе) */
  pace: number;
  /** Устал: работает медленнее */
  tired: boolean;
  /** Вымотан: добавляет ошибки */
  exhausted: boolean;
  /** То же одним словом — для сцены: бодр, устал (зевает, ходит медленнее), вымотан (еле ходит) */
  fatigue: 'fresh' | 'tired' | 'exhausted';
  coffeeActive: boolean;
  /** Сколько дней ещё действует кофе */
  coffeeDaysLeft: number;
  /** Можно ли выпить кофе сейчас и через сколько дней будет можно */
  coffeeReady: boolean;
  coffeeReadyInDays: number;
  /** Сосредоточенность 0…1 от набора кода и прибавка к скорости, которую она сейчас даёт (0.3 = +30%) */
  focus: number;
  focusBoost: number;
}

export interface RoomView {
  calendar: RoomCalendar;
  activity: FounderActivity;
  /** Доля дня, которая уходит на продукт, 0…1 */
  workShare: number;
  rush: boolean;
  task: RoomTask | null;
  /** Сколько всего работ в очереди, включая текущую */
  queued: number;
  launched: boolean;
  /** Основа готова, продукт можно выпускать */
  canLaunch: boolean;
  /** Идёт ли игровое время: false, когда партия окончена или событие ждёт ответа */
  timeRuns: boolean;
  /** Силы основателя и всё, что с ними связано */
  founder: RoomFounder;
  alerts: RoomAlerts;
  product: RoomProduct;
}

const DAYS_IN_MONTH = 30;
const DAYS_IN_YEAR = 360;
const MINUTES_IN_DAY = 1440;
/** Во сколько начинается игровой день в квартире. */
const DAY_START_MINUTES = 8 * 60;

function activityOf(s: GameState): FounderActivity {
  if (s.cash < 0) return 'broke';
  if (s.sideJobShare >= 1) return 'sideJob';
  if (s.tasks.length > 0) return 'building';
  if (s.sideJobShare > 0) return 'sideJob';
  return 'idle';
}

function taskCost(task: Task, s: GameState, content: GameContent): number {
  const cfg = content.config;
  if (task.kind === 'feature') {
    return featuresOf(s, content).find((f) => f.id === task.featureId)?.cost ?? 0;
  }
  if (task.kind === 'bugfix') return cfg.bugfixCost;
  if (task.kind === 'polish') return cfg.polishCost;
  return cfg.refactorCost;
}

function currentTask(s: GameState, content: GameContent): RoomTask | null {
  const task = s.tasks[0];
  if (!task) return null;
  const cfg = content.config;
  const cost = taskCost(task, s, content);
  // Тот же расчёт, что в шаге дня: основатель плюс разработчики, спешка ускоряет всех.
  const workPerDay = (founderWorkPerDay(s, cfg) + teamWorkPerDay(teamOf(s, content), cfg.team)) * (s.rush ? cfg.rushSpeed : 1);
  const left = Math.max(0, cost - task.progress);
  return {
    kind: task.kind,
    featureId: task.kind === 'feature' ? task.featureId : null,
    progress: cost > 0 ? Math.min(1, Math.max(0, task.progress / cost)) : 1,
    // Небольшой допуск, чтобы погрешность дробей не добавляла лишний день.
    daysLeft: workPerDay > 0 ? Math.max(1, Math.ceil(left / workPerDay - 1e-9)) : null,
  };
}

/** Всё, что квартире нужно знать о партии. */
export function roomView(s: GameState, content: GameContent): RoomView {
  const core = featuresOf(s, content).find((f) => f.core);
  const coreReady = core ? s.doneFeatures.includes(core.id) : true;
  const cashNegative = s.cash < 0;
  return {
    calendar: {
      day: s.day,
      dayOfMonth: (s.day % DAYS_IN_MONTH) + 1,
      month: (Math.floor(s.day / DAYS_IN_MONTH) % 12) + 1,
      year: Math.floor(s.day / DAYS_IN_YEAR) + 1,
      weekday: s.day % 7,
    },
    activity: activityOf(s),
    workShare: 1 - s.sideJobShare,
    rush: s.rush,
    task: currentTask(s, content),
    queued: s.tasks.length,
    launched: s.launched,
    canLaunch: !s.launched && coreReady && s.status === 'running',
    timeRuns: s.status === 'running' && s.pendingEvent === null,
    founder: {
      energy: energyOf(s),
      pace: energyFactor(energyOf(s), content.config.founder),
      tired: energyOf(s) < content.config.founder.tiredBelow,
      exhausted: energyOf(s) < content.config.founder.exhaustedBelow,
      fatigue: energyOf(s) < content.config.founder.exhaustedBelow ? 'exhausted' : energyOf(s) < content.config.founder.tiredBelow ? 'tired' : 'fresh',
      coffeeActive: coffeeActive(s),
      coffeeDaysLeft: Math.max(0, (s.coffeeUntilDay ?? 0) - s.day),
      coffeeReady: coffeeReady(s),
      coffeeReadyInDays: Math.max(0, (s.coffeeReadyDay ?? 0) - s.day),
      focus: focusOf(s),
      focusBoost: content.config.founder.focusBonus * focusOf(s),
    },
    alerts: {
      cashNegative,
      daysToBankruptcy: cashNegative ? Math.max(0, content.config.bankruptcyDays - s.negativeCashDays) : null,
      overloaded: overload(s.users, s.capacity) > 0,
      bugs: s.bugs,
      debt: s.debt,
      pendingEvent: s.pendingEvent,
    },
    product: {
      users: s.users,
      paying: s.paying,
      quality: s.quality,
      reputation: s.reputation,
      revenue30: s.recentDays.slice(-DAYS_IN_MONTH).reduce((sum, d) => sum + d.revenue, 0),
    },
  };
}

/**
 * Часы в квартире. Игра считает время целыми днями, а квартире нужны часы и минуты,
 * чтобы менять свет за окном. progress — какая часть текущего игрового дня уже прошла (0…1).
 * Возвращает минуты от полуночи: день начинается в 08:00 и длится ровно сутки.
 */
export function roomClock(progress: number): number {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return Math.floor(DAY_START_MINUTES + p * MINUTES_IN_DAY) % MINUTES_IN_DAY;
}
