import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function Page() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center p-10 text-center gap-6 max-w-3xl mx-auto">
                <div className="space-y-3">
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">LMNP App</h1>
                    <p className="text-muted-foreground text-sm md:text-base leading-relaxed">Gérez vos biens locatifs: revenus, charges, amortissements et exports fiscaux dans une interface épurée.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link href="/login" className="btn-primary">Se connecter</Link>
                </div>
            </main>
        );
    }
    redirect('/dashboard');
}
