"use client";
import React, { useState, useTransition, useMemo } from 'react';
import { z } from 'zod';
import { formatDateISO } from '@/lib/format';
import { createAsset, updateAsset } from './actions';
import { listFor } from '@/lib/accounting/accountsCatalog';
import { AccountCodeSelector } from '@/components/AccountCodeSelector';

const assetCodes = listFor('asset').map(a=>a.code) as [string, ...string[]];
const schema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  amount_ht: z.string().min(1),
  duration_years: z.string().min(1),
  acquisition_date: z.string().min(1),
  account_code: z.string().refine(v => (listFor('asset').map(a=>a.code)).includes(v), 'Compte immobilisation invalide')
});

interface ActionResult { ok: boolean; error?: string }

export function AddAssetButton() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [accountCode, setAccountCode] = useState('');

  const formValid = useMemo(()=> !!accountCode, [accountCode]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const obj = Object.fromEntries(fd) as Record<string, FormDataEntryValue>;
    const parsed = schema.safeParse(obj);
    if (!parsed.success) {
      setError(parsed.error.issues.map(i=>i.message).join(', '));
      return;
    }
    startTransition(async () => {
      const res: ActionResult = await createAsset(fd);
      if (!res.ok) setError(res.error || 'Erreur inconnue'); else setOpen(false);
    });
  }

  return <>
    <button className="btn-primary" onClick={()=>{ setError(null); setOpen(true); }}>Ajouter</button>
    {open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-card rounded-md shadow-md w-full max-w-md p-5 space-y-4">
          <h2 className="text-lg font-medium">Nouvelle immobilisation</h2>
          <form onSubmit={onSubmit} className="space-y-3">
            <input name="label" placeholder="Libellé" className="input w-full" />
            <input name="amount_ht" placeholder="Montant HT" className="input w-full" />
            <input name="duration_years" placeholder="Durée (années)" className="input w-full" />
            <input name="acquisition_date" type="date" defaultValue={formatDateISO(new Date())} className="input w-full" />
            <AccountCodeSelector typeJournal="asset" required onChange={setAccountCode} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn" onClick={()=>setOpen(false)}>Annuler</button>
              <button className="btn-primary" disabled={isPending || !formValid}>{isPending? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
            {error && <p data-testid="asset-form-error" className="text-xs text-[--color-danger]">{error}</p>}
          </form>
        </div>
      </div>
    )}
  </>;
}

interface EditProps { asset: { id: string; label: string; amount_ht: number; duration_years: number; acquisition_date: string | Date; account_code: string } }
export function EditAssetButton({ asset }: EditProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [accountCode, setAccountCode] = useState(asset.account_code || '');
  const formValid = useMemo(()=> !!accountCode, [accountCode]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('id', asset.id);
    const obj = Object.fromEntries(fd) as Record<string, FormDataEntryValue>;
    const parsed = schema.safeParse(obj);
    if (!parsed.success) { setError(parsed.error.issues.map(i=>i.message).join(', ')); return; }
    startTransition(async () => {
      const res: ActionResult = await updateAsset(fd);
      if (!res.ok) setError(res.error || 'Erreur inconnue'); else setOpen(false);
    });
  }
  return <>
    <button className="text-xs text-brand hover:underline" onClick={()=>{ setError(null); setOpen(true); }}>Edit</button>
    {open && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-card rounded-md shadow-md w-full max-w-md p-5 space-y-4">
          <h2 className="text-lg font-medium">Modifier immobilisation</h2>
          <form onSubmit={onSubmit} className="space-y-3">
            <input name="label" defaultValue={asset.label} className="input w-full" />
            <input name="amount_ht" defaultValue={asset.amount_ht} className="input w-full" />
            <input name="duration_years" defaultValue={asset.duration_years} className="input w-full" />
            <input name="acquisition_date" type="date" defaultValue={formatDateISO(asset.acquisition_date)} className="input w-full" />
            <AccountCodeSelector typeJournal="asset" defaultValue={asset.account_code} required onChange={setAccountCode} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn" onClick={()=>setOpen(false)}>Annuler</button>
              <button className="btn-primary" disabled={isPending || !formValid}>{isPending? 'Sauvegarde...' : 'Mettre à jour'}</button>
            </div>
            {error && <p data-testid="asset-form-error" className="text-xs text-[--color-danger]">{error}</p>}
          </form>
        </div>
      </div>
    )}
  </>;
}
