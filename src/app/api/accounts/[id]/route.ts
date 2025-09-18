import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth/core';

const patchSchema = z.object({
  label: z.string().min(1).optional(),
  kind: z.enum(['REVENUE','EXPENSE','ASSET','LIABILITY','TREASURY','TAX']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const acc = await prisma.ledgerAccount.findUnique({ where: { id }, include: { property: true } });
  if (!acc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!acc.isEditable || acc.propertyId === null) return NextResponse.json({ error: 'Compte non modifiable' }, { status: 400 });
  if (acc.property?.user_id !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const updated = await prisma.ledgerAccount.update({ where: { id }, data: { ...parsed.data } });
  return NextResponse.json({ ok: true, account: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const acc = await prisma.ledgerAccount.findUnique({ where: { id }, include: { property: true, entries: { select: { id: true }, take: 1 } } });
  if (!acc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!acc.isEditable || acc.propertyId === null) return NextResponse.json({ error: 'Compte non supprimable' }, { status: 400 });
  if (acc.property?.user_id !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (acc.entries.length) return NextResponse.json({ error: 'Compte utilisé par des écritures' }, { status: 409 });
  await prisma.ledgerAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

