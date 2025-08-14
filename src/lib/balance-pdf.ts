import { PDFDocument, StandardFonts } from 'pdf-lib';

export interface BalancePdfRow {
  account_code: string;
  total_debit: number;
  total_credit: number;
  balance: number; // debit - credit
}

export interface BalancePdfOptions {
  title?: string;
  rows: BalancePdfRow[];
  period: { from?: string | null; to?: string | null };
  filters?: { account_code?: string | null; q?: string | null };
  truncateAt?: number; // max lignes
}

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const LEFT = 40;
const TOP = 40;
const BOTTOM = 40;
const LINE_HEIGHT = 14;

function asciiSafe(s: string): string { return s.replace(/\u2192/g, '->'); }
function truncate(s: string, max: number) { return s.length > max ? s.slice(0, max - 1) + '…' : s; }

export async function generateBalancePdf(opts: BalancePdfOptions): Promise<Uint8Array> {
  const { title = 'Balance des comptes', rows, period, filters = {}, truncateAt = 5000 } = opts;
  const totalDebit = rows.reduce((a, r) => a + r.total_debit, 0);
  const totalCredit = rows.reduce((a, r) => a + r.total_credit, 0);
  const totalBalance = totalDebit - totalCredit;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const colX = { acc: LEFT, debit: LEFT + 160, credit: LEFT + 280, bal: LEFT + 400 };

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
    if (filters.account_code) fParts.push(`compte~${filters.account_code}`);
    if (filters.q) fParts.push(`q=${filters.q}`);
    if (fParts.length) { drawText('Filtres: ' + fParts.join(', '), LEFT, y, 9); y -= LINE_HEIGHT; }
    // colonnes
    const headerY = y; y -= LINE_HEIGHT;
    drawText('Compte', colX.acc, headerY, 10);
    drawText('Total Débit', colX.debit, headerY, 10);
    drawText('Total Crédit', colX.credit, headerY, 10);
    drawText('Solde', colX.bal, headerY, 10);
  };

  writeHeader();
  const maxY = BOTTOM + 60; // réserve pied
  let lineCount = 0;
  for (const r of rows) {
    if (lineCount >= truncateAt) { drawText('… (troncation)', LEFT, y, 9); break; }
    if (y <= maxY) {
      page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
      page.setFont(font);
      writeHeader();
    }
    drawText(truncate(r.account_code, 30), colX.acc, y, 9);
    drawText(r.total_debit.toFixed(2), colX.debit, y, 9);
    drawText(r.total_credit.toFixed(2), colX.credit, y, 9);
    drawText(r.balance.toFixed(2), colX.bal, y, 9);
    y -= LINE_HEIGHT;
    lineCount++;
  }

  if (y <= BOTTOM + LINE_HEIGHT * 2) {
    page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    page.setFont(font);
    writeHeader();
    y -= LINE_HEIGHT;
  }
  y -= LINE_HEIGHT;
  drawText(`Totaux généraux  Débit: ${totalDebit.toFixed(2)}  Crédit: ${totalCredit.toFixed(2)}  Solde: ${(totalBalance).toFixed(2)}` , LEFT, y, 10);

  return await pdfDoc.save();
}

