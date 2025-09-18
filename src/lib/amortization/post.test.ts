import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeMonthlyAmortAmount, postAmortizationForMonth } from './post';
import type { Asset, Amortization } from '@prisma/client';
import { Prisma } from '@prisma/client';

vi.mock('@/lib/prisma', () => ({ prisma: {
  asset: { findFirst: vi.fn(), findMany: vi.fn() },
  amortization: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
} }));

import { prisma } from '@/lib/prisma';

describe('computeMonthlyAmortAmount', () => {
  it('applique un prorata le 1er mois', () => {
    const amount = computeMonthlyAmortAmount({
      amountHT: 1200,
      durationYears: 1,
      acquisitionDate: new Date(Date.UTC(2025, 0, 16)),
      year: 2025,
      month: 1,
    });
    expect(amount).toBeCloseTo(51.61, 2);
  });
  it('0 si hors période', () => {
    const v = computeMonthlyAmortAmount({ amountHT: 1200, durationYears: 1, acquisitionDate: new Date(Date.UTC(2025,0,1)), year: 2026, month: 2 });
    expect(v).toBe(0);
  });
});

describe('postAmortizationForMonth', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('idempotent: 2e appel ne crée rien', async () => {
    const mockAsset: Partial<Asset> = {
      id: 'a1',
      user_id: 'u1',
      label: 'A',
      amount_ht: new Prisma.Decimal(1200),
      duration_years: 1,
      acquisition_date: new Date(Date.UTC(2025,0,1)),
      account_code: '2183',
      created_at: new Date(),
      propertyId: '11111111-1111-1111-1111-111111111111',
    };
    vi.mocked(prisma.asset.findMany).mockResolvedValueOnce([mockAsset as Asset]);
    vi.mocked(prisma.amortization.findMany).mockResolvedValueOnce([]);
    const createdRow: Partial<Amortization> = { id: 'am1' };
    vi.mocked(prisma.amortization.create).mockResolvedValueOnce(createdRow as Amortization);

    const r1 = await postAmortizationForMonth({ userId: 'u1', propertyId: '11111111-1111-1111-1111-111111111111', year: 2025, month: 1, scope: 'property' });
    expect(r1).toEqual({ createdCount: 1, skippedCount: 0 });

    const existingRow: Partial<Amortization> = { note: 'month:2025-01;asset:a1' };
    vi.mocked(prisma.amortization.findMany).mockResolvedValueOnce([existingRow as Amortization]);
    const r2 = await postAmortizationForMonth({ userId: 'u1', propertyId: '11111111-1111-1111-1111-111111111111', year: 2025, month: 1, scope: 'property' });
    expect(r2).toEqual({ createdCount: 0, skippedCount: 1 });
  });

  it('scope=asset exige assetId', async () => {
    await expect(postAmortizationForMonth({ userId: 'u1', propertyId: '11111111-1111-1111-1111-111111111111', year: 2025, month: 1, scope: 'asset' })).rejects.toThrow();
  });
});
