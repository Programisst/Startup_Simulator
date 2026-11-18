import { useTranslation } from 'react-i18next';
import { valuation } from '../../core';
import { LineChart } from '../components/LineChart';
import { dec, gameDate, money, num } from '../format';
import { useStore } from '../store';

export function Overview() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const b = game.lastDay;

  const last30 = game.recentDays.slice(-30);
  const revenue30 = last30.reduce((sum, d) => sum + d.revenue, 0);
  const net30 = last30.reduce((sum, d) => sum + d.revenue - d.expenses, 0) + b.sideIncome * last30.length;
  const dailyNet = last30.length > 0 ? net30 / last30.length : 0;
  const runway = dailyNet < 0 && game.cash > 0 ? Math.floor(game.cash / -dailyNet) : null;

  return (
    <div className="screen">
      <div className="cards">
        <div className="card">
          <span>{t('metrics.cash')}</span>
          <b className={game.cash < 0 ? 'negative' : ''}>{money(game.cash)}</b>
          <small>{runway === null ? t('overview.runwayFine') : t('overview.runway', { days: num(runway) })}</small>
        </div>
        <div className="card">
          <span>{t('metrics.users')}</span>
          <b>{num(game.users)}</b>
          <small>{t('overview.paying', { count: num(game.paying) })}</small>
        </div>
        <div className="card">
          <span>{t('metrics.revenue30')}</span>
          <b>{money(revenue30)}</b>
          <small>{t('overview.perDay', { value: money(dailyNet) })}</small>
        </div>
        <div className="card">
          <span>{t('metrics.quality')}</span>
          <b>{num(game.quality)}</b>
          <small>{t('overview.reputation', { value: num(game.reputation) })}</small>
        </div>
        <div className="card">
          <span>{t('metrics.valuation')}</span>
          <b>{money(valuation(game.months, game.users, game.market))}</b>
          <small>{t(`goals.${game.goal}`)}</small>
        </div>
      </div>

      {!game.launched && <p className="notice">{t('overview.notLaunched')}</p>}

      <div className="two">
        <section className="panel">
          <h3>{t('overview.cashChart')}</h3>
          <LineChart values={game.recentDays.map((d) => d.cash)} color="var(--green)" />
        </section>
        <section className="panel">
          <h3>{t('overview.usersChart')}</h3>
          <LineChart values={game.recentDays.map((d) => d.users)} color="var(--blue)" />
        </section>
      </div>

      <div className="two">
        <section className="panel">
          <h3>{t('overview.yesterday')}</h3>
          <table>
            <tbody>
              <tr><td>{t('sources.paid')}</td><td>+{dec(b.paid)}</td></tr>
              <tr><td>{t('sources.organic')}</td><td>+{dec(b.organic)}</td></tr>
              <tr><td>{t('sources.viral')}</td><td>+{dec(b.viral)}</td></tr>
              <tr><td>{t('sources.churned')}</td><td className="negative">−{dec(b.churned)}</td></tr>
              <tr><td>{t('sources.converted')}</td><td>+{dec(b.converted)}</td></tr>
              <tr><td>{t('finance.revenue')}</td><td>{money(b.revenue)}</td></tr>
              <tr><td>{t('finance.sideIncome')}</td><td>{money(b.sideIncome)}</td></tr>
              <tr><td>{t('finance.expenses')}</td><td className="negative">{money(-b.expenses)}</td></tr>
            </tbody>
          </table>
        </section>
        <section className="panel">
          <h3>{t('overview.events')}</h3>
          <ul className="log">
            {game.eventLog.length === 0 && <li className="muted">{t('overview.noEvents')}</li>}
            {game.eventLog
              .slice(-8)
              .reverse()
              .map((e, i) => (
                <li key={i}>
                  <span className="muted">{t('top.date', gameDate(e.day))}</span> {t(`events.${e.eventId}.title`)}
                </li>
              ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
