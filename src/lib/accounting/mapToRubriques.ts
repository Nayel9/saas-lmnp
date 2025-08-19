// Moteur de mapping PCG -> Rubriques formulaires (2033C, etc.)
// Chargé dynamiquement depuis config/config-pcg.json pour éviter le hard‑code.

import mapping from '../../../config/config-pcg.json';


export interface JournalLikeEntry {
  type: 'achat' | 'vente';
  account_code: string;
  amount: number | string;
  date: Date | string;
}

export interface RubriqueRule {
  account_prefix: string; // ex: "706", "62"
  rubrique: string;       // ex: "CA", "ChargesExternes"
  form: string;           // ex: "2033C"
  label: string;          // libellé humain
}

export interface RubriqueAggregate {
  rubrique: string;
  form: string;
  label: string;
  total_debit: number;   // somme montants où type=achat
  total_credit: number;  // somme montants où type=vente
  balance: number;       // aligné sur balance.ts => debit - credit
}

export interface MappingResult {
  rubriques: RubriqueAggregate[]; // pour 2033C (et autres si on étend)
  amortizations: { date: string; amount: number; account_code: string }[]; // sous-ensemble 6811 pour 2033E
}

// Pré-tri des règles: plus long préfixe d'abord pour priorité.
const RULES: RubriqueRule[] = (mapping as RubriqueRule[]).slice().sort((a,b)=> b.account_prefix.length - a.account_prefix.length);

function round2(n: number) { return Math.round(n * 100) / 100; }

function matchRule(accountCode: string): RubriqueRule | undefined {
  return RULES.find(r => accountCode.startsWith(r.account_prefix));
}

export interface PeriodFilter { from?: Date; to?: Date; }

function inPeriod(d: Date, f?: PeriodFilter) {
  if (!f) return true;
  if (f.from && d < f.from) return false;
  if (f.to && d > f.to) return false;
  return true;
}

/**
 * Agrège les écritures par rubrique selon la config.
 * - Filtre période (inclusif) si fournie.
 * - Ignore montants NaN ou comptes non mappés.
 * - balance = total_debit - total_credit (cohérent avec balance.ts)
 * - Fournit aussi la liste des dotations (rubrique DotationsAmortissements / compte 6811*) pour 2033E.
 */
export function mapToRubriques(entries: JournalLikeEntry[], period?: PeriodFilter): MappingResult {
  const map = new Map<string, { rule: RubriqueRule; debit: number; credit: number }>();
  const amortizations: { date: string; amount: number; account_code: string }[] = [];

  for (const e of entries) {
    if (!e || !e.account_code) continue;
    const rule = matchRule(e.account_code);
    if (!rule) continue; // pas de mapping => ignoré (extensible).
    const d = new Date(e.date);
    if (!inPeriod(d, period)) continue;
    const amt = typeof e.amount === 'number' ? e.amount : parseFloat(e.amount);
    if (isNaN(amt) || amt === 0) continue;
    const rec = map.get(rule.rubrique) || { rule, debit: 0, credit: 0 };
    if (e.type === 'achat') rec.debit += amt; else rec.credit += amt;
    map.set(rule.rubrique, rec);
    if (rule.rubrique === 'DotationsAmortissements') {
      amortizations.push({ date: d.toISOString().slice(0,10), amount: round2(amt), account_code: e.account_code });
    }
  }

  const rubriques: RubriqueAggregate[] = Array.from(map.values()).map(({ rule, debit, credit }) => ({
    rubrique: rule.rubrique,
    form: rule.form,
    label: rule.label,
    total_debit: round2(debit),
    total_credit: round2(credit),
    balance: round2(debit - credit)
  })).sort((a,b)=> a.rubrique.localeCompare(b.rubrique));

  return { rubriques, amortizations };
}

// Helper pour calculer un résultat courant (Produits - Charges) basique selon rubriques actuelles.
// Hypothèses: Rubriques Produits = CA (et potentiellement d'autres plus tard). Charges = tout le reste sauf CA & CA_Moins.
export function computeResultatCourant(rubriques: RubriqueAggregate[]): number {
  let produits = 0; let charges = 0; let caMoins = 0;
  for (const r of rubriques) {
    if (r.rubrique === 'CA') produits += r.total_credit - r.total_debit; // ventes nettes
    else if (r.rubrique === 'CA_Moins') caMoins += r.total_debit - r.total_credit; // rabais (débits)
    else { charges += r.total_debit - r.total_credit; }
  }
  const netProduits = produits - caMoins; // CA net
  return round2(netProduits - charges);
}
