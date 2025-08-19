import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../prisma';
import { compute2033C } from './compute2033c';

// Ce test suppose base en mémoire / DB test isolée. On insère puis on supprime.
// Dataset: 706=1000 (vente), 606=300 (achat), 616=50 (achat), 635=20 (achat), 6811=200 (achat)

const userId = '00000000-0000-0000-0000-0000000002033';

beforeAll(async () => {
  // Nettoyage préalable éventuel
  await prisma.journalEntry.deleteMany({ where: { user_id: userId } });
  const baseDate = new Date('2025-01-15');
  await prisma.journalEntry.createMany({ data: [
    { user_id: userId, type: 'vente', date: baseDate, designation: 'Vente test', tier: 'ClientA', account_code: '706', amount: 1000, currency: 'EUR' },
    { user_id: userId, type: 'achat', date: baseDate, designation: 'Achat charges', tier: 'Fourn1', account_code: '606', amount: 300, currency: 'EUR' },
    { user_id: userId, type: 'achat', date: baseDate, designation: 'Assurance', tier: 'Assureur', account_code: '616', amount: 50, currency: 'EUR' },
    { user_id: userId, type: 'achat', date: baseDate, designation: 'Taxe', tier: 'Etat', account_code: '635', amount: 20, currency: 'EUR' },
    { user_id: userId, type: 'achat', date: baseDate, designation: 'Amort', tier: 'Sys', account_code: '6811', amount: 200, currency: 'EUR' },
  ]});
});

afterAll(async () => {
  await prisma.journalEntry.deleteMany({ where: { user_id: userId } });
});

describe('compute2033C', () => {
  it('calcule totaux attendus', async () => {
    const res = await compute2033C({ userId });
    expect(res.totals.produits).toBe(1000); // CA
    expect(res.totals.charges).toBe(370);   // 300 + 50 + 20
    expect(res.totals.amortissements).toBe(200);
    expect(res.totals.resultat).toBe(430);  // 1000 - 370 - 200
  });
});
