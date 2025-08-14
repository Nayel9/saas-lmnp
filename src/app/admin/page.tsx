import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUserRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const role = getUserRole(user);
  if (role !== 'admin') redirect('/dashboard');

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        <p className="text-muted-foreground text-sm">Zone réservée aux administrateurs.</p>
      </header>
      <section className="card space-y-4">
        <h2 className="text-lg font-medium">Statut</h2>
        <p className="text-sm text-muted-foreground">Compte connecté: <span className="font-medium">{user.email}</span> (role: {role}).</p>
        <p className="text-sm text-muted-foreground">Ici: futur panneau de gestion (utilisateurs, données, exports).</p>
      </section>
    </main>
  );
}
