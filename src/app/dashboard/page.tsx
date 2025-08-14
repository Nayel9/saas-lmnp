import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createProperty } from "./actions";
import { getUserRole } from "@/lib/auth";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) redirect("/login");
    const role = getUserRole(user);

    return (
        <main className="min-h-screen p-8 space-y-8 max-w-5xl mx-auto">
            <header className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
                <p className="text-muted-foreground text-sm">Connecté en tant que <span className="font-medium">{user.email}</span> ({role})</p>
                {role === 'admin' && (
                    <p className="text-xs text-muted-foreground"><Link href="/admin" className="underline">Accès administration</Link></p>
                )}
            </header>

            <section className="grid gap-6 md:grid-cols-2">
                <div className="card space-y-4">
                    <h2 className="text-lg font-medium">Nouveau bien</h2>
                    <form action={createProperty} className="space-y-3">
                        <input name="label" placeholder="Nom du bien" className="input" autoComplete="off" />
                        <input name="address" placeholder="Adresse (optionnel)" className="input" autoComplete="off" />
                        <div className="pt-1">
                            <button className="btn-primary w-full">Ajouter</button>
                        </div>
                    </form>
                </div>
                <div className="card">
                    <h2 className="text-lg font-medium mb-2">Prochaines étapes</h2>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                        <li>Ajouter revenus & dépenses</li>
                        <li>Amortissements</li>
                        <li>Exports fiscaux</li>
                    </ul>
                </div>
            </section>
        </main>
    );
}
