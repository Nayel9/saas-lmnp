// Utils pour exports Synthèse (PDF/CSV)
import type { IncomeStatementTotals } from "@/lib/accounting/income-statement";

export interface BalanceExportShape {
  actif: { vnc: number; treso: number };
  passif: { cautions: number; dettes: number };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function toCsvIncome(t: IncomeStatementTotals): string {
  const rows = [
    ["label", "amount"],
    ["revenues", String(t.revenus ?? 0)],
    ["expenses", String(t.depenses ?? 0)],
    ["depreciation", String(t.amortissements ?? 0)],
    ["result", String(t.resultat ?? 0)],
  ];
  return rows.map((r) => r.join(",")).join("\n") + "\n";
}

export function toCsvBalance(b: BalanceExportShape): string {
  const { actif, passif } = b;
  const rows = [
    ["section", "label", "amount"],
    ["ASSET", "vnc_total", String(actif?.vnc ?? 0)],
    ["ASSET", "cash_mvp", String(actif?.treso ?? 0)],
    ["LIABILITY", "deposits_held", String(passif?.cautions ?? 0)],
    ["LIABILITY", "payables_placeholder", "0"],
  ];
  return rows.map((r) => r.join(",")).join("\n") + "\n";
}

export function formatEUR(n: number): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(n ?? 0);
  } catch {
    return round2(n ?? 0).toFixed(2) + " €";
  }
}

export interface PdfTextModel {
  header: { title: string; subtitle: string; edition: string };
  lines: string[];
}

export function buildPdfTextModel(opts: {
  propertyLabel: string;
  year: number;
  income: IncomeStatementTotals;
  balance: BalanceExportShape & { totals?: { actif: number; passif: number } };
}): PdfTextModel {
  const { propertyLabel, year, income, balance } = opts;
  const header = {
    title: `Synthèse ${propertyLabel}`,
    subtitle: `Année ${year}`,
    edition: `Édité le ${new Date().toLocaleDateString("fr-FR")}`,
  };
  const L: string[] = [];
  L.push("Compte de résultat (simple)");
  L.push(`- Revenus: ${formatEUR(income.revenus)}`);
  L.push(`- Dépenses: ${formatEUR(income.depenses)}`);
  L.push(`- Amortissements: ${formatEUR(income.amortissements)}`);
  L.push(`= Résultat: ${formatEUR(income.resultat)}`);
  L.push("");
  L.push("Bilan (simple)");
  L.push("Actif:");
  L.push(
    `- Immobilisations (valeur restante): ${formatEUR(balance.actif.vnc)}`,
  );
  L.push(`- Trésorerie (année): ${formatEUR(balance.actif.treso)}`);
  if (balance.totals)
    L.push(`= Total Actif: ${formatEUR(balance.totals.actif)}`);
  L.push("Passif:");
  L.push(`- Cautions détenues: ${formatEUR(balance.passif.cautions)}`);
  L.push(`- Autres dettes: ${formatEUR(balance.passif.dettes)}`);
  if (balance.totals)
    L.push(`= Total Passif: ${formatEUR(balance.totals.passif)}`);
  return { header, lines: L };
}
