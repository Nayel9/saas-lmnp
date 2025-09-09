import { describe, it, expect } from 'vitest';
import { toCsvIncome, toCsvBalance, buildPdfTextModel } from './export';

describe('synthesis export utils', () => {
  it('toCsvIncome sérialise correctement en CSV', () => {
    const csv = toCsvIncome({ revenus: 1200.5, depenses: 350, amortissements: 200.25, resultat: 650.25 });
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('label,amount');
    expect(lines[1]).toBe('revenues,1200.5');
    expect(lines[2]).toBe('expenses,350');
    expect(lines[3]).toBe('depreciation,200.25');
    expect(lines[4]).toBe('result,650.25');
  });
  it('toCsvBalance sérialise correctement en CSV', () => {
    const csv = toCsvBalance({ actif: { vnc: 14800, treso: 650 }, passif: { cautions: 200, dettes: 0 } });
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('section,label,amount');
    expect(lines[1]).toBe('ASSET,vnc_total,14800');
    expect(lines[2]).toBe('ASSET,cash_mvp,650');
    expect(lines[3]).toBe('LIABILITY,deposits_held,200');
    expect(lines[4]).toBe('LIABILITY,payables_placeholder,0');
  });
  it('buildPdfTextModel contient les sections et montants formatés', () => {
    const model = buildPdfTextModel({
      propertyLabel: 'Appartement A',
      year: 2025,
      income: { revenus: 1000, depenses: 350, amortissements: 200, resultat: 450 },
      balance: { actif: { vnc: 14800, treso: 650 }, passif: { cautions: 200, dettes: 0 }, totals: { actif: 15450, passif: 200 } }
    });
    expect(model.header.title).toContain('Synthèse');
    expect(model.header.subtitle).toContain('Année 2025');
    const text = model.lines.join('\n');
    expect(text).toContain('Compte de résultat');
    expect(text).toContain('Revenus');
    expect(text).toContain('Bilan');
    expect(text).toContain('Immobilisations');
    expect(text).toContain('Cautions détenues');
  });
});

