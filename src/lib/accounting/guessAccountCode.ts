export interface GuessInput { type: 'vente' | 'achat'; isDeposit: boolean; designation: string; }
export interface HeuristicResult { code: string; reason: string }

// Heuristique utilisée par le backfill
export function guessAccountCode({ type, isDeposit, designation }: GuessInput): HeuristicResult {
  const d = (designation || '').toLowerCase();
  if (type === 'vente') {
    if (isDeposit) return { code: '165', reason: 'caution vente' };
    return { code: '7061', reason: 'default vente' };
  }
  if (d.includes('assur')) return { code: '616', reason: 'mot-clé assur' };
  if (d.includes('banq') || d.includes('stripe')) return { code: '627', reason: 'mot-clé banque/stripe' };
  if (d.includes('entretien') || d.includes('reparation') || d.includes('réparation')) return { code: '615', reason: 'mot-clé entretien' };
  if (d.includes('fournit') || d.includes('équip') || d.includes('equip')) return { code: '6063', reason: 'mot-clé fournit/equip' };
  if (d.includes('taxe foncière') || d.includes('taxe fonciere')) return { code: '63512', reason: 'mot-clé taxe foncière' };
  return { code: '606', reason: 'default achat' };
}

