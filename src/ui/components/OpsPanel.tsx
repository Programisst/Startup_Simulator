// Службы компании: расходы, которые растут вместе с доходом. Простой рабочий вид — нужно оформление.
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { opsView } from '../../core';
import { money } from '../format';
import { useStore } from '../store';

export function OpsPanel() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const view = opsView(game, content.config);

  return (
    <section className="panel" data-ops>
      <h3>{t('finance.ops.title')}</h3>
      <p className="muted">{t('finance.ops.lead')}</p>

      {!view.active && <p className="muted">{t('finance.ops.locked', { value: money(view.startsAt) })}</p>}

      {view.active && (
        <>
          <p>
            <b>{t('finance.ops.summary', { cost: money(view.costPerMonth), pct: view.sharePct, revenue: money(view.steadyRevenue) })}</b>
          </p>
          <table>
            <tbody>
              {view.lines.map((line) => (
                <tr key={line.id} data-ops-line={line.id}>
                  <td>{t(`finance.ops.lines.${line.id}`)}</td>
                  <td>{money(-line.costPerMonth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>{t('finance.ops.next', { cents: view.nextCents })}</p>
          <p className="muted">{t('finance.ops.lag')}</p>
        </>
      )}
    </section>
  );
}
