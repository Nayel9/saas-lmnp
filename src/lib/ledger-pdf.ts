import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { LedgerLine } from './ledger';

interface LedgerLineWithTier extends LedgerLine { tier?: string }

export interface LedgerPdfOptions {
  title?: string;
  account_code: string;
  rows: LedgerLineWithTier[];
  period: { from?: string | null; to?: string | null };
  filters?: { q?: string | null };
  truncateAt?: number;
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const LEFT = 36;
const TOP = 40;
const LINE_H = 14;
const BOTTOM = 40;

function asciiSafe(s: string): string { return s.replace(/\u2192/g, '->'); }
function truncate(s: string, max: number) { return s.length > max ? s.slice(0, max - 1) + '…' : s; }

export async function generateLedgerPdf(opts: LedgerPdfOptions): Promise<Uint8Array> {
  const { title = 'Grand livre', account_code, rows, period, filters = {}, truncateAt = 5000 } = opts;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
  page.setFont(font);
  let y = A4_HEIGHT - TOP;

  const col = { date: LEFT, tier: LEFT + 70, label: LEFT + 170, debit: LEFT + 360, credit: LEFT + 430, bal: LEFT + 500 };
  const draw = (t: string, x: number, yy: number, size = 9) => page.drawText(asciiSafe(t), { x, y: yy - size, size, font });
  const header = () => {
    y = A4_HEIGHT - TOP;
    draw(`${title} – Compte ${account_code}`, LEFT, y, 14); y -= LINE_H * 1.4;
    draw(`Période: ${period.from || '—'} -> ${period.to || '—'}`, LEFT, y, 9); y -= LINE_H;
    const f: string[] = [];
    if (filters.q) f.push(`q=${filters.q}`);
    if (f.length) { draw('Filtres: ' + f.join(', '), LEFT, y, 9); y -= LINE_H; }
    const hy = y; y -= LINE_H;
    draw('Date', col.date, hy, 10);
    draw('Tier', col.tier, hy, 10);
    draw('Désignation', col.label, hy, 10);
    draw('Débit', col.debit, hy, 10);
    draw('Crédit', col.credit, hy, 10);
    draw('Solde', col.bal, hy, 10);
  };

  header();
  const minY = BOTTOM + 50;
  let count = 0;
  for (const r of rows) {
    if (count >= truncateAt) { draw('… (troncation)', LEFT, y, 9); break; }
    if (y <= minY) { page = pdf.addPage([A4_WIDTH, A4_HEIGHT]); page.setFont(font); header(); }
    draw(r.date.slice(0,10), col.date, y, 9);
    draw(truncate(r.tier || '', 14), col.tier, y, 9);
    draw(truncate(r.designation, 28), col.label, y, 9);
    draw(r.debit ? r.debit.toFixed(2) : '', col.debit, y, 9);
    draw(r.credit ? r.credit.toFixed(2) : '', col.credit, y, 9);
    draw(r.balance.toFixed(2), col.bal, y, 9);
    y -= LINE_H;
    count++;
  }
  return await pdf.save();
}
