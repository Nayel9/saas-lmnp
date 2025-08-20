"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from '@/lib/auth/core';
import { isAllowed } from '@/lib/accounting/accountsCatalog';

const entrySchema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().refine(v => !isNaN(Date.parse(v)), 'Date invalide'),
  designation: z.string().min(1),
  tier: z.string().optional().nullable(),
  account_code: z.string().min(1),
  amount: z.string().refine(v => !isNaN(parseFloat(v)), 'Montant invalide'),
  currency: z.string().default('EUR')
});

export type EntryFormData = z.infer<typeof entrySchema>;

async function getUserId() {
  const session = await auth();
  const user = session?.user;
  if (!user) throw new Error('Non authentifié');
  return user.id;
}

export async function createEntry(formData: FormData) {
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.flatten().formErrors.join(', ') };
  const userId = await getUserId();
  const { date, designation, tier, account_code, amount, currency } = parsed.data;
  // Validation catalogue: si code présent mais non autorisé pour achats (et autorisé pour ventes) => rejet
  if (isAllowed(account_code, 'vente') && !isAllowed(account_code,'achat')) {
    return { ok: false, error: 'Compte réservé aux ventes' };
  }
  await prisma.journalEntry.create({ data: { user_id: userId, type: 'achat', date: new Date(date), designation, tier: tier || null, account_code, amount: parseFloat(amount), currency } });
  revalidatePath('/journal/achats');
  return { ok: true };
}

export async function updateEntry(formData: FormData) {
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !parsed.data.id) return { ok: false, error: 'Validation' };
  const userId = await getUserId();
  const { id, date, designation, tier, account_code, amount, currency } = parsed.data;
  const existing = await prisma.journalEntry.findUnique({ where: { id } });
  if (!existing || existing.user_id !== userId) return { ok: false, error: 'Introuvable' };
  if (isAllowed(account_code, 'vente') && !isAllowed(account_code,'achat')) {
    return { ok: false, error: 'Compte réservé aux ventes' };
  }
  await prisma.journalEntry.update({ where: { id }, data: { date: new Date(date), designation, tier: tier || null, account_code, amount: parseFloat(amount), currency }, });
  revalidatePath('/journal/achats');
  return { ok: true };
}

export async function deleteEntry(id: string) {
  if (!id) return { ok: false, error: 'ID manquant' };
  const userId = await getUserId();
  const existing = await prisma.journalEntry.findUnique({ where: { id } });
  if (!existing || existing.user_id !== userId) return { ok: false, error: 'Introuvable' };
  await prisma.journalEntry.delete({ where: { id } });
  revalidatePath('/journal/achats');
  return { ok: true };
}
