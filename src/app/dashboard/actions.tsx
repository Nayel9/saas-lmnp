"use server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function createProperty(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const label = (formData.get("label") || "").toString().trim();
  if (!label) {
    return; // TODO: gestion d'erreur UI (toast) côté client via pattern pending
  }
  const address = formData.get("address")?.toString().trim() || null;
  await prisma.property.create({
    data: { label, address, user_id: user.id },
  });
  redirect("/dashboard");
}
