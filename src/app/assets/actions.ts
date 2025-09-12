"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/core";
import { revalidatePath } from "next/cache";
import { isAllowed, listFor } from "@/lib/accounting/accountsCatalog";

const assetAccountCodes = listFor("asset").map((a) => a.code);
const categories = ["mobilier", "batiment", "vehicule"] as const;
const assetSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  amount_ht: z
    .string()
    .refine(
      (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
      "Montant invalide",
    ),
  // Rendre optionnel côté serveur pour permettre fallback par défaut
  duration_years: z.string().optional(),
  acquisition_date: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), "Date invalide"),
  account_code: z
    .string()
    .refine(
      (v) => assetAccountCodes.includes(v),
      "Compte immobilisation inconnu",
    ),
  propertyId: z.string().uuid(),
  category: z.enum(categories).optional(),
});

async function getUserId() {
  const session = await auth();
  const user = session?.user;
  if (!user) throw new Error("Non authentifié");
  return user.id;
}

export async function createAsset(formData: FormData) {
  const parsed = assetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join(", "),
    };
  const { account_code, propertyId } = parsed.data;
  if (!isAllowed(account_code, "asset"))
    return { ok: false, error: "Compte immobilisation invalide" };
  const user_id = await getUserId();
  // Vérifier appartenance du bien
  const prop = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!prop || prop.user_id !== user_id)
    return { ok: false, error: "Bien invalide" };
  const { label, amount_ht, duration_years, acquisition_date, category } =
    parsed.data;

  // Déterminer la durée en années: si absente/vides et catégorie fournie, lire défaut
  let durationYearsFinal: number | null = null;
  const raw = (duration_years ?? "").trim();
  if (raw) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0 || n > 50)
      return { ok: false, error: "Durée invalide" };
    durationYearsFinal = n;
  } else if (category) {
    const def = await prisma.amortizationDefault.findUnique({
      where: { propertyId_category: { propertyId, category } },
    });
    if (def && def.defaultDurationMonths > 0) {
      const years = Math.round(def.defaultDurationMonths / 12);
      durationYearsFinal = years > 0 ? years : 1;
    }
  }
  if (!durationYearsFinal)
    return { ok: false, error: "Durée invalide" };

  const created = await prisma.asset.create({
    data: {
      user_id,
      label,
      amount_ht: parseFloat(amount_ht),
      duration_years: durationYearsFinal,
      acquisition_date: new Date(acquisition_date),
      account_code,
      propertyId,
    },
  });
  revalidatePath("/assets");
  return { ok: true, id: created.id };
}

export async function updateAsset(formData: FormData) {
  const parsed = assetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !parsed.data.id)
    return { ok: false, error: "Validation" };
  const { account_code, propertyId } = parsed.data;
  if (!isAllowed(account_code, "asset"))
    return { ok: false, error: "Compte immobilisation invalide" };
  const user_id = await getUserId();
  const { id, label, amount_ht, duration_years, acquisition_date } =
    parsed.data;
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing || existing.user_id !== user_id)
    return { ok: false, error: "Introuvable" };
  const prop = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!prop || prop.user_id !== user_id)
    return { ok: false, error: "Bien invalide" };
  const raw = (duration_years ?? "").trim();
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || n > 50)
    return { ok: false, error: "Durée invalide" };
  await prisma.asset.update({
    where: { id },
    data: {
      label,
      amount_ht: parseFloat(amount_ht),
      duration_years: n,
      acquisition_date: new Date(acquisition_date),
      account_code,
      propertyId,
    },
  });
  revalidatePath("/assets");
  return { ok: true };
}

export async function deleteAsset(id: string) {
  if (!id) return { ok: false, error: "ID manquant" };
  const user_id = await getUserId();
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing || existing.user_id !== user_id)
    return { ok: false, error: "Introuvable" };
  await prisma.asset.delete({ where: { id } });
  revalidatePath("/assets");
  return { ok: true };
}
