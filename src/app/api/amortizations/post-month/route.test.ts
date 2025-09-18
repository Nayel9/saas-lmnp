import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import type { Asset, Amortization } from '@prisma/client';

vi.mock('@/lib/auth/guards', () => ({
  requirePropertyAccess: vi.fn().mockResolvedValue({ user: { id: 'u1', email: 'u1@example.com' }, propertyId: 'p1' }),
}));

vi.mock('@/lib/prisma', () => ({ prisma: {
  asset: { findMany: vi.fn(), findFirst: vi.fn() },
  amortization: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
} }));

import { prisma } from '@/lib/prisma';
import { requirePropertyAccess } from '@/lib/auth/guards';

function makeReq(body: unknown) {
  const url = 'http://test/api/amortizations/post-month';
  return new NextRequest(url, { method: 'POST', body: JSON.stringify(body) });
}

describe('POST /api/amortizations/post-month', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('valide l’input', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it('scope=property crée pour tous les assets', async () => {
    vi.mocked(requirePropertyAccess).mockResolvedValue({ user: { id: 'u1', email: 'u1@example.com' }, propertyId: '11111111-1111-1111-1111-111111111111' });
    const Decimal = (await import('@prisma/client')).Prisma.Decimal;
    const a1: Partial<Asset> = { id: 'a1', user_id: 'u1', propertyId: '11111111-1111-1111-1111-111111111111', amount_ht: new Decimal(1200), duration_years: 1, acquisition_date: new Date(Date.UTC(2025,0,1)), label: 'A' };
    const a2: Partial<Asset> = { id: 'a2', user_id: 'u1', propertyId: '11111111-1111-1111-1111-111111111111', amount_ht: new Decimal(600), duration_years: 1, acquisition_date: new Date(Date.UTC(2025,0,1)), label: 'B' };
    vi.mocked(prisma.asset.findMany).mockResolvedValue([a1 as Asset, a2 as Asset]);
    vi.mocked(prisma.amortization.findMany).mockResolvedValue([]);
    vi.mocked(prisma.amortization.create).mockResolvedValue({ id: 'am1' } as Amortization);

    const res = await POST(makeReq({ propertyId: '11111111-1111-1111-1111-111111111111', year: 2025, month: 1, scope: 'property' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.createdCount).toBe(2);
    expect(body.skippedCount).toBe(0);
  });

  it('scope=asset cible uniquement assetId', async () => {
    vi.mocked(requirePropertyAccess).mockResolvedValue({ user: { id: 'u1', email: 'u1@example.com' }, propertyId: 'p1' });
    const Decimal = (await import('@prisma/client')).Prisma.Decimal;
    const a1: Partial<Asset> = { id: 'ax', user_id: 'u1', propertyId: 'p1', amount_ht: new Decimal(1200), duration_years: 1, acquisition_date: new Date(Date.UTC(2025,0,1)), label: 'AX' };
    vi.mocked(prisma.asset.findFirst).mockResolvedValue(a1 as Asset);
    vi.mocked(prisma.amortization.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.amortization.create).mockResolvedValue({ id: 'amx' } as Amortization);

    const res = await POST(makeReq({ propertyId: 'p1', year: 2025, month: 1, scope: 'asset', assetId: 'ax' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.createdCount).toBe(1);
    expect(body.skippedCount).toBe(0);
  });
});
