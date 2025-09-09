import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";
import { computeIncomeStatementFromEntries } from "@/lib/accounting/income-statement";
import { computeSimpleBalance } from "@/lib/accounting/simple-balance";
import { buildPdfTextModel, formatEUR } from "@/lib/synthesis/export";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = z.string().uuid();
const YEAR = z.coerce.number().int().min(2000).max(2100);

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response("Non authentifié", { status: 401 });

  const { searchParams } = new URL(req.url);
  const p =
    searchParams.get("property") || searchParams.get("propertyId") || undefined;
  const y = searchParams.get("year") ?? undefined;

  if (!p) return new Response("BAD_REQUEST: property requis", { status: 400 });
  const idParse = UUID.safeParse(p);
  if (!idParse.success)
    return new Response("BAD_REQUEST: property invalide", { status: 400 });
  const yearParse = YEAR.safeParse(y ?? String(new Date().getFullYear()));
  if (!yearParse.success)
    return new Response("BAD_REQUEST: year invalide", { status: 400 });
  const propertyId = idParse.data;
  const year = yearParse.data;

  // Propriété et contrôle multi-tenant
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });
  if (!property || property.user_id !== user.id)
    return new Response("FORBIDDEN: propriété inconnue", { status: 403 });

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const entries = await prisma.journalEntry.findMany({
    where: { user_id: user.id, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
  const assets = await prisma.asset.findMany({
    where: { user_id: user.id, acquisition_date: { lte: end } },
    orderBy: { acquisition_date: "asc" },
  });

  // Agrégations réutilisant la logique existante
  const entriesIncome = entries.map((e) => ({
    type: e.type as "achat" | "vente",
    amount: Number(e.amount),
    isDeposit: e.isDeposit ?? undefined,
    account_code: (e as { account_code?: string }).account_code ?? "",
    date: new Date(e.date),
  }));
  const income = computeIncomeStatementFromEntries(entriesIncome, year);
  const assetsSimple = assets.map((a) => ({
    amount_ht: Number(a.amount_ht),
    duration_years: a.duration_years,
    acquisition_date: new Date(a.acquisition_date),
  }));
  const entriesSimple = entries.map((e) => ({
    type: e.type,
    amount: Number(e.amount),
    date: new Date(e.date),
    isDeposit: e.isDeposit,
  })) as {
    type: "achat" | "vente";
    amount: number;
    date: Date;
    isDeposit?: boolean;
  }[];
  const balance = computeSimpleBalance({
    assets: assetsSimple,
    entries: entriesSimple,
    year,
  });

  // Construire un PDF simple (A4 portrait) avec pdf-lib
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 en points
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  let yCursor = page.getSize().height - margin;

  function drawText(
    text: string,
    size = 12,
    bold = false,
    color = rgb(0, 0, 0),
  ) {
    const f = bold ? fontBold : font;
    const safe = text.replace(/[\u202F\u00A0]/g, " ");
    page.drawText(safe, { x: margin, y: yCursor, size, font: f, color });
    yCursor -= size + 8;
  }

  const header = buildPdfTextModel({
    propertyLabel: (property as { label?: string }).label ?? propertyId,
    year,
    income,
    balance: {
      actif: { vnc: balance.actif.vnc, treso: balance.actif.treso },
      passif: {
        cautions: balance.passif.cautions,
        dettes: balance.passif.dettes,
      },
      totals: { actif: balance.actif.total, passif: balance.passif.total },
    },
  });

  drawText(header.header.title, 16, true);
  drawText(header.header.subtitle, 12);
  drawText(header.header.edition, 10, false, rgb(0.3, 0.3, 0.3));
  yCursor -= 10;

  drawText("Compte de résultat (simple)", 14, true);
  drawText(`Revenus: ${formatEUR(income.revenus)}`);
  drawText(`Dépenses: ${formatEUR(income.depenses)}`);
  drawText(`Amortissements: ${formatEUR(income.amortissements)}`);
  drawText(`Résultat: ${formatEUR(income.resultat)}`, 12, true);
  yCursor -= 12;

  drawText("Bilan (simple)", 14, true);
  drawText("Actif", 12, true);
  drawText(
    `Immobilisations (valeur restante): ${formatEUR(balance.actif.vnc)}`,
  );
  drawText(`Trésorerie (année): ${formatEUR(balance.actif.treso)}`);
  drawText(`Total Actif: ${formatEUR(balance.actif.total)}`, 12, true);
  yCursor -= 6;
  drawText("Passif", 12, true);
  drawText(`Cautions détenues: ${formatEUR(balance.passif.cautions)}`);
  drawText(`Dettes: ${formatEUR(balance.passif.dettes)}`);
  drawText(`Total Passif: ${formatEUR(balance.passif.total)}`, 12, true);

  const pdfBytes = await doc.save();
  const filename = `synthese_${propertyId}_${year}.pdf`;
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
