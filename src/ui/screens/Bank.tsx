// Банк: счёт, кредит, вклад и доля в компании. Отдельная программа на компьютере основателя.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { content } from '../../content';
import { bankView, loanTerms, valuation } from '../../core';
import { money, num } from '../format';
import { useStore } from '../store';

/** Какую часть доступной суммы предлагать взять одной кнопкой. */
const LOAN_SHARES = [0.25, 0.5, 1];

export function Bank() {
  const { t } = useTranslation();
  const game = useStore((s) => s.game)!;
  const dispatch = useStore((s) => s.dispatch);
  const cfg = content.config.bank;
  const view = bankView(game, cfg);
  const [share, setShare] = useState(0.5);
  const [amount, setAmount] = useState('');

  // Сумма кредита: доля от доступного, округлённая до сотен и не меньше минимума банка.
  const loanAmount = Math.max(cfg.minLoan, Math.floor((view.loanLimit * share) / 100) * 100);
  const canBorrow = view.loanLimit >= cfg.minLoan;
  const terms = loanTerms(loanAmount, cfg);
  const sum = Number(amount);
  const validSum = Number.isFinite(sum) && sum > 0;
  const founderShare = game.founderShare ?? 1;

  return (
    <div className="screen bank">
      <div className="cards">
        <div className="card">
          <span>{t('bank.account')}</span>
          <b className={view.cash < 0 ? 'negative' : ''}>{money(view.cash)}</b>
          <small>{t('bank.accountHint')}</small>
        </div>
        <div className="card">
          <span>{t('bank.deposit')}</span>
          <b>{money(view.deposit)}</b>
          <small>{t('bank.depositHint', { income: money(view.depositIncomePerMonth) })}</small>
        </div>
        <div className="card">
          <span>{t('bank.debt')}</span>
          <b className={view.debt > 0 ? 'negative' : ''}>{money(view.debt)}</b>
          <small>{view.debt > 0 ? t('bank.debtHint', { perMonth: money(view.paymentsPerMonth) }) : t('bank.noDebt')}</small>
        </div>
        <div className="card">
          <span>{t('bank.limit')}</span>
          <b>{money(view.loanLimit)}</b>
          <small>{t('bank.limitHint')}</small>
        </div>
      </div>

      <div className="two">
        <section className="panel">
          <h3>{t('bank.loanTitle')}</h3>
          <p className="muted">{t('bank.loanTerms', { rate: num(cfg.loanRateYear * 100), months: terms.months })}</p>
          {canBorrow ? (
            <>
              <div className="speeds" role="group" aria-label={t('bank.loanPick')}>
                {LOAN_SHARES.map((x) => (
                  <button key={x} className={x === share ? 'active' : ''} onClick={() => setShare(x)}>
                    {money(Math.max(cfg.minLoan, Math.floor((view.loanLimit * x) / 100) * 100))}
                  </button>
                ))}
              </div>
              <p>{t('bank.loanResult', { total: money(terms.total), perMonth: money(terms.perMonth) })}</p>
              <button className="primary" data-bank="take" onClick={() => dispatch({ type: 'takeLoan', amount: loanAmount })}>
                {t('bank.take', { amount: money(loanAmount) })}
              </button>
            </>
          ) : (
            <p className="muted">{t('bank.loanNone')}</p>
          )}
          {view.loans.length > 0 && (
            <>
              <h3>{t('bank.loansList')}</h3>
              <ul className="log">
                {view.loans.map((l, i) => (
                  <li key={i}>{t('bank.loanRow', { left: money(l.left), perMonth: money(l.perMonth), days: l.daysLeft })}</li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="panel">
          <h3>{t('bank.depositTitle')}</h3>
          <p className="muted">{t('bank.depositTerms', { rate: num(cfg.depositRateYear * 100) })}</p>
          <label className="salary">
            {t('bank.depositAmount')}
            <input type="number" min={0} step={500} value={amount} data-bank="amount" onChange={(e) => setAmount(e.target.value)} />
          </label>
          <div className="choices">
            <button className="primary" data-bank="put" disabled={!validSum || sum > view.cash} onClick={() => dispatch({ type: 'deposit', amount: sum })}>
              {t('bank.put')}
            </button>
            <button data-bank="withdraw" disabled={!validSum || sum > view.deposit} onClick={() => dispatch({ type: 'withdraw', amount: sum })}>
              {t('bank.withdraw')}
            </button>
            <button data-bank="withdrawAll" disabled={view.deposit <= 0} onClick={() => dispatch({ type: 'withdraw', amount: view.deposit })}>
              {t('bank.withdrawAll')}
            </button>
          </div>

          <h3>{t('bank.shareTitle')}</h3>
          <p>{t('bank.shareLine', { pct: num(founderShare * 100), value: money(valuation(game.months, game.users, game.market) * founderShare) })}</p>
        </section>
      </div>
    </div>
  );
}
