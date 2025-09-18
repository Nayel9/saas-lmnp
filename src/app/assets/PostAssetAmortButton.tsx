"use client";
import React, { useState } from "react";
import { toast } from "sonner";

export default function PostAssetAmortButton({
  propertyId,
  assetId,
  posted,
}: {
  propertyId: string;
  assetId: string;
  posted: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!propertyId) return null;
  if (posted) {
    return (
      <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-800" title="Amortissement posté pour ce mois">OK</span>
    );
  }
  return (
    <>
      <button type="button" className="btn text-xs" onClick={() => setOpen(true)}>
        Poster amort. (mois courant)
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-md shadow-md w-full max-w-md p-5 space-y-4">
            <h3 className="text-lg font-medium">Confirmer</h3>
            <p className="text-sm text-muted-foreground">Poster l’amortissement de ce mois pour cette immobilisation ?</p>
            <div className="flex justify-end gap-2">
              <button className="btn" type="button" onClick={() => setOpen(false)} disabled={busy}>Annuler</button>
              <button
                className="btn-primary"
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const now = new Date();
                    const body = {
                      propertyId,
                      year: now.getUTCFullYear(),
                      month: now.getUTCMonth() + 1,
                      scope: "asset" as const,
                      assetId,
                    };
                    const res = await fetch('/api/amortizations/post-month', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                    if (!res.ok) throw new Error(await res.text());
                    const j = await res.json();
                    toast.success(`Amortissement posté (${j.createdCount} créé(s), ${j.skippedCount} déjà présent(s))`);
                    setOpen(false);
                    // soft UI update: reload page to refresh badges
                    if (typeof window !== 'undefined') window.location.reload();
                  } catch {
                    toast.error('Échec du post');
                  } finally { setBusy(false); }
                }}
              >
                {busy ? '…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
