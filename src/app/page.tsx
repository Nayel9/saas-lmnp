import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Landing } from '@/components/marketing/Landing';

export const dynamic = 'force-dynamic'; // assurer rendu fresh pour état auth

export default async function Page() {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const authenticated = !!user;
    return (
        <main id="main" tabIndex={-1} className="min-h-screen focus:outline-none">
            <Landing authenticated={authenticated} />
        </main>
    );
}
