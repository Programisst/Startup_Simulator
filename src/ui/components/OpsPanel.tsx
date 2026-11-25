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
      <p className="muted fin-small">{t('finance.ops.lag')}</p>
    </section>
  );
}
