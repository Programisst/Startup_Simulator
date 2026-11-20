// Покупка компаний: проверить, купить, дождаться присоединения. Простой рабочий вид — нужно оформление.
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { acquisitionsView } from '../../core';
import { money, num } from '../format';
import { useStore } from '../store';

export function AcquisitionPanel() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const view = acquisitionsView(game, content);
  const companies = t('finance.acquire.companies', { returnObjects: true }) as string[];
  const companyOf = (seed: number) => companies[seed % companies.length];
  const target = view.target;
  const deal = view.integrating;

  return (
    <section className="panel" data-acquire>
      <h3>{t('finance.acquire.title')}</h3>
      <p className="muted">{t('finance.acquire.lead')}</p>

      {!view.unlocked && <p className="muted">{t('finance.acquire.locked', { value: money(view.minRevenue30) })}</p>}

      {deal && (
        <p>
          <b>{t('finance.acquire.integrating', { company: companyOf(deal.companySeed), price: money(deal.price), users: num(deal.users), days: deal.daysLeft })}</b>
        </p>
      )}

      {!deal && view.last && (
        <p className={view.last.health === 'solid' ? 'positive' : view.last.kind === 'refused' || view.last.health === 'hollow' ? 'negative' : ''}>
          {view.last.kind === 'refused'
            ? t('finance.acquire.last.refused', { company: companyOf(view.last.companySeed) })
            : t(`finance.acquire.last.${view.last.health}`, { company: companyOf(view.last.companySeed), users: num(view.last.users) })}
        </p>
      )}

      {view.nextInDays !== null && <p className="muted">{t('finance.acquire.waiting', { days: view.nextInDays })}</p>}

      {target && (
        <div data-acquire-target={target.size}>
          <p>
            <b>
              {t('finance.acquire.targetLine', {
                company: companyOf(target.companySeed),
                size: t(`finance.acquire.sizes.${target.size}`),
                users: num(target.users),
                price: money(target.price),
                days: target.daysLeft,
              })}
            </b>
          </p>

          {target.health ? (
            <p className={target.health === 'solid' ? 'positive' : 'negative'} data-acquire-health={target.health}>
              {t(`finance.acquire.health.${target.health}`)}
            </p>
          ) : (
            <p className="muted">{t('finance.acquire.unknown')}</p>
          )}

          <ul className="log">
            {target.outcomes
              .filter((o) => !target.health || o.health === target.health)
              .map((o) => (
                <li key={o.health}>
                  {t('finance.acquire.outcome', { name: t(`finance.acquire.healthNames.${o.health}`), odds: o.oddsPct, users: num(o.users), market: num(o.market) })}
                  {o.bugs > 0 && ` ${t('finance.acquire.trouble', { bugs: o.bugs, debt: o.debt })}`}
                  {o.reputation < 0 && ` ${t('finance.acquire.shame', { rep: o.reputation })}`}
                  {o.hiddenDebt > 0 && ` ${t('finance.acquire.hiddenDebt', { cost: money(o.hiddenDebt) })}`}
                </li>
              ))}
          </ul>

          {target.check.state === 'none' && (
            <p>
              <button data-acquire-check disabled={target.check.blocked !== null} onClick={() => dispatch({ type: 'checkTarget' })}>
                {t('finance.acquire.check', { cost: money(target.check.cost), days: target.check.days })}
              </button>{' '}
              {target.check.blocked && <span className="muted">{t(`finance.acquire.checkBlocked.${target.check.blocked}`)}</span>}
            </p>
          )}
          {target.check.state === 'running' && <p>{t('finance.acquire.checking', { days: target.check.daysLeft })}</p>}

          <p>
            <button data-acquire-buy="full" disabled={!target.canBuyFull} onClick={() => dispatch({ type: 'buyTarget', offer: 'full' })}>
              {t('finance.acquire.buyFull', { price: money(target.price) })}
            </button>{' '}
            <button data-acquire-buy="low" disabled={!target.canBuyLow} onClick={() => dispatch({ type: 'buyTarget', offer: 'low' })}>
              {t('finance.acquire.buyLow', { price: money(target.lowPrice), chance: target.lowChancePct })}
            </button>
          </p>
          <p className="muted">{t('finance.acquire.lowHint')}</p>
          {!target.canBuyLow && <p className="negative">{t('finance.acquire.noCash')}</p>}
          {target.overload && <p className="negative">{t('finance.acquire.overload')}</p>}
        </div>
      )}

      {view.bought > 0 && <p className="muted">{t('finance.acquire.bought', { count: view.bought })}</p>}
    </section>
  );
}
