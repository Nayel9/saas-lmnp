"use client";
import React, { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from 'next/navigation';
import { z } from "zod";
import { formatDateISO } from "@/lib/format";
import { isAllowed } from "@/lib/accounting/accountsCatalog";
import { createEntry, updateEntry } from "./actions";
import { AccountCodeSelector } from "@/components/AccountCodeSelector";
import { toast } from "sonner";
import { Spinner } from "@/components/SubmitButton";

const schema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().min(1),
  designation: z.string().min(1),
  tier: z.string().optional().nullable(),
  account_code: z.string().min(1),
  amount: z.string().min(1),
  currency: z.string().default("EUR"),
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

export default function JournalAchatsClient() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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
    const obj = Object.fromEntries(fd) as Record<string, FormDataEntryValue>;
    (obj as unknown as { currency: string }).currency = "EUR";
    const parsed = schema.safeParse(obj);
    if (!parsed.success) {
      setError(
        "Validation: " + parsed.error.issues.map((i) => i.message).join(", "),
      );
      return;
    }
    // Validation catalogue côté client (soft): empêcher compte explicitement ventes
    if (
      isAllowed(parsed.data.account_code, "vente") &&
      !isAllowed(parsed.data.account_code, "achat")
    ) {
      setError("Compte réservé aux ventes");
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
        }}
      >
        Ajouter
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-md shadow-md w-full max-w-md p-5 space-y-4">
            <h2 className="text-lg font-medium">Nouvelle écriture achat</h2>
            <form onSubmit={onSubmit} className="space-y-3">
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
                placeholder="Tier (optionnel)"
                className="input w-full"
              />
              <AccountCodeSelector typeJournal="achat" />
              <input
                name="amount"
                placeholder="Montant"
                className="input w-full"
              />

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
                <button disabled={isPending} className="btn-primary inline-flex items-center gap-2">
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
  };
}

export function EditButton({ entry }: EditButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", entry.id);
    const obj = Object.fromEntries(fd) as Record<string, FormDataEntryValue>;
    const parsed = schema.safeParse(obj);
    if (!parsed.success) {
      setError(
        "Validation: " + parsed.error.issues.map((i) => i.message).join(", "),
      );
      return;
    }
    if (
      isAllowed(parsed.data.account_code, "vente") &&
      !isAllowed(parsed.data.account_code, "achat")
    ) {
      setError("Compte réservé aux ventes");
      return;
    }
    startTransition(async () => {
      const res: ActionResult = await updateEntry(fd);
      if (!res?.ok) setError(res?.error || "Erreur inconnue");
      else { setOpen(false); router.refresh(); }
    });
  }

  return (
    <>
      <button
        className="text-xs text-brand hover:underline"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Edit
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-md shadow-md w-full max-w-md p-5 space-y-4">
            <h2 className="text-lg font-medium">Modifier écriture</h2>
            <form onSubmit={onSubmit} className="space-y-3">
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
              <AccountCodeSelector
                typeJournal="achat"
                defaultValue={entry.account_code}
              />
              <input
                name="amount"
                defaultValue={entry.amount}
                className="input w-full"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setOpen(false)}
                >
                  Annuler
                </button>
                <button disabled={isPending} className="btn-primary inline-flex items-center gap-2">
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
