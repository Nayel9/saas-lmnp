"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/core";
import { isAllowed } from "@/lib/accounting/accountsCatalog";

const entrySchema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().refine((v) => !isNaN(Date.parse(v)), "Date invalide"),
  designation: z.string().min(1),
  tier: z.string().optional().nullable(),
  account_code: z.string().min(1),
  amount: z.string().refine((v) => !isNaN(parseFloat(v)), "Montant invalide"),
  currency: z.string().default("EUR"),
  propertyId: z.string().uuid(),
  amountHT: z.string().optional(),
  vatRate: z.string().optional(),
  vatAmount: z.string().optional(),
  amountTTC: z.string().optional(),
});

export type EntryFormData = z.infer<typeof entrySchema>;

async function getUserId() {
  const session = await auth();
  const user = session?.user;
  if (!user) throw new Error("Non authentifié");
  return user.id;
}

export async function createEntry(formData: FormData) {
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: parsed.error.flatten().formErrors.join(", ") } as const;
  const userId = await getUserId();
  const { date, designation, tier, account_code, amount, currency, propertyId, amountHT, vatRate, amountTTC } = parsed.data;
  if (isAllowed(account_code, "vente") && !isAllowed(account_code, "achat")) {
    return { ok: false, error: "Compte réservé aux ventes" } as const;
  }
  const prop = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, user_id: true } });
  if (!prop || prop.user_id !== userId) {
    return { ok: false, error: "Bien invalide" } as const;
  }

  let data: Prisma.JournalEntryUncheckedCreateInput = {
    user_id: userId,
    type: "achat",
    date: new Date(date),
    designation,
    tier: tier || null,
    account_code,
    amount: 0,
    currency,
    isDeposit: false,
    propertyId,
  };

  const vatRow = await prisma.$queryRawUnsafe<Array<{ vatEnabled: boolean }>>(
    `SELECT "vatEnabled" FROM "Property" WHERE "id" = $1 AND "user_id" = $2`,
    propertyId,
    userId,
  );
  const vatOn = !!vatRow[0]?.vatEnabled;

  if (vatOn) {
    const rateNum = vatRate != null && vatRate !== "" ? parseFloat(String(vatRate)) : NaN;
    const htNum = amountHT != null && amountHT !== "" ? parseFloat(String(amountHT)) : NaN;
    const ttcNum = amountTTC != null && amountTTC !== "" ? parseFloat(String(amountTTC)) : NaN;
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      return { ok: false, error: "Taux TVA invalide" } as const;
    }
    if (isNaN(htNum) && isNaN(ttcNum)) {
      return { ok: false, error: "Champs TVA incomplets" } as const;
    }
    const r = isNaN(htNum)
      ? { ht: Math.round((ttcNum / (1 + rateNum / 100)) * 100) / 100, rate: rateNum, tva: Math.round((ttcNum - (ttcNum / (1 + rateNum / 100))) * 100) / 100, ttc: Math.round(ttcNum * 100) / 100 }
      : { ht: Math.round(htNum * 100) / 100, rate: rateNum, tva: Math.round((htNum * rateNum / 100) * 100) / 100, ttc: Math.round((htNum * (1 + rateNum / 100)) * 100) / 100 };
    data = { ...data, amount: r.ttc, amountHT: r.ht, vatRate: r.rate, vatAmount: r.tva, amountTTC: r.ttc };
  } else {
    data = { ...data, amount: parseFloat(amount), amountHT: null, vatRate: null, vatAmount: null, amountTTC: null };
  }

  const created = await prisma.journalEntry.create({ data });
  revalidatePath("/journal/achats");
  return { ok: true, id: created.id } as const;
}

export async function updateEntry(formData: FormData) {
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !parsed.data.id)
    return { ok: false, error: "Validation" };
  const userId = await getUserId();
  const { id, date, designation, tier, account_code, amount, currency, propertyId, amountHT, vatRate, amountTTC } =
    parsed.data;
  const existing = await prisma.journalEntry.findUnique({ where: { id } });
  if (!existing || existing.user_id !== userId)
    return { ok: false, error: "Introuvable" };
  if (isAllowed(account_code, "vente") && !isAllowed(account_code, "achat")) {
    return { ok: false, error: "Compte réservé aux ventes" };
  }
  const prop = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, user_id: true } });
  if (!prop || prop.user_id !== userId) {
    return { ok: false, error: "Bien invalide" };
  }

  let data: Prisma.JournalEntryUncheckedUpdateInput = {
    date: new Date(date),
    designation,
    tier: tier || null,
    account_code,
    currency,
    propertyId,
  };

  const vatRow = await prisma.$queryRawUnsafe<Array<{ vatEnabled: boolean }>>(
    `SELECT "vatEnabled" FROM "Property" WHERE "id" = $1 AND "user_id" = $2`,
    propertyId,
    userId,
  );
  const vatOn = !!vatRow[0]?.vatEnabled;

  if (vatOn) {
    const rateNum = vatRate != null && vatRate !== "" ? parseFloat(String(vatRate)) : NaN;
    const htNum = amountHT != null && amountHT !== "" ? parseFloat(String(amountHT)) : NaN;
    const ttcNum = amountTTC != null && amountTTC !== "" ? parseFloat(String(amountTTC)) : NaN;
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      return { ok: false, error: "Taux TVA invalide" };
    }
    if (isNaN(htNum) && isNaN(ttcNum)) {
      return { ok: false, error: "Champs TVA incomplets" };
    }
    const r = isNaN(htNum)
      ? { ht: Math.round((ttcNum / (1 + rateNum / 100)) * 100) / 100, rate: rateNum, tva: Math.round((ttcNum - (ttcNum / (1 + rateNum / 100))) * 100) / 100, ttc: Math.round(ttcNum * 100) / 100 }
      : { ht: Math.round(htNum * 100) / 100, rate: rateNum, tva: Math.round((htNum * rateNum / 100) * 100) / 100, ttc: Math.round((htNum * (1 + rateNum / 100)) * 100) / 100 };
    data = { ...data, amount: r.ttc, amountHT: r.ht, vatRate: r.rate, vatAmount: r.tva, amountTTC: r.ttc };
  } else {
    data = { ...data, amount: parseFloat(amount), amountHT: null, vatRate: null, vatAmount: null, amountTTC: null };
  }

  await prisma.journalEntry.update({ where: { id }, data });
  revalidatePath("/journal/achats");
  return { ok: true };
}

export async function deleteEntry(id: string) {
  if (!id) return { ok: false, error: "ID manquant" };
  const userId = await getUserId();
  const existing = await prisma.journalEntry.findUnique({ where: { id } });
  if (!existing || existing.user_id !== userId)
    return { ok: false, error: "Introuvable" };
  await prisma.journalEntry.delete({ where: { id } });
  revalidatePath("/journal/achats");
  return { ok: true };
}
