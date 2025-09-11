"use server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";

export async function createProperty(formData: FormData) {
  const session = await auth();
  const user = session?.user;
  if (!user) {
    redirect("/login");
  }
  const label = (formData.get("label") || "").toString().trim();
  if (!label) return;
  const address = formData.get("address")?.toString().trim() || null;
  await prisma.property.create({
    data: { label, address, user_id: user.id },
  });
  redirect("/dashboard");
}

export interface PostMonthlyAmortInput {
  propertyId: string;
  year: number;
  month: number; // 1..12
}

export async function postMonthlyAmortization(input: PostMonthlyAmortInput) {
  const session = await auth();
  const user = session?.user;
  if (!user) throw new Error("Non authentifié");
  const { propertyId, year, month } = input;
  const prop = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!prop || prop.user_id !== user.id) throw new Error("FORBIDDEN");
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const exists = await prisma.amortization.findFirst({
    where: { user_id: user.id, propertyId, year, note: { contains: `month:${monthKey}` } },
    select: { id: true },
  });
  if (exists) return { created: false, id: exists.id };
  const created = await prisma.amortization.create({
    data: {
      user_id: user.id,
      propertyId,
      year,
      amount: 0,
      note: `month:${monthKey}`,
    },
    select: { id: true },
  });
  return { created: true, id: created.id };
}

export async function markRentPaid(entryId: string) {
  const session = await auth();
  const user = session?.user;
  if (!user) throw new Error("Non authentifié");
  if (!entryId) throw new Error("BAD_REQUEST");

  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    select: { id: true, user_id: true, type: true, isDeposit: true, account_code: true },
  });
  if (!entry) throw new Error("NOT_FOUND");
  if (entry.user_id !== user.id) throw new Error("FORBIDDEN");
  if (entry.type !== "vente" || entry.isDeposit) throw new Error("BAD_REQUEST");

  if (entry.account_code === "512" || entry.account_code === "53") return { updated: false };

  await prisma.journalEntry.update({ where: { id: entryId }, data: { account_code: "512" } });
  return { updated: true };
}

export async function unmarkRentPaid(entryId: string) {
  const session = await auth();
  const user = session?.user;
  if (!user) throw new Error("Non authentifié");
  if (!entryId) throw new Error("BAD_REQUEST");

  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    select: { id: true, user_id: true, type: true, isDeposit: true, account_code: true },
  });
  if (!entry) throw new Error("NOT_FOUND");
  if (entry.user_id !== user.id) throw new Error("FORBIDDEN");
  if (entry.type !== "vente" || entry.isDeposit) throw new Error("BAD_REQUEST");

  if (entry.account_code !== "512" && entry.account_code !== "53") return { updated: false };

  await prisma.journalEntry.update({ where: { id: entryId }, data: { account_code: "411" } });
  return { updated: true };
}
