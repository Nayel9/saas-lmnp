import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  if (!email) {
    return new Response(JSON.stringify({ verified: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return new Response(JSON.stringify({ verified: !!user?.emailVerified }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('[check-verified][error]', e);
    return new Response(JSON.stringify({ verified: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}

