// Угрозы большой компании: спад рынка и сильный конкурент. Простой рабочий вид — нужно оформление.
// Пока компания мала, панели нет. Когда угроза идёт — что она делает и чем можно ответить.
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { threatView } from '../../core';
import { money, num } from '../format';
import { useStore } from '../store';

export function ThreatPanel() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const view = threatView(game, content);
  const a = view.active;

  if (!a && !view.unlocked) return null;

  if (!a) {
    const chance = (kind: string) => view.yearlyChancePct.find((c) => c.kind === kind)?.pct ?? 0;
    return (
      <section className="panel" data-threat="calm">
        <h3>{t('finance.threats.title')}</h3>
        <p className="muted fin-small">{t('finance.threats.calm', { downturn: chance('downturn'), rival: chance('rival') })}</p>
        {view.last && (
          <p className="muted fin-small">
            {t('finance.threats.last', { name: t(`finance.threats.kinds.${view.last.kind}`), months: num(Math.max(1, Math.round((view.last.endDay - view.last.startDay) / 30))) })}
          </p>
        )}
      </section>
    );
  }

  const answered = a.response ? t(`finance.threats.responses.${a.response}.name`) : '';
  return (
    <section className="panel" data-threat={a.kind}>
      <div className="fin-spread">
        <h3>{t(`finance.threats.kinds.${a.kind}`)}</h3>
        <span className="muted fin-small">{t('finance.threats.daysIn', { days: num(a.daysIn) })}</span>
      </div>
      <p className="fin-small">{t(`finance.threats.lead.${a.kind}`, { from: a.monthsFrom, to: a.monthsTo })}</p>
      <p data-threat-pressure>
        <b>{t('finance.threats.pressure', { users: a.fewerUsersPct, churn: a.moreChurnPct })}</b>
        {a.lessRevenuePct > 0 && <b> {t('finance.threats.pressureRevenue', { pct: a.lessRevenuePct })}</b>}
      </p>

      {a.response !== null && (
        <p data-threat-answer>
          {a.success ? t('finance.threats.answered.won', { name: answered }) : t('finance.threats.answered.lost', { name: answered, paid: money(a.paid) })}
          {a.endsInDays !== null && ` ${t('finance.threats.answered.endsIn', { days: num(a.endsInDays) })}`}
        </p>
      )}

      {a.response === null && (
        <>
          <p className="muted fin-small">{t('finance.threats.choose')}</p>
          <div className="two">
            {a.responses.map((r) => (
              <div key={r.id} className="panel" data-threat-response={r.id}>
                <h4>{t(`finance.threats.responses.${r.id}.name`)}</h4>
                <p className="fin-small">{t(`finance.threats.responses.${r.id}.what`)}</p>
                <p className="fin-small">
                  {r.cost > 0 ? t('finance.threats.cost', { cost: money(r.cost) }) : t('finance.threats.free')}{' '}
                  <b>{r.chancePct >= 100 ? t('finance.threats.sure') : t('finance.threats.chance', { pct: r.chancePct })}</b>
                </p>
                <p className="fin-small">
                  {r.success.fewerUsersPct >= 0
                    ? t('finance.threats.success', { users: r.success.fewerUsersPct, churn: r.success.moreChurnPct })
                    : t('finance.threats.successGain', { users: -r.success.fewerUsersPct, churn: r.success.moreChurnPct })}
                  {r.success.lessRevenuePct > 0 && ` ${t('finance.threats.successRevenue', { pct: r.success.lessRevenuePct, value: money(r.success.lessRevenuePerMonth) })}`}
                  {r.success.endsInDays > 0 && ` ${t('finance.threats.successEnds', { days: r.success.endsInDays })}`}
                </p>
                {r.chancePct < 100 && (
                  <p className="muted fin-small">{r.failDebt > 0 ? t('finance.threats.failDebt', { debt: r.failDebt }) : t('finance.threats.fail')}</p>
                )}
                <button data-threat-respond={r.id} disabled={r.blocked !== null} onClick={() => dispatch({ type: 'respondThreat', response: r.id })}>
                  {t('finance.threats.button')}
                </button>
                {r.blocked !== null && <p className="muted fin-small">{t(`finance.threats.blocked.${r.blocked}`)}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
