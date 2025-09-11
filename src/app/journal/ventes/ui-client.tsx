"use client";
import React, { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { formatDateISO } from "@/lib/format";
import { isAllowed } from "@/lib/accounting/accountsCatalog";
import { createEntry, updateEntry } from "./actions";
import { AccountCodeSelector } from "@/components/AccountCodeSelector";
import { toast } from "sonner";
import { Spinner } from "@/components/SubmitButton";
import { computeFromHT, computeFromTTC } from "@/lib/vat";

const schema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().min(1),
  designation: z.string().min(1),
  tier: z.string().optional().nullable(),
  account_code: z.string().min(1),
  amount: z.string().min(1),
  currency: z.string().default("EUR"),
  isDeposit: z.string().optional(),
  propertyId: z.string().uuid({ message: "Bien requis" }),
});

async function presign(entryId: string, file: File) {
  const res = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      entryId,
    }),
  });
  if (!res.ok) throw new Error("Pré-signature échouée");
  return (await res.json()) as Promise<{
    provider: "s3" | "mock";
    url: string;
    fields?: Record<string, string>;
    headers?: Record<string, string>;
    storageKey: string;
  }>;
}
async function directUpload(
  p: {
    provider: "s3" | "mock";
    url: string;
    fields?: Record<string, string>;
    headers?: Record<string, string>;
  },
  file: File,
) {
  if (p.provider === "s3") {
    const form = new FormData();
    if (p.fields)
      Object.entries(p.fields).forEach(([k, v]) => form.append(k, v));
    form.append("Content-Type", file.type || "application/octet-stream");
    form.append("file", file);
    const up = await fetch(p.url, { method: "POST", body: form });
    if (!up.ok) throw new Error("Upload S3 échoué");
    return;
  }
  const headers = new Headers(p.headers || {});
  const up = await fetch(p.url, { method: "PUT", headers, body: file });
  if (!up.ok) throw new Error("Upload échoué");
}
async function createAttachment(payload: {
  entryId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
}) {
  const res = await fetch("/api/attachments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Enregistrement pièce échoué");
}

interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export default function JournalVentesClient({
  properties,
}: {
  properties: { id: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [selectedProperty, setSelectedProperty] = useState<string>(properties[0]?.id || "");
  const [vatOn, setVatOn] = useState<boolean>(false);
  useEffect(() => {
    let abort = false;
    (async () => {
      if (!selectedProperty) return setVatOn(false);
      try {
        const res = await fetch(`/api/settings/vat?property=${encodeURIComponent(selectedProperty)}`, { cache: "no-store" });
        if (!res.ok) { setVatOn(false); return; }
        const j = await res.json();
        if (!abort) setVatOn(Boolean(j.vatEnabled));
      } catch {
        if (!abort) setVatOn(false);
      }
    })();
    return () => { abort = true; };
  }, [selectedProperty]);

  const [ht, setHt] = useState<string>("");
  const [rate, setRate] = useState<string>("20");
  const [ttc, setTtc] = useState<string>("");
  const [tva, setTva] = useState<string>("");

  function recalcFromHT(newHt: string, newRate: string) {
    const h = parseFloat(newHt);
    const r = parseFloat(newRate);
    if (isFinite(h) && isFinite(r)) {
      const c = computeFromHT(h, r);
      setTva(c.tva.toFixed(2));
      setTtc(c.ttc.toFixed(2));
    }
  }
  function recalcFromTTC(newTtc: string, newRate: string) {
    const t = parseFloat(newTtc);
    const r = parseFloat(newRate);
    if (isFinite(t) && isFinite(r)) {
      const c = computeFromTTC(t, r);
      setHt(c.ht.toFixed(2));
      setTva(c.tva.toFixed(2));
    }
  }

  const onFiles = useCallback((list: FileList | File[]) => {
    const arr = Array.from(list);
    setFiles((prev) => [...prev, ...arr]);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
    },
    [onFiles],
  );

  async function uploadAll(entryId: string) {
    for (const f of files) {
      try {
        const pre = await presign(entryId, f);
        await directUpload(pre, f);
        await createAttachment({
          entryId,
          fileName: f.name,
          fileSize: f.size,
          mimeType: f.type || "application/octet-stream",
          storageKey: pre.storageKey,
        });
      } catch {
        toast.error(`Upload échoué: ${f.name}`);
      }
    }
    if (files.length) toast.success(`${files.length} pièce(s) ajoutée(s)`);
    setFiles([]);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("currency", "EUR");
    if (!fd.get("propertyId")) fd.set("propertyId", selectedProperty);
    if (vatOn) {
      const effectiveTtc = (fd.get("amountTTC") as string) || ttc || "";
      if (effectiveTtc) fd.set("amount", effectiveTtc);
    }
    const obj = Object.fromEntries(fd) as Record<string, FormDataEntryValue>;
    const parsed = schema.safeParse(obj);
    if (!parsed.success) {
      setError(
        "Validation: " + parsed.error.issues.map((i) => i.message).join(", "),
      );
      return;
    }
    if (
      isAllowed(String(fd.get("account_code") || ""), "achat") &&
      !isAllowed(String(fd.get("account_code") || ""), "vente")
    ) {
      setError("Compte réservé aux achats");
      return;
    }
    startTransition(async () => {
      const res: ActionResult = await createEntry(fd);
      if (!res?.ok) setError(res?.error || "Erreur inconnue");
      else {
        if (res.id) await uploadAll(res.id);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div>
      <button
        className="btn-primary"
        onClick={() => {
          setError(null);
          setOpen(true);
          setHt(""); setRate("20"); setTtc(""); setTva("");
        }}
      >
        Ajouter
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-md shadow-md w-full max-w-md p-5 space-y-4">
            <h2 className="text-lg font-medium">Nouvelle écriture vente</h2>
            <form onSubmit={onSubmit} className="space-y-3">
              <select
                name="propertyId"
                className="input w-full"
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                required
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                name="date"
                type="date"
                defaultValue={formatDateISO(new Date())}
                className="input w-full"
              />
              <input
                name="designation"
                placeholder="Désignation"
                className="input w-full"
              />
              <input
                name="tier"
                placeholder="Client (optionnel)"
                className="input w-full"
              />
              <AccountCodeSelector typeJournal="vente" />
              {!vatOn && (
                <input name="amount" placeholder="Montant TTC" className="input w-full" />
              )}
              {vatOn && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <div className="text-sm font-medium">Montant HT</div>
                    <input
                      name="amountHT"
                      value={ht}
                      onChange={(e) => { setHt(e.target.value); recalcFromHT(e.target.value, rate); }}
                      className="input w-full"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="space-y-1">
                    <div className="text-sm font-medium">Taux TVA (%)</div>
                    <input
                      name="vatRate"
                      value={rate}
                      onChange={(e) => { setRate(e.target.value); if (ht) recalcFromHT(ht, e.target.value); else if (ttc) recalcFromTTC(ttc, e.target.value); }}
                      className="input w-full"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="space-y-1 col-span-2">
                    <div className="text-sm font-medium">Montant TTC</div>
                    <input
                      name="amountTTC"
                      value={ttc}
                      onChange={(e) => { setTtc(e.target.value); recalcFromTTC(e.target.value, rate); }}
                      className="input w-full"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="space-y-1 col-span-2">
                    <div className="text-sm font-medium">Montant TVA (auto)</div>
                    <input name="vatAmount" value={tva} readOnly className="input w-full bg-muted/50" />
                  </label>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isDeposit" value="on" />
                <span>Caution (à exclure du revenu)</span>
                <span
                  className="text-xs text-muted-foreground"
                  title="La caution n’est pas un revenu. Elle sera affichée dans ‘Ce que je dois’ au bilan."
                >
                  ?
                </span>
              </label>

              <div className="mt-2 border rounded-md p-3">
                <div className="text-sm font-medium mb-1">Justificatifs</div>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  className="text-xs text-muted-foreground border border-dashed rounded p-3"
                >
                  Glisser-déposer PDF/JPG/PNG ici (max 10 Mo)
                  <div className="mt-2">
                    <button
                      type="button"
                      className="btn inline-flex items-center gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isPending}
                    >
                      {isPending && <Spinner />}
                      Choisir un fichier
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      hidden
                      onChange={(e) => {
                        if (e.target.files) onFiles(e.target.files);
                      }}
                    />
                  </div>
                </div>
                {!!files.length && (
                  <ul className="mt-2 text-xs list-disc pl-4">
                    {files.map((f, i) => (
                      <li key={i}>
                        {f.name} ({(f.size / 1024).toFixed(0)} Ko)
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setOpen(false)}
                >
                  Annuler
                </button>
                <button
                  disabled={isPending}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  {isPending && <Spinner />}
                  {isPending ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
              {error && (
                <p className="text-xs text-[--color-danger]">{error}</p>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface EditButtonProps {
  entry: {
    id: string;
    date: string | Date;
    designation: string;
    tier: string | null;
    account_code: string;
    amount: string | number;
    isDeposit?: boolean;
    propertyId?: string;
    amountHT?: number;
    vatRate?: number;
    vatAmount?: number;
    amountTTC?: number;
  };
}

export function EditButton({ entry, properties }: EditButtonProps & { properties: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [selectedProperty, setSelectedProperty] = useState<string>(entry.propertyId || properties[0]?.id || "");
  const [vatOn, setVatOn] = useState<boolean>(false);
  useEffect(() => {
    let abort = false;
    (async () => {
      if (!selectedProperty) return setVatOn(false);
      try {
        const res = await fetch(`/api/settings/vat?property=${encodeURIComponent(selectedProperty)}`, { cache: "no-store" });
        if (!res.ok) { setVatOn(false); return; }
        const j = await res.json();
        if (!abort) setVatOn(Boolean(j.vatEnabled));
      } catch {
        if (!abort) setVatOn(false);
      }
    })();
    return () => { abort = true; };
  }, [selectedProperty]);
  const [htE, setHtE] = useState<string>(entry.amountHT != null ? String(entry.amountHT.toFixed ? entry.amountHT.toFixed(2) : entry.amountHT) : "");
  const [rateE, setRateE] = useState<string>(entry.vatRate != null ? String(entry.vatRate) : "20");
  const [ttcE, setTtcE] = useState<string>(entry.amountTTC != null ? String(entry.amountTTC.toFixed ? entry.amountTTC.toFixed(2) : entry.amountTTC) : String(entry.amount));
  const [tvaE, setTvaE] = useState<string>(entry.vatAmount != null ? String(entry.vatAmount.toFixed ? entry.vatAmount.toFixed(2) : entry.vatAmount) : "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", entry.id);
    if (!fd.get("propertyId")) fd.set("propertyId", selectedProperty);
    if (vatOn) {
      const effectiveTtc = (fd.get("amountTTC") as string) || ttcE || "";
      if (effectiveTtc) fd.set("amount", effectiveTtc);
    }
    const obj = Object.fromEntries(fd) as Record<string, FormDataEntryValue>;
    const parsed = schema.safeParse(obj);
    if (!parsed.success) {
      setError(
        "Validation: " + parsed.error.issues.map((i) => i.message).join(", "),
      );
      return;
    }
    if (
      isAllowed(String(fd.get("account_code") || ""), "achat") &&
      !isAllowed(String(fd.get("account_code") || ""), "vente")
    ) {
      setError("Compte réservé aux achats");
      return;
    }
    startTransition(async () => {
      const res: ActionResult = await updateEntry(fd);
      if (!res?.ok) setError(res?.error || "Erreur inconnue");
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        className="text-xs text-brand hover:underline"
        onClick={() => {
          setError(null);
          setOpen(true);
          setHtE(entry.amountHT != null ? String(entry.amountHT.toFixed ? entry.amountHT.toFixed(2) : entry.amountHT) : "");
          setRateE(entry.vatRate != null ? String(entry.vatRate) : "20");
          setTtcE(entry.amountTTC != null ? String(entry.amountTTC.toFixed ? entry.amountTTC.toFixed(2) : entry.amountTTC) : String(entry.amount));
          setTvaE(entry.vatAmount != null ? String(entry.vatAmount.toFixed ? entry.vatAmount.toFixed(2) : entry.vatAmount) : "");
        }}
      >
        Edit
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-md shadow-md w-full max-w-md p-5 space-y-4">
            <h2 className="text-lg font-medium">Modifier écriture</h2>
            <form onSubmit={onSubmit} className="space-y-3">
              <select
                name="propertyId"
                className="input w-full"
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                required
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                name="date"
                type="date"
                defaultValue={formatDateISO(entry.date)}
                className="input w-full"
              />
              <input
                name="designation"
                defaultValue={entry.designation}
                className="input w-full"
              />
              <input
                name="tier"
                defaultValue={entry.tier || ""}
                className="input w-full"
              />
              <AccountCodeSelector typeJournal="vente" defaultValue={entry.account_code} />
              {!vatOn && (
                <input name="amount" defaultValue={entry.amount} className="input w-full" />
              )}
              {vatOn && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <div className="text-sm font-medium">Montant HT</div>
                    <input name="amountHT" value={htE} onChange={(e) => { setHtE(e.target.value); const h = parseFloat(e.target.value); const r = parseFloat(rateE); if (isFinite(h) && isFinite(r)) { const c = computeFromHT(h, r); setTvaE(c.tva.toFixed(2)); setTtcE(c.ttc.toFixed(2)); } }} className="input w-full" inputMode="decimal" />
                  </label>
                  <label className="space-y-1">
                    <div className="text-sm font-medium">Taux TVA (%)</div>
                    <input name="vatRate" value={rateE} onChange={(e) => { setRateE(e.target.value); if (htE) { const h = parseFloat(htE); const r = parseFloat(e.target.value); if (isFinite(h) && isFinite(r)) { const c = computeFromHT(h, r); setTvaE(c.tva.toFixed(2)); setTtcE(c.ttc.toFixed(2)); } } else if (ttcE) { const t = parseFloat(ttcE); const r = parseFloat(e.target.value); if (isFinite(t) && isFinite(r)) { const c = computeFromTTC(t, r); setHtE(c.ht.toFixed(2)); setTvaE(c.tva.toFixed(2)); } } }} className="input w-full" inputMode="decimal" />
                  </label>
                  <label className="space-y-1 col-span-2">
                    <div className="text-sm font-medium">Montant TTC</div>
                    <input name="amountTTC" value={ttcE} onChange={(e) => { setTtcE(e.target.value); const t = parseFloat(e.target.value); const r = parseFloat(rateE); if (isFinite(t) && isFinite(r)) { const c = computeFromTTC(t, r); setHtE(c.ht.toFixed(2)); setTvaE(c.tva.toFixed(2)); } }} className="input w-full" inputMode="decimal" />
                  </label>
                  <label className="space-y-1 col-span-2">
                    <div className="text-sm font-medium">Montant TVA (auto)</div>
                    <input name="vatAmount" value={tvaE} readOnly className="input w-full bg-muted/50" />
                  </label>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isDeposit"
                  defaultChecked={!!entry.isDeposit}
                />
                <span>Caution (à exclure du revenu)</span>
                <span
                  className="text-xs text-muted-foreground"
                  title="La caution n’est pas un revenu. Elle sera affichée dans ‘Ce que je dois’ au bilan."
                >
                  ?
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setOpen(false)}
                >
                  Annuler
                </button>
                <button
                  disabled={isPending}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  {isPending && <Spinner />}
                  {isPending ? "Sauvegarde..." : "Mettre à jour"}
                </button>
              </div>
              {error && (
                <p className="text-xs text-[--color-danger]">{error}</p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
