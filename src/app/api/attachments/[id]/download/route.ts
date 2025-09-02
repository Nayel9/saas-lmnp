import { auth } from '@/lib/auth/core';
import { prisma } from '@/lib/prisma';
import { presignGet } from '@/lib/storage/s3';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function localPathFor(storageKey: string) {
  const base = path.join(process.cwd(), '.uploads');
  return path.join(base, storageKey.replace(/^mock\//, ''));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { id } = await params;
  const att = await prisma.attachment.findUnique({ where: { id }, include: { entry: true, asset: true } });
  const ownerId = att?.entry?.user_id ?? att?.asset?.user_id;
  if (!att || !ownerId || ownerId !== user.id) return new Response('Not found', { status: 404 });

  if (att.storageKey.startsWith('mock/')) {
    const filePath = localPathFor(att.storageKey);
    if (!fs.existsSync(filePath)) return new Response('Gone', { status: 410 });
    const buf = fs.readFileSync(filePath);
    return new NextResponse(buf, {
      headers: {
        'Content-Type': att.mimeType,
        'Content-Length': String(buf.byteLength),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(att.fileName)}"`,
      },
    });
  }

  const url = await presignGet({ storageKey: att.storageKey, expiresSec: 120 });
  return NextResponse.redirect(url);
}
