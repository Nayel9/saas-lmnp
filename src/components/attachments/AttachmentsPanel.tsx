"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Spinner } from '@/components/SubmitButton';

interface AttachmentDto {
  id: string;
  entryId?: string;
  assetId?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  createdAt: string;
}

async function fetchListFor(parent: { entryId?: string; assetId?: string }): Promise<AttachmentDto[]> {
  if (parent.entryId) {
    const res = await fetch(`/api/entries/${parent.entryId}/attachments`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Erreur liste');
    return res.json();
  }
  if (parent.assetId) {
    const res = await fetch(`/api/assets/${parent.assetId}/attachments`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Erreur liste');
    return res.json();
  }
  throw new Error('Parent manquant');
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} o`;
  if (n < 1024*1024) return `${(n/1024).toFixed(1)} Ko`;
  return `${(n/1024/1024).toFixed(1)} Mo`;
}

async function presign(parent: { entryId?: string; assetId?: string }, file: File) {
  const body = { fileName: file.name, fileSize: file.size, mimeType: file.type || 'application/octet-stream', ...(parent.entryId? { entryId: parent.entryId } : { assetId: parent.assetId }) };
  const res = await fetch('/api/uploads/presign', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('Pré-signature échouée');
  return res.json() as Promise<{ provider: 's3'|'mock'; url: string; fields?: Record<string,string>; headers?: Record<string,string>; storageKey: string }>;
}

async function directUpload(p: { provider: 's3'|'mock'; url: string; fields?: Record<string,string>; headers?: Record<string,string> }, file: File) {
  if (p.provider === 's3') {
    const form = new FormData();
    if (p.fields) Object.entries(p.fields).forEach(([k,v]) => form.append(k, v));
    form.append('Content-Type', file.type || 'application/octet-stream');
    form.append('file', file);
    const up = await fetch(p.url, { method: 'POST', body: form });
    if (!up.ok) throw new Error('Upload S3 échoué');
    return;
  }
  const headers = new Headers(p.headers || {});
  const up = await fetch(p.url, { method: 'PUT', headers, body: file });
  if (!up.ok) throw new Error('Upload échoué');
}

async function createAttachment(parent: { entryId?: string; assetId?: string; fileName: string; fileSize: number; mimeType: string; storageKey: string }) {
  const { fileName, fileSize, mimeType, storageKey, entryId, assetId } = parent;
  const payload = entryId ? { entryId, fileName, fileSize, mimeType, storageKey } : { assetId, fileName, fileSize, mimeType, storageKey };
  const res = await fetch('/api/attachments', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('Enregistrement pièce échoué');
  return res.json();
}

export function AttachmentsButton(props: { entryId?: string; assetId?: string; count: number }) {
  const { entryId, assetId, count } = props;
  const [open, setOpen] = useState(false);
  const [cnt, setCnt] = useState<number>(count);
  return (
    <>
      <button className="text-xs hover:underline" onClick={() => setOpen(true)} title="Pièces jointes">📎 {cnt}</button>
      {open && (
        <AttachmentsPanel
          entryId={entryId}
          assetId={assetId}
          onCloseAction={() => setOpen(false)}
          onCountChangeAction={(n)=>setCnt(n)}
        />
      )}
    </>
  );
}

export function AttachmentsPanel({ entryId, assetId, onCloseAction, onCountChangeAction }: { entryId?: string; assetId?: string; onCloseAction: ()=>void; onCountChangeAction?: (n:number)=>void }) {
  const parent = useMemo(()=>({ entryId, assetId }), [entryId, assetId]);
  const [items, setItems] = useState<AttachmentDto[]|null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const reload = useCallback(async () => {
    try {
      const list = await fetchListFor(parent);
      setItems(list);
      onCountChangeAction?.(list.length);
    } catch {
      toast.error('Chargement des pièces échoué');
    }
  }, [parent, onCountChangeAction]);

  useEffect(() => { reload(); }, [reload]);

  async function deleteAttachment(id: string, fileName: string) {
    if (!confirm(`Supprimer la pièce jointe « ${fileName} » ?`)) return;
    try {
      setBusy(true);
      const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Suppression échouée');
        return;
      }
      toast.success('Supprimé');
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const onFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    for (const f of arr) {
      try {
        setBusy(true);
        const pre = await presign(parent, f);
        await directUpload(pre, f);
        await createAttachment({ ...parent, fileName: f.name, fileSize: f.size, mimeType: f.type || 'application/octet-stream', storageKey: pre.storageKey });
        toast.success(`Ajouté: ${f.name}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload échoué';
        toast.error(msg);
      } finally {
        setBusy(false);
      }
    }
    await reload();
  }, [parent, reload]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
  }, [onFiles]);

  const onSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) onFiles(e.target.files);
  }, [onFiles]);

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCloseAction}>
      <div className="bg-card rounded-md shadow-md w-full max-w-lg p-5 space-y-4" onClick={(e)=>e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium flex items-center gap-2">Pièces jointes {busy && <Spinner />}</h2>
          <button className="btn" onClick={onCloseAction}>Fermer</button>
        </div>
        <div onDragOver={(e)=>e.preventDefault()} onDrop={onDrop} className="border border-dashed rounded-md p-4 text-sm text-muted-foreground">
          Glisser-déposer PDF/JPG/PNG ici (max 10 Mo)
          <div className="mt-2">
            <button className="btn inline-flex items-center" onClick={()=>fileInputRef.current?.click()} disabled={busy}>{busy && <Spinner />}Choisir un fichier</button>
            <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={onSelect} />
          </div>
        </div>
        <div className="max-h-64 overflow-auto">
          {!items && (
            <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><Spinner /><span>Chargement…</span></div>
          )}
          {items && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b"><th className="py-1 pr-2">Nom</th><th className="py-1 pr-2">Taille</th><th className="py-1 pr-2">Date</th><th className="py-1 pr-2"/></tr>
              </thead>
              <tbody>
                {items?.map(a => (
                  <tr key={a.id} className="border-b last:border-none">
                    <td className="py-1 pr-2 break-all">{a.fileName}</td>
                    <td className="py-1 pr-2 whitespace-nowrap">{formatBytes(a.fileSize)}</td>
                    <td className="py-1 pr-2 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="py-1 pr-2 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <a className="text-xs text-brand hover:underline" href={`/api/attachments/${a.id}/download`}>Télécharger</a>
                        <button className="text-xs text-destructive hover:underline inline-flex items-center gap-1" disabled={busy} onClick={()=>deleteAttachment(a.id, a.fileName)}>
                          {busy && <Spinner />}Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!items?.length && (
                  <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Aucune pièce</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}

// Aperçu image (compatible entrée & immobilisation)
export function AttachmentsPreviewTrigger({ entryId, assetId }: { entryId?: string; assetId?: string }) {
  const parent = useMemo(()=>({ entryId, assetId }), [entryId, assetId]);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const loadedRef = useRef(false);
  const [maxSize, setMaxSize] = useState<{ maxWidth: number; maxHeight: number }>({ maxWidth: 800, maxHeight: 600 });

  function computeMaxSize() {
    const padding = 96; // marge autour du modal
    const mw = Math.max(200, window.innerWidth - padding);
    const mh = Math.max(200, window.innerHeight - padding);
    setMaxSize({ maxWidth: mw, maxHeight: mh });
  }

  async function ensureLoaded() {
    setLoading(true);
    try {
      const list = await fetchListFor(parent);
      const img = list.find(a => a.mimeType.startsWith('image/'));
      if (img) setPreviewUrl(`/api/attachments/${img.id}/preview`);
    } catch {
      // silencieux
    } finally {
      loadedRef.current = true;
      setLoading(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && modalOpen) setModalOpen(false);
    }
    if (modalOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    computeMaxSize();
    function onResize() { computeMaxSize(); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <span className="relative inline-block ml-2">
      <button
        className="text-xs text-muted-foreground hover:text-foreground"
        title="Aperçu image"
        onClick={(e) => { e.stopPropagation(); computeMaxSize(); setModalOpen(true); setLoading(true); Promise.resolve().then(ensureLoaded); }}
        aria-label="Aperçu image"
        aria-busy={loading}
      >
        🔍
      </button>
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setModalOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 p-3" onClick={(e) => e.stopPropagation()}>
            <div className="bg-card border rounded-md p-2 shadow-lg max-w-[90vw] max-h-[90vh] flex items-center justify-center relative">
              {loading && <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Spinner /><span>Chargement…</span></div>}
              {!loading && previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Aperçu"
                  style={{ maxWidth: `${maxSize.maxWidth}px`, maxHeight: `${maxSize.maxHeight}px`, width: 'auto', height: 'auto' }}
                  className="object-contain"
                />
              )}
              {!loading && !previewUrl && (
                <div className="p-4 text-sm text-muted-foreground">Aucun aperçu disponible</div>
              )}
              <button
                aria-label="Fermer"
                className="absolute focus:outline-none focus:ring-2 focus:ring-ring rounded-full inline-flex items-center justify-center"
                style={{ top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', width: 28, height: 28 }}
                onClick={() => setModalOpen(false)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                  <path d="M18.3 5.71a1 1 0 00-1.41 0L12 10.59 7.11 5.7A1 1 0 105.7 7.11L10.59 12l-4.9 4.89a1 1 0 101.41 1.42L12 13.41l4.89 4.9a1 1 0 001.42-1.41L13.41 12l4.9-4.89a1 1 0 000-1.4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
