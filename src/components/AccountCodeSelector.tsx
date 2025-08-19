"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { listFor, isAllowed, searchAccounts } from '@/lib/accounting/accountsCatalog';

interface Props { typeJournal: 'achat'|'vente'; name?: string; defaultValue?: string; onChange?: (v: string)=>void; onInvalidSelection?: (typed: string)=>void; }

export function AccountCodeSelector({ typeJournal, name='account_code', defaultValue='', onChange, onInvalidSelection }: Props) {
  const allowedList = useMemo(()=> listFor(typeJournal), [typeJournal]);
  const initialValid = allowedList.find(a=>a.code===defaultValue)?.code || '';
  const [value, setValue] = useState(initialValid);
  const [query, setQuery] = useState(''); // recherche tapée
  const [open, setOpen] = useState(false);
  const displayList = useMemo(()=> searchAccounts(query, typeJournal, 50), [query, typeJournal]);
  const acc = allowedList.find(a=> a.code === value);
  const allowed = !!acc && isAllowed(value, typeJournal);

  useEffect(()=> { onChange?.(value); }, [value, onChange]);

  function handleType(e: React.ChangeEvent<HTMLInputElement>) {
    const t = e.target.value.trim();
    setQuery(t);
    setOpen(true);
  }
  function select(code: string){
    setValue(code); setQuery(''); setOpen(false);
  }
  function handleBlur() {
    // Si l'utilisateur a tapé quelque chose mais n'a pas sélectionné => invalide
    if (query && onInvalidSelection) onInvalidSelection(query);
    setQuery(''); setOpen(false);
  }

  return <div className="space-y-1">
    <input type="hidden" name={name} value={value} />
    <div className="relative">
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            value={query || value}
            onFocus={()=> setOpen(true)}
            onChange={handleType}
            onBlur={handleBlur}
            onKeyDown={e=> { if(e.key==='Escape'){ e.preventDefault(); setOpen(false); setQuery(''); }}}
            placeholder="Rechercher compte..."
            aria-label="Recherche compte comptable"
            className={`input w-full pr-24 ${(!allowed && !query && value)?'border-red-500':''}`}
            autoComplete="off"
          />
        </div>
        <div className="flex items-center text-[10px] gap-1">
          {allowed && value && <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-300">{value}</span>}
          {!value && <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 border">Choisir</span>}
        </div>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 overflow-auto w-full rounded-md border bg-white shadow">
          {displayList.map(a => (
            <button type="button" key={a.code} className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 ${a.code===value?'bg-gray-50':''}`}
              onMouseDown={e=> e.preventDefault()}
              onClick={()=> select(a.code)}>
              <span className="font-medium">{a.code} – {a.label}</span><br />
              <span className="text-[11px] text-muted-foreground line-clamp-2">{a.description}</span>
            </button>
          ))}
          {!displayList.length && <div className="px-3 py-2 text-xs text-muted-foreground">Aucun résultat</div>}
        </div>
      )}
    </div>
    {acc && <div className="text-[11px] text-muted-foreground">{acc.label} – {acc.description}</div>}
  </div>;
}
