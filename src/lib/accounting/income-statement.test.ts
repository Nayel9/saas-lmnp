import { describe, it, expect } from 'vitest';
import { computeIncomeStatementFromEntries } from './income-statement';

describe('computeIncomeStatementFromEntries', () => {
  const year = 2025;
  it('exclut les cautions des revenus', () => {
    const res = computeIncomeStatementFromEntries([
      { type: 'vente', amount: 1000, isDeposit: false, account_code: '706', date: new Date(`${year}-03-10`) },
      { type: 'vente', amount: 200, isDeposit: true, account_code: '706', date: new Date(`${year}-03-12`) },
    ], year);
    expect(res.revenus).toBe(1000);
    expect(res.resultat).toBe(1000);
  });
  it('agrège dépenses et amortissements correctement par année', () => {
    const res = computeIncomeStatementFromEntries([
      { type: 'achat', amount: 300, account_code: '606', date: new Date(`${year}-01-05`) },
      { type: 'achat', amount: 50, account_code: '616', date: new Date(`${year}-02-10`) },
      { type: 'achat', amount: 200, account_code: '6811', date: new Date(`${year}-02-15`) },
      { type: 'achat', amount: 999, account_code: '606', date: new Date(`${year+1}-01-05`) }, // autre année ignorée
      { type: 'vente', amount: 1200, account_code: '706', date: new Date(`${year}-01-10`) },
    ], year);
    expect(res.revenus).toBe(1200);
    expect(res.depenses).toBe(350); // 300 + 50
    expect(res.amortissements).toBe(200);
    expect(res.resultat).toBe(1200 - 350 - 200);
  });
});

