// Раунд инвестиций в стиле игры: пока продукт не готов — одна строка «откроется позже»;
// потом три инвестора карточками; торг — переписка с инвестором и ответы кнопками.
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { fundingView } from '../../core';
import { dec, money } from '../format';
import { useStore } from '../store';
import { LockedRow, Meter } from './FinanceParts';

/** Цвет «визитки» инвестора. */
const TINT: Record<string, string> = { angels: '#c9952a', fund: '#3d6fd8', strategic: '#5c6270' };
const initials = (name: string) =>
  name
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

function Avatar({ id, name }: { id: string; name: string }) {
  return (
    <span className="fin-ava" style={{ background: TINT[id] ?? '#7b5a43' }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function FundingPanel() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const view = fundingView(game, content);
  const talks = view.talks;
  const p = view.promise;
  const nameOf = (id: string) => t(`finance.funding.investors.${id}.name`);
  const blockedText = (b: NonNullable<typeof view.blocked>) => t(`finance.funding.blocked.${b}`, { value: money(view.minValuation), days: view.cooldownDaysLeft });

  // Ещё рано: продукт не запущен или компания стоит слишком мало.
  if (!talks && (view.blocked === 'notLaunched' || view.blocked === 'valuation')) {
    return (
      <LockedRow
        attr={{ 'data-funding': '' }}
        title={t('finance.funding.title')}
        what={t('finance.locked.funding')}
        when={blockedText(view.blocked)}
        now={view.blocked === 'valuation' ? view.valuation : undefined}
        goal={view.blocked === 'valuation' ? view.minValuation : undefined}
      />
    );
  }

  const level = view.position.level;
  const position = (
    <div className="fin-position" data-funding-position={level}>
      <span>{t('finance.funding.position', { level: t(`finance.funding.levels.${level}`) })}</span>
      <span className={`fin-scale ${level}`} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {view.position.reasons.map((r) => (
        <span key={r.id} className={`fin-tag ${r.sign > 0 ? 'plus' : 'minus'}`}>
          {r.sign > 0 ? '+ ' : '− '}
          {t(`finance.funding.reasons.${r.id}.${r.sign > 0 ? 'plus' : 'minus'}`)}
        </span>
      ))}
    </div>
  );

  return (
    <section className="panel fin-funding" data-funding>
      <div className="fin-spread">
        <h3>{talks ? t('finance.funding.talksTitle', { name: nameOf(talks.investor) }) : t('finance.funding.title')}</h3>
        {!talks && view.blocked === null && <span className="muted fin-small">{t('finance.funding.energy', { energy: view.energyCost })}</span>}
      </div>

      {p && (
        <div className="fin-promise" data-funding-promise>
          <p>{t('finance.funding.promiseActive', { now: money(p.now), target: money(p.target), days: p.daysLeft, penalty: dec(p.penaltyPct) })}</p>
          <Meter pct={(p.now / p.target) * 100} tone="amber" />
        </div>
      )}

      {talks && (
        <div className="fin-meeting" data-funding-talks>
          <div className="fin-chat">
            <div className="fin-chat-head">
              <Avatar id={talks.investor} name={nameOf(talks.investor)} />
              <span className="muted fin-small">{t('finance.funding.daysLeft', { days: talks.daysLeft })}</span>
            </div>
            <div className="fin-chat-log">
              {talks.lastCounter && (
                <>
                  <div className="fin-msg me">{t(`finance.funding.asked.${talks.lastCounter.stance}`)}</div>
                  <div className={`fin-msg them ${talks.lastCounter.ok ? 'positive' : 'negative'}`}>
                    {t(talks.lastCounter.ok ? 'finance.funding.counterOk' : 'finance.funding.counterFail')}
                  </div>
                </>
              )}
              <div className="fin-msg them">{t('finance.funding.offer', { offer: money(talks.offer), share: dec(talks.sharePct), price: talks.pricePct, after: dec(talks.shareAfterPct) })}</div>
              <div className={`fin-msg sys${talks.lastChance ? ' negative' : ''}`}>
                {talks.lastChance ? t('finance.funding.lastChance') : t('finance.funding.patienceLeft', { count: talks.patience })}
              </div>
            </div>
            <div className="fin-replies">
              <button className="primary fin-reply" data-funding-accept onClick={() => dispatch({ type: 'closeRound' })}>
                {t('finance.funding.accept', { offer: money(talks.offer) })}
              </button>
              {talks.counters.map((c) => (
                <button key={c.stance} className="fin-reply" data-funding-counter={c.stance} disabled={c.atMax} onClick={() => dispatch({ type: 'counterOffer', stance: c.stance })}>
                  <b>{t(`finance.funding.counters.${c.stance}`)}</b>
                  <span>{c.atMax ? t('finance.funding.atMax') : t('finance.funding.counterLine', { offer: money(c.offer), chance: c.chancePct })}</span>
                </button>
              ))}
              <button className="fin-reply quiet" data-funding-leave onClick={() => dispatch({ type: 'leaveRound' })}>
                {t('finance.funding.leave')}
              </button>
            </div>
          </div>
          <aside className="fin-deal">
            <div className="fin-eyebrow">{t('finance.funding.onTable')}</div>
            <div className="fin-big">{money(talks.offer)}</div>
            <div className="muted fin-small">{t('finance.funding.terms', { share: dec(talks.sharePct), price: talks.pricePct, after: dec(talks.shareAfterPct) })}</div>
          </aside>
        </div>
      )}

      {!talks && view.last && <p className={view.last.kind === 'closed' ? 'fin-last' : 'fin-last muted'}>{t(`finance.funding.last.${view.last.kind}`, { amount: money(view.last.amount), share: dec(view.last.share * 100) })}</p>}

      {!talks && view.blocked && <p className="muted fin-small">{blockedText(view.blocked)}</p>}

      {!talks && (view.blocked === null || view.blocked === 'energy') && (
        <>
          {position}
          <div className="fin-investors">
            {view.investors.map((inv) => (
              <div key={inv.id} className="fin-term" data-funding-investor={inv.id}>
                <div className="fin-term-head">
                  <Avatar id={inv.id} name={nameOf(inv.id)} />
                  <b>{nameOf(inv.id)}</b>
                </div>
                <div>
                  <div className="fin-amount">{money(inv.offer)}</div>
                  <div className="muted fin-small">{t('finance.funding.terms', { share: dec(inv.sharePct), price: inv.pricePct, after: dec(inv.shareAfterPct) })}</div>
                </div>
                <div className="fin-cond fin-small">
                  {inv.promise
                    ? t('finance.funding.promiseTerms', { days: inv.promise.days, pct: inv.promise.growthPct, target: money(inv.promise.target), penalty: dec(inv.promise.penaltyPct) })
                    : inv.perk
                      ? t('finance.funding.perk', { pct: inv.perk.boostPct, days: inv.perk.days })
                      : t(`finance.funding.investors.${inv.id}.hint`)}
                </div>
                <div className="fin-chance fin-small" title={t('finance.funding.interest', { pct: inv.interestPct })}>
                  <span>{t('finance.funding.chance')}</span>
                  <Meter pct={inv.interestPct} tone="dark" />
                  <b>{inv.interestPct}%</b>
                </div>
                <button className="primary" data-funding-open={inv.id} disabled={inv.blocked !== null} onClick={() => dispatch({ type: 'openRound', investorId: inv.id })}>
                  {t('finance.funding.open', { pct: inv.interestPct })}
                </button>
                {inv.blocked && inv.blocked !== 'energy' && <span className="negative fin-small">{blockedText(inv.blocked)}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      {view.founderSharePct < 100 && (
        <div className="fin-buyback" data-funding-buyback>
          <span className="muted fin-small">
            <b>{t('finance.funding.buyback.title')}</b> {t('finance.funding.buyback.lead', { price: view.buyback.pricePct })}
          </span>
          <div className="fin-row">
            {view.buyback.options.map((o) => (
              <button key={o.share} data-funding-buy={o.share} disabled={o.blocked !== null} onClick={() => dispatch({ type: 'buyBack', share: o.share })}>
                {t('finance.funding.buyback.option', { share: dec(o.sharePct), cost: money(o.cost) })}
              </button>
            ))}
          </div>
        </div>
      )}

      {view.rounds + view.kept + view.broken > 0 && <p className="muted fin-small">{t('finance.funding.stats', { rounds: view.rounds, kept: view.kept, broken: view.broken })}</p>}
    </section>
  );
}
