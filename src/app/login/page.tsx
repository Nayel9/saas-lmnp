"use client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <div className="w-full max-w-md">
                <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} />
            </div>
        </main>
    );
}
