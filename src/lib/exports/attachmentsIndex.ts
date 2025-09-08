export type JournalType = 'vente' | 'achat';

export interface IndexRow {
  type: JournalType; // 'vente' | 'achat'
  date: string; // YYYY-MM-DD
  entryId: string;
  montant: number; // nombre avec .
  counterparty?: string | null; // locataire/fournisseur si dispo
  category?: string | null; // pour achats si dispo
  fileName: string;
  storageKey: string;
}

export function typeLabelFr(t: JournalType): 'VENTE' | 'ACHAT' {
  return t === 'vente' ? 'VENTE' : 'ACHAT';
}

export function monthSegment(dateISO: string): string {
  // suppose un format YYYY-MM-DD
  return dateISO.slice(0, 7); // YYYY-MM
}

export function buildZipPath(params: { type: JournalType; dateISO: string; entryId: string; fileName: string }): string {
  const dir = typeLabelFr(params.type) + 'S'; // VENTES | ACHATS
  const month = monthSegment(params.dateISO);
  const safeFile = sanitizeName(params.fileName);
  return `${dir}/${month}/entry_${params.entryId}/${safeFile}`;
}

export function buildIndexCsv(rows: IndexRow[]): string {
  // en-tête
  const header = 'type;date;entryId;montant;counterparty;category;fileName;storageKey\n';
  const body = rows.map(r => [
    typeLabelFr(r.type),
    r.date,
    r.entryId,
    safeNumber(r.montant),
    sanitizeField(r.counterparty ?? ''),
    sanitizeField(r.category ?? ''),
    sanitizeName(r.fileName),
    r.storageKey,
  ].join(';')).join('\n');
  return header + body + (rows.length ? '\n' : '');
}

export function buildIndexRows(entries: Array<{ id: string; type: JournalType; date: Date; amount: unknown; tier?: string | null; account_code: string }>, attachments: Array<{ entryId: string | null; fileName: string; storageKey: string }>): IndexRow[] {
  const map = new Map(entries.map(e => [e.id, e] as const));
  const rows: IndexRow[] = [];
  for (const att of attachments) {
    if (!att.entryId) continue;
    const e = map.get(att.entryId);
    if (!e) continue;
    const dateISO = e.date.toISOString().slice(0, 10);
    rows.push({
      type: e.type,
      date: dateISO,
      entryId: e.id,
      montant: safeToNumber(e.amount),
      counterparty: e.tier || null,
      category: e.type === 'achat' ? (e.account_code || null) : null,
      fileName: att.fileName,
      storageKey: att.storageKey,
    });
  }
  return rows;
}

function sanitizeField(s: string): string {
  // éviter d'introduire des ';' ou des sauts de ligne qui casseraient le CSV
  return String(s).replace(/[\n\r;]+/g, ' ').trim();
}

function sanitizeName(s: string): string {
  // garder le nom lisible mais éviter des chemins piégeux
  return s.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function safeNumber(n: unknown): string {
  if (typeof n === 'number') return Number.isFinite(n) ? n.toString() : '0';
  if (typeof n === 'string') { const v = parseFloat(n); return isNaN(v) ? '0' : v.toString(); }
  if (n && typeof n === 'object' && 'toString' in n) {
    const v = parseFloat((n as { toString(): string }).toString());
    return isNaN(v) ? '0' : v.toString();
  }
  return '0';
}

function safeToNumber(n: unknown): number {
  if (typeof n === 'number') return Number.isFinite(n) ? n : 0;
  if (typeof n === 'string') { const v = parseFloat(n); return isNaN(v) ? 0 : v; }
  if (n && typeof n === 'object' && 'toString' in n) { const v = parseFloat((n as { toString(): string }).toString()); return isNaN(v) ? 0 : v; }
  return 0;
}
