import { NextRequest } from 'next/server';
export const runtime = 'nodejs';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return new Response('Validation', { status: 400 });
    const { email, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return new Response('Existe déjà', { status: 409 });
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { email, password: hash, role: 'user' } });
    return new Response(null, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown';
    console.error('[signup][error]', e);
    return new Response('Erreur:' + msg, { status: 500 });
  }
}
