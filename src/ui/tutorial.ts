// Обучение первой партии: какой шаг показывать игроку прямо сейчас.
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
  /** Время стоит на паузе */
  paused: boolean;
  coreQueued: boolean;
  coreDone: boolean;
  launched: boolean;
}

export function tutorialStep(i: TutorialInput): TutorialStep | null {
  if (!i.active || !i.running) return null;
  if (i.launched) return 'done';
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
