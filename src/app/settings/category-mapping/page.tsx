import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

async function fetchMappings(propertyId: string) {
  return await prisma.categoryToAccount.findMany({
    where: { propertyId },
    include: { account: true },
    orderBy: { categoryKey: "asc" },
  });
}

async function fetchAccounts(propertyId: string) {
  return prisma.ledgerAccount.findMany({
    where: { OR: [{ propertyId: null }, { propertyId }] },
    orderBy: { code: 'asc' }
  });
}

export default async function CategoryMappingPage({ searchParams }: { searchParams?: Promise<Record<string,string>> }) {
  const sp = searchParams ? await searchParams : {};
  const session = await auth();
  const user = session?.user;
  if (!user) return <div className="p-6">Non authentifié</div>;
  const properties = await prisma.property.findMany({ where: { user_id: user.id }, orderBy: { label: 'asc' }, select: { id: true, label: true } });
  const currentProp = sp.property || properties[0]?.id;
  if (!currentProp) return <div className="p-6">Aucun bien</div>;
  const [mappings, accounts] = await Promise.all([
    fetchMappings(currentProp),
    fetchAccounts(currentProp)
  ]);

  async function saveMapping(formData: FormData) {
    'use server';
    const categoryKey = String(formData.get('categoryKey')||'').trim();
    const accountId = String(formData.get('accountId')||'').trim();
    if (!categoryKey || !accountId) return;
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/category-mapping`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ propertyId: currentProp, categoryKey, accountId }) });
  }

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Raccourcis Catégories</h1>
          <p className="text-sm text-muted-foreground">Associer une catégorie (libre) à un compte comptable pour pré‑sélection rapide.</p>
        </div>
        <form method="get" className="flex gap-2 items-center">
          <select name="property" defaultValue={currentProp} className="input">
            {properties.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button className="btn-primary">Changer</button>
        </form>
      </header>

      <section className="card p-4 space-y-4">
        <h2 className="font-medium">Nouveau / Mettre à jour</h2>
        <form action={saveMapping} className="flex flex-wrap gap-2 items-end text-sm">
          <label className="space-y-1">
            <span className="block text-xs">Catégorie</span>
            <input name="categoryKey" className="input w-56" placeholder="ex: loyer" required />
          </label>
          <label className="space-y-1">
            <span className="block text-xs">Compte</span>
            <select name="accountId" className="input w-64" required>
              <option value="" disabled>Sélectionner...</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.label}</option>)}
            </select>
          </label>
          <button className="btn-primary">Enregistrer</button>
        </form>
      </section>

      <section className="card p-4 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-4">Catégorie</th>
              <th className="py-2 pr-4">Compte</th>
              <th className="py-2 pr-4">Libellé</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map(m => (
              <tr key={m.id} className="border-b last:border-none">
                <td className="py-1 pr-4 font-mono">{m.categoryKey}</td>
                <td className="py-1 pr-4">{m.account.code}</td>
                <td className="py-1 pr-4 text-xs">{m.account.label}</td>
              </tr>
            ))}
            {!mappings.length && (
              <tr><td colSpan={3} className="py-4 text-center text-xs text-muted-foreground">Aucun mapping</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

