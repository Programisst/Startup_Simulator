// Быстрый вход для разработчиков — только при `npm run dev`, в собранной игре его нет.
// При разработке игра сразу ведёт в квартиру с готовой компанией (свои прошлые ответы или простой образец).
// Посмотреть заставку и переписку — ссылка с ?story; в переписке подставлены прошлые ответы — жми Enter.
import type { NewGameSetup, ProductTypeId } from '../../core';
import { chatSetup, choose, DEFAULT_CITY, reply, resolveIdea, startChat } from './chat';

export type Typed = 'idea' | 'audience' | 'name';
export type Answers = Partial<Record<Typed, string>>;
export interface Sample extends Record<Typed, string> {
  productType: ProductTypeId;
}

const KEY = 'startup-sim.dev.answers';

function local(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Пропустить заставку и переписку? Да, если в ссылке нет ?story. Вызывается только при разработке. */
export function wantsSkip(search: string): boolean {
  return !new URLSearchParams(search).has('story');
}

export function lastAnswers(storage: Storage | null = local()): Answers {
  try {
    const raw = storage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as Answers) : {};
  } catch {
    return {};
  }
}

export function rememberAnswer(stage: Typed, text: string, storage: Storage | null = local()): void {
  try {
    storage?.setItem(KEY, JSON.stringify({ ...lastAnswers(storage), [stage]: text }));
  } catch {
    // Нет хранилища — просто не запомним.
  }
}

export function sampleAnswers(t: (key: string) => string): Sample {
  return { idea: t('opening.dev.idea'), audience: t('opening.dev.audience'), name: t('opening.dev.name'), productType: 'marketplace' };
}

/** Город для быстрого входа: из ссылки (?city=sanJose) или обычный. Вызывается только при разработке. */
export function wantedCity(search: string): string | undefined {
  return new URLSearchParams(search).get('city') ?? undefined;
}

/** Партия как после переписки: свои ответы или образец, средний бюджет, обычный город (или названный), цель — выйти в прибыль. */
export function quickSetup(answers: Answers, sample: Sample, seed: number, cityId?: string): NewGameSetup {
  let s = startChat();
  s = reply(s, answers.idea ?? sample.idea);
  s = reply(s, answers.audience ?? sample.audience);
  s = reply(s, answers.name ?? sample.name);
  s = resolveIdea(s, null);
  if (s.stage === 'pickType') s = choose(s, 'saas');
  // Тип продукта у образца известен заранее — не гадаем по словам.
  if (answers.idea === undefined) s = { ...s, productType: sample.productType, audienceId: undefined, businessModel: undefined };
  s = choose(s, 'normal');
  // Неизвестный город кнопкой не выбрать — тогда берётся обычный.
  const picked = choose(s, cityId ?? DEFAULT_CITY ?? '');
  s = choose(picked.stage === 'city' ? choose(s, DEFAULT_CITY ?? '') : picked, 'profit');
  return chatSetup(s, seed, sample.name);
}
