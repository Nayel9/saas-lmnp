"use client";
import React, { useState, useTransition } from 'react';
import { z } from 'zod';
import { formatDateISO } from '@/lib/format';
import { isAllowed } from '@/lib/accounting/accountsCatalog';
import { createEntry, updateEntry } from './actions';
import { AccountCodeSelector } from '@/components/AccountCodeSelector';

const schema = z.object({
  id: z.string().uuid().optional(),
  date: z.string().min(1),
  designation: z.string().min(1),
  tier: z.string().optional().nullable(),
  account_code: z.string().min(1),
  amount: z.string().min(1),
  currency: z.string().default('EUR')
});

interface ActionResult { ok: boolean; error?: string }

export default function JournalAchatsClient() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const obj = Object.fromEntries(fd) as Record<string, FormDataEntryValue>;
    (obj as unknown as { currency: string }).currency = 'EUR';
    const parsed = schema.safeParse(obj);
    if (!parsed.success) {
      setError('Validation: ' + parsed.error.issues.map(i => i.message).join(', '));
      return;
    }
    // Validation catalogue côté client (soft): empêcher compte explicitement ventes
    if (isAllowed(parsed.data.account_code, 'vente') && !isAllowed(parsed.data.account_code,'achat')) {
      setError('Compte réservé aux ventes');
      return;
    }
    startTransition(async () => {
      const res: ActionResult = await createEntry(fd);
      if (!res?.ok) setError(res?.error || 'Erreur inconnue');
      else setOpen(false);
    });
  }

  return (
    <div>
      <button className="btn-primary" onClick={() => { setError(null); setOpen(true); }}>Ajouter</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-md shadow-md w-full max-w-md p-5 space-y-4">
            <h2 className="text-lg font-medium">Nouvelle écriture achat</h2>
            <form onSubmit={onSubmit} className="space-y-3">
              <input name="date" type="date" defaultValue={formatDateISO(new Date())} className="input w-full" />
              <input name="designation" placeholder="Désignation" className="input w-full" />
              <input name="tier" placeholder="Tier (optionnel)" className="input w-full" />
              <AccountCodeSelector typeJournal="achat" />
              <input name="amount" placeholder="Montant" className="input w-full" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn" onClick={() => setOpen(false)}>Annuler</button>
                <button disabled={isPending} className="btn-primary">{isPending? 'Enregistrement...' : 'Enregistrer'}</button>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface EditButtonProps {
  entry: { id: string; date: string | Date; designation: string; tier: string | null; account_code: string; amount: string | number };
}

export function EditButton({ entry }: EditButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('id', entry.id);
    const obj = Object.fromEntries(fd) as Record<string, FormDataEntryValue>;
    const parsed = schema.safeParse(obj);
    if (!parsed.success) {
      setError('Validation: ' + parsed.error.issues.map(i => i.message).join(', '));
      return;
    }
    if (isAllowed(parsed.data.account_code, 'vente') && !isAllowed(parsed.data.account_code,'achat')) {
      setError('Compte réservé aux ventes');
      return;
    }
    startTransition(async () => {
      const res: ActionResult = await updateEntry(fd);
      if (!res?.ok) setError(res?.error || 'Erreur inconnue');
      else setOpen(false);
    });
  }

  return (
    <>
      <button className="text-xs text-blue-600 hover:underline" onClick={() => { setError(null); setOpen(true); }}>Edit</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-md shadow-md w-full max-w-md p-5 space-y-4">
            <h2 className="text-lg font-medium">Modifier écriture</h2>
            <form onSubmit={onSubmit} className="space-y-3">
              <input name="date" type="date" defaultValue={formatDateISO(entry.date)} className="input w-full" />
              <input name="designation" defaultValue={entry.designation} className="input w-full" />
              <input name="tier" defaultValue={entry.tier || ''} className="input w-full" />
              <AccountCodeSelector typeJournal="achat" defaultValue={entry.account_code} />
              <input name="amount" defaultValue={entry.amount} className="input w-full" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn" onClick={() => setOpen(false)}>Annuler</button>
                <button disabled={isPending} className="btn-primary">{isPending? 'Sauvegarde...' : 'Mettre à jour'}</button>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
