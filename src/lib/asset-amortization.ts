export interface AmortizationYear {
  year: number;
  dotation: number; // dotation de l'année
  cumul: number; // amortissement cumulé après cette année
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

/**
 * Calcule un tableau d'amortissement linéaire avec prorata temporis (mois) la 1ère année.
 * - annual = amount / durationYears
 * - 1ère année: annual * (nbMoisRestants / 12)
 * - années intermédiaires: annual
 * - dernière année: ajustement pour atteindre exactement le montant (correction des arrondis)
 */
export function computeLinearAmortization(amount: number, durationYears: number, acquisitionDate: Date): AmortizationYear[] {
  if (amount <= 0) throw new Error('Montant doit être > 0');
  if (!Number.isInteger(durationYears) || durationYears <= 0) throw new Error('Durée invalide');
  const schedule: AmortizationYear[] = [];
  const annual = amount / durationYears;
  const monthsFirst = 12 - acquisitionDate.getMonth();
  const startYear = acquisitionDate.getFullYear();
  let sum = 0;
  for (let i = 0; i < durationYears; i++) {
    const year = startYear + i;
    let raw: number;
    if (i === 0) raw = annual * (monthsFirst / 12);
    else if (i === durationYears - 1) raw = amount - sum;
    else raw = annual;
    let dot = round2(raw);
    if (i === durationYears - 1) {
      const remaining = round2(amount - sum);
      dot = remaining < 0 ? 0 : remaining;
    }
    sum = round2(sum + dot);
    schedule.push({ year, dotation: dot, cumul: sum });
  }
  const diff = round2(amount - schedule[schedule.length - 1].cumul);
  if (Math.abs(diff) >= 0.01) {
    schedule[schedule.length - 1].dotation = round2(schedule[schedule.length - 1].dotation + diff);
    const prev = schedule[schedule.length - 2]?.cumul || 0;
    schedule[schedule.length - 1].cumul = round2(prev + schedule[schedule.length - 1].dotation);
  }
  return schedule;
}

export function amortizationToCsv(rows: AmortizationYear[]): string {
  const header = 'annee;dotation;cumul\n';
  const body = rows.map(r => `${r.year};${r.dotation.toFixed(2)};${r.cumul.toFixed(2)}`).join('\n');
  return header + body + (body ? '\n' : '');
}
