// Службы компании в стиле игры: пока маленькая — строка «откроется позже» с полоской дохода;
// потом — сколько стоят службы, полоса из четырёх служб и что будет дальше.
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { opsView } from '../../core';
import { money } from '../format';
import { useStore } from '../store';
import { LockedRow } from './FinanceParts';

/** Оттенки ореха — от тёмного к светлому, по порядку служб. */
const SHADES = ['#664836', '#8a6a52', '#b39579', '#d8c3a8'];

export function OpsPanel() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const view = opsView(game, content.config);

  if (!view.active) {
    return (
      <LockedRow
        attr={{ 'data-ops': '' }}
        title={t('finance.ops.title')}
        what={t('finance.locked.ops')}
        when={t('finance.ops.locked', { value: money(view.startsAt) })}
        now={view.steadyRevenue}
        goal={view.startsAt}
      />
    );
  }

  const rest = Math.max(0, view.steadyRevenue - view.costPerMonth);
  return (
    <section className="panel fin-ops" data-ops>
      <div className="fin-spread">
        <h3>{t('finance.ops.title')}</h3>
        <span className="fin-cost">{t('finance.ops.perMonth', { cost: money(view.costPerMonth), pct: view.sharePct })}</span>
      </div>
      <p className="muted fin-small">{t('finance.ops.summary', { cost: money(view.costPerMonth), pct: view.sharePct, revenue: money(view.steadyRevenue) })}</p>
      <div className="fin-stack" aria-hidden="true">
        {view.lines.map((line, i) => (
          <i key={line.id} style={{ flex: line.costPerMonth, background: SHADES[i % SHADES.length] }} />
        ))}
        <i className="fin-stack-rest" style={{ flex: rest }} />
      </div>
      <div className="fin-lines">
        {view.lines.map((line, i) => (
          <div key={line.id} data-ops-line={line.id} style={{ '--c': SHADES[i % SHADES.length] } as CSSProperties}>
            <span className="fin-small">{t(`finance.ops.lines.${line.id}`)}</span>
            <b>{money(-line.costPerMonth)}</b>
          </div>
        ))}
      </div>
      <p className="fin-small">{t('finance.ops.next', { cents: view.nextCents })}</p>
      <p className="muted fin-small">{t('finance.ops.lag', { pct: view.attritionPct })}</p>

      {/* Срочное сокращение: простой рабочий вид — нужно оформление. */}
      {view.excessPerMonth > 0 && (
        <div data-ops-cut>
          <h4>{t('finance.ops.cutTitle')}</h4>
          <p>
            <b>{t('finance.ops.excess', { current: money(view.currentRevenue), level: money(view.steadyRevenue), excess: money(view.excessPerMonth) })}</b>
          </p>
          {view.cuts.map((cut) => (
            <div key={cut.id} className="panel" data-ops-cut-option={cut.id}>
              <h4>{t(`finance.ops.cuts.${cut.id}`)}</h4>
              <p className="fin-small">{t('finance.ops.cutTerms', { saving: money(cut.saving), severance: money(cut.severance), months: cut.paybackMonths })}</p>
              <p className="fin-small">
                {t('finance.ops.cutPrice', { reputation: cut.reputation, motivation: cut.motivation })}{' '}
                {t('finance.ops.cutRisk', { pct: cut.riskPct, days: cut.riskDays, churn: cut.riskChurnPct })}
              </p>
              <button data-ops-cut-button={cut.id} disabled={cut.blocked !== null} onClick={() => dispatch({ type: 'cutOps', cut: cut.id })}>
                {t('finance.ops.cutButton', { severance: money(cut.severance) })}
              </button>
              {cut.blocked !== null && <p className="muted fin-small">{t(`finance.ops.cutBlocked.${cut.blocked}`, { days: view.cutCooldownLeft })}</p>}
            </div>
          ))}
        </div>
      )}
      {view.last && (
        <p className="muted fin-small" data-ops-last>
          {t(`finance.ops.last.${view.last.backfired ? 'backfired' : 'done'}`, { severance: money(view.last.severance), saving: money(view.last.saving) })}
        </p>
      )}
    </section>
  );
}
