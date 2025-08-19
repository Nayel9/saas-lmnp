import { describe, it, expect } from 'vitest';
import { computeLedger, type LedgerEntry } from './ledger';

describe('computeLedger', () => {
  it('calcule solde cumulatif', () => {
    const rows: LedgerEntry[] = [
      { date: '2025-01-01', account_code: '606', designation: 'A', debit: 100, credit: 0 },
      { date: '2025-01-02', account_code: '606', designation: 'B', debit: 0, credit: 40 },
      { date: '2025-01-03', account_code: '606', designation: 'C', debit: 10, credit: 0 },
    ];
    const computed = computeLedger(rows);
    expect(computed.map(l=>l.balance)).toEqual([100, 60, 70]);
  });
});

