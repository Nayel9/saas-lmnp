import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertAdmin } from '@/lib/auth';
import { compute2033E } from '@/lib/accounting/compute2033e';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yearStr = searchParams.get('year');
  const year = yearStr ? parseInt(yearStr,10) : new Date().getFullYear();
  if (isNaN(year)) return new Response('Bad year', { status: 400 });
  const q = searchParams.get('q');
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  try { assertAdmin(user); } catch { return new Response('Forbidden', { status: 403 }); }
  const result = await compute2033E({ userId: user.id, year, q });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(result.rows.map(r => ({
    Asset: r.label,
    Valeur_Origine: r.valeur_origine.toFixed(2),
    Amort_Ant: r.amortissements_anterieurs.toFixed(2),
    Dotation: r.dotation_exercice.toFixed(2),
    Amort_Cumules: r.amortissements_cumules.toFixed(2),
    Valeur_Nette: r.valeur_nette.toFixed(2)
  })));
  XLSX.utils.book_append_sheet(wb, ws, '2033E');
  const wsMeta = XLSX.utils.json_to_sheet([
    { Cle: 'Year', Valeur: year },
    { Cle: 'Rows', Valeur: result.rows.length },
    { Cle: 'Truncated', Valeur: result.truncated ? 'true':'false' }
  ]);
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Meta');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  const headers: Record<string,string> = {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="2033e-${year}.xlsx"`
  };
  if (result.truncated) headers['X-Truncated'] = 'true';
  return new Response(new Uint8Array(buf), { headers });
}

