"use client";
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { listFor, isAllowed, searchAccounts, type AccountContext } from '@/lib/accounting/accountsCatalog';

interface Props { typeJournal: AccountContext; name?: string; defaultValue?: string; onChange?: (v: string)=>void; onInvalidSelection?: (typed: string)=>void; required?: boolean; allowFree?: boolean; }

export function AccountCodeSelector({ typeJournal, name='account_code', defaultValue='', onChange, onInvalidSelection, required=false, allowFree }: Props) {
  const free = allowFree ?? (typeJournal !== 'asset');
  const allowedList = useMemo(()=> listFor(typeJournal), [typeJournal]);
  const initialValid = allowedList.find(a=>a.code===defaultValue)?.code || '';
  const [value, setValue] = useState(initialValid);
  const [query, setQuery] = useState(''); // texte tapé
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const displayList = useMemo(()=> searchAccounts(query, typeJournal, 50), [query, typeJournal]);
  const acc = allowedList.find(a=> a.code === value);
  const allowed = !!acc && isAllowed(value, typeJournal);
  const descId = acc ? `${name}-desc` : undefined;

  useEffect(()=> { onChange?.(value); }, [value, onChange]);

  function handleType(e: React.ChangeEvent<HTMLInputElement>) {
    const t = e.target.value.trim();
    setQuery(t); setOpen(true); setHighlightIndex(0);
  }
  function select(code: string){
    setValue(code); setQuery(''); setOpen(false);
  }
  function handleBlur() {
    if (query && free && !value) { setValue(query); }
    else if (query && onInvalidSelection && !free) onInvalidSelection(query);
    setQuery(''); setOpen(false);
  }
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key==='ArrowDown' || e.key==='ArrowUp')) { setOpen(true); return; }
    if (e.key==='Enter') {
      if (open && displayList[highlightIndex]) { e.preventDefault(); select(displayList[highlightIndex].code); return; }
      if (free && query) { e.preventDefault(); setValue(query); setQuery(''); setOpen(false); return; }
    }
    if (!open) return;
    if (e.key==='ArrowDown') { e.preventDefault(); setHighlightIndex(i=> Math.min(displayList.length-1, i+1)); }
    else if (e.key==='ArrowUp') { e.preventDefault(); setHighlightIndex(i=> Math.max(0, i-1)); }
    else if (e.key==='Escape') { e.preventDefault(); setOpen(false); setQuery(''); }
  }, [open, displayList, highlightIndex, free, query]);

  useEffect(()=> { if (highlightIndex > displayList.length-1) setHighlightIndex(0); }, [displayList, highlightIndex]);

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
            onKeyDown={onKeyDown}
            placeholder="Rechercher compte..."
            aria-label="Recherche compte comptable"
            aria-describedby={descId}
            aria-required={required}
            className={`input w-full pr-24 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand ${(!allowed && !query && value)?'border-red-500':''}`}
            autoComplete="off"
          />
        </div>
        <div className="flex items-center text-[10px] gap-1">
          {allowed && value && <span className="badge text-brand" aria-label="Compte valide">{value}</span>}
          {!value && <span className="badge text-muted-foreground" aria-label="Choisir un compte">Choisir</span>}
        </div>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 overflow-auto w-full rounded-md border bg-card shadow" role="listbox">
          {displayList.map((a, idx) => (
            <button type="button" key={a.code} role="option" aria-selected={a.code===value}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-bg-muted ${a.code===value?'bg-bg-muted':''} ${idx===highlightIndex?'ring-1 ring-brand':''}`}
              onMouseDown={e=> e.preventDefault()}
              onClick={()=> select(a.code)}
              onMouseEnter={()=> setHighlightIndex(idx)}
            >
              <span className="font-medium">{a.code} – {a.label}</span><br />
              <span className="text-[11px] text-muted-foreground line-clamp-2">{a.description}</span>
            </button>
          ))}
          {!displayList.length && <div className="px-3 py-2 text-xs text-muted-foreground">Aucun résultat</div>}
        </div>
      )}
    </div>
    {acc && <div id={descId} className="text-[11px] text-muted-foreground">{acc.label} – {acc.description}</div>}
    {!acc && value && free && <div className="text-[11px] text-muted-foreground">Compte libre non mappé</div>}
  </div>;
}
