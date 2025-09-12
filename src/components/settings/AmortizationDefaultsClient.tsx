"use client";
import React, { useEffect, useMemo, useState } from "react";
import { type AssetCategory, ASSET_CATEGORIES } from "@/types/asset-category";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface DefaultRow {
  id: string;
  propertyId: string;
  category: AssetCategory;
  defaultDurationMonths: number;
}

const formSchema = z.object({
  category: z.string().min(1),
  defaultDurationMonths: z
    .string()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) > 0, "Durée invalide"),
});

export default function AmortizationDefaultsClient({
  propertyId,
}: {
  propertyId: string;
}) {
  const [rows, setRows] = useState<DefaultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCategory, setNewCategory] = useState<AssetCategory | "">("");
  const [newMonths, setNewMonths] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editMonths, setEditMonths] = useState("");

  const used = useMemo(() => new Set(rows.map((r) => r.category)), [rows]);
  const availableCategories = useMemo(
    () => ASSET_CATEGORIES.filter((c) => !used.has(c)),
    [used],
  );

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(`/api/settings/amortization-defaults?property=${propertyId}`);
      if (!res.ok) throw new Error("Fetch échoué");
      const data = (await res.json()) as DefaultRow[];
      setRows(data);
    } catch {
      toast.error("Chargement des durées par défaut échoué");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  async function onCreate() {
    const parsed = formSchema.safeParse({ category: newCategory || "", defaultDurationMonths: newMonths });
    if (!parsed.success) {
      toast.error(parsed.error.issues.map((i) => i.message).join(", "));
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/settings/amortization-defaults`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propertyId,
          category: newCategory,
          defaultDurationMonths: Number(newMonths),
        }),
      });
      if (res.status === 409) {
        toast.error("Catégorie déjà définie");
      } else if (!res.ok) {
        toast.error("Création échouée");
      } else {
        setNewCategory("");
        setNewMonths("");
        await refresh();
        toast.success("Ajouté");
      }
    } finally {
      setCreating(false);
    }
  }

  async function onSave(id: string) {
    const parsed = formSchema.safeParse({ category: "x", defaultDurationMonths: editMonths });
    if (!parsed.success) {
      toast.error(parsed.error.issues.map((i) => i.message).join(", "));
      return;
    }
    const res = await fetch(`/api/settings/amortization-defaults/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ defaultDurationMonths: Number(editMonths) }),
    });
    if (!res.ok) {
      toast.error("Mise à jour échouée");
      return;
    }
    setEditId(null);
    setEditMonths("");
    await refresh();
    toast.success("Mis à jour");
  }

  async function onDelete(id: string) {
    if (!confirm("Supprimer cette catégorie ?")) return;
    const res = await fetch(`/api/settings/amortization-defaults/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Suppression échouée");
      return;
    }
    await refresh();
    toast.success("Supprimé");
  }

  return (
    <div className="space-y-3">
      <div className="border rounded-md">
        <div className="grid grid-cols-12 text-xs font-medium border-b bg-muted/40">
          <div className="col-span-5 p-2">Catégorie</div>
          <div className="col-span-5 p-2">Durée (mois)</div>
          <div className="col-span-2 p-2 text-right">Actions</div>
        </div>
        <div>
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-12 items-center border-b last:border-none">
              <div className="col-span-5 p-2 text-sm">{r.category}</div>
              <div className="col-span-5 p-2">
                {editId === r.id ? (
                  <Input
                    inputMode="numeric"
                    value={editMonths}
                    onChange={(e) => setEditMonths(e.target.value)}
                    placeholder="Mois"
                  />
                ) : (
                  <div className="text-sm tabular-nums">{r.defaultDurationMonths}</div>
                )}
              </div>
              <div className="col-span-2 p-2 flex justify-end gap-2">
                {editId === r.id ? (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => setEditId(null)}>Annuler</Button>
                    <Button size="sm" onClick={() => onSave(r.id)}>Enregistrer</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="secondary" onClick={() => { setEditId(r.id); setEditMonths(String(r.defaultDurationMonths)); }}>Éditer</Button>
                    <Button size="sm" variant="destructive" onClick={() => onDelete(r.id)}>Supprimer</Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {!rows.length && !loading && (
            <div className="p-3 text-sm text-muted-foreground">Aucune catégorie</div>
          )}
          {loading && <div className="p-3 text-sm">Chargement…</div>}
        </div>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs">Catégorie</label>
          <select
            className="input w-full"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as AssetCategory)}
          >
            <option value="">—</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="w-40">
          <label className="text-xs">Durée (mois)</label>
          <Input value={newMonths} onChange={(e) => setNewMonths(e.target.value)} placeholder="ex: 60" />
        </div>
        <div className="pb-[2px]">
          <Button disabled={creating} onClick={onCreate}>Ajouter une catégorie</Button>
        </div>
      </div>
    </div>
  );
}
