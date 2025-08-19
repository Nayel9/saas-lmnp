"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { listFor, isAllowed, findClosest, searchAccounts } from '@/lib/accounting/accountsCatalog';

interface Props { typeJournal: 'achat'|'vente'; name?: string; defaultValue?: string; onChange?: (v: string)=>void; }

export function AccountCodeSelector({ typeJournal, name='account_code', defaultValue='', onChange }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const allowedList = useMemo(()=> listFor(typeJournal), [typeJournal]);
  const displayList = useMemo(()=> searchAccounts(query, typeJournal, 50), [query, typeJournal]);
  const acc = allowedList.find(a=> a.code === value);
  const mapped = !!acc;
  const allowed = isAllowed(value, typeJournal);
  const suggestion = !mapped ? findClosest(value, typeJournal) : undefined;

  useEffect(()=> { onChange?.(value); }, [value, onChange]);

  return <div className="space-y-1">
    <div className="relative">
      <input
        name={name}
        value={value}
        onFocus={()=> setOpen(true)}
        onChange={e=> { setValue(e.target.value); setQuery(e.target.value); setOpen(true); }}
        onKeyDown={e=> { if (e.key==='Escape') setOpen(false); }}
        placeholder="Compte (ex: 606)"
        aria-label="Compte comptable"
        className={`input w-full pr-24 ${!allowed && value? 'border-amber-500' : ''}`}
        autoComplete="off"
      />
      <div className="absolute top-1 right-2 flex gap-1">
        {!mapped && value && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">Non mappé</span>}
        {mapped && !allowed && <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-300">Invalide</span>}
        {mapped && allowed && <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-300">OK</span>}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 overflow-auto w-full rounded-md border bg-white shadow">
          {displayList.map(a => (
            <button type="button" key={a.code} className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 ${a.code===value?'bg-gray-50':''}`}
              onClick={()=> { setValue(a.code); setOpen(false); }}>
              <span className="font-medium">{a.code} – {a.label}</span><br />
              <span className="text-[11px] text-muted-foreground line-clamp-2">{a.description}</span>
            </button>
          ))}
          {!displayList.length && <div className="px-3 py-2 text-xs text-muted-foreground">Aucun résultat</div>}
        </div>
      )}
    </div>
    {!mapped && value && suggestion && (
      <div className="text-xs text-muted-foreground">Suggestion: <button type="button" className="underline" onClick={()=> setValue(suggestion.code)}>{suggestion.code} – {suggestion.label}</button></div>
    )}
    {acc && <div className="text-[11px] text-muted-foreground">{acc.label} – {acc.description}</div>}
  </div>;
}
