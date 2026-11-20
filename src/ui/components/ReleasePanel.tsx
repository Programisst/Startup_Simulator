// Обещанное обновление: объявить размер и срок, следить, успеваем ли. Простой рабочий вид — нужно оформление.
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { releaseView } from '../../core';
import { num } from '../format';
import { useStore } from '../store';

export function ReleasePanel() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const view = releaseView(game, content);
  const sizes = content.config.releases.sizes;
  const a = view.active;

  return (
    <section className="panel" data-release>
      <h3>{t('product.release.title')}</h3>
      <p className="muted">{t('product.release.lead')}</p>

      {a && (
        <>
          <p>
            <b>
              {t('product.release.active', {
                size: t(`product.release.sizes.${a.size}`).toLowerCase(),
                deadline: t(`product.release.deadlines.${a.deadline}`).toLowerCase(),
                pct: num(a.progress * 100),
                days: a.daysLeft,
              })}
            </b>
          </p>
          <div className="goal-bar" title={`${num(a.progress * 100)}%`}>
            <i style={{ width: `${Math.round(a.progress * 100)}%` }} />
          </div>
          <p className={a.onTrack ? '' : 'negative'}>{!a.hasWork ? t('product.release.noWork') : a.onTrack ? t('product.release.onTrack') : t('product.release.behind')}</p>
          <p className="muted">{t('product.release.stakes', { pct: a.boostPct, rep: a.failReputation })}</p>
          {view.bugs >= view.buggyAt - 3 && <p className="negative">{t('product.release.bugsWarn', { bugs: num(view.bugs), limit: view.buggyAt })}</p>}
        </>
      )}

      {!a && view.last && <p className={view.last.outcome === 'missed' ? 'negative' : ''}>{t(`product.release.last.${view.last.outcome}`)}</p>}
      {!a && view.blocked && view.blocked !== 'busy' && <p className="muted">{t(`product.release.blocked.${view.blocked}`, { days: view.cooldownDaysLeft })}</p>}

      {!a &&
        view.blocked === null &&
        sizes.map((size) => {
          const options = view.options.filter((o) => o.size === size.id);
          const pace = options[0]?.daysAtCurrentPace ?? null;
          const name = t(`product.release.sizes.${size.id}`);
          return (
            <div key={size.id} data-release-size={size.id}>
              <p>
                <b>{pace === null ? t('product.release.sizeStalled', { name }) : t('product.release.sizeLine', { name, days: pace })}</b>
              </p>
              {options.map((o) => (
                <p key={o.deadline}>
                  <button data-release-deadline={o.deadline} onClick={() => dispatch({ type: 'announceRelease', size: o.size, deadline: o.deadline })}>
                    {t('product.release.promise', { deadline: t(`product.release.deadlines.${o.deadline}`), days: o.days })}
                  </button>{' '}
                  <span className="muted">{t('product.release.terms', { pct: o.boostPct, boostDays: o.boostDays, rep: o.failReputation })}</span>
                </p>
              ))}
            </div>
          );
        })}

      {view.shipped > 0 && <p className="muted">{t('product.release.shipped', { count: view.shipped })}</p>}
    </section>
  );
}
