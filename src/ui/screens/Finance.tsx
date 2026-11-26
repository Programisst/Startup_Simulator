import { useTranslation } from 'react-i18next';
import { valuation } from '../../core';
import { AcquisitionPanel } from '../components/AcquisitionPanel';
import { OwnershipCard } from '../components/FinanceParts';
import { FundingPanel } from '../components/FundingPanel';
import { OpsPanel } from '../components/OpsPanel';
import { ThreatPanel } from '../components/ThreatPanel';
import { money, num } from '../format';
import { useStore } from '../store';

export function Finance() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const b = game.lastDay;
  const perMonth = (daily: number) => money(-daily * 30);

  return (
    <div className="screen">
      <OwnershipCard />
      <FundingPanel />
      <AcquisitionPanel />
      <ThreatPanel />
      <OpsPanel />
      <div className="two">
        <section className="panel">
          <h3>{t('finance.monthlyCosts')}</h3>
          <table>
            <tbody>
              <tr><td>{t('finance.living')}</td><td>{perMonth(b.livingCost)}</td></tr>
              <tr><td>{t('finance.rent')}</td><td>{perMonth(b.rentCost ?? 0)}</td></tr>
              <tr><td>{t('finance.salaries')}</td><td>{perMonth(b.salaryCost ?? 0)}</td></tr>
              <tr><td>{t('finance.opsRow')}</td><td>{perMonth(b.opsCost ?? 0)}</td></tr>
              <tr><td>{t('finance.servers')}</td><td>{perMonth(b.serverCost)}</td></tr>
              <tr><td>{t('finance.ads')}</td><td>{perMonth(b.adCost)}</td></tr>
              <tr><td>{t('finance.tools')}</td><td>{perMonth(b.toolsCost)}</td></tr>
              <tr><td>{t('finance.fees')}</td><td>{perMonth(b.feeCost)}</td></tr>
              <tr><td>{t('finance.loans')}</td><td>{perMonth(b.loanCost)}</td></tr>
              <tr><td><b>{t('finance.expenses')}</b></td><td><b>{perMonth(b.expenses)}</b></td></tr>
              <tr><td>{t('finance.revenue')}</td><td>{money(b.revenue * 30)}</td></tr>
              <tr><td>{t('finance.sideIncome')}</td><td>{money(b.sideIncome * 30)}</td></tr>
            </tbody>
          </table>
          <p className="muted">{t('finance.costsHint')}</p>
          <h3>{t('finance.share')}</h3>
          <p>
            <b>{num((game.founderShare ?? 1) * 100)}%</b>
          </p>
          <p className="muted">{t('finance.shareHint', { value: money(valuation(game.months, game.users, game.market) * (game.founderShare ?? 1)) })}</p>
        </section>

        <section className="panel">
          <h3>{t('finance.months')}</h3>
          {game.months.length === 0 ? (
            <p className="muted">{t('finance.noMonths')}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t('finance.month')}</th>
                  <th>{t('finance.revenue')}</th>
                  <th>{t('finance.expenses')}</th>
                  <th>{t('finance.profit')}</th>
                  <th>{t('metrics.cash')}</th>
                </tr>
              </thead>
              <tbody>
                {game.months
                  .slice(-12)
                  .reverse()
                  .map((m) => (
                    <tr key={m.month}>
                      <td>{m.month + 1}</td>
                      <td>{money(m.revenue)}</td>
                      <td>{money(m.expenses)}</td>
                      <td className={m.profit < 0 ? 'negative' : 'positive'}>{money(m.profit)}</td>
                      <td>{money(m.cash)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
