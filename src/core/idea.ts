// Разбор идеи, записанной игроком своими словами.
// Работает без нейросети: ищет в тексте знакомые слова и по ним определяет тип продукта,
// аудиторию и способ заработка. Один и тот же текст всегда даёт один и тот же ответ.
// Позже этот же ответ сможет давать AI — формат останется прежним.

import type { BusinessModel, GameContent, ProductTypeId } from './types';

/** Словарь: по каким началам слов узнаётся каждый вариант. */
export interface IdeaLexicon {
  productTypes: Record<ProductTypeId, string[]>;
  /** Ключ — id аудитории */
  audiences: Record<string, string[]>;
  models: Record<BusinessModel, string[]>;
  /** Способ заработка, если в тексте про деньги ничего не сказано */
  defaultModel: Record<ProductTypeId, BusinessModel>;
}

export interface IdeaAnalysis {
  /** null — по тексту не удалось понять, что это за продукт */
  productType: ProductTypeId | null;
  audienceId: string | null;
  businessModel: BusinessModel | null;
}

/** Самая длинная идея, которую хранит игра. */
export const IDEA_MAX_LENGTH = 280;

interface Parsed {
  text: string;
  words: string[];
}

function parse(text: string): Parsed {
  const clean = text.toLowerCase().replace(/ё/g, 'е');
  return { text: clean, words: clean.split(/[^a-zа-я0-9]+/).filter(Boolean) };
}

/** Сколько слов из списка встретилось в тексте. Короткие слова (до 3 букв) должны совпасть целиком. */
function score(p: Parsed, stems: string[] | undefined): number {
  if (!stems) return 0;
  let hits = 0;
  for (const stem of stems) {
    const found = stem.includes(' ')
      ? p.text.includes(stem)
      : stem.length <= 3
        ? p.words.includes(stem)
        : p.words.some((w) => w.startsWith(stem));
    if (found) hits += 1;
  }
  return hits;
}

/** Вариант с наибольшим числом совпадений; при равенстве — тот, что раньше в списке. */
function best<T extends string>(p: Parsed, ids: T[], stems: Record<string, string[]>): T | null {
  let winner: T | null = null;
  let top = 0;
  for (const id of ids) {
    const s = score(p, stems[id]);
    if (s > top) {
      top = s;
      winner = id;
    }
  }
  return winner;
}

/** Аудитория для выбранного типа продукта: по словам из идеи, иначе первая в списке типа. */
export function audienceForIdea(text: string, productType: ProductTypeId, lexicon: IdeaLexicon, content: GameContent): string {
  const ids = content.productTypes[productType].audiences.map((a) => a.id);
  return best(parse(text), ids, lexicon.audiences) ?? ids[0] ?? '';
}

/** Способ заработка: по словам из идеи, иначе обычный для этого типа продукта. */
export function modelForIdea(text: string, productType: ProductTypeId, lexicon: IdeaLexicon): BusinessModel {
  const ids = Object.keys(lexicon.models) as BusinessModel[];
  return best(parse(text), ids, lexicon.models) ?? lexicon.defaultModel[productType];
}

export function analyzeIdea(text: string, lexicon: IdeaLexicon, content: GameContent): IdeaAnalysis {
  const types = Object.keys(content.productTypes) as ProductTypeId[];
  const productType = best(parse(text), types, lexicon.productTypes);
  if (!productType) return { productType: null, audienceId: null, businessModel: null };
  return {
    productType,
    audienceId: audienceForIdea(text, productType, lexicon, content),
    businessModel: modelForIdea(text, productType, lexicon),
  };
}

/** Приводит идею к виду, в котором она хранится в партии. */
export function cleanIdea(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, IDEA_MAX_LENGTH);
}

/** Проверенный ответ о том, что это за продукт. */
export interface IdeaVerdict {
  productType: ProductTypeId;
  audienceId: string;
  businessModel: BusinessModel;
}

/**
 * Проверяет ответ внешнего источника (нейросети) о типе продукта.
 * Чужому ответу игра не доверяет: неизвестный тип — ответ отброшен целиком (null);
 * аудитория или способ заработка не из списка — заменяются разбором по словам.
 */
export function checkIdeaAnswer(raw: unknown, text: string, lexicon: IdeaLexicon, content: GameContent): IdeaVerdict | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const types = Object.keys(content.productTypes) as ProductTypeId[];
  const productType = types.find((t) => t === r.productType);
  if (!productType) return null;
  const audiences = content.productTypes[productType].audiences.map((a) => a.id);
  const models = Object.keys(lexicon.models) as BusinessModel[];
  return {
    productType,
    audienceId: audiences.find((a) => a === r.audienceId) ?? audienceForIdea(text, productType, lexicon, content),
    businessModel: models.find((m) => m === r.businessModel) ?? modelForIdea(text, productType, lexicon),
  };
}

/** Тема по словам идеи: та, у которой совпало больше слов; null — тема не угадывается. */
export function themeForIdea(text: string, themeWords: Record<string, string[]>): string | null {
  return best(parse(text), Object.keys(themeWords), themeWords);
}
