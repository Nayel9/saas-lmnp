import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth/core';
import * as XLSX from 'xlsx';
import type { Prisma } from '@prisma/client';
import { generateJournalPdf } from '@/lib/journal-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildWhere(userId: string, params: { from?: string|null; to?: string|null; tier?: string|null; q?: string|null; account_code?: string|null; type: 'achat' }) : Prisma.JournalEntryWhereInput {
  const { from, to, tier, q, account_code, type } = params;
  const where: Prisma.JournalEntryWhereInput = { user_id: userId, type };
  if (from || to) where.date = {};
  if (from) (where.date as Prisma.DateTimeFilter).gte = new Date(from);
  if (to) (where.date as Prisma.DateTimeFilter).lte = new Date(to);
  if (tier) where.tier = { contains: tier, mode: 'insensitive' };
  if (q) where.OR = [
    { designation: { contains: q, mode: 'insensitive' } },
    { tier: { contains: q, mode: 'insensitive' } },
    { account_code: { contains: q, mode: 'insensitive' } },
  ];
  if (account_code) where.account_code = { contains: account_code, mode: 'insensitive' };
  return where;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  const { searchParams } = new URL(req.url);
  const formatParam = searchParams.get('format');
  const format = (formatParam === 'xlsx' || formatParam === 'pdf') ? formatParam : 'csv';
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const tier = searchParams.get('tier');
  const q = searchParams.get('q');
  const account_code = searchParams.get('account_code');

  const where = buildWhere(user.id, { from, to, tier, q, account_code, type: 'achat' });
  const rows = await prisma.journalEntry.findMany({ where, orderBy: { date: 'desc' } });

  if (format === 'csv') {
    const header = 'date;designation;tier;account_code;amount;currency\n';
    const body = rows.map(r => [r.date.toISOString().slice(0,10), r.designation, r.tier||'', r.account_code, Number(r.amount), r.currency].join(';')).join('\n');
    return new Response(header + body + (body?'\n':''), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="journal-achats.csv"' }});
  }
  if (format === 'pdf') {
    const pdfBuf = await generateJournalPdf({
      title: 'Journal Achats',
      rows: rows.map(r => ({ date: r.date, designation: r.designation, tier: r.tier, account_code: r.account_code, amount: Number(r.amount) })),
      period: { from, to },
      filters: { tier, account_code, q }
    });
    return new Response(new Uint8Array(pdfBuf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="journal-achats.pdf"' }});
  }
  // XLSX
  const data = rows.map(r => ({
    Date: r.date.toISOString().slice(0,10),
    Designation: r.designation,
    Tier: r.tier || '',
    Compte: r.account_code,
    Montant: Number(r.amount).toString(),
    Devise: r.currency,
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Achats');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="journal-achats.xlsx"' }});
}
