// Запросы рынка: что строить, когда все функции продукта готовы. Простой рабочий вид — нужно оформление.
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { roadmapView, type RequestView } from '../../core';
import { money, num } from '../format';
import { useStore } from '../store';

export function RoadmapPanel() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const view = roadmapView(game, content);
  const nameOf = (source: string, index: number) => (t(`product.roadmap.names.${source}`, { returnObjects: true }) as string[])[index] ?? '';

  if (!view.unlocked) {
    // До выхода на рынок о запросах говорить рано: панель появляется вместе с продуктом.
    if (!game.launched) return null;
    return (
      <section className="panel" data-roadmap="locked">
        <h3>{t('product.roadmap.title')}</h3>
        <p className="muted">{t('product.roadmap.locked', { done: view.featuresDone, total: view.featuresTotal })}</p>
      </section>
    );
  }

  const outcome = (r: RequestView) => {
    if (r.source === 'client') return t('product.roadmap.client', { reward: money(r.reward), days: r.deadlineDays, debt: r.debt, reputation: r.lateReputation });
    const hit =
      r.source === 'users'
        ? t('product.roadmap.hit.users', { churn: r.hit.churnPct, reputation: r.hit.reputation })
        : t('product.roadmap.hit.bet', { market: r.hit.marketPct, days: r.hit.boostDays, boost: r.hit.boostPct, reputation: r.hit.reputation });
    return `${hit} ${t('product.roadmap.flop', { debt: r.flopDebt })}`;
  };

  return (
    <section className="panel" data-roadmap="open">
      <h3>{t('product.roadmap.title')}</h3>
      <p className="muted">{t('product.roadmap.lead')}</p>
      <p className="muted">
        {t('product.roadmap.next', { days: view.nextInDays })} {t('product.roadmap.speed', { work: num(view.workPerDay) })}
      </p>

      {view.inWork.map((w, i) => (
        <p key={i} data-roadmap-work={w.source}>
          <b>{t('product.roadmap.inWork', { name: nameOf(w.source, w.name), pct: num(w.progress * 100) })}</b>
          {w.daysToDeadline !== null && ` ${w.daysToDeadline >= 0 ? t('product.roadmap.deadline', { days: w.daysToDeadline, reward: money(w.reward) }) : t('product.roadmap.overdue')}`}
        </p>
      ))}

      <div className="two">
        {view.requests.map((r) => (
          <div key={r.source} className="panel" data-request={r.source}>
            <span className="muted">{t(`product.roadmap.sources.${r.source}`)}</span>
            <h4>{nameOf(r.source, r.name)}</h4>
            <p>{r.days !== null ? t('product.roadmap.cost', { cost: num(r.cost), days: r.days }) : t('product.roadmap.costNone', { cost: num(r.cost) })}</p>
            <p>
              <b data-request-chance>
                {r.known ? t(`product.roadmap.known.${r.known}`) : r.chancePct >= 100 ? t('product.roadmap.sure') : t('product.roadmap.chance', { pct: r.chancePct })}
              </b>
            </p>
            <p>{outcome(r)}</p>
            {r.tooSlow && !r.taken && <p className="negative">{t('product.roadmap.tooSlow')}</p>}
            <div className="choices">
              <button className="primary" data-request-take={r.source} disabled={r.taken} onClick={() => dispatch({ type: 'takeRequest', source: r.source })}>
                {r.taken ? t('product.roadmap.taken') : t('product.roadmap.take')}
              </button>
              {r.chancePct < 100 && r.check.state === 'none' && (
                <button data-request-check={r.source} disabled={r.check.blocked !== null} onClick={() => dispatch({ type: 'checkRequest', source: r.source })}>
                  {t('product.roadmap.check', { cost: money(view.checkCost) })}
                </button>
              )}
            </div>
            {r.check.state === 'running' && <p className="muted">{t('product.roadmap.checking', { days: r.check.daysLeft })}</p>}
            {r.chancePct < 100 && r.check.state === 'none' && r.check.blocked !== null && r.check.blocked !== 'sure' && (
              <p className="muted">{t(`product.roadmap.checkBlocked.${r.check.blocked}`)}</p>
            )}
          </div>
        ))}
      </div>
      <p className="muted">{t('product.roadmap.checkHint', { days: view.checkDays })}</p>

      {view.built > 0 && <p className="muted">{t('product.roadmap.stats', { built: view.built, hits: view.hits, flops: view.flops })}</p>}
      {view.last && (
        <p className="muted" data-roadmap-last>
          {t(`product.roadmap.last.${view.last.outcome}`, { name: nameOf(view.last.source, view.last.name), cash: money(view.last.cash) })}
        </p>
      )}
    </section>
  );
}
