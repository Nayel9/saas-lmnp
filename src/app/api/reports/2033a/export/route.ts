import { auth } from '@/lib/auth/core';
import { getUserRole } from '@/lib/auth';
import { compute2033A } from '@/lib/accounting/compute2033a';
import * as XLSX from 'xlsx';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yearStr = searchParams.get('year');
  const year = yearStr ? parseInt(yearStr,10) : new Date().getFullYear();
  if (isNaN(year)) return new Response('Bad year', { status: 400 });
  const q = searchParams.get('q');
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (getUserRole(user) !== 'admin') return new Response('Forbidden', { status: 403 });
  const r = await compute2033A({ userId: user.id, year, q });
  const wb = XLSX.utils.book_new();
  const actifRows = [
    { Poste: 'Immobilisations nettes', Montant: r.immobilisations_nettes.toFixed(2) },
    { Poste: 'Trésorerie (v1)', Montant: r.tresorerie.toFixed(2) },
    { Poste: 'TOTAL ACTIF', Montant: r.actif_total.toFixed(2) }
  ];
  const passifRows = [
    { Poste: 'Capitaux propres (équilibrage v1)', Montant: r.capitaux_propres_equilibrage.toFixed(2) },
    { Poste: 'TOTAL PASSIF', Montant: r.capitaux_propres_equilibrage.toFixed(2) }
  ];
  const wsA = XLSX.utils.json_to_sheet(actifRows);
  XLSX.utils.book_append_sheet(wb, wsA, '2033A_Actif');
  const wsP = XLSX.utils.json_to_sheet(passifRows);
  XLSX.utils.book_append_sheet(wb, wsP, '2033A_Passif');
  const wsMeta = XLSX.utils.json_to_sheet([
    { Cle: 'Year', Valeur: year },
    { Cle: 'Assets_Count', Valeur: r.count_assets },
    { Cle: 'Truncated', Valeur: r.truncated ? 'true':'false' }
  ]);
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Meta');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  const headers: Record<string,string> = {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="2033a-${year}.xlsx"`
  };
  if (r.truncated) headers['X-Truncated'] = 'true';
  return new Response(new Uint8Array(buf), { headers });
}
