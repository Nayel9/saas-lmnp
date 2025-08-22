// app/auth/pending/page.tsx
"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import TWSpinner from "@/components/ui/loader/spinner";

function PendingPageClient() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status === "authenticated") {
      const to = searchParams.get("to") || "/dashboard";
      router.replace(to);
    }
  }, [status, router, searchParams]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-brand">
        <TWSpinner />
      </div>
      <p className="text-xl text-muted-foreground">Connexion en cours…</p>
    </div>
  );
}

export default function PendingPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-bg-muted text-foreground">
      <Suspense>
        <PendingPageClient />
      </Suspense>
    </main>
  );
}
