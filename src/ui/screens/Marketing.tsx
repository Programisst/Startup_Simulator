import { useTranslation } from 'react-i18next';
import { marketingView } from '../../core';
import { content } from '../../content';
import { dec, money, num } from '../format';
import { useStore } from '../store';

// Простой рабочий экран каналов. Нужно оформление.
const PRESETS = [0, 10, 25, 50, 100, 250];

export function Marketing() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const b = game.lastDay;
  const view = marketingView(game, content.config);

  return (
    <div className="screen">
      {!game.launched && <p className="notice">{t('marketing.notLaunched')}</p>}

      <section className="panel">
        <h3>{t('marketing.channelsTitle')}</h3>
        <p className="muted">{t('marketing.channelsLead')}</p>
        <p>{t('marketing.total', { day: money(view.totalPerDay), month: money(view.totalPerMonth) })}</p>
      </section>

      <div className="two">
        {view.channels.map((c) => (
          <section className="panel" key={c.id} data-channel={c.id}>
            <h3>{t(`marketing.channels.${c.id}.name`)}</h3>
            <p className="muted">{t(`marketing.channels.${c.id}.hint`)}</p>
            <label>
              <input
                type="number"
                min={0}
                step={5}
                value={c.spendPerDay}
                aria-label={t(`marketing.channels.${c.id}.name`)}
                onChange={(e) => dispatch({ type: 'setChannelSpend', channel: c.id, perDay: Number(e.target.value) })}
              />{' '}
              {t('marketing.perDay')}
            </label>
            <div className="speeds">
              {PRESETS.map((p) => (
                <button key={p} className={p === c.spendPerDay ? 'active' : ''} onClick={() => dispatch({ type: 'setChannelSpend', channel: c.id, perDay: p })}>
                  {money(p)}
                </button>
              ))}
            </div>
            {c.kind === 'direct' ? (
              <>
                <p>
                  {c.costPerUser !== null
                    ? t('marketing.brings', { users: dec(c.usersPerDay), cost: money(c.costPerUser) })
                    : t('marketing.price', { cost: money(c.baseCostPerUser ?? 0) })}
                </p>
                <p className={c.fit === 'poor' ? 'negative' : 'muted'}>{t(`marketing.fit.${c.fit}`)}</p>
                {c.unpredictable && <p className="muted">{t('marketing.unpredictable')}</p>}
              </>
            ) : (
              <p>
                {view.contentBoost > 0.005
                  ? t('marketing.content.stock', { pct: num(view.contentBoost * 100), cap: num(view.contentCap * 100) })
                  : t('marketing.content.empty')}
              </p>
            )}
            {c.spendPerDay > 0 && c.efficiency < 0.6 && <p className="negative">{t('marketing.heated', { pct: num(c.efficiency * 100) })}</p>}
          </section>
        ))}
      </div>

      <section className="panel">
        <h3>{t('marketing.sources')}</h3>
        <table>
          <tbody>
            <tr><td>{t('sources.paid')}</td><td>+{dec(b.paid)}</td></tr>
            <tr><td>{t('sources.organic')}</td><td>+{dec(b.organic)}</td></tr>
            <tr><td>{t('sources.viral')}</td><td>+{dec(b.viral)}</td></tr>
            <tr><td>{t('sources.churned')}</td><td className="negative">−{dec(b.churned)}</td></tr>
          </tbody>
        </table>
        <p className="muted">{t('marketing.reputation', { value: num(game.reputation) })}</p>
        {game.modifiers.length > 0 && (
          <ul className="log">
            {game.modifiers.map((m, i) => (
              <li key={i}>
                {t(`marketing.modifier.${m.target}`, {
                  pct: `${m.factor >= 1 ? '+' : '−'}${num(Math.abs(m.factor - 1) * 100)}%`,
                  days: m.untilDay - game.day,
                })}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
