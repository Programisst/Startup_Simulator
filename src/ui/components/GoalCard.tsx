// Ближайшая цель компании: что делать дальше, сколько осталось и что за это дадут.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { milestoneView } from '../../core';
import { money, num } from '../format';
import { useStore } from '../store';

function useGoal() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const view = milestoneView(game, content);
  const def = view.current ? content.milestones.find((m) => m.id === view.current!.id) : undefined;
  const asMoney = def?.progress?.metric === 'revenue30';
  const show = (x: number) => (asMoney ? money(x) : num(x));
  return {
    t,
    view,
    hasProgress: Boolean(def?.progress),
    progressText: view.current ? t('goalsLadder.progress', { value: show(Math.min(view.current.value, view.current.target)), target: show(view.current.target) }) : '',
    rewardText: view.current ? t('goalsLadder.reward', { value: view.current.cashReward > 0 ? money(view.current.cashReward) : t('goalsLadder.rewardFame') }) : '',
  };
}

/** Карточка цели. variant задаёт только оформление: в квартире и в программе «Компания» оно разное. */
export function GoalCard({ variant }: { variant: 'room' | 'app' }) {
  const { t, view, hasProgress, progressText, rewardText } = useGoal();
  const cur = view.current;
  return (
    <div className={`goal goal-${variant}`}>
      <span className="goal-label goal-chapter">
        {t('goalsLadder.chapterLine', { index: view.chapter.index + 1, total: view.chapter.total, name: t(`goalsLadder.chapters.${view.chapter.id}`) })}
      </span>
      <span className="goal-label">
        {t('goalsLadder.title')} · {t('goalsLadder.count', { done: view.done.length, total: view.total })}
      </span>
      {cur ? (
        <>
          <b>{t(`goalsLadder.items.${cur.id}.title`)}</b>
          {hasProgress && (
            <div className="goal-bar" title={progressText}>
              <i style={{ width: `${cur.share * 100}%` }} />
            </div>
          )}
          <span className="goal-hint">{t(`goalsLadder.items.${cur.id}.hint`)}</span>
          <span className="goal-meta">
            {hasProgress ? `${progressText} · ` : ''}
            {rewardText}
          </span>
        </>
      ) : (
        <b>{t('goalsLadder.allDone')}</b>
      )}
    </div>
  );
}

/** Уведомление «цель достигнута»: всплывает на несколько секунд, когда в партии появляется новая отметка. */
export function GoalToast() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const done = game.milestones ?? [];
  const seen = useRef(done.length);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    // Загруженная или новая партия: старые отметки не показываем заново.
    if (done.length < seen.current) seen.current = done.length;
    if (done.length === seen.current) return;
    seen.current = done.length;
    const last = done[done.length - 1];
    if (!last) return;
    setShown(last.id);
    const timer = window.setTimeout(() => setShown(null), 6000);
    return () => window.clearTimeout(timer);
  }, [done]);

  if (!shown) return null;
  const def = content.milestones.find((m) => m.id === shown);
  const cash = def?.effects.reduce((sum, e) => (e.type === 'cash' ? sum + e.amount : sum), 0) ?? 0;
  return (
    <div className="goal-toast" role="status" aria-live="polite">
      <span className="goal-toast-mark" aria-hidden="true">
        ✓
      </span>
      <div>
        <span className="goal-label">{t('goalsLadder.done')}</span>
        <b>{t(`goalsLadder.items.${shown}.title`)}</b>
        <span className="goal-meta">{t('goalsLadder.reward', { value: cash > 0 ? money(cash) : t('goalsLadder.rewardFame') })}</span>
      </div>
    </div>
  );
}
