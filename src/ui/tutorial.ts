// Обучение первой партии: какой шаг показывать игроку прямо сейчас — от первого утра до первых денег.
// Шаг выводится из состояния игры, поэтому обучение нельзя «сломать»: что бы игрок ни сделал, подсказка подстроится.

export type TutorialStep =
  | 'goToComputer'
  | 'openProduct'
  | 'queueCore'
  | 'startTime'
  | 'waitCore'
  | 'backToComputer'
  | 'openProductLaunch'
  | 'launch'
  | 'openMarketing'
  | 'setAds'
  | 'resumeTime'
  | 'waitMoney'
  | 'openFinance'
  | 'done';

export interface TutorialInput {
  /** Обучение включено для этой партии */
  active: boolean;
  /** Партия идёт (не окончена) */
  running: boolean;
  /** Игрок сидит за компьютером (или компьютера нет — меню всегда под рукой) */
  computerOpen: boolean;
  /** Открыт раздел «Продукт» */
  onProduct: boolean;
  /** Открыт раздел «Маркетинг» */
  onMarketing: boolean;
  /** Открыт раздел «Финансы» */
  onFinance: boolean;
  /** В этой партии игрок уже заглядывал в «Финансы» */
  financeSeen: boolean;
  /** Время стоит на паузе */
  paused: boolean;
  coreQueued: boolean;
  coreDone: boolean;
  launched: boolean;
  /** Реклама включена */
  adsOn: boolean;
  /** Продукт уже приносит деньги */
  earned: boolean;
}

export function tutorialStep(i: TutorialInput): TutorialStep | null {
  if (!i.active || !i.running) return null;
  if (i.launched) {
    // После запуска — до первых денег: реклама, ожидание, «Финансы».
    if (i.earned) return i.onFinance || i.financeSeen ? 'done' : 'openFinance';
    if (!i.adsOn) return i.onMarketing ? 'setAds' : 'openMarketing';
    return i.paused ? 'resumeTime' : 'waitMoney';
  }
  if (i.coreDone) {
    if (!i.computerOpen) return 'backToComputer';
    return i.onProduct ? 'launch' : 'openProductLaunch';
  }
  if (i.coreQueued) return i.paused ? 'startTime' : 'waitCore';
  if (!i.computerOpen) return 'goToComputer';
  return i.onProduct ? 'queueCore' : 'openProduct';
}

const SEEN_KEY = 'startup-simulator:tutorial-seen';

/** Проходил ли игрок обучение раньше. Если хранилище браузера недоступно — считаем, что нет. */
export function tutorialSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTutorialSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // Не запомнится — обучение просто покажется ещё раз.
  }
}
