// Service de compte de résultat simple
export type JEType = "achat" | "vente";
export interface EntryLike {
  type: JEType;
  amount: number | string;
  isDeposit?: boolean | null;
  account_code: string;
  date: Date | string;
}
export interface IncomeStatementTotals {
  revenus: number;
  depenses: number;
  amortissements: number;
  resultat: number;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function toNum(n: number | string) {
  if (typeof n === "number") return n;
  const v = parseFloat(n);
  return isNaN(v) ? 0 : v;
}
function isYear(d: Date, year: number) {
  return d.getUTCFullYear() === year || d.getFullYear() === year;
}

export function computeIncomeStatementFromEntries(
  entries: EntryLike[],
  year: number,
): IncomeStatementTotals {
  let revenus = 0,
    depensesHorsAmort = 0,
    amort = 0;
  for (const e of entries) {
    const d = new Date(e.date);
    if (!isYear(d, year)) continue;
    const amt = toNum(e.amount);
    if (!amt) continue;
    if (e.type === "vente") {
      if (e.isDeposit) continue; // exclure cautions
      revenus += amt;
    } else if (e.type === "achat") {
      const isAmort = e.account_code?.startsWith("6811");
      if (isAmort) amort += amt;
      else depensesHorsAmort += amt;
    }
  }
  revenus = round2(revenus);
  depensesHorsAmort = round2(depensesHorsAmort);
  amort = round2(amort);
  const resultat = round2(revenus - depensesHorsAmort - amort);
  return {
    revenus,
    depenses: depensesHorsAmort,
    amortissements: amort,
    resultat,
  };
}
