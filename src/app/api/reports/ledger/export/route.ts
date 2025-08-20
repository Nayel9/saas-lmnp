import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/core';
import { getUserRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateLedgerPdf } from '@/lib/ledger-pdf';
import { computeLedger } from '@/lib/ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SQLValue = string | number | Date;
interface RawRow { id: string; date: Date; designation: string; tier: string | null; type: 'achat' | 'vente'; amount: unknown; }

function parseNum(n: unknown): number { if (typeof n === 'number') return n; if (typeof n === 'string') { const v = parseFloat(n); return isNaN(v)?0:v; } if (n && typeof n === 'object' && 'toString' in n) { const v = parseFloat((n as { toString(): string }).toString()); return isNaN(v)?0:v; } return 0; }

interface BaseRow { date: string; designation: string; tier: string; debit: number; credit: number; }

async function fetchLedger(userId: string, account_code: string, params: { from?: string|null; to?: string|null; q?: string|null }): Promise<BaseRow[]> {
  const { from, to, q } = params;
  const whereParts = ['user_id = $1', 'account_code = $2'];
  const values: SQLValue[] = [userId, account_code];
  let idx = 3;
  if (from) { whereParts.push(`date >= $${idx++}`); values.push(new Date(from)); }
  if (to) { whereParts.push(`date <= $${idx++}`); values.push(new Date(to)); }
  if (q) { whereParts.push(`(designation ILIKE $${idx} OR tier ILIKE $${idx})`); values.push('%'+q+'%'); idx++; }
  const sql = `SELECT id, date, designation, tier, type, amount FROM journal_entries WHERE ${whereParts.join(' AND ')} ORDER BY date, created_at, id`;
  const rows = await prisma.$queryRawUnsafe<RawRow[]>(sql, ...values);
  return rows.map(r => ({
    date: r.date.toISOString(),
    designation: r.designation,
    tier: r.tier ?? '',
    debit: r.type === 'achat' ? parseNum(r.amount) : 0,
    credit: r.type === 'vente' ? parseNum(r.amount) : 0,
  }));
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (getUserRole(user) !== 'admin') return new Response('Forbidden', { status: 403 });

  const { searchParams } = new URL(req.url);
  const account_code = searchParams.get('account_code');
  if (!account_code) return new Response('account_code requis', { status: 400 });
  const format = (searchParams.get('format') === 'pdf') ? 'pdf' : 'csv';
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const q = searchParams.get('q');

  const baseRows = await fetchLedger(user.id, account_code, { from, to, q });
  const ledgerLines = computeLedger(baseRows.map(r => ({
    date: r.date,
    account_code,
    designation: r.designation,
    debit: r.debit,
    credit: r.credit,
  })));
  // Conserver l'info tier pour CSV
  const ledgerWithTier = ledgerLines.map((l, i) => ({ ...l, tier: baseRows[i]?.tier || '' }));

  if (format === 'csv') {
    const header = 'date;designation;tier;debit;credit;balance\n';
    const body = ledgerWithTier.map(l => [
      l.date.slice(0,10),
      l.designation.replace(/;/g, ','),
      l.tier.replace(/;/g, ','),
      l.debit ? l.debit.toFixed(2) : '',
      l.credit ? l.credit.toFixed(2) : '',
      l.balance.toFixed(2)
    ].join(';')).join('\n');
    return new Response(header + body + (body?'\n':''), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename=ledger_${account_code}.csv` }});
  }
  const MAX = 5000;
  const truncated = ledgerLines.length > MAX;
  const pdfBuf = await generateLedgerPdf({ account_code, rows: truncated ? ledgerLines.slice(0, MAX) : ledgerLines, period: { from, to }, filters: { q } });
  return new Response(new Uint8Array(pdfBuf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename=ledger_${account_code}.pdf`, ...(truncated ? { 'X-Truncated': 'true' } : {}) }});
}
