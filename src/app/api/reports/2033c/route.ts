import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/core';
import { getUserRole } from '@/lib/auth';
import { compute2033C } from '@/lib/accounting/compute2033c';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (getUserRole(user) !== 'admin') return new Response('Forbidden', { status: 403 });
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const q = searchParams.get('q');
  const account_code = searchParams.get('account_code');
  const result = await compute2033C({ userId: user.id, from, to, q, account_code });
  return Response.json({ rubriques: result.rubriques, totals: result.totals });
}
