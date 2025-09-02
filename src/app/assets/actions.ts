"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/core";
import { revalidatePath } from "next/cache";
import { isAllowed, listFor } from "@/lib/accounting/accountsCatalog";

const assetAccountCodes = listFor("asset").map((a) => a.code);
const assetSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  amount_ht: z
    .string()
    .refine(
      (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
      "Montant invalide",
    ),
  duration_years: z
    .string()
    .refine(
      (v) => Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 50,
      "Durée invalide",
    ),
  acquisition_date: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), "Date invalide"),
  account_code: z
    .string()
    .refine(
      (v) => assetAccountCodes.includes(v),
      "Compte immobilisation inconnu",
    ),
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
  const { account_code } = parsed.data;
  if (!isAllowed(account_code, "asset"))
    return { ok: false, error: "Compte immobilisation invalide" };
  const user_id = await getUserId();
  const { label, amount_ht, duration_years, acquisition_date } = parsed.data;
  const created = await prisma.asset.create({
    data: {
      user_id,
      label,
      amount_ht: parseFloat(amount_ht),
      duration_years: Number(duration_years),
      acquisition_date: new Date(acquisition_date),
      account_code,
    },
  });
  revalidatePath("/assets");
  return { ok: true, id: created.id };
}

export async function updateAsset(formData: FormData) {
  const parsed = assetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !parsed.data.id)
    return { ok: false, error: "Validation" };
  const { account_code } = parsed.data;
  if (!isAllowed(account_code, "asset"))
    return { ok: false, error: "Compte immobilisation invalide" };
  const user_id = await getUserId();
  const { id, label, amount_ht, duration_years, acquisition_date } =
    parsed.data;
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing || existing.user_id !== user_id)
    return { ok: false, error: "Introuvable" };
  await prisma.asset.update({
    where: { id },
    data: {
      label,
      amount_ht: parseFloat(amount_ht),
      duration_years: Number(duration_years),
      acquisition_date: new Date(acquisition_date),
      account_code,
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
