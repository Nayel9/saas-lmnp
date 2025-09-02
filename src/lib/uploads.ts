import { z } from 'zod';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo

export const allowedMimeTypes = new Set<string>([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

export function normalizeMimeType(input: string, fileName?: string): string | null {
  let m = (input || '').toLowerCase().trim();
  if (m === 'image/jpg') m = 'image/jpeg';
  if (allowedMimeTypes.has(m)) return m;
  // Essai via extension
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  return null;
}

// Accept either entryId or assetId (exactly one) for presign
export const presignBodySchema = z.object({
  fileName: z.string().min(1).max(200),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
  mimeType: z.string().min(1),
  entryId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
}).refine((v) => Boolean(v.entryId) !== Boolean(v.assetId), {
  message: 'Provide either entryId or assetId',
  path: ['entryId'],
});

// Accept either entryId or assetId (exactly one) for creation
export const createAttachmentSchema = z.object({
  entryId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  fileName: z.string().min(1).max(200),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
  mimeType: z.string().min(1),
  storageKey: z.string().min(1).max(500),
}).refine((v) => Boolean(v.entryId) !== Boolean(v.assetId), {
  message: 'Provide either entryId or assetId',
  path: ['entryId'],
});

export type PresignBody = z.infer<typeof presignBodySchema>;
export type CreateAttachmentBody = z.infer<typeof createAttachmentSchema>;
