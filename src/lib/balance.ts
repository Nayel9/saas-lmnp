export interface BalanceSourceEntry { type: 'achat' | 'vente'; account_code: string; amount: number | string; }
export interface BalanceRow { account_code: string; total_debit: number; total_credit: number; balance: number; }

/**
 * Règle: type achat => débit, type vente => crédit.
 */
export function aggregateBalance(entries: BalanceSourceEntry[]): BalanceRow[] {
  const map = new Map<string, { debit: number; credit: number }>();
  for (const e of entries) {
    const amt = typeof e.amount === 'number' ? e.amount : parseFloat(e.amount);
    if (isNaN(amt)) continue;
    const rec = map.get(e.account_code) || { debit: 0, credit: 0 };
    if (e.type === 'achat') rec.debit += amt; else rec.credit += amt;
    map.set(e.account_code, rec);
  }
  return Array.from(map.entries()).map(([account_code, v]) => ({
    account_code,
    total_debit: Math.round(v.debit * 100) / 100,
    total_credit: Math.round(v.credit * 100) / 100,
    balance: Math.round((v.debit - v.credit) * 100) / 100,
  })).sort((a,b)=> a.account_code.localeCompare(b.account_code));
}

