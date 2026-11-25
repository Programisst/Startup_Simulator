// Покупка компаний в стиле игры: пока рано — строка «откроется позже» с полоской дохода;
// потом — объявление о продаже: логотип, печать после проверки, что может оказаться внутри, цена и кнопки.
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { acquisitionsView, revenue30Of } from '../../core';
import { CompanyLogo } from '../companyLogo';
import { money, num } from '../format';
import { useStore } from '../store';
import { LockedRow } from './FinanceParts';

const HEALTH_COLOR = { solid: '#3f9a4f', messy: '#d49a1f', hollow: '#c9483d' } as const;

export function AcquisitionPanel() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const view = acquisitionsView(game, content);
  const companies = t('finance.acquire.companies', { returnObjects: true }) as string[];
  const companyOf = (seed: number) => companies[seed % companies.length];
  const target = view.target;
  const deal = view.integrating;

  if (!view.unlocked) {
    return (
      <LockedRow
        attr={{ 'data-acquire': '' }}
        title={t('finance.acquire.title')}
        what={t('finance.locked.acquire')}
        when={t('finance.acquire.locked', { value: money(view.minRevenue30) })}
        now={game.launched ? revenue30Of(game) : 0}
        goal={view.minRevenue30}
      />
    );
  }

  return (
    <section className="panel fin-acquire" data-acquire>
      <div className="fin-spread">
        <h3>{t('finance.acquire.title')}</h3>
        {view.bought > 0 && <span className="muted fin-small">{t('finance.acquire.bought', { count: view.bought })}</span>}
      </div>

      {deal && (
        <p className="fin-last">
          <b>{t('finance.acquire.integrating', { company: companyOf(deal.companySeed), price: money(deal.price), users: num(deal.users), days: deal.daysLeft })}</b>
        </p>
      )}

      {!deal && view.last && (
        <p className={`fin-last ${view.last.health === 'solid' ? 'positive' : view.last.kind === 'refused' || view.last.health === 'hollow' ? 'negative' : ''}`}>
          {view.last.kind === 'refused'
            ? t('finance.acquire.last.refused', { company: companyOf(view.last.companySeed) })
            : t(`finance.acquire.last.${view.last.health}`, { company: companyOf(view.last.companySeed), users: num(view.last.users) })}
        </p>
      )}

      {view.nextInDays !== null && <p className="muted fin-small">{t('finance.acquire.waiting', { days: view.nextInDays })}</p>}

      {target && (
        <div className="fin-listing" data-acquire-target={target.size}>
          <div className="fin-logo">
            <CompanyLogo seed={target.companySeed} />
          </div>
          <div className="fin-listing-body">
            <div className="fin-spread">
              <div className="fin-listing-name">
                «{companyOf(target.companySeed)}» <span className="fin-tag">{t(`finance.acquire.sizes.${target.size}`)}</span>
              </div>
              <span className={`fin-stamp ${target.health ?? 'unknown'}`}>{t(`finance.acquire.stamp.${target.health ?? 'unknown'}`)}</span>
            </div>
            <div className="muted">{t('finance.acquire.listing', { users: num(target.users), days: target.daysLeft })}</div>

            {target.health ? (
              <p className={target.health === 'solid' ? 'positive' : 'negative'} data-acquire-health={target.health}>
                {t(`finance.acquire.health.${target.health}`)}
              </p>
            ) : (
              <>
                <p className="muted fin-small">{t('finance.acquire.unknown')}</p>
                <div className="fin-odds" aria-hidden="true">
                  {target.outcomes.map((o) => (
                    <i key={o.health} style={{ flex: o.oddsPct, background: HEALTH_COLOR[o.health] }} />
                  ))}
                </div>
              </>
            )}

            <ul className="log fin-outcomes">
              {target.outcomes
                .filter((o) => !target.health || o.health === target.health)
                .map((o) => (
                  <li key={o.health} style={{ '--c': HEALTH_COLOR[o.health] } as CSSProperties}>
                    {t('finance.acquire.outcome', { name: t(`finance.acquire.healthNames.${o.health}`), odds: o.oddsPct, users: num(o.users), market: num(o.market) })}
                    {o.bugs > 0 && ` ${t('finance.acquire.trouble', { bugs: o.bugs, debt: o.debt })}`}
                    {o.reputation < 0 && ` ${t('finance.acquire.shame', { rep: o.reputation })}`}
                    {o.hiddenDebt > 0 && ` ${t('finance.acquire.hiddenDebt', { cost: money(o.hiddenDebt) })}`}
                  </li>
                ))}
            </ul>
          </div>

          <div className="fin-buy">
            <div className="fin-eyebrow">{t('finance.acquire.price')}</div>
            <div className="fin-big">{money(target.price)}</div>
            {target.check.state === 'none' && (
              <button data-acquire-check disabled={target.check.blocked !== null} onClick={() => dispatch({ type: 'checkTarget' })}>
                {t('finance.acquire.check', { cost: money(target.check.cost), days: target.check.days })}
              </button>
            )}
            {target.check.state === 'none' && target.check.blocked && <span className="muted fin-small">{t(`finance.acquire.checkBlocked.${target.check.blocked}`)}</span>}
            {target.check.state === 'running' && <p className="fin-small">{t('finance.acquire.checking', { days: target.check.daysLeft })}</p>}
            <button className="primary" data-acquire-buy="full" disabled={!target.canBuyFull} onClick={() => dispatch({ type: 'buyTarget', offer: 'full' })}>
              {t('finance.acquire.buyFull', { price: money(target.price) })}
            </button>
            <button data-acquire-buy="low" disabled={!target.canBuyLow} onClick={() => dispatch({ type: 'buyTarget', offer: 'low' })}>
              {t('finance.acquire.buyLow', { price: money(target.lowPrice), chance: target.lowChancePct })}
            </button>
            <span className="muted fin-small">{t('finance.acquire.lowHint')}</span>
            {!target.canBuyLow && <span className="negative fin-small">{t('finance.acquire.noCash')}</span>}
            {target.overload && <span className="negative fin-small">{t('finance.acquire.overload')}</span>}
            {target.strained && (
              <span className="negative fin-small" data-acquire-strained>
                {t('finance.acquire.strained', { bugs: num(game.bugs), debt: num(game.debt) })}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
