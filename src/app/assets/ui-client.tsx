"use client";
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { z } from "zod";
import { formatDateISO } from "@/lib/format";
import { createAsset, updateAsset } from "./actions";
import { listFor } from "@/lib/accounting/accountsCatalog";
import { AccountCodeSelector } from "@/components/AccountCodeSelector";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/SubmitButton";

const schema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  amount_ht: z.string().min(1),
  duration_years: z.string().min(1),
  acquisition_date: z.string().min(1),
  account_code: z.string().refine(
    (v) =>
      listFor("asset")
        .map((a) => a.code)
        .includes(v),
    "Compte immobilisation invalide",
  ),
});

async function presign(assetId: string, file: File) {
  const res = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      assetId,
    }),
  });
  if (!res.ok) {
    await res.text().catch(() => null);
    throw new Error("Pré-signature échouée");
  }
  const data = await res.json();
  return data as Promise<{
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
    if (!up.ok) {
      await up.text().catch(() => null);
      throw new Error("Upload S3 échoué");
    }
    return;
  }
  const headers = new Headers(p.headers || {});
  const up = await fetch(p.url, { method: "PUT", headers, body: file });
  if (!up.ok) {
    await up.text().catch(() => null);
    throw new Error("Upload échoué");
  }
}
async function createAttachment(payload: {
  entryId?: string;
  assetId?: string;
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
  if (!res.ok) {
    await res.text().catch(() => null);
    throw new Error("Enregistrement pièce échoué");
  }
}

interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export function AddAssetButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [accountCode, setAccountCode] = useState("");
  const formValid = useMemo(() => !!accountCode, [accountCode]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
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

  async function uploadAll(assetId: string) {
    for (const f of files) {
      try {
        const pre = await presign(assetId, f);
        await directUpload(pre, f);
        await createAttachment({
          assetId,
          fileName: f.name,
          fileSize: f.size,
          mimeType: f.type || "application/octet-stream",
          storageKey: pre.storageKey,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Upload échoué`;
        toast.error(`Upload échoué: ${f.name} (${msg})`);
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
    const parsed = schema.safeParse(obj);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(", "));
      return;
    }
    startTransition(async () => {
      const res: ActionResult = await createAsset(fd);
      if (!res.ok) setError(res.error || "Erreur inconnue");
      else {
        if (res.id) {
          await uploadAll(res.id);
          try {
            router.refresh();
          } catch {
            /* ignore */
          }
        }
        setOpen(false);
      }
    });
  }

  return (
    <>
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
            <h2 className="text-lg font-medium">Nouvelle immobilisation</h2>
            <form onSubmit={onSubmit} className="space-y-3">
              <input
                name="label"
                placeholder="Libellé"
                className="input w-full"
              />
              <input
                name="amount_ht"
                placeholder="Montant HT"
                className="input w-full"
              />
              <input
                name="duration_years"
                placeholder="Durée (années)"
                className="input w-full"
              />
              <input
                name="acquisition_date"
                type="date"
                defaultValue={formatDateISO(new Date())}
                className="input w-full"
              />
              <AccountCodeSelector
                typeJournal="asset"
                required
                onChange={setAccountCode}
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
                <button
                  className="btn-primary inline-flex items-center gap-2"
                  disabled={isPending || !formValid}
                >
                  {isPending && <Spinner />}
                  {isPending ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
              {error && (
                <p
                  data-testid="asset-form-error"
                  className="text-xs text-[--color-danger]"
                >
                  {error}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}

interface EditProps {
  asset: {
    id: string;
    label: string;
    amount_ht: number;
    duration_years: number;
    acquisition_date: string | Date;
    account_code: string;
  };
}
export function EditAssetButton({ asset }: EditProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [accountCode, setAccountCode] = useState(asset.account_code || "");
  const formValid = useMemo(() => !!accountCode, [accountCode]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", asset.id);
    const obj = Object.fromEntries(fd) as Record<string, FormDataEntryValue>;
    const parsed = schema.safeParse(obj);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(", "));
      return;
    }
    startTransition(async () => {
      const res: ActionResult = await updateAsset(fd);
      if (!res.ok) setError(res.error || "Erreur inconnue");
      else setOpen(false);
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
            <h2 className="text-lg font-medium">Modifier immobilisation</h2>
            <form onSubmit={onSubmit} className="space-y-3">
              <input
                name="label"
                defaultValue={asset.label}
                className="input w-full"
              />
              <input
                name="amount_ht"
                defaultValue={asset.amount_ht}
                className="input w-full"
              />
              <input
                name="duration_years"
                defaultValue={asset.duration_years}
                className="input w-full"
              />
              <input
                name="acquisition_date"
                type="date"
                defaultValue={formatDateISO(asset.acquisition_date)}
                className="input w-full"
              />
              <AccountCodeSelector
                typeJournal="asset"
                defaultValue={asset.account_code}
                required
                onChange={setAccountCode}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setOpen(false)}
                >
                  Annuler
                </button>
                <button
                  className="btn-primary inline-flex items-center gap-2"
                  disabled={isPending || !formValid}
                >
                  {isPending && <Spinner />}
                  {isPending ? "Sauvegarde..." : "Mettre à jour"}
                </button>
              </div>
              {error && (
                <p
                  data-testid="asset-form-error"
                  className="text-xs text-[--color-danger]"
                >
                  {error}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
