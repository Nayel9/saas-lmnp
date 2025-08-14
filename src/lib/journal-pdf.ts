import { PDFDocument, StandardFonts } from 'pdf-lib';
import {computeVisibleTotals} from './journal-totals';

export interface JournalPdfRow {
  date: Date;
  designation: string;
  tier?: string | null;
  account_code: string;
  amount: number | string;
}

export interface JournalPdfOptions {
  title: string;
  rows: JournalPdfRow[];
  period: { from?: string | null; to?: string | null };
  filters?: { tier?: string | null; account_code?: string | null; q?: string | null };
  truncateAt?: number;
  tierLabel?: string; // nouveau libellé pour la colonne tiers/client
}

const A4_WIDTH = 595.28; // points
const A4_HEIGHT = 841.89;
const LEFT = 40;
const TOP = 40;
const BOTTOM = 40;
const LINE_HEIGHT = 14; // points

function asciiSafe(s: string): string { return s.replace(/\u2192/g, '->'); }
function truncate(s: string, max: number) { return s.length > max ? s.slice(0, max - 1) + '…' : s; }

interface Columns { date: number; des: number; tier: number; acc: number; amt: number; }
export async function generateJournalPdf(opts: JournalPdfOptions): Promise<Uint8Array> {
  const { title, rows, period, filters = {}, truncateAt = 5000, tierLabel = 'Tiers' } = opts;
  const totals = computeVisibleTotals(rows.map(r => ({ amount: typeof r.amount === 'string' ? parseFloat(r.amount) : r.amount })));
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const colX: Columns = { date: LEFT, des: LEFT + 60, tier: LEFT + 230, acc: LEFT + 330, amt: LEFT + 400 };

  let page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
  page.setFont(font);
  let y = A4_HEIGHT - TOP;

  const drawText = (text: string, x: number, yPos: number, size = 10) => {
    page.drawText(asciiSafe(text), { x, y: yPos - size, size, font });
  };

  const writeHeader = () => {
    y = A4_HEIGHT - TOP;
    drawText(title, LEFT, y, 16); y -= LINE_HEIGHT * 1.5;
    drawText(`Période: ${period.from || '—'} -> ${period.to || '—'}`, LEFT, y, 9); y -= LINE_HEIGHT;
    const fParts: string[] = [];
    if (filters.tier) fParts.push(`tier=${filters.tier}`);
    if (filters.account_code) fParts.push(`compte=${filters.account_code}`);
    if (filters.q) fParts.push(`q=${filters.q}`);
    if (fParts.length) { drawText('Filtres: ' + fParts.join(', '), LEFT, y, 9); y -= LINE_HEIGHT; }
    // Column headers
    const headerY = y; y -= LINE_HEIGHT;
    drawText('Date', colX.date, headerY, 10);
    drawText('Désignation', colX.des, headerY, 10);
    drawText(tierLabel, colX.tier, headerY, 10);
    drawText('Compte', colX.acc, headerY, 10);
    drawText('Montant', colX.amt, headerY, 10);
  };

  writeHeader();
  const maxY = BOTTOM + 60; // reserve space for totals
  let lineCount = 0;

  for (const r of rows) {
    if (lineCount >= truncateAt) { drawText('… (troncation)', LEFT, y, 9); break; }
    if (y <= maxY) {
      page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      page.setFont(font);
      writeHeader();
    }
    const amountNum = typeof r.amount === 'number' ? r.amount : parseFloat(r.amount);
    drawText(r.date.toISOString().slice(0,10), colX.date, y, 9);
    drawText(truncate(r.designation, 28), colX.des, y, 9);
    drawText(truncate(r.tier || '', 15), colX.tier, y, 9);
    drawText(r.account_code, colX.acc, y, 9);
    drawText(amountNum.toFixed(2), colX.amt, y, 9);
    y -= LINE_HEIGHT;
    lineCount++;
  }

  if (y <= BOTTOM + LINE_HEIGHT * 2) {
    page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    page.setFont(font);
    writeHeader();
    y -= LINE_HEIGHT; // space after header
  }

  y -= LINE_HEIGHT;
  drawText(`Total lignes: ${totals.count}  Total montant: ${totals.sum.toFixed(2)}` , LEFT, y, 10);

  return await pdfDoc.save();
}
