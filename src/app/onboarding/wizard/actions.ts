import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/core";
import { computeLinearAmortization } from "@/lib/asset-amortization";
import { postMonthlyAmortization } from "@/app/dashboard/actions";

// ---------------------- Schemas ----------------------
export const propertySchema = z.object({
  label: z.string().min(1, "Nom requis").max(120),
  startDate: z
    .string()
    .optional()
    .refine((v) => !v || !isNaN(Date.parse(v)), "Date invalide"),
  iban: z
    .string()
    .optional()
    .refine((v) => !v || /^[A-Z0-9 ]{10,40}$/.test(v), "IBAN invalide"),
  address: z
    .string()
    .optional()
    .refine((v) => !v || v.length <= 300, "Adresse trop longue"),
});
export type PropertyInput = z.input<typeof propertySchema>;

export const saleSchema = z.object({
  propertyId: z.string().uuid(),
  date: z
    .string()
    .optional()
    .refine((v) => !v || !isNaN(Date.parse(v)), "Date invalide"),
  amountTTC: z
    .number({ invalid_type_error: "Montant requis" })
    .positive("Montant > 0"),
  tenant: z.string().min(1, "Locataire requis").max(120),
  isDeposit: z.boolean().optional().default(false),
});
export type SaleInput = z.input<typeof saleSchema>;

const assetCategories = ["mobilier", "batiment", "vehicule"] as const;
export const assetSchema = z.object({
  propertyId: z.string().uuid(),
  category: z.enum(assetCategories),
  label: z.string().min(1, "Nom requis").max(160),
  costTTC: z.number().positive("Coût > 0"),
  inServiceDate: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), "Date invalide"),
  durationMonths: z
    .number()
    .int()
    .positive()
    .max(600)
    .optional(),
});
export type AssetInput = z.infer<typeof assetSchema>;

// ---------------------- Helpers auth / multi-tenant ----------------------
async function requireUserId(): Promise<string> {
  const session = await auth();
  const user = session?.user;
  if (!user) throw new Error("UNAUTHENTICATED");
  return user.id;
}

async function assertPropertyOwner(propertyId: string, userId: string) {
  const prop = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, user_id: true },
  });
  if (!prop || prop.user_id !== userId) throw new Error("FORBIDDEN_PROPERTY");
}

// ---------------------- Step 1 ----------------------
export async function createOnboardingProperty(input: PropertyInput) {
  "use server";
  const parsed = propertySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors } as const;
  }
  const userId = await requireUserId();
  const { label, startDate, iban, address } = parsed.data;
  const created = await prisma.property.create({
    data: {
      user_id: userId,
      label,
      startDate: startDate ? new Date(startDate) : new Date(),
      iban: iban ? iban.toUpperCase() : null,
      address: address || null,
      vatEnabled: false,
    },
    select: { id: true },
  });
  return { ok: true, propertyId: created.id } as const;
}

// ---------------------- Step 2 ----------------------
export async function createOnboardingSale(input: SaleInput) {
  "use server";
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors } as const;
  }
  const userId = await requireUserId();
  const { propertyId, date, amountTTC, tenant, isDeposit } = parsed.data;
  try {
    await assertPropertyOwner(propertyId, userId);
  } catch {
    return { ok: false, errors: { propertyId: ["Bien invalide"] } } as const;
  }
  const created = await prisma.journalEntry.create({
    data: {
      user_id: userId,
      type: "vente",
      date: date ? new Date(date) : new Date(),
      designation: "Loyer initial",
      tier: tenant,
      account_code: "706", // simple par défaut
      amount: amountTTC,
      currency: "EUR",
      isDeposit: !!isDeposit,
      propertyId,
      paymentStatus: "PENDING",
    },
    select: { id: true },
  });
  return { ok: true, saleId: created.id } as const;
}

// ---------------------- Step 3 ----------------------
export interface GeneratedAmortizationYear {
  year: number; dotation: number; cumul: number;
}
export interface AssetCreationResult {
  ok: true; assetId: string; schedule: GeneratedAmortizationYear[];
}
export async function createOnboardingAsset(input: AssetInput): Promise<AssetCreationResult | { ok: false; errors: Record<string, string[] | undefined> | string }> {
  "use server";
  const parsed = assetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten().fieldErrors };
  }
  const userId = await requireUserId();
  const { propertyId, category, label, costTTC, inServiceDate, durationMonths } = parsed.data;
  try {
    await assertPropertyOwner(propertyId, userId);
  } catch {
    return { ok: false, errors: { propertyId: ["Bien invalide"] } };
  }
  // Déterminer durée (mois -> années arrondies vers le haut minimal 1)
  let months = durationMonths;
  if (!months) {
    const def = await prisma.amortizationDefault.findUnique({ where: { propertyId_category: { propertyId, category } }, select: { defaultDurationMonths: true } });
    if (def) months = def.defaultDurationMonths;
  }
  if (!months) return { ok: false, errors: { durationMonths: ["Durée manquante"] } };
  const years = Math.max(1, Math.round(months / 12));
  const acquisition = new Date(inServiceDate);
  // amount_ht: on suppose TVA off (wizard par défaut) => TTC == HT
  const created = await prisma.asset.create({
    data: {
      user_id: userId,
      label,
      amount_ht: costTTC,
      duration_years: years,
      acquisition_date: acquisition,
      account_code: "2183", // mobilier par défaut simple
      propertyId,
    },
    select: { id: true, amount_ht: true, duration_years: true, acquisition_date: true },
  });
  // Génération planning (linéaire prorata 1er mois)
  const scheduleBase = computeLinearAmortization(Number(created.amount_ht), created.duration_years, created.acquisition_date);
  return { ok: true, assetId: created.id, schedule: scheduleBase };
}

// ---------------------- Option: poster amort mensuel courant ----------------------
export async function postCurrentMonthAmortization(propertyId: string) {
  "use server";
  const userId = await requireUserId();
  try { await assertPropertyOwner(propertyId, userId); } catch { return { created: false, error: "Bien invalide" }; }
  const now = new Date();
  return postMonthlyAmortization({ propertyId, year: now.getFullYear(), month: now.getMonth() + 1 });
}
