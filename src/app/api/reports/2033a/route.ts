import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { assertAdmin } from '@/lib/auth';
import { compute2033A } from '@/lib/accounting/compute2033a';

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
  const result = await compute2033A({ userId: user.id, year, q });
  return Response.json(result);
}

