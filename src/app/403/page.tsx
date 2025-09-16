import Link from "next/link";

export const metadata = { title: "Accès interdit" };

export default function Page403() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">403 – Accès interdit</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Vous n&apos;avez pas les droits nécessaires pour cette ressource.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/dashboard" className="btn">Retour au Dashboard</Link>
      </div>
    </main>
  );
}

