export type LoanAccountAmountFields = {
  handling_fee?: unknown;
  receiving_amount?: unknown;
  company_cost?: unknown;
};

export type LoanDisbursementFields = {
  handling_fee?: unknown;
  company_cost?: unknown;
};

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const calcLoanAccountNetTotal = (
  accounts: LoanAccountAmountFields[],
): number =>
  accounts.reduce(
    (sum, account) =>
      sum +
      toNumber(account.handling_fee) +
      toNumber(account.receiving_amount) -
      toNumber(account.company_cost),
    0,
  );

export const calcLoanDisbursementDelta = (
  account: LoanDisbursementFields,
): number => -toNumber(account.company_cost) + toNumber(account.handling_fee);

export const calcLoanDisbursementDeltaTotal = (
  accounts: LoanDisbursementFields[],
): number => accounts.reduce((sum, account) => sum + calcLoanDisbursementDelta(account), 0);

export const calcPaidAmountTotal = (
  rows: Array<{ paid_amount?: unknown }>,
): number =>
  rows.reduce((sum, row) => sum + toNumber(row.paid_amount), 0);
