import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../prisma';
import { compute2033E } from './compute2033e';

const userId = '00000000-0000-0000-0000-0000000002034';

beforeAll(async () => {
  await prisma.asset.deleteMany({ where: { user_id: userId } });
  await prisma.asset.create({ data: { id: 'asset1', user_id: userId, label: 'Machine Avril 2024', amount_ht: 20000, duration_years: 10, acquisition_date: new Date('2024-04-01'), account_code: '215' } });
  await prisma.asset.create({ data: { id: 'asset2', user_id: userId, label: 'Mobilier Jan 2025', amount_ht: 6000, duration_years: 5, acquisition_date: new Date('2025-01-10'), account_code: '218' } });
});

afterAll(async () => {
  await prisma.asset.deleteMany({ where: { user_id: userId } });
});

describe('compute2033E', () => {
  it('calcule dotation prorata 2024 (1500) & pleine année 2025 (2000) pour 1er asset', async () => {
    const res2024 = await compute2033E({ userId, year: 2024 });
    const row2024 = res2024.rows.find(r => r.label.includes('Machine'))!;
    expect(row2024.dotation_exercice).toBeCloseTo(1500, 2);
    const res2025 = await compute2033E({ userId, year: 2025 });
    const row2025 = res2025.rows.find(r => r.label.includes('Machine'))!;
    expect(row2025.dotation_exercice).toBeCloseTo(2000, 2);
    // Cumul 2025 = 1500 + 2000 = 3500
    expect(row2025.amortissements_cumules).toBeCloseTo(3500, 2);
  });
  it('calcule multi-assets totaux', async () => {
    const res2025 = await compute2033E({ userId, year: 2025 });
    // Second asset (6000 / 5 ans) => dotation 2025 = 1200
    const mobilier = res2025.rows.find(r => r.label.includes('Mobilier'))!;
    expect(mobilier.dotation_exercice).toBeCloseTo(1200, 2);
    // Totaux dotation 2025 = 2000 (machine) + 1200 (mobilier)
    expect(res2025.totals.dotation_exercice).toBeCloseTo(3200, 2);
  });
});

