"use client";
import React, { useEffect, useState, useMemo } from 'react';

interface LedgerAccountDTO {
  id: string; code: string; label: string; kind: string; propertyId: string | null; isEditable: boolean;
}

interface Props {
  propertyId: string | undefined;
  name?: string;
  kind: 'REVENUE' | 'EXPENSE';
  defaultAccountId?: string | null;
  isDeposit?: boolean;
  onLoaded?(accounts: LedgerAccountDTO[]): void;
  onSelect?(acc: { id: string; code: string; label: string } | null): void;
}

export function LedgerAccountSelector({ propertyId, name = 'ledgerAccountId', kind, defaultAccountId, isDeposit, onLoaded, onSelect }: Props) {
  const [accounts, setAccounts] = useState<LedgerAccountDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | ''>(defaultAccountId || '');

  useEffect(() => { setSelected(defaultAccountId || ''); }, [defaultAccountId]);
  useEffect(() => {
    if (!propertyId) { setAccounts([]); return; }
    let abort = false; setLoading(true); setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/accounts?property=${encodeURIComponent(propertyId)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const j = await res.json();
        if (!abort) { setAccounts(j.accounts || []); onLoaded?.(j.accounts || []); }
      } catch {
        if (!abort) setError('Chargement comptes échoué');
      } finally { if (!abort) setLoading(false); }
    })();
    return () => { abort = true; };
  }, [propertyId, onLoaded]);

  const filtered = useMemo(() => {
    let list = accounts.filter(a => a.kind === kind || (isDeposit && a.code === '165'));
    if (isDeposit) list = list.filter(a => a.code === '165');
    return list.slice().sort((a,b) => a.code.localeCompare(b.code));
  }, [accounts, kind, isDeposit]);

  // Pré-sélection auto 165 en mode caution
  useEffect(() => {
    if (isDeposit) {
      const acc165 = accounts.find(a => a.code === '165');
      if (acc165) { setSelected(acc165.id); onSelect?.({ id: acc165.id, code: acc165.code, label: acc165.label }); }
    }
  }, [isDeposit, accounts, onSelect]);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setSelected(val);
    const acc = filtered.find(a => a.id === val) || accounts.find(a => a.id === val) || null;
    onSelect?.(acc ? { id: acc.id, code: acc.code, label: acc.label } : null);
  }

  return (
    <div className="space-y-1">
      <input type="hidden" name={name} value={selected} />
      <select
        className="input w-full"
        value={selected}
        onChange={onChange}
        disabled={loading || !!isDeposit}
        aria-label={kind === 'REVENUE' ? 'Compte de produits' : 'Compte de charges'}
      >
        <option value="" disabled>{loading ? 'Chargement...' : 'Sélectionner un compte'}</option>
        {error && <option value="" disabled>Erreur de chargement</option>}
        {!error && filtered.map(a => (
          <option key={a.id} value={a.id}>{a.code} — {a.label}{a.propertyId ? ' (custom)' : ''}</option>
        ))}
      </select>
      <div className="text-[10px] text-muted-foreground">
        {isDeposit ? 'Caution (165)' : kind === 'REVENUE' ? 'Sélectionnez un compte de produits' : 'Sélectionnez un compte de charges'}
      </div>
    </div>
  );
}
