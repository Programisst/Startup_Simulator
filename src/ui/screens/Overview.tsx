// «Сводка» в стиле игры: деньги крупно с запасом дней и графиком, остальные числа плитками 2×2,
// графики за 90 дней, вчерашний день — бумажным чеком с итогом, рядом лента и события.
import { useTranslation } from 'react-i18next';
import { valuation } from '../../core';
import { Meter } from '../components/FinanceParts';
import { FeedList } from '../components/Feed';
import { LineChart } from '../components/LineChart';
import { dec, gameDate, money, num } from '../format';
import { usePersonName } from '../names';
import { useStore } from '../store';

/** Запас денег, при котором полоска «хватит на …» заполнена целиком. */
const RUNWAY_FULL_DAYS = 180;
/** Меньше стольких дней запаса — карточка денег тревожная. */
const RUNWAY_LOW_DAYS = 30;

export function Overview() {
  const { t } = useTranslation();
  const nameOf = usePersonName();
  const game = useStore((s) => s.game)!;
  const b = game.lastDay;

  const last30 = game.recentDays.slice(-30);
  const revenue30 = last30.reduce((sum, d) => sum + d.revenue, 0);
  const net30 = last30.reduce((sum, d) => sum + d.revenue - d.expenses, 0) + b.sideIncome * last30.length;
  const dailyNet = last30.length > 0 ? net30 / last30.length : 0;
  const runway = dailyNet < 0 && game.cash > 0 ? Math.floor(game.cash / -dailyNet) : null;
  const low = runway !== null && runway < RUNWAY_LOW_DAYS;
  const cashSeries = game.recentDays.map((d) => d.cash);
  const usersSeries = game.recentDays.map((d) => d.users);
  const total = b.revenue + b.sideIncome - b.expenses;

  const tiles = [
    {
      id: 'users',
      label: t('metrics.users'),
      value: num(game.users),
      sub: game.businessModel === 'subscription' ? t('overview.paying', { count: num(game.paying) }) : t(`overview.earnsBy.${game.businessModel}`),
    },
    { id: 'revenue', label: t('metrics.revenue30'), value: money(revenue30), sub: t('overview.perDay', { value: money(dailyNet) }) },
    { id: 'quality', label: t('metrics.quality'), value: num(game.quality), sub: t('overview.reputation', { value: num(game.reputation) }) },
    { id: 'valuation', label: t('metrics.valuation'), value: money(valuation(game.months, game.users, game.market)), sub: t(`goals.${game.goal}`) },
  ];

  return (
    <div className="screen ov">
      <div className="ov-top">
        <section className={`panel ov-cash${low ? ' low' : ''}`} data-ov-cash>
          <div className="fin-eyebrow">{t('metrics.cash')}</div>
          <div className={`ov-cash-big${game.cash < 0 ? ' minus' : ''}`}>{money(game.cash)}</div>
          <div className="ov-cash-sub">{runway !== null ? t('overview.runway', { days: num(runway) }) : dailyNet > 0 ? t('overview.runwayFine') : t('overview.runwayFlat')}</div>
          {runway !== null && <Meter pct={(runway / RUNWAY_FULL_DAYS) * 100} tone={low ? undefined : 'amber'} />}
          {cashSeries.length > 1 && (
            <div className="ov-spark">
              <LineChart values={cashSeries} color="var(--green)" height={44} area />
            </div>
          )}
        </section>
        <div className="ov-tiles">
          {tiles.map((x) => (
            <div key={x.id} className="ov-tile" data-ov-tile={x.id}>
              <span className="fin-eyebrow">{x.label}</span>
              <b>{x.value}</b>
              <small>{x.sub}</small>
            </div>
          ))}
        </div>
      </div>

      {!game.launched && <p className="notice">{t('overview.notLaunched')}</p>}

      <section className="panel ov-charts">
        <h3>{t('overview.last90')}</h3>
        {cashSeries.length < 2 ? (
          <p className="muted fin-small">{t('overview.nothingYet')}</p>
        ) : (
          <div className="ov-chart-pair">
            <div>
              <div className="ov-chart-head">
                <span>{t('metrics.cash')}</span>
                <b className="ov-green">{money(game.cash)}</b>
              </div>
              <LineChart values={cashSeries} color="var(--green)" height={90} area />
            </div>
            <div>
              <div className="ov-chart-head">
                <span>{t('metrics.users')}</span>
                <b className="ov-blue">{num(game.users)}</b>
              </div>
              <LineChart values={usersSeries} color="var(--blue)" height={90} area />
            </div>
          </div>
        )}
      </section>

      <div className="ov-bottom">
        <div className="ov-receipt-wrap">
          <section className="ov-receipt" data-ov-receipt>
            <h3>{t('overview.yesterday')}</h3>
            <div className="ov-receipt-date">{t('top.date', gameDate(Math.max(0, game.day - 1)))}</div>
            <div className="ov-receipt-head">{t('metrics.users')}</div>
            <Line label={t('sources.paid')} value={`+${dec(b.paid)}`} />
            <Line label={t('sources.organic')} value={`+${dec(b.organic)}`} />
            <Line label={t('sources.viral')} value={`+${dec(b.viral)}`} />
            <Line label={t('sources.churned')} value={`−${dec(b.churned)}`} minus={b.churned > 0} />
            <Line label={t('sources.converted')} value={`+${dec(b.converted)}`} />
            <div className="ov-receipt-head">{t('metrics.cash')}</div>
            <Line label={t('finance.revenue')} value={money(b.revenue)} />
            <Line label={t('finance.sideIncome')} value={money(b.sideIncome)} />
            <Line label={t('finance.expenses')} value={money(-b.expenses)} minus={b.expenses > 0} />
            <div className={`ov-receipt-total${total < 0 ? ' minus' : total === 0 ? ' zero' : ''}`} data-ov-total>
              <span>{t('overview.total')}</span>
              <b>{total > 0 ? `+${money(total)}` : money(total)}</b>
            </div>
          </section>
        </div>

        <section className="panel ov-feed">
          <h3>{t('feed.title')}</h3>
          <FeedList />
          <h3>{t('overview.events')}</h3>
          <ul className="log">
            {game.eventLog.length === 0 && <li className="muted">{t('overview.noEvents')}</li>}
            {game.eventLog
              .slice(-8)
              .reverse()
              .map((e, i) => (
                <li key={i}>
                  <span className="muted">{t('top.date', gameDate(e.day))}</span> {t(`events.${e.eventId}.title`, { name: e.subjectNameSeed === undefined ? '' : nameOf(e.subjectNameSeed), feature: !e.featureId ? '…' : e.featureId === 'core' ? t(`productTypes.${game.productType}.core`) : t(`features.${e.featureId}`) })}
                </li>
              ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Строка чека: название, точки до суммы, сумма. */
function Line({ label, value, minus = false }: { label: string; value: string; minus?: boolean }) {
  return (
    <div className="ov-line">
      <span>{label}</span>
      <i aria-hidden="true" />
      <b className={minus ? 'minus' : undefined}>{value}</b>
    </div>
  );
}
