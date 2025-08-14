import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeLinearAmortization, amortizationToCsv } from '@/lib/asset-amortization';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // adapter à la nouvelle contrainte de type
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const asset = await prisma.asset.findFirst({ where: { id, user_id: user.id } });
  if (!asset) return new Response('Not found', { status: 404 });
  const schedule = computeLinearAmortization(Number(asset.amount_ht), asset.duration_years, new Date(asset.acquisition_date));
  const { searchParams } = new URL(_req.url);
  const format = searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  if (format === 'xlsx') {
    const data = schedule.map(r => ({ Annee: r.year, Dotation: r.dotation, Cumul: r.cumul }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Amortissement');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new Response(new Uint8Array(buf), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="amortization-${asset.id}.xlsx"` } });
  }
  const csv = amortizationToCsv(schedule);
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="amortization-${asset.id}.csv"` } });
}
