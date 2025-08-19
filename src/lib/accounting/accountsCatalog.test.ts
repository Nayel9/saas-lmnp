import { describe, it, expect } from 'vitest';
import { listFor, isAllowed, findClosest, searchAccounts } from './accountsCatalog';

describe('accountsCatalog', () => {
  it('listFor filtre par type', () => {
    const achats = listFor('achat');
    const ventes = listFor('vente');
    expect(achats.find(a=>a.code==='706')).toBeUndefined();
    expect(ventes.find(a=>a.code==='606')).toBeUndefined();
    expect(achats.find(a=>a.code==='606')).toBeDefined();
    expect(ventes.find(a=>a.code==='706')).toBeDefined();
  });
  it('isAllowed vrai pour code/ type correct', () => {
    expect(isAllowed('606','achat')).toBe(true);
    expect(isAllowed('606','vente')).toBe(false);
    expect(isAllowed('706','vente')).toBe(true);
  });
  it('findClosest fournit meilleur préfixe', () => {
    const f1 = findClosest('60','achat');
    expect(f1?.code.startsWith('60')).toBe(true);
    const f2 = findClosest('70','vente');
    expect(f2?.code.startsWith('70')).toBe(true);
  });
  it('searchAccounts retourne résultats partiels case insensitive', () => {
    const res = searchAccounts('assu','achat');
    expect(res.find(r=>r.code==='616')).toBeDefined();
  });
});

