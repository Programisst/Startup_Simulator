import { useTranslation } from 'react-i18next';
import { cac } from '../../core';
import { dec, money, num } from '../format';
import { useStore } from '../store';

const PRESETS = [0, 10, 25, 50, 100, 250, 1000];

export function Marketing() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const b = game.lastDay;
  const costPerUser = cac(game.market, game.users);

  return (
    <div className="screen">
      {!game.launched && <p className="notice">{t('marketing.notLaunched')}</p>}

      <div className="two">
        <section className="panel">
          <h3>{t('marketing.adSpend')}</h3>
          <input
            type="number"
            min={0}
            step={5}
            value={game.adSpendPerDay}
            onChange={(e) => dispatch({ type: 'setAdSpend', perDay: Number(e.target.value) })}
          />
          <div className="speeds">
            {PRESETS.map((p) => (
              <button key={p} className={p === game.adSpendPerDay ? 'active' : ''} onClick={() => dispatch({ type: 'setAdSpend', perDay: p })}>
                {money(p)}
              </button>
            ))}
          </div>
          <p className="muted">{t('marketing.perMonth', { value: money(game.adSpendPerDay * 30) })}</p>
          <p>{t('marketing.cac', { value: money(costPerUser) })}</p>
          <p className="muted">{t('marketing.cacHint')}</p>
        </section>

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
    </div>
  );
}
