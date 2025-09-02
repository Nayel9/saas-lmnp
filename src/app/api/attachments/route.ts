import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/core';
import { createAttachmentSchema, normalizeMimeType } from '@/lib/uploads';
import { prisma } from '@/lib/prisma';
import { createAttachmentForUser } from '@/lib/attachments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createAttachmentSchema.safeParse(json);
  if (!parsed.success) return new Response('Bad Request', { status: 400 });
  const { entryId, assetId, fileName, fileSize, mimeType, storageKey } = parsed.data;

  const norm = normalizeMimeType(mimeType, fileName);
  if (!norm) return new Response('Unsupported media type', { status: 415 });

  // Validate ownership for the parent
  if (entryId) {
    const entry = await prisma.journalEntry.findUnique({ where: { id: entryId } });
    if (!entry || entry.user_id !== user.id) return new Response('Forbidden', { status: 403 });
  } else if (assetId) {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.user_id !== user.id) return new Response('Forbidden', { status: 403 });
  } else {
    return new Response('Bad Request', { status: 400 });
  }

  const created = await createAttachmentForUser(user.id, { entryId: entryId || undefined, assetId: assetId || undefined, fileName, fileSize, mimeType: norm, storageKey });
  return Response.json({ ok: true, attachment: created });
}
