// Лента: заметные события дня. Считается сравнением состояния до и после шага — без случайности.

import { overload } from './formulas';
import type { GameState, NewsItem } from './types';

const USER_MARKS = [1, 10, 50, 100, 250, 500, 1000, 2500, 5000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
const PAYING_MARKS = [1, 10, 100, 1000, 10_000];
/** Раз во сколько дней после запуска появляется отзыв пользователя. */
export const REVIEW_EVERY_DAYS = 9;
export const REVIEW_VARIANTS = 8;
const NEWS_LIMIT = 40;

/** Самая высокая отметка, которую число пересекло за день, или null. */
function crossed(before: number, after: number, marks: number[]): number | null {
  let hit: number | null = null;
  for (const mark of marks) if (before < mark && after >= mark) hit = mark;
  return hit;
}

/** Что заметного случилось за день. before — состояние утром, after — вечером (день ещё не увеличен). */
export function collectNews(before: GameState, after: GameState): NewsItem[] {
  const day = after.day;
  const news: NewsItem[] = [];

  for (const id of after.doneFeatures) if (!before.doneFeatures.includes(id)) news.push({ day, kind: 'featureDone', id });

  const users = crossed(before.users, after.users, USER_MARKS);
  if (users !== null) news.push({ day, kind: 'users', value: users });
  const paying = crossed(before.paying, after.paying, PAYING_MARKS);
  if (paying !== null) news.push({ day, kind: 'paying', value: paying });

  if (overload(before.users, before.capacity) <= 0 && overload(after.users, after.capacity) > 0) news.push({ day, kind: 'overload' });

  if (after.months.length > before.months.length) {
    const month = after.months[after.months.length - 1]!;
    if (after.launched) news.push({ day, kind: month.profit >= 0 ? 'monthProfit' : 'monthLoss', value: Math.round(Math.abs(month.profit)) });
  }

  // Отзыв пользователя: тон зависит от качества, текст выбирается по дню — у разных партий разные.
  if (after.launched && after.launchDay !== null && after.users >= 5 && day > after.launchDay && (day - after.launchDay) % REVIEW_EVERY_DAYS === 0) {
    const tone = after.quality >= 65 ? 'good' : after.quality >= 40 ? 'mixed' : 'bad';
    news.push({ day, kind: 'review', tone, variant: Math.abs(after.seed + day) % REVIEW_VARIANTS });
  }

  const tiredBelow = 50;
  if ((before.energy ?? 100) >= tiredBelow && (after.energy ?? 100) < tiredBelow) news.push({ day, kind: 'tired' });

  return news;
}

export function withNews(s: GameState, items: NewsItem[]): NewsItem[] {
  return items.length === 0 ? (s.news ?? []) : [...(s.news ?? []), ...items].slice(-NEWS_LIMIT);
}
