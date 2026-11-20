// Лента: что заметного происходит с компанией. Мир откликается на решения игрока.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import type { NewsItem } from '../../core';
import { dec, gameDate, money, num } from '../format';
import { usePersonName } from '../names';
import { useStore } from '../store';

/** Превращает запись ленты в строку для игрока. */
export function useFeedText(): (item: NewsItem) => string {
  const { t } = useTranslation();
  const game = useStore((s) => s.game);
  const nameOf = usePersonName();
  return (item) => {
    switch (item.kind) {
      case 'users':
        return item.value === 1 ? t('feed.items.firstUser') : t('feed.items.users', { value: num(item.value ?? 0) });
      case 'paying':
        return item.value === 1 ? t('feed.items.firstPaying') : t('feed.items.paying', { value: num(item.value ?? 0) });
      case 'featureDone': {
        const name = item.id === 'core' && game ? t(`productTypes.${game.productType}.core`) : t(`features.${item.id}`);
        return t('feed.items.featureDone', { name });
      }
      case 'monthProfit':
      case 'monthLoss':
        return t(`feed.items.${item.kind}`, { value: money(item.value ?? 0) });
      case 'chapter': {
        // Глава пройдена: называем её и следующую, если она есть.
        const index = content.chapters.findIndex((c) => c.id === item.id);
        const next = content.chapters[index + 1];
        const name = t(`goalsLadder.chapters.${item.id}`);
        return next ? t('feed.items.chapter', { name, next: t(`goalsLadder.chapters.${next.id}`) }) : t('feed.items.chapterLast', { name });
      }
      case 'release': {
        const outcome = item.tone === 'good' ? 'OnTime' : item.tone === 'bad' ? 'Missed' : 'Rough';
        return t(`feed.items.release${outcome}`, { pct: num(item.value ?? 0) });
      }
      case 'headhunt':
        return t(item.id === 'joined' ? 'feed.items.headhuntJoined' : 'feed.items.headhuntDeclined', { name: nameOf(item.value ?? 0) });
      case 'funding':
        return t(`feed.items.funding${(item.id ?? '').charAt(0).toUpperCase()}${(item.id ?? '').slice(1)}`, { pct: dec(item.value ?? 0) });
      case 'campaign': {
        const outcome = item.tone === 'good' ? 'Hit' : item.tone === 'bad' ? 'Fail' : 'Ok';
        return t(`feed.items.campaign${outcome}`, { name: t(`marketing.campaigns.items.${item.id}.name`), pct: num(item.value ?? 0) });
      }
      case 'office':
        return t('feed.items.office', { name: t(`office.tiers.${item.id}`) });
      case 'invest':
        return t('feed.items.invest', { value: money(item.value ?? 0) });
      case 'review': {
        const pool = t(`feed.reviews.${item.tone ?? 'mixed'}`, { returnObjects: true }) as string[];
        return t('feed.items.review', { text: pool[(item.variant ?? 0) % pool.length] });
      }
      default:
        return t(`feed.items.${item.kind}`);
    }
  };
}

/** Список последних новостей — панель на экране «Сводка». */
export function FeedList({ limit = 10 }: { limit?: number } = {}) {
  const { t } = useTranslation();
  const news = useStore((s) => s.game?.news) ?? [];
  const text = useFeedText();
  return (
    <ul className="log feed">
      {news.length === 0 && <li className="muted">{t('feed.empty')}</li>}
      {news
        .slice(-limit)
        .reverse()
        .map((item, i) => (
          <li key={`${item.day}-${item.kind}-${i}`} className={`feed-${item.tone ?? item.kind}`}>
            <span className="muted">{t('top.date', gameDate(item.day))}</span> {text(item)}
          </li>
        ))}
    </ul>
  );
}

const SHOW_MS = 5500;
const MAX_SHOWN = 3;

/** Всплывающие новости: новая запись ленты показывается несколько секунд поверх игры. */
export function FeedToasts() {
  const news = useStore((s) => s.game?.news) ?? [];
  const text = useFeedText();
  const lastSeen = useRef(news[news.length - 1]);
  const [shown, setShown] = useState<{ key: number; item: NewsItem }[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    const last = news[news.length - 1];
    if (last === lastSeen.current) return;
    // Показываем только то, что добавилось после последней виденной записи.
    const from = lastSeen.current ? news.lastIndexOf(lastSeen.current) + 1 : Math.max(0, news.length - 1);
    lastSeen.current = last;
    const fresh = news.slice(from).slice(-MAX_SHOWN).map((item) => ({ key: (counter.current += 1), item }));
    if (fresh.length === 0) return;
    setShown((list) => [...list, ...fresh].slice(-MAX_SHOWN));
    const keys = fresh.map((x) => x.key);
    const timer = window.setTimeout(() => setShown((list) => list.filter((x) => !keys.includes(x.key))), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [news]);

  if (shown.length === 0) return null;
  return (
    <div className="feed-toasts" role="log" aria-live="polite">
      {shown.map(({ key, item }) => (
        <div key={key} className={`feed-toast feed-${item.tone ?? item.kind}`}>
          {text(item)}
        </div>
      ))}
    </div>
  );
}
