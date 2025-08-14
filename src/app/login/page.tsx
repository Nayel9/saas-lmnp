"use client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
    const router = useRouter();

    useEffect(() => {
        const client = getSupabaseBrowserClient();
        setSupabase(client);
        const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                router.replace('/dashboard');
            }
        });
        client.auth.getUser().then(({ data }) => {
            if (data.user) router.replace('/dashboard');
        });
        return () => { sub.subscription.unsubscribe(); };
    }, [router]);

    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-bg">
            <div className="w-full max-w-md card">
                <h1 className="text-xl font-semibold mb-4 tracking-tight">Connexion</h1>
                {supabase ? (
                    <Auth
                        supabaseClient={supabase}
                        appearance={{ theme: ThemeSupa }}
                        providers={[]}
                    />
                ) : (
                    <div>Chargement...</div>
                )}
            </div>
        </main>
    );
}
