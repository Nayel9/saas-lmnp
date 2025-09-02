import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createAttachmentForUser } from './attachments';
import bcrypt from 'bcryptjs';

const email = `test-attach-${Date.now()}@local.test`;
let userId = '';
let entryId = '';

beforeAll(async () => {
  // Assure la table attachments en environnement de test
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "attachments" (
      "id" TEXT PRIMARY KEY,
      "entryId" TEXT NOT NULL,
      "fileName" TEXT NOT NULL,
      "fileSize" INTEGER NOT NULL,
      "mimeType" TEXT NOT NULL,
      "storageKey" TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT "attachments_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "attachments_entryId_idx" ON "attachments" ("entryId");
  `);

  const hash = await bcrypt.hash('Passw0rd!', 10);
  const u = await prisma.user.create({ data: { email, password: hash, role: 'user', emailVerified: new Date() } });
  userId = u.id;
  const e = await prisma.journalEntry.create({ data: { user_id: userId, type: 'achat', date: new Date(), designation: 'Test attach', account_code: '606', amount: 10, currency: 'EUR' } });
  entryId = e.id;
});

afterAll(async () => {
  await prisma.attachment.deleteMany({ where: { entryId } }).catch(()=>{});
  await prisma.journalEntry.deleteMany({ where: { id: entryId } }).catch(()=>{});
  await prisma.user.deleteMany({ where: { id: userId } }).catch(()=>{});
});

describe('attachments service', () => {
  it('creates attachment for owned entry', async () => {
    const att = await createAttachmentForUser(userId, { entryId, fileName: 'a.pdf', fileSize: 123, mimeType: 'application/pdf', storageKey: 'mock/'+userId+'/'+entryId+'/a.pdf' });
    expect(att).toBeTruthy();
    expect(att.entryId).toBe(entryId);
  });
  it('rejects for non-owned entry', async () => {
    const other = await prisma.user.create({ data: { email: `other-${Date.now()}@local.test`, password: await bcrypt.hash('Passw0rd!', 10), role: 'user', emailVerified: new Date() } });
    await expect(createAttachmentForUser(other.id, { entryId, fileName: 'b.pdf', fileSize: 1, mimeType: 'application/pdf', storageKey: 'mock/x' })).rejects.toThrow('FORBIDDEN');
    await prisma.user.delete({ where: { id: other.id } });
  });
});
