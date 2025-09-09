// Module ledger (placeholder). Pour évolution future.
export interface LedgerEntry {
  date: string; // ISO
  account_code: string;
  designation: string;
  debit: number;
  credit: number;
}

export interface LedgerLine extends LedgerEntry {
  balance: number;
}

/** Calcule le solde cumulatif ligne par ligne. */
export function computeLedger(lines: LedgerEntry[]): LedgerLine[] {
  let running = 0;
  return lines.map((l) => {
    running += l.debit - l.credit;
    return { ...l, balance: running };
  });
}
