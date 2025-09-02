import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/core';
import { deleteAttachmentForUser } from '@/lib/attachments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const ok = await deleteAttachmentForUser(user.id, id);
  if (!ok) return new Response('Not found', { status: 404 });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
}
