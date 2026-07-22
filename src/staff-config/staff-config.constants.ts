export const LIST_TODAY_UNPAID_PINNED_LOAN_IDS_KEY =
  'list.today_unpaid.pinned_loan_ids';

export type PinnedLoanIdsValue = {
  loanIds: number[];
};

export function normalizePinnedLoanIds(value: unknown): number[] {
  if (!value || typeof value !== 'object') return [];
  const loanIds = (value as { loanIds?: unknown }).loanIds;
  if (!Array.isArray(loanIds)) return [];
  const seen = new Set<number>();
  const result: number[] = [];
  for (const item of loanIds) {
    const id = Number(item);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}
