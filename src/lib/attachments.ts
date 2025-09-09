import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/storage/s3";

export async function ensureEntryOwned(userId: string, entryId: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
  });
  if (!entry || entry.user_id !== userId) return null;
  return entry;
}

export async function ensureAssetOwned(userId: string, assetId: string) {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset || asset.user_id !== userId) return null;
  return asset;
}

export async function createAttachmentForUser(
  userId: string,
  data: {
    entryId?: string;
    assetId?: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storageKey: string;
  },
) {
  if (data.entryId && data.assetId) throw new Error("BAD_REQUEST");
  if (!data.entryId && !data.assetId) throw new Error("BAD_REQUEST");
  if (data.entryId) {
    const entry = await ensureEntryOwned(userId, data.entryId);
    if (!entry) throw new Error("FORBIDDEN");
  }
  if (data.assetId) {
    const asset = await ensureAssetOwned(userId, data.assetId);
    if (!asset) throw new Error("FORBIDDEN");
  }
  return prisma.attachment.create({ data: { ...data } });
}

export async function listAttachmentsForUser(
  userId: string,
  parent: { entryId?: string; assetId?: string },
) {
  const { entryId, assetId } = parent;
  if (entryId && assetId) throw new Error("BAD_REQUEST");
  if (!entryId && !assetId) throw new Error("BAD_REQUEST");
  if (entryId) {
    const entry = await ensureEntryOwned(userId, entryId);
    if (!entry) throw new Error("FORBIDDEN");
    return prisma.attachment.findMany({
      where: { entryId },
      orderBy: { createdAt: "desc" },
    });
  }
  const asset = await ensureAssetOwned(userId, assetId!);
  if (!asset) throw new Error("FORBIDDEN");
  return prisma.attachment.findMany({
    where: { assetId },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteAttachmentForUser(
  userId: string,
  attachmentId: string,
) {
  const att = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { entry: true, asset: true },
  });
  const ownerId = att?.entry?.user_id ?? att?.asset?.user_id;
  if (!att || !ownerId || ownerId !== userId) return null;
  // attempt to delete storage object (best-effort)
  try {
    await deleteObject(att.storageKey);
  } catch {
    /* ignore */
  }
  await prisma.attachment.delete({ where: { id: attachmentId } });
  return true;
}
