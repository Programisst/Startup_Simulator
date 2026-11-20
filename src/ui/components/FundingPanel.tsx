// Раунд инвестиций: позвать инвестора, торговаться за цену доли, выкупить долю обратно. Простой рабочий вид — нужно оформление.
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { fundingView } from '../../core';
import { dec, money } from '../format';
import { useStore } from '../store';

export function FundingPanel() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const view = fundingView(game, content);
  const talks = view.talks;
  const p = view.promise;
  const nameOf = (id: string) => t(`finance.funding.investors.${id}.name`);

  return (
    <section className="panel" data-funding>
      <h3>{t('finance.funding.title')}</h3>
      <p className="muted">{t('finance.funding.lead')}</p>
      <p>
        <b>{t('finance.funding.summary', { valuation: money(view.valuation), share: dec(view.founderSharePct), stake: money(view.stakeValue) })}</b>
      </p>
      <p data-funding-position={view.position.level}>
        {t('finance.funding.position', { level: t(`finance.funding.levels.${view.position.level}`) })}
        {view.position.reasons.length > 0 && `: ${view.position.reasons.map((r) => t(`finance.funding.reasons.${r.id}.${r.sign > 0 ? 'plus' : 'minus'}`)).join(', ')}`}
        . <span className="muted">{t('finance.funding.positionHint')}</span>
      </p>

      {p && (
        <p className="negative" data-funding-promise>
          {t('finance.funding.promiseActive', { now: money(p.now), target: money(p.target), days: p.daysLeft, penalty: dec(p.penaltyPct) })}
        </p>
      )}

      {talks && (
        <div data-funding-talks>
          <p>
            <b>{t('finance.funding.talksTitle', { name: nameOf(talks.investor) })}</b>
          </p>
          {talks.lastCounter && <p className={talks.lastCounter.ok ? 'positive' : 'negative'}>{t(talks.lastCounter.ok ? 'finance.funding.counterOk' : 'finance.funding.counterFail')}</p>}
          <p>{t('finance.funding.offer', { offer: money(talks.offer), share: dec(talks.sharePct), price: talks.pricePct, after: dec(talks.shareAfterPct) })}</p>
          <p className={talks.lastChance ? 'negative' : 'muted'}>
            {talks.lastChance ? t('finance.funding.lastChance') : t('finance.funding.patienceLeft', { count: talks.patience })} {t('finance.funding.daysLeft', { days: talks.daysLeft })}
          </p>
          <p>
            <button data-funding-accept onClick={() => dispatch({ type: 'closeRound' })}>
              {t('finance.funding.accept', { offer: money(talks.offer) })}
            </button>
          </p>
          {talks.counters.map((c) => (
            <p key={c.stance}>
              <button data-funding-counter={c.stance} disabled={c.atMax} onClick={() => dispatch({ type: 'counterOffer', stance: c.stance })}>
                {t(`finance.funding.counters.${c.stance}`)}
              </button>{' '}
              <span>{c.atMax ? t('finance.funding.atMax') : t('finance.funding.counterLine', { offer: money(c.offer), chance: c.chancePct })}</span>
            </p>
          ))}
          <p>
            <button data-funding-leave onClick={() => dispatch({ type: 'leaveRound' })}>
              {t('finance.funding.leave')}
            </button>
          </p>
        </div>
      )}

      {!talks && view.last && (
        <p className={view.last.kind === 'closed' ? '' : 'muted'}>
          {t(`finance.funding.last.${view.last.kind}`, { amount: money(view.last.amount), share: dec(view.last.share * 100) })}
        </p>
      )}

      {!talks && view.blocked && (
        <p className="muted">{t(`finance.funding.blocked.${view.blocked}`, { value: money(view.minValuation), days: view.cooldownDaysLeft })}</p>
      )}

      {!talks &&
        (view.blocked === null || view.blocked === 'energy') &&
        view.investors.map((inv) => (
          <div key={inv.id} data-funding-investor={inv.id}>
            <p>
              <b>{t('finance.funding.investorLine', { name: nameOf(inv.id), offer: money(inv.offer), share: dec(inv.sharePct), price: inv.pricePct, after: dec(inv.shareAfterPct) })}</b>
            </p>
            <p className="muted">
              {t(`finance.funding.investors.${inv.id}.hint`)} {t('finance.funding.patience', { count: inv.patience })}
              {inv.perk && ` ${t('finance.funding.perk', { pct: inv.perk.boostPct, days: inv.perk.days })}`}
            </p>
            {inv.promise && (
              <p className="muted">{t('finance.funding.promiseTerms', { days: inv.promise.days, pct: inv.promise.growthPct, target: money(inv.promise.target), penalty: dec(inv.promise.penaltyPct) })}</p>
            )}
            <p>
              <button data-funding-open={inv.id} disabled={inv.blocked !== null} onClick={() => dispatch({ type: 'openRound', investorId: inv.id })}>
                {t('finance.funding.open')}
              </button>{' '}
              {inv.blocked && inv.blocked !== 'energy' && <span className="negative">{t(`finance.funding.blocked.${inv.blocked}`, { value: money(view.minValuation), days: view.cooldownDaysLeft })}</span>}
            </p>
          </div>
        ))}
      {!talks && view.blocked === null && <p className="muted">{t('finance.funding.energy', { energy: view.energyCost })}</p>}

      {view.founderSharePct < 100 && (
        <div data-funding-buyback>
          <p>
            <b>{t('finance.funding.buyback.title')}</b> <span className="muted">{t('finance.funding.buyback.lead', { price: view.buyback.pricePct })}</span>
          </p>
          <p>
            {view.buyback.options.map((o) => (
              <button key={o.share} data-funding-buy={o.share} disabled={o.blocked !== null} onClick={() => dispatch({ type: 'buyBack', share: o.share })}>
                {t('finance.funding.buyback.option', { share: dec(o.sharePct), cost: money(o.cost) })}
              </button>
            ))}
          </p>
        </div>
      )}

      {view.rounds + view.kept + view.broken > 0 && <p className="muted">{t('finance.funding.stats', { rounds: view.rounds, kept: view.kept, broken: view.broken })}</p>}
    </section>
  );
}
