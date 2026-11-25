// Большое обновление в стиле игры: три карточки размеров, в каждой — три срока кнопками с условиями;
// когда обещание дано — полоска готовности и успеваем ли.
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { releaseView } from '../../core';
import { num } from '../format';
import { useStore } from '../store';
import { Meter } from './FinanceParts';

export function ReleasePanel() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const view = releaseView(game, content);
  const sizes = content.config.releases.sizes;
  const a = view.active;

  return (
    <section className="panel rl" data-release>
      <div className="fin-spread">
        <h3>{t('product.release.title')}</h3>
        {view.shipped > 0 && <span className="muted fin-small">{t('product.release.shipped', { count: view.shipped })}</span>}
      </div>
      <p className="muted fin-small">{t('product.release.lead')}</p>

      {a && (
        <div className={`fin-promise rl-active${a.onTrack ? '' : ' behind'}`}>
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
          <Meter pct={a.progress * 100} tone={a.onTrack ? 'dark' : 'amber'} />
          <p className={a.onTrack ? 'positive' : 'negative'}>{!a.hasWork ? t('product.release.noWork') : a.onTrack ? t('product.release.onTrack') : t('product.release.behind')}</p>
          <p className="muted fin-small">{t('product.release.stakes', { pct: a.boostPct, rep: a.failReputation })}</p>
          {view.bugs >= view.buggyAt - 3 && <p className="negative fin-small">{t('product.release.bugsWarn', { bugs: num(view.bugs), limit: view.buggyAt })}</p>}
        </div>
      )}

      {!a && view.last && <p className={`fin-last ${view.last.outcome === 'missed' ? 'negative' : 'positive'}`}>{t(`product.release.last.${view.last.outcome}`)}</p>}
      {!a && view.blocked && view.blocked !== 'busy' && <p className="muted fin-small">{t(`product.release.blocked.${view.blocked}`, { days: view.cooldownDaysLeft })}</p>}

      {!a && view.blocked === null && (
        <div className="fin-investors rl-sizes">
          {sizes.map((size) => {
            const options = view.options.filter((o) => o.size === size.id);
            const pace = options[0]?.daysAtCurrentPace ?? null;
            const name = t(`product.release.sizes.${size.id}`);
            return (
              <div key={size.id} className="fin-term rl-size" data-release-size={size.id}>
                <b className="rl-size-name">{pace === null ? t('product.release.sizeStalled', { name }) : t('product.release.sizeLine', { name, days: pace })}</b>
                {options.map((o) => (
                  <div key={o.deadline} className="rl-option">
                    <button className={o.deadline === 'exact' ? 'primary' : ''} data-release-deadline={o.deadline} onClick={() => dispatch({ type: 'announceRelease', size: o.size, deadline: o.deadline })}>
                      {t('product.release.promise', { deadline: t(`product.release.deadlines.${o.deadline}`), days: o.days })}
                    </button>
                    <span className="muted fin-small">{t('product.release.terms', { pct: o.boostPct, boostDays: o.boostDays, rep: o.failReputation })}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
