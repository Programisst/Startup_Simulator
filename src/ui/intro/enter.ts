// Вход в игру после заставки. Пока нет переписки с другом, «Новая игра» сразу открывает квартиру
// с готовой компанией, а «Продолжить» — сохранённую партию.
import { ideaSeeds } from '../../content/ideas';
import type { NewGameSetup } from '../../core';
import i18n from '../i18n';
import { useStore } from '../store';

/** Готовая идея, с которой начинается партия, пока игрок не рассказывает свою. */
const QUICK_IDEA = ideaSeeds.find((s) => s.id === 'invoiceSaas')!;

export function quickSetup(seed: number): NewGameSetup {
  return {
    seed,
    companyName: i18n.t('intro.quickName'),
    idea: i18n.t(`new.ideas.${QUICK_IDEA.id}`),
    productType: QUICK_IDEA.productType,
    audienceId: QUICK_IDEA.audienceId,
    businessModel: QUICK_IDEA.businessModel,
    goal: 'profit',
    difficulty: 'normal',
  };
}

/** Что делать после заставки. Сохранения нет — «Продолжить» тоже начинает новую партию, а не пустой экран. */
export function enterGame(choice: 'new' | 'continue', seed: number): void {
  const store = useStore.getState();
  if (choice === 'continue' && store.load()) return;
  store.start(quickSetup(seed));
}
