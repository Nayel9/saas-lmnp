import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/core";
import { prisma } from "@/lib/prisma";
import archiver from "archiver";
import { computeIncomeStatementFromEntries } from "@/lib/accounting/income-statement";
import { computeSimpleBalance } from "@/lib/accounting/simple-balance";
import { toCsvIncome, toCsvBalance } from "@/lib/synthesis/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = z.string().uuid();
const YEAR = z.coerce.number().int().min(2000).max(2100);
const SCOPE = z.enum(["user", "property"]).default("user");

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user;
  if (!user) return new Response("Non authentifié", { status: 401 });

  const { searchParams } = new URL(req.url);
  const p =
    searchParams.get("property") || searchParams.get("propertyId") || undefined;
  const y = searchParams.get("year") ?? undefined;
  const s = searchParams.get("scope") ?? undefined;

  if (!p) return new Response("BAD_REQUEST: property requis", { status: 400 });
  const idParse = UUID.safeParse(p);
  if (!idParse.success)
    return new Response("BAD_REQUEST: property invalide", { status: 400 });
  const yearParse = YEAR.safeParse(y ?? String(new Date().getFullYear()));
  if (!yearParse.success)
    return new Response("BAD_REQUEST: year invalide", { status: 400 });
  const propertyId = idParse.data;
  const year = yearParse.data;
  const scope = SCOPE.parse(s ?? "user");

  // Propriété et contrôle multi-tenant
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });
  if (!property || property.user_id !== user.id)
    return new Response("FORBIDDEN: propriété inconnue", { status: 403 });

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const entries = await prisma.journalEntry.findMany({
    where:
      scope === "property"
        ? { user_id: user.id, propertyId, date: { gte: start, lte: end } }
        : { user_id: user.id, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
  });
  const assets = await prisma.asset.findMany({
    where:
      scope === "property"
        ? { user_id: user.id, propertyId, acquisition_date: { lte: end } }
        : { user_id: user.id, acquisition_date: { lte: end } },
    orderBy: { acquisition_date: "asc" },
  });

  // Agrégations
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

  const incomeCsv = toCsvIncome(income);
  const balanceCsv = toCsvBalance({
    actif: { vnc: balance.actif.vnc, treso: balance.actif.treso },
    passif: {
      cautions: balance.passif.cautions,
      dettes: balance.passif.dettes,
    },
  });

  // Génération ZIP: collecte directe sur le flux archiver
  const archive = archiver("zip", { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on("data", (chunk) => {
    chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array),
    );
  });
  const done = new Promise<void>((resolve, reject) => {
    archive.on("close", () => resolve());
    archive.on("warning", () => {});
    archive.on("error", (err) => reject(err));
  });
  archive.append(incomeCsv, { name: "income_statement.csv" });
  archive.append(balanceCsv, { name: "balance_sheet.csv" });
  void archive.finalize();
  await done;

  const zipBuffer = Buffer.concat(chunks);

  const filename = `synthese_${propertyId}_${year}.zip`;
  const uint = new Uint8Array(zipBuffer);
  const blob = new Blob([uint], { type: "application/zip" });
  return new Response(blob, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
