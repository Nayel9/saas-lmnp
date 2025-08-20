"use server";
import { redirect } from "next/navigation";
import { auth } from '@/lib/auth/core';
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
