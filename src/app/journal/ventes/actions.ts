"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/core";
import { isAllowed } from "@/lib/accounting/accountsCatalog";

const toBool = (v: unknown) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string")
    return ["true", "on", "1", "yes", "oui"].includes(v.toLowerCase());
  return false;
};

const entrySchema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().refine((v) => !isNaN(Date.parse(v)), "Date invalide"),
  designation: z.string().min(1),
  tier: z.string().optional().nullable(),
  account_code: z.string().min(1),
  ledgerAccountId: z.string().regex(/^(c[a-z0-9]{24}|[a-f0-9]{32})$/).optional(),
  amount: z.string().refine((v) => !isNaN(parseFloat(v)), "Montant invalide"),
  currency: z.string().default("EUR"),
  isDeposit: z.preprocess(toBool, z.boolean().default(false)).optional(),
  propertyId: z.string().uuid(),
  amountHT: z.string().optional(),
  vatRate: z.string().optional(),
  vatAmount: z.string().optional(),
  amountTTC: z.string().optional(),
  categoryKey: z.string().min(1).optional().nullable(),
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
    return {
      ok: false,
      error: parsed.error.flatten().formErrors.join(", "),
    } as const;
  const userId = await getUserId();
  const { date, designation, tier, account_code, ledgerAccountId, amount, currency, isDeposit, propertyId, amountHT, vatRate, amountTTC, categoryKey } =
    parsed.data;
  // Chargement éventuel du ledgerAccount (prioritaire si fourni)
  let ledgerAcc: { id: string; code: string; label: string; kind: string } | null = null;
  if (ledgerAccountId) {
    ledgerAcc = await prisma.ledgerAccount.findFirst({
      where: { id: ledgerAccountId, OR: [{ propertyId: null }, { propertyId }] },
      select: { id: true, code: true, label: true, kind: true },
    });
    if (!ledgerAcc) return { ok: false, error: "Compte introuvable" } as const;
    // Règles métier: vente caution -> code 165, sinon kind REVENUE
    if (isDeposit) {
      if (ledgerAcc.code !== "165") return { ok: false, error: "Caution doit utiliser 165" } as const;
    } else if (ledgerAcc.kind !== "REVENUE") {
      return { ok: false, error: "Compte non revenu" } as const;
    }
  } else {
    // fallback ancien système catalogue -> validation de compat
    if (isAllowed(account_code, "achat") && !isAllowed(account_code, "vente")) {
      return { ok: false, error: "Compte réservé aux achats" } as const;
    }
  }

  // Prépare l'objet data complet (UncheckedCreateInput)
  let data: Prisma.JournalEntryUncheckedCreateInput = {
    user_id: userId,
    type: "vente",
    date: new Date(date),
    designation,
    account_code,
    amount: 0, // sera mis à jour
    tier: tier || null,
    currency,
    isDeposit: !!isDeposit,
    propertyId,
    accountId: ledgerAcc?.id,
    accountCode: ledgerAcc?.code,
    accountLabel: ledgerAcc?.label,
    categoryKey: categoryKey || null,
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
      ? {
          ht: Math.round((ttcNum / (1 + rateNum / 100)) * 100) / 100,
          rate: rateNum,
          tva: Math.round((ttcNum - ttcNum / (1 + rateNum / 100)) * 100) / 100,
          ttc: Math.round(ttcNum * 100) / 100,
        }
      : {
          ht: Math.round(htNum * 100) / 100,
          rate: rateNum,
          tva: Math.round((htNum * rateNum) / 100 * 100) / 100,
          ttc: Math.round(htNum * (1 + rateNum / 100) * 100) / 100,
        };
    data = {
      ...data,
      amount: r.ttc,
      amountHT: r.ht,
      vatRate: r.rate,
      vatAmount: r.tva,
      amountTTC: r.ttc,
    };
  } else {
    data = {
      ...data,
      amount: parseFloat(amount),
      amountHT: null,
      vatRate: null,
      vatAmount: null,
      amountTTC: null,
    };
  }
  const created = await prisma.journalEntry.create({ data });
  revalidatePath("/journal/ventes");
  return { ok: true, id: created.id } as const;
}

export async function updateEntry(formData: FormData) {
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !parsed.data.id)
    return { ok: false, error: "Validation" } as const;
  const userId = await getUserId();
  const {
    id: _id, date: uDate, designation: uDesignation, tier: uTier, account_code: uAccount_code, ledgerAccountId: uLedgerAccountId, amount: uAmount, currency: uCurrency, isDeposit: uIsDeposit, propertyId: uPropertyId, amountHT: uAmountHT, vatRate: uVatRate, amountTTC: uAmountTTC, categoryKey: uCategoryKey } = parsed.data;
  let ledgerAccU: { id: string; code: string; label: string; kind: string } | null = null;
  if (uLedgerAccountId) {
    ledgerAccU = await prisma.ledgerAccount.findFirst({ where: { id: uLedgerAccountId, OR: [{ propertyId: null }, { propertyId: uPropertyId }] }, select: { id: true, code: true, label: true, kind: true } });
    if (!ledgerAccU) return { ok: false, error: "Compte introuvable" } as const;
    if (uIsDeposit) {
      if (ledgerAccU.code !== "165") return { ok: false, error: "Caution doit utiliser 165" } as const;
    } else if (ledgerAccU.kind !== "REVENUE") {
      return { ok: false, error: "Compte non revenu" } as const;
    }
  } else if (isAllowed(uAccount_code, "achat") && !isAllowed(uAccount_code, "vente")) {
    return { ok: false, error: "Compte réservé aux achats" } as const;
  }
  let data: Prisma.JournalEntryUncheckedUpdateInput = {
    date: new Date(uDate),
    designation: uDesignation,
    tier: uTier || null,
    account_code: uAccount_code,
    currency: uCurrency,
    isDeposit: !!uIsDeposit,
    propertyId: uPropertyId,
    accountId: ledgerAccU?.id,
    accountCode: ledgerAccU?.code,
    accountLabel: ledgerAccU?.label,
    categoryKey: uCategoryKey || null,
  };

  const vatRow = await prisma.$queryRawUnsafe<Array<{ vatEnabled: boolean }>>(
    `SELECT "vatEnabled" FROM "Property" WHERE "id" = $1 AND "user_id" = $2`,
    uPropertyId,
    userId,
  );
  const vatOn = !!vatRow[0]?.vatEnabled;
  if (vatOn) {
    const rateNum = uVatRate != null && uVatRate !== "" ? parseFloat(String(uVatRate)) : NaN;
    const htNum = uAmountHT != null && uAmountHT !== "" ? parseFloat(String(uAmountHT)) : NaN;
    const ttcNum = uAmountTTC != null && uAmountTTC !== "" ? parseFloat(String(uAmountTTC)) : NaN;
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      return { ok: false, error: "Taux TVA invalide" } as const;
    }
    if (isNaN(htNum) && isNaN(ttcNum)) {
      return { ok: false, error: "Champs TVA incomplets" } as const;
    }
    const r = isNaN(htNum)
      ? {
          ht: Math.round((ttcNum / (1 + rateNum / 100)) * 100) / 100,
          rate: rateNum,
          tva: Math.round((ttcNum - ttcNum / (1 + rateNum / 100)) * 100) / 100,
          ttc: Math.round(ttcNum * 100) / 100,
        }
      : {
          ht: Math.round(htNum * 100) / 100,
          rate: rateNum,
          tva: Math.round((htNum * rateNum) / 100 * 100) / 100,
          ttc: Math.round(htNum * (1 + rateNum / 100) * 100) / 100,
        };
    data = { ...data, amount: r.ttc, amountHT: r.ht, vatRate: r.rate, vatAmount: r.tva, amountTTC: r.ttc };
  } else {
    data = { ...data, amount: parseFloat(uAmount), amountHT: null, vatRate: null, vatAmount: null, amountTTC: null };
  }

  await prisma.journalEntry.update({ where: { id: _id }, data });
  revalidatePath("/journal/ventes");
  return { ok: true } as const;
}

export async function deleteEntry(id: string) {
  if (!id) return { ok: false, error: "ID manquant" } as const;
  const userId = await getUserId();
  const existing = await prisma.journalEntry.findUnique({ where: { id } });
  if (!existing || existing.user_id !== userId)
    return { ok: false, error: "Introuvable" } as const;
  await prisma.journalEntry.delete({ where: { id } });
  revalidatePath("/journal/ventes");
  return { ok: true } as const;
}
