"use client";
import React, { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function VatToggleClient({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean>(initial);
  const [loading, setLoading] = useState(false);

  function postUpdate(id: string, state: boolean) {
    try {
      const bc = new BroadcastChannel("vat-updates");
      bc.postMessage({ propertyId: id, vatEnabled: state });
      bc.close();
    } catch {
      // BroadcastChannel may not be available in some environments; ignore
    }
  }

  async function toggle(next?: boolean) {
    const target = typeof next === "boolean" ? next : !enabled;
    // update immédiat de l'UI (optimistic)
    setEnabled(target);
    postUpdate(propertyId, target);
    setLoading(true);
    try {
      const res = await fetch("/api/settings/vat", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, vatEnabled: target }),
      });
      if (!res.ok) {
        const text = await res.text();
        // rollback
        setEnabled(!target);
        postUpdate(propertyId, !target);
        toast.error(text || "Erreur serveur");
        return;
      }
      toast.success(`TVA ${target ? "activée" : "désactivée"}`);
      // refresh server components to reflect the new state elsewhere on the page
      try {
        router.refresh();
      } catch {
        // ignore refresh errors
      }
    } catch (err) {
      setEnabled(!target);
      postUpdate(propertyId, !target);
      toast.error("Échec de la sauvegarde");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => !loading && toggle()}
        disabled={loading}
        variant={enabled ? "secondary" : "default"}
        aria-pressed={enabled}
        title={enabled ? "Désactiver la TVA" : "Activer la TVA"}
        className={enabled ? "btn-primary" : "btn-ghost"}
      >
        {enabled ? "Désactiver la TVA" : "Activer la TVA"}
      </button>
    </div>
  );
}
