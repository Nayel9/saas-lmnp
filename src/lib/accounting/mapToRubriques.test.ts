import { describe, it, expect } from 'vitest';
import { mapToRubriques, computeResultatCourant, JournalLikeEntry } from './mapToRubriques';

function entry(partial: Partial<JournalLikeEntry>): JournalLikeEntry {
  return {
    type: 'achat',
    account_code: '000',
    amount: 0,
    date: '2025-01-01',
    ...partial
  };
}

describe('mapToRubriques', () => {
  it('agrège ventes 706 en crédit CA et rabais 709 en débit CA_Moins', () => {
    const { rubriques } = mapToRubriques([
      entry({ type: 'vente', account_code: '706', amount: 100 }),
      entry({ type: 'vente', account_code: '7061', amount: 50 }), // même rubrique via prefix
      entry({ type: 'achat', account_code: '709', amount: 10 }), // rabais => débit CA_Moins
    ]);
    const ca = rubriques.find(r=> r.rubrique==='CA');
    const rabais = rubriques.find(r=> r.rubrique==='CA_Moins');
    expect(ca?.total_credit).toBe(150); // 100 + 50
    expect(ca?.total_debit).toBe(0);
    expect(rabais?.total_debit).toBe(10);
  });

  it('priorité au préfixe le plus long (615 ne doit pas matcher règle générique 62)', () => {
    const { rubriques } = mapToRubriques([
      entry({ type: 'achat', account_code: '615', amount: 40 }),
      entry({ type: 'achat', account_code: '620', amount: 20 }), // tombera dans ServicesExterieurs (62)
    ]);
    const chargesExt = rubriques.find(r=> r.rubrique==='ChargesExternes');
    const services = rubriques.find(r=> r.rubrique==='ServicesExterieurs');
    expect(chargesExt?.total_debit).toBe(40);
    expect(services?.total_debit).toBe(20);
  });

  it('gère plusieurs rubriques de charges (606, 615, 616, 635) + dotations 6811', () => {
    const { rubriques, amortizations } = mapToRubriques([
      entry({ type: 'achat', account_code: '606', amount: 30 }),
      entry({ type: 'achat', account_code: '615', amount: 15.555 }),
      entry({ type: 'achat', account_code: '616', amount: 8 }),
      entry({ type: 'achat', account_code: '635', amount: 12 }),
      entry({ type: 'achat', account_code: '6811', amount: 100 }),
    ]);
    const chExt = rubriques.find(r=> r.rubrique==='ChargesExternes');
    const assurances = rubriques.find(r=> r.rubrique==='Assurances');
    const impots = rubriques.find(r=> r.rubrique==='ImpotsTaxes');
    const dota = rubriques.find(r=> r.rubrique==='DotationsAmortissements');
    expect(chExt?.total_debit).toBeCloseTo(45.56, 2); // 30 + 15.555 arrondi
    expect(assurances?.total_debit).toBe(8);
    expect(impots?.total_debit).toBe(12);
    expect(dota?.total_debit).toBe(100);
    expect(amortizations.length).toBe(1);
    expect(amortizations[0].amount).toBe(100);
  });

  it('filtre période', () => {
    const { rubriques } = mapToRubriques([
      entry({ type: 'vente', account_code: '706', amount: 200, date: '2024-12-31' }),
      entry({ type: 'vente', account_code: '706', amount: 300, date: '2025-01-01' }),
    ], { from: new Date('2025-01-01'), to: new Date('2025-12-31') });
    const ca = rubriques.find(r=> r.rubrique==='CA');
    expect(ca?.total_credit).toBe(300); // exclut 2024-12-31
  });

  it('ignore montants NaN ou comptes non mappés', () => {
    const { rubriques } = mapToRubriques([
      entry({ type: 'vente', account_code: '999', amount: 500 }), // non mappé
      entry({ type: 'achat', account_code: '606', amount: 'abc' as unknown as number }), // NaN (cast volontaire)
      entry({ type: 'vente', account_code: '706', amount: 50 }),
    ]);
    expect(rubriques.find(r=> r.rubrique==='CA')?.total_credit).toBe(50);
    expect(rubriques.find(r=> r.rubrique==='ChargesExternes')).toBeUndefined();
  });
});

describe('computeResultatCourant', () => {
  it('calcule Produits - Charges avec rabais', () => {
    const { rubriques } = mapToRubriques([
      entry({ type: 'vente', account_code: '706', amount: 100 }),
      entry({ type: 'achat', account_code: '709', amount: 10 }), // rabais
      entry({ type: 'achat', account_code: '606', amount: 30 }),
      entry({ type: 'achat', account_code: '616', amount: 5 }),
    ]);
    const res = computeResultatCourant(rubriques);
    // CA net = 100 - 10 = 90 ; Charges = 30 + 5 = 35 -> Résultat = 55
    expect(res).toBe(55);
  });
});
