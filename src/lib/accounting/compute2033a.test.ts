import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../prisma';
import { compute2033A } from './compute2033a';
import { compute2033E } from './compute2033e';

const userId = '00000000-0000-0000-0000-0000000002035';

beforeAll(async () => {
  await prisma.asset.deleteMany({ where: { user_id: userId } });
  // Asset 1: 20 000 / 10 ans / 2024-04-01
  await prisma.asset.create({ data: { id: 'a1', user_id: userId, label: 'Machine Avril 2024', amount_ht: 20000, duration_years: 10, acquisition_date: new Date('2024-04-01'), account_code: '215' } });
  // Asset 2: 3 000 / 3 ans / 2025-01-15
  await prisma.asset.create({ data: { id: 'a2', user_id: userId, label: 'Mobilier Jan 2025', amount_ht: 3000, duration_years: 3, acquisition_date: new Date('2025-01-15'), account_code: '218' } });
});

afterAll(async () => {
  await prisma.asset.deleteMany({ where: { user_id: userId } });
});

describe('compute2033A', () => {
  it('année 2024: nettes = 20000 - 1500 = 18500', async () => {
    const r2024 = await compute2033A({ userId, year: 2024 });
    expect(r2024.immobilisations_brutes).toBe(20000);
    expect(r2024.amortissements_cumules).toBeCloseTo(1500, 2);
    expect(r2024.immobilisations_nettes).toBeCloseTo(18500, 2);
    expect(r2024.actif_total).toBeCloseTo(r2024.capitaux_propres_equilibrage, 2);
  });
  it('année 2025: brut=23000 cumul=4500 net=18500 (3500 + 1000)', async () => {
    const r2025 = await compute2033A({ userId, year: 2025 });
    expect(r2025.immobilisations_brutes).toBe(23000);
    expect(r2025.amortissements_cumules).toBeCloseTo(4500, 2); // 1500 + 2000 + 1000
    expect(r2025.immobilisations_nettes).toBeCloseTo(18500, 2);
    expect(r2025.actif_total).toBeCloseTo(r2025.capitaux_propres_equilibrage, 2);
  });
  it('cohérence partielle avec compute2033E (dotations)', async () => {
    const e2025 = await compute2033E({ userId, year: 2025 });
    // Dotation 2025: 2000 (machine) + 1000 (mobilier) = 3000
    const totalDotation = e2025.rows.reduce((a,r)=> a + r.dotation_exercice, 0);
    expect(totalDotation).toBeCloseTo(3000, 2);
  });
});

