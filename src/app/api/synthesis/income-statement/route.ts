import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/core';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = z.string().uuid();
const YEAR = z.coerce.number().int().min(2000).max(2100);

function round2(n: number){ return Math.round(n*100)/100; }

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response('Non authentifié', { status: 401 });

  const { searchParams } = new URL(req.url);
  const p = searchParams.get('property') || searchParams.get('propertyId') || undefined;
  const y = searchParams.get('year') ?? undefined;

  if (!p) return new Response('BAD_REQUEST: property requis', { status: 400 });
  const idParse = UUID.safeParse(p);
  if (!idParse.success) return new Response('BAD_REQUEST: property invalide', { status: 400 });
  const yearParse = YEAR.safeParse(y ?? String(new Date().getFullYear()));
  if (!yearParse.success) return new Response('BAD_REQUEST: year invalide', { status: 400 });

  const propertyId = idParse.data;
  const year = yearParse.data;

  // Vérifier que le bien appartient à l'utilisateur
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property || property.user_id !== user.id) {
    return new Response('FORBIDDEN: propriété inconnue', { status: 403 });
  }

  const start = new Date(Date.UTC(year,0,1));
  const end = new Date(Date.UTC(year,11,31,23,59,59,999));

  // Note: le schéma JournalEntry n'a pas de propertyId; on scope par user + année.
  const entries = await prisma.journalEntry.findMany({
    where: { user_id: user.id, date: { gte: start, lte: end } },
    orderBy: { date: 'asc' }
  });

  let revenus = 0, depenses = 0, amortissements = 0;
  for (const e of entries) {
    const d = new Date(e.date as unknown as string | Date);
    if (d < start || d > end) continue; // garde-fou
    const amt = Number(e.amount);
    if (!amt) continue;
    if (e.type === 'vente') {
      if (e.isDeposit) continue; // exclure cautions
      revenus += amt;
    } else if (e.type === 'achat') {
      const isAmort = e.account_code?.startsWith('6811');
      if (isAmort) amortissements += amt; else depenses += amt;
    }
  }
  revenus = round2(revenus); depenses = round2(depenses); amortissements = round2(amortissements);
  const resultat = round2(revenus - depenses - amortissements);

  const body = JSON.stringify({ year, propertyId, revenus, depenses, amortissements, resultat });
  return new Response(body, { headers: { 'Content-Type': 'application/json' } });
}
