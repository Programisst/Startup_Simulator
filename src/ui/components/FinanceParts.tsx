// Общие детали экрана «Финансы»: кому принадлежит компания (полоса долей) и строка функции,
// которая ещё не открылась (коротко и с полоской «сколько осталось»).
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { fundingView } from '../../core';
import { dec, money } from '../format';
import { useStore } from '../store';

const LOCK = (
  <svg className="fin-lock" viewBox="0 0 12 12" aria-hidden="true" shapeRendering="crispEdges">
    <path d="M3 5h6v6H3zM4 2h4v1H4zM3 3h1v2H3zM8 3h1v2H8z" fill="currentColor" />
  </svg>
);

/** Полоса долей: сколько компании у основателя, у инвесторов и (во время торга) сколько уйдёт по сделке. */
export function OwnershipCard() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const view = fundingView(game, content);
  const you = view.talks ? view.talks.shareAfterPct : view.founderSharePct;
  const deal = view.talks ? view.founderSharePct - view.talks.shareAfterPct : 0;
  const others = Math.max(0, 100 - view.founderSharePct);
  const note = view.talks ? t('finance.owners.afterDeal') : others === 0 ? t('finance.owners.whole') : null;

  return (
    <section className="panel fin-owners" data-owners>
      <div className="fin-spread">
        <div>
          <div className="fin-eyebrow">{t('finance.owners.title')}</div>
          <div className="fin-big">{money(view.valuation)}</div>
          <div className="muted fin-small">{t('finance.owners.valuation')}</div>
        </div>
        <div className="fin-right">
          <div className="fin-eyebrow">{t('finance.owners.stake')}</div>
          <div className="fin-big fin-you">{money(view.stakeValue)}</div>
          {note && <div className="muted fin-small">{note}</div>}
        </div>
      </div>
      <div className="fin-bar" role="img" aria-label={t('finance.owners.you', { pct: dec(you) })}>
        <b className="fin-bar-you" style={{ flex: you }} title={t('finance.owners.you', { pct: dec(you) })}>
          <span>{t('finance.owners.you', { pct: dec(you) })}</span>
        </b>
        {deal > 0 && (
          <b className="fin-bar-deal" style={{ flex: deal }} title={t('finance.owners.deal', { pct: dec(deal) })}>
            <span>{t('finance.owners.deal', { pct: dec(deal) })}</span>
          </b>
        )}
        {others > 0 && (
          <b className="fin-bar-others" style={{ flex: others }} title={t('finance.owners.others', { pct: dec(others) })}>
            <span>{t('finance.owners.others', { pct: dec(others) })}</span>
          </b>
        )}
      </div>
    </section>
  );
}

/** Функция ещё закрыта: название, что она даёт, когда откроется и полоска до открытия (если есть что считать). */
export function LockedRow({ title, what, when, now, goal, attr }: { title: string; what: string; when: ReactNode; now?: number; goal?: number; attr: Record<string, string> }) {
  const { t } = useTranslation();
  const pct = now !== undefined && goal ? Math.max(0, Math.min(100, (now / goal) * 100)) : null;
  return (
    <section className="panel fin-locked" {...attr}>
      <div className="fin-locked-text">
        <div className="fin-locked-title">
          {LOCK}
          <h3>{title}</h3>
        </div>
        <div className="muted fin-small">{what}</div>
        <div className="fin-small">{when}</div>
      </div>
      {pct !== null && (
        <div className="fin-locked-meter">
          <div className="fin-meter">
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="muted fin-small">{t('finance.locked.progress', { now: money(now!), goal: money(goal!) })}</div>
        </div>
      )}
    </section>
  );
}

/** Полоска «сколько из скольких» в стиле игры. */
export function Meter({ pct, tone }: { pct: number; tone?: 'amber' | 'dark' }) {
  return (
    <div className={`fin-meter${tone ? ` ${tone}` : ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}
