// Банк: кредит под проценты и вклад. Описание — docs/02-economy.md, раздел 21.

import { revenue30 } from './events';
import type { BankConfig, GameState } from './types';

const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Сколько осталось выплатить по всем займам. */
export function debtLeft(s: GameState): number {
  return round2(s.loans.reduce((sum, l) => sum + l.dailyPayment * Math.max(0, l.untilDay - s.day), 0));
}

/** Сколько банк ещё готов дать: предел зависит от дохода продукта, из него вычитается текущий долг. */
export function loanLimit(s: GameState, cfg: BankConfig): number {
  const limit = cfg.baseLimit + cfg.revenueMultiple * revenue30(s);
  return Math.max(0, Math.floor((limit - debtLeft(s)) / 100) * 100);
}

/** Условия кредита на сумму: сколько вернуть всего и сколько платить в месяц. */
export function loanTerms(amount: number, cfg: BankConfig): { total: number; perMonth: number; months: number } {
  const total = round2(amount * (1 + (cfg.loanRateYear * cfg.loanTermDays) / 360));
  return { total, perMonth: round2((total / cfg.loanTermDays) * 30), months: Math.round(cfg.loanTermDays / 30) };
}

export interface BankView {
  cash: number;
  deposit: number;
  debt: number;
  /** Сколько уходит на выплаты в месяц */
  paymentsPerMonth: number;
  loanLimit: number;
  minLoan: number;
  /** Сколько вклад приносит за месяц при нынешней сумме */
  depositIncomePerMonth: number;
  loans: { perMonth: number; left: number; daysLeft: number }[];
}

export function bankView(s: GameState, cfg: BankConfig): BankView {
  const deposit = s.deposit ?? 0;
  const loans = s.loans.filter((l) => l.untilDay > s.day);
  return {
    cash: s.cash,
    deposit,
    debt: debtLeft(s),
    paymentsPerMonth: round2(loans.reduce((sum, l) => sum + l.dailyPayment, 0) * 30),
    loanLimit: loanLimit(s, cfg),
    minLoan: cfg.minLoan,
    depositIncomePerMonth: round2((deposit * cfg.depositRateYear) / 12),
    loans: loans.map((l) => ({ perMonth: round2(l.dailyPayment * 30), left: round2(l.dailyPayment * (l.untilDay - s.day)), daysLeft: l.untilDay - s.day })),
  };
}

/** Шаг дня: проценты по вкладу; если счёт ушёл в минус, банк сам закрывает его деньгами со вклада. */
export function stepBank(draft: GameState, cfg: BankConfig): void {
  let deposit = draft.deposit ?? 0;
  if (deposit <= 0) return;
  deposit += (deposit * cfg.depositRateYear) / 360;
  if (draft.cash < 0) {
    const cover = Math.min(deposit, -draft.cash);
    deposit -= cover;
    draft.cash = round2(draft.cash + cover);
  }
  draft.deposit = round2(deposit);
}
