import { prisma } from "../prisma";
import { mapToRubriques, RubriqueAggregate } from "./mapToRubriques";
import type { Prisma } from "@prisma/client";

export interface C2033CParams {
  userId: string;
  from?: string | null;
  to?: string | null;
  q?: string | null;
  account_code?: string | null;
}
export interface C2033CTotals {
  produits: number;
  charges: number;
  amortissements: number;
  resultat: number;
}
export interface C2033CResult {
  rubriques: RubriqueAggregate[];
  totals: C2033CTotals;
  truncated: boolean;
  count_entries: number;
}

const MAX_ENTRIES = 20000; // seuil de sécurité

function safeParse(n: unknown): number {
  if (typeof n === "number") return Number.isFinite(n) ? n : 0;
  if (typeof n === "string") {
    const v = parseFloat(n);
    return isNaN(v) ? 0 : v;
  }
  if (n && typeof n === "object" && "toString" in n) {
    const v = parseFloat((n as { toString(): string }).toString());
    return isNaN(v) ? 0 : v;
  }
  return 0;
}

type JEWhere = Prisma.JournalEntryWhereInput;
function buildWhere(p: C2033CParams): JEWhere {
  const where: JEWhere = { user_id: p.userId };
  if (p.from || p.to) where.date = {};
  if (p.from) (where.date as Prisma.DateTimeFilter).gte = new Date(p.from);
  if (p.to) (where.date as Prisma.DateTimeFilter).lte = new Date(p.to);
  const ors: JEWhere[] = [];
  if (p.q) {
    ors.push({ designation: { contains: p.q, mode: "insensitive" } });
    ors.push({ tier: { contains: p.q, mode: "insensitive" } });
    ors.push({ account_code: { contains: p.q, mode: "insensitive" } });
  }
  if (p.account_code)
    where.account_code = { contains: p.account_code, mode: "insensitive" };
  if (ors.length) where.OR = ors;
  return where;
}

function computeTotals(rubriques: RubriqueAggregate[]): C2033CTotals {
  const find = (code: string) => rubriques.find((r) => r.rubrique === code);
  const ca = find("CA");
  const rabais = find("CA_Moins");
  const dotations = find("DotationsAmortissements");
  const produitsCA =
    (ca ? ca.total_credit - ca.total_debit : 0) -
    (rabais ? rabais.total_debit - rabais.total_credit : 0);
  let charges = 0;
  for (const r of rubriques) {
    if (["CA", "CA_Moins", "DotationsAmortissements"].includes(r.rubrique))
      continue;
    // charges deviennent débit - crédit (positif attendu)
    charges += r.total_debit - r.total_credit;
  }
  const amortissements = dotations
    ? dotations.total_debit - dotations.total_credit
    : 0;
  const resultat = produitsCA - charges - amortissements;
  return {
    produits: round2(produitsCA),
    charges: round2(charges),
    amortissements: round2(amortissements),
    resultat: round2(resultat),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function compute2033C(
  params: C2033CParams,
): Promise<C2033CResult> {
  const where = buildWhere(params);
  const entries = await prisma.journalEntry.findMany({
    where,
    orderBy: { date: "asc" },
  });
  // Exclure les ventes marquées comme caution du calcul des produits
  const filtered = entries.filter(
    (e) => !(e.type === "vente" && e.isDeposit === true),
  );
  let truncated = false;
  let slice = filtered;
  if (filtered.length > MAX_ENTRIES) {
    truncated = true;
    slice = filtered.slice(0, MAX_ENTRIES);
  }
  const mapped = mapToRubriques(
    slice.map((e) => ({
      type: e.type,
      account_code: e.account_code,
      amount: safeParse(e.amount),
      date: e.date,
    })),
    {
      from: params.from ? new Date(params.from) : undefined,
      to: params.to ? new Date(params.to) : undefined,
    },
  );
  const totals = computeTotals(mapped.rubriques);
  return {
    rubriques: mapped.rubriques,
    totals,
    truncated,
    count_entries: entries.length,
  };
}

export { computeTotals };
