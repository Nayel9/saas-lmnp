"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TWSpinner from "@/components/ui/loader/spinner";

function formatEUR(n: number) {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

function toISODate(d: string | Date): string {
  const dd = new Date(d);
  return dd.toISOString().slice(0, 10);
}

type SaleDto = { id: string; date: string | Date; amount: number; tenant: string | null };
type PurchaseDto = { id: string; date: string | Date; amount: number; supplier: string | null };

type Scope = "user" | "property";

export default function DashboardHistoryClient() {
  const search = useSearchParams();
  const propertyId = search.get("property") || "";
  const scope: Scope = (search.get("scope") === "property" ? "property" : "user");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ sales: SaleDto[]; purchases: PurchaseDto[] } | null>(null);

  const q = useMemo(() => {
    const p = new URLSearchParams();
    if (scope === "property" && propertyId) p.set("property", propertyId);
    p.set("scope", scope);
    return p.toString();
  }, [propertyId, scope]);

  useEffect(() => {
    async function load() {
      if (scope === "property" && !propertyId) {
        setData(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dashboard/history?${q}`, { cache: "no-store" });
        if (!res.ok) {
          const txt = await res.text();
          setError(txt || `Erreur ${res.status}`);
          setData(null);
          return;
        }
        const j = await res.json();
        setData(j);
      } catch {
        setError("Erreur");
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [q, propertyId, scope]);

  if (scope === "property" && !propertyId) {
    return <div className="text-sm text-muted-foreground">Sélectionne un bien pour voir l&apos;historique.</div>;
  }

  if (loading) return <div className="flex items-center justify-center py-6"><TWSpinner /></div>;
  if (error) return <div className="text-sm text-[--color-danger]">{error}</div>;
  if (!data) return <div className="text-sm text-muted-foreground">Aucune donnée</div>;

  const { sales, purchases } = data;

  return (
    <div className="card p-4 space-y-4">
      <h2 className="text-lg font-medium">Historique rapide</h2>
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h3 className="font-medium mb-2">Loyers (derniers)</h3>
          {sales.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucune donnée</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {sales.map((s) => {
                const day = toISODate(s.date);
                const qTxt = s.tenant ? encodeURIComponent(s.tenant) : "";
                const openHref = `/journal/ventes?from=${day}&to=${day}${qTxt ? `&q=${qTxt}` : ""}`;
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3">
                    <div className="truncate">
                      <div className="font-medium truncate">{s.tenant || "Locataire"}</div>
                      <div className="text-muted-foreground text-xs">{new Date(s.date).toLocaleDateString("fr-FR")} · {formatEUR(s.amount)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link className="btn-primary" href={openHref}>Ouvrir</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section>
          <h3 className="font-medium mb-2">Dépenses (dernières)</h3>
          {purchases.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucune donnée</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {purchases.map((e) => {
                const day = toISODate(e.date);
                const qTxt = e.supplier ? encodeURIComponent(e.supplier) : "";
                const openHref = `/journal/achats?from=${day}&to=${day}${qTxt ? `&q=${qTxt}` : ""}`;
                return (
                  <li key={e.id} className="flex items-center justify-between gap-3">
                    <div className="truncate">
                      <div className="font-medium truncate">{e.supplier || "Fournisseur"}</div>
                      <div className="text-muted-foreground text-xs">{new Date(e.date).toLocaleDateString("fr-FR")} · {formatEUR(e.amount)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link className="btn-primary" href={openHref}>Ouvrir</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
