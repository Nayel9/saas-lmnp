import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth/core';

const createSchema = z.object({
  propertyId: z.string().uuid({ message: 'propertyId requis'}),
  code: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['REVENUE','EXPENSE','ASSET','LIABILITY','TREASURY','TAX']),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const url = new URL(req.url);
  const propertyId = url.searchParams.get('property');
  if (!propertyId) return NextResponse.json({ error: 'Param property manquant'}, { status: 400 });
  // vérifier ownership
  const prop = await prisma.property.findFirst({ where: { id: propertyId, user_id: session.user.id }, select: { id: true }});
  if (!prop) return NextResponse.json({ error: 'Bien inconnu'}, { status: 404 });
  const accounts = await prisma.ledgerAccount.findMany({
    where: { OR: [ { propertyId: null }, { propertyId } ] },
    orderBy: { code: 'asc' }
  });
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { propertyId, code, label, kind } = parsed.data;
  const prop = await prisma.property.findFirst({ where: { id: propertyId, user_id: session.user.id }, select: { id: true }});
  if (!prop) return NextResponse.json({ error: 'Bien inconnu'}, { status: 404 });
  try {
    const created = await prisma.ledgerAccount.create({ data: { propertyId, code, label, kind, isEditable: true }});
    return NextResponse.json({ ok: true, account: created });
  } catch (e: unknown) {
    const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code?: string }).code : undefined;
    if (code === 'P2002') return NextResponse.json({ error: 'Code déjà utilisé' }, { status: 409 });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
