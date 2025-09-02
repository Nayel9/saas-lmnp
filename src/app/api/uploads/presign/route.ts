import { auth } from '@/lib/auth/core';
import { NextRequest } from 'next/server';
import { presignBodySchema, normalizeMimeType, MAX_FILE_SIZE } from '@/lib/uploads';
import { ensureEntryOwned, ensureAssetOwned } from '@/lib/attachments';
import { presignPost } from '@/lib/storage/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isS3Ready() {
  try {
    // Accessing will throw if misconfigured
    const { S3_BUCKET } = process.env;
    return Boolean(S3_BUCKET);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response('Unauthorized', { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = presignBodySchema.safeParse(json);
  if (!parsed.success) return new Response('Bad Request', { status: 400 });
  const { fileName, fileSize, mimeType, entryId, assetId } = parsed.data;
  if (fileSize > MAX_FILE_SIZE) return new Response('File too large', { status: 413 });
  const norm = normalizeMimeType(mimeType, fileName);
  if (!norm) return new Response('Unsupported media type', { status: 415 });

  const parentId = entryId || assetId!;
  if (entryId) {
    const entry = await ensureEntryOwned(user.id, entryId);
    if (!entry) return new Response('Forbidden', { status: 403 });
  } else if (assetId) {
    const asset = await ensureAssetOwned(user.id, assetId);
    if (!asset) return new Response('Forbidden', { status: 403 });
  }

  const useS3 = isS3Ready();
  if (useS3) {
    try {
      const policy = await presignPost({ userId: user.id, entryId: parentId, fileName, fileSize, mimeType: norm });
      return Response.json({ provider: 's3', url: policy.url, fields: policy.fields, storageKey: policy.storageKey });
    } catch {
      // Fall back to mock if presign fails
    }
  }
  // Mock provider: client fera un PUT direct
  const storageKey = `mock/${user.id}/${parentId}/${Date.now()}_${Math.random().toString(36).slice(2)}_${fileName}`;
  return Response.json({ provider: 'mock', url: '/api/uploads/mock', headers: { 'x-storage-key': storageKey, 'content-type': norm, 'content-length': String(fileSize) }, storageKey });
}
