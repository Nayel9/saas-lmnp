import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/core';
import { prisma } from '@/lib/prisma';

const upsertSchema = z.object({
  propertyId: z.string().uuid(),
  categoryKey: z.string().min(1),
  accountId: z.string().min(1)
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthenticated'}, { status: 401 });
  const url = new URL(req.url);
  const propertyId = url.searchParams.get('property');
  if (!propertyId) return NextResponse.json({ error: 'Param property manquant'}, { status: 400 });
  const prop = await prisma.property.findFirst({ where: { id: propertyId, user_id: session.user.id }, select: { id: true }});
  if (!prop) return NextResponse.json({ error: 'Bien inconnu'}, { status: 404 });
  const mappings = await prisma.categoryToAccount.findMany({ where: { propertyId }, include: { account: true }, orderBy: { categoryKey: 'asc' } });
  return NextResponse.json({ mappings });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthenticated'}, { status: 401 });
  let json: unknown; try { json = await req.json(); } catch { return NextResponse.json({ error: 'JSON invalide'}, { status: 400 }); }
  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten()}, { status: 400 });
  const { propertyId, categoryKey, accountId } = parsed.data;
  const prop = await prisma.property.findFirst({ where: { id: propertyId, user_id: session.user.id }, select: { id: true }});
  if (!prop) return NextResponse.json({ error: 'Bien inconnu'}, { status: 404 });
  const acc = await prisma.ledgerAccount.findFirst({ where: { id: accountId, OR: [ { propertyId: null }, { propertyId } ] } });
  if (!acc) return NextResponse.json({ error: 'Compte invalide'}, { status: 400 });
  const existing = await prisma.categoryToAccount.findFirst({ where: { propertyId, categoryKey } });
  let mapping;
  if (existing) {
    mapping = await prisma.categoryToAccount.update({ where: { id: existing.id }, data: { accountId } });
  } else {
    mapping = await prisma.categoryToAccount.create({ data: { propertyId, categoryKey, accountId } });
  }
  return NextResponse.json({ ok: true, mapping });
}

