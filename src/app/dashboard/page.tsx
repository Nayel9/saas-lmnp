import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createProperty } from "./actions";

export default async function DashboardPage() {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) redirect("/login");

    return (
        <main className="p-6 space-y-6">
            <h1 className="text-2xl font-semibold">Tableau de bord</h1>
            <p>Bienvenue, {user.email}</p>

            <form action={createProperty} className="space-y-3 max-w-md">
                <input name="label" placeholder="Nom du bien" className="border p-2 w-full rounded" />
                <input name="address" placeholder="Adresse (optionnel)" className="border p-2 w-full rounded" />
                <button className="px-4 py-2 rounded bg-black text-white">Ajouter</button>
            </form>
        </main>
    );
}
