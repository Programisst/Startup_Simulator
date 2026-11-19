// Какие функции доступны в партии. Раньше у типа продукта был один список на все партии;
// теперь в партию попадают основа, функции темы и случайная часть общих функций типа.

import { createRng, nextInt } from './rng';
import type { FeatureDef, GameContent, GameState, ProductTypeId, ThemeDef } from './types';

/** Сдвиг seed: выбор функций не должен совпадать со случайностью рынка и найма. */
const FEATURE_SEED_SALT = 0x7e3a11;

export function themeOf(themeId: string | undefined, content: GameContent): ThemeDef | null {
  return content.themes.find((t) => t.id === themeId) ?? null;
}

/** Все функции, которые вообще могут встретиться у этого типа и темы. */
function pool(productType: ProductTypeId, themeId: string | undefined, content: GameContent): FeatureDef[] {
  return [...content.features[productType], ...(themeOf(themeId, content)?.features ?? [])];
}

/** Составляет список функций новой партии: основа, все функции темы и часть общих — у каждой партии своя. */
export function pickFeatures(seed: number, productType: ProductTypeId, themeId: string | undefined, content: GameContent): string[] {
  const own = content.features[productType];
  const theme = themeOf(themeId, content);
  // Без темы партия играется по-старому: со всеми функциями типа.
  if (!theme) return own.map((f) => f.id);

  const core = own.filter((f) => f.core);
  const rest = own.filter((f) => !f.core);
  let rng = createRng(seed ^ FEATURE_SEED_SALT);
  const chosen: FeatureDef[] = [];
  const left = [...rest];
  while (chosen.length < content.config.founder.genericFeaturesPerGame && left.length > 0) {
    const roll = nextInt(rng, 0, left.length - 1);
    rng = roll.next;
    chosen.push(left.splice(roll.value, 1)[0]!);
  }
  // Функции темы и общие перемешиваются, чтобы список не выглядел как «сначала одно, потом другое».
  const mixed = [...theme.features, ...chosen];
  for (let i = mixed.length - 1; i > 0; i--) {
    const roll = nextInt(rng, 0, i);
    rng = roll.next;
    [mixed[i], mixed[roll.value]] = [mixed[roll.value]!, mixed[i]!];
  }
  return [...core, ...mixed].map((f) => f.id);
}

/** Функции этой партии, по порядку. В старых сохранениях списка нет — берутся все функции типа. */
export function featuresOf(s: Pick<GameState, 'productType' | 'themeId' | 'featureIds'>, content: GameContent): FeatureDef[] {
  if (!s.featureIds) return content.features[s.productType];
  const all = pool(s.productType, s.themeId, content);
  return s.featureIds.map((id) => all.find((f) => f.id === id)).filter((f): f is FeatureDef => f !== undefined);
}
