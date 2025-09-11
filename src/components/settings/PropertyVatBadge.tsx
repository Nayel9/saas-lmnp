"use client";

import React, { useEffect, useState } from "react";

export default function PropertyVatBadge({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: boolean;
}) {
  const [enabled, setEnabled] = useState<boolean>(initial);

  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("vat-updates");
      const handler = (e: MessageEvent) => {
        const msg = e.data as { propertyId?: string; vatEnabled?: boolean } | null;
        if (!msg || msg.propertyId !== propertyId) return;
        setEnabled(!!msg.vatEnabled);
      };
      bc.addEventListener("message", handler);
      return () => {
        bc?.removeEventListener("message", handler);
        bc?.close();
      };
    } catch {
      // BroadcastChannel may be unavailable; fallback: no realtime updates
      return;
    }
  }, [propertyId]);

  return (
    <div
      className={`text-xs px-2 py-0.5 rounded-full badge
        ml-2 ${
        enabled ? "bg-emerald-100 text-emerald-800" : "bg-muted/50 text-muted-foreground"
      }`}
    >
      {enabled ? "TVA activée" : "TVA désactivée"}
    </div>
  );
}

